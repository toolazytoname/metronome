package studio.weichao.jpq.policy

import org.junit.Assert.*
import org.junit.Test

class DiagnosticHistoryTest {
    private val state = DiagnosticState(120, 4, SoundMode.UNIFORM, false, true)
    @Test fun capacityPreservesLatest80() {
        val history = DiagnosticHistory()
        repeat(100) { history.record(DiagnosticCode.playReady, state, 100_000L + it) }
        assertEquals(80, history.events.size)
        assertEquals(100_020L, history.events.first().at)
        assertEquals(100_099L, history.events.last().at)
    }
    @Test fun expirationBoundaryAndFutureAreRejected() {
        val now = 200_000_000L
        val history = DiagnosticHistory()
        history.restore(listOf(
            DiagnosticEvent(now - 86_400_000L, DiagnosticCode.paused, state),
            DiagnosticEvent(now - 86_399_999L, DiagnosticCode.playReady, state),
            DiagnosticEvent(now + 1, DiagnosticCode.playFailed, state)
        ), now)
        assertEquals(listOf(DiagnosticCode.playReady), history.events.map { it.code })
    }
    @Test fun normalizesRestoredAndNewSnapshots() {
        val history = DiagnosticHistory()
        history.record(DiagnosticCode.playRequested, state.copy(bpm = 999, beats = -1), 100L)
        assertEquals(208, history.events.single().state?.bpm)
        assertEquals(1, history.events.single().state?.beats)
        history.restore(history.events, 200L)
        assertEquals(208, history.events.single().state?.bpm)
    }
    @Test fun clearAndNullableState() {
        val history = DiagnosticHistory()
        history.record(DiagnosticCode.samplesFailed, null, 100L)
        assertNull(history.events.single().state)
        history.restore(emptyList(), 101L)
        assertTrue(history.events.isEmpty())
    }
    @Test fun eventVocabularyDoesNotAcceptExceptionText() {
        assertThrows(IllegalArgumentException::class.java) { DiagnosticCode.valueOf("SECRET error text") }
    }
}
