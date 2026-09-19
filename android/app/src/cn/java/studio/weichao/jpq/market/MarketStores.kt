package studio.weichao.jpq.market

import android.app.Activity
import android.content.Context
import studio.weichao.jpq.policy.StoreRestoreResult

private object NoMarketStore : MarketStore {
    override fun launch(activity: Activity) {}
    override fun close() {}
    override suspend fun currentEntitlement(): Boolean = false
    override suspend fun productPrice(): String? = null
    override suspend fun purchase() {}
    override suspend fun restore(): StoreRestoreResult = StoreRestoreResult.Unavailable
}

fun createMarketStore(context: Context, hooks: MarketHooks): MarketStore = NoMarketStore
