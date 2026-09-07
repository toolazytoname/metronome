// 小兔头节拍器 - 微信小程序
// 移植自 https://jpq.weichao.studio/

const { getI18n, detectDefaultLang } = require('../../utils/i18n');

// ============================================================
// 音频管理器（鼓点采样播放，无延迟）
// ============================================================
const VOICE_CLICK_GAIN = 0.28;
const OVERLAY_KEY = 'weakOverlay';

function parseStrictInt(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || Math.round(raw) !== raw) return null;
    return raw;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!/^-?\d+$/.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampBpmInput(raw) {
  const n = parseStrictInt(raw);
  if (n == null) return null;
  return Math.max(40, Math.min(208, n));
}

function clampVolInput(raw) {
  const n = parseStrictInt(raw);
  if (n == null) return null;
  return Math.max(10, Math.min(100, n));
}

class AudioManager {
  constructor() {
    this._inited = false;
    this._vol = 0.85;
    this._pool = {};
    this._index = {};
    this._scale = {};
    this._src = {};
    this._size = {};
    this._voiceLang = null;
    this._playAllowed = false;
    this.POOL_SIZE = 3;
    this.VOICE_POOL = 2;
  }

  init() {
    if (this._inited) return;
    this._inited = true;
    this._playAllowed = false;
    this._makePool('strong', '/assets/sounds/click-strong.mp3', this.POOL_SIZE, 1);
    this._makePool('weak', '/assets/sounds/click-weak.mp3', this.POOL_SIZE, 1);
    this._makePool('uniform', '/assets/sounds/click-uniform.mp3', this.POOL_SIZE, 1);
    this._makePool(OVERLAY_KEY, '/assets/sounds/click-weak.mp3', this.POOL_SIZE, VOICE_CLICK_GAIN);
  }

  _makePool(key, src, size, scale) {
    const gain = scale == null ? 1 : scale;
    this._scale[key] = gain;
    this._src[key] = src;
    this._size[key] = size;
    this._pool[key] = [];
    this._index[key] = 0;
    for (let i = 0; i < size; i++) {
      const ctx = wx.createInnerAudioContext();
      ctx.src = src;
      ctx.volume = this._vol * gain;
      ctx.autoplay = false;
      ctx.loop = false;
      ctx._slotReady = false;
      ctx._slotFailed = false;
      ctx._dead = false;
      ctx._poolKey = key;
      this._pool[key].push(ctx);
      ctx.onError(() => {
        if (ctx._dead) return;
        const live = this._pool[key];
        if (!live || live.indexOf(ctx) < 0) return;
        ctx._slotFailed = true;
      });
      ctx.onCanplay(() => {
        if (ctx._dead) return;
        const live = this._pool[key];
        if (!live || live.indexOf(ctx) < 0) return;
        ctx._slotReady = true;
      });
    }
  }

  _destroyPool(key) {
    const ctxs = this._pool[key];
    if (!ctxs) return;
    ctxs.forEach((ctx) => {
      ctx._dead = true;
      try { ctx.destroy(); } catch (e) { /* ignore */ }
    });
    delete this._pool[key];
    delete this._index[key];
    delete this._scale[key];
    delete this._src[key];
    delete this._size[key];
  }

  _rebuildKey(key) {
    const src = this._src[key];
    const size = this._size[key];
    const scale = this._scale[key];
    if (!src) return;
    const ctxs = this._pool[key];
    if (ctxs) {
      ctxs.forEach((ctx) => {
        ctx._dead = true;
        try { ctx.destroy(); } catch (e) { /* ignore */ }
      });
    }
    this._makePool(key, src, size == null ? this.POOL_SIZE : size, scale);
  }

  _liveCtx(key) {
    const ctxs = this._pool[key];
    if (!ctxs || ctxs.length === 0) return null;
    const n = ctxs.length;
    for (let i = 0; i < n; i++) {
      const idx = (this._index[key] + i) % n;
      if (!ctxs[idx]._dead && ctxs[idx]._slotReady && !ctxs[idx]._slotFailed) {
        this._index[key] = (idx + 1) % n;
        return ctxs[idx];
      }
    }
    return null;
  }

  keyReady(key) {
    const ctxs = this._pool[key];
    return !!(ctxs && ctxs.some((c) => !c._dead && c._slotReady && !c._slotFailed));
  }

  keyFailed(key) {
    const ctxs = this._pool[key];
    return !!(ctxs && ctxs.length && ctxs.every((c) => c._dead || c._slotFailed));
  }

  keyStatus(key) {
    if (this.keyReady(key)) return 'ready';
    if (this.keyFailed(key)) return 'error';
    return 'loading';
  }

  neededKeys(sm, beatIndex) {
    if (sm === 'traditional') return [beatIndex === 0 ? 'strong' : 'weak'];
    if (sm === 'voice') return ['v' + (beatIndex + 1), OVERLAY_KEY];
    return ['uniform'];
  }

  modeStatus(sm, beatIndex) {
    const sts = this.neededKeys(sm, beatIndex).map((k) => this.keyStatus(k));
    if (sts.some((s) => s === 'error')) return 'error';
    if (sts.some((s) => s === 'loading')) return 'loading';
    return 'ready';
  }

  ensurePlayable(key) {
    if (this.keyReady(key)) return;
    if (!this._src[key] && !this._pool[key]) return;
    if (!this._pool[key] || this.keyFailed(key)) this._rebuildKey(key);
  }

  ensureMode(sm) {
    if (sm === 'traditional') {
      this.ensurePlayable('strong');
      this.ensurePlayable('weak');
    } else if (sm === 'voice') {
      this.ensurePlayable(OVERLAY_KEY);
      this.ensureFailedVoiceKeys();
    } else {
      this.ensurePlayable('uniform');
    }
  }

  ensureFailedVoiceKeys() {
    const lang = this._voiceLang;
    if (!lang) return;
    for (let i = 1; i <= 16; i++) {
      const key = 'v' + i;
      if (!this._pool[key]) {
        const id = i < 10 ? '0' + i : String(i);
        this._makePool(key, `/assets/sounds/voice/${lang}/${id}.mp3`, this.VOICE_POOL, 1);
      } else if (this.keyFailed(key)) {
        this.ensurePlayable(key);
      }
    }
  }

  ensureVoice(lang) {
    const next = lang === 'en' ? 'en' : 'zh';
    if (this._voiceLang === next && this._pool.v1) {
      this.ensureFailedVoiceKeys();
      return;
    }
    if (this._voiceLang && this._voiceLang !== next) {
      for (let i = 1; i <= 16; i++) this._destroyPool('v' + i);
    }
    this._voiceLang = next;
    for (let i = 1; i <= 16; i++) {
      const id = i < 10 ? '0' + i : String(i);
      this._makePool('v' + i, `/assets/sounds/voice/${next}/${id}.mp3`, this.VOICE_POOL, 1);
    }
  }

  setVolume(v) {
    this._vol = Math.max(0.05, Math.min(1, v));
    Object.keys(this._pool).forEach((key) => {
      const g = this._vol * (this._scale[key] == null ? 1 : this._scale[key]);
      this._pool[key].forEach((ctx) => { ctx.volume = g; });
    });
  }

  play(key) {
    if (!this._playAllowed) return false;
    const ctx = this._liveCtx(key);
    if (!ctx) return false;
    ctx.seek(0);
    ctx.play();
    return true;
  }

  playVoiceBeat(beatIndex) {
    const vKey = 'v' + (beatIndex + 1);
    if (!this.keyReady(vKey) || !this.keyReady(OVERLAY_KEY)) return false;
    const okV = this.play(vKey);
    const okO = this.play(OVERLAY_KEY);
    return okV && okO;
  }

  allowPlay() {
    this._playAllowed = true;
  }

  invalidate() {
    this._playAllowed = false;
  }

  destroy() {
    this._playAllowed = false;
    Object.keys(this._pool).forEach((key) => this._destroyPool(key));
    this._inited = false;
    this._voiceLang = null;
  }

  ctxCount() {
    return Object.keys(this._pool).reduce((n, k) => n + this._pool[k].length, 0);
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
  vol: 85,
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
    vol: DEFAULT_STATE.vol,
    settingsOpen: false,

    // 拍号 —— label 根据当前 lang 动态生成
    timeSigs: buildTimeSigs(initialI18n),
    currentSig: '4/4',
    customBeats: '4',
    customUnit: '4',

    // v2.2 UI 增强
    nowPlayingText: '',  // _refreshNowPlaying 在 onLoad 里填
    audioNote: '',
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
    audioManager.init();
    audioManager.setVolume(this.data.vol / 100);
    this._updateBeats();
    this._refreshNowPlaying();
  },

  onShow() {
    // 从后台切回来：如果之前在播放，继续（用户期望）
    // 注意：小程序切后台 audio 会被暂停，这里不自动恢复
  },

  onHide() {
    // 切后台自动停止（平台限制，音频本就不能在后台播放）
    if (this.data.running) {
      this._stop();
    } else {
      audioManager.invalidate();
    }
  },

  onUnload() {
    this._stop();
    this._runId = (this._runId || 0) + 1;
    this._starting = false;
    if (this._silentHintTimer) {
      clearTimeout(this._silentHintTimer);
      this._silentHintTimer = null;
    }
    audioManager.destroy();
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
    if (this.data.soundMode === 'voice') {
      audioManager.ensureVoice(newLang);
      if (this.data.running) audioManager.allowPlay();
    }
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
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const bpmClamped = clampBpmInput(saved.bpm);
        const bcN = parseStrictInt(saved.bc);
        const buN = parseStrictInt(saved.bu);
        const volN = parseStrictInt(saved.vol);
        const bpm = bpmClamped == null ? DEFAULT_STATE.bpm : bpmClamped;
        const bc = bcN == null ? DEFAULT_STATE.bc : Math.max(1, Math.min(16, bcN));
        const bu = buN == null ? DEFAULT_STATE.bu : Math.max(1, Math.min(16, buN));
        const sm = (saved.sm === 'traditional' || saved.sm === 'uniform' || saved.sm === 'voice')
          ? saved.sm
          : DEFAULT_STATE.sm;
        const vol = volN == null ? DEFAULT_STATE.vol : Math.max(10, Math.min(100, volN));
        const sig = `${bc}/${bu}`;
        this.setData({
          bpm,
          soundMode: sm,
          vol,
          currentSig: sig,
          customBeats: String(bc),
          customUnit: String(bu),
        });
        audioManager.setVolume(vol / 100);
      }
    } catch (e) {
      // ignore corrupt storage
    }
  },

  _saveState() {
    try {
      const bpm = this.data.bpm;
      const bc = this._getBeatCount();
      const bu = parseInt(this.data.customUnit) || 4;
      const soundMode = this.data.soundMode;
      const vol = this.data.vol;
      wx.setStorageSync('metronome', { bpm, bc, bu, sm: soundMode, vol });
    } catch (e) {
      // ignore storage failure
    }
  },

  // ========================================================
  // 节拍圆点 UI
  // ========================================================
  _getBeatCount() {
    const n = parseInt(this.data.customBeats, 10) || 4;
    return Math.max(1, Math.min(16, n));
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
    const newBpm = clampBpmInput(e && e.detail ? e.detail.value : undefined);
    if (newBpm == null) return;
    if (newBpm !== this.data.bpm) {
      this.setData({ bpm: newBpm });
    }
    this._saveState();
    this._refreshNowPlaying();
  },

  onBpmChanging(e) {
    const newBpm = clampBpmInput(e && e.detail ? e.detail.value : undefined);
    if (newBpm == null) return;
    this.setData({ bpm: newBpm });
  },

  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== 'traditional' && mode !== 'uniform' && mode !== 'voice') return;
    this.setData({ soundMode: mode });
    if (mode === 'voice') {
      audioManager.ensureVoice(this.data.lang);
      audioManager.ensureMode('voice');
    }
    this._updateBeats();
    this._saveState();
    this._refreshNowPlaying();
    if (this.data.running) {
      this._currentBeat = 0;
    }
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
    const donateUrl = this.data.lang === 'en'
      ? 'https://jpq.weichao.studio/about/en#donate'
      : 'https://jpq.weichao.studio/about#donate';
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
    const url = this.data.lang === 'en'
      ? 'https://jpq.weichao.studio/about/en#donate'
      : 'https://jpq.weichao.studio/about#donate';
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

  onVolChanging(e) {
    const vol = clampVolInput(e && e.detail ? e.detail.value : undefined);
    if (vol == null) return;
    this.setData({ vol });
    audioManager.setVolume(vol / 100);
  },

  onVolChange(e) {
    const vol = clampVolInput(e && e.detail ? e.detail.value : undefined);
    if (vol == null) return;
    this.setData({ vol });
    audioManager.setVolume(vol / 100);
    this._saveState();
  },


  // ========================================================
  // BPM 设置
  // ========================================================
  _setBpm(b) {
    const newBpm = clampBpmInput(b);
    if (newBpm == null) return;
    const old = this.data.bpm;
    if (newBpm === old) return;

    this.setData({ bpm: newBpm });
    this._saveState();
    this._refreshNowPlaying();
  },


  // ========================================================
  // 播放 / 停止
  // ========================================================
  _start() {
    if (this.data.running || this._starting) return;
    this._starting = true;
    this._runId = (this._runId || 0) + 1;
    audioManager.init();
    audioManager.allowPlay();
    audioManager.setVolume(this.data.vol / 100);
    if (this.data.soundMode === 'voice') audioManager.ensureVoice(this.data.lang);
    audioManager.ensureMode(this.data.soundMode);
    this._currentBeat = 0;
    this.setData({ running: true });
    this._refreshNowPlaying(true);
    this._startTick();
    this._starting = false;
  },

  _stop() {
    this._runId = (this._runId || 0) + 1;
    this._starting = false;
    this._stopTick();
    audioManager.invalidate();
    const beats = this.data.beats.map(b => ({ ...b, active: false }));
    this.setData({ running: false, beats, audioNote: '' });
    this._refreshNowPlaying(false);
  },

  _startTick() {
    this._stopTick();
    const now = Date.now();
    this._tick();
    this._nextAt = now + (60000 / this.data.bpm);
    this._armNext();
  },

  _intervalMs() {
    return 60000 / this.data.bpm;
  },

  _armNext() {
    if (!this.data.running) return;
    const delay = Math.max(0, this._nextAt - Date.now());
    const runId = this._runId;
    this._timer = setTimeout(() => {
      if (!this.data.running || this._runId !== runId) return;
      this._tick();
      const interval = this._intervalMs();
      this._nextAt += interval;
      const now = Date.now();
      if (this._nextAt <= now) {
        this._nextAt = now + interval;
      }
      this._armNext();
    }, delay);
  },

  _scheduleNextTick() {
    this._armNext();
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
    const sm = this.data.soundMode;
    const bc = this._getBeatCount();
    const cb = this._currentBeat;

    let sounded = false;
    if (sm === 'traditional') {
      sounded = audioManager.play(cb === 0 ? 'strong' : 'weak');
    } else if (sm === 'uniform') {
      sounded = audioManager.play('uniform');
    } else if (sm === 'voice') {
      sounded = audioManager.playVoiceBeat(cb);
    }
    this._onAudioStatus(sounded ? 'ready' : audioManager.modeStatus(sm, cb));

    const beats = this.data.beats.map((b, i) => ({
      ...b,
      active: i === cb,
    }));
    this.setData({ beats });

    this._currentBeat = (cb + 1) % bc;
  },


  // ========================================================
  // Now-playing 状态条
  // ========================================================
  _onAudioStatus(st) {
    const i18n = this.data.i18n || getI18n('zh');
    let note = '';
    if (st === 'loading') note = i18n.audio_loading || '';
    else if (st === 'error') note = i18n.audio_error || '';
    if (note !== this.data.audioNote) this.setData({ audioNote: note });
  },

  _refreshNowPlaying(runningOverride) {
    const running = runningOverride === undefined ? this.data.running : runningOverride;
    const i18n = this.data.i18n || getI18n('zh'); // 防御：测试 mock 可能缺
    const bpm = this.data.bpm;
    const sig = this.data.currentSig;
    const smLabel = this.data.soundMode === 'traditional'
      ? i18n.sm_traditional
      : this.data.soundMode === 'voice'
        ? i18n.sm_voice
        : i18n.sm_uniform;
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

module.exports = {
  AudioManager,
  getAudioManager: () => audioManager,
  VOICE_CLICK_GAIN,
  OVERLAY_KEY,
  parseStrictInt,
  clampBpmInput,
  clampVolInput,
};
