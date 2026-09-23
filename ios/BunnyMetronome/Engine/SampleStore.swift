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
