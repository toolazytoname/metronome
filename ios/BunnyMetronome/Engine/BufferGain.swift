import Foundation

enum BufferGain {
    /// Scale PCM samples. Used by the audio engine so overlay clicks sit at 0.28.
    static func scale(_ samples: [Float], gain: Double) -> [Float] {
        let g = Float(gain)
        return samples.map { $0 * g }
    }

    static func scaleInPlace(_ samples: UnsafeMutablePointer<Float>, count: Int, gain: Double) {
        let g = Float(gain)
        for i in 0..<count {
            samples[i] *= g
        }
    }
}
