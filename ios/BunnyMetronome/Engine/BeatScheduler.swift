import Foundation

struct ScheduledBeat: Equatable {
    let index: Int
    let time: Double
}

/// Lookahead beat clock. Changing BPM only changes the *next* interval.
final class BeatScheduler {
    private(set) var bpm: Int
    private(set) var beatsPerBar: Int
    private(set) var beatIndex: Int = 0
    private(set) var nextNoteTime: Double = 0
    private(set) var playing = false
    private var runId = 0

    init(bpm: Int = 120, beatsPerBar: Int = 4) {
        self.bpm = MetronomePolicy.clampBpm(bpm)
        self.beatsPerBar = MetronomePolicy.clampBeats(beatsPerBar)
    }

    var currentRunId: Int { runId }

    func start(at now: Double) {
        playing = true
        runId += 1
        beatIndex = 0
        nextNoteTime = now + 0.02
    }

    func stop() {
        playing = false
        runId += 1
    }

    func setBpm(_ value: Int) {
        bpm = MetronomePolicy.clampBpm(value)
    }

    func setBeats(_ value: Int) {
        beatsPerBar = MetronomePolicy.clampBeats(value)
        if beatIndex >= beatsPerBar { beatIndex = 0 }
    }

    /// Schedule every beat whose audio time is strictly before `horizon`.
    /// Does not insert an extra beat when BPM changes.
    @discardableResult
    func pull(until horizon: Double) -> [ScheduledBeat] {
        var out: [ScheduledBeat] = []
        guard playing else { return out }
        while nextNoteTime < horizon {
            out.append(ScheduledBeat(index: beatIndex, time: nextNoteTime))
            nextNoteTime += MetronomePolicy.intervalSeconds(bpm: bpm)
            beatIndex = (beatIndex + 1) % beatsPerBar
        }
        return out
    }
}
