package studio.weichao.jpq.market

import android.app.Activity
import studio.weichao.jpq.policy.StoreAdapter

/**
 * 渠道商店门面（P6）。play 变体实现为 Play Billing；cn 变体为空实现——
 * cn 包全功能免费，不渲染工坊段，购买/Restore 永不触发。
 */
interface MarketStore : StoreAdapter {
    fun launch(activity: Activity)

    fun close()
}

data class MarketHooks(
    val onEntitlementChange: (Boolean) -> Unit,
    val onMessage: (String) -> Unit,
    val onPrice: (String?) -> Unit,
    val onAvailable: (Boolean) -> Unit,
    val onBusy: (Boolean) -> Unit
)
