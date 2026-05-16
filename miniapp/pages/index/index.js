// 小兔头节拍器 - 微信小程序
// 移植自 https://jpq.weichao.studio/

// ============================================================
// 音频管理器（Web Audio API 合成，无延迟，支持任意节拍数）
// ============================================================
class AudioManager {
  constructor() {
    this._ctx = null;
    this._inited = false;
    // 预载的采样（用于鼓点）
    this._pool = {
      strong: null,
      weak: null,
      uniform: null,
    };
  }

  init() {
    if (this._inited) return;
    this._inited = true;
    this._ctx = wx.createInnerAudioContext();

    // 预加载鼓点采样
    const base = '../../assets/sounds';
    const files = {
      strong: 'beat-strong.mp3',
      weak: 'beat-weak.mp3',
      uniform: 'beat-uniform.mp3',
    };
    for (const [key, file] of Object.entries(files)) {
      const ctx = wx.createInnerAudioContext();
      ctx.src = `${base}/${file}`;
      ctx.volume = 0.8;
      ctx.autoplay = false;
      ctx.loop = false;
      ctx.onError((err) => console.warn(`[Audio] ${key} error:`, err));
      this._pool[key] = ctx;
    }
    console.log('[Audio] Initialized');
  }

  _getCtx() {
    if (!this._ctx) this._ctx = wx.createInnerAudioContext();
    return this._ctx;
  }

  // 播放鼓点采样
  play(key) {
    const ctx = this._pool[key];
    if (!ctx) return;
    ctx.seek(0);
    ctx.play();
  }

  // 合成数字音效（滴滴声），pitch 对应数字 1-9
  // 取代预录语音，彻底支持任意节拍数
  playNumber(num, when = 0) {
    const ctx = this._getCtx();
    const t = ctx.currentTime + when;
    const pitchMap = {
      1: 262, 2: 294, 3: 330, 4: 349,
      5: 392, 6: 440, 7: 494, 8: 523, 9: 587,
    };
    const freq = pitchMap[num] || 440;
    const vol = 0.4;

    // 高频短滴（数字音）
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(vol, t + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(g1);
    g1.connect(ctx);

    // 低频辅助（让声音更实）
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 0.5;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol * 0.3, t + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    osc2.connect(g2);
    g2.connect(ctx);

    osc1.start(t);
    osc1.stop(t + 0.15);
    osc2.start(t);
    osc2.stop(t + 0.15);
  }
}

const audioManager = new AudioManager();


// ============================================================
// 节拍器核心状态
// ============================================================
const TIME_SIGS = [
  { sig: '4/4', label: '四拍' },
  { sig: '3/4', label: '圆舞曲' },
  { sig: '2/4', label: '进行曲' },
  { sig: '6/8', label: '八六拍' },
  { sig: '5/4', label: '复合拍' },
  { sig: '7/8', label: '现代' },
];

// 默认配置（与原版一致）
const DEFAULT_STATE = {
  bpm: 120,
  bc: 4,    // beats count（分子）
  bu: 4,    // beat unit（分母）
  sm: 'uniform',  // sound mode
};

Page({
  data: {
    // 核心状态
    bpm: DEFAULT_STATE.bpm,
    running: false,
    beats: [],         // 节拍圆点数据
    soundMode: DEFAULT_STATE.sm,
    settingsOpen: false,

    // 拍号
    timeSigs: TIME_SIGS,
    currentSig: '4/4',
    customBeats: '4',
    customUnit: '4',
  },

  // ========================================================
  // 生命周期
  // ========================================================
  onLoad() {
    this._loadState();
    this._updateBeats();
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
    }
  },

  onBpmMinus() {
    this._setBpm(this.data.bpm - 1);
  },

  onBpmPlus() {
    this._setBpm(this.data.bpm + 1);
  },

  onBpmChange(e) {
    this._setBpm(parseInt(e.detail.value));
  },

  onBpmChanging(e) {
    // 实时跟随滑块拖动（松开时才保存状态）
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
    if (this.data.running) {
      this._stop();
      this._start();
    }
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

    // 如果正在播放，重设定时器间隔
    if (this.data.running) {
      this._stopTick();
      this._startTick();
      // 立即触发一次（确保同步）
      this._tick();
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
    this._startTick();
    this.setData({ running: true });
    console.log('[Metronome] Started at', this.data.bpm, 'BPM');
  },

  _stop() {
    this._stopTick();
    // 重置所有节拍指示器
    const beats = this.data.beats.map(b => ({ ...b, active: false }));
    this.setData({ running: false, beats });
    console.log('[Metronome] Stopped');
  },

  _startTick() {
    const interval = 60000 / this.data.bpm;
    const that = this;
    // 记录首次 tick 的系统时间，用以消除 setInterval 累积漂移
    this._tickBase = Date.now();
    this._nextTickAt = this._tickBase + interval;
    this._timer = setInterval(() => {
      // 等到真正的目标时间再 tick（补偿 setInterval 的漂移）
      const now = Date.now();
      const delay = this._nextTickAt - now;
      if (delay > 0) {
        // 还没到时间，短暂等待（最坏误差 < 16ms，视觉上无感）
        setTimeout(() => { that._tick(); }, delay);
      } else {
        // 已过期（音频回调延迟导致），立即 tick 并更新基准
        that._tick();
      }
      // 计算下一次的目标时间
      that._nextTickAt += interval;
      // 若已严重滞后（超过一个完整 interval），重新对齐基准避免雪崩
      if (Date.now() - that._nextTickAt > interval) {
        that._nextTickAt = Date.now() + interval;
      }
    }, interval);
  },

  _stopTick() {
    if (this._timer) {
      clearInterval(this._timer);
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

    // 1. 更新 UI 节拍指示器
    const beats = this.data.beats.map((b, i) => ({
      ...b,
      active: i === cb,
    }));
    this.setData({ beats });

    // 2. 播放音效
    if (sm === 'traditional') {
      audioManager.play(cb === 0 ? 'strong' : 'weak');
    } else if (sm === 'uniform') {
      audioManager.play('uniform');
    } else if (sm === 'voice') {
      // 合成数字音，支持任意节拍数
      audioManager.playNumber(cb + 1);
    }

    // 3. 推进到下一拍
    this._currentBeat = (cb + 1) % bc;
  },

});
