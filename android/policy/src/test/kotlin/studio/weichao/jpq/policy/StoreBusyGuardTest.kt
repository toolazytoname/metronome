package studio.weichao.jpq.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StoreBusyGuardTest {
    @Test
    fun purchaseBlocksSecondPurchaseAndRestore() {
        val g = StoreBusyGuard()
        assertTrue(g.tryBegin(StoreBusyGuard.Op.Purchase))
        assertTrue(g.busy)
        assertFalse(g.tryBegin(StoreBusyGuard.Op.Purchase))
        assertFalse(g.tryBegin(StoreBusyGuard.Op.Restore))
        assertEquals(StoreBusyGuard.Op.Purchase, g.current)
        assertFalse(g.end(StoreBusyGuard.Op.Restore))
        assertEquals(StoreBusyGuard.Op.Purchase, g.current)
        assertTrue(g.end(StoreBusyGuard.Op.Purchase))
        assertFalse(g.busy)
        assertTrue(g.tryBegin(StoreBusyGuard.Op.Restore))
        assertFalse(g.tryBegin(StoreBusyGuard.Op.Purchase))
        assertTrue(g.end(StoreBusyGuard.Op.Restore))
    }

    @Test
    fun noneCannotBegin() {
        val g = StoreBusyGuard()
        assertFalse(g.tryBegin(StoreBusyGuard.Op.None))
        assertFalse(g.busy)
    }
}

class BillingReconnectPolicyTest {
    @Test
    fun boundedExponentialDelaysThenNull() {
        assertEquals(1000L, BillingReconnectPolicy.nextDelayMs(1))
        assertEquals(2000L, BillingReconnectPolicy.nextDelayMs(2))
        assertEquals(4000L, BillingReconnectPolicy.nextDelayMs(3))
        assertNull(BillingReconnectPolicy.nextDelayMs(0))
        assertNull(BillingReconnectPolicy.nextDelayMs(4))
        assertEquals(3, BillingReconnectPolicy.MAX_ATTEMPTS)
    }
}
