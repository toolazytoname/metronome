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

1. iOS：StoreKit 2 `Transaction.currentEntitlements`
2. Android：Play Billing `queryPurchasesAsync`
3. 本地布尔值只是缓存，启动和 Restore 后必须再问商店

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
