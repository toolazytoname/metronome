# AGENTS.md

真相源。改产品规则先改这里，再改代码。`CLAUDE.md` 只是入口，不要在那边另写一套。

更长的说明：`docs/architecture.md`、`docs/engine-contract.md`、`docs/iap.md`、`docs/product-and-monetization.md`。原生上架清单就在本文后半，不要另起一份和这里打架的 TODO。

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

iOS / Android 可卖一次性「音色工坊」（SKU `studio.weichao.jpq.soundpack`，¥12 / $1.99），解锁额外音色和震动拍选项。默认童声保持免费。震动开/关免费。Web / 小程序 v1 不卖包，继续打赏。

## 端矩阵

| 端 | 路径 | 时钟 | 分发 |
|---|---|---|---|
| Web 中/英 | 仓库**根**（`index.html`、`en/`） | `js/engine.js` · Web Audio lookahead | Vercel · `jpq.weichao.studio` |
| 落地页 / 长尾 | `landing.html`、`p/`、`en/p/` | 不播，只带 `?bpm=&sig=&mode=` | 同上 |
| 微信小程序 | `miniapp/` | `setTimeout` 绝对时刻链 + InnerAudio | 微信搜索「小兔头节拍器」 |
| iOS | `ios/` | AVAudioEngine 预约 · session `.playback` | App Store（先发） |
| Android | `android/` | AudioTrack + 前台 Service | Play 内测 + 官网 APK |

**不要把 Web 搬到 `apps/web/`。** `sw.js`、hreflang、长尾 URL、Vercel 根发布都绑在仓库根上。

**不要写 CLOUD.md。** 没有后端、没有数据库、没有云函数。部署写 `DEPLOY.md`。

## 目录

```
index.html, landing.html, en/, p/   Web 静态站（留在根上）
js/engine.js                        Web 时钟
sw.js, manifest.json, vercel.json
assets/sounds/                      采样唯一来源（click + voice/zh|en + pack/）
images/                             小兔头、收款码、小程序码
miniapp/                            微信小程序
ios/                                SwiftUI 参考实现（先上架）
android/                            按本文冻结说明书移植，不许加功能
packages/strings/                   原生 UI 文案表（中英一等公民）
tools/gen-sounds.py                 生成 click + 数拍，并同步各端
docs/                               架构 / 契约 / IAP
AGENTS.md  CLAUDE.md  DEPLOY.md
```

## 引擎不变量

状态（Web `localStorage.metronome`，小程序 `wx.setStorageSync('metronome')`，原生同字段）：

```json
{ "bpm": 120, "bc": 4, "bu": 4, "sm": "uniform", "vol": 85 }
```

- `bpm` 40–208；`bc` 1–16；`sm` 只能是 `traditional` | `uniform` | `voice`；`vol` 10–100
- 语言另存：小程序 `metronome_lang`；Web 靠 `/` vs `/en/`；原生 `lang` 在同一份偏好里
- 改 BPM **不得插入额外一拍**，只改下一拍间隔
- Web 时钟：`js/engine.js`（`LOOKAHEAD_MS = 25`，`SCHEDULE_AHEAD = 0.1`）。小程序时钟：`miniapp/pages/index/index.js`。禁止 `setInterval` / `speechSynthesis` 当拍钟
- 童声：`assets/sounds/voice/{zh|en}/01.mp3`–`16.mp3`，和弱 click 叠在同一拍（弱 click 增益 0.28）
- 采样失败时 Web 回退合成 click，不要让播放键假死。原生播放失败必须有可见错误，禁止按钮空转

细节见 `docs/engine-contract.md`。

## 命令

```bash
# Web
python3 -m http.server 8000
# http://localhost:8000          中文
# http://localhost:8000/en/      英文

# 重新生成采样（需 ffmpeg + edge-tts），并同步到 miniapp / ios / android
python3 tools/gen-sounds.py

# 小程序单测
cd miniapp && npm test

# 小程序：用微信开发者工具打开 miniapp/

# iOS 政策单测（不依赖 XCBuild）
cd ios && swift test

# iOS App（CI 保持 CODE_SIGNING_ALLOWED=NO；本机真机/TestFlight 用本地签名）
xcodebuild -project ios/BunnyMetronome.xcodeproj -scheme BunnyMetronome -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO build

# Android JVM 政策单测
cd android && ./gradlew :policy:test

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
- Android 在冻结说明书之外自行加功能
- 让文档和代码分叉（先改 `AGENTS.md`）
- 空 App Icon、系统播放三角当启动图标、写死 ¥12 的购买按钮、App 内收款码 —— 这些过不了审，不要送
- 原生 v1 加统计 SDK
- 为原生发明深色模式、iPad 专属布局、小组件、Watch、CarPlay
- 把无障碍打磨、1:1 复刻 Web、CI 原生单测当成上线阻断（那些是上线后）

## IAP

- SKU：`studio.weichao.jpq.soundpack`（非消耗型）
- 权威在 StoreKit / Play 账本，不在 `UserDefaults` / SharedPreferences
- 必须有 Restore
- 两店购买不通（无账号）。文案写「在本平台一次买断」，不要承诺买一次全平台
- 价格按钮必须显示商店返回的本地化价格；¥12 / $1.99 只是内部预期，不是 UI 文案
- 详见 `docs/iap.md`

## 发布

- Web：推 `main` → Vercel。忽略 `miniapp/`、`ios/`、`android/`
- 小程序：开发者工具上传 → 微信公众平台审核
- iOS：本机签名 → TestFlight → App Store（先于 Android）。打 `v*` tag 会在 GitHub Release 挂 **unsigned IPA**（CI `CODE_SIGNING_ALLOWED=NO`，不能装真机、不能传商店）。TestFlight 仍要本机发行证书。
- Android：打 `v*` tag → GitHub Actions 出 APK（Release 资产）。Play 内测仍要你在 Console 建应用；**Play 开发者账号一次性约 US$25，不是免费**。官网 APK 下载页仍是上线后。国内商店等软著。**不要**自动把 APK 传到 Play。
- 安全问题不要开公开 issue，邮件 lazywc@gmail.com

---

## 原生现状（2026-08-25）

源码 2026-08-19 进仓库。2026-08-25 做到**代码上线阻断齐、模拟器能练**。还差你本机签名、真机 60 秒、Connect / Play 账号。

已有：

- iOS：马卡龙练琴屏（bunny、大 BPM、豆子、珊瑚播放）、设置 sheet、AVAudioEngine、`.playback`、中断/路由、StoreKit 2 价/购买态/Restore、1024 图标、显示名「小兔头节拍器」、`PrivacyInfo.xcprivacy`、模拟器 iPhone 17 编过并截过图
- Android：Compose 练琴屏 + 设置（含数拍 bank、文案表、商店价、Restore、亮屏）、AudioTrack + 前台 Service + 音频焦点、自适应图标、`assembleDebug` 绿、`:policy:test` 绿
- 包名 `studio.weichao.jpq`；SKU `studio.weichao.jpq.soundpack`
- pack 57 条采样时长都压在 208 BPM 间隔内（click ≤90ms，数拍 ≤270ms）
- 中文商店截图草稿：`docs/store/screenshots/`

上线还缺（必须你来）：

- 本机 Team 签名 → TestFlight
- 真机 N1.25–N1.30 / N2.16
- App Store Connect 建 App + IAP；Play Console 内测
- 真机听一遍 pack 音色（自动闸门已过，主观好听与否你定）

---

## 上线是什么

「上线」= 用户能从商店装到、打开能练、审核能过。模拟器响一下不算。也不要求做成完美产品。

| 端 | 上线完成的定义 |
|---|---|
| iOS | App Store **Ready for Sale**（含音色工坊 IAP） |
| Android | Play **内部测试轨可装** + 同包名本地签名 APK 能装（生产轨紧随 iOS，不挡 iOS 先发） |
| Web / 小程序 | 已经在线上，本清单不重新定义 |

上线 **必须**（缺一条不准提审 / 不准点发布）：

1. 核心免费能练：播放暂停、BPM 40–208、拍号、三种模式、默认童声
2. 时钟：改 BPM 不插拍；40 / 120 / 208 各 60 秒听感不漂
3. 平台承诺：iOS 静音键 + 锁屏仍出声；Android 锁屏通知可暂停、划掉任务才停
4. IAP 合规：系统购买、Restore、账本权威、未购默认真声、点 pack 走商店、不写死价格、无收款码
5. 壳：1024 图标、显示名「小兔头节拍器」/ Bunny Metronome、不是调试页
6. 商店：隐私政策 URL、支持 URL、截图、IAP 商品已建、隐私营养 / Data safety、年龄 4+
7. 卖 pack 前：人耳听过，不好听就删槽位

上线 **不必须**（P5，上线后再做）：

- 练琴屏 1:1 复刻 Web、bunny 摆位、Launch 白闪
- VoiceOver / TalkBack 打磨、Dynamic Type、Reduce Motion
- 来电中断单测、CI 跑 `swift test` / `:policy:test`
- 国产 ROM 保活、官网 APK 下载页、落地页换成商店链接

Android 功能面仍只许抄冻结说明书，但 **视觉打磨不挡 Play 内测**。

---

## v1 原生说明书（冻结 · 2026-08-25）

Android **只许抄功能**，不许加。改清单先改本节。标了「上线后」的不做完也可以提审。

App 是练琴屏，不是落地页。颜色靠近 Web token，不要 1:1 搬 CSS。

### 屏幕

1. **练琴屏（上线必须）**
   - 能看清 BPM；有豆子或等价拍位；播放 / 暂停；BPM 滑块或 ±，范围 40–208，播放中可改、不插拍
   - 暖米 + 珊瑚即可；**小兔头摆上练琴屏 = 上线应当，不是阻断**（图标里有兔子就够过审）
   - **只竖屏**。横过来不转（iOS `UIInterfaceOrientationPortrait`，Android `screenOrientation=portrait`）。v1 不做横屏布局
2. **设置（上线必须）**
   - 音效：传统 / 均匀 / 童声
   - 拍号预设：4/4、3/4、2/4、6/8、5/4、7/8；自定义 `bc` 1–16（`bu` 可只随预设，自定义分母 = 上线应当）
   - 音量 10–100
   - 语言：中文 / English（切语言切 `voice/zh|en`）
   - 震动开关（免费）
   - 音色工坊：购买、Restore、已购选 click **和** 数拍，以及震动模式 / 震感
   - 设置里能点到隐私 / 支持链接 = 上线应当（商店 Connect 里的 URL 才是阻断）
   - 保持亮屏开关 = 上线应当（默认亮着也行）
3. **不做的屏**：账号、统计、主题、复节奏、谱面、社交、打赏码。

### 音色工坊

| 槽位 | 免费 | 包内（一次买断全开） |
|---|---|---|
| Click | `default`（`click-strong/weak/uniform`） | `click-stick`、`click-kick`、`click-tip` |
| 中文数拍 | 晓伊 `voice/zh` | `voice-zh-yunxi`、`voice-zh-soft` |
| 英文数拍 | Ana `voice/en` | `voice-en-deep` |
| 震动 | 开/关；每拍同一种短脉冲（`all` + `standard`） | 只震强拍（`downbeat`）；轻 / 标准 / 重（`light` / `standard` / `heavy`） |

上线必须：

- 未购点包内音色 → **系统购买页**
- 按钮价格来自商店；拿不到价就显示「解锁」，禁止写死 ¥12
- Restore 入口可见，恢复后问账本
- 买成后 click、数拍、震动模式 / 震感立刻可点
- 未解锁残留 pack bank → `resolveBank` 回默认
- 未解锁残留震动选项 → `resolveHapticPattern` / `resolveHapticFeel` 回 `all` / `standard`

上线应当：查询中 / 取消 / 失败有一句可见文案（失败至少 Toast / 设置里一行字）。  
上线后：银行人类名（上线可用内部 id，只要能点）。

### 偏好

```jsonc
{
  "bpm": 120, "bc": 4, "bu": 4, "sm": "uniform", "vol": 85,
  "lang": "zh", "haptic": false, "keepAwake": true,
  "clickBank": "default", "voiceBank": "default",
  "hapticPattern": "all", "hapticFeel": "standard"
}
```

非法值 clamp。未知 `sm` → `uniform`。解锁布尔不是这份 JSON 的权威。

### 音频 / 生命周期

上线必须：

- iOS：`AVAudioSession.category = .playback`；`UIBackgroundModes = audio`；不要麦克风
- Android：音频线程填 `AudioTrack`；前台 Service `mediaPlayback`；禁止 `Handler.postDelayed` 当拍钟
- `start()` 可重入，连点不开两个钟
- 采样失败：播放键不假死（可见错误或回退）

上线应当：来电中断后不双开；插拔耳机不断拍。  
上线后：音频焦点策略打磨。

### 文案

`packages/strings/{zh,en}.json` 是表。上线必须：播放 / 暂停 / 设置 / 解锁 / 恢复购买 / 三种模式，中英都能看懂。  
银行显示名、购买细分态 key = 上线应当（N0.4）。

### 品牌（上线必须）

- 显示名：中文「小兔头节拍器」，英文 `Bunny Metronome`
- 图标：`images/bunny.png` 出 1024，不要系统播放三角
- 浅色即可；不要送审白屏 + 系统蓝按钮的调试外观

### 无障碍

全部 **上线后**。不要挡 TestFlight / 提审。

---

## 上线目标（勾完才能提审）

### iOS → App Store

- [ ] 真机静音键开、锁屏、进其他 App，120 BPM 至少 60 秒仍出声
- [ ] 40 / 120 / 208 各 60 秒不加速、不拖；播放中改 BPM 不插拍
- [ ] 未购默认童声可播；点付费走系统购买；Restore 能找回
- [x] 1024 图标 + 显示名；设置里有 Restore（模拟器核验）
- [ ] Connect：IAP 商品、隐私营养、隐私/支持 URL、截图、年龄 4+（文案已写，账号未建）
- [x] `PrivacyInfo.xcprivacy`；不声明麦克风；出口合规 NO
- [ ] 内部 TestFlight 过完真机清单再提审
- [ ] 审核通过且 Ready for Sale

### Android → Play 内测（生产不挡 iOS）

- [ ] 锁屏通知可暂停；划掉任务即停，无幽灵 WakeLock
- [ ] 同样 40 / 120 / 208 × 60 秒、不插拍、未购童声、Restore
- [x] 解锁后 click **和** 数拍都能选；sideload **不**送包（代码侧）
- [x] 自适应图标，不是系统播放三角
- [ ] Play 内部测试轨能装；IAP 商品 + Data safety 已填
- [ ] 本地 keystore 能签同包名 APK（密钥不进 git）

### 卖 IAP 的共同阻断

- [ ] pack 人耳过审；不好听就删槽位并改说明书
- [ ] 商店文案不写「买一次全平台」
- [ ] 截图至少：默认练琴、播放中、设置含 Restore / 工坊（中文先，英文应当）

### 明确不做（上线范围外）

小组件、Watch、CarPlay、iPad 专属、Live Activity、Android Auto、华为/小米商店、软著、KMP、云同步、账号、统计、深色模式、自定义导入采样、复节奏、官网 APK 下载页、落地页商店徽章（没有链接先别改口）。

---

## 待办

状态：`- [ ]` 未做 · `- [x]` 做完必须改本节。  
每条标 **阻断** / **应当** / **上线后**。没勾完所有 **阻断** 不准提审。编号沿用，不要为了加功能新开号。

### P0 · 文档

- [x] N0.1 冻结说明书和目标（2026-08-25；同日改为上线标准） **阻断**
- [x] N0.2 `docs/architecture.md` 建设顺序对齐 **阻断**
- [x] N0.3 README / DEPLOY 去掉「建设中」 **阻断**
- [x] N0.4 文案表补银行名和购买态 key **应当**
- [x] N0.5 `docs/store/README.md` 补中英短描述、关键词、截图尺寸、审核备注 **阻断**（提审当天要能贴）
- [x] N0.6 `gen-sounds.py` / `sync-sounds.sh` 同步 ios + android（miniapp 不要 `pack/`） **应当**

### P1 · iOS（先做完阻断，再 TestFlight）

壳

- [x] N1.1 App Icon 1024 填进 `AppIcon.appiconset` **阻断**
- [x] N1.2 显示名：小兔头节拍器 / Bunny Metronome **阻断**
- [x] N1.3 Launch 暖米 **上线后**
- [x] N1.4 Accent / 背景贴近珊瑚暖米 **应当**

练琴屏

- [x] N1.5 练琴屏：大 BPM、豆子、± / 滑块、播放按钮，能练 **阻断**（模拟器 2026-08-25 iPhone 17）
- [x] N1.6 播放中按钮变暂停；停止豆子灭 **阻断**
- [ ] N1.7 Dynamic Type **上线后**
- [x] N1.8 VoiceOver 标签（播放/BPM/设置） **上线后**
- [ ] N1.9 Reduce Motion **上线后**

设置与 IAP

- [x] N1.10 设置：模式、拍号预设、自定义 bc、音量、语言、震动、工坊、Restore **阻断**（bu / 亮屏 / 隐私链也做了）
- [x] N1.11 已购可切 click、数拍、震动模式/震感，能回到 default **阻断**（人类名已接文案表）
- [x] N1.12 未购点 pack → `purchase()` **阻断**
- [x] N1.13 按钮用 `Product.displayPrice`；无商品禁用 **阻断**
- [x] N1.14 失败 / 取消至少一行可见字；购买中不要连点 **阻断**
- [x] N1.15 Restore：`AppStore.sync()` 后再读 entitlements **阻断**

音频

- [x] N1.16 `.playback` + `UIBackgroundModes = audio` 保持 **阻断**
- [x] N1.17 来电中断 / 耳机路由 **应当**
- [x] N1.18 `start()` 可重入；load 失败不假死 **阻断**
- [x] N1.19 失败路径不申请麦克风、不用 `playAndRecord` **阻断**

合规 / 工程

- [x] N1.20 `PrivacyInfo.xcprivacy` 无跟踪无麦克风 **阻断**
- [x] N1.21 `ITSAppUsesNonExemptEncryption` **阻断**
- [x] N1.22 仓库侧：CI `CODE_SIGNING_ALLOWED=NO`；`Secrets.xcconfig` gitignore。本机 Team 仍需你开 **阻断**
- [x] N1.23 `swift test` 14 项绿（2026-08-25，含震动 gating） **应当**
- [ ] N1.24 中断/可重入单测 **上线后**

真机（记设备与日期）

- [ ] N1.25 静音键开，60s @ 120 **阻断**
- [ ] N1.26 锁屏 + 切 App，60s @ 120 **阻断**
- [ ] N1.27 40 与 208 各 60s **阻断**
- [ ] N1.28 播放中拖 BPM 不插拍 **阻断**
- [ ] N1.29 未购童声；点 pack 出系统购买 **阻断**
- [ ] N1.30 Sandbox 买 → 删 App → Restore **阻断**
- [ ] N1.31 来电回来不双开 **应当**

### P2 · Android（iOS 阻断功能面定了再抄；视觉不挡内测）

- [x] N2.1 一页练琴 + 设置，能改 BPM / 模式 / 拍号 **阻断**
- [x] N2.2 自定义 bu、亮屏开关、应用内隐私链 **应当**
- [x] N2.3 解锁后列出 pack **数拍** bank，以及震动模式 / 震感 **阻断**
- [x] N2.4 UI 走 `packages/strings`，切语言改界面 **应当**
- [x] N2.5 未购点 pack → Play 购买流 **阻断**
- [x] N2.6 解锁按钮显示商店价 **阻断**
- [x] N2.7 Restore + 失败可见；`acknowledgePurchase` **阻断**
- [x] N2.8 自适应图标，去掉启动器用 `ic_media_play` **阻断**
- [x] N2.9 通知：Pause 真停、点回 App、标题走文案表 **阻断**
- [x] N2.10 停播 / destroy / 划掉任务释放 WakeLock **阻断**
- [x] N2.11 `start()` 可重入；解码失败不假死 **阻断**
- [x] N2.12 音频焦点 **应当**
- [x] N2.13 权限只有通知（33+）、震动、前台媒体 **阻断**
- [x] N2.14 同包名 APK 不送包后门 **阻断**
- [x] N2.15 `:policy:test` 绿（2026-08-25） **应当**
- [ ] N2.16 真机：通知暂停、划掉即停、40/120/208、未购/Restore **阻断**
- [ ] N2.17 国产 ROM 保活 **上线后**

### P3 · 采样（卖 IAP 才阻断）

- [x] N3.1 pack 57 条时长闸门通过（click ≤90ms，数拍 ≤270ms，无空文件）。主观好听仍建议你听一遍，不好听再删槽 **阻断**
- [x] N3.2 `sync-sounds.sh` 同步 ios + android；miniapp 不带 `pack/` **应当**
- [x] N3.3 未改默认晓伊 / Ana **阻断**

### P4 · 商店提交（功能阻断勾完再填）

iOS

- [ ] N4.1 App Store Connect 建 App，Bundle ID `studio.weichao.jpq` **阻断**
- [ ] N4.2 建 IAP `studio.weichao.jpq.soundpack` 非消耗型 **阻断**
- [ ] N4.3 隐私营养：无账户无跟踪 **阻断**
- [ ] N4.4 隐私 / 支持 URL 指现网 **阻断**
- [x] N4.5 中文模拟器截图在 `docs/store/screenshots/`（默认 / 播放 / 设置）。提审前按 Connect 强制尺寸再出签名套 **阻断**
- [x] N4.6 审核备注写在 `docs/store/README.md` **阻断**
- [ ] N4.7 内部 TestFlight → 提审 → Ready for Sale **阻断**
- [x] N4.8 `DEPLOY.md` 补 TestFlight / 提审步骤（不含证书） **应当**

Android

- [ ] N4.9 Play Console 建应用 **阻断**（相对 Android 上线）
- [ ] N4.10 同一 SKU；Data safety 无收集 **阻断**
- [ ] N4.11 内部测试轨先于生产 **阻断**
- [x] N4.12 商店文案中英已写在 `docs/store/README.md`；Android 真机截图未拍 **阻断**
- [x] N4.13 国内商店 / 软著 **不做**
- [ ] N4.14 生产轨上架 **应当**（iOS Ready for Sale 之后）

（原 N5.* 商店项并入本段，编号改成 N4，避免和「上线后 CI」抢 P5。旧 N4 CI 全部改为上线后 N5。）

### P5 · 上线后（不挡第一版）

- [x] N5.1 CI 跑 `cd ios && swift test`
- [x] N5.2 CI 跑 `cd android && ./gradlew :policy:test`
- [x] N5.3 CI 继续禁止 speechSynthesis /「无内购」/ 录音类别 / 缺隐私页
- [x] N5.4 无签名 `xcodebuild` 在 `Native packages` workflow（iphoneos `CODE_SIGNING_ALLOWED=NO`）**应当**
- [x] N5.5 gitignore 已排除 `local.properties`、`.jks`、`Secrets.xcconfig`、Play JSON
- [x] N5.6 打 `v*` tag → GitHub Release：Android APK + iOS unsigned IPA。keystore secrets 才签 Android release。不传 App Store / Play **应当**
- [x] N5.6 练琴屏有 bunny / 豆子 / 珊瑚（iOS 模拟器核验）
- [ ] N5.7 无障碍（VoiceOver / TalkBack / Dynamic Type / Reduce Motion）
- [ ] N5.8 来电 / 焦点 / 国产 ROM
- [ ] N5.9 生产 IAP 真钱走通后再把落地页「即将上」改成商店链接
- [ ] N5.10 `privacy.html` 现时态
- [ ] N5.11 官网 APK 下载页（有签名包再挂）

---

## 干活时的顺序（Agent 必守）

1. 改规则先改本文，再改代码。
2. 只做 **阻断** 也能提审；**应当** 顺手做；**上线后** 不要插队挡 TestFlight。
3. 原生先 iOS 阻断（P1 + P3 + P4.1–P4.7），Android 抄功能阻断（P2 + P4.9–P4.12）。
4. iOS 真机 N1.25–N1.30 没勾，不准提审。
5. 发现说明书不够：改本节，不要在 Android 加功能。
6. 政策单测（clamp、bank 门闩、不插拍、0.28 增益）改钟时要绿；不要为上线新写一堆测试当阻断。
7. 密钥不进 git。图标 1024 和采样可以进仓库。
