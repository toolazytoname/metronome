// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BunnyMetronomeCore",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "BunnyMetronomeCore", targets: ["BunnyMetronomeCore"])
    ],
    targets: [
        .target(
            name: "BunnyMetronomeCore",
            path: "BunnyMetronome",
            exclude: [
                "BunnyMetronomeApp.swift",
                "AppAnalytics.swift",
                "ContentView.swift",
                "MetronomeModel.swift",
                "Haptics.swift",
                "Engine/MetronomeAudioEngine.swift",
                "Store/StoreAdapter.swift",
                "Assets.xcassets",
                "Sounds",
                "Strings",
                "Configuration.storekit",
                "PrivacyInfo.xcprivacy",
                "GoogleService-Info.plist",
                "Info.plist",
                "en.lproj",
                "zh-Hans.lproj"
            ]
        ),
        .testTarget(
            name: "BunnyMetronomeCoreTests",
            dependencies: ["BunnyMetronomeCore"],
            path: "BunnyMetronomeTests"
        )
    ]
)
