package studio.weichao.jpq.policy

/** Billing-free row for one Play Purchase. */
data class PlayPurchaseRow(
    val productIds: List<String>,
    val purchased: Boolean,
    val pending: Boolean
)

sealed class LedgerApply {
    object KeepExisting : LedgerApply()
    data class Commit(val unlocked: Boolean) : LedgerApply()
    object IgnoreStale : LedgerApply()
}

object PlayLedger {
    fun unlockedFrom(
        rows: List<PlayPurchaseRow>,
        sku: String = MetronomePolicy.PRODUCT_ID
    ): Boolean = rows.any { sku in it.productIds && it.purchased && !it.pending }

    /**
     * 完整 queryPurchases：OK+empty → Commit(false) 权威撤销。
     * 非 OK → KeepExisting。
     */
    fun decide(responseOk: Boolean, rows: List<PlayPurchaseRow>): LedgerApply {
        if (!responseOk) return LedgerApply.KeepExisting
        return LedgerApply.Commit(unlockedFrom(rows))
    }

    /**
     * Billing 7 [PurchasesUpdatedListener] 列表是更新，不是完整库存
     * （https://developer.android.com/reference/com/android/billingclient/api/PurchasesUpdatedListener
     *  核验 2026-09-06）。empty / PENDING / 非本 SKU 不得推导撤销。
     */
    data class ListenerPlan(
        val ackOwned: Boolean,
        val optimisticGrant: Boolean,
        val refreshFull: Boolean
    )

    /** How the adapter should consume a listener plan. Ack without grant when awaiting=false. */
    enum class ListenerConsume { None, AckOnly, OptimisticGrant }

    fun consumeListener(plan: ListenerPlan): ListenerConsume {
        if (plan.optimisticGrant) return ListenerConsume.OptimisticGrant
        if (plan.ackOwned) return ListenerConsume.AckOnly
        return ListenerConsume.None
    }

    fun planListener(
        responseOk: Boolean,
        userCanceled: Boolean,
        rows: List<PlayPurchaseRow>,
        awaitingPurchaseUi: Boolean
    ): ListenerPlan {
        if (!responseOk || userCanceled) {
            return ListenerPlan(ackOwned = false, optimisticGrant = false, refreshFull = false)
        }
        val owned = unlockedFrom(rows)
        val ack = rows.any { MetronomePolicy.PRODUCT_ID in it.productIds && it.purchased }
        return ListenerPlan(
            ackOwned = ack,
            optimisticGrant = owned && awaitingPurchaseUi,
            refreshFull = true
        )
    }
}
