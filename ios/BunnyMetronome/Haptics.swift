import UIKit
import CoreHaptics

final class TickHaptics {
    private var engine: CHHapticEngine?
    private var advanced = false

    func setAdvanced(_ on: Bool) { advanced = on }

    func prepare() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        engine = try? CHHapticEngine()
        try? engine?.start()
    }

    func tick(strong: Bool) {
        if let engine {
            let intensity = advanced && strong ? 1.0 : (strong ? 0.7 : 0.35)
            let sharpness = advanced && strong ? 0.9 : 0.4
            let ev = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(intensity)),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(sharpness))
                ],
                relativeTime: 0
            )
            if let pattern = try? CHHapticPattern(events: [ev], parameters: []) {
                let player = try? engine.makePlayer(with: pattern)
                try? player?.start(atTime: 0)
            }
        } else {
            let style: UIImpactFeedbackGenerator.FeedbackStyle = strong ? .medium : .light
            UIImpactFeedbackGenerator(style: style).impactOccurred()
        }
    }
}
