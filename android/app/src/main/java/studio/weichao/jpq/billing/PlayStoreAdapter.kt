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
    private val onEntitlementChange: (Boolean) -> Unit
) : StoreAdapter {
    @Volatile private var unlocked = false
    private val client: BillingClient

    init {
        client = BillingClient.newBuilder(context)
            .setListener(PurchasesUpdatedListener { result, purchases ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    handlePurchases(purchases.orEmpty())
                }
            })
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build()
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    refreshPurchases()
                }
            }
            override fun onBillingServiceDisconnected() {}
        })
    }

    override suspend fun currentEntitlement(): Boolean {
        if (!client.isReady) return unlocked
        return queryAndApply()
    }

    override suspend fun purchase() {
        /* Host activity calls launch(). */
    }

    fun launch(activity: Activity) {
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
            val product = details.firstOrNull() ?: return@queryProductDetailsAsync
            val flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(product)
                            .build()
                    )
                ).build()
            client.launchBillingFlow(activity, flow)
        }
    }

    override suspend fun restore() {
        queryAndApply()
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
