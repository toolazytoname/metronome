package studio.weichao.jpq.policy

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MetronomePolicyTest {
    @Test
    fun clampBpm() {
        assertEquals(40, MetronomePolicy.clampBpm(39))
        assertEquals(40, MetronomePolicy.clampBpm(40))
        assertEquals(120, MetronomePolicy.clampBpm(120))
        assertEquals(208, MetronomePolicy.clampBpm(208))
        assertEquals(208, MetronomePolicy.clampBpm(209))
        assertEquals(40, MetronomePolicy.clampBpm(-3))
    }

    @Test
    fun intervalIsSixtyOverBpm() {
        assertEquals(1.0, MetronomePolicy.intervalSeconds(60), 1e-9)
        assertEquals(0.5, MetronomePolicy.intervalSeconds(120), 1e-9)
        assertEquals(1.5, MetronomePolicy.intervalSeconds(40), 1e-9)
        assertEquals(60.0 / 208.0, MetronomePolicy.intervalSeconds(208), 1e-9)
        assertEquals(MetronomePolicy.intervalSeconds(40), MetronomePolicy.intervalSeconds(12), 1e-9)
    }

    @Test
    fun unknownModeFallsBackToUniform() {
        assertEquals(SoundMode.UNIFORM, SoundMode.parse("nope"))
        assertEquals(SoundMode.UNIFORM, SoundMode.parse(null))
        assertEquals(SoundMode.VOICE, SoundMode.parse("voice"))
        val prefs = MetronomePrefs.from(mapOf("sm" to "garbage", "bpm" to 999))
        assertEquals(SoundMode.UNIFORM, prefs.mode)
        assertEquals(208, prefs.bpm)
    }

    @Test
    fun sampleSelection() {
        val trad0 = MetronomePolicy.sampleVoices(0, SoundMode.TRADITIONAL, "zh", "default", "default")
        assertEquals(listOf("click-strong"), trad0.map { it.key })
        val trad1 = MetronomePolicy.sampleVoices(1, SoundMode.TRADITIONAL, "zh", "default", "default")
        assertEquals(listOf("click-weak"), trad1.map { it.key })
        val uni = MetronomePolicy.sampleVoices(2, SoundMode.UNIFORM, "zh", "default", "default")
        assertEquals(listOf("click-uniform"), uni.map { it.key })
        val voice = MetronomePolicy.sampleVoices(0, SoundMode.VOICE, "zh", "default", "default")
        assertEquals(listOf("voice/zh/01", "click-weak"), voice.map { it.key })
        assertEquals(0.28, voice[1].gain, 1e-9)
    }

    @Test
    fun unpaidPathCanStartDefaultVoice() {
        assertTrue(MetronomePolicy.canStartDefaultVoice(false))
        assertTrue(MetronomePolicy.canUsePackBank("default", false))
        val voices = MetronomePolicy.sampleVoices(3, SoundMode.VOICE, "en", "default", "default")
        assertEquals("voice/en/04", voices.first().key)
    }

    @Test
    fun packBanksRefuseWithoutEntitlement() {
        assertFalse(MetronomePolicy.canUsePackBank("click-stick", false))
        assertEquals("default", MetronomePolicy.resolveBank("click-stick", false))
        assertEquals("default", MetronomePolicy.resolveBank("voice-zh-yunxi", false))
        assertTrue(MetronomePolicy.canUsePackBank("click-stick", true))
        assertEquals("click-kick", MetronomePolicy.resolveBank("click-kick", true))
        val gated = MetronomePolicy.sampleVoices(
            0, SoundMode.UNIFORM, "zh",
            MetronomePolicy.resolveBank("click-tip", false),
            "default"
        )
        assertEquals(listOf("click-uniform"), gated.map { it.key })
    }

    @Test
    fun storeAdapterIsStubbedNotThePolicy() = runBlocking {
        val fake = FakeStoreAdapter(unlocked = false)
        assertFalse(fake.currentEntitlement())
        assertFalse(MetronomePolicy.canUsePackBank("click-stick", fake.currentEntitlement()))
        fake.purchase()
        assertEquals(1, fake.purchaseCalls)
        assertTrue(fake.currentEntitlement())
        assertTrue(MetronomePolicy.canUsePackBank("click-stick", fake.currentEntitlement()))
        fake.restore()
        assertEquals(1, fake.restoreCalls)
    }
}

class BeatSchedulerTest {
    @Test
    fun liveBpmChangeDoesNotInsertExtraBeat() {
        val clock = BeatScheduler(bpm = 60, beatsPerBar = 4)
        clock.start(0.0)
        val first = clock.pull(0.1)
        assertEquals(1, first.size)
        assertEquals(0, first[0].index)
        assertEquals(0.02, first[0].time, 1e-9)
        assertEquals(1.02, clock.nextNoteTime, 1e-9)

        clock.setBpm(120)
        assertEquals(0.5, MetronomePolicy.intervalSeconds(clock.bpm), 1e-9)
        val rest = clock.pull(2.02)
        assertEquals(2, rest.size)
        assertEquals(1.02, rest[0].time, 1e-9)
        assertEquals(1.52, rest[1].time, 1e-9)
        assertEquals(1, rest[0].index)
        assertEquals(2, rest[1].index)
        assertEquals(2.02, clock.nextNoteTime, 1e-9)
    }
}
