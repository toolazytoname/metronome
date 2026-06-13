// 小兔头节拍器 - 微信小程序
// 移植自 https://jpq.weichao.studio/

const { getI18n, detectDefaultLang } = require('../../utils/i18n');

// ============================================================
// 音频管理器（鼓点采样播放，无延迟）
// ============================================================
class AudioManager {
  constructor() {
    this._inited = false;
    // 预载的采样（用于鼓点）
    this._pool = { strong: [], weak: [], uniform: [] };
    this._ready = { strong: false, weak: false, uniform: false };
    this._index = { strong: 0, weak: 0, uniform: 0 };
    this.POOL_SIZE = 3;
  }

  init() {
    if (this._inited) return;
    this._inited = true;

    // 预加载鼓点采样 + 监听 onCanplay 标记就绪状态。
    // 不预热（之前试过 play+stop 预热，会泄漏残响 + 反复触发 onCanplay 反而坏事）。
    const base = '/assets/sounds';
    const files = {
      strong: 'beat-strong.mp3',
      weak: 'beat-weak.mp3',
      uniform: 'beat-uniform.mp3',
    };
    for (const [key, file] of Object.entries(files)) {
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const ctx = wx.createInnerAudioContext();
        ctx.src = `${base}/${file}`;
        ctx.volume = 0.8;
        ctx.autoplay = false;
        ctx.loop = false;
        ctx.onError((err) => console.warn(`[Audio] ${key}[${i}] error:`, err));
        ctx.onCanplay(() => {
          this._ready[key] = true;
          console.log(`[Audio] ${key} ready (ctx ${i})`);
        });
        this._pool[key].push(ctx);
      }
    }
    console.log(`[Audio] Initialized (pool size ${this.POOL_SIZE} per sound)`);
  }

  play(key) {
    const ctxs = this._pool[key];
    if (!ctxs || ctxs.length === 0) return;
    if (!this._ready[key]) {
      console.log(`[DIAG] play() key=${key} t=${Date.now()} NOT-READY → retry (up to 3s)`);
      this._retryPlay(key, 60);
      return;
    }
    const idx = this._index[key];
    const ctx = ctxs[idx];
    this._index[key] = (idx + 1) % ctxs.length;
    console.log(`[DIAG] play() key=${key} ctx#${idx} t=${Date.now()}`);
    ctx.seek(0);
    ctx.play();
  }
  _retryPlay(key, attemptsLeft) {
    if (attemptsLeft <= 0) {
      console.warn(`[Audio] ${key} never became ready after 3s, dropping tick`);
      return;
    }
    setTimeout(() => {
      if (this._ready[key]) {
        this.play(key);
      } else {
        this._retryPlay(key, attemptsLeft - 1);
      }
    }, 50);
  }
}

const audioManager = new AudioManager();


// ============================================================
// 节拍器核心状态
// ============================================================
const TIME_SIG_KEYS = ['4/4', '3/4', '2/4', '6/8', '5/4', '7/8'];

function buildTimeSigs(i18n) {
  return TIME_SIG_KEYS.map(sig => ({ sig, label: i18n.ts_labels[sig] }));
}

// 默认配置（与原版一致）
const DEFAULT_STATE = {
  bpm: 120,
  bc: 4,    // beats count（分子）
  bu: 4,    // beat unit（分母）
  sm: 'uniform',  // sound mode
};

// 启动时读 lang（先 storage，没有就用系统语言）
const initialLang = (function() {
  try {
    const stored = wx.getStorageSync('metronome_lang');
    if (stored === 'zh' || stored === 'en') return stored;
  } catch (e) {
    // ignore storage failure
  }
  return detectDefaultLang();
})();
const initialI18n = getI18n(initialLang);

Page({
  data: {
    // 核心状态
    bpm: DEFAULT_STATE.bpm,
    running: false,
    beats: [],         // 节拍圆点数据
    soundMode: DEFAULT_STATE.sm,
    settingsOpen: false,

    // 拍号 —— label 根据当前 lang 动态生成
    timeSigs: buildTimeSigs(initialI18n),
    currentSig: '4/4',
    customBeats: '4',
    customUnit: '4',

    // v2.2 UI 增强
    nowPlayingText: '',  // _refreshNowPlaying 在 onLoad 里填
    silentHintShow: false,

    // i18n
    lang: initialLang,
    i18n: initialI18n,
  },

  // ========================================================
  // 生命周期
  // ========================================================
  onLoad() {
    this._loadState();
    this._updateBeats();
    this._refreshNowPlaying();
    console.log('[Metronome] Page loaded, bpm:', this.data.bpm);
  },

  onShow() {
    // 从后台切回来：如果之前在播放，继续（用户期望）
    // 注意：小程序切后台 audio 会被暂停，这里不自动恢复
  },

  onHide() {
    // 切后台自动停止（平台限制，音频本就不能在后台播放）
    if (this.data.running) {
      this._stop();
    }
    console.log('[Metronome] Page hidden, stopped');
  },

  onUnload() {
    this._stopTick();
    if (this._silentHintTimer) {
      clearTimeout(this._silentHintTimer);
      this._silentHintTimer = null;
    }
  },


  // ========================================================
  // 分享 —— 微信生命周期 hook
  // 用户点 <button open-type="share"> 或系统胶囊「···」→ 转发
  // 都会调到 onShareAppMessage。返回的 path 决定接收方点击后
  // 进入哪个页面 —— 默认就是当前小程序的同一页，所以"分享一打开
  // 就是小程序"是自然行为。
  // ========================================================
  onShareAppMessage() {
    return {
      title: this.data.i18n.share_title,
      path: '/pages/index/index?from=share',
      // imageUrl 不传 → 微信自动用当前页截屏
    };
  },

  onShareTimeline() {
    return {
      title: this.data.i18n.share_timeline,
      query: 'from=timeline',
    };
  },


  // ========================================================
  // 信息豆子（合并原 帮助 + 关于）—— 使用提示 + 版本 + 网页版链接
  // ========================================================
  onInfo() {
    const i18n = this.data.i18n;
    wx.showModal({
      title: i18n.info_title,
      content: i18n.info_content,
      showCancel: false,
      confirmText: i18n.info_btn,
      confirmColor: '#6549a3',
    });
  },


  // ========================================================
  // 中英切换豆子
  // ========================================================
  onLangToggle() {
    const newLang = this.data.lang === 'zh' ? 'en' : 'zh';
    const newI18n = getI18n(newLang);
    this.setData({
      lang: newLang,
      i18n: newI18n,
      timeSigs: buildTimeSigs(newI18n),
    });
    this._refreshNowPlaying();
    try {
      wx.setStorageSync('metronome_lang', newLang);
    } catch (e) {
      // ignore storage failure
    }
  },


  // ========================================================
  // 状态管理
  // ========================================================
  _loadState() {
    try {
      const saved = wx.getStorageSync('metronome');
      if (saved) {
        const bpm = saved.bpm || DEFAULT_STATE.bpm;
        const bc = saved.bc || DEFAULT_STATE.bc;
        const bu = saved.bu || DEFAULT_STATE.bu;
        const sm = (saved.sm === 'traditional' || saved.sm === 'uniform')
          ? saved.sm  // voice mode hidden, fallback to uniform
          : DEFAULT_STATE.sm;
        const sig = `${bc}/${bu}`;
        this.setData({
          bpm,
          soundMode: sm,
          currentSig: sig,
          customBeats: String(bc),
          customUnit: String(bu),
        });
        console.log('[Metronome] Loaded state:', saved);
      }
    } catch (e) {
      console.warn('[Metronome] Failed to load state:', e);
    }
  },

  _saveState() {
    try {
      const bpm = this.data.bpm;
      const bc = this._getBeatCount();
      const bu = parseInt(this.data.customUnit) || 4;
      const soundMode = this.data.soundMode;
      wx.setStorageSync('metronome', { bpm, bc, bu, sm: soundMode });
    } catch (e) {
      console.warn('[Metronome] Failed to save state:', e);
    }
  },

  // ========================================================
  // 节拍圆点 UI
  // ========================================================
  _getBeatCount() {
    return parseInt(this.data.customBeats) || 4;
  },

  _updateBeats() {
    const bc = this._getBeatCount();
    const sm = this.data.soundMode;
    const beats = [];
    for (let i = 0; i < bc; i++) {
      let className = sm;
      if (sm === 'traditional' && i === 0) {
        className = 'strong';
      }
      beats.push({ num: i + 1, className, active: false });
    }
    this.setData({ beats });
  },


  // ========================================================
  // 事件处理
  // ========================================================
  onPlay() {
    if (this.data.running) {
      this._stop();
    } else {
      this._start();
      // 首次播放后启发式提示 iOS 用户检查静音键
      this._maybeShowSilentHint();
    }
  },

  onSilentHintClose() {
    this._dismissSilentHint();
  },

  onBpmMinus() {
    this._setBpm(this.data.bpm - 1);
  },

  onBpmPlus() {
    this._setBpm(this.data.bpm + 1);
  },

  onBpmChange(e) {
    // 松手时触发。**不能**走 _setBpm 因为 onBpmChanging 已经把
    // this.data.bpm 同步到新值，_setBpm 里 newBpm===old 会 early return，
    // 导致 tick 不被重启，听到的节奏不变。这里直接 clamp + 重启 tick。
    const newBpm = Math.max(40, Math.min(208, parseInt(e.detail.value)));
    if (newBpm !== this.data.bpm) {
      this.setData({ bpm: newBpm });
    }
    this._saveState();
    this._refreshNowPlaying();
    if (this.data.running) {
      this._stopTick();
      this._startTick();
    }
    console.log('[Metronome] BPM (slider release):', newBpm);
  },

  onBpmChanging(e) {
    // 实时跟随滑块拖动（松开时才重启 tick + 保存状态）
    this.setData({ bpm: parseInt(e.detail.value) });
  },

  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    // voice mode permanently hidden (synthesized sounds not natural)
    if (mode === 'voice') return;
    const prev = this.data.soundMode;
    this.setData({ soundMode: mode });
    this._updateBeats();
    this._saveState();
    this._refreshNowPlaying();
    // 切换模式时如果正在播放，先停再启（重置 AudioContext）
    if (this.data.running) {
      this._stop();
      this._start();
    }
    console.log('[Metronome] Mode changed:', prev, '->', mode);
  },

  onTimeSigChange(e) {
    const sig = e.currentTarget.dataset.sig;
    const [b, u] = sig.split('/');
    this.setData({
      currentSig: sig,
      customBeats: b,
      customUnit: u,
    });
    this._updateBeats();
    this._saveState();
    this._refreshNowPlaying();
    // 切换拍号时如果正在播放，重启
    if (this.data.running) {
      this._stop();
      this._start();
    }
    console.log('[Metronome] Time sig changed to:', sig);
  },

  onCustomBeatsInput(e) {
    this.setData({ customBeats: e.detail.value });
  },

  onCustomUnitInput(e) {
    this.setData({ customUnit: e.detail.value });
  },

  onApplyCustom() {
    const b = parseInt(this.data.customBeats) || 4;
    const u = parseInt(this.data.customUnit) || 4;
    const sig = `${b}/${u}`;
    this.setData({ currentSig: sig });
    this._updateBeats();
    this._saveState();
    this._refreshNowPlaying();
    if (this.data.running) {
      this._stop();
      this._start();
    }
  },


  // ========================================================
  // 支持我们 —— 跳转 web-view 打开 web 端捐赠页
  // 微信小程序禁止直接展示收款码，必须跳外部 web 页面
  // ========================================================
  onDonate() {
    const donateUrl = 'https://jpq.weichao.studio/about#donate';
    wx.navigateTo({
      url: '/pages/webview/webview?url=' + encodeURIComponent(donateUrl),
      fail: (err) => {
        // 开发期业务域名未配时，web-view 会失败 —— 用 web 链接提示
        wx.showModal({
          title: this.data.i18n.donate_title,
          content: donateUrl,
          confirmText: this.data.i18n.donate_btn_copy,
          success: (r) => {
            if (r.confirm) this.onCopyUrl();
          }
        });
      }
    });
  },

  onCopyUrl() {
    const url = 'https://jpq.weichao.studio/about#donate';
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          title: this.data.i18n.donate_copied,
          icon: 'none',
          duration: 2000,
        });
      }
    });
  },

  onToggleSettings() {
    this.setData({ settingsOpen: !this.data.settingsOpen });
  },


  // ========================================================
  // BPM 设置
  // ========================================================
  _setBpm(b) {
    const newBpm = Math.max(40, Math.min(208, b));
    const old = this.data.bpm;
    if (newBpm === old) return;

    this.setData({ bpm: newBpm });
    this._saveState();
    this._refreshNowPlaying();

    // 如果正在播放，重设定时器间隔
    if (this.data.running) {
      this._stopTick();
      // _startTick 内部已通过 _scheduleNextTick 立即触发一次 _tick
      this._startTick();
    }
    console.log('[Metronome] BPM:', old, '->', newBpm);
  },


  // ========================================================
  // 播放 / 停止
  // ========================================================
  _start() {
    // 首次启动时初始化音频（必须在用户点击后调用，避免被系统拦截）
    audioManager.init();
    this._currentBeat = 0;
    // 注意：setData 必须先于 _startTick——setTimeout 链的第一次同步调用
    // 会读 this.data.running 来判断要不要排下一拍，否则会被早退。
    this.setData({ running: true });
    this._refreshNowPlaying(true);
    this._startTick();
    console.log('[Metronome] Started at', this.data.bpm, 'BPM');
  },

  _stop() {
    this._stopTick();
    // 重置所有节拍指示器
    const beats = this.data.beats.map(b => ({ ...b, active: false }));
    this.setData({ running: false, beats });
    this._refreshNowPlaying(false);
    console.log('[Metronome] Stopped');
  },

  _startTick() {
    const interval = 60000 / this.data.bpm;
    this._tickBase = Date.now();
    this._tickCount = 0;
    this._prevActive = undefined;
    this._driftMax = 0;
    this._driftSum = 0;
    console.log(`[DIAG] _startTick bpm=${this.data.bpm} interval=${interval.toFixed(1)}ms base=${this._tickBase}`);
    this._scheduleNextTick(interval);
  },

  _scheduleNextTick(interval) {
    if (!this.data.running) return;
    this._tick();
    this._tickCount += 1;
    const target = this._tickBase + this._tickCount * interval;
    const delay = Math.max(0, target - Date.now());
    console.log(`[DIAG] _scheduleNextTick #${this._tickCount} target=${target} delay=${delay.toFixed(0)}ms now=${Date.now()}`);
    this._timer = setTimeout(() => this._scheduleNextTick(interval), delay);
  },

  _stopTick() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  },


  // ========================================================
  // 每拍触发
  // ========================================================
  _tick() {
    const tStart = Date.now();
    const sm = this.data.soundMode;
    const bc = this._getBeatCount();
    const cb = this._currentBeat;

    // 1. 音频先
    if (sm === 'traditional') {
      audioManager.play(cb === 0 ? 'strong' : 'weak');
    } else if (sm === 'uniform') {
      audioManager.play('uniform');
    }
    const tAudioRequested = Date.now();

    // 2. UI（稳妥写法：完整 beats 数组重渲，避路径式 setData 在某些 WeChat
    //    版本上抛错导致整个 _tick 中断的坑。4 元素数组开销可忽略。）
    const beats = this.data.beats.map((b, i) => ({
      ...b,
      active: i === cb,
    }));
    this.setData({ beats });
    const tSetData = Date.now();

    // 诊断：报告本拍从 start 到 audio 调用的间隔 + setData 完成的间隔
    const audioGap = tAudioRequested - tStart;
    const setDataGap = tSetData - tStart;
    console.log(`[DIAG] _tick beat=${cb} start=${tStart} audioReq→${audioGap}ms setData→${setDataGap}ms`);

    // 漂移跟踪：相对目标时刻的偏差
    if (this._tickCount > 0) {
      const expected = this._tickBase + this._tickCount * (60000 / this.data.bpm);
      const drift = tStart - expected;
      this._driftMax = Math.max(this._driftMax, Math.abs(drift));
      this._driftSum += drift;
      if (this._tickCount % 10 === 0) {
        const avg = (this._driftSum / this._tickCount).toFixed(1);
        console.log(`[DIAG] drift report #${this._tickCount} max=${this._driftMax.toFixed(0)}ms avg=${avg}ms`);
      }
    }

    this._currentBeat = (cb + 1) % bc;
  },


  // ========================================================
  // Now-playing 状态条
  // ========================================================
  _refreshNowPlaying(runningOverride) {
    const running = runningOverride === undefined ? this.data.running : runningOverride;
    const i18n = this.data.i18n || getI18n('zh'); // 防御：测试 mock 可能缺
    const bpm = this.data.bpm;
    const sig = this.data.currentSig;
    const smLabel = this.data.soundMode === 'traditional' ? i18n.sm_traditional : i18n.sm_uniform;
    const statusLabel = running ? i18n.np_playing : i18n.np_idle;
    const text = `${statusLabel} · ${bpm} ${i18n.bpm} · ${sig} · ${smLabel}`;
    if (text !== this.data.nowPlayingText) {
      this.setData({ nowPlayingText: text });
    }
  },


  // ========================================================
  // iOS 静音键启发式提示（小程序无 navigator.audioSession 可查）
  // 触发：iOS 设备 + 首次按 Play + 之前没 dismiss 过
  // 关闭：✕ 按钮 / 8 秒自动消失 → 写入 storage 永不再弹
  // ========================================================
  _maybeShowSilentHint() {
    if (this._silentHintShown) return;
    try {
      if (wx.getStorageSync('metronome_silent_hint_v1')) return;
      const sys = wx.getSystemInfoSync();
      const isIOS = sys && (sys.platform === 'ios' || sys.system && sys.system.toLowerCase().indexOf('ios') === 0);
      if (!isIOS) return;
    } catch (e) {
      return;
    }
    this._silentHintShown = true;
    // 1.5s 后弹（让节拍器先响一拍，用户能判断是否听到）
    setTimeout(() => {
      this.setData({ silentHintShow: true });
      // 8s 自动消失
      this._silentHintTimer = setTimeout(() => this._dismissSilentHint(), 8000);
    }, 1500);
  },

  _dismissSilentHint() {
    this.setData({ silentHintShow: false });
    if (this._silentHintTimer) {
      clearTimeout(this._silentHintTimer);
      this._silentHintTimer = null;
    }
    try {
      wx.setStorageSync('metronome_silent_hint_v1', '1');
    } catch (e) {
      // ignore storage failure
    }
  },

});
