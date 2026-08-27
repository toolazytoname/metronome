import SwiftUI

@main
struct BunnyMetronomeApp: App {
    @StateObject private var model = MetronomeModel()

    init() {
        AppAnalytics.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .onAppear {
                    let args = ProcessInfo.processInfo.arguments
                    if args.contains("-OpenSettings") { model.settingsOpen = true }
                    if args.contains("-AutoPlay") { model.togglePlay() }
                }
        }
    }
}
