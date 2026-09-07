package studio.weichao.jpq.policy

sealed class PurchaseBegin {
    data class Started(val gen: Long) : PurchaseBegin()
    data class Rejected(val messageKey: String?) : PurchaseBegin()
}

sealed class StoreRestoreResult {
    data class Done(val unlocked: Boolean) : StoreRestoreResult()
    object Busy : StoreRestoreResult()
    object Unavailable : StoreRestoreResult()
    object Failed : StoreRestoreResult()
    object Stale : StoreRestoreResult()
}

data class DisconnectEffect(
    val releasedOp: StoreBusyGuard.Op,
    val scheduleAuto: Boolean,
    val delayMs: Long?,
    val messageKey: String?
)

data class SetupEffect(
    val queryLedgerAndPrice: Boolean,
    val autoLaunchPurchase: Boolean
)

data class PurchaseUpdateEffect(
    val applyPurchases: Boolean,
    val endedPurchase: Boolean,
    val messageKey: String?
)

sealed class RestoreBegin {
    data class Started(val token: Long) : RestoreBegin()
    data class Rejected(val result: StoreRestoreResult) : RestoreBegin()
}

/**
 * PlayStoreAdapter 实际使用的会话控制器（无 Billing SDK）。
 * generation 守卫异步 queryProductDetails；断线/关闭使旧代失效。
 * PurchasesUpdatedListener 无自定义 token：只在 awaitingPurchaseUi 且 busy=Purchase
 * 时结束购买忙态；否则只允许刷新账本，不解除 Restore/新代 Purchase。
 */
class BillingSessionController {
    private val busy = StoreBusyGuard()
    var purchaseGen: Long = 0L
        private set
    var restoreGen: Long = 0L
        private set
    var ledgerQuerySeq: Long = 0L
        private set
    var lastAppliedLedgerSeq: Long = 0L
        private set
    var priceQuerySeq: Long = 0L
        private set
    var awaitingPurchaseUi: Boolean = false
        private set
    var reconnectAttempt: Int = 0
        private set
    var closed: Boolean = false
        private set
    var connected: Boolean = false
        private set
    var connecting: Boolean = false
        private set

    val busyOp: StoreBusyGuard.Op get() = busy.current
    val isBusy: Boolean get() = busy.busy

    fun isLivePurchaseGen(gen: Long): Boolean =
        !closed && gen == purchaseGen && busy.current == StoreBusyGuard.Op.Purchase

    fun isLiveRestore(token: Long): Boolean =
        !closed && token == restoreGen && busy.current == StoreBusyGuard.Op.Restore

    fun nextLedgerQuery(): Long {
        ledgerQuerySeq += 1
        return ledgerQuerySeq
    }

    fun nextPriceQuery(): Long {
        priceQuerySeq += 1
        return priceQuerySeq
    }

    fun canApplyPrice(seq: Long): Boolean = !closed && seq == priceQuerySeq

    /**
     * 成功结果按序号提交：较新的成功覆盖较旧的成功。
     * 失败永不 Commit，也不会抬高 lastApplied，因此不能把后续真正成功的账本永久压掉。
     */
    fun onLedgerQuery(
        seq: Long,
        responseOk: Boolean,
        unlockedFromRows: Boolean,
        allowRevoke: Boolean = true
    ): LedgerApply {
        if (closed) return LedgerApply.IgnoreStale
        if (!responseOk) return LedgerApply.KeepExisting
        if (!allowRevoke && !unlockedFromRows) return LedgerApply.KeepExisting
        if (seq < lastAppliedLedgerSeq) return LedgerApply.IgnoreStale
        lastAppliedLedgerSeq = seq
        return LedgerApply.Commit(unlockedFromRows)
    }

    fun beginPurchase(ready: Boolean): PurchaseBegin {
        if (closed) return PurchaseBegin.Rejected("buy_unavailable")
        if (!ready) {
            prepareUserReconnect()
            return PurchaseBegin.Rejected("buy_unavailable")
        }
        if (!busy.tryBegin(StoreBusyGuard.Op.Purchase)) {
            return PurchaseBegin.Rejected("buying")
        }
        purchaseGen += 1
        awaitingPurchaseUi = false
        return PurchaseBegin.Started(purchaseGen)
    }

    /** true = 当前代仍有效，可以 launchBillingFlow。失败且仍是当前代则释放 Purchase。 */
    fun onProductDetailsResult(gen: Long, ok: Boolean): Boolean {
        if (!isLivePurchaseGen(gen)) return false
        if (!ok) {
            awaitingPurchaseUi = false
            busy.end(StoreBusyGuard.Op.Purchase)
            return false
        }
        return true
    }

    fun failPurchase(gen: Long): Boolean {
        if (!isLivePurchaseGen(gen)) return false
        awaitingPurchaseUi = false
        busy.end(StoreBusyGuard.Op.Purchase)
        return true
    }

    fun onBillingFlowLaunched(gen: Long, launched: Boolean): String? {
        if (!isLivePurchaseGen(gen)) return null
        if (launched) {
            awaitingPurchaseUi = true
            return null
        }
        awaitingPurchaseUi = false
        busy.end(StoreBusyGuard.Op.Purchase)
        return "buy_failed"
    }

    fun onPurchasesUpdated(
        ok: Boolean,
        userCanceled: Boolean,
        pendingOnly: Boolean
    ): PurchaseUpdateEffect {
        val apply = ok
        val forCurrentFlow = awaitingPurchaseUi && busy.current == StoreBusyGuard.Op.Purchase
        if (!forCurrentFlow) {
            return PurchaseUpdateEffect(
                applyPurchases = apply,
                endedPurchase = false,
                messageKey = null
            )
        }
        awaitingPurchaseUi = false
        busy.end(StoreBusyGuard.Op.Purchase)
        val msg = when {
            userCanceled -> "buy_cancelled"
            !ok -> "buy_failed"
            pendingOnly -> "buying"
            else -> null
        }
        return PurchaseUpdateEffect(applyPurchases = apply, endedPurchase = true, messageKey = msg)
    }

    fun beginRestore(ready: Boolean): RestoreBegin {
        if (closed) return RestoreBegin.Rejected(StoreRestoreResult.Unavailable)
        if (!busy.tryBegin(StoreBusyGuard.Op.Restore)) {
            return RestoreBegin.Rejected(StoreRestoreResult.Busy)
        }
        if (!ready) {
            busy.end(StoreBusyGuard.Op.Restore)
            prepareUserReconnect()
            return RestoreBegin.Rejected(StoreRestoreResult.Unavailable)
        }
        restoreGen += 1
        return RestoreBegin.Started(restoreGen)
    }

    fun finishRestore(token: Long, unlocked: Boolean): StoreRestoreResult {
        if (!isLiveRestore(token)) return StoreRestoreResult.Stale
        busy.end(StoreBusyGuard.Op.Restore)
        return StoreRestoreResult.Done(unlocked)
    }

    fun failRestore(token: Long): StoreRestoreResult {
        if (!isLiveRestore(token)) return StoreRestoreResult.Stale
        busy.end(StoreBusyGuard.Op.Restore)
        return StoreRestoreResult.Failed
    }

    fun cancelRestore(token: Long): StoreRestoreResult {
        if (!isLiveRestore(token)) return StoreRestoreResult.Stale
        busy.end(StoreBusyGuard.Op.Restore)
        return StoreRestoreResult.Stale
    }

    fun onDisconnected(): DisconnectEffect {
        if (closed) {
            return DisconnectEffect(StoreBusyGuard.Op.None, false, null, null)
        }
        connected = false
        connecting = false
        invalidateInFlight()
        val op = busy.current
        if (op != StoreBusyGuard.Op.None) {
            busy.end(op)
        }
        val delay = BillingReconnectPolicy.nextDelayMs(reconnectAttempt + 1)
        return if (delay != null) {
            reconnectAttempt += 1
            val msg = if (op != StoreBusyGuard.Op.None) "buy_unavailable" else null
            DisconnectEffect(op, true, delay, msg)
        } else {
            DisconnectEffect(op, false, null, "buy_unavailable")
        }
    }

    fun onSetupFinished(ok: Boolean): SetupEffect {
        connecting = false
        if (closed) return SetupEffect(queryLedgerAndPrice = false, autoLaunchPurchase = false)
        connected = ok
        if (ok) {
            reconnectAttempt = 0
            return SetupEffect(queryLedgerAndPrice = true, autoLaunchPurchase = false)
        }
        return SetupEffect(queryLedgerAndPrice = false, autoLaunchPurchase = false)
    }

    fun markConnecting() {
        connecting = true
    }

    fun shouldStartConnection(): Boolean = !closed && !connecting && !connected

    /** 自动重试用尽后，用户点 Buy/Restore 可再开一轮有界连接，不自动弹购买页。 */
    fun prepareUserReconnect(): Boolean {
        if (closed || connected || connecting) return false
        reconnectAttempt = 0
        return true
    }

    fun close() {
        closed = true
        connected = false
        connecting = false
        invalidateInFlight()
        val op = busy.current
        if (op != StoreBusyGuard.Op.None) busy.end(op)
    }

    private fun invalidateInFlight() {
        purchaseGen += 1
        restoreGen += 1
        priceQuerySeq += 1
        awaitingPurchaseUi = false
    }
}
