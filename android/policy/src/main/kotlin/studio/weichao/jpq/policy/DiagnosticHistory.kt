package studio.weichao.jpq.policy

/** Closed event vocabulary, never accept exceptions, URLs, account or billing data. */
enum class DiagnosticCode {
    appOpen, foreground, background, playRequested, playReady, playFailed,
    paused, audioInterrupted, samplesReady, samplesFailed
}
data class DiagnosticState(val bpm: Int, val beats: Int, val mode: SoundMode, val playing: Boolean, val ready: Boolean) {
    fun normalized() = copy(bpm = MetronomePolicy.clampBpm(bpm), beats = MetronomePolicy.clampBeats(beats))
}
data class DiagnosticEvent(val at: Long, val code: DiagnosticCode, val state: DiagnosticState?)
class DiagnosticHistory {
    var events: List<DiagnosticEvent> = emptyList()
        private set
    fun restore(input: List<DiagnosticEvent>, now: Long) {
        events = input.filter { it.at <= now && it.at > now - 86_400_000L }
            .takeLast(80).map { it.copy(state = it.state?.normalized()) }
    }
    fun record(code: DiagnosticCode, state: DiagnosticState?, now: Long) {
        restore(events + DiagnosticEvent(now, code, state), now)
    }
}
