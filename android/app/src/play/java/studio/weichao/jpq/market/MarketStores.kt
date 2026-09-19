package studio.weichao.jpq.market

import android.content.Context
import studio.weichao.jpq.billing.PlayStoreAdapter

fun createMarketStore(context: Context, hooks: MarketHooks): MarketStore =
    PlayStoreAdapter(
        context,
        onEntitlementChange = hooks.onEntitlementChange,
        onMessage = hooks.onMessage,
        onPrice = hooks.onPrice,
        onAvailable = hooks.onAvailable,
        onBusy = hooks.onBusy
    )
