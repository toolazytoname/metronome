# 全项目深度检查与可靠性优化

日期：2026-10-02。工作分支：`develop`。范围：Web 中英练琴页、PWA、长尾页面、小程序、iOS、Android Play/CN、鸿蒙、采样/文案、构建与发布脚本、测试依赖。

> 本文记录发现、修复与验证证据，不是第二份上架 TODO。发布关口继续以 `AGENTS.md` 为准。没有证据证明产品已经“业内第一”或可以直接发布。

## 结论

本轮发现并修复了实际影响启动、节拍恢复、播放生命周期、离线更新和发布产物的缺陷。自动化测试与可用的本机构建通过；浏览器完成中英在线/离线练琴实测。**本轮尚不能证明原生锁屏音频、真实 IAP、鸿蒙 SDK 编译与设备行为达标。**

开始时已有的 `ios/BunnyMetronome/ContentView.swift`、Xcode 工程版本号、商店文案与三张 iPad 截图改动保留，未覆盖、回滚或归为本轮新成果。没有提交/推送 Git、创建 PR、打 tag、上传商店或触发发布。

## 已处理的问题

| 范围 | 原问题与风险 | 修复及验证 |
|---|---|---|
| Web / PWA | 新 HTML 可以配上旧缓存 JS。实测 `parseInteger` 不存在，自定义拍号按钮无效 | 核心脚本使用内容 hash 查询参数，中英页与 SW 预缓存同步；安装绕过 HTTP 旧缓存；升级到 v10。实测从旧缓存升级后首次打开即能应用 16 拍。激活只删除自身旧缓存 |
| Web 输入 | URL 接受科学计数法/十六进制/小数；引擎可被 NaN 污染 | URL、UI、引擎均拒绝非法完整整数；非法拍号草稿不应用；追加反例测试，保留合法值范围 clamp |
| Web 异步 | 旧采样解码可能覆盖重载；AudioContext resume 可无限等待 | 加载代次隔离、8 秒恢复截止时间、失败可重试；前台恢复失败显示错误，过期失败不影响新一轮 |
| Web 状态与操作 | 加载时立即声称正在播放；折叠设置仍可聚焦；音效用 div；控件缺标签 | 可取消的可见加载状态与 `aria-busy`；折叠区 `inert`；原生按钮、选中态、焦点轮廓、控件标签；BPM 边界禁用 |
| Web 小屏 | 320×568 默认播放按钮位于首屏以下；多拍号挤成最多八列 | 保留现有兔子、色彩、文案与 URL；调整小屏留白，拍点最多四个一行且末行居中。中英默认播放按钮底部实测 553px，完整落在 568px 视口内 |
| iOS 时钟 | 主队列阻塞后预约一串已过期节拍 | 超过一个间隔的积压从当前 player time 恢复；正常改 BPM 不插拍语义不变；40/120/208 的 60 秒时间线与阻塞恢复测试 |
| iOS 回调 | UI 层再排一次 Task 后，旧拍点或中断可能影响新一轮 | 在 Model 层再次检查运行代次；Store observer 协议声明主线程隔离，消除相关 Swift 6 并发警告 |
| Android 采样 | 只检查三个 click 即发布 ready；解码失败后没有实际重试；空 PCM 可被当作静音样本 | 35 个免费采样完整检查、后台单次加载和重试、解码超时与 finally 释放、空 PCM 拒绝、不可变缓冲区发布 |
| Android 生命周期 | 旧线程使用共享 running 标记可能被重启复活；主线程 join；设备错误可能崩溃或假播放 | 每轮独立 scheduler/取消态，旧线程只释放自己的 AudioTrack；暂停解除阻塞；短写正确推进，失败通知 UI 并清理 FGS/CPU 锁；尊重音频焦点结果 |
| Android 偏好/国际化 | 损坏 JSON 可导致启动崩溃；系统语言可能改变 `%02d` 文件名 | 损坏偏好回退系统语言默认值；采样编号固定 ASCII；地区切换回归测试 |
| Android 依赖 | Play Billing 的传递依赖解析到 Fragment 1.1.0，触发 ActivityResult lint 错误 | 仅 Play 变体指定兼容版本 1.6.2；未扩展 CN 依赖；两变体 lint 均无错误 |
| 鸿蒙音频 | start/stop 跨异步创建导致旧 renderer 复活；忽略短写；启动失败不总释放资源 | 串行 renderer 所有权、运行代次与 UI 启动确认；短写重试余段、零写失败；stop/release 分别兜底；平台模拟测试 |
| 鸿蒙采样与页面 | 只收到 click 就 ready；发完资源误当完成；迟到回调、后台授权、偏好未 flush | 所有免费采样 + worker 完成确认；读取/播放代次隔离；后台与亮屏操作串行；偏好 put/flush 串行 |
| 鸿蒙 WAV | 有符号 chunk 长度可倒退循环；缺 fmt、错误位深或截断仍可能被接受 | 无符号 RIFF 边界检查、PCM/单声道/44.1k/16-bit 校验；35 个真实 WAV 与恶意/截断输入测试 |
| 发布管线 | 已生成的 Play 签名 APK/AAB 因检查旧目录而被漏收集 | 修正产物检查路径；运行真实收集脚本的临时假产物测试，覆盖有/无签名产物，不执行发布 |
| 部署与资产 | Vercel 忽略列表没有鸿蒙目录；iOS 文案表与源表不完全一致 | 排除鸿蒙和本地工具目录，补签名文件忽略；中英 76 个文案 key 同步；跨端采样字节一致性检查 |
| 测试供应链 | 官方 npm audit 报告 1 高危 + 3 中危项，均在测试依赖链 | Vitest/coverage 升到 4.1.11，显式声明 esbuild，重建 lock 并 npm ci 重验。保留 Node 20 CI 兼容性，没有强行升到要求更高 Node 的 5.x |

## 验证结果

| 检查 | 本轮结果 | 边界 |
|---|---|---|
| `./scripts/check-quality.sh` | 通过 | 可选本地回归入口，不是 Web 构建或发布步骤 |
| Web prefs / engine / start / SW / longtail | 全部通过 | 包含新增反例与代次/超时测试 |
| `cd miniapp && npm test` | **133 项通过** | 原有 121 项 + 鸿蒙平台模拟 12 项，不是微信真机或 ArkTS 编译 |
| 小程序首页覆盖率 | 行 **97.30%**，分支 **89.18%**，语句 **95.40%** | coverage 范围仅 `miniapp/pages/index/index.js`，不能称全项目覆盖率 |
| `cd ios && swift test` | **39 项通过** | 政策/采样/时钟层，非整机音频验收 |
| iOS Simulator `xcodebuild` | **exit 0** | `CODE_SIGNING_ALLOWED=NO`，不是 TestFlight 包，也未验证 iPad 本轮屏幕效果 |
| `cd android && ./gradlew :policy:test` | **59 项通过** | JVM 政策/混音/购买状态等测试 |
| `:app:assemblePlayDebug :app:assembleCnDebug` | **通过** | Debug 编译，不是签名发行验收 |
| `:app:lintPlayDebug :app:lintCnDebug` | **无错误** | 每变体仍有 45 个 warning、1 个 information；包括依赖更新、竖屏、WakeLock timeout、旧 API/资源等，未通过全局 suppress 隐藏 |
| npm 官方 registry 审计 | **0 个已知漏洞** | 当前 npm 依赖数据库结果，不能推论整个项目无漏洞；默认镜像 audit 返回 405，改为单次指定官方 registry，未改全局配置 |
| 采样一致性 | 小程序 35、iOS 92、Android 92 个 MP3 均与源文件逐字节相同 | 不代表音色人耳评价通过；未重编码或改原始采样 |
| 密钥检查 | Git 跟踪文件中的签名文件名/私钥头检查通过 | 非完整密钥审计，不覆盖未跟踪私密文件或远端历史；没有读取/输出本机签名密钥 |
| `git diff --check` | 通过 | 不代表已提交 |

### 浏览器实测

使用 T3 共享浏览器与本地静态服务，不操作生产账户。

- 390×844：中文播放/暂停，19 个该语言所需缓冲区加载，AudioContext running，无音频错误。
- 中英文切换、童声选择、16 拍自定义与本地保存；修复前实测发现缓存旧 JS，修复后复测 16 拍生效。
- **主动停止本地 HTTP 服务器**，重新打开未缓存的查询参数 URL：
  - 英文 `208 BPM / 7/8 / voice`：页面、脚本与 19 个缓冲区从缓存工作，能启动/暂停；加速按钮禁用。
  - 中文 `40 BPM / 3/4 / traditional`：同样能从缓存启动/暂停；减速按钮禁用。
- 测完恢复本地服务器。这里的运行状态检查不等于人耳判定声音品质或 60 秒实测漂移。
- 320×568 中英默认 4/4：无横向溢出、拍点方形、播放按钮底部 553px；保留 78px 按钮，不靠缩小点击面积塞进屏幕。

### 采样边界的精确备注

额外用 ffprobe 检查 92 个 MP3：最大 click 时长 **90.023ms**，最大 voice **270.023ms**。其中 31 个文件的容器时长比严格名义阈值多约 23 微秒；进一步解码确认最大是 **22,050Hz 源采样率下的半个采样帧量化差**，不是数十毫秒的超长采样。本轮没有篡改数据、放宽规则或重新勾选人耳验收；若要求数值严格不超过 90/270ms，应另决定是否重编码到向下取整帧边界。实际最长声样仍短于 208 BPM 的一个间隔。

## 仍不能宣称完成的部分

- **真机验收、静音键、锁屏、来电/音频路由、音频与视觉/震动的实际延迟**：设备面板返回 access off。本轮没有绕过它去安装或操作连接的实体设备；N1.25–N1.30、N2.16 保持原状态。
- **购买与恢复、签名发行、商店隐私申报、商店审核状态**：没有本轮商店会话证据；不依据源码测试替用户勾选。
- **鸿蒙**：当前工作树需新的 SDK/DevEco/已授权 CI 编译及真机核验；历史绿色 run 不覆盖本次改动。平台模拟只能证明被模拟的异步状态和解析逻辑。
- **主观音色、听感稳定、长期练习与可用性测试**：没有人耳/真实用户证据。机器测试不替代这些证据。
- **安全与隐私**：CSP 仍是 report-only；鸿蒙工具链从外部镜像下载，尚无本轮独立校验来源/固定摘要证据；公开隐私页的儿童数据绝对表述应与 iOS/网页分析行为复核。未在没有证据的情况下变更隐私承诺或宣称法规合规。
- **外部分析服务**：本地浏览器观测到 CNZZ 返回 404、部分 GA 请求被中止；核心播放不依赖其成功。本轮未凭这些观测改掉已有统计体系，也未将其当作生产平台全面故障结论。
- **产品评估**：没有竞品同设备延迟基准、长期稳定性数据或用户研究，不能给出“业内顶尖一流”的客观认证。

## 复现入口

```bash
# 已锁定的测试依赖
(cd miniapp && npm ci)
./scripts/check-quality.sh

# npm 已知漏洞数据库复核，不修改全局 registry
(cd miniapp && npm audit --registry=https://registry.npmjs.org)

# 本地 native 编译/lint
(cd android && ./gradlew :app:assemblePlayDebug :app:assembleCnDebug :app:lintPlayDebug :app:lintCnDebug)
xcodebuild -project ios/BunnyMetronome.xcodeproj -scheme BunnyMetronome \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

日志在本机 `/tmp/metronome-*-audit.log`、`/tmp/metronome-quality-final.log` 等；临时日志不是长期归档或跨机器证据。需要交付到另一台机器时应重跑命令，而不是引用本机路径声称通过。

## 后续：Web 间歇无声反馈与发布验收

用户随后授权提交、推送及 Web 发布。上述“未提交/未推送”为初轮检查结束时的快照，不代表后续交付状态。

- 修复调度异常导致播放状态悬空、运行中 AudioContext 中断/时间停滞、closed context 无法重试、同步设置异常逃逸。运行中故障停止音源、UI 和亮屏；重试重建音频；诊断重置不自动播放。
- Web 发布号 `2026.10.02.2`，页底中英诊断入口；80 条/24h 本机白名单记录，主动复制/清除、剪贴板降级，无新增后台/上传。第三方统计异常与播放控制隔离。
- SW v11；新增诊断脚本也参与内容 hash 一致性检查；练琴 HTML 联网重新验证，避免五分钟旧页。
- 本地 Chromium 浏览器注入 `ctx.suspend()`：可见错误且 UI/引擎均停止；点重试恢复 running + 19 samples。注入 `_scheduleBeat` 异常：停止计时器/亮屏，日志含 `scheduler_failed`；重置后 context=null，不自动播放。
- 新增单测验证中断、3 秒停滞、调度抛错、closed context 重建、reset 后旧 resume 回调不污染新播放；诊断字段过滤、80 条限制/过期、禁用存储、剪贴板失败、启动脚本未完成与清除。
- **原用户故障发生时没有现场日志；本次修复是针对已证实的故障路径，不声称已唯一定位该次根因。** 尚不能验证扬声器物理输出、Safari 真机 interruption，或操作系统冻结整页时 JS 自救。
- 提交前只读复盘：检查启动/停止代次、closed context 重建、调度异常收尾、日志白名单、两语言一致性、内容 hash/SW 缓存升级、原生变更与发布脚本；本轮未发现新的发布阻断。原先 iPad 布局/截图/版本变更独立提交，不混作本次 Web 修复。
- 最终本地回归 `./scripts/check-quality.sh` 通过（`/tmp/metronome-quality-release-final.log`）；引擎 13 项、Web 页面中英启动/同步异常与可见错误测试、诊断/缓存/资源一致性测试通过；小程序与 Harmony mock 133 项、Swift 39 项、Android policy 59 项通过。Harmony 仍非 SDK 编译/真机验证。
