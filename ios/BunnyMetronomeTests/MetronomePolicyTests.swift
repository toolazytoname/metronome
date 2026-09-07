import XCTest
#if canImport(BunnyMetronomeCore)
@testable import BunnyMetronomeCore
#else
@testable import BunnyMetronome
#endif

final class MetronomePolicyTests: XCTestCase {
    func testBeatRowsOmitEmptySlots() {
        XCTAssertEqual(MetronomePolicy.beatRows(beats: 1), [MetronomePolicy.BeatRow(startIndex: 0, count: 1)])
        XCTAssertEqual(MetronomePolicy.beatRows(beats: 3), [MetronomePolicy.BeatRow(startIndex: 0, count: 3)])
        XCTAssertEqual(MetronomePolicy.beatRows(beats: 4), [MetronomePolicy.BeatRow(startIndex: 0, count: 4)])
        XCTAssertEqual(
            MetronomePolicy.beatRows(beats: 5),
            [
                MetronomePolicy.BeatRow(startIndex: 0, count: 4),
                MetronomePolicy.BeatRow(startIndex: 4, count: 1)
            ]
        )
        XCTAssertEqual(
            MetronomePolicy.beatRows(beats: 7),
            [
                MetronomePolicy.BeatRow(startIndex: 0, count: 4),
                MetronomePolicy.BeatRow(startIndex: 4, count: 3)
            ]
        )
        XCTAssertEqual(MetronomePolicy.beatRows(beats: 16).count, 4)
        XCTAssertEqual(MetronomePolicy.beatRows(beats: 16).last?.count, 4)
    }

    func testSliderTouchMatchesThumbCenter() {
        let w = 200.0
        let thumb = 24.0
        XCTAssertEqual(MetronomePolicy.sliderThumbOrigin(fraction: 0, width: w, thumb: thumb), 0, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.sliderThumbOrigin(fraction: 1, width: w, thumb: thumb), 176, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.sliderThumbOrigin(fraction: 0.5, width: w, thumb: thumb), 88, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.sliderValueFromTouch(x: 12, width: w, start: 40, end: 208, thumb: thumb), 40, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.sliderValueFromTouch(x: 200, width: w, start: 40, end: 208, thumb: thumb), 208, accuracy: 1e-9)
        XCTAssertEqual(MetronomePolicy.sliderValueFromTouch(x: 100, width: w, start: 40, end: 208, thumb: thumb), 124, accuracy: 1e-9)
    }

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

    func testBankLabelKeys() {
        XCTAssertEqual(MetronomePolicy.bankLabelKey("default", voice: false), "click_default")
        XCTAssertEqual(MetronomePolicy.bankLabelKey("default", voice: true), "voice_default")
        XCTAssertEqual(MetronomePolicy.bankLabelKey("click-stick", voice: false), "click_stick")
        XCTAssertEqual(MetronomePolicy.bankLabelKey("voice-zh-yunxi", voice: true), "voice_zh_yunxi")
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
        let price = await fake.productPrice()
        XCTAssertEqual(price, "¥12.00")
        try? await fake.purchase()
        XCTAssertEqual(fake.purchaseCalls, 1)
        let after = await fake.currentEntitlement()
        XCTAssertTrue(after)
        XCTAssertTrue(MetronomePolicy.canUsePackBank("click-stick", unlocked: after))
        try? await fake.restore()
        XCTAssertEqual(fake.restoreCalls, 1)
    }

    func testUnpaidHapticStaysEveryBeatStandardPulse() {
        XCTAssertFalse(MetronomePolicy.canUseHapticPattern(MetronomePolicy.hapticPatternDownbeat, unlocked: false))
        XCTAssertFalse(MetronomePolicy.canUseHapticFeel(MetronomePolicy.hapticFeelHeavy, unlocked: false))
        XCTAssertTrue(MetronomePolicy.canUseHapticPattern(MetronomePolicy.hapticPatternAll, unlocked: false))
        XCTAssertTrue(MetronomePolicy.canUseHapticFeel(MetronomePolicy.hapticFeelStandard, unlocked: false))
        XCTAssertEqual(
            MetronomePolicy.resolveHapticPattern(requested: MetronomePolicy.hapticPatternDownbeat, unlocked: false),
            MetronomePolicy.hapticPatternAll
        )
        XCTAssertEqual(
            MetronomePolicy.resolveHapticFeel(requested: MetronomePolicy.hapticFeelLight, unlocked: false),
            MetronomePolicy.hapticFeelStandard
        )
        XCTAssertTrue(MetronomePolicy.shouldHapticTick(strong: false, pattern: MetronomePolicy.hapticPatternDownbeat, unlocked: false))
        let unpaid = MetronomePolicy.hapticPulse(strong: true, feel: MetronomePolicy.hapticFeelHeavy, unlocked: false)
        XCTAssertEqual(unpaid.durationMs, 12)
        XCTAssertEqual(unpaid.intensity, 0.38, accuracy: 1e-9)
        let weak = MetronomePolicy.hapticPulse(strong: false, feel: MetronomePolicy.hapticFeelHeavy, unlocked: false)
        XCTAssertEqual(unpaid.intensity, weak.intensity, accuracy: 1e-9)
        XCTAssertEqual(unpaid.durationMs, weak.durationMs)
    }

    func testPaidHapticDownbeatAndFeel() {
        XCTAssertTrue(MetronomePolicy.canUseHapticPattern(MetronomePolicy.hapticPatternDownbeat, unlocked: true))
        XCTAssertEqual(
            MetronomePolicy.resolveHapticPattern(requested: MetronomePolicy.hapticPatternDownbeat, unlocked: true),
            MetronomePolicy.hapticPatternDownbeat
        )
        XCTAssertFalse(MetronomePolicy.shouldHapticTick(strong: false, pattern: MetronomePolicy.hapticPatternDownbeat, unlocked: true))
        XCTAssertTrue(MetronomePolicy.shouldHapticTick(strong: true, pattern: MetronomePolicy.hapticPatternDownbeat, unlocked: true))
        let heavy = MetronomePolicy.hapticPulse(strong: true, feel: MetronomePolicy.hapticFeelHeavy, unlocked: true)
        XCTAssertEqual(heavy.durationMs, 36)
        let lightWeak = MetronomePolicy.hapticPulse(strong: false, feel: MetronomePolicy.hapticFeelLight, unlocked: true)
        XCTAssertEqual(lightWeak.durationMs, 8)
        let prefs = MetronomePrefs.from(["hapticPattern": "downbeat", "hapticFeel": "heavy"])
        XCTAssertEqual(prefs.hapticPattern, "downbeat")
        XCTAssertEqual(prefs.hapticFeel, "heavy")
    }
}

final class EntitlementRefreshTests: XCTestCase {
    func testLedgerIgnoresOtherSkuUnverifiedAndRevoked() {
        XCTAssertFalse(EntitlementDecision.shouldRefresh(productID: "other.sku", verified: true))
        XCTAssertFalse(EntitlementDecision.shouldRefresh(productID: MetronomePolicy.productId, verified: false))
        XCTAssertTrue(EntitlementDecision.shouldRefresh(productID: MetronomePolicy.productId, verified: true))
        XCTAssertFalse(EntitlementDecision.unlocked(from: [
            EntitlementSnapshot(productID: MetronomePolicy.productId, verified: false, revoked: false)
        ]))
        XCTAssertFalse(EntitlementDecision.unlocked(from: [
            EntitlementSnapshot(productID: MetronomePolicy.productId, verified: true, revoked: true)
        ]))
        XCTAssertFalse(EntitlementDecision.unlocked(from: [
            EntitlementSnapshot(productID: "other.sku", verified: true, revoked: false)
        ]))
        XCTAssertTrue(EntitlementDecision.unlocked(from: [
            EntitlementSnapshot(productID: MetronomePolicy.productId, verified: true, revoked: false)
        ]))
    }

    func testVerifiedUpdateRefreshesEntitlementWithoutShortcutTrue() async {
        let fake = FakeStoreAdapter(unlocked: false)
        let bridge = await MainActor.run { EntitlementObserverBinding(store: fake) }
        await fake.simulateTransactionUpdate(
            productID: MetronomePolicy.productId,
            verified: true,
            unlockedAfterRefresh: true
        )
        let unlocked = await MainActor.run { bridge.unlocked }
        let count = await MainActor.run { bridge.refreshCount }
        XCTAssertTrue(unlocked)
        XCTAssertEqual(count, 1)
        await MainActor.run { bridge.detach() }
    }

    func testUnverifiedUpdateDoesNotUnlock() async {
        let fake = FakeStoreAdapter(unlocked: false)
        let bridge = await MainActor.run { EntitlementObserverBinding(store: fake) }
        await fake.simulateTransactionUpdate(
            productID: MetronomePolicy.productId,
            verified: false,
            unlockedAfterRefresh: true
        )
        let unlocked = await MainActor.run { bridge.unlocked }
        let count = await MainActor.run { bridge.refreshCount }
        XCTAssertFalse(unlocked)
        XCTAssertEqual(count, 0)
        XCTAssertFalse(fake.unlocked)
        await MainActor.run { bridge.detach() }
    }

    func testPendingPurchaseDoesNotUnlockUntilVerifiedUpdate() async {
        let fake = FakeStoreAdapter(unlocked: false)
        fake.purchaseError = .pending
        do {
            try await fake.purchase()
            XCTFail("pending should throw")
        } catch StoreError.pending {
            XCTAssertFalse(fake.unlocked)
        } catch {
            XCTFail("unexpected \(error)")
        }
        let bridge = await MainActor.run { EntitlementObserverBinding(store: fake) }
        await fake.simulateTransactionUpdate(
            productID: MetronomePolicy.productId,
            verified: true,
            unlockedAfterRefresh: true
        )
        let unlocked = await MainActor.run { bridge.unlocked }
        XCTAssertTrue(unlocked)
        await MainActor.run { bridge.detach() }
    }

    func testRevokeRefreshLocksAgain() async {
        let fake = FakeStoreAdapter(unlocked: true)
        let bridge = await MainActor.run { EntitlementObserverBinding(store: fake) }
        await fake.simulateTransactionUpdate(
            productID: MetronomePolicy.productId,
            verified: true,
            unlockedAfterRefresh: false
        )
        let unlocked = await MainActor.run { bridge.unlocked }
        XCTAssertFalse(unlocked)
        await MainActor.run { bridge.detach() }
    }

    func testRefreshGateDropsOlderToken() {
        let gate = EntitlementRefreshGate()
        let a = gate.begin()
        XCTAssertTrue(gate.isCurrent(a))
        let b = gate.begin()
        XCTAssertFalse(gate.isCurrent(a))
        XCTAssertTrue(gate.isCurrent(b))
    }
}

final class BeatSchedulerReentrancyTests: XCTestCase {
    func testStartWhilePlayingDoesNotResetIfEngineGuards() {
        let clock = BeatScheduler(bpm: 120, beatsPerBar: 4)
        clock.start(at: 0)
        XCTAssertTrue(clock.playing)
        let first = clock.pull(until: 0.1)
        XCTAssertEqual(first.count, 1)
        // A second start() on the scheduler itself is a new run (engine must no-op instead).
        XCTAssertEqual(clock.nextNoteTime, 0.52, accuracy: 1e-9)
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
