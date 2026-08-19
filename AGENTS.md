# AGENTS.md

真相源。改产品规则先改这里，再改代码。`CLAUDE.md` 只是入口，不要在那边另写一套。

更长的说明：`docs/architecture.md`、`docs/engine-contract.md`、`docs/iap.md`、`docs/product-and-monetization.md`。

## 这是什么

小兔头节拍器 / Bunny Metronome。打开就能练的节拍器：童声数拍、传统强弱、均匀 click。品牌是马卡龙小兔头，中英都是一等公民。

线上 Web：https://jpq.weichao.studio  
仓库：https://github.com/toolazytoname/metronome  
联系：lazywc@gmail.com

## 免费边界（不要破）

永远免费，所有端：

- 播放 / 暂停
- BPM 40–208
- 拍号（含自定义）
- 传统 / 均匀 click
- **默认童声**（晓伊 / Ana）
- 中英界面

不做：广告、账号、订阅、付费墙挡播放。

即将上的 iOS / Android 可卖一次性「音色工坊」（SKU `studio.weichao.jpq.soundpack`，¥12 / $1.99），只解锁额外音色。默认童声保持免费。Web / 小程序 v1 不卖包，继续打赏。

## 端矩阵

| 端 | 路径 | 时钟 | 分发 |
|---|---|---|---|
| Web 中/英 | 仓库**根**（`index.html`、`en/`） | `js/engine.js` · Web Audio lookahead | Vercel · `jpq.weichao.studio` |
| 落地页 / 长尾 | `landing.html`、`p/`、`en/p/` | 不播，只带 `?bpm=&sig=&mode=` | 同上 |
| 微信小程序 | `miniapp/` | `setTimeout` 绝对时刻链 + InnerAudio | 微信搜索「小兔头节拍器」 |
| iOS | `ios/` | AVAudioEngine 预约 · session `.playback` | App Store |
| Android | `android/` | AudioTrack + 前台 Service | Play / 官网 APK |

**不要把 Web 搬到 `apps/web/`。** `sw.js`、hreflang、长尾 URL、Vercel 根发布都绑在仓库根上。

**不要写 CLOUD.md。** 没有后端、没有数据库、没有云函数。部署写 `DEPLOY.md`。

## 目录

```
index.html, landing.html, en/, p/   Web 静态站（留在根上）
js/engine.js                        Web 时钟
sw.js, manifest.json, vercel.json
assets/sounds/                      采样唯一来源（click + voice/zh|en）
images/                             小兔头、收款码、小程序码
miniapp/                            微信小程序
ios/  android/                      双原生（先 ios）
packages/strings/                   原生 UI 文案表
tools/gen-sounds.py                 生成 click + 数拍
docs/                               架构 / 契约 / IAP
AGENTS.md  CLAUDE.md
```

## 引擎不变量

状态（Web `localStorage.metronome`，小程序 `wx.setStorageSync('metronome')`）：

```json
{ "bpm": 120, "bc": 4, "bu": 4, "sm": "uniform", "vol": 85 }
```

- `bpm` 40–208；`bc` 1–16；`sm` 只能是 `traditional` | `uniform` | `voice`；`vol` 10–100
- 语言另存：小程序 `metronome_lang`；Web 靠 `/` vs `/en/`
- 改 BPM **不得插入额外一拍**，只改下一拍间隔
- Web 时钟：`js/engine.js`（`LOOKAHEAD_MS = 25`，`SCHEDULE_AHEAD = 0.1`）。小程序时钟：`miniapp/pages/index/index.js`。禁止 `setInterval` / `speechSynthesis` 当拍钟
- 童声：`assets/sounds/voice/{zh|en}/01.mp3`–`16.mp3`，和弱 click 叠在同一拍
- 采样失败时 Web 回退合成 click，不要让播放键假死

细节见 `docs/engine-contract.md`。

## 命令

```bash
# Web
python3 -m http.server 8000
# http://localhost:8000          中文
# http://localhost:8000/en/      英文

# 重新生成采样（需 ffmpeg + edge-tts），并同步到 miniapp
python3 tools/gen-sounds.py

# 小程序单测
cd miniapp && npm test

# 小程序：用微信开发者工具打开 miniapp/

# iOS 政策单测（不依赖 XCBuild）
cd ios && swift test

# iOS App（本机 XCBuild 若崩溃，见验证日志）
xcodebuild -project ios/BunnyMetronome.xcodeproj -scheme BunnyMetronome -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO build

# Android JVM 政策单测
cd android && gradle :policy:test

# Android APK（需要完整 Android SDK）
cd android && ./gradlew assembleDebug
```

## 禁止

- 给 Web 加框架、加构建步骤、加账号、加广告
- 用 `speechSynthesis` 或 `setInterval` 当 Web 拍钟
- iOS 音频会话不要走录音类别（会要麦克风，也搞乱静音键）；只允许 `.playback`
- 在 iOS / Play 包里放微信/支付宝收款码卖数字内容（Guideline 3.1.1）
- 把默认童声改成付费
- 做订阅、社交、录音上传、复节奏、谱面跟随
- 提交密钥、`.jks`、`Secrets.xcconfig`、Play 服务账号 JSON
- Android 在 iOS 功能说明书冻结前自行加功能
- 让文档和代码分叉（先改 `AGENTS.md`）

## IAP

- SKU：`studio.weichao.jpq.soundpack`（非消耗型）
- 权威在 StoreKit / Play 账本，不在 `UserDefaults`
- 必须有 Restore
- 两店购买不通（无账号）。文案不要承诺买一次全平台
- 详见 `docs/iap.md`

## 发布

- Web：推 `main` → Vercel。忽略 `miniapp/`、`ios/`、`android/`
- 小程序：开发者工具上传 → 微信公众平台审核
- iOS：TestFlight → App Store（先于 Android）
- 安全问题不要开公开 issue，邮件 lazywc@gmail.com

## 原生验收（目录就绪后）

- 40 / 120 / 208 BPM 各 60 秒不漂
- iOS：静音键开、锁屏、进其他 App 仍出声
- Android：锁屏通知可暂停；从最近任务划掉才停
- 未购：默认童声可播；点付费音色走系统购买
- 已购 + 删 App + Restore：包还在
