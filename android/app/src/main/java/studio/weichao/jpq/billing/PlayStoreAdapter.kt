package studio.weichao.jpq.billing

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import studio.weichao.jpq.policy.BillingSessionController
import studio.weichao.jpq.policy.LedgerApply
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.PlayLedger
import studio.weichao.jpq.policy.PlayPurchaseRow
import studio.weichao.jpq.policy.PurchaseBegin
import studio.weichao.jpq.policy.RestoreBegin
import studio.weichao.jpq.policy.StoreAdapter
import studio.weichao.jpq.policy.StoreRestoreResult
import kotlin.coroutines.resume

class PlayStoreAdapter(
    context: Context,
    private val onEntitlementChange: (Boolean) -> Unit,
    private val onMessage: (String) -> Unit = {},
    private val onPrice: (String?) -> Unit = {},
    private val onAvailable: (Boolean) -> Unit = {},
    private val onBusy: (Boolean) -> Unit = {},
    internal val session: BillingSessionController = BillingSessionController()
) : StoreAdapter {
    @Volatile private var unlocked = false
    @Volatile var formattedPrice: String? = null
        private set
    @Volatile var available: Boolean = false
        private set
    private val client: BillingClient
    private val mainHandler = Handler(Looper.getMainLooper())
    private var reconnectToken: Runnable? = null

    private sealed class PurchaseQuery {
        data class Ok(val seq: Long, val rows: List<PlayPurchaseRow>, val raw: List<Purchase>) : PurchaseQuery()
        data class Failed(val seq: Long) : PurchaseQuery()
        object Closed : PurchaseQuery()
    }

    private val stateListener = object : BillingClientStateListener {
        override fun onBillingSetupFinished(result: BillingResult) {
            if (session.closed) return
            val ok = result.responseCode == BillingClient.BillingResponseCode.OK
            available = ok
            onAvailable(ok)
            val effect = session.onSetupFinished(ok)
            if (effect.queryLedgerAndPrice) {
                refreshPurchases()
                queryPrice()
            }
        }

        override fun onBillingServiceDisconnected() {
            available = false
            onAvailable(false)
            val effect = session.onDisconnected()
            emitBusy()
            effect.messageKey?.let { onMessage(it) }
            val delay = effect.delayMs
            if (effect.scheduleAuto && delay != null) {
                scheduleReconnect(delay)
            }
        }
    }

    init {
        client = BillingClient.newBuilder(context)
            .setListener(PurchasesUpdatedListener { result, purchases ->
                val canceled = result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED
                val ok = result.responseCode == BillingClient.BillingResponseCode.OK
                val list = purchases.orEmpty()
                val pendingOnly = ok && list.isNotEmpty() &&
                    list.none { it.purchaseState == Purchase.PurchaseState.PURCHASED } &&
                    list.any { it.purchaseState == Purchase.PurchaseState.PENDING }
                val awaiting = session.awaitingPurchaseUi
                val fx = session.onPurchasesUpdated(ok, canceled, pendingOnly)
                val rows = rowsOf(list)
                val plan = PlayLedger.planListener(ok, canceled, rows, awaiting)
                when (PlayLedger.consumeListener(plan)) {
                    PlayLedger.ListenerConsume.OptimisticGrant -> {
                        val seq = session.nextLedgerQuery()
                        when (val d = session.onLedgerQuery(seq, true, true, allowRevoke = false)) {
                            is LedgerApply.Commit -> applyCommit(d.unlocked, list)
                            else -> ackOwned(list)
                        }
                    }
                    PlayLedger.ListenerConsume.AckOnly -> ackOwned(list)
                    PlayLedger.ListenerConsume.None -> { }
                }
                if (plan.refreshFull) refreshPurchases()
                emitBusy()
                fx.messageKey?.let { onMessage(it) }
            })
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build()
        connectIfNeeded()
    }

    override suspend fun currentEntitlement(): Boolean {
        if (!client.isReady) return unlocked
        return when (val q = queryPurchases()) {
            is PurchaseQuery.Closed -> unlocked
            is PurchaseQuery.Failed -> {
                session.onLedgerQuery(q.seq, false, false)
                unlocked
            }
            is PurchaseQuery.Ok -> when (val d = session.onLedgerQuery(q.seq, true, PlayLedger.unlockedFrom(q.rows))) {
                is LedgerApply.Commit -> {
                    applyCommit(d.unlocked, q.raw)
                    unlocked
                }
                else -> unlocked
            }
        }
    }

    override suspend fun productPrice(): String? {
        if (formattedPrice != null) return formattedPrice
        if (client.isReady) queryPrice()
        return formattedPrice
    }

    override suspend fun purchase() {
        /* Host activity calls launch(). */
    }

    fun launch(activity: Activity) {
        when (val begin = session.beginPurchase(client.isReady)) {
            is PurchaseBegin.Rejected -> {
                emitBusy()
                begin.messageKey?.let { onMessage(it) }
                if (!client.isReady) connectIfNeeded()
                return
            }
            is PurchaseBegin.Started -> {
                emitBusy()
                queryThenLaunch(activity, begin.gen)
            }
        }
    }

    override suspend fun restore(): StoreRestoreResult {
        when (val begin = session.beginRestore(client.isReady)) {
            is RestoreBegin.Rejected -> {
                emitBusy()
                if (begin.result == StoreRestoreResult.Unavailable) connectIfNeeded()
                return begin.result
            }
            is RestoreBegin.Started -> {
                val token = begin.token
                emitBusy()
                return try {
                    if (session.closed) {
                        session.cancelRestore(token)
                    } else if (!client.isReady) {
                        val ended = session.failRestore(token)
                        if (ended is StoreRestoreResult.Stale) ended else StoreRestoreResult.Unavailable
                    } else {
                        when (val q = queryPurchases()) {
                            is PurchaseQuery.Closed -> session.cancelRestore(token)
                            is PurchaseQuery.Failed -> {
                                session.onLedgerQuery(q.seq, false, false)
                                session.failRestore(token)
                            }
                            is PurchaseQuery.Ok -> {
                                if (!session.isLiveRestore(token)) {
                                    StoreRestoreResult.Stale
                                } else {
                                    when (val d = session.onLedgerQuery(q.seq, true, PlayLedger.unlockedFrom(q.rows))) {
                                        is LedgerApply.Commit -> {
                                            applyCommit(d.unlocked, q.raw)
                                            session.finishRestore(token, unlocked)
                                        }
                                        LedgerApply.KeepExisting -> session.failRestore(token)
                                        LedgerApply.IgnoreStale -> StoreRestoreResult.Stale
                                    }
                                }
                            }
                        }
                    }
                } catch (e: CancellationException) {
                    session.cancelRestore(token)
                    throw e
                } catch (_: Exception) {
                    session.failRestore(token)
                } finally {
                    emitBusy()
                }
            }
        }
    }

    fun close() {
        reconnectToken?.let { mainHandler.removeCallbacks(it) }
        reconnectToken = null
        session.close()
        emitBusy()
        try {
            client.endConnection()
        } catch (_: Exception) {
        }
    }

    private fun queryThenLaunch(activity: Activity, gen: Long) {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(MetronomePolicy.PRODUCT_ID)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                )
            ).build()
        client.queryProductDetailsAsync(params) { result, details ->
            if (!session.isLivePurchaseGen(gen)) return@queryProductDetailsAsync
            if (result.responseCode != BillingClient.BillingResponseCode.OK || details.isNullOrEmpty()) {
                if (session.failPurchase(gen)) {
                    emitBusy()
                    onMessage("buy_unavailable")
                }
                return@queryProductDetailsAsync
            }
            if (!session.onProductDetailsResult(gen, true)) return@queryProductDetailsAsync
            val product = details.first()
            formattedPrice = product.oneTimePurchaseOfferDetails?.formattedPrice
            onPrice(formattedPrice)
            val flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(product)
                            .build()
                    )
                ).build()
            val launchResult = client.launchBillingFlow(activity, flow)
            val launched = launchResult.responseCode == BillingClient.BillingResponseCode.OK
            val failKey = session.onBillingFlowLaunched(gen, launched)
            emitBusy()
            if (failKey != null) onMessage(failKey)
        }
    }

    private fun emitBusy() {
        onBusy(session.isBusy)
    }

    private fun connectIfNeeded() {
        if (!session.shouldStartConnection()) return
        when (client.connectionState) {
            BillingClient.ConnectionState.CONNECTED,
            BillingClient.ConnectionState.CONNECTING,
            BillingClient.ConnectionState.CLOSED -> return
            else -> {
                session.markConnecting()
                client.startConnection(stateListener)
            }
        }
    }

    private fun scheduleReconnect(delayMs: Long) {
        reconnectToken?.let { mainHandler.removeCallbacks(it) }
        val task = Runnable { connectIfNeeded() }
        reconnectToken = task
        mainHandler.postDelayed(task, delayMs)
    }

    private fun queryPrice() {
        if (session.closed) return
        val seq = session.nextPriceQuery()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(MetronomePolicy.PRODUCT_ID)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                )
            ).build()
        client.queryProductDetailsAsync(params) { _, details ->
            if (!session.canApplyPrice(seq)) return@queryProductDetailsAsync
            formattedPrice = details.firstOrNull()?.oneTimePurchaseOfferDetails?.formattedPrice
            onPrice(formattedPrice)
        }
    }

    private suspend fun queryPurchases(): PurchaseQuery = suspendCancellableCoroutine { cont ->
        if (session.closed) {
            cont.resume(PurchaseQuery.Closed)
            return@suspendCancellableCoroutine
        }
        val seq = session.nextLedgerQuery()
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { result, purchases ->
            val q = when {
                session.closed -> PurchaseQuery.Closed
                result.responseCode != BillingClient.BillingResponseCode.OK -> PurchaseQuery.Failed(seq)
                else -> {
                    val list = purchases.orEmpty()
                    PurchaseQuery.Ok(seq, rowsOf(list), list)
                }
            }
            if (cont.isActive) cont.resume(q)
        }
    }

    private fun refreshPurchases() {
        if (session.closed) return
        val seq = session.nextLedgerQuery()
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { result, purchases ->
            if (session.closed) return@queryPurchasesAsync
            val ok = result.responseCode == BillingClient.BillingResponseCode.OK
            val list = purchases.orEmpty()
            val owned = if (ok) PlayLedger.unlockedFrom(rowsOf(list)) else false
            when (val d = session.onLedgerQuery(seq, ok, owned)) {
                is LedgerApply.Commit -> applyCommit(d.unlocked, list)
                else -> { }
            }
        }
    }

    private fun rowsOf(purchases: List<Purchase>): List<PlayPurchaseRow> = purchases.map { p ->
        PlayPurchaseRow(
            productIds = p.products,
            purchased = p.purchaseState == Purchase.PurchaseState.PURCHASED,
            pending = p.purchaseState == Purchase.PurchaseState.PENDING
        )
    }

    private fun ackOwned(raw: List<Purchase>) {
        for (p in raw) {
            if (!p.products.contains(MetronomePolicy.PRODUCT_ID)) continue
            if (p.purchaseState != Purchase.PurchaseState.PURCHASED) continue
            if (!p.isAcknowledged) {
                client.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(p.purchaseToken)
                        .build()
                ) { }
            }
        }
    }

    private fun applyCommit(unlockedNow: Boolean, raw: List<Purchase>) {
        unlocked = unlockedNow
        ackOwned(raw)
        onEntitlementChange(unlocked)
    }
}
