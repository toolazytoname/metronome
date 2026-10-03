# 引擎契约

所有端必须遵守。实现语言可以不同，语义必须相同。

## 状态

```jsonc
{
  "bpm": 120,          // integer 40–208
  "bc": 4,             // beats per bar, integer 1–16
  "bu": 4,             // beat unit, stored for UI; clock uses bc
  "sm": "uniform",     // "traditional" | "uniform" | "voice"
  "vol": 85            // integer 10–100；引擎里用 vol/100
}
```

Web：`localStorage["metronome"]`  
小程序：`wx.setStorageSync("metronome", ...)`  
原生：`UserDefaults` / DataStore 同字段。解锁状态**不是**这份 JSON 的权威来源。

原生额外（不回写 Web）：

```jsonc
{
  "lang": "zh",
  "haptic": false,
  "keepAwake": true,
  "clickBank": "default",
  "voiceBank": "default",
  "hapticPattern": "all",       // "all" | "downbeat"；未购 resolve 为 all
  "hapticFeel": "standard"      // "light" | "standard" | "heavy"；未购 resolve 为 standard
}
```

非法值要 clamp，不要崩溃。未知 `sm` 回退 `uniform`。未知 `hapticPattern` / `hapticFeel` 在播放时 `resolve*` 回 `all` / `standard`。未购不要让包内震动选项生效。

## 时钟

1. 拍点在音频时间线上预约，不在 UI 线程用 `setInterval`。
2. 间隔 = `60 / bpm` 秒。
3. 改 BPM 只影响**下一拍**间隔，禁止为了对齐再打一拍。
4. `cb`（当前拍下标）在 `0 .. bc-1` 循环。切 `bc` 时若 `cb >= bc` 则归零。
5. `onBeat(cb)` 只驱动豆子 UI，可以晚于音频，不能反过来让 UI 触发声音。

Web 现实现（`js/engine.js`）：

- `LOOKAHEAD_MS = 25`
- `SCHEDULE_AHEAD = 0.1`
- `src.start(time)` 用 `AudioContext.currentTime`
- 采样 fetch 与 AudioContext resume 均有截止时间（默认 8s）；采样超时回退合成 click，resume 失败提示重试。`stop()` 取消已预约音源；重载使用代次隔离，旧解码不得覆盖当前缓冲区。

小程序现实现：`_nextAt` 绝对时刻 + `setTimeout`。切后台必须 `stop`（平台限制）。播放中改 BPM 只改**下一拍**间隔，不重启、不插拍。若回调时已经落后超过一个间隔：只打当前这一拍，然后将 `_nextAt` 设为 `now + interval`，**丢弃过期拍，禁止 delay=0 循环补发**。BPM 输入必须是完整有限整数；非法值忽略。

Web 现实现另加：若 `nextNoteTime` 已落后 `currentTime` 超过一个间隔，把 `nextNoteTime` 拨到 `currentTime` 再按 `SCHEDULE_AHEAD` 预约，**不把积压的过期拍一次排完**。改 BPM 仍只影响下一拍间隔。iOS / Android 仍走音频时间线预约。iOS 主队列阻塞超过一个拍间隔后，同样丢弃过期拍并从当前 player time 恢复；不把积压音频一次补发，正常改 BPM 不插拍。

iOS：`AVAudioEngine` + `scheduleBuffer`；`AVAudioSession.category = .playback`。禁止录音类别，不要申请麦克风。

Android：音频线程填 `AudioTrack` / AAudio；UI 进程用前台 Service 保活。禁止 `Handler.postDelayed` 当拍钟。

Android / 鸿蒙必须等齐 35 个免费采样（3 个 click + 中英各 16 个数拍）。加载失败可重试。每次播放使用独立运行代次 / 线程状态，旧任务不能在暂停后复活或污染新一轮；音频创建、启动、写入失败须停止并清理资源。短写只推进已写入帧；零/负写入视为失败，禁止忙循环。鸿蒙 UI 等 worker 的当前代次 `started` 确认后才显示正在播放，采样通过 `samplesDone` 后的 `ready` 确认就绪，不把「发送到 worker」当作「解码完成」。

## 三种模式

| `sm` | 声音 |
|---|---|
| `traditional` | 拍 0 → `click-strong`，其余 → `click-weak` |
| `uniform` | 每拍 `click-uniform` |
| `voice` | `voice/{lang}/{beat+1 padded}.mp3` + 低增益 `click-weak`（增益 0.28；小程序用独立 overlay 池，不改主音量） |

`lang` 为 `zh` 或 `en`。数拍文件：`01.mp3` … `16.mp3`。`bc > 16` 不允许。

## 采样布局

唯一来源：`assets/sounds/`。生成脚本：`tools/gen-sounds.py`。

```
assets/sounds/
  click-strong.mp3
  click-weak.mp3
  click-uniform.mp3
  voice/zh/01.mp3 … 16.mp3
  voice/en/01.mp3 … 16.mp3
  pack/                         # IAP，原生才用
    click-stick/ …
    click-kick/ …
    click-tip/ …
    voice-zh-yunxi/ …
    voice-zh-soft/ …
    voice-en-deep/ …
```

Web / 小程序 v1 不加载 `pack/`。同步到 `miniapp/assets/sounds/`（仅免费树）、以及日后的 `ios/`、`android/` 资源目录。

不要再使用 `beat-strong.mp3` 这种别名。

## 方法形状（各端用自己的语言）

```
load(lang)
setBpm(40…208)
setBeats(1…16)
setMode(traditional | uniform | voice)
setVoiceBank(id) / setClickBank(id)   # 未解锁则忽略
setVolume(0.05…1.0)
setHaptic(bool)
start() / stop()
onBeat(index)                         # 0-based
isSoundPackUnlocked() -> bool
```

`start` 必须可重入安全：连点播放不能开两个 scheduler。Web 用 `_runId` / `_starting` 做到了，其它端照做。

小程序采样：每个 InnerAudio 自己的 canplay/error。voice 拍必须数拍与 overlay **都就绪**才叠；未就绪则跳过这一拍、不排队重试。stop / 切语言 / destroy 使旧回调失效。加载失败要可见，禁止空转播放键。

## 验收

- 40 / 120 / 208 BPM 各 60 秒，听感不加速、不拖
- 播放中拖 BPM，没有「额外一拍」
- `voice` 在 208 BPM 不互相重叠到听不清（上限就是为这个设的）
- 采样缺失时 Web 仍能合成 click

### Web 运行中故障与恢复（2026-10-02）

- `onstatechange` 和 lookahead tick 监测音频状态；运行中非 running、音频时间超过 3 秒无进展、调度异常统一停止、取消 sources / visuals，并通知 UI 释放亮屏及显示错误。此检测不是另起拍钟，也不自动恢复出声。
- 重试 / 诊断重置销毁旧 context，清空采样并作废加载与播放代次；重试由用户手势重新启动，诊断重置保持暂停。旧 resume、解码和 tick 不得修改新一轮。
- `js/diagnostics.js` 先于 prefs / engine 加载。固定事件码 + 字段白名单，最多 80 条 / 24h，本机存储不可用时退回内存。版本、系统类别、浏览器大版本随主动导出返回；不采集完整 URL、异常原文/堆栈或用户标识，不发送诊断请求。可查看、复制、清除；剪贴板失败时手动复制。
- 调度测试覆盖异常 / interruption / stalled clock / closed context / reset 中迟到 resume；页面测试覆盖同步初始化异常与重试 UI。自动测试不能证明具体用户的历史故障根因或设备真的发声。

### 用户主动发送诊断（2026-10-03）

- Web「发送诊断」不向网站服务器发请求；在支持 Web Share 的设备上调用系统分享面板，在其他浏览器打开发往 `lazywc@gmail.com` 的 `mailto:` 草稿。最终发送由用户确认。
- 发送版只带固定设备/音频字段和最近 32 条事件，约 6000 字符上限；完整本地记录仍由复制功能导出。可选故障描述由用户主动填写并承担发送决定。

### Web 有声音但拍点不跳（2026-10-03）

- 用户反馈版本 `2026.10.03.2` 有声音但拍点不跳；现有日志不含绘制状态，不能据此确认 Safari 的具体触发条件。旧实现每拍另建视觉 `setTimeout`，回调异常脱离音频调度器的错误处理；此次修复这一可验证的保护缺口，不把它冒充为已复现的用户根因。
- 已预约拍点进入有界视觉队列，由现有 lookahead 循环按照音频时间消费；未来拍不提前点亮，迟到只显示最新到期拍，不补闪历史拍点。停止 / 重置清空队列。声音的预约间隔和 BPM 语义不变。
- 中英页面在目标拍点缺失 / 节点数错误时重建拍点；回调返回 `false` 或抛错则 `visual_failed`，停止音源、释放亮屏、显示可重试错误。节点本身或页面彻底失效时仍需刷新，不保证 JS 自救。
- 白名单快照新增 `scheduledBeat` / `renderedBeat`（-1 表示无活动拍，其他为 0-based）、`visualUpdates`（本轮最多计 65535）、`visualAgeMs`（距上次回调成功，最多 60000）、`visualNodes` 和 `uiPlaying`；不增加每拍落盘。这些字段反映逻辑与 DOM 更新，不证明浏览器屏幕合成正常。
- `play_ready` 在清除加载态后记录，`paused` 在停止引擎后记录，避免旧版日志中 ready 却 loading、paused 却 playing 的歧义。
- 验证记录见 [[web-visual-2026-10-03]]（`docs/audits/web-visual-2026-10-03.md`）。
