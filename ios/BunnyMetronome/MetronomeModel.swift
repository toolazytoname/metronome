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
        audio.onHaptic = { [weak self] in
            guard let self else { return }
            self.haptics.tick(strong: self.activeBeat == 0)
        }
        haptics.prepare()
        Task { await refreshEntitlement() }
    }

    var strings: [String: String] {
        Self.loadTable(lang: prefs.lang)
    }

    func t(_ key: String) -> String {
        strings[key] ?? key
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
        haptics.setAdvanced(unlocked)
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
            } catch {
                storeMessage = String(describing: error)
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
        prefs.bc = MetronomePolicy.clampBeats(bc)
        prefs.bu = MetronomePolicy.clampBeatUnit(bu)
        audio.setBeats(prefs.bc)
        persist()
    }

    func setMode(_ mode: SoundMode) {
        prefs.sm = mode.rawValue
        audio.setMode(mode)
        persist()
    }

    func setLang(_ lang: String) {
        prefs.lang = lang == "en" ? "en" : "zh"
        applyAudioSettings()
    }

    func requestClickBank(_ bank: String) {
        if MetronomePolicy.canUsePackBank(bank, unlocked: unlocked) {
            prefs.clickBank = bank
            applyAudioSettings()
        }
    }

    func requestVoiceBank(_ bank: String) {
        if MetronomePolicy.canUsePackBank(bank, unlocked: unlocked) {
            prefs.voiceBank = bank
            applyAudioSettings()
        }
    }

    func buyPack() async {
        do {
            try await store.purchase()
            await refreshEntitlement()
        } catch {
            storeMessage = String(describing: error)
        }
    }

    func restorePurchases() async {
        do {
            try await store.restore()
            await refreshEntitlement()
        } catch {
            storeMessage = String(describing: error)
        }
    }

    func refreshEntitlement() async {
        unlocked = await store.currentEntitlement()
        prefs.clickBank = MetronomePolicy.resolveBank(requested: prefs.clickBank, unlocked: unlocked)
        prefs.voiceBank = MetronomePolicy.resolveBank(requested: prefs.voiceBank, unlocked: unlocked)
        applyAudioSettings()
    }

    private static func loadTable(lang: String) -> [String: String] {
        let name = lang == "en" ? "en" : "zh"
        if let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Strings"),
           let data = try? Data(contentsOf: url),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            return obj
        }
        return lang == "en" ? Self.enFallback : Self.zhFallback
    }

    private static let zhFallback: [String: String] = [
        "app_name": "小兔头节拍器", "play": "播放", "pause": "暂停",
        "settings": "设置", "restore": "恢复购买", "sound_workshop": "音色工坊"
    ]
    private static let enFallback: [String: String] = [
        "app_name": "Bunny Metronome", "play": "Play", "pause": "Pause",
        "settings": "Settings", "restore": "Restore purchases", "sound_workshop": "Sound Workshop"
    ]
}
