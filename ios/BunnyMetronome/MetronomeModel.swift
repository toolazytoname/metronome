import Foundation
import SwiftUI
import UIKit

@MainActor
final class MetronomeModel: ObservableObject {
    @Published var prefs: MetronomePrefs
    @Published var playing = false
    @Published var activeBeat: Int = -1
    @Published var unlocked = false
    @Published var settingsOpen = false
    @Published var storeMessage: String = ""
    @Published var productPrice: String?
    @Published var storeBusy = false

    let audio = MetronomeAudioEngine()
    let haptics = TickHaptics()
    private let store: StoreAdapter

    init(store: StoreAdapter? = nil) {
        self.store = store ?? StoreKitAdapter.shared
        self.prefs = PrefsStore.load()
        applyAudioSettings()
        audio.setOnBeat { [weak self] beat in
            Task { @MainActor in
                self?.activeBeat = beat
            }
        }
        audio.onHaptic = { [weak self] beat in
            self?.haptics.tick(strong: beat == 0)
        }
        audio.onInterrupted = { [weak self] in
            Task { @MainActor in
                guard let self, self.playing else { return }
                self.audio.stop()
                self.playing = false
                self.activeBeat = -1
                self.persist()
            }
        }
        haptics.prepare()
        Task {
            await refreshEntitlement()
            await refreshPrice()
        }
    }

    var strings: [String: String] {
        Self.loadTable(lang: prefs.lang)
    }

    func t(_ key: String) -> String {
        strings[key] ?? key
    }

    var modeLabel: String {
        switch prefs.mode {
        case .traditional: return t("sound_traditional")
        case .uniform: return t("sound_uniform")
        case .voice: return t("sound_voice")
        }
    }

    var statusLine: String {
        let head = playing ? t("status_playing") : t("status_idle")
        return "\(head) · \(prefs.bpm) BPM · \(prefs.bc)/\(prefs.bu) · \(modeLabel)"
    }

    func bankLabel(_ bank: String, voice: Bool = false) -> String {
        let key: String
        switch bank {
        case "", MetronomePolicy.defaultBank:
            key = voice ? "voice_default" : "click_default"
        default:
            key = bank.replacingOccurrences(of: "-", with: "_")
        }
        return t(key)
    }

    func shareURL() -> URL {
        var c = URLComponents(string: prefs.lang == "en"
            ? "https://jpq.weichao.studio/en/"
            : "https://jpq.weichao.studio/")!
        c.queryItems = [
            URLQueryItem(name: "bpm", value: "\(prefs.bpm)"),
            URLQueryItem(name: "sig", value: "\(prefs.bc)/\(prefs.bu)"),
            URLQueryItem(name: "mode", value: prefs.mode.rawValue)
        ]
        return c.url!
    }

    func supportURL() -> URL {
        if prefs.lang == "en" {
            return URL(string: "https://jpq.weichao.studio/en/support")!
        }
        return URL(string: "https://jpq.weichao.studio/support")!
    }

    func privacyURL() -> URL {
        if prefs.lang == "en" {
            return URL(string: "https://jpq.weichao.studio/en/privacy")!
        }
        return URL(string: "https://jpq.weichao.studio/privacy")!
    }

    func buyButtonTitle() -> String {
        if let productPrice, !productPrice.isEmpty {
            return "\(t("buy")) \(productPrice)"
        }
        return t("buy")
    }

    func applyAudioSettings() {
        audio.setBpm(prefs.bpm)
        audio.setBeats(prefs.bc)
        audio.setMode(prefs.mode)
        audio.setLang(prefs.lang)
        audio.setVolume(Double(prefs.vol) / 100.0)
        audio.hapticEnabled = prefs.haptic
        let click = MetronomePolicy.resolveBank(requested: prefs.clickBank, unlocked: unlocked)
        let voice = MetronomePolicy.resolveBank(requested: prefs.voiceBank, unlocked: unlocked)
        audio.setClickBank(click)
        audio.setVoiceBank(voice)
        haptics.unlocked = unlocked
        haptics.pattern = MetronomePolicy.resolveHapticPattern(requested: prefs.hapticPattern, unlocked: unlocked)
        haptics.feel = MetronomePolicy.resolveHapticFeel(requested: prefs.hapticFeel, unlocked: unlocked)
        persist()
    }

    func persist() {
        PrefsStore.save(prefs)
        UIApplication.shared.isIdleTimerDisabled = playing && prefs.keepAwake
    }

    func togglePlay() {
        if playing {
            audio.stop()
            playing = false
            activeBeat = -1
        } else {
            applyAudioSettings()
            do {
                try audio.loadSamples()
                try audio.start()
                playing = true
                storeMessage = ""
            } catch {
                storeMessage = t("play_error")
            }
        }
        persist()
    }

    func setBpm(_ n: Int) {
        prefs.bpm = MetronomePolicy.clampBpm(n)
        audio.setBpm(prefs.bpm)
        persist()
    }

    func setSignature(bc: Int, bu: Int) {
        var txn = Transaction()
        txn.disablesAnimations = true
        withTransaction(txn) {
            prefs.bc = MetronomePolicy.clampBeats(bc)
            prefs.bu = MetronomePolicy.clampBeatUnit(bu)
            audio.setBeats(prefs.bc)
            persist()
        }
    }

    func setMode(_ mode: SoundMode) {
        var txn = Transaction()
        txn.disablesAnimations = true
        withTransaction(txn) {
            prefs.sm = mode.rawValue
            audio.setMode(mode)
            persist()
        }
    }

    func setLang(_ lang: String) {
        prefs.lang = lang == "en" ? "en" : "zh"
        applyAudioSettings()
    }

    func requestClickBank(_ bank: String) {
        if MetronomePolicy.canUsePackBank(bank, unlocked: unlocked) {
            prefs.clickBank = bank
            applyAudioSettings()
        } else {
            Task { await buyPack() }
        }
    }

    func requestVoiceBank(_ bank: String) {
        if MetronomePolicy.canUsePackBank(bank, unlocked: unlocked) {
            prefs.voiceBank = bank
            applyAudioSettings()
        } else {
            Task { await buyPack() }
        }
    }

    func requestHapticPattern(_ pattern: String) {
        if MetronomePolicy.canUseHapticPattern(pattern, unlocked: unlocked) {
            prefs.hapticPattern = MetronomePolicy.resolveHapticPattern(requested: pattern, unlocked: unlocked)
            applyAudioSettings()
        } else {
            Task { await buyPack() }
        }
    }

    func requestHapticFeel(_ feel: String) {
        if MetronomePolicy.canUseHapticFeel(feel, unlocked: unlocked) {
            prefs.hapticFeel = MetronomePolicy.resolveHapticFeel(requested: feel, unlocked: unlocked)
            applyAudioSettings()
        } else {
            Task { await buyPack() }
        }
    }

    func buyPack() async {
        guard !storeBusy else { return }
        storeBusy = true
        storeMessage = t("buying")
        defer { storeBusy = false }
        do {
            try await store.purchase()
            await refreshEntitlement()
            storeMessage = unlocked ? t("owned") : t("buy_failed")
        } catch StoreError.cancelled {
            storeMessage = t("buy_cancelled")
        } catch StoreError.pending {
            storeMessage = t("buying")
        } catch StoreError.missingProduct {
            storeMessage = t("buy_unavailable")
        } catch {
            storeMessage = t("buy_failed")
        }
    }

    func restorePurchases() async {
        guard !storeBusy else { return }
        storeBusy = true
        storeMessage = t("restore")
        defer { storeBusy = false }
        do {
            try await store.restore()
            await refreshEntitlement()
            storeMessage = unlocked ? t("restore_ok") : t("restore_none")
        } catch {
            storeMessage = t("restore_failed")
        }
    }

    func refreshEntitlement() async {
        unlocked = await store.currentEntitlement()
        prefs.clickBank = MetronomePolicy.resolveBank(requested: prefs.clickBank, unlocked: unlocked)
        prefs.voiceBank = MetronomePolicy.resolveBank(requested: prefs.voiceBank, unlocked: unlocked)
        applyAudioSettings()
    }

    func refreshPrice() async {
        productPrice = await store.productPrice()
    }

    private static func loadTable(lang: String) -> [String: String] {
        let name = lang == "en" ? "en" : "zh"
        let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Strings")
            ?? Bundle.main.url(forResource: name, withExtension: "json")
        if let url,
           let data = try? Data(contentsOf: url),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            return obj
        }
        return lang == "en" ? Self.enFallback : Self.zhFallback
    }

    private static let zhFallback: [String: String] = [
        "app_name": "小兔头节拍器", "play": "播放", "pause": "暂停",
        "settings": "设置", "restore": "恢复购买", "sound_workshop": "音色工坊",
        "buy": "解锁", "owned": "已解锁"
    ]
    private static let enFallback: [String: String] = [
        "app_name": "Bunny Metronome", "play": "Play", "pause": "Pause",
        "settings": "Settings", "restore": "Restore purchases", "sound_workshop": "Sound Workshop",
        "buy": "Unlock", "owned": "Unlocked"
    ]
}
