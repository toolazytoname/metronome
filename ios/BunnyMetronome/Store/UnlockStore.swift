import Foundation

protocol StoreAdapter: AnyObject {
    func currentEntitlement() async -> Bool
    func productPrice() async -> String?
    func purchase() async throws
    func restore() async throws
}

/// Test double for the store. Unlock *policy* still lives in MetronomePolicy.
final class FakeStoreAdapter: StoreAdapter {
    var unlocked: Bool
    var purchaseCalls = 0
    var restoreCalls = 0
    var price: String? = "¥12.00"

    init(unlocked: Bool = false) {
        self.unlocked = unlocked
    }

    func currentEntitlement() async -> Bool { unlocked }
    func productPrice() async -> String? { price }

    func purchase() async throws {
        purchaseCalls += 1
        unlocked = true
    }

    func restore() async throws {
        restoreCalls += 1
    }
}

enum StoreError: Error {
    case missingProduct
    case unverified
    case cancelled
    case pending
}
