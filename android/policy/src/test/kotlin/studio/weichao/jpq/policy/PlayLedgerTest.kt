package studio.weichao.jpq.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayLedgerTest {
    private val sku = MetronomePolicy.PRODUCT_ID

    @Test
    fun pendingAndOtherSkuDoNotUnlock() {
        assertFalse(
            PlayLedger.unlockedFrom(
                listOf(PlayPurchaseRow(listOf(sku), purchased = false, pending = true))
            )
        )
        assertFalse(
            PlayLedger.unlockedFrom(
                listOf(PlayPurchaseRow(listOf("other.sku"), purchased = true, pending = false))
            )
        )
        assertTrue(
            PlayLedger.unlockedFrom(
                listOf(PlayPurchaseRow(listOf(sku), purchased = true, pending = false))
            )
        )
    }

    @Test
    fun okEmptyIsAuthoritativeRevokeNonOkDoesNot() {
        assertEquals(LedgerApply.KeepExisting, PlayLedger.decide(false, emptyList()))
        val emptyOk = PlayLedger.decide(true, emptyList())
        assertTrue(emptyOk is LedgerApply.Commit)
        assertFalse((emptyOk as LedgerApply.Commit).unlocked)
        val owned = PlayLedger.decide(
            true,
            listOf(PlayPurchaseRow(listOf(sku), purchased = true, pending = false))
        )
        assertTrue(owned is LedgerApply.Commit)
        assertTrue((owned as LedgerApply.Commit).unlocked)
    }

    @Test
    fun listenerPartialEmptyPendingOtherSkuDoNotGrantAndAskFullQuery() {
        val sku = MetronomePolicy.PRODUCT_ID
        val empty = PlayLedger.planListener(true, false, emptyList(), awaitingPurchaseUi = false)
        assertFalse(empty.optimisticGrant)
        assertTrue(empty.refreshFull)
        val pending = PlayLedger.planListener(
            true, false,
            listOf(PlayPurchaseRow(listOf(sku), purchased = false, pending = true)),
            awaitingPurchaseUi = true
        )
        assertFalse(pending.optimisticGrant)
        assertTrue(pending.refreshFull)
        val other = PlayLedger.planListener(
            true, false,
            listOf(PlayPurchaseRow(listOf("other.sku"), purchased = true, pending = false)),
            awaitingPurchaseUi = true
        )
        assertFalse(other.optimisticGrant)
        assertTrue(other.refreshFull)
        val grant = PlayLedger.planListener(
            true, false,
            listOf(PlayPurchaseRow(listOf(sku), purchased = true, pending = false)),
            awaitingPurchaseUi = true
        )
        assertTrue(grant.optimisticGrant)
        assertTrue(grant.ackOwned)
        assertTrue(grant.refreshFull)
        val late = PlayLedger.planListener(
            true, false,
            listOf(PlayPurchaseRow(listOf(sku), purchased = true, pending = false)),
            awaitingPurchaseUi = false
        )
        assertFalse(late.optimisticGrant)
        assertTrue(late.refreshFull)
        val cancel = PlayLedger.planListener(false, true, emptyList(), true)
        assertFalse(cancel.refreshFull)
        assertFalse(cancel.optimisticGrant)
    }

    @Test
    fun consumeListenerGrantsOnlyWhenOptimistic() {
        val purchased = listOf(PlayPurchaseRow(listOf(sku), purchased = true, pending = false))
        val late = PlayLedger.planListener(true, false, purchased, awaitingPurchaseUi = false)
        assertEquals(PlayLedger.ListenerConsume.AckOnly, PlayLedger.consumeListener(late))
        val live = PlayLedger.planListener(true, false, purchased, awaitingPurchaseUi = true)
        assertEquals(PlayLedger.ListenerConsume.OptimisticGrant, PlayLedger.consumeListener(live))
        val empty = PlayLedger.planListener(true, false, emptyList(), awaitingPurchaseUi = true)
        assertEquals(PlayLedger.ListenerConsume.None, PlayLedger.consumeListener(empty))
        val cancel = PlayLedger.planListener(false, true, purchased, awaitingPurchaseUi = true)
        assertEquals(PlayLedger.ListenerConsume.None, PlayLedger.consumeListener(cancel))
    }

    @Test
    fun consumeListenerLatePurchaseDoesNotCommitThroughSession() {
        val purchased = listOf(PlayPurchaseRow(listOf(sku), purchased = true, pending = false))
        val plan = PlayLedger.planListener(true, false, purchased, awaitingPurchaseUi = false)
        val session = BillingSessionController()
        var granted = false
        var acked = false
        when (PlayLedger.consumeListener(plan)) {
            PlayLedger.ListenerConsume.OptimisticGrant -> {
                val seq = session.nextLedgerQuery()
                when (val d = session.onLedgerQuery(seq, true, true, allowRevoke = false)) {
                    is LedgerApply.Commit -> granted = d.unlocked
                    else -> acked = true
                }
            }
            PlayLedger.ListenerConsume.AckOnly -> acked = true
            PlayLedger.ListenerConsume.None -> { }
        }
        assertFalse(granted)
        assertTrue(acked)
        assertTrue(plan.refreshFull)
    }
}
