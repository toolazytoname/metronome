import UIKit
import CoreHaptics

final class TickHaptics {
    private var engine: CHHapticEngine?
    var pattern = MetronomePolicy.hapticPatternAll
    var feel = MetronomePolicy.hapticFeelStandard
    var unlocked = false

    func prepare() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        engine = try? CHHapticEngine()
        try? engine?.start()
        engine?.resetHandler = { [weak self] in
            try? self?.engine?.start()
        }
        engine?.stoppedHandler = { [weak self] _ in
            try? self?.engine?.start()
        }
    }

    func tick(strong: Bool) {
        guard MetronomePolicy.shouldHapticTick(strong: strong, pattern: pattern, unlocked: unlocked) else { return }
        let pulse = MetronomePolicy.hapticPulse(strong: strong, feel: feel, unlocked: unlocked)
        if let engine {
            let ev = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(pulse.intensity)),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(pulse.sharpness))
                ],
                relativeTime: 0
            )
            if let hapticPattern = try? CHHapticPattern(events: [ev], parameters: []) {
                let player = try? engine.makePlayer(with: hapticPattern)
                try? player?.start(atTime: 0)
            }
        } else {
            let style: UIImpactFeedbackGenerator.FeedbackStyle
            if pulse.intensity >= 0.8 { style = .heavy }
            else if pulse.intensity >= 0.5 { style = .medium }
            else { style = .light }
            UIImpactFeedbackGenerator(style: style).impactOccurred()
        }
    }
}
