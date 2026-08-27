import Foundation
import FirebaseAnalytics
import FirebaseCore

/// Product analytics only. No advertising ID.
/// Skips configure until GoogleService-Info.plist has a real GOOGLE_APP_ID.
enum AppAnalytics {
    private static var ready = false

    static func start() {
        guard let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
              let info = NSDictionary(contentsOf: url),
              let appId = info["GOOGLE_APP_ID"] as? String,
              !appId.isEmpty,
              !appId.hasPrefix("YOUR_")
        else { return }
        FirebaseApp.configure()
        Analytics.setAnalyticsCollectionEnabled(true)
        ready = true
    }

    static func event(_ name: String, _ params: [String: Any] = [:]) {
        guard ready else { return }
        Analytics.logEvent(name, parameters: params)
    }
}
