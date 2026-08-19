import Foundation

enum PrefsStore {
    static let key = "metronome"

    static func load() -> MetronomePrefs {
        guard let data = UserDefaults.standard.data(forKey: key) else {
            return .default
        }
        return MetronomePrefs.decode(data)
    }

    static func save(_ prefs: MetronomePrefs) {
        if let data = try? prefs.encode() {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
