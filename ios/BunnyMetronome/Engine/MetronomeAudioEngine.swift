import AVFoundation
import Foundation

final class MetronomeAudioEngine {
    private let engine = AVAudioEngine()
    private let clickPlayer = AVAudioPlayerNode()
    private let overlayPlayer = AVAudioPlayerNode()
    private let mixer = AVAudioMixerNode()
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    let scheduler = BeatScheduler()
    private var timer: DispatchSourceTimer?
    private var onBeat: ((Int) -> Void)?
    private(set) var mode: SoundMode = .uniform
    private var lang = "zh"
    private var clickBank = MetronomePolicy.defaultBank
    private var voiceBank = MetronomePolicy.defaultBank
    private var format: AVAudioFormat?
    var hapticEnabled = false
    var onHaptic: (() -> Void)?

    init() {
        engine.attach(clickPlayer)
        engine.attach(overlayPlayer)
        engine.attach(mixer)
        engine.connect(clickPlayer, to: mixer, format: nil)
        engine.connect(overlayPlayer, to: mixer, format: nil)
        engine.connect(mixer, to: engine.mainMixerNode, format: nil)
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

    func loadSamples() throws {
        let root = Bundle.main.resourceURL?.appendingPathComponent("Sounds")
            ?? Bundle.main.bundleURL
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(at: root, includingPropertiesForKeys: nil) else { return }
        for case let url as URL in enumerator where url.pathExtension.lowercased() == "mp3" {
            let rel = url.path.replacingOccurrences(of: root.path + "/", with: "")
                .replacingOccurrences(of: ".mp3", with: "")
            if let buf = try? Self.buffer(url: url) {
                buffers[rel] = buf
                if format == nil { format = buf.format }
            }
        }
        if let format {
            engine.connect(clickPlayer, to: mixer, format: format)
            engine.connect(overlayPlayer, to: mixer, format: format)
        }
    }

    func start() throws {
        try configurePlaybackSession()
        if !engine.isRunning {
            try engine.start()
        }
        if !clickPlayer.isPlaying { clickPlayer.play() }
        if !overlayPlayer.isPlaying { overlayPlayer.play() }
        scheduler.start(at: currentPlayerTime())
        armTimer()
    }

    func stop() {
        scheduler.stop()
        timer?.cancel()
        timer = nil
        clickPlayer.stop()
        overlayPlayer.stop()
        clickPlayer.play()
        overlayPlayer.play()
    }

    func setBpm(_ bpm: Int) { scheduler.setBpm(bpm) }
    func setBeats(_ n: Int) { scheduler.setBeats(n) }

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
        let rate = format?.sampleRate ?? 44100
        let sampleTime = AVAudioFramePosition((beat.time * rate).rounded())
        let at = AVAudioTime(sampleTime: sampleTime, atRate: rate)
        let players = [clickPlayer, overlayPlayer]
        for (i, voice) in voices.enumerated() {
            guard let src = buffers[voice.key] else { continue }
            let scaled = Self.bufferApplyingGain(src, gain: voice.gain)
            players[min(i, players.count - 1)].scheduleBuffer(scaled, at: at, options: [])
        }
        let delay = max(0, beat.time - currentPlayerTime())
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.onBeat?(beat.index)
            if self?.hapticEnabled == true { self?.onHaptic?() }
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

    private func currentPlayerTime() -> Double {
        if let last = clickPlayer.lastRenderTime,
           last.isSampleTimeValid,
           let rate = format?.sampleRate, rate > 0 {
            return Double(last.sampleTime) / rate
        }
        return 0
    }

    private static func buffer(url: URL) throws -> AVAudioPCMBuffer {
        let file = try AVAudioFile(forReading: url)
        let fmt = file.processingFormat
        let frames = AVAudioFrameCount(file.length)
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frames) else {
            throw NSError(domain: "audio", code: 1)
        }
        try file.read(into: buf)
        return buf
    }
}
