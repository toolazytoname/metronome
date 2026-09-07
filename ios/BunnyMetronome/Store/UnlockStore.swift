import Foundation

protocol StoreAdapter: AnyObject {
    func currentEntitlement() async -> Bool
    func productPrice() async -> String?
    func purchase() async throws
    func restore() async throws
    func setEntitlementObserver(_ observer: (@MainActor () async -> Void)?)
}

struct EntitlementSnapshot: Equatable {
    var productID: String
    var verified: Bool
    var revoked: Bool
}

enum EntitlementDecision {
    static func shouldRefresh(productID: String, verified: Bool, sku: String = MetronomePolicy.productId) -> Bool {
        verified && productID == sku
    }

    static func unlocked(from snapshots: [EntitlementSnapshot], sku: String = MetronomePolicy.productId) -> Bool {
        snapshots.contains { $0.productID == sku && $0.verified && !$0.revoked }
    }
}

/// Drops an older in-flight entitlements query when a newer refresh has started.
final class EntitlementRefreshGate: @unchecked Sendable {
    private let lock = NSLock()
    private var seq: UInt64 = 0

    func begin() -> UInt64 {
        lock.lock()
        seq += 1
        let token = seq
        lock.unlock()
        return token
    }

    func isCurrent(_ token: UInt64) -> Bool {
        lock.lock()
        let ok = token == seq
        lock.unlock()
        return ok
    }
}

enum StoreError: Error {
    case missingProduct
    case unverified
    case cancelled
    case pending
}
