import Foundation
import StoreKit

/// Production adapter. Tests inject FakeStoreAdapter from the test target.
@MainActor
final class StoreKitAdapter: StoreAdapter {
    static let shared = StoreKitAdapter()
    private var updatesTask: Task<Void, Never>?
    private var observer: (@MainActor () async -> Void)?

    private init() {
        startUpdatesIfNeeded()
    }

    func setEntitlementObserver(_ observer: (@MainActor () async -> Void)?) {
        self.observer = observer
        startUpdatesIfNeeded()
    }

    private func startUpdatesIfNeeded() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                switch result {
                case .verified(let tx):
                    await tx.finish()
                    guard EntitlementDecision.shouldRefresh(productID: tx.productID, verified: true) else { continue }
                    await self.observer?()
                case .unverified:
                    continue
                }
            }
        }
    }

    func currentEntitlement() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == MetronomePolicy.productId {
                if tx.revocationDate == nil { return true }
            }
        }
        return false
    }

    func productPrice() async -> String? {
        let products = try? await Product.products(for: [MetronomePolicy.productId])
        return products?.first?.displayPrice
    }

    func purchase() async throws {
        let products = try await Product.products(for: [MetronomePolicy.productId])
        guard let product = products.first else {
            throw StoreError.missingProduct
        }
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            let tx = try check(verification)
            await tx.finish()
        case .userCancelled:
            throw StoreError.cancelled
        case .pending:
            throw StoreError.pending
        @unknown default:
            break
        }
    }

    func restore() async throws {
        try await AppStore.sync()
    }

    private func check(_ result: VerificationResult<Transaction>) throws -> Transaction {
        switch result {
        case .unverified:
            throw StoreError.unverified
        case .verified(let tx):
            return tx
        }
    }
}
