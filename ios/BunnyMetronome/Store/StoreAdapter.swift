import Foundation
import StoreKit

/// Production adapter. Tests inject FakeStoreAdapter — they do not stub unlock policy.
@MainActor
final class StoreKitAdapter: StoreAdapter {
    static let shared = StoreKitAdapter()
    private var updatesTask: Task<Void, Never>?

    private init() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let tx) = result {
                    await tx.finish()
                    _ = self
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
