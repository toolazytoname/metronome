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
