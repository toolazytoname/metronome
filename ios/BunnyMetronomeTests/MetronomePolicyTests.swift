import XCTest
@testable import BunnyMetronomeCore

final class MetronomePolicyTests: XCTestCase {
    func testClampBpm() {
        XCTAssertEqual(MetronomePolicy.clampBpm(39), 40)
        XCTAssertEqual(MetronomePolicy.clampBpm(40), 40)
        XCTAssertEqual(MetronomePolicy.clampBpm(120), 120)
        XCTAssertEqual(MetronomePolicy.clampBpm(208), 208)
        XCTAssertEqual(MetronomePolicy.clampBpm(209), 208)
        XCTAssertEqual(MetronomePolicy.clampBpm(-3), 40)
    }

    func testIntervalIsSixtyOverBpm() {
        XCTAssertEqual(MetronomePolicy.intervalSeconds(bpm: 60), 1.0, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.intervalSeconds(bpm: 120), 0.5, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.intervalSeconds(bpm: 40), 1.5, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.intervalSeconds(bpm: 208), 60.0 / 208.0, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.intervalSeconds(bpm: 12), MetronomePolicy.intervalSeconds(bpm: 40), accuracy: 1e-9)
    }

    func testUnknownModeFallsBackToUniform() {
        XCTAssertEqual(SoundMode.parse("nope"), .uniform)
        XCTAssertEqual(SoundMode.parse(nil), .uniform)
        XCTAssertEqual(SoundMode.parse("voice"), .voice)
        let prefs = MetronomePrefs.from(["sm": "garbage", "bpm": 999])
        XCTAssertEqual(prefs.mode, .uniform)
        XCTAssertEqual(prefs.bpm, 208)
    }

    func testSampleSelection() {
        let trad0 = MetronomePolicy.sampleVoices(beat: 0, mode: .traditional, lang: "zh", clickBank: "default", voiceBank: "default")
        XCTAssertEqual(trad0.map(\.key), ["click-strong"])
        let trad1 = MetronomePolicy.sampleVoices(beat: 1, mode: .traditional, lang: "zh", clickBank: "default", voiceBank: "default")
        XCTAssertEqual(trad1.map(\.key), ["click-weak"])
        let uni = MetronomePolicy.sampleVoices(beat: 2, mode: .uniform, lang: "zh", clickBank: "default", voiceBank: "default")
        XCTAssertEqual(uni.map(\.key), ["click-uniform"])
        let voice = MetronomePolicy.sampleVoices(beat: 0, mode: .voice, lang: "zh", clickBank: "default", voiceBank: "default")
        XCTAssertEqual(voice.map(\.key), ["voice/zh/01", "click-weak"])
        XCTAssertEqual(voice[1].gain, 0.28, accuracy: 1e-9)
    }

    func testUnpaidPathCanStartDefaultVoice() {
        XCTAssertTrue(MetronomePolicy.canStartDefaultVoice(unlocked: false))
        XCTAssertTrue(MetronomePolicy.canUsePackBank("default", unlocked: false))
        let voices = MetronomePolicy.sampleVoices(beat: 3, mode: .voice, lang: "en", clickBank: "default", voiceBank: "default")
        XCTAssertEqual(voices.first?.key, "voice/en/04")
    }

    func testPackBanksRefuseWithoutEntitlement() {
        XCTAssertFalse(MetronomePolicy.canUsePackBank("click-stick", unlocked: false))
        XCTAssertEqual(MetronomePolicy.resolveBank(requested: "click-stick", unlocked: false), "default")
        XCTAssertEqual(MetronomePolicy.resolveBank(requested: "voice-zh-yunxi", unlocked: false), "default")
        XCTAssertTrue(MetronomePolicy.canUsePackBank("click-stick", unlocked: true))
        XCTAssertEqual(MetronomePolicy.resolveBank(requested: "click-kick", unlocked: true), "click-kick")
        let gated = MetronomePolicy.sampleVoices(
            beat: 0, mode: .uniform, lang: "zh",
            clickBank: MetronomePolicy.resolveBank(requested: "click-tip", unlocked: false),
            voiceBank: "default"
        )
        XCTAssertEqual(gated.map(\.key), ["click-uniform"])
    }

    func testStoreAdapterIsStubbedNotThePolicy() async {
        let fake = FakeStoreAdapter(unlocked: false)
        let before = await fake.currentEntitlement()
        XCTAssertFalse(before)
        XCTAssertFalse(MetronomePolicy.canUsePackBank("click-stick", unlocked: before))
        try? await fake.purchase()
        XCTAssertEqual(fake.purchaseCalls, 1)
        let after = await fake.currentEntitlement()
        XCTAssertTrue(after)
        XCTAssertTrue(MetronomePolicy.canUsePackBank("click-stick", unlocked: after))
        try? await fake.restore()
        XCTAssertEqual(fake.restoreCalls, 1)
    }
}

final class BufferGainTests: XCTestCase {
    func testScaleAppliesOverlayGain() {
        let src: [Float] = [1, -0.5, 0.2]
        let out = BufferGain.scale(src, gain: 0.28)
        XCTAssertEqual(out[0], 0.28, accuracy: 1e-6)
        XCTAssertEqual(out[1], -0.14, accuracy: 1e-6)
        XCTAssertEqual(out[2], 0.056, accuracy: 1e-6)
        XCTAssertEqual(src[0], 1, accuracy: 1e-9)
    }

    func testVoiceModeEmitsCountPlusWeakClick() {
        let voices = MetronomePolicy.sampleVoices(
            beat: 0, mode: .voice, lang: "zh",
            clickBank: "default", voiceBank: "default"
        )
        XCTAssertEqual(voices.count, 2)
        XCTAssertEqual(voices[0].gain, 1, accuracy: 1e-9)
        XCTAssertEqual(voices[1].gain, 0.28, accuracy: 1e-9)
        let scaled = BufferGain.scale([1], gain: voices[1].gain)
        XCTAssertEqual(scaled[0], 0.28, accuracy: 1e-6)
    }
}

final class BeatSchedulerTests: XCTestCase {
    func testLiveBpmChangeDoesNotInsertExtraBeat() {
        let clock = BeatScheduler(bpm: 60, beatsPerBar: 4)
        clock.start(at: 0)
        let first = clock.pull(until: 0.1)
        XCTAssertEqual(first.count, 1)
        XCTAssertEqual(first[0].index, 0)
        XCTAssertEqual(first[0].time, 0.02, accuracy: 1e-9)
        XCTAssertEqual(clock.nextNoteTime, 1.02, accuracy: 1e-9)

        clock.setBpm(120)
        XCTAssertEqual(MetronomePolicy.intervalSeconds(bpm: clock.bpm), 0.5, accuracy: 1e-9)
        let rest = clock.pull(until: 2.02)
        XCTAssertEqual(rest.map(\.time), [1.02, 1.52], accuracy: 1e-9)
        XCTAssertEqual(rest.map(\.index), [1, 2])
        XCTAssertEqual(clock.nextNoteTime, 2.02, accuracy: 1e-9)
    }
}

private func XCTAssertEqual(_ a: [Double], _ b: [Double], accuracy: Double, file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertEqual(a.count, b.count, file: file, line: line)
    for (x, y) in zip(a, b) {
        XCTAssertEqual(x, y, accuracy: accuracy, file: file, line: line)
    }
}
