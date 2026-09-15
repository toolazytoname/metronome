# Store listing draft

Bundle / application id: `studio.weichao.jpq`
Name: 小兔头节拍器 / Bunny Metronome
SKU: `studio.weichao.jpq.soundpack` (non-consumable, ¥12 / $1.99)
Version: Android Play next upload `2.1.7` (versionCode 9). Current internal-test high is `2.1.6` (code 8), not this source. iPhone only — do not upload iPad screenshots.

提审当天把本节贴进 App Store Connect / Play Console。代码待办在 [AGENTS.md](../../AGENTS.md) P4。

提审容易漏（不是文案）：

- Connect 先签付费应用协议 + 税务 / 银行，否则 IAP 建不了。
- 第一个非消耗型 IAP 必须跟这一版 App **一起**送审。
- 个人 Play 账号上**生产轨**要 12 名测试者连续 14 天封闭测试；内部测试轨不挡。
- 商店链接在 Ready for Sale 之前不要改落地页徽章（N5.9）。
- Play 新应用传 **AAB**（`targetSdk` 36），不要传 APK。宣传图必须正好 1024×500。不要勾「专为儿童设计」（有 IAP）。

## Short description

中文（最多 30 字左右，按商店限额裁）：会数拍的节拍器。核心播放、BPM、拍号、默认童声免费。

English (80 chars): A metronome that counts out loud. Play, BPM, meter, and default voice stay free.

## Full description (zh)

小兔头节拍器会大声数拍。打开就能练：童声（晓伊）、传统强弱 click、均匀 click。

永远免费：
- 播放 / 暂停
- BPM 40–208
- 拍号（含自定义）
- 默认童声数拍

锁屏、静音键下仍然出声。没有广告，不用注册。

可选一次买断「音色工坊」，解锁额外 click、数拍声线，以及只震强拍 / 轻标准重震感。震动开关本身免费。购买记在本平台商店账本里，换机请用「恢复购买」。默认童声不需要买。没有账号，因此 iOS 购买不会出现在 Android，反过来也不行。

## Full description (en)

Bunny Metronome counts the beat out loud. Open and play: default child voice (Ana), traditional strong/weak clicks, or a uniform click.

Always free: play/pause, BPM 40–208, time signatures including custom, and the default counting voice.

It keeps ticking with the silent switch on and on the lock screen. No ads, no account.

Sound Workshop is an optional one-time unlock for extra clicks, voices, and finer haptic ticks on this store. The haptic on/off switch stays free. Restore purchases after reinstall. The default voice stays free. Purchases do not transfer across App Store and Play because there is no account.

## Keywords

metronome, tempo, BPM, piano, drums, voice count, 节拍器, 练琴, 拍号, 童声

## Screenshots (launch blocker: Chinese set)

iPhone **6.9"**（Connect 2026 主尺寸 **1320×2868**，无透明）。iPhone 17 Pro Max 模拟器 2026-09-08 重出；只发 iPhone，**不要传 iPad 图**。

1. `docs/store/screenshots/ios-practice.png` — 默认 120 BPM、4/4、均匀、待开始
2. `docs/store/screenshots/ios-playing.png` — 正在播放、暂停键
3. `docs/store/screenshots/ios-settings.png` — 设置（音效 / 拍号 / 音量 / 语言）
4. `docs/store/screenshots/ios-workshop.png` — 音色工坊（解锁 + Restore）

英文截图 = 上线应当，同一四帧。Play 不要用这套 iOS 图。

## Privacy / Data safety

No account. Local preferences stay on device. Optional IAP recorded by Apple / Google Play.

Analytics is **per platform**:

- Web / mini-program: those surfaces only (Umeng / GA4 / umtrack-wx).
- iOS: Firebase Analytics for in-app events (open, play, BPM, meter, mode, settings). App-instance ID only — advertising ID collection off. Data is sent to Google to measure usage. No name, email, or audio.
- Android 2.1.7+: **no Firebase Analytics**, no advertising / attribution SDK, no developer-defined product analytics events. Sound Workshop / Restore use Google Play Billing. Privacy / Support links open in the system browser.

App Store privacy nutrition:
- Data types: Product Interaction, Device ID (app instance, not IDFA)
- Linked to identity: No
- Used for tracking: No
- Third-party advertising: No

Play Data safety (**paste is a reminder, not a submitted form; do not mark N4.10 done**):
- Android 2.1.7+: no Firebase Analytics, no advertising / attribution SDK, no developer-defined product analytics events; no account; no crash-reporter SDK.
- Sound Workshop purchase and Restore use Google Play Billing. The Billing SDK / Google Play may process data Google needs for the transaction, fraud prevention, service operation, or diagnostics. That is not Firebase Analytics.
- Payment UI is provided by Google Play; do not declare that the app itself collects credit-card or payment details.
- Do **not** pre-answer “collects/shares no data.” Confirm each Console row against the shipped AAB, Google’s Play Billing SDK Data safety guidance, and in-Console prompts.

Contact lazywc@gmail.com.

Play default listing language **English (United States)**. Default URLs (English):
- Website: https://jpq.weichao.studio/en/
- Privacy: https://jpq.weichao.studio/en/privacy
- Support: https://jpq.weichao.studio/en/support

Chinese localization URLs: `https://jpq.weichao.studio/` , `/privacy`, `/support`. Website root stays Chinese. In-app links still follow the app language.

App Store Connect default URLs may stay Chinese-first (`/privacy`, `/support`); English listing uses `/en/privacy`, `/en/support`.

## Review notes (paste)

Core metronome is free. Default counting voice is free. Haptic ticks on/off is free. Sound Workshop (`studio.weichao.jpq.soundpack`) is a non-consumable that unlocks extra samples plus downbeat-only / light-standard-heavy haptics. Restore is in Settings. There is no account, so purchases do not cross stores. No WeChat/Alipay QR codes in the app. Platform-specific analytics: see Privacy / Data safety above (iOS Firebase in-app events; Android 2.1.7+ has no Firebase Analytics and no developer product events; IAP uses Play Billing).

## Age

4+

---

## App Store Connect 粘贴稿

主语言 **简体中文**，再加 **English (US)**。类别 **Music**。只发 **iPhone**（工程 `TARGETED_DEVICE_FAMILY = 1`）。不要勾 Made for Kids（有 IAP）。版权 `2026 weichao.studio`。联系 `lazywc@gmail.com`。SKU（Connect 应用级，不是 IAP）`studio.weichao.jpq`。版本 `2.1.2` (build 4)。

### 名称（≤30）/ 副标题（≤30）

| | 中文 | 字数 | English | 字数 |
|---|---|---|---|---|
| 名称 | 小兔头节拍器 | 6 | Bunny Metronome | 15 |
| 副标题 | 打开就能练，核心永久免费 | 12 | Counts aloud. Core stays free | 29 |

### 宣传文本（≤170，可不发新包就改）

中文：

```
打开就能练。播放、BPM、拍号、默认童声永久免费。可选一次买断音色工坊。
```

English：

```
Open and play. Play, BPM, meter, and the default counting voice stay free. Sound Workshop is a one-time unlock on this store.
```

### 关键词（≤100，逗号分隔、不要空格）

中文：

```
节拍器,练琴,拍号,童声,钢琴,架子鼓,节奏,数拍
```

English：

```
metronome,tempo,BPM,piano,drums,voice,count,beat,practice
```

### 描述

中文：

```
小兔头节拍器会大声数拍。打开就能练：童声（晓伊）、传统强弱 click、均匀 click。

永远免费：
- 播放 / 暂停
- BPM 40–208
- 拍号（含自定义）
- 默认童声数拍

锁屏、静音键下仍然出声。没有广告，不用注册。

可选一次买断「音色工坊」，解锁额外 click、数拍声线，以及只震强拍 / 轻标准重震感。震动开关本身免费。购买记在本平台商店账本里，换机请用「恢复购买」。默认童声不需要买。没有账号，因此 iOS 购买不会出现在 Android，反过来也不行。
```

English：

```
Bunny Metronome counts the beat out loud. Open and play: default child voice (Ana), traditional strong/weak clicks, or a uniform click.

Always free: play/pause, BPM 40–208, time signatures including custom, and the default counting voice.

It keeps ticking with the silent switch on and on the lock screen. No ads, no account.

Sound Workshop is an optional one-time unlock on this store for extra clicks, voices, and finer haptic ticks. The haptic on/off switch stays free. Restore purchases after reinstall. The default voice stays free. Purchases do not transfer across App Store and Play because there is no account.
```

文案写「在本平台一次买断」，不要写「买一次全平台」。

### 此版本的新功能

中文：`首次上架：免费节拍器，童声数拍，可选音色工坊。`
English：`First release. Free metronome with counting voice. Optional Sound Workshop.`

### 图形

| 资产 | 规格 | 路径 |
|---|---|---|
| App Icon | 1024×1024 RGB | `docs/store/ios-icon-1024.png`（工程里已是 `AppIcon.appiconset`） |
| iPhone 6.9" 截图 | **1320×2868** PNG 无透明，1–10 张 | 上面四张 `ios-*.png` |
| iPad / Watch / Mac | 不要传 | 只发 iPhone |

### 分级问卷（4+）

不是 Made for Kids。无暴力、色情、脏话、毒品、烟酒、赌博、恐怖、枪战。无用户生成内容、无位置共享。
**有未受限的网页访问？** 否（只开隐私/支持链接）。
**有应用内购买？** 是（非消耗型音色工坊）。

### App 隐私（营养标签）

无账户。不跟踪。不用于广告。`NSPrivacyTracking = false`。

| 数据类型 | 用于 | 关联身份 | 用于跟踪 |
|---|---|---|---|
| Product Interaction（打开、播放、BPM、拍号、模式） | Analytics | 否 | 否 |
| Device ID（Firebase 应用实例 ID，不是 IDFA） | Analytics | 否 | 否 |

第三方：Google（Firebase Analytics）。广告标识采集已关。

隐私政策：https://jpq.weichao.studio/privacy
英文：https://jpq.weichao.studio/en/privacy
支持：https://jpq.weichao.studio/support
英文支持：https://jpq.weichao.studio/en/support

### 出口合规

工程已 `ITSAppUsesNonExemptEncryption = NO`。Connect 问是否使用非豁免加密：**否**。

### IAP（必须跟这一版 App 一起送审）

Connect 先签付费协议 + 税务/银行，否则建不了商品。

| | |
|---|---|
| Product ID | `studio.weichao.jpq.soundpack` |
| 类型 | Non-Consumable（非消耗型） |
| Reference name | Sound Workshop |
| 显示名 zh | 音色工坊 |
| 显示名 en | Sound Workshop |
| 说明 zh | 额外 click 与数拍声线。默认童声仍然免费。 |
| 说明 en | Extra clicks and counting voices. Default voice stays free. |
| 价格档 | 对齐 ¥12 / $1.99（用商店档位，不要写死在 App 按钮上） |
| 审核截图 | `docs/store/screenshots/ios-workshop.png` |
| 家庭共享 | 否 |

### 审核备注（App Review Information）

无登录、无演示账号。联系 `lazywc@gmail.com`。电话你自己填。

```
Core metronome is free. Default counting voice is free. Haptic ticks on/off is free. Sound Workshop (studio.weichao.jpq.soundpack) is a non-consumable that unlocks extra samples plus downbeat-only / light-standard-heavy haptics. Restore is in Settings. There is no account, so purchases do not cross stores. No WeChat/Alipay QR codes in the app. iOS Firebase Analytics records in-app events (open, play, BPM, meter, mode). Advertising ID collection is off; we do not use the data for tracking or ads. iPhone only; portrait only. Silent switch and lock screen should still click — AVAudioSession is .playback with UIBackgroundModes audio.
```

### 你还得在本机做的

1. Apple Developer Program（年费 $99）+ Connect 建 App（N4.1）
2. 本机发行证书，Xcode Automatic Signing（不要把 Team / `Secrets.xcconfig` 推进 git）
3. 真机勾 N1.25–N1.30（静音键、锁屏、40/208、不插拍、未购童声、Sandbox 买/Restore）
4. Archive → 上传 → 内部 TestFlight → 过完真机再点提审（N4.7）

CI 打出来的 unsigned IPA **不能**传 Connect。

---

## Play Console 粘贴稿

默认商店语言 **English (United States)**，再加 **中文（简体）** 作为本地化。分类 **Music & Audio**。联系邮箱 `lazywc@gmail.com`。默认网站 `https://jpq.weichao.studio/en/`。不要再加日/韩/西等语种。网站根路径仍默认中文；这只改 Play 默认 URL。

### 名称（≤30）

| 语言 | 粘贴 | 字数 |
|---|---|---|
| English | Bunny Metronome | 15 |
| 中文（简体） | 小兔头节拍器 | 6 |

### 简短说明（≤80）

English（80）：

```
A metronome that counts out loud. Play, BPM, meter, and default voice stay free.
```

中文（38）：

```
会大声数拍的节拍器。播放、BPM、拍号、默认童声永久免费。无广告、不用注册。
```

### 完整说明

English：

```
Bunny Metronome counts the beat out loud. Open and play: default child voice (Ana), traditional strong/weak clicks, or a uniform click.

Always free: play/pause, BPM 40–208, time signatures including custom, and the default counting voice.

It keeps ticking on the lock screen. Pause from the notification. No ads, no account.

Sound Workshop is an optional one-time unlock on this store for extra clicks, voices, and finer haptic ticks. The haptic on/off switch stays free. Restore purchases after reinstall. The default voice stays free. Purchases do not transfer across App Store and Play because there is no account.
```

中文：

```
小兔头节拍器会大声数拍。打开就能练：童声（晓伊）、传统强弱 click、均匀 click。

永远免费：
- 播放 / 暂停
- BPM 40–208
- 拍号（含自定义）
- 默认童声数拍

锁屏时仍出声，通知栏可暂停。没有广告，不用注册。

可选一次买断「音色工坊」，解锁额外 click、数拍声线，以及只震强拍 / 轻标准重震感。震动开关本身免费。购买记在本平台商店账本里，换机请用「恢复购买」。默认童声不需要买。没有账号，因此 iOS 购买不会出现在 Android，反过来也不行。
```

文案写「在本平台一次买断」，不要写「买一次全平台」。

### 图形

| 资产 | 规格 | 仓库路径 |
|---|---|---|
| 高清图标 | 512×512 PNG（可带透明） | `docs/store/play-icon-512.png`（同源 `android/app/src/main/ic_launcher-playstore.png`） |
| 特色图片 | **正好** 1024×500，JPEG 或无透明 PNG | `docs/store/play-feature-graphic.png`（`python3 tools/gen-play-feature.py` 可重出） |
| 手机截图 | 至少 2 张，建议 4 张竖屏 1080×1920；JPEG/PNG 无透明 | OnePlus 8T 真机 1080×1920：见下 |
| 平板 / TV / Wear | 不要传 | 只竖屏手机，没做平板 |

已拍（传这三张，不要传 iOS 图）：

1. `docs/store/screenshots/android-practice.png` — 默认 120 BPM、4/4、童声、待开始
2. `docs/store/screenshots/android-playing.png` — 正在播放、暂停键
3. `docs/store/screenshots/android-settings.png` — 设置（音效 / 拍号）

`android-workshop.png` **不要上传**：旁路安装没有 Play Billing，工坊段写的是「只在 Google Play 安装的版本里」，没有 Restore。Restore 那张等内部测试轨装上 Play 包再拍。

### 应用内容 / 分级

- IARC 问卷：音乐 App；无暴力、色情、脏话、毒品、用户生成内容、位置共享。
- **有应用内购买**（非消耗型音色工坊）。
- 目标年龄勾 13+ / 成人即可。童声是数拍音色，不是儿童 App。**不要**勾 Designed for Families / 专为儿童设计（有 IAP 会加一堆政策）。
- 新闻 App：否。COVID：否。

### Data safety（点选项；粘贴稿，不是已提交，不要勾完成）

Android 2.1.7+：**无 Firebase Analytics**、无广告/归因 SDK、不发送开发者定义的产品分析事件；无账号、无崩溃上报 SDK。

音色工坊购买 / Restore 走 Google Play Billing。Billing SDK / Google Play 可能为交易、反欺诈、服务运行或诊断向 Google 处理必要数据。不要把 Billing 遥测写成 Firebase Analytics。付款界面由 Google Play 提供，不要勾成 App 直接收集信用卡/支付详情。

不要预先勾「完全不采集 / 不共享」。提交时依据实际 AAB、Play Billing SDK 官方 Data safety 指引和 Console 提示逐项确认。

默认 URL（English (United States)）：

- 网站：https://jpq.weichao.studio/en/
- 隐私政策：https://jpq.weichao.studio/en/privacy
- 支持：https://jpq.weichao.studio/en/support

中文本地化：https://jpq.weichao.studio/ 、https://jpq.weichao.studio/privacy 、https://jpq.weichao.studio/support

App 内链接仍随当前语言打开对应页面。

### IAP

SKU `studio.weichao.jpq.soundpack`，非消耗型，价格档对齐 ¥12 / $1.99。按钮价格以商店返回为准。必须有 Restore。卖数字内容前要先建付款资料（merchant / payments profile）。

### 审核备注（Play）

```
Core metronome is free. Default counting voice is free. Haptic ticks on/off is free. Sound Workshop (studio.weichao.jpq.soundpack) is a non-consumable that unlocks extra samples plus downbeat-only / light-standard-heavy haptics. Restore is in Settings. There is no account, so purchases do not cross stores. No WeChat/Alipay QR codes in the app. This Android build does not include Firebase Analytics or advertising / attribution SDKs. The app does not send developer-defined product analytics events. Sound Workshop / Restore use Google Play Billing; Google Play provides the payment UI. Purchases stay in the Google Play ledger.
```

### 上传

内部测试轨先于生产。传 `app-release.aab`，不要传 debug APK。本机：

```bash
export ANDROID_KEYSTORE_PATH=/absolute/path/to/release.jks
export ANDROID_STORE_PASSWORD=...
export ANDROID_KEY_ALIAS=...
export ANDROID_KEY_PASSWORD=...
cd android && ./gradlew :app:bundleRelease
```

产物：`android/app/build/outputs/bundle/release/app-release.aab`。密钥不进 git。
