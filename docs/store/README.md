# Store listing draft

Bundle / application id: `studio.weichao.jpq`  
Name: 小兔头节拍器 / Bunny Metronome  
SKU: `studio.weichao.jpq.soundpack` (non-consumable, ¥12 / $1.99)  
Version: `2.1.2` (build 4). iPhone only — do not upload iPad screenshots.

提审当天把本节贴进 App Store Connect / Play Console。代码待办在 [AGENTS.md](../../AGENTS.md) P4。

提审容易漏（不是文案）：

- Connect 先签付费应用协议 + 税务 / 银行，否则 IAP 建不了。
- 第一个非消耗型 IAP 必须跟这一版 App **一起**送审。
- 个人 Play 账号上**生产轨**要 12 名测试者连续 14 天封闭测试；内部测试轨不挡。
- 商店链接在 Ready for Sale 之前不要改落地页徽章（N5.9）。

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

From a signed simulator or device, 6.7" (and whatever size Connect currently requires). Drafts from iPhone 17 sim (2026-08-25):

1. `docs/store/screenshots/ios-practice.png` — default 120 BPM
2. `docs/store/screenshots/ios-playing.png` — playing, a bean lit, 暂停
3. `docs/store/screenshots/ios-settings.png` — 设置（拍号 / 模式 / 音量）
4. `docs/store/screenshots/ios-workshop.png` — 音色工坊（震动选项 + 解锁 + Restore）

English shots are should-have, same three frames.

## Privacy / Data safety

No account. Local preferences stay on device. Optional IAP recorded by Apple / Google.

Analytics (not tracking): Firebase Analytics for in-app events (open, play, BPM, meter, mode, settings). App-instance ID only — advertising ID collection off. Data is sent to Google to measure usage. No name, email, or audio.

App Store privacy nutrition:
- Data types: Product Interaction, Device ID (app instance, not IDFA)
- Linked to identity: No
- Used for tracking: No
- Third-party advertising: No

Play Data safety:
- Collected: App activity (in-app actions), App info and performance / Device or other IDs (Firebase instance ID)
- Shared: Yes — with Google (Firebase)
- Encrypted in transit: Yes
- Users can request deletion: No (anonymous instance; uninstall stops new events)
- Optional: No (collected when the app runs)

Contact lazywc@gmail.com.

Privacy URL: https://jpq.weichao.studio/privacy  
Support URL: https://jpq.weichao.studio/support  
EN: `/en/privacy`, `/en/support`

## Review notes (paste)

Core metronome is free. Default counting voice is free. Haptic ticks on/off is free. Sound Workshop (`studio.weichao.jpq.soundpack`) is a non-consumable that unlocks extra samples plus downbeat-only / light-standard-heavy haptics. Restore is in Settings. There is no account, so purchases do not cross stores. No WeChat/Alipay QR codes in the app. Firebase Analytics records in-app events (open, play, BPM, meter, mode). Advertising ID collection is off; we do not use the data for tracking or ads.

## Age

4+
