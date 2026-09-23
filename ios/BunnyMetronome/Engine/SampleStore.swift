import AVFoundation
import Foundation

/// Bundle sample decoding and completeness. Pure file I/O — no audio session,
/// no engine graph — so it stays compilable and testable on macOS.
enum SampleStore {
    /// Decode every .mp3 under `root` that is not already in `existing`.
    /// Undecodable files are skipped and surface as "missing" in the
    /// completeness gate instead of being silently swallowed.
    static func decodeSamples(
        root: URL,
        existing: [String: AVAudioPCMBuffer]
    ) throws -> (buffers: [String: AVAudioPCMBuffer], format: AVAudioFormat?) {
        var out = existing
        var decodedFormat: AVAudioFormat?
        var readable = 0
        let fm = FileManager.default
        // subpathsOfDirectory yields paths relative to the root, immune to the
        // symlink traps (/var → /private/var) that break absolute-prefix math.
        let subpaths = try fm.subpathsOfDirectory(atPath: root.path)
            .filter { ($0 as NSString).pathExtension.lowercased() == "mp3" }
            .sorted()
        for sub in subpaths {
            let key = (sub as NSString).deletingPathExtension
            if out[key] != nil { continue }
            let url = root.appendingPathComponent(sub)
            guard let buf = try? buffer(url: url) else { continue }
            out[key] = buf
            readable += 1
            if decodedFormat == nil { decodedFormat = buf.format }
        }
        if readable == 0 && existing.isEmpty {
            throw NSError(domain: "audio", code: 2)
        }
        return (out, decodedFormat)
    }

    /// Decode + free-tier completeness gate. Throws `audio` code 3 when any
    /// required sample is still missing, so Play fails visibly instead of
    /// sounding bars with silently dropped beats.
    static func load(
        root: URL,
        existing: [String: AVAudioPCMBuffer] = [:]
    ) throws -> (buffers: [String: AVAudioPCMBuffer], format: AVAudioFormat?) {
        let result = try decodeSamples(root: root, existing: existing)
        let missing = MetronomePolicy.missingRequiredSampleKeys(Set(result.buffers.keys))
        guard missing.isEmpty else {
            throw NSError(domain: "audio", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "missing \(missing.count) required samples"
            ])
        }
        return result
    }

    static func isComplete(_ keys: Set<String>) -> Bool {
        MetronomePolicy.missingRequiredSampleKeys(keys).isEmpty
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

/// Single-flight sample loading shared by the launch preload and the first
/// Play tap: only one decode ever runs at a time, concurrent callers ride the
/// same attempt, a complete bundle short-circuits (no directory walk), and a
/// failed attempt can be retried. Pure state — no audio I/O — so it stays
/// testable on macOS alongside SampleStore.
final class SampleLoadGate: @unchecked Sendable {
    private let lock = NSLock()
    private var complete = false
    private var inFlight = false
    private var waiters: [(Result<Void, Error>) -> Void] = []

    var isComplete: Bool {
        lock.lock()
        defer { lock.unlock() }
        return complete
    }

    /// Registers `completion` to be notified of the current/next load attempt.
    /// Returns true when the caller owns the decode slot (it must decode and
    /// report via `finish`); false when a decode is already running or the
    /// gate is already complete (the caller only waits).
    @discardableResult
    func claimLoadSlot(then completion: @escaping (Result<Void, Error>) -> Void) -> Bool {
        lock.lock()
        if complete {
            lock.unlock()
            completion(.success(()))
            return false
        }
        waiters.append(completion)
        let shouldDecode = !inFlight
        inFlight = true
        lock.unlock()
        return shouldDecode
    }

    /// The decode owner reports the attempt's outcome; every waiter (including
    /// the owner's own completion) is notified exactly once. Success latches
    /// the gate complete; failure leaves it retryable.
    func finish(_ result: Result<Void, Error>) {
        lock.lock()
        if case .success = result { complete = true }
        inFlight = false
        let list = waiters
        waiters = []
        lock.unlock()
        for waiter in list { waiter(result) }
    }
}

/// Orchestrates the one shared load attempt: decode off-main, install on main,
/// and publish readiness only AFTER the install has actually run. With the
/// publish happening inside the main-queue install block, `isReady` can never
/// be observed true while the buffers are still in flight to their owner —
/// the window a Play tap used to fall into. Queues are injectable so tests can
/// drive decode-done-but-not-installed deterministically.
final class SampleLoader: @unchecked Sendable {
    private let gate = SampleLoadGate()
    private let decodeQueue: DispatchQueue
    private let mainQueue: DispatchQueue

    init(decodeQueue: DispatchQueue, mainQueue: DispatchQueue = .main) {
        self.decodeQueue = decodeQueue
        self.mainQueue = mainQueue
    }

    /// True only once a successful attempt has installed its buffers on main.
    var isReady: Bool { gate.isComplete }

    /// `install` runs on the main queue with the decoded buffers and format;
    /// `onDone` runs on the main queue once per attempt. The launch preload
    /// and Play share one attempt through the gate.
    func prepare(
        root: URL,
        install: @escaping ([String: AVAudioPCMBuffer], AVAudioFormat?) -> Void,
        onDone: @escaping (Result<Void, Error>) -> Void
    ) {
        let shouldDecode = gate.claimLoadSlot { [mainQueue] result in
            mainQueue.async { onDone(result) }
        }
        guard shouldDecode else { return }
        decodeQueue.async { [weak self] in
            let result = Result { try SampleStore.load(root: root) }
            switch result {
            case .success(let decoded):
                self?.mainQueue.async { [weak self] in
                    guard let self else { return }
                    install(decoded.buffers, decoded.format)
                    // Publish only now, in the same main-queue block that
                    // installed the samples: no observable gap.
                    self.gate.finish(.success(()))
                }
            case .failure(let error):
                // Nothing was installed; failure is safe to publish from the
                // decode queue (waiters still hop to main).
                self?.gate.finish(.failure(error))
            }
        }
    }
}
