import Foundation
#if canImport(BunnyMetronomeCore)
@testable import BunnyMetronomeCore
#else
@testable import BunnyMetronome
#endif

/// Test double. Unlock policy stays in MetronomePolicy.
final class FakeStoreAdapter: StoreAdapter {
    var unlocked: Bool
    var purchaseCalls = 0
    var restoreCalls = 0
    var price: String? = "¥12.00"
    var purchaseError: StoreError?
    var entitlementDelayNs: UInt64 = 0
    var entitlementResults: [Bool] = []
    private var observer: (@MainActor () async -> Void)?

    init(unlocked: Bool = false) {
        self.unlocked = unlocked
    }

    func currentEntitlement() async -> Bool {
        if entitlementDelayNs > 0 {
            try? await Task.sleep(nanoseconds: entitlementDelayNs)
        }
        if !entitlementResults.isEmpty {
            return entitlementResults.removeFirst()
        }
        return unlocked
    }

    func productPrice() async -> String? { price }

    func purchase() async throws {
        purchaseCalls += 1
        if let purchaseError {
            throw purchaseError
        }
        unlocked = true
    }

    func restore() async throws {
        restoreCalls += 1
    }

    func setEntitlementObserver(_ observer: (@MainActor () async -> Void)?) {
        self.observer = observer
    }

    func simulateTransactionUpdate(productID: String, verified: Bool, unlockedAfterRefresh: Bool) async {
        guard EntitlementDecision.shouldRefresh(productID: productID, verified: verified) else { return }
        unlocked = unlockedAfterRefresh
        if let observer {
            await observer()
        }
    }
}

@MainActor
final class EntitlementObserverBinding {
    private let store: StoreAdapter
    private let gate = EntitlementRefreshGate()
    var unlocked = false
    var refreshCount = 0
    var applied: [Bool] = []

    init(store: StoreAdapter) {
        self.store = store
        store.setEntitlementObserver { [weak self] in
            await self?.refresh()
        }
    }

    func refresh() async {
        let token = gate.begin()
        let value = await store.currentEntitlement()
        guard gate.isCurrent(token) else { return }
        unlocked = value
        refreshCount += 1
        applied.append(value)
    }

    func detach() {
        store.setEntitlementObserver(nil)
    }
}
