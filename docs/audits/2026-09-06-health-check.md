# 全项目体检报告 · 2026-09-06

初版为只读体检。随后用户授权对 HC-01–05 做有界修复。**第一批独立复盘已 PASS**（含 R01 返工 1/1），本批不得回退那些改动。用户批准继续完善剩余已知项后再做**一次**独立复盘。**第二批独立复盘最终 PASS**（导演确认，0 Blocker / 0 Major；B2-R01–10 已修，不得回退）。本文件另记 **第三批**：剩余已知本地问题清理。第三批首次独立复盘 **NEEDS_REWORK**。返工 1/3 **代码独立复盘 PASS**（0 Blocker / 0 Major）。导演已把同一工作树切到现有 `develop` 并 **6 个逻辑提交快进推送 `origin/develop`**（HEAD `d368004`）。本文件此时只归档提交与真机补充，**不是**商店可发布。

## 基线与范围

| 项 | 值 |
|---|---|
| 日期 | 2026-09-06 |
| 工作树 | `/Users/lazy/.paseo/worktrees/25sml0lj/project-health-20260906` |
| 分支（历史本地） | `audit/project-health-20260906`（曾为隔离位置，**未推远端、未再新建分支**） |
| 最终目标分支 | `develop`（导演已快进并推 `origin/develop` HEAD **`d368004`**。历史核实过祖先 `e16d2ce`…`8cd9abf` 可快进。） |
| 基线 | `8cd9abf99b72ef48aa9d7a2a322d0ff1f4c410e8`（`main`，开始时干净） |
| 基线说明 | `feat: Firebase Analytics for native DAU and in-app events`（2026-08-26） |
| 第一批写入（保留） | `index.html` `en/index.html` `js/prefs.js` `sw.js` `miniapp/pages/index/index.js` `miniapp/tests/*` `scripts/test_local.py` `scripts/test_web_prefs.js` |
| 第二批额外写入 | `AGENTS.md` `docs/engine-contract.md` `docs/iap.md` `DEPLOY.md` 小程序时钟/音频/i18n、iOS Store 接线、Android billing/busy/reconnect、`packages/strings` 与原生副本、pbxproj AnalyticsCore、本报告 |
| 不做（本轮工人） | 写入期间不切分支、不移动 refs、不 stage/commit/push/部署；不改 lockfiles/密钥；不扩 CI；不连私人设备/真购买；不新开 N 号 |
| 规则源 | `AGENTS.md`；契约见 `docs/engine-contract.md` 等 |
| 证据分层 | 历史勾选 ≠ 源码存在 ≠ 单测 ≠ 模拟器构建 ≠ 真机听感。静态 / 运行 / 未验证分开写 |

未写入报告：凭证、keystore、私人设备标识、个人数据。

## 当前流程

- 第一批、第二批（含返工 1–3）当时指令禁止 commit/push，下文停写句保留为历史事实。
- 用户后授权「合适时机、合适颗粒度」可提交/推送，**不**授权盲推 `main`、合并、发布。随后纠正：开发线复用已有 **`develop`**，不要自造 task/audit/feature 远端分支。
- `audit/project-health-20260906` 只是本工作树的历史本地隔离位置，最终目标是 `develop`。
- 返工 1 源码独立复盘 PASS 后，**导演**已分组提交并快进推 `origin/develop`（工人不再 commit/push）。本文件由工人只更新文档，导演另提交报告。
- 已发生（导演）：`develop` 快进含 `main` 基线后 6 提交，**未动 `main`、无新分支/tag/发布**。推 `develop` **不会**跑只听 `main` 的 CI。
- CI：`.github/workflows/ci.yml` 的 `push`/`pull_request` 只监听 `main`；`release.yml` Native packages 只 `v*` tag。推 `develop` **不会**跑这些现有 workflow。不要扩 CI / 发布范围。提交门槛仍是本地测试与独立复盘。
- 代码可提交 ≠ 可发布。真机 / 账号 / 签名未验证项保持未勾。

---

## 结论摘要

**无 Blocker。** 第二批首次独立复盘 **NEEDS_REWORK**（B2-R01 busy 卡死、B2-R02 冷启动静默跳拍）。返工 1/3 后复盘 PASS。导演随后判定 B2-R07/R08/R09 为硬验收缺口；返工 2/3 后复盘 **NEEDS_REWORK**，唯一 Major **B2-R10**（未知账本把 pack 选择持久化成 default）。本轮 3/3 只修 B2-R10，**不是 PASS**。

默认干净路径上 Web 能进入播放状态机（按钮变暂停、`AudioContext.state === 'running'`、缓冲已解码）。自动化页里 `currentTime` 几乎不走，**不能证明扬声器真的在响**。小程序/iOS/Android **没有本次真机听感**。

**初检快照**（基线 `8cd9abf` 源码）：Web 损坏 JSON 会让播放键空转；小程序改 BPM 会插拍；童声无 0.28 弱 click；Web UI 与引擎 clamp 分叉；`npm test` 因覆盖率门禁退出 1（**65 条单测本身通过**）。

HC-01–05 与 R01/R02/R03/R07 **第一批已落地并 PASS**，未回退。HC-06+ 正文标题与第二批矩阵已对齐为当前状态（初检原文标「初检」）。自检更正仍有效：HC-15 `.vercelignore` 在基线内；HC-12 无跨端版本=tag 规则；HC-13 不把「不自动恢复」写成违反 N1.31。

上线阻断 N1.25–N1.30、N2.16、N4.*、pack 人耳仍是外部发布待办。无障碍/1:1 视觉不上调阻断。

---

## 复盘返工（1/1）· R01 / R02 / R03 / R07

**R07 状态：** 首轮独立复盘已完成；导演将 R01 从 Minor 改判 Major；本轮正在修正；**等待返工后独立复核。不是最终 PASS。**

**R01（必修，Major）：** 中英页曾把 `localStorage` 作为 `safeGet` 实参，getter 抛 `SecurityError` 时在进入 try 前求值即崩溃。本轮 `js/prefs.js` 增加 `getLocalStorage()`：在 **try 内** 读 `window.localStorage`，失败返回 `null`。两页只持有 `_ls` 引用，hint/save 全部走 `safeGet(_ls,…)` / `safeSet(_ls,…)`，页面源码 **不再出现 `localStorage` 标识符**。`safeGet`/`safeSet` 对 null 直接返回。SW cache 升为 `xiaotutou-v5`（prefs 行为变更）。

验证：`scripts/test_web_prefs.js` 用 `Object.defineProperty(..., 'localStorage', { get() { throw new DOMException('Storage access denied','SecurityError'); } })`（不是只让 getItem 抛），抽出两页真实 init+play 绑定语句在 vm 里跑：默认 `120/4/uniform`，`play-btn.onclick` 为 function。静态：两页无 `\blocalStorage\b`。浏览器自动化 **没有 initScript**，无法在文档脚本前改 getter，故 **未做真实浏览器用禁存储 getter 的加载**；局限是纯内存 + 页面静态。

**R03：** 原 `stop` 测试 `__runTimeout(pending)` 在 `clearTimeout` 删掉 map 项后 no-op，属平凡通过。现改为 `__peekTimeout` 在 stop **之前**保留 callback，stop 后 **直接调用旧 callback**，断言拍位不变、不重排；再 `_start` 后旧 callback 不得改新 run 的 `_currentBeat`/`_timer`。未改产品时钟。

**R02：** 不以静态 `it(` 计数证明运行数。本轮重跑命令与脱敏原文如下（完整日志 `/tmp/metronome-audit-20260906/`，不进仓库）。覆盖率门槛未改。

未测（**第一批快照**）：人耳、真机 InnerAudio、禁存储 getter 的真实浏览器加载。当时未重跑原生单测/构建；**第二批与返工 1 已跑** iOS `swift test` 20 + 无签名构建、Android `:policy:test` 与 `assembleDebug`（见后文分层记录）。

---

## 本轮修复（HC-01–05）

| ID | 改动 | 验证 |
|---|---|---|
| HC-01 / HC-04 | `js/prefs.js` clamp + 安全存储；R01 后 getter 也进 try | 见返工 R01；坏 JSON/query 仍见上一轮浏览器记录 |
| HC-02 | `_nextAt` 绝对时刻链 | fake timer：改速不插拍 |
| HC-03 | `weakOverlay` ×0.28 | 单测 overlay 音量与同拍 play |
| HC-05 | 补测，不降阈值 | 见 R02 重跑 `npm test` 原文 |

---

## 8 领域检查矩阵

图例：**静态** = 读源码/契约；**运行** = 本次命令或浏览器；**未验证** = 无本次动态证据。不要把「源码存在」写成运行通过。

| 领域 | Web | 小程序 | iOS | Android |
|---|---|---|---|---|
| 1 产品一致性 | 静态：三模式/免费童声。运行：第一批 clamp 后 UI=引擎。未验证：听感 | 静态+单测：clamp、童声+弱 click。未验证：真机 | 静态+政策单测。未验证：真机 | 同 iOS |
| 2 音频生命周期 | 运行：lookahead 改 BPM `nextNoteTime` 不变。未验证：出声 | 运行（fake timer）：不插拍；返工 1 当前模式加载可见。未验证：真机 40/120/208×60s | 静态：`.playback`、start 守卫。未验证：锁屏/静音键 | 静态：AudioTrack+Service。未验证：N2.16 |
| 3 IAP | N/A | N/A | 第二批：updates→entitlements 代码+替身。未验证：Sandbox | 第二批+返工 1：busy generation。未验证：真 Play 断线 |
| 4 Web/PWA/小程序 | 运行：query、SW 激活、坏存储可播。未验证：断网离线 | 静态：无 pack。DEPLOY 已按文件字节计。未验证：微信包体审核 | N/A | N/A |
| 5 体验国际化 | 运行：中英主流程。**主页**英文名 Bunny Metronome；`en/p/` 与模板仍 Little Rabbit（取舍，非全站统一） | 小程序英文 title Bunny Metronome | 静态：strings 对齐；`voice_en_deep` 中文「英文低沉」 | 同左 |
| 6 隐私 | 静态：友盟+GA4 脚本。未验证：实际上报 | 静态：umtrack debug:false | 占位 plist 不 init；第二批链 `FirebaseAnalyticsCore`。未验证：IDFA 采集；无真实配置 | 静态：无 google-services.json，分析 no-op |
| 7 工程 | 运行：`test_local.py` 0；`test_web_prefs.js` 0（返工 1 仍 0） | 运行：返工 1 `npm test` 0（108 tests） | **第二批** `swift test` 20 + 无签名构建 0（返工 1 未改 iOS，引用该证据）。**初检快照**曾为 14 tests | **返工 1** `:policy:test` 27 + `assembleDebug` 0。**初检快照** 14 tests |
| 8 分发 | 运行只读：现网 `/` `/en/` `/about` `/privacy`。`.vercelignore` **在 git 基线内** | 静态：AppID 已配。未验证：上传 | 未验证：Connect/TestFlight | 未验证：Play 内测 |

---

## 发现

严重度：Blocker = 核心练习不可用/严重安全/明确发布阻断；Major = 重要场景或高影响可靠性；Minor = 局部；Suggestion = 非缺陷优化。状态：已确认缺陷 / 已修复 / 风险待验证 / 体验优化 / 外部发布待办 / 观察。

### HC-01 · Web · Major · 已修复

损坏的 `localStorage.metronome` 曾让播放键空转。

- **初检证据（基线运行）**：`JSON.parse(localStorage.getItem("metronome")||"{}")` 无 try。写入 `{not json` 后：onclick 为假、0 个豆子、点击 ▶ `engine.playing` 仍 false。
- **本轮（含 R01 返工）**：`getLocalStorage()` 在 try 内取 `window.localStorage`；两页用 `_ls`，无裸 `localStorage` 实参。坏 JSON 上一轮浏览器已过；getter 抛 SecurityError 由 vm 抽出两页 init 语句验证（默认 120/4/uniform + play 绑定）。
- **用户影响（修复前）**：该浏览器存储损坏后无法练。
- **规则**：`docs/engine-contract.md` 非法值 clamp。

### HC-02 · 小程序 · Major · 已修复

播放中改 BPM 曾立即再打一拍。

- **初检证据（静态）**：`_setBpm` / `onBpmChange` `_stopTick(); _startTick()`，`_scheduleNextTick` 同步 `_tick()`。
- **本轮**：`_nextAt` 只递增；改 BPM 不碰当前定时器。单测：60→120 瞬间拍位不变，下一拍后间隔 500ms。
- **用户影响（修复前）**：拖滑块多一拍。
- **规则**：AGENTS「改 BPM 不得插入额外一拍」。

### HC-03 · 小程序 · Major · 已修复

童声未叠弱 click 0.28。

- **初检证据**：`_tick` voice 只 `play('vN')`。Web/原生 `sampleVoices` 含 `click-weak` @ 0.28。
- **本轮**：独立 overlay 池，不把主音量改成 0.28。
- **用户影响（修复前）**：小程序童声起音比其它端软。仍能数拍。
- **未验证**：真机听感。
- **规则**：引擎契约三种模式表。

### HC-04 · Web · Major · 已修复

存储/查询 UI 曾与引擎分叉。

- **初检证据**：存储 `{bpm:999,sm:garbage}` → UI 999/`garbage`，引擎 208/uniform。`?sig=99/4` → **99 豆**，`engine.bc=16`。
- **本轮**：存储越界 clamp 且 UI=引擎（999→208，0 拍→1 豆）。非法 query bpm **忽略**（保持 120，不写成 208）。非法 sig 不渲染越界豆子（4 豆）。合法 query 仍优先。
- **用户影响（修复前）**：手改存储或恶意长尾 URL 会撑 DOM / 显示假 BPM。
- **规则**：契约状态与非法值。

### HC-05 · 工程/小程序 · Minor · 已修复

（自检：覆盖率门禁失败 ≠ 65 条测试失败；对用户练习无直接影响，故不维持 Major。）

- **初检**：65 tests pass；functions 78.72% < 80%；`npm test` 退出 1。CI 不跑 `npm test`。
- **本轮**：85 tests；functions 94.44%；`npm test` 退出 0。未降阈值、未 skip。
- **用户影响**：无（开发者按 AGENTS 跑测试曾失败）。
- **规则**：AGENTS 命令。无新 N 号。

### HC-06 · iOS / Android · Minor（配置缺口仍在）+ 第二批已改链接产品

**初检：** 未修。占位配置不 init。当时 pbxproj 产品为 `FirebaseAnalytics`。

拆开三条，互不代替：

1. **配置占位 → 分析未初始化（静态，已确认）**\
   iOS `GoogleService-Info.plist` `GOOGLE_APP_ID=YOUR_GOOGLE_APP_ID`，`AppAnalytics.start()`（`AppAnalytics.swift` L10–16）直接 return。Android 无 `google-services.json`，插件不 apply，`FirebaseApp.getApps` 为空则 return。\
   **不等于**正在收集数据。用户练习不受影响。隐私页写「Firebase 记录产品事件」相对当前包是**多声明、少采集**。

2. **库链接事实（静态+初检构建日志）**\
   初检 iOS 模拟器构建链入 `FirebaseAnalytics.framework`、`GoogleAdsOnDeviceConversion.framework`、`GoogleAppMeasurementIdentitySupport.framework`。`Package.resolved` firebase-ios-sdk 11.15.0。pbxproj 产品为 `FirebaseAnalytics` 而非 `FirebaseAnalyticsCore`。工程未链 `AdSupport` / ATT。

3. **实际收集广告 ID / 跟踪（未验证）**\
   **链接库本身不能证明跟踪或采集 IDFA。** 无真机 Analytics 调试日志、无 ATT 弹窗观察、无网络抓包。官方（核验 2026-09-06）[Configure Analytics data collection](https://firebase.google.com/docs/analytics/ios/configure-data-collection)：若要去掉 IDFA 采集**能力**应改用 `FirebaseAnalyticsCore`。这是能力面建议，不是本次运行时证据。

- **用户影响**：当前无分析上报；无已证跟踪。
- **第二批：** pbxproj 改为官方 11.15.0 产品 `FirebaseAnalyticsCore`（`WithoutAdIdSupport` 在该版本 Package.swift 标 Deprecated）。无签名构建去掉 app 内 IdentitySupport / OnDeviceConversion。**配置仍是 `YOUR_GOOGLE_APP_ID`，分析仍不 init。** 返工 1 未再动 Firebase/lock。
- **规则**：AGENTS 禁止广告/归因 SDK、打开 IDFA；N1.20、N4.3。不是新 N 号。

### HC-07 · iOS · Major · 第二批已修代码 · Sandbox 仍外部

**初检：** `StoreAdapter.swift` 当时 L11–17 `Transaction.updates` 只 `finish()`，不刷新 UI 账本。

**第二批：** verified 且本 SKU 后 `finish()` 再通知 observer → `currentEntitlements`。`swift test` 20（替身层）；Package.swift 仍排除 model/adapter。无签名构建编译了这两层。Sandbox 未跑。返工 1 **未改 iOS**（复盘无新证据缺陷）。

- **平台**：iOS。**文件**：`ios/BunnyMetronome/Store/StoreAdapter.swift` L11–17；`MetronomeModel.buyPack()` 主路径会 refresh。
- **影响**：家庭批准/补票场景解锁延迟，需 Restore 或冷启动。
- **最小建议**：updates 后再读 `currentEntitlements`。
- **验收**：N1.30 Sandbox。
- **规则**：`docs/iap.md`；N1.15。

### HC-08 · Android · Minor · 第二批已修 busy；返工 1 修断线卡死（B2-R01）

- **初检：** `MainActivity.kt` 购买不置 `storeBusy`（Restore 才置）。
- **第二批：** 所有购买入口走 `PlayStoreAdapter.launch` + `StoreBusyGuard`。
- **首次复盘 Major B2-R01：** launch 成功后 busy 只等 listener；断线 listener 不回则永久 busy。返工 1 用 `BillingSessionController` generation，见文末。
- **仍待：** 真 Play 连点/断线。

### HC-09 · Android · Minor · 第二批已修有界重连；返工 1 补用尽后再试（B2-R04）

- **初检：** `onBillingServiceDisconnected` 空。
- **第二批：** Billing 7 有界重连，不升 SDK，不自动弹购买页。
- **复盘 B2-R04：** 用尽后用户 Buy/Restore 可再开有界周期。返工 1 已做。真机飞行模式仍外部。

### HC-10 · Web / 小程序 · Suggestion · 第二批仅主页/小程序对齐（非全站）

- **初检：** `en/index.html` H1/JSON-LD 与小程序 `en.title` 为 Little Rabbit。
- **第二批：** **只** `en/index.html` 用户可见名/metadata 与小程序英文 title → Bunny Metronome；JSON-LD `alternateName` 仍 Little Rabbit Metronome。
- **剩余取舍：** `en/p/` 10 篇与落地模板仍旧名；**不是全站统一**。

### HC-11 · 文档 · Minor · 第二批已修 DEPLOY 字节

- **平台**：文档。**文件**：`DEPLOY.md` L177「3 个鼓点 ~4KB」。实际 miniapp 35 个 mp3 ≈75KB。
- **影响**：估包体误判。对照微信主包上限 2MB（[分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages)，2026-09-06）仍有余量。
- **最小建议**：改 DEPLOY 数字。
- **规则**：文档与代码分叉。无新 N。

### HC-12 · 观察（非缺陷）

初检写成「版本字符串分叉」Minor。**AGENTS 没有「三端版本号必须等于 git tag」的规则。** 各端可独立版本；源码 `2.1.2` 领先 tag `v2.1.1` 是发布节奏，不是功能 bug。小程序关于页 `v2.2` 是文案。N4 要求提审材料与**该次送审版本**一致，不要求本仓库此刻对齐所有 tag。

- **平台**：文档/元数据。**状态**：观察。
- **影响**：无练习影响。提审当天自行对齐 Connect/Play 版本即可。

### HC-13 · iOS · 观察（不违反 N1.31）

初检建议来电结束后自动 `start()`。**N1.31 原文是「来电回来不双开」（应当），不是「必须自动恢复播放」。** 当前 `handleInterruption` `.began` 停钟（`MetronomeAudioEngine.swift` L133–137），`.ended` 只 `configurePlaybackSession()`（L138–143）；`MetronomeModel.onInterrupted` 把 `playing=false`（L38–45）。这与「不双开」相容；自动恢复反而可能双开。无真机来电证据。

- **平台**：iOS。**严重度**：不作为缺陷。**状态**：观察 / 未验证真机。
- **影响**：来电后需用户再点播放。说明书未要求自动续播。
- **最小建议**：不要为实现「自动恢复」而违反不双开。真机做 N1.31。
- **规则**：N1.31 应当。无对应「必须 resume」条款。

### HC-14 · Web · Suggestion · 未修

- **平台**：Web。**文件**：`vercel.json` CSP 为 Report-Only。
- **影响**：XSS 未强制。
- **最小建议**：观察 report 后再 enforce。
- **规则**：无对应 N。

### HC-15 · 分发 · 已更正（不是「仓库没有该文件」）

初检写「仓库无 `.vercelignore`」是错的。原因：目录列表工具不显示点文件；不能把「没看见」当 git 基线缺失。

| 位置 | `.vercelignore` |
|---|---|
| git 基线 `8cd9abf` | **已跟踪**（`git ls-files .vercelignore`、`git show HEAD:.vercelignore`） |
| 本 worktree 与源仓库 `/Users/lazy/Code/crack/metronome` | 同一 commit，文件内容相同：忽略 `miniapp/` `ios/` `android/` `docs/` `packages/` 等 |
| `.gitignore` | 只忽略 `.vercel` 目录，**不**忽略 `.vercelignore` |

内容（基线）：

```
miniapp/
ios/
android/
docs/
packages/
...
```

- **一条路径的现网 404**（`https://jpq.weichao.studio/ios/BunnyMetronome/Info.plist` → 404）**不能**推断所有原生路径都未发布，也不能代替 `.vercelignore` 生效证明（Vercel 是否使用该文件取决于部署配置）。
- **DEPLOY.md** 仍写 Dashboard Ignored Paths，与仓库已有 `.vercelignore` 重复，属文档滞后，Suggestion。
- **状态**：观察 / 文档滞后。不是缺失文件缺陷。
- **规则**：AGENTS「Vercel 忽略 miniapp/ios/android」——仓库文件已表达该意图。

### HC-16 · Android · Suggestion · 未修

- **平台**：Android。**文件**：`app/build.gradle.kts` `compileSdk = 35`。初检 `assembleDebug` 警告 AGP 8.5.2 测到 34。**退出码 0**。
- **影响**：警告，包仍出。
- **规则**：无。不挡内测。

### HC-17 · i18n · Suggestion · 第二批已修中文槽位名

- **平台**：原生文案。**文件**：`packages/strings/zh.json` `voice_en_deep`: `"Deep English"`。
- **影响**：中文工坊槽位夹英文。N0.4 应当。
- **最小建议**：中文显示名。

---

未当缺陷：默认童声免费；pack 仅原生；三树采样哈希一致；FakeStore `¥12` 只在测试替身；Web 打赏码允许；原生无收款码、无 `playAndRecord`；无障碍为上线后。

---

## 测试 / 构建记录

环境：macOS arm64；Python 3.14.7；Node v23.9.0；Apple Swift 6.3.3；OpenJDK 17.0.2。`ANDROID_HOME` 仅命令环境变量，未写 `local.properties`。`npm ci` 未改 lockfile。

本机 IPv4 `:8000` 被其它进程占用；浏览器用 `127.0.0.1:8765`。

### 第一批快照 · 复盘返工后重跑（R02，不以静态 it 计数为准）

日志目录：`/tmp/metronome-audit-20260906/`（`npm-test.txt` `test-web-prefs.txt` `test-local.txt`）。

`cd miniapp && npm test` 退出码 **0**。Vitest 脱敏汇总原文：

```
 RUN  v1.6.1 .../miniapp
      Coverage enabled with v8

 ✓ tests/engine.test.js  (10 tests) 11ms
 ✓ tests/index.test.js  (75 tests) 12ms

 Test Files  2 passed (2)
      Tests  85 passed (85)
   Start at  09:29:11
   Duration  229ms ...

 % Coverage report from v8
 File      | % Stmts | % Branch | % Funcs | % Lines
 All files |   94.93 |    79.24 |   94.44 |   94.93
```

门槛仍为 functions/lines/statements 80、branches 70。10+75=85 来自 Vitest 运行输出，不是源码 `it(` 静态计数（复盘曾见 84，以本次运行为准）。

`node scripts/test_web_prefs.js` 退出码 **0**（含 SecurityError getter 下中英 init+play）。

`python3 scripts/test_local.py` 退出码 **0**。

### 初检构建快照（第一批当时未重跑；第二批/返工 1 已另跑，见后文）

| 命令 | 退出码 | 结果 | 说明 |
|---|---|---|---|
| `cd ios && swift test` | **0** | 14 tests, 0 failures | 政策层；非真机音频 |
| `cd android && ./gradlew :policy:test --no-daemon` | **0** | 14 tests | 同上 |
| `xcodebuild -project ios/BunnyMetronome.xcodeproj -scheme BunnyMetronome -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO build` | **0** | `** BUILD SUCCEEDED **` | 无 iPhone 16 模拟器 |
| `cd android && ./gradlew :app:assembleDebug --no-daemon` | **0** | `BUILD SUCCESSFUL`，debug APK 约 11MB | **不是「7eff」**；那是通知误写。Gradle 日志含 compileSdk 35 警告 |

### 浏览器（本轮修复后，8765，非听感）

| 场景 | 结果 |
|---|---|
| 坏 JSON `{not json` | 4 豆，onclick 在，120/4/uniform |
| 存储 999/0/garbage/vol3 | UI+引擎 208 / 1 豆 / 均匀 / vol 10 |
| `?bpm=999&sig=99/4&mode=nope` | 120 BPM，**4 豆**，均匀 |
| `?bpm=80&sig=3/4&mode=voice` | 80、3 豆、童音，引擎一致 |
| `/en/?bpm=100&sig=4/4&mode=uniform` | 100/4/Steady；点 ▶ → playing、ctx running |
| 中文点 ▶（坏 JSON 修复后） | ⏸、playing、19 buffers。`currentTime` 仍可能停滞 → **非听感证明** |

---

## 外部验证缺口

1. 真机 N1.25–N1.30、N2.16。\
2. Sandbox / Play 购买 Restore。\
3. pack 人耳。\
4. Connect / Play 账号与 IAP 商品（N4.*）。\
5. 微信真机 InnerAudio、包体审核。\
6. 断网 PWA。\
7. Firebase 是否采集 IDFA（HC-06 第 3 条）。\
8. Play 12×14：官方 [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)（2026-09-06）；账号是否适用待 Console。\
9. Apple 3.1.1（Guidelines Last Updated June 8, 2026）：源码无收款码、有 Restore；过审待提审。

---

## 首发顺序（现有 N 号）

阻断：N1.25–N1.30 → N3.1 人耳 → N4.1–N4.4/N4.7 → N2.16 与 N4.9–N4.12。

应当：N1.31 **不双开**（不要做成强制自动恢复）。商店/真机/Sandbox 仍外部。

上线后：N5.7–N5.9、N5.11、无障碍。

---

## 历史勾选 vs 本次

| 说法 | 对待 |
|---|---|
| 2026-08-25/26 模拟器/真机勾选 | 历史。本次未连那些设备 |
| 第一批 Web/小程序单测 | 本批回归仍绿，未降覆盖门槛 |
| `v2.1.1` Release | 存在；源码 2.1.2 领先 tag ≠ 缺陷（HC-12） |

---

## 第二批实现（首次复盘 NEEDS_REWORK · 返工 1/3）

规则先行：`AGENTS.md` 小程序丢弃过期拍、BPM 整数字符串、voice+overlay 都就绪才发声；`docs/engine-contract.md` / `docs/iap.md` 已同步。不新开 N 号。日志 `/tmp/metronome-audit-20260906/batch2/`。第一批 PASS 文件未回退。

### 第二批逐项处置

| ID | 处置 | 本地代码证据 | 仍待 |
|---|---|---|---|
| HC-01 | 已修（第一批 PASS） | `js/prefs.js` + `test_web_prefs.js` | 禁存储 getter 的真实浏览器 |
| HC-02 | 已修（第一批 PASS） | `_nextAt`；本批仍回归 | 真机听感 |
| HC-03 | 已修（第一批 PASS） | overlay ×0.28；本批仍回归 | 真机听感 |
| HC-04 | 已修（第一批 PASS） | prefs clamp + 非法 query 忽略 | — |
| HC-05 | 已修（第一批 PASS） | 门槛未降；本批 100 tests / 96.41% funcs | — |
| HC-06 | 已改链接产品 + 外部配置缺口 | 锁版本 **11.15.0** 官方 `Package.swift`（核验 2026-09-06）：`FirebaseAnalyticsCore` 为现行无广告标识产品（`WithoutAdIdSupport` 官方标注 Deprecated，改用 Core）。pbxproj `productName = FirebaseAnalyticsCore`。无签名模拟器构建 **EXIT 0**，依赖图 `GoogleAppMeasurementCore`；从 app 去掉陈旧 `GoogleAppMeasurementIdentitySupport` 与 `GoogleAdsOnDeviceConversion`。`GoogleService-Info.plist` 仍 `YOUR_GOOGLE_APP_ID`，`AppAnalytics.start()` 不 configure。未造客户端配置、未改 lock。 | 真实 Firebase 配置；运行时是否采集 IDFA 仍无抓包 |
| HC-07 | 已修代码 + 替身接线测试 | `StoreKitAdapter`：verified 且本 SKU 才 `finish()` 后通知 observer → `currentEntitlements`；unverified 不解锁、不 `unlocked=true`。`MetronomeModel` 弱引用 + `EntitlementRefreshGate`。`EntitlementObserverBinding` 可注入。`swift test` **20**（含 6 条 EntitlementRefresh）。**`ios/Package.swift` 仍排除 `MetronomeModel.swift` 与 `Store/StoreAdapter.swift`，swift test 绿 ≠ 这两层测过。** 无签名 App 构建编译了 adapter/model。 | Sandbox Ask to Buy / Restore / 撤销 |
| HC-08 | 第二批已修 busy；返工 1 修 B2-R01 | 见返工 1：`BillingSessionController` | 真 Play |
| HC-09 | 第二批有界重连；返工 1 修 B2-R04 | Billing 7，不升 SDK；用尽后用户再试 | 真机断线 |
| HC-10 | **仅主页/小程序**已对齐，非全站 | `en/index.html` + miniapp title；`en/p/` 仍旧名 | 长尾取舍 |
| HC-11 | 已修 | `DEPLOY.md`：35 个 mp3，**76 974 字节（约 75.2 KiB）** 为 `st_size`；`du -sk` 约 140 KiB 是块分配；不是微信最终包体 | 微信开发者工具上传包体 |
| HC-12 | 经核实非缺陷 | 无「版本=tag」规则 | 提审当天对齐商店版本 |
| HC-13 | 经核实非缺陷 | N1.31 是不双开，不是必须自动续播 | 真机来电 N1.31 |
| HC-14 | 纯建议暂不实施 | CSP 仍 Report-Only。无 report 证据前不切 enforce（架构/安全建议，不是已证 XSS） | report 观察 |
| HC-15 | 已纠正非缺陷 | `.vercelignore` 在基线 `8cd9abf` | — |
| HC-16 | 纯建议暂不实施 | compileSdk 35 警告不凭版本旧升级 SDK | — |
| HC-17 | 已修文案 | `packages/strings/zh.json` `voice_en_deep`: **英文低沉**；同步 `ios/.../zh.json` 与 `android/.../zh.json` | — |
| R01 | 已修（第一批 PASS） | getter-safe `getLocalStorage()` | 真实浏览器禁 getter |
| R02 | 已修（第一批 PASS） | 以运行汇总为准；返工 1 为 108 tests | — |
| R03 | 已修（第一批 PASS） | `__peekTimeout` 旧回调 | — |
| R04 | 已修 | 迟到回调最多一拍；若 `_nextAt` 仍 `<= now` 则 `_nextAt = now + interval`。正常准时仍绝对时钟；播放中改 BPM 不插拍/不重启。测试：落后 5000ms@120 只多 1 tick、下一 delay 500；40→208 不爆发 | 真机卡顿听感 |
| R05 | 已修 | `parseStrictInt` 要求整段 `/^-?\d+$/`；`80abc`/`1e2`/空/NaN **忽略**，不写 data/时钟。合法 40–208、±/drag/release/持久化保留。非法值下一拍 delay 仍 500，无 0ms 环 | — |
| R06 | 第二批策略 + 返工 1 修 B2-R02/R03 | 当前模式加载/失败可见；per-ctx `_dead`；失败可重建必要池 | **人耳同步仍待验** |
| R08 | 核实非缺陷 / 建议不实施 | 源码自证：click 4 池×3=12，voice 16×2=32，合计 **44**（旧 3×3+16×2=**41**，加 overlay +3）。单测 `ctxCount()===44`。不是 38→41。未用 helper 删除只是建议，未重构 | — |

**HC-10 长尾取舍（不机械替换）：** `en/p/` 现有 **10** 篇落地页 title/og/JSON-LD `name` 仍写 Little Rabbit Metronome；中文 `p/` 与根 `index.html` JSON-LD **保留** `alternateName: Little Rabbit Metronome`。批量改长尾会动 SEO/历史 URL 文案，超出「根/en 用户可见名 + metadata」范围。同端一致性：练琴主页/小程序英文名已与 AGENTS「Bunny Metronome」对齐；长尾仍旧名，作为历史别称清单留下。

### 第二批测试 / 构建（脱敏汇总）

环境同前。`ANDROID_HOME` 仅命令环境 `/Users/lazy/Library/Android/sdk`，未写 `local.properties`。未改 lockfiles。

| 命令 | 退出码 | 结果 |
|---|---|---|
| `cd miniapp && npm test` | **0** | **第二批快照** 100 passed。返工 1 见下 |
| `cd ios && swift test` | **0** | **第二批** 20 tests（含 EntitlementRefresh 6）。返工 1 未改 iOS，**引用此证据** |
| `xcodebuild … CODE_SIGNING_ALLOWED=NO` | **0** | **第二批** unsigned Simulator。返工 1 未重跑，引用此证据 |
| `./gradlew :policy:test` / `assembleDebug` | **0** | **第二批快照** 17 tests；返工 1 为 27 tests |

`swift test` 绿不能声称 StoreKit 真机账本或 MetronomeModel UI 测过。Android policy 绿不能声称 `PlayStoreAdapter` 已对 Play 服务跑过重连/购买。

---

## 第二批返工 1/3（B2-R01–R06）

首次独立复盘 **NEEDS_REWORK**：2 Major（B2-R01 Android busy 卡死、B2-R02 小程序冷启动静默跳拍）、0 Blocker。本轮集中返工。日志 `/tmp/metronome-audit-20260906/batch2/rework1/`（不覆盖第二批初次日志）。**等待复核，不是 PASS。**

| ID | 处置 | 文件/行 + 测试 |
|---|---|---|
| **B2-R01 Major** | 已修 generation：断线/关闭 bump `purchaseGen`、释放 Purchase/Restore busy；旧 `queryProductDetails` 不能 `launchBillingFlow` 也不能清新代 busy。Listener 无 token：仅 `awaitingPurchaseUi && busy==Purchase` 时结束购买；否则只刷新账本。重连 `autoLaunchPurchase=false`。免费练习不经过 store busy。 | `BillingSessionController.kt`；adapter `PlayStoreAdapter.kt` `session` 字段与 `queryThenLaunch`；`onBillingServiceDisconnected` / `close`。测试 `BillingSessionControllerTest`：`purchaseDisconnectReconnectReleasesBusyWithoutAutoLaunch`、`closeInvalidatesOldProductQueryAndDoesNotLaunch`、`staleQueryCannotClearNewerPurchaseOrLaunch`、`lateListenerDoesNotEndRestore`。`:policy:test` 27 / `assembleDebug` 0。**真 Play 断线仍外部** |
| **B2-R04** | 同路径：自动重试 3 次用尽后 `prepareUserReconnect()` 把 attempt 归零，用户 Buy/Restore 再开有界连接，setup 仍不弹购买页 | 测试 `reconnectExhaustedThenUserRetryBoundedNoAutoLaunch` |
| **B2-R05** | `restore(): StoreRestoreResult`（Done/Busy/Unavailable/Failed/Stale）。MainActivity 按结果设文案，不再在静默 return 后写 restore_ok/none。PENDING 用现有 `buying`，不解锁；取消 `buy_cancelled`、失败 `buy_failed`。Fake 保持。无新文案 key | `MetronomePolicy.kt` 接口；`MainActivity.kt` `restorePurchases`；测试 `restoreBusyAndNotReadyAreExplicit`、`pendingUpdateDoesNotUnlockAndUsesBuyingCopy`、`restoreStaleAfterDisconnectDoesNotLookSuccessful` |
| **B2-R02 Major** | `_tick` 按**当前模式** `modeStatus` 写 `audio_loading`/`audio_error`，成功清提示。未就绪跳过当前拍、不补发。未使用模式的 overlay error/ready 不改当前提示 | `index.js` `_tick`、`modeStatus`/`neededKeys`。测试 describe `B2-R02 current-mode loading is visible`（uniform/traditional/voice、永不 ready、逐个 ctx、overlay error 不误清） |
| **B2-R03** | 去掉全局 `_failed`。ctx `_dead` + 仍在当前 pool 才认 canplay/error。切语言销毁旧 voice。失败后 `_start`→`ensurePlayable` 只重建失败的 key，避免 44 泄漏。overlay 仍 0.28 | 测试 `B2-R03 destroyed ctx cannot pollute a new pool`；`failed uniform slots rebuild` |
| **B2-R06** | 前文 HC-06–11/17 标题与 8 领域矩阵、测试分层已改为当前状态；初检/第一批标快照。HC-10 写明只主页/小程序，不是全站 | 本文件 |

未借机做：Binding 进 App、预建池、音量非法、删 helper、模板品牌。

### 返工 1 命令（脱敏）

| 命令 | 退出码 | 层级 |
|---|---|---|
| `cd miniapp && npm test` | **0** | 108 passed（engine 10 + index 98）。funcs 94.36 / lines 96.43 / branches 84.35。门槛未降 |
| `node scripts/test_web_prefs.js` | **0** | Web 第一批 prefs，回归 |
| `python3 scripts/test_local.py` | **0** | 静态检查 |
| `./gradlew :policy:test` | **0** | **27** tests（BillingSessionController 10）。测的是 adapter 使用的控制器，不是 Play 进程 |
| `assembleDebug` | **0** | 编译 `PlayStoreAdapter`/`MainActivity` 接线；非真购买 |
| iOS `swift test` / unsigned | **未重跑** | 返工 1 未改 iOS。引用第二批 **20 tests** + **BUILD SUCCEEDED** |

### 未完成与外部阻塞

1. 真机 N1.25–N1.30、N2.16、来电 N1.31、小程序 InnerAudio 人耳同步。\
2. Sandbox / **真 Play 断线与购买**（B2-R01 控制器已测，服务未测）。\
3. Firebase 真实客户端配置。\
4. Connect / Play 账号与 IAP 商品。\
5. 微信上传包体；CSP report；`en/p/` 英文旧名。\
6. Play 12×14、pack 人耳。

工人停止（返工 1/3 历史段）。不 stage/commit。

---

## 第二批返工 2/3（B2-R07 / R08 / R09）

返工 1 的 Major 复盘已 PASS。导演读真实代码后不接受把下列三项当 Minor 结束。本轮只修这三条。日志 `/tmp/metronome-audit-20260906/batch2/rework2/`。

| ID | 处置 | 证据 |
|---|---|---|
| **B2-R08** | 已修。`ensureMode('voice')` 与同语言 `ensureVoice` 早退都走 `ensureFailedVoiceKeys()`：只重建 **失败** 的 v1–v16 + overlay，健康/加载中的池不换。真实 page `_start` 接线。死 ctx 仍 `_dead`。44 活实例。 | `index.js` `ensureFailedVoiceKeys` L184、`ensureMode` L178、`ensureVoice` L205。测试：`voice v5 failed slots recover on real page _start…`、`voice v1 failed slots recover on real page _start same language`（禁止只测 helper） |
| **B2-R07** | 已修。`PlayLedger.decide`：非 OK → `KeepExisting`（空列表也不能推出没买）；OK 空列表 → `Commit(false)` 权威撤销。Adapter `queryPurchases`/`refreshPurchases`/`currentEntitlement` 非 OK 不 `onEntitlementChange(false)`。Restore 非 OK → `Failed` 不是 `Done(false)`。PENDING/非本 SKU 不解锁。不本地强制 unlock。 | `PlayLedger.kt`；`BillingSessionController.onLedgerQuery` L93；adapter `currentEntitlement` L108、`restore` Failed 分支 L171、`refreshPurchases` L318。测试 `PlayLedgerTest`、`nonOkEmptyQueryKeepsExistingUnlock` |
| **B2-R09** | 已修。Restore 独立 `restoreGen` token：`beginRestore`/`finishRestore`/`failRestore`/`cancelRestore` 全校验。A 成功/失败/取消不得结束 B。Listener 仍只权威刷新、不结束 Restore。账本成功按序号提交；失败不抬 `lastAppliedLedgerSeq`，不会因后发失败永久压掉后发成功。`CancellationException` 只 `cancelRestore(token)` 后重新抛出。close 后 `canApplyPrice`/`onLedgerQuery` 为 IgnoreStale。无 token 的 `PurchasesUpdatedListener` **未**声称绝对不可达。 | `beginRestore` L169、`isLiveRestore` L74；adapter restore L151–191 `isLiveRestore` 先于 apply。测试 `restoreACannotFinishRestoreB`、`cancelRestoreOnlyEndsMatchingToken`、`laterFailureDoesNotBlockEarlierOrLaterSuccess`、`closeRejectsPriceAndLedger` |

**成功 empty vs 失败 empty：** Play 返回 **OK + 空列表** = 权威「本 SKU 无有效购买」，可以回锁并 `resolveBank` 回默认。返回 **非 OK + 空列表**（或根本没有列表）= 查询失败，内存里已验证的 `unlocked` 与用户 bank 选择保持不变；Restore 走 Failed/Unavailable。

### 返工 2 命令

| 命令 | 退出码 | 层级 |
|---|---|---|
| `cd miniapp && npm test` | **0** | 110 passed（engine 10 + index 100）。funcs 94.44。门槛未降 |
| `node scripts/test_web_prefs.js` | **0** | Web prefs |
| `python3 scripts/test_local.py` | **0** | 静态 |
| `./gradlew :policy:test` | **0** | **34** tests（controller 15 + PlayLedger 2）。控制器+账本解释；**不是**真 Play |
| `assembleDebug` | **0** | 编译 adapter token/ledger 接线 |
| iOS | **未重跑** | 本轮未改 iOS。引用第二批 **20 tests** + unsigned **BUILD SUCCEEDED** |

Adapter 的 `queryPurchases`/`restore` 已接 `session.isLiveRestore` 与 `onLedgerQuery`；JVM 测的是同一套 controller/PlayLedger，**不等于**调用方 `MainActivity` 已通过（B2-R10：adapter 不写 false 账本，但 `refreshEntitlement` 曾把 `resolveBank(..., false)` 写回 prefs）。不把 Play 进程当过。

### 未完成与外部阻塞

真 Play 断线/购买；Sandbox；Firebase 真实配置；真机听感；`en/p/` 旧英文名；商店账号。`PurchasesUpdatedListener` 与 Restore 的交叉时序无平台保证，只保证 listener 不结束 Restore busy。

工人停止（返工 2/3 历史段）。

---

## 第二批返工 3/3（B2-R10；B2-R11 仅记录）

rework2 复盘 **NEEDS_REWORK**，唯一 Major **B2-R10**。导演亲读：`onCreate` 构造 adapter 后立刻 `refreshEntitlement()`；未 ready 时 `currentEntitlement()` 为初始 false；原 L222–225 `prefs.copy(resolveBank(..., false))` 经 `applyToService`→`savePrefs` 落盘，随后权威 true 无法还原 pack。违反「未知/失败不破坏偏好」。日志 `/tmp/metronome-audit-20260906/batch2/rework3/`。

| ID | 处置 | 证据 |
|---|---|---|
| **B2-R10 Major** | 已修。`refreshEntitlement` 只更新 `unlocked`/`price` 并 `applyToService`（resolve 门控播放、savePrefs **原** click/voice/haptic 字段）。`onEntitlementChange` 是唯一权威写入：`MetronomePolicy.applyAuthoritativeUnlock`。`restorePurchases` 的 Done 不二次 resolve 写 prefs（避免协程晚到回写）。未购 `canUsePackBank` 仍挡选择。 | `MainActivity.kt` `onEntitlementChange` L90；`refreshEntitlement` L213–220；`applyToService` L266+ 仍 `resolveBank(prefs.*, unlocked)`。`MetronomePolicy.applyAuthoritativeUnlock`。测试 `EntitlementPrefsTest` 4 条：未知 false 存储不变但输出 default；权威 true 保留 pack；OK 空/false 持久化 default；**读 MainActivity 源码**断言 refresh 无 resolveBank、callback 调用 applyAuthoritativeUnlock、savePrefs 写 `prefs.clickBank`。`:policy:test` **38** / `assembleDebug` 0 |
| **B2-R11 Minor** | **不扩写。** `PurchasesUpdatedListener` 把当次 `purchases` 列表当完整账本 `Commit`。本 App 单 SKU，无独立复现「局部列表覆盖」。跨代无 token 时序**不**声称绝对不可达；失败查询仍 KeepExisting。 | `PlayStoreAdapter` listener；报告限制 |

其它 Suggestion 未插队。Web/小程序/iOS 本轮未改：引用 rework2 `npm test` 110 EXIT 0、`test_web_prefs`/`test_local` EXIT 0；iOS 第二批 20 tests + unsigned BUILD SUCCEEDED。

### 返工 3 命令

| 命令 | 退出码 | 层级 |
|---|---|---|
| `./gradlew :policy:test` | **0** | **38** tests（含 EntitlementPrefs 4，其中 1 条读 MainActivity.kt） |
| `assembleDebug` | **0** | 编译 MainActivity 接线 |
| miniapp / web / iOS | **未重跑** | 未改那些树 |

### 未完成与外部阻塞

真 Play / Sandbox / Firebase 真实配置 / 真机听感 / 商店账号。

工人停止（**第二批返工 3/3 历史段**；当时指令仍禁止 commit。独立复盘已 PASS）。

---

## 第三批（剩余本地问题 · 待复盘）

新授权，不改写第二批 3/3 记录。日志 `/tmp/metronome-audit-20260906/batch3/`。未回退 B2-R01–10。

| ID | 处置 | 证据 |
|---|---|---|
| **B2-R11** | 已修（Billing 7 官方：listener 是 **updates** 不是完整库存，[PurchasesUpdatedListener](https://developer.android.com/reference/com/android/billingclient/api/PurchasesUpdatedListener) 核验 2026-09-06）。empty/PENDING/非本 SKU **不** Commit 撤销；本 SKU PURCHASED 且 `awaitingPurchaseUi` 才乐观正向 grant（`allowRevoke=false`）并 **始终** 完整 `refreshPurchases`；失败/取消 Keep。跨代：未 awaiting 的迟到 listener **不**乐观 grant，只走完整 query。无 token 不能精确关联旧 UI 与事件，**不**声称绝对不可达。 | `PlayLedger.planListener`；adapter listener；测试 `listenerPartialEmptyPendingOtherSku…`、`listenerPartialCannotRevokeExistingGrant`、`olderQueryEmptyDoesNotOverrideNewerGrant` |
| **B2-R12** | 已修。UI 用 `EntitlementFlow.State.display`（门控后的 bank/haptic）。展示态点 default 是 `KeepStored`，不写回 pack 选择。权威 true 恢复原选择；权威 false 才 persist default。未购点 pack 仍 `LaunchPurchase`。 | `EntitlementFlow.kt`；`MainActivity` `MacaronApp(prefs = …display)`、`applyPick` |
| **B2-R13** | 已修。主证据是 `EntitlementFlow` 运行时态（存储/展示/播放）。接线测试只断言 MainActivity **调用** Flow API，不当运行时代替。 | `EntitlementFlowTest` 4 + `EntitlementActivityWiringTest` 1 |
| **小程序建议** | 已修。运行中切 voice：`ensureMode('voice')` 重建失败 overlay + 坏 vN。stop 清 `audioNote`。删 `onStatus`/`clicksReady`。vol 用 `clampVolInput`。onLoad `init()` 预建 click 不 play。 | `index.js`；`batch3 miniapp remaining` 测试。114 tests |
| **iOS 测试替身** | `FakeStoreAdapter` / `EntitlementObserverBinding` 移到 `BunnyMetronomeTests/StoreTestDoubles.swift`，App 的 `UnlockStore.swift` 只留协议/Gate/`StoreError`。`swift test` 20；unsigned App **BUILD SUCCEEDED**。policy 绿 ≠ StoreKit/model | 见 batch3 ios 日志 |
| **英文品牌** | `en/p/` 10 篇 + `tools/template_en.html` + `en/landing.html` 用户可见名 → Bunny Metronome。JSON-LD `alternateName` 仍 Little Rabbit Metronome。URL/slug/hreflang 未改。中文 `p/`、`landing.html`、根 `index.html` 的 alternateName 仍历史别称。 | `scripts/test_local.py` `test_en_brand_bunny` |
| **HC-14 CSP** | **不切 enforce。** `vercel.json` 仍 `Content-Security-Policy-Report-Only`。本批无 CSP report 样本，强制 enforce 可能打断友盟/GA 内联脚本。建议观察 report 后再动。 | 核实性质：架构/安全建议 |
| **HC-16 SDK 警告** | **不升级。** `compileSdk = 35` 与 AGP 8.5.2 的警告仍在；`assembleDebug` EXIT 0。无功能复现。 | 工具链警告 |

### 第三批命令

| 命令 | 退出码 | 层级 |
|---|---|---|
| `cd miniapp && npm test` | **0** | 114 passed；funcs 97.18。门槛未降 |
| `node scripts/test_web_prefs.js` | **0** | VM 内 SecurityError getter。**不是**真实浏览器隔离上下文 |
| `python3 scripts/test_local.py` | **0** | 含英文品牌回归 |
| `./gradlew :policy:test` | **0** | **42** tests（返工 1 增测后见下节） |
| `assembleDebug` | **0** | adapter/MainActivity |
| `cd ios && swift test` | **0** | 20 tests（policy+替身，非 StoreKit UI） |
| unsigned `xcodebuild` iPhone 17 | **0** | `BUILD SUCCEEDED` |

**B3-R02（第三批首次复盘）：** 上表「无隔离 Playwright/profile 未做」不真实。导演已跑 `/tmp/metronome-audit-20260906/batch3/director-browser.txt`：**首次 EXIT 1**（`page.waitForFunction` currentTime 超时 30s）。`director-browser-attempt2.txt` 为 **state-only**（明确不断言音频时钟推进）：中英页 localStorage getter 抛 `SecurityError` 时默认 `120/4/uniform/85`，`_ls=null`，19 buffers，play/stop/改 BPM 无 `pageerror`；离线 `/` 与 `/en/` 语言正确；**英文 query `/en/?bpm=80&mode=voice` 错成中文**（htmlLang `zh-CN`）。`currentTime` 约 `0.0058` 不推进，**不能**写成音频/听感 PASS。VM prefs 测试仍不能冒充浏览器。返工 1 的 Playwright 见下节，不回写本段导演日志。

### 残留矩阵（第三批当前；上表 8 领域「体验国际化」格是第二批快照，当时 `en/p/` 仍 Little Rabbit）

| 项 | 本地代码 | 仍待 |
|---|---|---|
| B2-R11–13 / 小程序剩余 / iOS 替身 / 英文长尾品牌 | 返工 1 代码已 PASS 并进 `develop` | 真机人耳 / 商店仍未勾 |
| HC-14 CSP | 仍 Report-Only；无 report 样本，**不**切 enforce | 观察 report |
| HC-16 SDK 警告 | compileSdk 35 / AGP 8.5.2 警告仍在；`assembleDebug` 0，**不**升级 | 工具链 |
| 真实浏览器禁 storage getter / 断网 PWA | 导演 attempt2 已做隔离 Playwright（见 B3-R02）；英文 query 离线语言错（B3-R01） | 听感/currentTime 推进 |
| iOS `swift test` | 20；policy+替身。Package 仍排除 StoreKit/model | 不等于真机账本 |
| 外部发布 | 未勾 | 真机 N1.25–N1.31 / N2.16；Sandbox / 真 Play；发行证书 / Connect / Play 账号 / IAP；Firebase 真实配置；pack 人耳 |

### 建议提交分组（本轮 **不** stage/commit/push；最终只推 `origin develop`，不推 audit 分支、不推 `main`）

复盘通过后由导演：快进 `develop` → 切本树到 `develop`（保留未提交修改）→ 按下列单元提交 → 只推 `origin develop`。推前重查远端，拒绝非快进。不扩 CI。

1. **规则/契约**：`AGENTS.md`（含提交节奏、默认 `develop`）、`docs/engine-contract.md`、`docs/iap.md`
2. **Web prefs**：`js/prefs.js`、`index.html`、`en/index.html`、`sw.js`、`scripts/test_web_prefs.js`（本文件门槛：`node scripts/test_web_prefs.js`）
3. **小程序**：`miniapp/pages/index/*`、`miniapp/tests/*`、`miniapp/utils/i18n.js`（门槛：`cd miniapp && npm test`）
4. **Android billing/UI/policy**：`android/policy/**`（含 `EntitlementFlow.kt`、`PlayLedger.kt`、`BillingSessionController.kt` 及 tests；Flow 测试在 `EntitlementPrefsTest.kt`）、`PlayStoreAdapter.kt`、`MainActivity.kt`（Flow 被 Activity 调用，须同组）。门槛：`:policy:test` + `assembleDebug`
5. **iOS 权益**：`UnlockStore.swift`、`StoreAdapter.swift`、`MetronomeModel.swift`、`StoreTestDoubles.swift`、`MetronomePolicyTests.swift`
6. **Firebase Core**：`project.pbxproj`、`AppAnalytics.swift`（与 5 同组也可，因同 xcodeproj）。门槛：`cd ios && swift test` + unsigned `xcodebuild`
7. **品牌/文案**：`packages/strings`、原生 copies、`tools/template_en.html`、`en/p/*`、`en/landing.html`、`DEPLOY.md`、`scripts/test_local.py`（含 `test_web_app_hooks` 与 `test_en_brand_bunny`；须在组 2 的 prefs.js 接线之后，与 `en/p` 同组，避免中间提交品牌断言失败）
8. **审计文档**：`docs/audits/2026-09-06-health-check.md`

跨组：`test_local.py` 同时覆盖 Web prefs 接线与英文品牌——跟组 7，组 2 不要先提交会失败的品牌断言。Android 4 不能拆开 Flow 与 MainActivity。iOS 5+6 同 xcodeproj 以免中间构建断。

第三批首次独立复盘 **NEEDS_REWORK**（历史：当时仍待复盘）。下面是返工 1/3，不覆盖上表第三批首次命令快照。

---

## 第三批返工 1/3（代码独立复盘 **PASS** · 0 Blocker / 0 Major · 不是商店可发布）

日志 `/tmp/metronome-audit-20260906/batch3/rework1/`。真机证据 `/tmp/metronome-audit-20260906/device-validation/`（修复前 `06-pre-fix-device.md` 与修复后 APK 指纹分开，不混用）。

| ID | 处置 | 证据 |
|---|---|---|
| **B3-R01** | `sw.js` 保持 HTML network-first。离线：精确 `caches.match(req)` → `ignoreSearch` 同路径 → `languageHome(pathname)`（`/en` `/en/` `/en/*` → `/en/index.html`，其余 → `/index.html`）。不把所有英文 URL 强制成首页。缓存名 `xiaotutou-v6`。 | `scripts/test_sw_fetch.js` 真正 dispatch `fetch` handler；Playwright 离线 `/en/?bpm=80&mode=voice` htmlLang/engine.lang=`en`，bpm 80，sm voice，未点播放 |
| **B3-R02** | 纠正「无 Playwright」记录，引用导演 `director-browser.txt` EXIT 1 与 `attempt2` state-only。currentTime≈0.0058 ≠ 听感 PASS | 本文件 B3-R02 段；不改导演日志 |
| **B3-R03** | 测试 target Sources 补 `StoreTestDoubles.swift`（仅测试 target）。双模块 import（SPM `BunnyMetronomeCore` / Xcode `BunnyMetronome`） | `swift test` 20；unsigned App BUILD；**`xcodebuild build-for-testing` TEST BUILD SUCCEEDED**，产物含 `FakeStoreAdapter` / `EntitlementObserverBinding`。`swift test` 本身仍不能覆盖该缺漏 |
| **B3-R04** | `PlayLedger.consumeListener`：仅 `optimisticGrant` 才 Commit(true)；`ackOwned` 只 ack。adapter 按 consume 分支，不再 `ackOwned \|\| optimisticGrant` | policy **45** tests（含 consume + session 不 grant + adapter 源码接线） |
| **B3-R05** | Suggestion：`EntitlementFlow.Confidence` 写入但 MainActivity 未分支消费。本轮不扩大状态重构 | 如实记录 |
| **B3-R06** | `miniapp/tests/index.test.js` 去掉 EOF 多余空行 | `git diff --check` 该文件 EXIT 0 |

### 返工 1 命令

| 命令 | 退出码 | 层级 |
|---|---|---|
| `node scripts/test_sw_fetch.js` | **0** | 执行 sw.js fetch handler（假 caches + 离线 fetch） |
| `NODE_PATH=/opt/homebrew/lib/node_modules node scripts/test_sw_offline_playwright.js` | **0** | 隔离 Chromium；拦外部请求；**未** start 音频。finally 关 browser/杀 18765 |
| `node scripts/test_web_prefs.js` | **0** | VM getter |
| `python3 scripts/test_local.py` | **0** | 含 sw fetch |
| `cd miniapp && npm test` | **0** | 114 passed；funcs 97.18。门槛未降 |
| `./gradlew :policy:test` | **0** | **45** tests FAIL 0 |
| `assembleDebug` | **0** | |
| `cd ios && swift test` | **0** | 20 |
| unsigned simulator `xcodebuild` | **0** | BUILD SUCCEEDED |
| `xcodebuild build-for-testing` iPhone 17 `CODE_SIGNING_ALLOWED=NO` | **0** | **TEST BUILD SUCCEEDED**；`StoreTestDoubles.swift` 编进 `BunnyMetronomeTests.xctest` |

### 真机（有界 · 停播）

修复前覆盖安装：Android `2.1.2` sha `b13ed001…`；iOS Development 签名 `2.1.2/4` Mach-O `917e7832…`。详见 `device-validation/06-pre-fix-device.md`。

修复后：**仅 Android** 因 adapter 重编覆盖 `14e35f52054462563b751e838b2c2f828884bc65bd49fe4727022278896daea0`，`force-stop` 后无 Service。iOS 只动测试 target / pbxproj，**未再装 App**，复用修复前 `2.1.2/4` 安装证据。Web 走 Playwright，无真机 WebView。

上表「真机」段是 **修复前/返工覆盖安装当时** 的记录，`06-pre-fix-device.md` 与 `04-android-cases.json` **原样保留**。对 04 脚本的校正见下一节（不要把当时的 `ok=True` 当成 BPM/N2.10 已证）。

### 导演提交门槛复跑（推送 `develop` 时）

| 日志 | 结果 | 说明 |
|---|---|---|
| 工人 rework1 目录 | Web prefs / SW fetch / test_local **0**；小程序 **114**；policy 45；assembleDebug 0；swift 20；`build-for-testing` TEST BUILD SUCCEEDED | 复盘前 |
| `/tmp/metronome-delivery-android.txt` | **失败**：`Task 'assembleDebug' not found in root project 'BunnyMetronome'`（**未设置 SDK / ANDROID_HOME**） | **不隐藏** |
| `/tmp/metronome-delivery-android-sdk.txt` | `ANDROID_HOME=/Users/lazy/Library/Android/sdk` 后 `:policy:test` 与 `:app:assembleDebug` **BUILD SUCCESSFUL in 1s**，`40 actionable tasks: 2 executed, 38 up-to-date` | **增量**，不是 fresh clean |
| `/tmp/metronome-delivery-ios-build-for-testing.txt` | `** TEST BUILD SUCCEEDED **` | Xcode 测试 target 含 StoreTestDoubles |

### 导演 6 次提交（仅 `origin/develop`，`main` 未动）

| SHA | 内容 |
|---|---|
| `f791042` | 规则 |
| `777ad17` | Web / 离线 / 英文品牌与回归 |
| `1969b73` | 小程序 |
| `baa0b5e` | 共享中文文案 |
| `f86cb63` | Android |
| `d368004` | iOS（pbxproj + Firebase Core）HEAD |

无新分支、无 tag、无发布。53 项源码/报告内容与复盘指纹提交前全匹配。本文件当时未进那 6 次提交。

### 04 脚本 / prefs 校正（不改原日志文件）

- `ok=True` 只表示 **未抛异常**，不是 BPM==target、不是 task 已消失。
- `hold_bpm` **从未 assert** 实际 UI BPM。
- `am task remove` 在本机 **rc=255** `unknown command 'remove'`（help 无此子命令）。**不能**由当时 Service 仍在推断 N2.10 产品缺陷。
- `stop_playback` 可能找不到 ❚❚ 却写 already-idle。
- L390 `run-as cat > shared_prefs/metro.xml` **无 stdin**；对照 `02-android-prefs.xml`，map **未被截断**。测试中 bpm/lang 被 UI 改过。未用硬编码写回 prefs。最终 `metro.xml` 与原始备份一致：`85 / 3/4 / voice / zh`，bank 仍 default。

### 补充真机 v2（`/tmp/device-validation/`，返工后 APK 仍在机上）

断言脚本 `android_validate_v2.py` → `android-v2-cases.json`。**PASS 0**。**BLOCKED：** `am-task-remove-support`（命令不支持）。**FAIL：** play-pause（点 ▶ 后 UI 仍「待开始」，但 Service `startRequested`+foreground、`jpq:metro` held、notif key 属本包）以及随后 `app_ui_not_visible` 导致 40/120/208 **未开 60s**、设置滚动/通知暂停/划掉任务 **未做成**。force-stop 只作收尾（pid none，无 Service），**不是**划掉 PASS。

状态验证 ≠ 人耳。扬声器/静音键/听感仍 **未** PASS。sideload ≠ Play 账本。

脚本未调用 set-volume。v2 开头 `volume_music_speaker=11`，结束读到 `0` 且 `STREAM_MUSIC Muted: true`。未做全局取消静音。

iOS：`iproxy`/`pymobiledevice3`/`wda` **无**。usbmuxd 在；Connect 8100 **Result Number=3**。xctrunner 曾因设备 **Locked** 启动失败（FBSOpenApplicationErrorDomain 7）；解锁后 `devicectl process launch` 成功，**仍** 8100 无监听。**单纯 process launch ≠ XCTest。** 已 terminate WDAProbe/Bunny 残留 pid。无 iOS 播放/BPM/锁屏 UI 证据。

可能的源码观察（v2 当时待协调）：Android UI「待开始」与 FGS 同时存在。**D1** 按基线源码链修复 recreate/rebind 脱钩，**不**把 v2 同实例 FAIL 当作已证。focused-playback 结论见 D1 节。

### 外部仍不能勾

N1.25–N1.31 / N2.16 人耳；Sandbox / 真 Play 扣款；发行证书 / 商店账号；Firebase 真配置；pack 人耳。

工人停止。**不** git add/commit/push。导演核对本文后单独提交报告。代码可提交 ≠ 可发布。

---

## D1 · Activity 重建与 Service 播放脱钩（代码独立验收 PASS · 不是 v2 同实例 FAIL 的实证）

基线 `8cd9abf` 已有：`MainActivity.playing` 初始 `false`；`onServiceConnected` 不读回 Service；`toggle` 以 UI `playing` 分支；`onDestroy` 不按 owner 清回调。Service 仍播放时 Activity recreate/rebind → UI idle；第一下 toggle 当 Start（clock 幂等不双钟）只把 UI 设 true，第二下才 Stop。

与 v2 play-pause FAIL **分开**：v2 不核 `uiautomator dump` 退出码且复用固定 XML，动画失败可假造 UI/Service 矛盾。focused-playback（`/tmp/device-validation/focused-playback/CONCLUSION.md`）**既未证实也未推翻** v2 同实例 FAIL；测量漏洞已确认。adb 掉线 **不是** 代码失败。

### 本轮最小修复（与测试同一提交）

- `PlaybackBind.isPlaying` / `uiFromService` / `toggleAction`：只读 `stopped` 与 `scheduler.playing`；toggle **不**用过期 UI `playing`。
- `PlaybackListenerGate`：新 owner 覆盖后，旧 Activity `clear` 不得清掉新回调；`runOnUiThread` 检查 `isDestroyed` 与 `listenerGen`。
- `MetronomeService.setUiListener` / `clearUiListener` / `isPlaying()`。`onDestroy` **不停** Service（后台/锁屏承诺）。
- 未改 `AudioTrackClock`、拍钟、采样、`configChanges`、IAP、音频焦点。

JVM：`:policy:test` **53** FAIL 0（含 bind 对齐、toggle 在 service true/UI false 时 Stop、旧 owner 释放、停后 clearBeat；MainActivity **调用** 这些 API 的接线测试）。**没有** instrumentation recreate（不把 JVM 冒充真机重建）。

构建：`ANDROID_HOME` 下 `assembleDebug` EXIT 0（增量 9 executed / 29 up-to-date）。新 APK sha256 `af4e0984d20a9cfa9bd75adeb1c5e128fedeef32cccba18300afa5b3ac7c9672`。

### 真机修复后验证

**BLOCKED**（`adb devices` 空；按导演要求不轮询、不安装/启动手机 App、不改音量）。覆盖安装与 recreate 重验 **未做**。

日志 `/tmp/metronome-audit-20260906/device-followup-d1/`。独立只读验收 **PASS：0 Blocker / 0 Major**；5/5 修改文件指纹一致。本轮基于 `237bfd9`，修复、必要测试与本节记录一起提交到 `develop`，`main` 不动。

导演提交前复核：5/5 指纹匹配后，仅更新本节验收结论；`:policy:test` + `assembleDebug` 再次 EXIT 0（`/tmp/metronome-delivery-d1-android.txt`，增量 2 executed / 38 up-to-date）。真机状态仍为上文 **BLOCKED**，不因代码通过而勾上线清单。

独立复盘仅记录、不返工：
- **D1-M1 Minor**：多个 Activity 同时存活时，前台恢复的旧实例可能未重新取得回调所有权；`onResume` 能读回播放状态，但后续 beat/stop 回调可能缺失。未做真机复现。
- **D1-M2 Minor**：绑定时 keep-screen flag 先按旧值计算，再按 Service 状态纠正；两套亮屏逻辑可后续统一。
- **D1-S1 Suggestion**：`PlaybackListenerGate.shouldDispatch()` 仅测试使用，可后续清理；本轮不扩修。

## 2026-09-07 · D1 真机补充验收（部分通过，非发布验收）

证据：`/tmp/metronome-device-20260907/RESULTS.md`、`android-result.json`、唯一新 UI XML 与命令日志。源码基线 `04246e6`；本轮未改产品代码。Android 用同 debug 签名保留数据覆盖安装 D1 APK `af4e0984d20a9cfa9bd75adeb1c5e128fedeef32cccba18300afa5b3ac7c9672`。

- **Android UI/Service 部分通过**：启动显示 85 BPM / 3/4 / 默认童声；精确断言 40 BPM 后运行至少 60 秒，新鲜 UI dump 显示正在播放且 FGS / `jpq:metro` 同时存在；一次暂停后 UI 回待开始、FGS 与 WakeLock 释放。设置可见音色工坊和 sideload 限制文案，不等于 Play 购买或 Restore 验证。
- **未完成**：120/208 的测试点击未达到目标值，因此没有启动对应 60 秒测试；这是测试操作失败，不是已确认的产品 BPM 缺陷。立即播放、HOME 等步骤遇到新 dump 文件缺失，按 UNKNOWN/BLOCKED 处理，未读取旧 XML。通知暂停、真实划掉任务、Activity configuration recreate 未完成。`am task remove` 返回 255、不支持，不能据此判产品缺陷。
- 40 BPM 的时间对齐证据支持该场景下一次暂停正常；既不能替代 Activity recreate 验收，也不能解释或彻底排除前次 v2 的同实例观察。无新增源码缺陷定论。
- **iOS 功能验证未完成**：现有 2.1.2/4 Development App 保留。本次错误地将模拟器 `.xctestrun` 用于真机 `test-without-building`，尝试安装 `Debug-iphonesimulator` 产物，返回 `0xe8008014`。这是测试产物/目标不匹配，不能认定 App 或现有 Development 证书无效，也不能证明真机测试不可行。没有可用的真机签名 UI runner 验证结果；播放、语言、BPM、后台仍未验。
- **音频与清理**：状态验证不等于扬声器输出或节拍听感；Android 开始时媒体静音，结束观察到 Muted false / volume_music_speaker 10，工人报告未调用改音量或取消静音命令，变化原因未确认。偏好通过 UI 恢复到 85 / 3/4 / voice / zh。工人结束时确认 Android 无本 App 进程/Service/WakeLock，iOS 无 Bunny/WDA 残留进程。

N1.25–N1.31 / N2.16 等完整发布条目保持未勾；真 Play/Sandbox 购买、物理静音键、目标速度听感与商店配置仍需验证。本节仅归档新增证据，不宣布全项目完工或可发布。

## 2026-09-07 · 真机控制恢复与 opt-in 测试设施收口（非发布验收）

本轮基线 `ae8b14c`，未改产品源码、采样、IAP 或发布规则。以下新增证据补充上节的历史 BLOCKED，不覆盖或删除旧失败记录。原始证据保留在本机 `/tmp/metronome-device-20260907/`；这些临时路径不是仓库内永久附件。

### iOS · iPhone 11 真机 UI / 生命周期

- 复用既有 Development 签名，构建 `Debug-iphoneos` 并保留数据覆盖安装成功（`ios-reliable/app-build.txt`、`app-install.txt`）。App executable SHA256：`23a25575dd3fa96ea6226e6aaab824573795903235ef1c1bd33287f55853f14e`。
- 使用真机 `.xctestrun` 通过 XCTest 启动已签名 Appium WDA，经本机 USB relay 控制成功；不再把普通 Runner launch 或模拟器产物当作真机 XCTest。WDA 临时源码 revision `4fd551c39d08bdd86a2e8a447f4133cc6d8741ec`，未加入产品仓库。
- `ios-reliable/core-result-v2.json`：一次播放/一次暂停、中英切换、精确 40 / 120 / 208 分别保持 **60.407 / 60.362 / 60.408 秒**，每 15 秒检查新 UI；播放中 120→121 保持播放态，之后暂停。全部仅 **PASS_UI_STATE(_ONLY)**，不是节拍听感/无插拍证明。恢复 85 / zh 并关闭 App 成功。
- `settings-result-v2.json`：三种模式、六种预设拍号 UI 断言通过；滚动显示 Restore 时 WDA 超时，该轮 `restore-baseline` 亦 FAILED（timed out）。基线随后另行恢复，并在后续 background / repo-smoke 运行中核对为 85 / 4/4 / voice / zh；树中隐藏的 Restore 不算可见验收，系统购买/Restore **未执行、未通过**。初次 emoji predicate 失败属于工具错误，记录保留。
- `background-result-v2.json`：120 BPM 播放后 HOME，15/30/45/60 秒目标 App state=3，保持 **60.0198 秒**；回 App 新 UI 仍播放，一次暂停，恢复 85 并关闭。仅 **PASS_UI_LIFECYCLE_ONLY**，不证明后台有声、物理锁屏或静音键。
- 入仓 `scripts/test_ios_device_wda.py` 的首轮 `repo-smoke` 在清理时 WDA 连接丢失，**exit 1**；导演按观察到的 pid 关闭目标 App。新 WDA 下 `repo-smoke-fresh/result.json` 全部 smoke 断言、恢复和关闭通过，**exit 0**；三段 60 秒明确 SKIPPED。长保持证据来自前述临时 v2 harness，不能冒充最终 repo smoke 重跑。
- `practice-idle-app-crop.png` 仅为练琴屏实机裁剪图，不是完整 Connect 截图套件。未获得 Restore 可见或真实购买证据。

### Android · OnePlus 8T 真机证据与设施修复

- `android-reliable/smoke-a01b.txt`：a01 真正 Activity recreate 后 UI / Service / scheduler 播放态一致，一次暂停释放 FGS / WakeLock；**OK (1 test)**、方法 STATUS 0、终结 `INSTRUMENTATION_CODE:-1`。这是 D1 recreate 的新增真机通过证据。
- 早期 runner 部分 120/208 保持和 HOME 方法状态记录仅属历史部分证据。`instrument2.txt` / `instrument3.txt` 的 `Process crashed` + `INSTRUMENTATION_CODE:0` 即使外层 EXIT 0 也**不通过**。通知手指暂停、真实 recents 划掉、完整最终 suite 均未验收；不把工具崩溃直接定为产品缺陷。
- 新增 androidTest 与单方法 wrapper。a07 未点到通知 Pause 必失败，ACTION_STOP 仅清理；a11 共进程自杀场景明确 Ignore，需独立外部 UI harness；BPM 步进改 Compose 点击逐步回读；移除 debug `ui-test-manifest`，避免向分发的 debug APK 注入测试 Activity；删除未用 forceStop helper。
- wrapper 精确单方法、JUnit/终结码/状态序列判定、拒绝 error/skip/shortMsg、超时、非零 adb rc、防旧证据目录、按包 UID 过滤日志、清理失败非零退出。独立只读复核主要变更 PASS；指出 a11 文案尚未落盘后，导演实际修正文案，明确 wrapper 不实现划掉。
- `wrapper-offline-checks.txt`：8 类 verdict fixture、非法 selector 拒绝、mock adb 清理成功/失败退出判定通过；**不是设备重跑**。最终 wrapper 修订后未再次运行 instrumentation。
- 测试会改偏好，a09 不是通用恢复且曾超时。导演经真实 UI 恢复 **85 / 3/4 / voice / zh**，完整 prefs 与原始备份一致。clean app APK SHA256 `d760a1ea305affce4b9205cc03f8400ab3db08448a8a9c1de7abb935073e4285` 同签名 `install -r` 成功；最终安装后 `prefs-after-clean-install.xml` 再与 `prefs-backup.xml` 完整比对相等。证据在 `android-cleanup-director/`。无音量设置写入。

### 收尾、边界与未完成项

- Android 清理记录：无目标 pid/Service，当前 Wake Locks size=0；历史 ACQ/REL 不当作当前持锁。恢复及覆盖安装不算测试通过证据。
- iOS 最后只打开设置、未播放。2026-09-07 03:46 PDT 观察目标 pid 5374 后正常 terminate，重新按目标 executable 查询无 Bunny / WebDriverAgentRunner；停止本轮精确路径 USB relay pid 78559。日志 `ios-reliable/final-cleanup/result.txt`。原偏好 85 / 4/4 / voice / zh 保持；未修改设置音量。
- 操作说明统一放在 [原生真机测试工具](../testing/native-device-validation.md)，不新设发布清单。脚本 opt-in、不接普通 CI、不跑无人授权设备；中断缺 verdict 不能当绿，偏好须经 UI 恢复。
- **仍未完成**：人耳 40/120/208 时钟与 pack、iOS 静音键/物理锁屏出声、Android 通知/真实划掉、Sandbox/Play 买与 Restore、发行证书及商店配置/上架。N1.25–N1.31 / N2.16 完整条目继续不勾；未上传商店、未发布、未宣称全项目完成。

提交前离线闸门：`:policy:test :app:assembleDebug :app:assembleDebugAndroidTest --offline` **BUILD SUCCESSFUL / exit 0**（`android-reliable/final-gates.txt`）；JUnit XML 合计 **53 tests / 0 failures / 0 errors / 0 skipped**。两 Python 脚本 `py_compile`、`git diff --check` 通过；最终 wrapper 离线重读历史 a01 判真、instrument2/3 判假。未为此重跑设备。最终构建 app APK SHA256 仍与上文 clean install 相同。
