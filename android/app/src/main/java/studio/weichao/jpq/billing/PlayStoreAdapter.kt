package studio.weichao.jpq.billing

import android.app.Activity
import android.content.Context
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
import kotlinx.coroutines.suspendCancellableCoroutine
import studio.weichao.jpq.policy.MetronomePolicy
import studio.weichao.jpq.policy.StoreAdapter
import kotlin.coroutines.resume

class PlayStoreAdapter(
    context: Context,
    private val onEntitlementChange: (Boolean) -> Unit,
    private val onMessage: (String) -> Unit = {},
    private val onPrice: (String?) -> Unit = {},
    private val onAvailable: (Boolean) -> Unit = {}
) : StoreAdapter {
    @Volatile private var unlocked = false
    @Volatile var formattedPrice: String? = null
        private set
    @Volatile var available: Boolean = false
        private set
    private val client: BillingClient

    init {
        client = BillingClient.newBuilder(context)
            .setListener(PurchasesUpdatedListener { result, purchases ->
                when (result.responseCode) {
                    BillingClient.BillingResponseCode.OK -> handlePurchases(purchases.orEmpty())
                    BillingClient.BillingResponseCode.USER_CANCELED -> onMessage("buy_cancelled")
                    else -> onMessage("buy_failed")
                }
            })
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build()
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                available = result.responseCode == BillingClient.BillingResponseCode.OK
                onAvailable(available)
                if (available) {
                    refreshPurchases()
                    queryPrice()
                }
            }
            override fun onBillingServiceDisconnected() {}
        })
    }

    override suspend fun currentEntitlement(): Boolean {
        if (!client.isReady) return unlocked
        return queryAndApply()
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
        if (!client.isReady) {
            onMessage("buy_unavailable")
            return
        }
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
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                onMessage("buy_unavailable")
                return@queryProductDetailsAsync
            }
            val product = details.firstOrNull()
            if (product == null) {
                onMessage("buy_unavailable")
                return@queryProductDetailsAsync
            }
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
            if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
                onMessage("buy_failed")
            }
        }
    }

    override suspend fun restore() {
        queryAndApply()
    }

    private fun queryPrice() {
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
            formattedPrice = details.firstOrNull()?.oneTimePurchaseOfferDetails?.formattedPrice
            onPrice(formattedPrice)
        }
    }

    private suspend fun queryAndApply(): Boolean = suspendCancellableCoroutine { cont ->
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { _, purchases ->
            handlePurchases(purchases)
            if (cont.isActive) cont.resume(unlocked)
        }
    }

    private fun refreshPurchases() {
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        ) { _, purchases -> handlePurchases(purchases) }
    }

    private fun handlePurchases(purchases: List<Purchase>) {
        var owned = false
        for (p in purchases) {
            if (!p.products.contains(MetronomePolicy.PRODUCT_ID)) continue
            if (p.purchaseState != Purchase.PurchaseState.PURCHASED) continue
            owned = true
            if (!p.isAcknowledged) {
                client.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(p.purchaseToken)
                        .build()
                ) { }
            }
        }
        unlocked = owned
        onEntitlementChange(owned)
    }
}
