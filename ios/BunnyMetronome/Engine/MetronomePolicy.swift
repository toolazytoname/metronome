import Foundation

enum SoundMode: String, Codable, CaseIterable {
    case traditional
    case uniform
    case voice

    static func parse(_ raw: String?) -> SoundMode {
        SoundMode(rawValue: raw ?? "") ?? .uniform
    }
}

struct SampleVoice: Equatable {
    let key: String
    let gain: Double
}

enum MetronomePolicy {
    static let minBpm = 40
    static let maxBpm = 208
    static let minBeats = 1
    static let maxBeats = 16
    static let minVolume = 10
    static let maxVolume = 100
    static let productId = "studio.weichao.jpq.soundpack"
    static let defaultBank = "default"
    static let packClickBanks = ["click-stick", "click-kick", "click-tip"]
    static let packVoiceBanks = ["voice-zh-yunxi", "voice-zh-soft", "voice-en-deep"]

    static func clampBpm(_ n: Int) -> Int { min(maxBpm, max(minBpm, n)) }
    static func clampBeats(_ n: Int) -> Int { min(maxBeats, max(minBeats, n)) }
    static func clampBeatUnit(_ n: Int) -> Int { min(16, max(1, n)) }
    static func clampVolume(_ n: Int) -> Int { min(maxVolume, max(minVolume, n)) }
    static func clampEngineVolume(_ v: Double) -> Double { min(1, max(0.05, v)) }

    static func intervalSeconds(bpm: Int) -> Double {
        60.0 / Double(clampBpm(bpm))
    }

    static func isPackBank(_ bank: String) -> Bool {
        packClickBanks.contains(bank) || packVoiceBanks.contains(bank)
    }

    static func canUsePackBank(_ bank: String, unlocked: Bool) -> Bool {
        if bank == defaultBank || bank.isEmpty { return true }
        return unlocked && isPackBank(bank)
    }

    static func resolveBank(requested: String, unlocked: Bool) -> String {
        canUsePackBank(requested, unlocked: unlocked) ? (requested.isEmpty ? defaultBank : requested) : defaultBank
    }

    /// Unpaid users may always start default voice counting.
    static func canStartDefaultVoice(unlocked: Bool) -> Bool {
        _ = unlocked
        return true
    }

    static func sampleVoices(
        beat: Int,
        mode: SoundMode,
        lang: String,
        clickBank: String,
        voiceBank: String
    ) -> [SampleVoice] {
        switch mode {
        case .traditional:
            let name = beat == 0 ? "click-strong" : "click-weak"
            return [SampleVoice(key: clickKey(bank: clickBank, file: name), gain: 1)]
        case .uniform:
            return [SampleVoice(key: clickKey(bank: clickBank, file: "click-uniform"), gain: 1)]
        case .voice:
            let n = min(maxBeats, max(1, beat + 1))
            let id = String(format: "%02d", n)
            let voiceKey = voiceKey(bank: voiceBank, lang: lang, file: id)
            let weak = clickKey(bank: clickBank, file: "click-weak")
            return [
                SampleVoice(key: voiceKey, gain: 1),
                SampleVoice(key: weak, gain: 0.28)
            ]
        }
    }

    static func clickKey(bank: String, file: String) -> String {
        if bank == defaultBank || bank.isEmpty {
            return file
        }
        return "pack/\(bank)/\(file)"
    }

    static func voiceKey(bank: String, lang: String, file: String) -> String {
        if bank == defaultBank || bank.isEmpty {
            return "voice/\(lang)/\(file)"
        }
        return "pack/\(bank)/\(file)"
    }

    static func bankLabelKey(_ bank: String, voice: Bool) -> String {
        if bank == defaultBank || bank.isEmpty {
            return voice ? "voice_default" : "click_default"
        }
        return bank.replacingOccurrences(of: "-", with: "_")
    }

    static let hapticPatternAll = "all"
    static let hapticPatternDownbeat = "downbeat"
    static let hapticFeelLight = "light"
    static let hapticFeelStandard = "standard"
    static let hapticFeelHeavy = "heavy"

    static func canUseHapticPattern(_ pattern: String, unlocked: Bool) -> Bool {
        if pattern == hapticPatternAll || pattern.isEmpty { return true }
        return unlocked && pattern == hapticPatternDownbeat
    }

    static func canUseHapticFeel(_ feel: String, unlocked: Bool) -> Bool {
        if feel == hapticFeelStandard || feel.isEmpty { return true }
        return unlocked && (feel == hapticFeelLight || feel == hapticFeelHeavy)
    }

    static func resolveHapticPattern(requested: String, unlocked: Bool) -> String {
        canUseHapticPattern(requested, unlocked: unlocked) ? (requested.isEmpty ? hapticPatternAll : requested) : hapticPatternAll
    }

    static func resolveHapticFeel(requested: String, unlocked: Bool) -> String {
        canUseHapticFeel(requested, unlocked: unlocked) ? (requested.isEmpty ? hapticFeelStandard : requested) : hapticFeelStandard
    }

    static func shouldHapticTick(strong: Bool, pattern: String, unlocked: Bool) -> Bool {
        resolveHapticPattern(requested: pattern, unlocked: unlocked) == hapticPatternDownbeat ? strong : true
    }

    /// intensity/sharpness 0...1 for Core Haptics; durationMs for Android one-shots.
    /// Unpaid is one short pulse on every beat. Pack feel may accent the downbeat.
    static func hapticPulse(strong: Bool, feel: String, unlocked: Bool) -> (intensity: Double, sharpness: Double, durationMs: Int) {
        if !unlocked {
            return (0.38, 0.42, 12)
        }
        switch resolveHapticFeel(requested: feel, unlocked: true) {
        case hapticFeelLight:
            return strong ? (0.45, 0.45, 14) : (0.22, 0.30, 8)
        case hapticFeelHeavy:
            return strong ? (1.0, 0.90, 36) : (0.55, 0.50, 18)
        default:
            return strong ? (0.92, 0.75, 28) : (0.42, 0.40, 12)
        }
    }
}

struct MetronomePrefs: Equatable, Codable {
    var bpm: Int
    var bc: Int
    var bu: Int
    var sm: String
    var vol: Int
    var lang: String
    var haptic: Bool
    var keepAwake: Bool
    var clickBank: String
    var voiceBank: String
    var hapticPattern: String
    var hapticFeel: String

    static let `default` = MetronomePrefs(
        bpm: 120, bc: 4, bu: 4, sm: SoundMode.uniform.rawValue, vol: 85,
        lang: "zh", haptic: false, keepAwake: true,
        clickBank: MetronomePolicy.defaultBank, voiceBank: MetronomePolicy.defaultBank,
        hapticPattern: MetronomePolicy.hapticPatternAll,
        hapticFeel: MetronomePolicy.hapticFeelStandard
    )

    static func decode(_ data: Data) -> MetronomePrefs {
        let raw = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        return from(raw)
    }

    static func from(_ raw: [String: Any]) -> MetronomePrefs {
        var p = MetronomePrefs.default
        if let n = raw["bpm"] as? Int { p.bpm = MetronomePolicy.clampBpm(n) }
        if let n = raw["bc"] as? Int { p.bc = MetronomePolicy.clampBeats(n) }
        if let n = raw["bu"] as? Int { p.bu = MetronomePolicy.clampBeatUnit(n) }
        p.sm = SoundMode.parse(raw["sm"] as? String).rawValue
        if let n = raw["vol"] as? Int { p.vol = MetronomePolicy.clampVolume(n) }
        if let s = raw["lang"] as? String, s == "en" || s == "zh" { p.lang = s }
        if let b = raw["haptic"] as? Bool { p.haptic = b }
        if let b = raw["keepAwake"] as? Bool { p.keepAwake = b }
        if let s = raw["clickBank"] as? String { p.clickBank = s }
        if let s = raw["voiceBank"] as? String { p.voiceBank = s }
        if let s = raw["hapticPattern"] as? String { p.hapticPattern = s }
        if let s = raw["hapticFeel"] as? String { p.hapticFeel = s }
        return p
    }

    func coreJSON() -> [String: Any] {
        ["bpm": bpm, "bc": bc, "bu": bu, "sm": sm, "vol": vol]
    }

    func encode() throws -> Data {
        let obj: [String: Any] = [
            "bpm": bpm, "bc": bc, "bu": bu, "sm": sm, "vol": vol,
            "lang": lang, "haptic": haptic, "keepAwake": keepAwake,
            "clickBank": clickBank, "voiceBank": voiceBank,
            "hapticPattern": hapticPattern, "hapticFeel": hapticFeel
        ]
        return try JSONSerialization.data(withJSONObject: obj)
    }

    var mode: SoundMode { SoundMode.parse(sm) }
}
