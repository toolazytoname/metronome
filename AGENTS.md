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

iOS / Google Play 包可卖一次性「音色工坊」（SKU `studio.weichao.jpq.soundpack`，¥12 / $1.99），解锁额外音色和震动拍选项。默认童声保持免费。震动开/关免费。Web / 小程序 / 国内安卓市场包**不卖包**：全功能免费 + 打赏入口（见 P6）。

## 小程序支持页入口

- 当前小程序为个人主体；支持区只提供「复制网站链接」，由用户自行打开 Safari 或其他浏览器粘贴访问。
- 不使用 `web-view` 承载支持页，不把复制操作写成「在浏览器中打开」；request 合法域名不等于业务域名权限。
- 中文复制 `https://jpq.weichao.studio/about#donate`，英文复制 `https://jpq.weichao.studio/about/en#donate`；复制成功和失败均提供对应语言的可见提示。

## 端矩阵

| 端 | 路径 | 时钟 | 分发 |
|---|---|---|---|
| Web 中/英 | 仓库**根**（`index.html`、`en/`） | `js/engine.js` · Web Audio lookahead | Vercel · `jpq.weichao.studio` |
| 落地页 / 长尾 | `landing.html`、`p/`、`en/p/` | 不播，只带 `?bpm=&sig=&mode=` | 同上 |
| 微信小程序 | `miniapp/` | `setTimeout` 绝对时刻链 + InnerAudio | 微信搜索「小兔头节拍器」 |
| iOS | `ios/` | AVAudioEngine 预约 · session `.playback` | App Store（先发） |
| Android | `android/` | AudioTrack + 前台 Service | Play 内测 + 国内市场（P6，首批华为/小米）+ 官网 APK |
| 鸿蒙 | `harmony/`（2026-09-30 立项；2026-10-01 ArkTS 工程落地，cn 变体：免费+打赏无 IAP，待 DevEco 编译+真机） | worker 线程 `AudioRenderer` 阻塞写 + 绝对帧预约（`entry/src/main/ets/engine/ClockWorker.ets`），采样为 rawfile WAV（`harmony/sync-sounds.sh`） | 华为 AppGallery（P6 跟进；包名 `studio.weichao.jpq.hmos`） |

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
- 语言另存：小程序 `metronome_lang`；Web 靠 `/` vs `/en/`；原生 `lang` 在同一份偏好里。小程序 / iOS / Android 首次启动均跟随系统首选语言：中文语言环境用 `zh`，其他语言环境用 `en`；用户手动切换后以已保存选择为准
- 改 BPM **不得插入额外一拍**，只改下一拍间隔
- Web 时钟：`js/engine.js`（`LOOKAHEAD_MS = 25`，`SCHEDULE_AHEAD = 0.1`）。小程序时钟：`miniapp/pages/index/index.js`。禁止 `setInterval` / `speechSynthesis` 当拍钟
- 小程序若一次回调已落后超过一个间隔：**最多发当前这一拍**，然后把下一拍时刻拨到 `now + interval`，**丢弃过期拍、不 delay=0 追赶连发**
- Web 调度器（`js/engine.js`）若 `nextNoteTime` 已落后超过一个间隔：把下一拍拨到 `currentTime` 再按 lookahead 预约，**丢弃过期拍、禁止把积压节拍一次补发完**。改 BPM 仍只改下一拍间隔，不插拍。原生仍走音频时间线预约；iOS 主队列阻塞恢复按下方可靠性补充执行
- BPM 入口只接受完整有限整数（整个字符串都是十进制数字）；非法/空/NaN **忽略**，不写进 data 或时钟
- 小程序自定义拍号：输入框是草稿。未点「应用」不得改拍钟、拍点或存储。应用 / 预设 / 读盘走同一套规范化（完整整数，`bc`/`bu` 1–16）
- Web 首次采样加载必须有截止时间；失败回退合成 click，启动异常要有可见错误和重试，禁止过期的 `start()` 在暂停后继续出声或申请亮屏
- 童声：`assets/sounds/voice/{zh|en}/01.mp3`–`16.mp3`，和弱 click 叠在同一拍（弱 click 增益 0.28）
- 小程序 voice 与弱 click **都就绪才同拍触发**；未就绪的当前拍不排队补发。stop / onHide / onUnload / 切语言或模式必须作废进行中的加载回调，禁止迟到出声。池内每个 InnerAudio 自己的就绪态，不能「池里任意一个 canplay 就算整池就绪」。播放键不得假装在响：加载中或失败要有可见提示，恢复后可再点
- 采样失败时 Web 回退合成 click，不要让播放键假死。原生播放失败必须有可见错误，禁止按钮空转

### Web 故障恢复与诊断（2026-10-02）

- 练琴页显示 Web 发布号，提供中英「诊断与恢复」入口；不依赖隐藏手势。
- 播放中音频中断、时钟停滞或调度异常必须停止并释放亮屏，显示错误。重试重建音频上下文；手动重置只停止，不自动播放、不清除偏好。
- 诊断只在本机保留最近 80 条白名单事件（最多 24 小时）；不自动上传，不记录完整 URL / 查询参数 / referrer / 原始异常消息或堆栈 / 用户标识。仅记录版本、浏览器大版本/系统类别、播放参数、音频状态、页面可见性和固定错误码。
- 用户可查看、主动复制、清除诊断；剪贴板不可用时保留可手动复制的文本。刷新前先复制；页面完全失去响应时仍需浏览器刷新，不能承诺 JS 自救。
- 诊断脚本先于核心脚本加载；所有本地 JS 使用内容 SHA-256 前 12 位 URL，与 SW 预缓存一致。采样加载、诊断和第三方统计失败不得阻塞播放/暂停。

### 可靠性补充（2026-10-02 深度检查）

- Web 的 URL、控件与引擎 BPM 入口统一拒绝空值、布尔值、小数、科学计数法、十六进制和非有限数；合法整数字符串才可 clamp。自定义拍号非法草稿不应用。
- Web 音频恢复也必须有截止时间并可重试；重载采样后，旧请求/旧解码结果不得覆盖新一轮采样或就绪态。
- Web 练琴屏沿用现有品牌；320×568 视口下默认 4/4 的播放按钮应完整出现在首屏。拍点最多四个一行，末行居中，多拍号允许纵向滚动，不挤成八列小点。
- Web 本地脚本的 URL 使用内容 SHA-256 前 12 位作为 `?v=`；中英 HTML 与 `sw.js` 预缓存必须一致；练琴 HTML 每次联网访问须重新验证，避免发布后浏览器继续使用五分钟旧页。脚本改动时同步版本 URL 与 SW cache 版本，避免新 HTML 混用旧 JS；仍为根目录静态文件，不引入构建步骤。
- Android / 鸿蒙必须等齐 **35 个免费采样**（3 个 click + 中英各 16 个数拍），才算可播。后台加载失败可重试，不能只凭 click 齐全让默认童声空转。
- Android / 鸿蒙音频每次播放拥有独立生命周期；暂停后旧线程/异步任务不得在新一轮播放中复活。音频设备创建、启动或写入失败须停止并释放资源、亮屏/后台保活，提供可见错误。部分写入只推进实际写入帧，零/负写入不得忙循环。
- iOS 仍用音频时间线预约；主队列长时间阻塞后丢弃已过期节拍，不把积压拍一次补播。正常播放与改 BPM 的下一拍语义不变。

细节见 `docs/engine-contract.md`。

## 命令

```bash
# 可选本地全栈回归（不是 Web 构建步骤；需先 cd miniapp && npm ci）
./scripts/check-quality.sh

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
cd android && ./gradlew assemblePlayDebug   # Play 变体
# cn 变体（国内/官网分发）：./gradlew assembleCnDebug / assembleCnRelease

# Play 上传用 AAB（本机 keystore，密钥不进 git）
# ANDROID_KEYSTORE_PATH=... ANDROID_STORE_PASSWORD=... ANDROID_KEY_ALIAS=... ANDROID_KEY_PASSWORD=...
# cd android && ./gradlew :app:bundlePlayRelease
```

## 禁止

- 给 Web 加框架、加构建步骤、加账号、加广告
- 用 `speechSynthesis` 或 `setInterval` 当 Web 拍钟
- iOS 音频会话不要走录音类别（会要麦克风，也搞乱静音键）；只允许 `.playback`
- 在 iOS / Play 包里放微信/支付宝收款码卖数字内容（Guideline 3.1.1）。收款码打赏只允许出现在 Web / 小程序 / 国内安卓市场包（P6），且不解锁任何功能
- 把默认童声改成付费
- 做订阅、社交、录音上传、复节奏、谱面跟随
- 提交密钥、`.jks`、`Secrets.xcconfig`、Play 服务账号 JSON
- Android 在冻结说明书之外自行加功能
- 让文档和代码分叉（先改 `AGENTS.md`）
- 空 App Icon、系统播放三角当启动图标、写死 ¥12 的购买按钮、iOS / Play 包内收款码 —— 这些过不了审，不要送
- 原生接广告 / 归因 SDK，打开 IDFA / OAID / ATT。**Android 不接 Firebase Analytics / 归因 SDK**，也不要放 `google-services.json`。iOS 暂时仍可保留 Firebase Analytics：只做产品内事件，广告标识关掉，不弹 ATT
- 为原生发明深色模式、小组件、Watch、CarPlay（iPad 自适应布局不算「发明」，是审核必须，见屏幕节）
- 把无障碍打磨、1:1 复刻 Web、CI 原生单测当成上线阻断（那些是上线后）

## IAP

- SKU：`studio.weichao.jpq.soundpack`（非消耗型）
- 权威在 StoreKit / Play 账本，不在 `UserDefaults` / SharedPreferences
- 必须有 Restore
- 两店购买不通（无账号）。文案写「在本平台一次买断」，不要承诺买一次全平台
- 价格按钮必须显示商店返回的本地化价格；¥12 / $1.99 只是内部预期，不是 UI 文案
- 详见 `docs/iap.md`

## 发布

- 开发提交走 `develop`，见「提交与推送节奏」。不要把日常修复直接推 `main`。
- Web：推 `main` → Vercel。忽略 `miniapp/`、`ios/`、`android/`
- 小程序：开发者工具上传 → 微信公众平台审核
- iOS：本机签名 → TestFlight → App Store（先于 Android）。打 `v*` tag 会在 GitHub Release 挂 **unsigned IPA**（CI `CODE_SIGNING_ALLOWED=NO`，不能装真机、不能传商店）。TestFlight 仍要本机发行证书。
- Android：打 `v*` tag → GitHub Actions 出 APK（Release 资产；有 keystore 再出签过名的 AAB）。Play 内测仍要你在 Console 建应用；**Play 开发者账号一次性约 US$25，不是免费**。新应用必须 `targetSdk` 36，上传 **AAB 不是 APK**。官网 APK 下载页见 P6 下载分发节。国内安卓市场走 P6（APP 备案 + 逐家资质，首批华为/小米），**不要**自动把包传到 Play 或国内市场。
- 安全问题不要开公开 issue，邮件 lazywc@gmail.com

---

## 原生现状（2026-08-26）

源码 2026-08-19 进仓库。2026-08-25 代码上线阻断齐、模拟器能练。2026-08-26 真机：iPhone 11（UDID `00008030-0001252111FA802E`）+ OnePlus 8T（`5c9a424d`）。GitHub `v2.1.1` Native packages 绿。

已有：

- iOS：马卡龙练琴屏、设置 sheet、AVAudioEngine、`.playback`、中断/路由、StoreKit 2、1024 图标（兔子铺满、无浅色圆垫）、显示名、「只竖屏」、`PrivacyInfo.xcprivacy`
- iOS 真机曾无声：`scheduleBuffer` 误用 render time，已改 `playerTime(forNodeTime:)`；Development 签名能装
- Android：Compose 练琴屏 + 设置、AudioTrack + 前台 Service、自适应图标、`screenOrientation=portrait`、旁路装不送包、`:policy:test` 绿
- 包名 `studio.weichao.jpq`；SKU `studio.weichao.jpq.soundpack`
- pack 57 条时长闸门通过；中文截图草稿 `docs/store/screenshots/`
- 打 `v*` → GitHub Release（Android debug APK + iOS **unsigned** IPA）。不传商店

上线还缺（必须你来）：

- 本机 **发行证书** → TestFlight（Development 只能装你的机）
- 真机勾 N1.25–N1.30 / N2.16（静音键、锁屏、40/208、Sandbox 买/Restore）
- App Store Connect 建 App + IAP；Play Console 内测 + 本地 keystore
- pack 人耳听一遍

分析：Web 友盟 + GA4；小程序 `umtrack-wx`。**Android 2.1.7+ 无 Firebase Analytics、无广告/归因 SDK、不发送开发者定义的产品分析事件**，也不要 `google-services.json`。音色工坊购买 / Restore 走 Google Play Billing；Billing SDK / Google Play 可能为交易、反欺诈、服务运行或诊断向 Google 处理必要数据。不要把 Billing 遥测说成 Firebase Analytics。Play Data safety **提交时依据实际 AAB、Play Billing SDK 官方 Data safety 指引和 Console 提示逐项确认**，不要预先武断写「完全不采集/不共享」。付款界面由 Google Play 提供，不要把信用卡/支付详情说成 App 直接收集。**尚未在 Play Console 提交的 Data safety 不要勾成已完成。** iOS 暂时保持 Firebase Analytics（产品内事件：打开、播放、BPM、模式、拍号、设置）；关掉广告标识，`NSPrivacyTracking = false`，不弹 ATT。iOS `GoogleService-Info.plist` 可进仓库；不要为 Android 加 Google Services。Play 服务账号 JSON 仍不进 git。

提审前容易漏（不是新功能）：

- iOS 工程是**通用 App**（`TARGETED_DEVICE_FAMILY = "1,2"`，2026-09-22 Guideline 4 拒审后从「只发 iPhone」转向）：Connect 提审要 iPad 13" 截图 + iPhone 6.9" 截图两套
- Connect 付费协议 + 税务银行；个人 Play 账号上生产轨要 12 人 × 14 天封闭测试
- 第一个 IAP 必须跟一版 App 一起送审
- 截图按 Connect 强制尺寸重出（草稿是模拟器）
- 落地页商店徽章等 Ready for Sale 再挂（N5.9）

---

## 上线是什么

「上线」= 用户能从商店装到、打开能练、审核能过。模拟器响一下不算。也不要求做成完美产品。

| 端 | 上线完成的定义 |
|---|---|
| iOS | App Store **Ready for Sale**（含音色工坊 IAP） |
| Android | Play **内部测试轨可装** + 同包名本地签名 APK 能装（生产轨紧随 iOS，不挡 iOS 先发） |
| 国内安卓市场 | 华为能搜到、能装、打开能练；小米暂缓（个人注册通道关闭，见 P6） |
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
- 国产 ROM 保活、落地页换成商店链接

Android 功能面仍只许抄冻结说明书，但 **视觉打磨不挡 Play 内测**。

---

## v1 原生说明书（冻结 · 2026-08-25）

Android **只许抄功能**，不许加。改清单先改本节。标了「上线后」的不做完也可以提审。

App 是练琴屏，不是落地页。颜色靠近 Web token，不要 1:1 搬 CSS。

### 屏幕

1. **练琴屏（上线必须）**
   - 能看清 BPM；有豆子或等价拍位；播放 / 暂停；BPM 滑块或 ±，范围 40–208，播放中可改、不插拍
   - 拍点最多 4 个一行；**空位不占位**；每行可见拍点水平居中。格子边长按四列宽度算，不要用「含空列的宽高比」把多行整组挤窄
   - BPM / 音量滑块：触摸映射按圆钮行程（轨道宽 − 圆钮宽），与绘制位置一致
   - ± 和自定义拍数步进到边界时视觉禁用，不要还能按、数值却不变
   - 采样/播放失败必须在练琴屏显示错误；旁加载没有商店也不能把这条滤掉
   - 暖米 + 珊瑚即可；**小兔头摆上练琴屏 = 上线应当，不是阻断**（图标里有兔子就够过审）
   - **只竖屏**。横过来不转（iOS `UIInterfaceOrientationPortrait` + `UIRequiresFullScreen`，Android `screenOrientation=portrait`）。v1 不做横屏布局
   - **iPhone + iPad 通用 App**（`TARGETED_DEVICE_FAMILY = "1,2"`）。2026-09-22 起 iPad 兼容是审核必须。**regular 宽度**：满高双栏（练琴舞台竖直铺满 + 通高 inspector）。练琴面：大 BPM → 拍点 → 滑块/播放 → 底栏音效/拍号胶囊。Inspector：解锁/Restore 吸顶常显，工坊 Click|Voice 双列 + 震动选项可滚到底；齿轮可收起专注练琴。compact（iPhone）仍竖向堆叠 + 底栏 sheet。**regular 宽度自适应**（2026-09-24 Guideline 4 拒审后立）：窗口宽度 ≥900pt（iPad Pro 13" 竖屏 1032pt）用满高双栏；<900pt 的 regular（iPad Air 11" 竖屏约 820pt）双栏放不下，改练琴舞台在上 + 通宽 inspector 在下的纵向滚动堆叠，禁用固定 408pt 侧栏挤压左栏。禁止控件截断、禁止大屏留空却展示不全
2. **设置（上线必须）**
   - 音效：传统 / 均匀 / 童声
   - 拍号预设：4/4、3/4、2/4、6/8、5/4、7/8；自定义 `bc` 1–16（`bu` 可只随预设，自定义分母 = 上线应当）
   - 音量 10–100
   - 语言：中文 / English（切语言切 `voice/zh|en`）
   - 震动开关（免费）
   - 音色工坊：购买、Restore、已购选 click **和** 数拍，以及震动模式 / 震感
   - 商店价拿不到时，解锁按钮禁用且旁边有一句原因（查询中 / 不可用），不要只留一个灰掉的「解锁」
   - Restore 和购买反馈放在购买按钮附近，不要沉在音色列表下面
   - 设置里能点到隐私 / 支持链接 = 上线应当（商店 Connect 里的 URL 才是阻断）
   - 保持亮屏开关 = 上线应当（默认亮着也行）
   - Android 设置页最底部显示动态版本号，次要淡色，不进练琴屏：中文「版本 2.1.7」、英文「Version 2.1.7」这种格式；数字必须来自 `BuildConfig.VERSION_NAME`，禁止写死。文案前缀走 `packages/strings` 的 `app_version`
3. **不做的屏**：账号、主题、复节奏、谱面、社交。打赏码：iOS / Play 包不做（3.1.1）；国内安卓包按 P6 设打赏入口（纯自愿，不解锁任何功能）。

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
- **无震动硬件的设备（iPad）不渲染震动选项**（含免费开关与付费模式/震感——是「不渲染」，不是置灰），显示一句「此设备没有震动马达」；付费价值不得在无效果设备上展示，**含工坊介绍文案**（总介绍只说音色，震动卖点只在支持震动的设备随震动段出现）（2026-09-22 立，同日 iOS 补齐免费开关不渲染与文案门控）

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

非法值 clamp。未知 `sm` → `uniform`。解锁布尔不是这份 JSON 的权威。未知/失败的商店查询不得把 resolve 后的 default 写回 clickBank/voiceBank/haptic*；播放时仍 resolve 门控。只有权威成功账本（含 OK 空列表撤销）才持久化归默认。

### 音频 / 生命周期

上线必须：

- iOS：`AVAudioSession.category = .playback`；`UIBackgroundModes = audio`；不要麦克风
- iOS 采样加载是**单一后台任务**：启动预载与首次播放共享同一次解码（冷启动点播放就等这个任务，播放键显示加载中，不在主线程解码、不并发第二份解码）；免费采样齐全后，后续播放不再遍历采样目录；失败可重试（2026-09-22 立）。**就绪态只在主线程安装完采样之后才发布**——解码完成 ≠ 可播，不许出现「samplesReady=true 但 buffers 未安装」的窗口（09-23 评审收尾）；加载中再次点播放键 = 取消这次待播（共享加载继续跑，完成时不自动出声、不迟到出声；再点一次恢复待播）
- Android：音频线程填 `AudioTrack`；前台 Service `mediaPlayback`；禁止 `Handler.postDelayed` 当拍钟；首次采样解码不得阻塞主线程，必须后台加载，未就绪时播放键显示可见错误且可重试
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
- [x] Connect：IAP 商品、隐私营养（无跟踪；分析勾产品交互 + 实例 ID）、隐私 / 支持 URL、截图、年龄 4+（2026-09-26 API / Web 会话复核：IAP 已建、隐私申报已发布、四条 URL 均 HTTP 200、iPhone / iPad 截图 COMPLETE、年龄 FOUR_PLUS；App 版本待重提，IAP 仍待随版本审核）
- [x] `PrivacyInfo.xcprivacy`；不声明麦克风；出口合规 NO
- [ ] 内部 TestFlight 过完真机清单再提审
- [ ] 审核通过且 Ready for Sale

### Android → Play 内测（生产不挡 iOS）

- [ ] 锁屏通知可暂停；划掉任务即停，无幽灵 WakeLock
- [ ] 同样 40 / 120 / 208 × 60 秒、不插拍、未购童声、Restore
- [x] 解锁后 click **和** 数拍都能选；sideload **不**送包（代码侧）
- [x] 自适应图标，不是系统播放三角
- [ ] Play 内部测试轨能装；IAP 商品 + Data safety 已按实际 AAB 与 Play Billing SDK 官方指引填写（2.1.7+ 无 Firebase Analytics；Console 尚未提交，不要勾本条）
- [ ] 本地 keystore 能签同包名 APK（密钥不进 git）

### 卖 IAP 的共同阻断

- [ ] pack 人耳过审；不好听就删槽位并改说明书
- [ ] 商店文案不写「买一次全平台」
- [ ] 截图至少：默认练琴、播放中、设置含 Restore / 工坊（中文先，英文应当）

### 明确不做（上线范围外）

小组件、Watch、CarPlay、iPad 专属玩法（分栏 / 拖拽，自适应布局除外）、Live Activity、Android Auto、KMP、云同步、账号、广告追踪、深色模式、自定义导入采样、复节奏、落地页商店徽章（没有链接先别改口）。华为/小米等国内市场与官网 APK 下载页原在「不做」内，分别于 2026-09-17 / 2026-09-19 立项，见 P6。

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

- [x] N1.20 `PrivacyInfo.xcprivacy` 无跟踪无麦克风；分析声明产品交互 + 应用实例 ID **阻断**
- [x] N1.21 `ITSAppUsesNonExemptEncryption` **阻断**
- [x] N1.22 仓库侧：CI `CODE_SIGNING_ALLOWED=NO`；`Secrets.xcconfig` gitignore。本机 Team 仍需你开 **阻断**
- [x] N1.23 `swift test` 39 项绿（2026-10-02，含震动 gating、采样单飞、迟到回调门控、60 秒时钟与阻塞恢复） **应当**
- [ ] N1.24 中断/可重入单测 **上线后**

真机（记设备与日期）

- [ ] N1.25 静音键开，60s @ 120 **阻断**
- [ ] N1.26 锁屏 + 切 App，60s @ 120 **阻断**
- [ ] N1.27 40 与 208 各 60s **阻断**
- [ ] N1.28 播放中拖 BPM 不插拍 **阻断**
- [ ] N1.29 未购童声；点 pack 出系统购买 **阻断**
- [ ] N1.30 Sandbox 买 → 删 App → Restore **阻断**
- [ ] N1.31 来电回来不双开 **应当**
- [x] N1.32 iPad 通用适配（2026-09-22：Guideline 4 拒审后转通用；满高练琴舞台 + 通高 inspector；Unlock/Restore 吸顶；工坊 Click|Voice 双列可滚到底；模拟器核验；iPad 13" 截图三帧已出 `ipad-practice/playing/workshop.png` 2064×2752） **阻断**

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
- [x] N2.13 应用主清单不主动申请网络权限；Play Billing 传递依赖会合并 `INTERNET` / `ACCESS_NETWORK_STATE`（不要 `tools:node="remove"`）。运行时危险权限只有通知（33+）；震动 / 前台媒体不是运行时弹窗。外链走系统浏览器 **阻断**
- [x] N2.14 同包名 APK 不送包后门 **阻断**
- [x] N2.15 `:policy:test` 59 项绿（2026-10-02；Play/CN debug 构建及 lint 同日通过，lint 仍有非阻断警告） **应当**
- [ ] N2.16 真机：通知暂停、划掉即停、40/120/208、未购/Restore **阻断**
- [ ] N2.17 国产 ROM 保活 **上线后**

### P3 · 采样（卖 IAP 才阻断）

- [x] N3.1 pack 57 条时长闸门通过（click ≤90ms，数拍 ≤270ms，无空文件）。主观好听仍建议你听一遍，不好听再删槽 **阻断**
- [x] N3.2 `sync-sounds.sh` 同步 ios + android；miniapp 不带 `pack/` **应当**
- [x] N3.3 未改默认晓伊 / Ana **阻断**

### P4 · 商店提交（功能阻断勾完再填）

iOS

- [x] N4.1 App Store Connect 建 App，Bundle ID `studio.weichao.jpq` **阻断**（App ID `6813051843`，2026-09-26 API 复核）
- [x] N4.2 建 IAP `studio.weichao.jpq.soundpack` 非消耗型 **阻断**（IAP ID `6813065483`，当前 READY_TO_SUBMIT，仍须随 App 版本送审）
- [x] N4.3 隐私营养：无账户无跟踪；分析勾产品交互 + 应用实例 ID **阻断**（2026-09-26 `asc web privacy pull`：published=true，DEVICE_ID + PRODUCT_INTERACTION 均为 ANALYTICS / DATA_NOT_LINKED_TO_YOU）
- [x] N4.4 隐私 / 支持 URL 指现网 **阻断**（2026-09-26 中英四条 URL 均 HTTP 200）
- [x] N4.5 中文 6.9" 截图 `docs/store/screenshots/ios-*.png`（1320×2868，无透明；默认 / 播放 / 设置 / 工坊 Restore；2026-09-08 iPhone 17 Pro Max）。英文截图 = 应当。**2026-09-26 iPad 13" 三帧按 build 6 界面重拍**（`ipad-*.png` 2064×2752：默认练琴 / 播放中 / 设置工坊，iPad Pro 13 M5 模拟器；不再展示无震动硬件设备上的震动控件） **阻断**
- [x] N4.6 审核备注写在 `docs/store/README.md` **阻断**
- [ ] N4.7 内部 TestFlight → 提审 → Ready for Sale **阻断**（2026-09-17 提交 2.1.2(4)+IAP；**09-18 Guideline 2.1 Information Needed 被拒**，当日已回复 7 项说明 + 真机演示视频附件，未点 Resubmit，等结果。**09-19 DSA 交易者信息重新提交**：Apple 邮件 Action needed → Business 页走完 trader 确认 → 联系方式（北京住址小区名、+86 手机号均已线下核对，不写入仓库；邮箱 lazywc）→ 地址证明=信用卡对账单 → Compliance 表 In Review（27 EU 区）。**09-19 发现 Paid Apps 仍 Pending User Info**：banks API 空返回、UI 的 CMB Haidian 行无状态 Not in Use——实为 2026-09-17 银行向导未走完（持有人/CNAPS/账号都已存，只差 Certification 确认）。**同日已补完**：点残影银行行重走向导 → Certification 勾选 → Add → `PUT /ppm/v1/2fa/.../banks` 需新鲜 2FA（401 后弹 mfaChallenges，用户输码）→ 200。现银行=Processing、Paid Apps=Processing（等 Apple 核验转 Active；转绿后沙盒 IAP 商品应可拉取——「商店暂时连不上」的判定根因即协议未生效，届时重验购买弹窗）。**09-20 双 KYC 补资料完成**：Apple 两封 Action needed 邮件（banking details + legal entity details）= 银行进入 Processing 后重跑的 Add User Info 合规筛查，两个入口各交一次（账户持有人版：用户手交，含证件照/出生地（已线下核对，不写入仓库）/非上市；法实体版：自动走完同款表单 + 持股本人 100% Submit），红色「requires immediate attention」横幅与 Add info 入口全消，待 Apple 邮件通知核验结果）。**09-22 三连拒**：2.3.7（副标题含价格字眼「免费/free」）+ 2.3.10（描述提及 Android/Play 跨平台）+ Guideline 4（iPad 兼容窗裁掉设置/语言）。当日修复：副标题 / 宣传文本 / 描述中英重写（去价格与跨平台字眼）、转通用 App + 分栏布局（N1.32）、版本 2.1.3(5) 重传重提。**09-22 已重新提交**：无头管线归档签名上传（profile 缺新证书 → API 3 调用现建 `jpq appstore 20260922`）；ASC API 改元数据 + iPad 13" 三帧截图 + 换构建后版本自动回 PREPARE；备注补 RESUBMISSION NOTE；Resolution Center 已回复三项修复说明；点 Resubmit → **版本与 IAP 均 WAITING_FOR_REVIEW**（提交单 fe336740）。**09-22 ASC API 只读复核**：App `6813051843`，2.1.3 appStoreState=WAITING_FOR_REVIEW；构建 5（2026-09-22 05:53 PDT 上传）processingState=VALID；IAP `6813065483` state=WAITING_FOR_REVIEW。Paid Apps 协议/银行是否已从 Processing 转 Active **API 查不到，待网页核实**——若过审时协议未生效，IAP 无法销售，属过审后第一优先检查项）。**09-24 Guideline 4 再拒**：`asc web review show` 于 09-26 读取提交单 `fe336740` 的审核原文及附件。Apple 在 iPad Air 11-inch (M3) / iPadOS 27.0 指出控件尺寸或位置影响使用；附件 `Screenshot-0924-162241.png` 显示双栏横向溢出，左侧标题 / 减速按钮 / 拍号预设与右侧工坊 / 震动选项 / 音量滑块被裁切。原因是固定 408pt inspector 与练琴舞台在约 820pt 宽度下互相挤压。**09-26 修复已上传，待真机门禁**：regular 窗宽 ≥900pt 保留满高双栏，<900pt 改练琴舞台在上、通宽设置在下的纵向滚动布局；iPhone compact 不变。2.1.3(6) IPA 签名上传成功（Delivery UUID `9d9a7f47-9bcb-41d7-8707-d71648d59022`），build `9d9a7f47-9bcb-41d7-8707-d71648d59022` 处理为 VALID 并已挂到版本，版本当前 PREPARE_FOR_SUBMISSION；iPad 13" 三帧截图已用新版替换并 COMPLETE；中英描述和 App Review Notes 已更新。iPad Air 11-inch (M4) / iOS 26.5 模拟器检查了可见性。**09-26 已发 Resolution Center 修复回复并重提 build 6**：提交单 `fe336740` 于 2026-09-26 23:45:58 UTC 回 `WAITING_FOR_REVIEW`，版本 2.1.3(6) 亦 `WAITING_FOR_REVIEW`，IAP 审核项 `READY_FOR_REVIEW`；待 Apple 复核 iPadOS 27 原环境。N1.25–N1.30 真机与 pack 人耳仍未实测，不勾完成。**09-26 Business 双接口复核与纠偏**：旧 `/WebObjects/iTunesConnect.woa/ra/.../agreements` 显示 Paid Applications `ActivePendingUserInfo`、`taxInfo.usTaxMissing`，但新版 Business `/ppm/v1/accounts/{publicProviderId}/status` 的 `PurpleSoftwarePaidApplications.status=AGREEMENT_IN_EFFECT`；新版税表接口 W‑8BEN / 1042‑S 为 `ACTIVE`、美国资格问卷 `COMPLETE`，银行 `CLEARED`。两张税表旧接口亦显示已提交并关联当前付费协议，旧警告属状态不一致，不再当作缺税表的提交阻断，禁止重复提交。用户允许以模拟器 / 签名包 / TestFlight 状态替代无真机时的检查，但 N1.25–N1.30 不因此勾完成或声称已实测。
- [x] N4.8 `DEPLOY.md` 补 TestFlight / 提审步骤（不含证书） **应当**

Android

- [x] N4.9 Play Console 建应用 **阻断**（2026-09-14；内部测试已建）
- [ ] N4.10 同一 SKU；Data safety **提交时依据实际 AAB、Play Billing SDK 官方指引和 Console 提示逐项确认**（2.1.7+ 无 Firebase Analytics / 无开发者产品事件，但 Billing 可能向 Google 处理交易相关数据；付款界面由 Play 提供，不要勾 App 直接收集卡号）。粘贴稿已写，**尚未在 Console 提交，不要勾完成** **阻断**
- [x] N4.11 内部测试轨先于生产 **阻断**（2026-09-15；2.1.6 / code 8 已面向内部测试人员发布，尚未审核。下一包源码 `2.1.7` / versionCode 9，未当作已上传）
- [x] N4.12 商店文案中英已写在 `docs/store/README.md`；Android 真机练琴 / 播放 / 设置 1080×1920 已拍。工坊 Restore 需 Play 安装包再拍 **阻断**
- [x] N4.13 国内商店 / 软著：原判「不做」，2026-09-17 移交 **P6** 立项
- [ ] N4.14 生产轨上架 **应当**（iOS Ready for Sale 之后）

（原 N5.* 商店项并入本段，编号改成 N4，避免和「上线后 CI」抢 P5。旧 N4 CI 全部改为上线后 N5。）

### P5 · 上线后（不挡第一版）

- [x] N5.1 CI 跑 `cd ios && swift test`
- [x] N5.2 CI 跑 `cd android && ./gradlew :policy:test`
- [x] N5.3 CI 继续禁止 speechSynthesis /「无内购」/ 录音类别 / 缺隐私页
- [x] N5.4 无签名 `xcodebuild` 在 `Native packages` workflow（iphoneos `CODE_SIGNING_ALLOWED=NO`）**应当**
- [x] N5.5 gitignore 已排除 `local.properties`、`.jks`、`Secrets.xcconfig`、Play JSON
- [x] N5.6 打 `v*` tag → GitHub Release：Android APK（有 keystore 再挂 AAB）+ iOS unsigned IPA。keystore secrets 才签 Android release。不传 App Store / Play **应当**
- [x] N5.6 练琴屏有 bunny / 豆子 / 珊瑚（iOS 模拟器核验）
- [ ] N5.7 无障碍（VoiceOver / TalkBack / Dynamic Type / Reduce Motion）
- [ ] N5.8 来电 / 焦点 / 国产 ROM
- [ ] N5.9 生产 IAP 真钱走通后再把落地页换成商店链接（FAQ 已去掉「即将上线」，仍无商店徽章）
- [x] N5.10 `privacy.html` / `en/privacy.html` 现时态（2026-08-26）
- [x] N5.11 官网 APK 下载页：2026-09-19 转正移交 P6（有签名包即挂；只发 cn release 包，见 P6「下载分发」）

---

### P6 · 国内安卓市场（2026-09-17 立项）

商业策略与 Web / 小程序对齐：**国内包全功能免费 + 打赏入口，不卖任何东西**。「音色工坊」段在国内包**整段不出现**（不灰、不锁、设置里不渲染），比灰按钮干净、审核少一个问点。打赏纯自愿、不解锁任何功能；iOS / Play 包内收款码禁令不变。

上线定义：**华为**能搜到、能装、打开能练。小米：2026-09-19 实测注册向导仅开放企业 / 政府事业单位 / 港澳台企业 / 其他组织，**无「个人」选项**（个人注册通道关闭），后置到个人通道重开再评估。OPPO / vivo / 荣耀随华为过审后跟进；应用宝等软著规则明朗再上（见 N6.7）；魅族 / 360 / 百度不做。P6 不插队 iOS / Play 关口，工程按独立单元提交。

#### 包体差量（冻结说明书之外唯一允许的渠道差量）

- 新增 `market` 维度：`play`（现状）与 `cn`
- `cn` 包：无 Play Billing、无 Firebase（**不收集任何数据**）、工坊段整段不渲染、设置加「投喂打赏」入口
- 打赏入口：设置一行 + 弹层展示 `images/qr-wechat.jpg` / `qr-alipay.jpg`（Web 同款），文案沿用 Web「投喂打赏」风格，中英一等公民
- 同一把本地 release keystore 签名、同包名 `studio.weichao.jpq`、与 play 包共用 versionCode 序列；各市场收 release APK（华为可收 AAB）
- 不做渠道包统计（Walle / VasDolly 不引入）
- **下载分发**：官网挂 cn release APK 直链 `download/jpq-latest.apk`（仓库根 `download/`，Vercel 随站点分发；`.vercelignore` 已排除 `android/`，所以 APK 放根目录）。文件名固定、内容随版本更新；页面链接标注版本号与大小。**只发 cn 包**——play 包（带 Play Billing）不走官网分发
- policy 层不动：clamp / resolve 门控照旧，cn 包只是不暴露工坊入口

#### 资质（关键路径，先启动；只能用户本人办）

- **APP 备案**：接入商 2026-09-30 由阿里云**改为腾讯云**（用户决定；阿里云表单始终未持久化，无在途订单，切换零成本。原备案不在腾讯云 → 走「新增服务（原备案不在腾讯云）」，与胖龙同账号同路线；云资源复用胖龙那台境内轻量服务器）。备案 App 域名填 `jpq.weichao.studio`（`.studio` 在工信部可备案名单内）；管局审核最长约 20 个工作日。鸿蒙端随本次备案立项（端矩阵已加行）
- **软著**：应用宝硬要求；若将来登记，名称仍须 备案名 = 应用名 = 软著名 =「小兔头节拍器」。2026-09-17 定走正常渠道，**同日改搁置**：2026-03 起中国版权保护中心新版申请表要求手抄承诺「未使用 AI 编写代码 / 撰写文档 / 生成登记材料」，失实进失信名单并挂钩征信；本项目为 AI 辅助开发，不签不实承诺。只挡应用宝（N6.12 一并后置），不挡华为 / 小米；待规则细化或「如实声明」口径出现再启动
- 华为 AGC + 小米开发者账号：个人主体实名注册，注册时逐家确认个人可上工具类

#### 上传（首提网页后台即可，自动化是上线后）

- 华为：AGC Publishing API（官方）；小米：开放平台「自动发布接口」；OPPO / vivo / 荣耀：网页后台，浏览器自动化兜底
- 第三方 CLI（apkgo 等）用前过一遍源码，再交凭据
- 商店粘贴稿进 `docs/store/README.md` 新节（像 iOS / Play 那节）

#### 待办

- [x] N6.1 立项（本节，2026-09-17） **阻断**
- [x] N6.2 `market` flavor（2026-09-19：play/cn 双变体绿；cn 无 Billing 依赖（APK 0 billing 类）、无工坊段、设置含投喂打赏弹窗（微信/支付宝收款码仅进 cn res）；双变体 debug + policy 测试绿，cn release 6.3MB 签名指纹与备案一致） **阻断**
- [x] N6.3 `packages/strings` 补打赏 key（中英；2026-09-17 packages/android/ios 三副本 72 键对齐） **阻断**
- [x] N6.4 `privacy.html` / `en/privacy.html` 补国内渠道「不收集数据」口径（2026-09-17） **阻断**
- [x] N6.5 cn release APK 构建链路（2026-09-19：`assembleCnRelease` 本地 keystore 出包 → `download/jpq-latest.apk`，官网 zh/en 已挂下载链接；不自动传任何市场） **阻断**
- [ ] N6.6 APP 备案拿备案号（用户） **阻断**（**2026-09-30 接入商已切换为腾讯云并提交审核**：订单 `30179078206880765`（新增服务·原备案不在腾讯云），状态「腾讯云审核中」；服务=小兔头节拍器·APP·软件开发·中文简体·jpq.weichao.studio·43.143.252.243；三平台特征信息：安卓 `studio.weichao.jpq`（MD5 `5E8B01B4…7013`）、苹果 `studio.weichao.jpq`（**腾讯苹果栏要 40 位 SHA-1** `5418FAFF4534C06F639428A788EA5E0E16B8601D`，不是 MD5）、鸿蒙 `studio.weichao.jpq.hmos`（AGC 证书 MD5 `C508F5EB…CF57`）。**鸿蒙包名规则：全产品鸿蒙包名 = 安卓包名 + `.hmos`**（华为 AGC 不允许鸿蒙与安卓同包名）；节拍器鸿蒙 AGC APP ID `6917617820587845260`。误建 AGC APP ID `6917617818934615019`（占了安卓包名 `studio.weichao.jpq`）无法自删，**2026-09-30 已提华为工单 `D644577` 申请注销**（状态「处理中」，1-2 个工作日回复，进展在开发者联盟「我的工单」跟踪），在工单结案前勿用该 APP ID。**用户待办：接听腾讯云审核电话**（010-5610-3419 / 010-5610-8024 等，1-2 个工作日内，两次未接即驳回）；腾讯云过审后**工信部短信核验 24h 内完成**（发 15901020559，逾期整单作废）；管局审核最长 1-20 个工作日，非京户籍个人可能被要居住证明。旧阿里云路线全废弃（2026-09-19 的解法记录已随切换失效：阿里云表单从未持久化、无在途订单，切换零成本）。keystore `~/keystores/jpq-release.jks`（alias `jpq`，密码在 Bitwarden 条目「小兔头节拍器 · Android release keystore」）
- [x] N6.7 软著：**搁置**（2026-09-17，理由见「资质」节；待规则细化或如实声明口径） **应当**
- [x] N6.8 华为 AGC 开发者实名 + 创建应用（2026-09-18：个人实名完成；应用「小兔头节拍器」已建，**AppID `119044997`**，状态准备提交，包名待首传 APK 时绑定为 `studio.weichao.jpq`） **阻断**
  - 小米：2026-09-19 注册向导无个人选项（仅企业类主体），**暂缓**，个人通道重开再启动
- [ ] N6.9 国内市场商店粘贴稿（`docs/store/README.md` 新节） **阻断**
- [ ] N6.10 华为首次提审过审（小米暂缓） **阻断**
- [ ] N6.11 OPPO / vivo / 荣耀跟进 **应当**
- [ ] N6.12 应用宝（等软著规则明朗或替代口径，见 N6.7） **应当**
- [ ] N6.13 上传自动化（华为 API / 小米接口 / 浏览器自动化） **上线后**
- [x] N6.14 鸿蒙端 ArkTS 实现（2026-10-01 工程落地：cn 变体免费+打赏、无 IAP 无工坊段；worker `AudioRenderer` 时钟、rawfile WAV 采样（`harmony/sync-sounds.sh`，不带 pack/）、偏好/文案/版本号形状与 android cn 对齐。**编译走 CI**：`.github/workflows/harmony.yml` 用官方 command-line-tools 5.0.5.200（内置 API 12 SDK，HuggingFace 公开镜像免登录，用户本地无空间装 DevEco；2026-10-01 用户授权新增此 workflow，监听 develop 的 harmony/** 变更 + 手动触发），**同日 CI 已跑绿**（run `36874983440`，CompileArkTS 通过，产物未签名 hap 挂 artifact）。注意：module.json5 的 `backgroundModes` 已按 OpenHarmony schema 移除，后台播放靠 `startBackgroundRunning` API + `KEEP_BACKGROUND_RUNNING` 权限，真机要验；上架签名走本机 panglong-release 证书；**真机/云测核验未做**（40/120/208 不漂、锁屏出声、不插拍）） **应当**

---

## 2026-10-02 本地深度检查

证据与改动范围见 `docs/quality-audit-2026-10-02.md`。它不是另一份上架 TODO；本文件仍是产品与发布关口的真相源。

本次检查补齐 Web 脚本缓存一致性 / 输入 / 加载状态 / 小屏与键盘体验、iOS 迟到调度和回调门控、Android 完整采样与启停清理、鸿蒙异步生命周期 / WAV 解析 / 偏好落盘，以及发布产物路径和测试依赖安全更新。初轮检查时未推送；后续用户授权后已分组提交并推送 develop / main，发布 Web `2026.10.02.2`。未提交商店、未更新已有真机勾选。

**鸿蒙初轮只有 12 项平台模拟测试；后续 2026-10-03 UTC，提交 `a4e08eb` 的 Harmony SDK CI `37097237558` 通过，生成 unsigned HAP，覆盖本次可靠性改动。仍未真机核验。** iOS / Android 构建与策略测试通过不替代 N1.25–N1.30、N2.16 和 pack 人耳试听。

---

## 干活时的顺序（Agent 必守）

1. 改规则先改本文，再改代码。
2. 只做 **阻断** 也能提审；**应当** 顺手做；**上线后** 不要插队挡 TestFlight。
3. 原生先 iOS 阻断（P1 + P3 + P4.1–P4.7），Android 抄功能阻断（P2 + P4.9–P4.12）。国内安卓市场按 P6 独立单元推进，不插队 iOS / Play 关口。
4. iOS 真机 N1.25–N1.30 没勾，不准提审。
5. 发现说明书不够：改本节，不要在 Android 加功能。
6. 政策单测（clamp、bank 门闩、不插拍、0.28 增益）改钟时要绿；不要为上线新写一堆测试当阻断。
7. 密钥不进 git。图标 1024 和采样可以进仓库。
8. 提交与推送见本文「提交与推送节奏」。默认走 `develop`，不要自造远端分支。

---

## 提交与推送节奏

默认开发线是 **`develop`**。开发修复的提交和推送都复用它。除用户明确另行指定，**不创建**额外 task / audit / feature 分支。隔离工作树可以用，但不得因为 worktree 自动发明远端分支。

`main` 只是发布合并关口（Web：推 `main` → Vercel）。默认不推 `main`、不 force、不改写已推历史、不自动打 tag / 合并 / 触发发布。发布另经发布关口授权。

**PII 闸（2026-09-22 立，同日完成清除）**：曾在本地未推提交的 AGENTS.md 写入证件号 / 姓名 / 住址，已重写这两个未推提交（`a00c02e`→`3d77021`、`29df279`→`fa357ba`，作者日期保留）彻底去敏，全历史与工作区扫描 0 命中；origin 从未收到过含 PII 的提交。已推送历史里的 iPhone UDID / OnePlus 序列号（9e99b27、e73c9ad）属低敏设备号，保留。今后身份材料一律写「已线下核对，不写入仓库」。

按**可独立解释、验证、回退**的逻辑修复单元提交。代码和必要测试/契约一起走，不按返工次数或每个文件碎片提交，也不长期堆成全项目巨型提交。

实现期间可以改工作树。**stage/commit 只在协调人确认写入停止，且该单元的检查、测试和独立复盘都通过之后。** 独立复盘保持只读，不在复盘里提交。写入期间不切分支、不移动 refs。

提交前：看 `git diff` 和新文件；**显式路径**暂存，避免 `git add .` 卷走无关用户改动；`git diff --cached --check`；检查内容、密钥、锁文件、覆盖率门槛。不为「看起来干净」reset 或删别人的改动。推送前重查远端，只允许快进，拒绝非快进，绝不覆盖他人提交。

用户已授权时，一组通过验收的提交推 **`origin/develop`**。报告 commit SHA、分组、测试、目标远端分支。现有 CI 的 `push` / `pull_request` 已监听 `main` 与 `develop`（`.github/workflows/ci.yml`，2026-10-02 以现有文件复核并修正文档）；Native packages 监听 `v*` tag 或手动触发（`release.yml`）。**不要**自动扩 CI / 发布范围；推 develop 不会触发 Native packages。提交门槛仍是本地测试与独立复盘。

**代码可提交 ≠ 可发布。** 外部真机 / 账号 / 签名未验证的上线项保持未勾。
