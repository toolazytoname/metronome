package studio.weichao.jpq.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class EntitlementFlowTest {
    private val packed = MetronomePrefs(
        clickBank = "click-stick",
        voiceBank = "voice-zh-yunxi",
        hapticPattern = MetronomePolicy.HAPTIC_PATTERN_DOWNBEAT,
        hapticFeel = MetronomePolicy.HAPTIC_FEEL_HEAVY
    )

    @Test
    fun unknownKeepsStorageShowsAndPlaysDefault() {
        val s = EntitlementFlow.unknownOrFailed(EntitlementFlow.State(packed, true, EntitlementFlow.Confidence.Verified))
        assertEquals("click-stick", s.stored.clickBank)
        assertFalse(s.unlocked)
        assertEquals("default", s.display.clickBank)
        assertEquals("default", s.playbackClick)
        assertEquals("default", s.playbackVoice)
        assertEquals(MetronomePolicy.HAPTIC_PATTERN_ALL, s.display.hapticPattern)
        assertEquals(EntitlementFlow.Pick.KeepStored, EntitlementFlow.pickClick(s, "default"))
        assertEquals(EntitlementFlow.Pick.LaunchPurchase, EntitlementFlow.pickClick(s, "click-kick"))
    }

    @Test
    fun verifiedTrueRestoresPackOnDisplayAndPlayback() {
        val s = EntitlementFlow.authoritative(EntitlementFlow.State(packed, false), true)
        assertTrue(s.unlocked)
        assertEquals("click-stick", s.stored.clickBank)
        assertEquals("click-stick", s.display.clickBank)
        assertEquals("click-stick", s.playbackClick)
        assertTrue(EntitlementFlow.pickClick(s, "click-kick") is EntitlementFlow.Pick.Save)
    }

    @Test
    fun verifiedFalsePersistsDefaults() {
        val s = EntitlementFlow.authoritative(EntitlementFlow.State(packed, true), false)
        assertEquals("default", s.stored.clickBank)
        assertEquals("default", s.display.clickBank)
        assertEquals("default", s.playbackClick)
        assertFalse(MetronomePolicy.canUsePackBank("click-stick", s.unlocked))
    }

    @Test
    fun displayMustNotWriteBackOverStoredPack() {
        var s = EntitlementFlow.unknownOrFailed(EntitlementFlow.State(packed, false))
        when (val p = EntitlementFlow.pickClick(s, s.display.clickBank)) {
            EntitlementFlow.Pick.KeepStored -> { }
            is EntitlementFlow.Pick.Save -> s = s.copy(stored = p.stored)
            else -> { }
        }
        assertEquals("click-stick", s.stored.clickBank)
        s = EntitlementFlow.authoritative(s, true)
        assertEquals("click-stick", s.display.clickBank)
    }
}

class EntitlementActivityWiringTest {
    @Test
    fun mainActivityUsesEntitlementFlowForDisplayPickAndAuthoritativeWrite() {
        val src = listOf(
            File("app/src/main/java/studio/weichao/jpq/MainActivity.kt"),
            File("../app/src/main/java/studio/weichao/jpq/MainActivity.kt")
        ).first { it.isFile }.readText()
        assertTrue(src.contains("EntitlementFlow.State(prefs, unlocked).display"))
        assertTrue(src.contains("EntitlementFlow.pickClick"))
        assertTrue(src.contains("EntitlementFlow.pickVoice"))
        assertTrue(src.contains("EntitlementFlow.authoritative"))
        assertTrue(src.contains("gate.playbackClick"))
        val refresh = src.substringAfter("private fun refreshEntitlement").substringBefore("private fun restorePurchases")
        assertFalse(refresh.contains("resolveBank"))
        assertFalse(refresh.contains("applyAuthoritativeUnlock"))
    }
}

class PlayStoreAdapterConsumeWiringTest {
    @Test
    fun adapterConsumesListenerPlanInsteadOfOrGrant() {
        val src = listOf(
            File("app/src/main/java/studio/weichao/jpq/billing/PlayStoreAdapter.kt"),
            File("../app/src/main/java/studio/weichao/jpq/billing/PlayStoreAdapter.kt")
        ).first { it.isFile }.readText()
        assertTrue(src.contains("PlayLedger.consumeListener(plan)"))
        assertTrue(src.contains("PlayLedger.ListenerConsume.AckOnly"))
        assertTrue(src.contains("PlayLedger.ListenerConsume.OptimisticGrant"))
        assertFalse(src.contains("plan.ackOwned || plan.optimisticGrant"))
    }
}
