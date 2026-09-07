package studio.weichao.jpq.policy

/**
 * Bounded reconnect delays for Play Billing Library 7.
 * Official integrate + errors docs (verified 2026-09-06):
 * https://developer.android.com/google/play/billing/integrate
 * https://developer.android.com/google/play/billing/errors
 * Billing 7 has no enableAutoServiceReconnection (that is 8.0.0);
 * onBillingServiceDisconnected must call startConnection with a finite retry cap.
 */
object BillingReconnectPolicy {
    const val MAX_ATTEMPTS = 3
    const val BASE_DELAY_MS = 1_000L
    const val MAX_DELAY_MS = 4_000L

    fun nextDelayMs(attempt: Int): Long? {
        if (attempt < 1 || attempt > MAX_ATTEMPTS) return null
        val shift = (attempt - 1).coerceAtMost(2)
        return (BASE_DELAY_MS shl shift).coerceAtMost(MAX_DELAY_MS)
    }
}
