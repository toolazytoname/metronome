package studio.weichao.jpq.policy

import org.junit.Assert.*
import org.junit.Test
import java.util.Locale

class SampleCatalogTest {
    @Test fun allFreeVoicesAreRequiredBeforePlayback() {
        assertEquals(35, SampleCatalog.required.size)
        val complete = SampleCatalog.required.associateWith { shortArrayOf(1) }
        assertTrue(SampleCatalog.complete(complete))
        for (name in SampleCatalog.required) {
            assertFalse(name, SampleCatalog.complete(complete - name))
            assertFalse(name, SampleCatalog.complete(complete + (name to shortArrayOf())))
        }
    }

    @Test fun samplePathsDoNotDependOnSystemLocale() {
        val old = Locale.getDefault()
        try {
            Locale.setDefault(Locale.forLanguageTag("ar"))
            assertEquals("01", SampleCatalog.id(1))
            assertEquals("voice/en/01", MetronomePolicy.sampleVoices(0, SoundMode.VOICE, "en", "default", "default")[0].key)
        } finally { Locale.setDefault(old) }
    }

    @Test fun malformedPcmIsNotPublishedAsSilentReadyBuffer() {
        assertTrue(PcmResample.toMono44100(shortArrayOf(), 44100, 1).isEmpty())
        assertTrue(PcmResample.toMono44100(shortArrayOf(1), 44100, 2).isEmpty())
        assertTrue(PcmResample.toMono44100(shortArrayOf(1), 0, 1).isEmpty())
    }

    @Test fun timelineStaysAccurateForSixtySecondsAtAllTempos() {
        for (bpm in listOf(40, 120, 208)) {
            val clock = BeatScheduler(bpm)
            clock.start(0.0)
            val beats = clock.pull(60.0)
            assertEquals(bpm, beats.size)
            beats.forEachIndexed { i, beat ->
                assertEquals(0.02 + i * 60.0 / bpm, beat.time, 1e-8)
                assertEquals(i % 4, beat.index)
            }
            assertTrue(clock.pull(Double.POSITIVE_INFINITY).isEmpty())
        }
    }
}
