import SwiftUI

@main
struct BunnyMetronomeApp: App {
    @StateObject private var model = MetronomeModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}
