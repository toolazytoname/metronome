package studio.weichao.jpq.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BillingSessionControllerTest {
    @Test
    fun purchaseDisconnectReconnectReleasesBusyWithoutAutoLaunch() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val begin = s.beginPurchase(ready = true)
        assertTrue(begin is PurchaseBegin.Started)
        val gen = (begin as PurchaseBegin.Started).gen
        assertTrue(s.isBusy)
        assertEquals(StoreBusyGuard.Op.Purchase, s.busyOp)

        val disc = s.onDisconnected()
        assertEquals(StoreBusyGuard.Op.Purchase, disc.releasedOp)
        assertEquals("buy_unavailable", disc.messageKey)
        assertTrue(disc.scheduleAuto)
        assertFalse(s.isBusy)
        assertNotEquals(gen, s.purchaseGen)
        assertFalse(s.onProductDetailsResult(gen, true))

        val setup = s.onSetupFinished(true)
        assertTrue(setup.queryLedgerAndPrice)
        assertFalse(setup.autoLaunchPurchase)
        assertFalse(s.isBusy)
        assertTrue(s.beginPurchase(ready = true) is PurchaseBegin.Started)
    }

    @Test
    fun closeInvalidatesOldProductQueryAndDoesNotLaunch() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val gen = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        s.close()
        assertTrue(s.closed)
        assertFalse(s.isBusy)
        assertFalse(s.onProductDetailsResult(gen, true))
        assertNull(s.onBillingFlowLaunched(gen, true))
        assertFalse(s.awaitingPurchaseUi)
        assertTrue(s.beginPurchase(true) is PurchaseBegin.Rejected)
    }

    @Test
    fun staleQueryCannotClearNewerPurchaseOrLaunch() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val old = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        s.onDisconnected()
        s.onSetupFinished(true)
        val newer = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        assertTrue(s.isBusy)
        assertFalse(s.onProductDetailsResult(old, true))
        assertEquals(StoreBusyGuard.Op.Purchase, s.busyOp)
        assertTrue(s.onProductDetailsResult(newer, true))
        assertNull(s.onBillingFlowLaunched(old, true))
        assertFalse(s.awaitingPurchaseUi)
        assertNull(s.onBillingFlowLaunched(newer, true))
        assertTrue(s.awaitingPurchaseUi)
    }

    @Test
    fun lateListenerDoesNotEndRestore() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val gen = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        s.onBillingFlowLaunched(gen, true)
        s.onDisconnected()
        val started = s.beginRestore(ready = true)
        assertTrue(started is RestoreBegin.Started)
        val token = (started as RestoreBegin.Started).token
        assertEquals(StoreBusyGuard.Op.Restore, s.busyOp)
        val late = s.onPurchasesUpdated(ok = false, userCanceled = true, pendingOnly = false)
        assertFalse(late.endedPurchase)
        assertEquals(StoreBusyGuard.Op.Restore, s.busyOp)
        val done = s.finishRestore(token, unlocked = false)
        assertTrue(done is StoreRestoreResult.Done)
        assertFalse((done as StoreRestoreResult.Done).unlocked)
    }

    @Test
    fun reconnectExhaustedThenUserRetryBoundedNoAutoLaunch() {
        val s = BillingSessionController()
        repeat(BillingReconnectPolicy.MAX_ATTEMPTS) {
            val d = s.onDisconnected()
            assertTrue(d.scheduleAuto)
        }
        val exhausted = s.onDisconnected()
        assertFalse(exhausted.scheduleAuto)
        assertEquals("buy_unavailable", exhausted.messageKey)
        assertEquals(BillingReconnectPolicy.MAX_ATTEMPTS, s.reconnectAttempt)

        assertTrue(s.prepareUserReconnect())
        assertEquals(0, s.reconnectAttempt)
        assertTrue(s.shouldStartConnection())
        s.markConnecting()
        val setup = s.onSetupFinished(true)
        assertTrue(setup.queryLedgerAndPrice)
        assertFalse(setup.autoLaunchPurchase)
        assertFalse(s.isBusy)
    }

    @Test
    fun restoreBusyAndNotReadyAreExplicit() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        s.beginPurchase(true)
        val busy = s.beginRestore(true)
        assertTrue(busy is RestoreBegin.Rejected)
        assertEquals(StoreRestoreResult.Busy, (busy as RestoreBegin.Rejected).result)
        s.onDisconnected()
        s.onSetupFinished(false)
        val unavail = s.beginRestore(ready = false)
        assertTrue(unavail is RestoreBegin.Rejected)
        assertEquals(StoreRestoreResult.Unavailable, (unavail as RestoreBegin.Rejected).result)
        assertFalse(s.isBusy)
        assertEquals(0, s.reconnectAttempt)
    }

    @Test
    fun pendingUpdateDoesNotUnlockAndUsesBuyingCopy() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val gen = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        s.onBillingFlowLaunched(gen, true)
        val fx = s.onPurchasesUpdated(ok = true, userCanceled = false, pendingOnly = true)
        assertTrue(fx.applyPurchases)
        assertTrue(fx.endedPurchase)
        assertEquals("buying", fx.messageKey)
        assertFalse(s.isBusy)
    }

    @Test
    fun cancelAndFailEndPurchase() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val g1 = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        s.onBillingFlowLaunched(g1, true)
        val cancel = s.onPurchasesUpdated(ok = false, userCanceled = true, pendingOnly = false)
        assertEquals("buy_cancelled", cancel.messageKey)
        assertFalse(s.isBusy)

        val g2 = (s.beginPurchase(true) as PurchaseBegin.Started).gen
        s.onBillingFlowLaunched(g2, true)
        val fail = s.onPurchasesUpdated(ok = false, userCanceled = false, pendingOnly = false)
        assertEquals("buy_failed", fail.messageKey)
        assertEquals("buy_failed", s.onBillingFlowLaunched((s.beginPurchase(true) as PurchaseBegin.Started).gen, false))
    }

    @Test
    fun restoreStaleAfterDisconnectDoesNotLookSuccessful() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val token = (s.beginRestore(true) as RestoreBegin.Started).token
        s.onDisconnected()
        val stale = s.finishRestore(token, unlocked = true)
        assertEquals(StoreRestoreResult.Stale, stale)
        assertFalse(s.isBusy)
    }

    @Test
    fun shouldNotDoubleStartConnection() {
        val s = BillingSessionController()
        assertTrue(s.shouldStartConnection())
        s.markConnecting()
        assertFalse(s.shouldStartConnection())
        s.onSetupFinished(true)
        assertFalse(s.shouldStartConnection())
        s.close()
        assertFalse(s.shouldStartConnection())
        assertFalse(s.prepareUserReconnect())
    }

    @Test
    fun nonOkEmptyQueryKeepsExistingUnlock() {
        val s = BillingSessionController()
        val seqOk = s.nextLedgerQuery()
        val first = s.onLedgerQuery(seqOk, true, true)
        assertTrue(first is LedgerApply.Commit)
        assertTrue((first as LedgerApply.Commit).unlocked)
        val seqFail = s.nextLedgerQuery()
        val keep = s.onLedgerQuery(seqFail, false, false)
        assertEquals(LedgerApply.KeepExisting, keep)
        val seqEmpty = s.nextLedgerQuery()
        val revoked = s.onLedgerQuery(seqEmpty, true, false)
        assertTrue(revoked is LedgerApply.Commit)
        assertFalse((revoked as LedgerApply.Commit).unlocked)
    }

    @Test
    fun laterFailureDoesNotBlockEarlierOrLaterSuccess() {
        val s = BillingSessionController()
        val q1 = s.nextLedgerQuery()
        val q2 = s.nextLedgerQuery()
        assertEquals(LedgerApply.KeepExisting, s.onLedgerQuery(q2, false, false))
        val c1 = s.onLedgerQuery(q1, true, true)
        assertTrue(c1 is LedgerApply.Commit)
        assertTrue((c1 as LedgerApply.Commit).unlocked)
        val q3 = s.nextLedgerQuery()
        val c3 = s.onLedgerQuery(q3, true, false)
        assertTrue(c3 is LedgerApply.Commit)
        assertFalse((c3 as LedgerApply.Commit).unlocked)
        assertEquals(LedgerApply.IgnoreStale, s.onLedgerQuery(q1, true, true))
    }

    @Test
    fun restoreACannotFinishRestoreB() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val a = (s.beginRestore(true) as RestoreBegin.Started).token
        s.onDisconnected()
        s.onSetupFinished(true)
        val b = (s.beginRestore(true) as RestoreBegin.Started).token
        assertNotEquals(a, b)
        assertEquals(StoreRestoreResult.Stale, s.finishRestore(a, true))
        assertEquals(StoreBusyGuard.Op.Restore, s.busyOp)
        assertEquals(StoreRestoreResult.Stale, s.failRestore(a))
        assertEquals(StoreBusyGuard.Op.Restore, s.busyOp)
        val done = s.finishRestore(b, false)
        assertTrue(done is StoreRestoreResult.Done)
        assertFalse((done as StoreRestoreResult.Done).unlocked)
        assertFalse(s.isBusy)
    }

    @Test
    fun cancelRestoreOnlyEndsMatchingToken() {
        val s = BillingSessionController()
        s.onSetupFinished(true)
        val a = (s.beginRestore(true) as RestoreBegin.Started).token
        s.onDisconnected()
        s.onSetupFinished(true)
        val b = (s.beginRestore(true) as RestoreBegin.Started).token
        assertEquals(StoreRestoreResult.Stale, s.cancelRestore(a))
        assertEquals(StoreBusyGuard.Op.Restore, s.busyOp)
        assertEquals(StoreRestoreResult.Stale, s.cancelRestore(b))
        assertFalse(s.isBusy)
    }

    @Test
    fun listenerPartialCannotRevokeExistingGrant() {
        val s = BillingSessionController()
        val grant = s.nextLedgerQuery()
        assertTrue((s.onLedgerQuery(grant, true, true, allowRevoke = false) as LedgerApply.Commit).unlocked)
        val partial = s.nextLedgerQuery()
        assertEquals(
            LedgerApply.KeepExisting,
            s.onLedgerQuery(partial, true, false, allowRevoke = false)
        )
        val fullEmpty = s.nextLedgerQuery()
        val revoked = s.onLedgerQuery(fullEmpty, true, false, allowRevoke = true)
        assertTrue(revoked is LedgerApply.Commit)
        assertFalse((revoked as LedgerApply.Commit).unlocked)
    }

    @Test
    fun olderQueryEmptyDoesNotOverrideNewerGrant() {
        val s = BillingSessionController()
        val older = s.nextLedgerQuery()
        val newer = s.nextLedgerQuery()
        assertTrue((s.onLedgerQuery(newer, true, true) as LedgerApply.Commit).unlocked)
        assertEquals(LedgerApply.IgnoreStale, s.onLedgerQuery(older, true, false))
    }

    @Test
    fun closeRejectsPriceAndLedger() {
        val s = BillingSessionController()
        val price = s.nextPriceQuery()
        val ledger = s.nextLedgerQuery()
        s.close()
        assertFalse(s.canApplyPrice(price))
        assertEquals(LedgerApply.IgnoreStale, s.onLedgerQuery(ledger, true, true))
        val newPrice = s.nextPriceQuery()
        assertFalse(s.canApplyPrice(newPrice))
    }
}
