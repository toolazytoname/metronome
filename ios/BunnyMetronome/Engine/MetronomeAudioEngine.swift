import AVFoundation
import Foundation

final class MetronomeAudioEngine {
    private let engine = AVAudioEngine()
    private let clickPlayer = AVAudioPlayerNode()
    private let overlayPlayer = AVAudioPlayerNode()
    private let mixer = AVAudioMixerNode()
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    let scheduler = BeatScheduler()
    private let loadGate = SampleLoadGate()
    private var timer: DispatchSourceTimer?
    private var onBeat: ((Int) -> Void)?
    private(set) var mode: SoundMode = .uniform
    private var lang = "zh"
    private var clickBank = MetronomePolicy.defaultBank
    private var voiceBank = MetronomePolicy.defaultBank
    private var format: AVAudioFormat?
    private var observers: [NSObjectProtocol] = []
    private let sampleLoadQueue = DispatchQueue(label: "studio.weichao.jpq.sampleload", qos: .userInitiated)
    private var formatConnected = false
    private var degradedNotified = false
    var hapticEnabled = false
    var onHaptic: ((Int) -> Void)?
    var onInterrupted: (() -> Void)?
    /// Fired once per playing run when a pack sample is missing and the free
    /// default had to stand in, so the UI can say so instead of silently thinning beats.
    var onSamplesDegraded: (() -> Void)?

    init() {
        engine.attach(clickPlayer)
        engine.attach(overlayPlayer)
        engine.attach(mixer)
        engine.connect(clickPlayer, to: mixer, format: nil)
        engine.connect(overlayPlayer, to: mixer, format: nil)
        engine.connect(mixer, to: engine.mainMixerNode, format: nil)
        listenForSessionEvents()
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    func setOnBeat(_ handler: @escaping (Int) -> Void) {
        onBeat = handler
    }

    func setMode(_ mode: SoundMode) { self.mode = mode }
    func setLang(_ lang: String) { self.lang = lang == "en" ? "en" : "zh" }
    func setClickBank(_ bank: String) { clickBank = bank }
    func setVoiceBank(_ bank: String) { voiceBank = bank }

    func setVolume(_ linear: Double) {
        mixer.outputVolume = Float(MetronomePolicy.clampEngineVolume(linear))
    }

    func configurePlaybackSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [])
        try session.setActive(true)
    }

    /// Load the bundle's samples exactly once, off the main thread. The launch
    /// preload and a cold-start Play tap share the same attempt through the
    /// load gate: no second concurrent decode, no main-thread decode, and
    /// once the free-tier set is complete later calls short-circuit without
    /// touching the filesystem. `onDone` fires once per attempt on main.
    func prepareSamples(onDone: @escaping (Result<Void, Error>) -> Void) {
        let shouldDecode = loadGate.claimLoadSlot { result in
            DispatchQueue.main.async { onDone(result) }
        }
        guard shouldDecode else { return }
        let root = Self.bundledSoundsRoot()
        sampleLoadQueue.async { [weak self] in
            let result = Result { try SampleStore.load(root: root) }
            if case .success(let decoded) = result {
                // Merge is enqueued before finish() so the waiter's onDone —
                // which may immediately call start() — always lands after the
                // buffers are in place (main queue is FIFO).
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    for (key, buf) in decoded.buffers where self.buffers[key] == nil {
                        self.buffers[key] = buf
                    }
                    if self.format == nil { self.format = decoded.format }
                    self.connectFormatIfNeeded()
                }
            }
            self?.loadGate.finish(result.map { _ in () })
        }
    }

    private static func bundledSoundsRoot() -> URL {
        Bundle.main.resourceURL?.appendingPathComponent("Sounds") ?? Bundle.main.bundleURL
    }

    /// True once a load attempt has delivered the complete free-tier set;
    /// Play uses this to start instantly without re-walking the bundle.
    var samplesReady: Bool { loadGate.isComplete }

    private func connectFormatIfNeeded() {
        guard let format, !formatConnected else { return }
        engine.connect(clickPlayer, to: mixer, format: format)
        engine.connect(overlayPlayer, to: mixer, format: format)
        formatConnected = true
    }

    func start() throws {
        if scheduler.playing { return }
        // Hard precondition on the actual buffers: callers route through
        // prepareSamples() so this never decodes (never on the main thread).
        guard SampleStore.isComplete(Set(buffers.keys)) else {
            throw NSError(domain: "audio", code: 3)
        }
        try configurePlaybackSession()
        connectFormatIfNeeded()
        if !engine.isRunning {
            engine.prepare()
            try engine.start()
        }
        // Reset player timebases so scheduled sample times line up with playerTime().
        clickPlayer.stop()
        overlayPlayer.stop()
        clickPlayer.play()
        overlayPlayer.play()
        degradedNotified = false
        scheduler.start(at: currentPlayerTime())
        armTimer()
    }

    func stop() {
        scheduler.stop()
        timer?.cancel()
        timer = nil
        clickPlayer.stop()
        overlayPlayer.stop()
    }

    func setBpm(_ bpm: Int) { scheduler.setBpm(bpm) }
    func setBeats(_ n: Int) { scheduler.setBeats(n) }

    private func listenForSessionEvents() {
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            self?.handleInterruption(note)
        })
        observers.append(nc.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            self?.handleRouteChange(note)
        })
    }

    private func handleInterruption(_ note: Notification) {
        let typeValue = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
        let type = typeValue.flatMap(AVAudioSession.InterruptionType.init(rawValue:))
        switch type {
        case .began:
            if scheduler.playing {
                stop()
                onInterrupted?()
            }
        case .ended:
            let optsVal = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let opts = AVAudioSession.InterruptionOptions(rawValue: optsVal)
            if opts.contains(.shouldResume) {
                try? configurePlaybackSession()
            }
        default:
            break
        }
    }

    private func handleRouteChange(_ note: Notification) {
        guard scheduler.playing else { return }
        let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
        let reason = raw.flatMap(AVAudioSession.RouteChangeReason.init(rawValue:))
        if reason == .oldDeviceUnavailable {
            try? configurePlaybackSession()
        }
    }

    private func armTimer() {
        timer?.cancel()
        let t = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
        t.schedule(deadline: .now(), repeating: .milliseconds(25))
        t.setEventHandler { [weak self] in self?.tick() }
        t.resume()
        timer = t
    }

    private func tick() {
        guard scheduler.playing else { return }
        let now = currentPlayerTime()
        for beat in scheduler.pull(until: now + 0.1) {
            schedule(beat)
        }
    }

    private func schedule(_ beat: ScheduledBeat) {
        let voices = MetronomePolicy.sampleVoices(
            beat: beat.index,
            mode: mode,
            lang: lang,
            clickBank: clickBank,
            voiceBank: voiceBank
        )
        // Slot-aligned free-bank equivalents: used when a pack sample is missing
        // so a beat falls back to its default sound instead of going silent.
        let fallbacks = MetronomePolicy.sampleVoices(
            beat: beat.index,
            mode: mode,
            lang: lang,
            clickBank: MetronomePolicy.defaultBank,
            voiceBank: MetronomePolicy.defaultBank
        )
        let rate = format?.sampleRate ?? 44100
        let sampleTime = AVAudioFramePosition((beat.time * rate).rounded())
        // `at` is player time, same clock as currentPlayerTime().
        let at = AVAudioTime(sampleTime: sampleTime, atRate: rate)
        let players = [clickPlayer, overlayPlayer]
        for (i, voice) in voices.enumerated() {
            var key = voice.key
            if buffers[key] == nil, i < fallbacks.count {
                key = fallbacks[i].key
                if buffers[key] != nil && !degradedNotified {
                    degradedNotified = true
                    onSamplesDegraded?()
                }
            }
            guard let src = buffers[key] else { continue }
            let scaled = Self.bufferApplyingGain(src, gain: voice.gain)
            players[min(i, players.count - 1)].scheduleBuffer(scaled, at: at, options: [])
        }
        // Generation token: a rapid stop→start must not let the previous run's
        // pending callbacks light up the new run's beat dots or fire haptics.
        let runId = scheduler.currentRunId
        let delay = max(0, beat.time - currentPlayerTime())
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.scheduler.isLiveRun(runId) else { return }
            self.onBeat?(beat.index)
            if self.hapticEnabled { self.onHaptic?(beat.index) }
        }
    }

    /// Bake SampleVoice.gain into a copy so count (1.0) and weak click (0.28) overlay.
    static func bufferApplyingGain(_ src: AVAudioPCMBuffer, gain: Double) -> AVAudioPCMBuffer {
        if abs(gain - 1) < 1e-6 { return src }
        guard let copy = AVAudioPCMBuffer(pcmFormat: src.format, frameCapacity: src.frameCapacity) else {
            return src
        }
        copy.frameLength = src.frameLength
        let frames = Int(src.frameLength)
        let channels = Int(src.format.channelCount)
        if let srcList = src.floatChannelData, let dstList = copy.floatChannelData {
            for ch in 0..<channels {
                for i in 0..<frames { dstList[ch][i] = srcList[ch][i] }
                BufferGain.scaleInPlace(dstList[ch], count: frames, gain: gain)
            }
            return copy
        }
        if let srcList = src.int16ChannelData, let dstList = copy.int16ChannelData {
            let g = gain
            for ch in 0..<channels {
                for i in 0..<frames {
                    let v = Double(srcList[ch][i]) * g
                    dstList[ch][i] = Int16(max(Double(Int16.min), min(Double(Int16.max), v.rounded())))
                }
            }
        }
        return copy
    }

    /// Player-node seconds. `lastRenderTime` is engine/render time — scheduling
    /// with that sampleTime drops every buffer in the past, so the UI can tick
    /// while the speaker stays silent.
    private func currentPlayerTime() -> Double {
        if let nodeTime = clickPlayer.lastRenderTime,
           nodeTime.isHostTimeValid || nodeTime.isSampleTimeValid,
           let playerTime = clickPlayer.playerTime(forNodeTime: nodeTime),
           playerTime.isSampleTimeValid,
           playerTime.sampleRate > 0 {
            return Double(playerTime.sampleTime) / playerTime.sampleRate
        }
        return 0
    }
}
