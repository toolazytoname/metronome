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

小程序现实现：`_tickBase + _tickCount * interval - Date.now()` 排 `setTimeout`。切后台必须 `stop`（平台限制）。

iOS：`AVAudioEngine` + `scheduleBuffer`；`AVAudioSession.category = .playback`。禁止录音类别，不要申请麦克风。

Android：音频线程填 `AudioTrack` / AAudio；UI 进程用前台 Service 保活。禁止 `Handler.postDelayed` 当拍钟。

## 三种模式

| `sm` | 声音 |
|---|---|
| `traditional` | 拍 0 → `click-strong`，其余 → `click-weak` |
| `uniform` | 每拍 `click-uniform` |
| `voice` | `voice/{lang}/{beat+1 padded}.mp3` + 低增益 `click-weak`（Web 增益 0.28） |

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

## 验收

- 40 / 120 / 208 BPM 各 60 秒，听感不加速、不拖
- 播放中拖 BPM，没有「额外一拍」
- `voice` 在 208 BPM 不互相重叠到听不清（上限就是为这个设的）
- 采样缺失时 Web 仍能合成 click
