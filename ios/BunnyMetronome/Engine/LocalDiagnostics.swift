import Foundation

/// Typed allowlist: never accept an Error, URL, arbitrary dictionary or device identifier.
enum DiagnosticCode: String, Codable {
    case appOpen, foreground, background, playRequested, playReady, playFailed
    case paused, audioInterrupted, samplesReady, samplesFailed, samplesDegraded
}
struct DiagnosticState: Codable {
    let bpm: Int
    let beats: Int
    let mode: SoundMode
    let playing: Bool
    let ready: Bool
    init(bpm: Int, beats: Int, mode: SoundMode, playing: Bool, ready: Bool) {
        self.bpm = MetronomePolicy.clampBpm(bpm)
        self.beats = MetronomePolicy.clampBeats(beats)
        self.mode = mode
        self.playing = playing
        self.ready = ready
    }
    var normalized: DiagnosticState {
        DiagnosticState(bpm: bpm, beats: beats, mode: mode, playing: playing, ready: ready)
    }
}
struct DiagnosticEvent: Codable {
    let at: Date
    let code: DiagnosticCode
    let state: DiagnosticState?
}
struct DiagnosticHistory {
    private(set) var events: [DiagnosticEvent] = []
    mutating func restore(_ events: [DiagnosticEvent], now: Date) {
        self.events = Array(events.filter { $0.at <= now && now.timeIntervalSince($0.at) < 86400 }.suffix(80)).map { DiagnosticEvent(at: $0.at, code: $0.code, state: $0.state?.normalized) }
    }
    mutating func record(_ code: DiagnosticCode, state: DiagnosticState?, now: Date) {
        restore(events + [DiagnosticEvent(at: now, code: code, state: state)], now: now)
    }
}

/// Disk work is FIFO and off the audio/main threads. Caches are excluded from backup.
// All mutable state is confined to queue; immutable file/release are safe to capture.
final class LocalDiagnostics: @unchecked Sendable {
    static let shared = LocalDiagnostics()
    private let queue = DispatchQueue(label: "studio.weichao.jpq.diagnostics", qos: .utility)
    private var history = DiagnosticHistory()
    private let file: URL?
    private let release: String
    init(directory: URL? = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first, release: String = "\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?")/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?")") {
        self.release = release
        file = directory?.appendingPathComponent("metronome-diagnostics-v1.json")
        queue.async {
            if let file = self.file,
               let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 128_000,
               let data = try? Data(contentsOf: file),
               let stored = try? JSONDecoder().decode(StoredDiagnostics.self, from: data),
               stored.release == self.release {
                self.history.restore(stored.events, now: Date())
            }
            self.persist()
        }
    }
    func record(_ code: DiagnosticCode, state: DiagnosticState? = nil) {
        let now = Date()
        queue.async {
            self.history.record(code, state: state, now: now)
            self.persist()
        }
    }
    @discardableResult private func persist() -> Bool {
        guard let file else { return true } // memory-only instance
        guard let data = try? JSONEncoder().encode(StoredDiagnostics(release: release, events: history.events)) else { return false }
        do { try data.write(to: file, options: .atomic); return true }
        catch { return false }
    }
    @discardableResult func clear() async -> Bool {
        await withCheckedContinuation { continuation in
            queue.async {
                self.history.restore([], now: Date())
                continuation.resume(returning: self.persist())
            }
        }
    }
    func report(version: String, build: String, osMajor: Int, state: DiagnosticState) async -> String {
        await withCheckedContinuation { continuation in
            queue.async {
                self.history.restore(self.history.events, now: Date())
                self.persist()
                let payload = DiagnosticReport(product: "Bunny Metronome", platform: "iOS", version: version,
                    build: build, osMajor: osMajor, state: state, events: self.history.events)
                let encoder = JSONEncoder()
                encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                encoder.dateEncodingStrategy = .iso8601
                let text = (try? encoder.encode(payload)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                continuation.resume(returning: text)
            }
        }
    }
}
private struct StoredDiagnostics: Codable {
    let release: String
    let events: [DiagnosticEvent]
}

private struct DiagnosticReport: Encodable {
    let product: String
    let platform: String
    let version: String
    let build: String
    let osMajor: Int
    let state: DiagnosticState
    let events: [DiagnosticEvent]
}
