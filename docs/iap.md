# IAP：音色工坊

SKU（全端同一字符串）：

```
studio.weichao.jpq.soundpack
```

类型：非消耗型。价格：¥12 / $1.99。一次买断，可 Restore。

没有账号。iOS 购买不能自动出现在 Android，反过来也不行。商店文案写「在本平台一次买断」，不要写「买一次全设备全商店」。

## 解锁什么

| 槽位 | 免费 | 包内 |
|---|---|---|
| Click | `click-strong/weak/uniform` | `pack/click-stick`、`click-kick`、`click-tip` |
| 中文数拍 | 晓伊 `voice/zh` | `pack/voice-zh-yunxi`、`pack/voice-zh-soft` |
| 英文数拍 | Ana `voice/en` | `pack/voice-en-deep` |
| 震动 | 开/关；每拍同一种短脉冲 | 只震强拍；轻 / 标准 / 重 |

默认童声永远可玩。震动开/关永远免费。未解锁时点包内音色或付费震动选项 → 系统购买页，不要自己画支付 UI。

偏好字段（原生额外，不进 Web）：`haptic` 布尔；`hapticPattern` 为 `all` | `downbeat`；`hapticFeel` 为 `light` | `standard` | `heavy`。未购 `resolve*` 强制 `all` + `standard`。

## 权威来源

1. iOS：StoreKit 2 `Transaction.currentEntitlements`。`Transaction.updates` 里 **verified** 且 SKU 匹配、未撤销时 `finish()` 后再读 entitlements 刷新 UI；unverified 不解锁
2. Android：Play Billing `queryPurchasesAsync`。购买入口（按钮与 pack/haptic）共用 busy。断线/关闭必须作废进行中的购买查询（generation），释放 busy，禁止旧回调再弹系统购买页或清掉新代 Restore/Purchase。Restore 每次请求有独立 token：旧 Restore 的成功/失败不得结束新 Restore 或 apply 旧账本。`queryPurchases` **非 OK** 不得把空列表当成「未购买」去改已验证内存账本或用户 bank 选择，Restore 返回 Failed/Unavailable 而不是 Done(false)。**OK 且空列表的完整查询**才是权威撤销。`PurchasesUpdatedListener` 的列表是**更新**不是完整库存（Billing 7 官方：`onPurchasesUpdated` reports purchase updates）；empty / PENDING / 非本 SKU 局部列表不得推导撤销。本 SKU `PURCHASED` 可乐观正向提交或触发完整 query；完整成功查询才可撤销。失败/取消保持已有账本。重连只查价和账本，不自动弹出购买页。自动重试用尽后，用户再点购买/恢复可再开一轮有界连接。`restore()` 必须返回明确结果（Done/Busy/Unavailable/Failed/Stale）；busy 或未连接不得显示 restore_ok/none。PENDING 用现有「购买中」文案，不解锁。关闭后已发出的价/账本回调不得更新 UI。未知账本可按未解锁门控 **UI 展示和播放**，不得把展示态写回用户选择；权威 false 才持久化归默认
3. 本地布尔值只是缓存，启动和 Restore 后必须再问商店。未知或失败的查询可以按未解锁门控播放，但不得把 pack/haptic 选择持久化成 default；只有权威成功账本（含 OK 空列表撤销）才写回默认。

不要用「把 UserDefaults 改成 true」当正式解锁。官网 APK 若与 Play 同包名，不要做免费送包后门。

## 必须有的 UI

- 价格来自商店（不要写死 ¥12 在按钮上当唯一价格）
- 购买中 / 失败 / 取消
- **恢复购买**（审核硬性）
- 购买成功后音色列表和震动选项立刻可点

## 不要做

- App 内微信 / 支付宝二维码卖数字内容（Apple 3.1.1）
- 引导「去网站解锁」
- 订阅
- 为默认童声收费
- 自建收据校验服务器（v1 无账号，不值）

## Web / 小程序

v1 不卖这个 SKU。继续落地页打赏。文案不要写成「去 App 才能数拍」。

## 生成

扩展 `tools/gen-sounds.py`，输出到 `assets/sounds/pack/`。人耳过审前不要上架。某条不好听就删槽位，不要凑数。
