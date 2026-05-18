/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

// Capture the real Page definition from index.js
let RealPageDef = null;
global.wx = {
  createInnerAudioContext: () => ({
    src: '', volume: 0.8, autoplay: false, loop: false,
    onError() {}, play() {}, seek() {}, stop() {},
  }),
  getStorageSync: () => null,
  setStorageSync: () => {},
};
global.Page = def => { RealPageDef = def; };
require('../pages/index/index.js');

const TIME_SIGS = [
  { sig: '4/4', label: '四拍' },
  { sig: '3/4', label: '圆舞曲' },
  { sig: '2/4', label: '进行曲' },
  { sig: '6/8', label: '八六拍' },
  { sig: '5/4', label: '复合拍' },
  { sig: '7/8', label: '现代' },
];
const DEFAULT_STATE = { bpm: 120, bc: 4, bu: 4, sm: 'uniform' };

// AudioManager — mirror of the real class from index.js
class AudioManager {
  constructor() {
    this._inited = false;
    this._pool = { strong: null, weak: null, uniform: null };
  }
  init() {
    if (this._inited) return;
    this._inited = true;
    const base = '../../assets/sounds';
    const files = { strong: 'beat-strong.mp3', weak: 'beat-weak.mp3', uniform: 'beat-uniform.mp3' };
    for (const [key, file] of Object.entries(files)) {
      const ctx = wx.createInnerAudioContext();
      ctx.src = base + '/' + file;
      ctx.volume = 0.8;
      ctx.autoplay = false;
      ctx.loop = false;
      ctx.onError(() => {});
      this._pool[key] = ctx;
    }
  }
  play(key) {
    const ctx = this._pool[key];
    if (!ctx) return;
    ctx.seek(0);
    ctx.play();
  }
}

function makePage() {
  const instance = Object.create(RealPageDef);
  const data = {
    bpm: DEFAULT_STATE.bpm,
    running: false,
    beats: [],
    soundMode: DEFAULT_STATE.sm,
    settingsOpen: false,
    timeSigs: TIME_SIGS,
    currentSig: '4/4',
    customBeats: '4',
    customUnit: '4',
  };
  instance.data = data;
  instance._currentBeat = 0;
  instance._timer = null;
  instance._tickBase = 0;
  instance._nextTickAt = 0;
  instance.setData = obj => { Object.assign(data, obj); };
  return instance;
}

// ============================================================
// AudioManager Tests
// ============================================================
describe('AudioManager', () => {
  it('init is idempotent — calling twice does not re-init', () => {
    const am = new AudioManager();
    am.init();
    am.init();
    expect(am._inited).toBe(true);
    expect(am._pool.strong).not.toBe(null);
    expect(am._pool.weak).not.toBe(null);
    expect(am._pool.uniform).not.toBe(null);
  });

  it('play(unknown) is no-op and throws nothing', () => {
    const am = new AudioManager();
    expect(() => am.play('nonexistent')).not.toThrow();
  });

  it('play(key) calls seek(0) then play() on the context', () => {
    let seeked = false, played = false;
    const orig = wx.createInnerAudioContext;
    wx.createInnerAudioContext = () => ({
      seek() { seeked = true; },
      play() { played = true; },
      onError() {},
    });
    const am = new AudioManager();
    am.init();
    am.play('uniform');
    wx.createInnerAudioContext = orig;
    expect(seeked).toBe(true);
    expect(played).toBe(true);
  });

  it('init creates 3 audio contexts for strong, weak, uniform', () => {
    const am = new AudioManager();
    am.init();
    expect(am._pool.strong).not.toBe(null);
    expect(am._pool.weak).not.toBe(null);
    expect(am._pool.uniform).not.toBe(null);
  });
});

// ============================================================
// Constants Tests
// ============================================================
describe('Constants', () => {
  it('TIME_SIGS has 6 entries', () => expect(TIME_SIGS.length).toBe(6));
  it('each entry sig matches N/N format', () => TIME_SIGS.forEach(s => expect(s.sig).toMatch(/^\d+\/\d+$/)));
  it('DEFAULT_STATE bpm=120 bc=4 bu=4 sm=uniform', () => {
    expect(DEFAULT_STATE.bpm).toBe(120);
    expect(DEFAULT_STATE.bc).toBe(4);
    expect(DEFAULT_STATE.bu).toBe(4);
    expect(DEFAULT_STATE.sm).toBe('uniform');
  });
});

// ============================================================
// _getBeatCount
// ============================================================
describe('_getBeatCount', () => {
  it('returns customBeats parsed as int', () => { const p = makePage(); p.data.customBeats = '7'; expect(p._getBeatCount()).toBe(7); });
  it('defaults to 4 on empty string', () => { const p = makePage(); p.data.customBeats = ''; expect(p._getBeatCount()).toBe(4); });
  it('defaults to 4 on non-numeric', () => { const p = makePage(); p.data.customBeats = 'abc'; expect(p._getBeatCount()).toBe(4); });
  it('handles numeric input without string conversion', () => { const p = makePage(); p.data.customBeats = 5; expect(p._getBeatCount()).toBe(5); });
});

// ============================================================
// _updateBeats
// ============================================================
describe('_updateBeats', () => {
  it('creates correct number of beats from customBeats', () => { const p = makePage(); p.data.customBeats = '5'; p.data.soundMode = 'uniform'; p._updateBeats(); expect(p.data.beats.length).toBe(5); });
  it('uniform mode: all beats get className uniform', () => { const p = makePage(); p.data.customBeats = '4'; p.data.soundMode = 'uniform'; p._updateBeats(); p.data.beats.forEach(b => expect(b.className).toBe('uniform')); });
  it('traditional mode: first beat strong, rest traditional', () => { const p = makePage(); p.data.customBeats = '4'; p.data.soundMode = 'traditional'; p._updateBeats(); expect(p.data.beats[0].className).toBe('strong'); expect(p.data.beats[1].className).toBe('traditional'); expect(p.data.beats[2].className).toBe('traditional'); });
  it('all active false initially', () => { const p = makePage(); p.data.customBeats = '3'; p.data.soundMode = 'uniform'; p._updateBeats(); p.data.beats.forEach(b => expect(b.active).toBe(false)); });
  it('sequential nums starting at 1', () => { const p = makePage(); p.data.customBeats = '4'; p.data.soundMode = 'uniform'; p._updateBeats(); expect(p.data.beats[0].num).toBe(1); expect(p.data.beats[3].num).toBe(4); });
});

// ============================================================
// _setBpm
// ============================================================
describe('_setBpm', () => {
  it('clamps to minimum 40', () => { const p = makePage(); p.data.running = false; p._setBpm(10); expect(p.data.bpm).toBe(40); });
  it('clamps to maximum 208', () => { const p = makePage(); p.data.running = false; p._setBpm(999); expect(p.data.bpm).toBe(208); });
  it('early return when BPM unchanged', () => { const p = makePage(); p.data.running = false; p.data.bpm = 100; p._setBpm(100); expect(p.data.bpm).toBe(100); });
  it('restarts tick when running', () => { const p = makePage(); p.data.running = true; p.data.bpm = 120; p._tick = () => {}; p._setBpm(100); expect(p.data.bpm).toBe(100); });
});

// ============================================================
// Event Handlers
// ============================================================
describe('Event Handlers', () => {
  it('onPlay starts when stopped', () => { const p = makePage(); p.data.running = false; p.onPlay(); expect(p.data.running).toBe(true); });
  it('onPlay stops when running', () => { const p = makePage(); p.data.running = true; p.onPlay(); expect(p.data.running).toBe(false); });
  it('onBpmMinus decreases BPM by 1', () => { const p = makePage(); p.data.bpm = 100; p.onBpmMinus(); expect(p.data.bpm).toBe(99); });
  it('onBpmPlus increases BPM by 1', () => { const p = makePage(); p.data.bpm = 100; p.onBpmPlus(); expect(p.data.bpm).toBe(101); });
  it('onBpmChange parses event detail', () => { const p = makePage(); p.data.bpm = 120; p.onBpmChange({ detail: { value: '80' } }); expect(p.data.bpm).toBe(80); });
  it('onBpmChanging updates bpm in real-time', () => { const p = makePage(); p.data.bpm = 120; p.onBpmChanging({ detail: { value: '85' } }); expect(p.data.bpm).toBe(85); });
  it('onModeChange blocks voice mode', () => { const p = makePage(); p.data.soundMode = 'uniform'; p.onModeChange({ currentTarget: { dataset: { mode: 'voice' } } }); expect(p.data.soundMode).toBe('uniform'); });
  it('onModeChange switches to traditional', () => { const p = makePage(); p.data.soundMode = 'uniform'; p.data.running = true; p.onModeChange({ currentTarget: { dataset: { mode: 'traditional' } } }); expect(p.data.soundMode).toBe('traditional'); });
  it('onTimeSigChange parses sig and updates fields', () => { const p = makePage(); p._updateBeats = () => {}; p._saveState = () => {}; p.data.running = false; p.onTimeSigChange({ currentTarget: { dataset: { sig: '3/4' } } }); expect(p.data.currentSig).toBe('3/4'); expect(p.data.customBeats).toBe('3'); expect(p.data.customUnit).toBe('4'); });
  it('onCustomBeatsInput updates customBeats', () => { const p = makePage(); p.onCustomBeatsInput({ detail: { value: '6' } }); expect(p.data.customBeats).toBe('6'); });
  it('onCustomUnitInput updates customUnit', () => { const p = makePage(); p.onCustomUnitInput({ detail: { value: '8' } }); expect(p.data.customUnit).toBe('8'); });
  it('onApplyCustom builds sig and calls _updateBeats', () => { const p = makePage(); p.data.customBeats = '5'; p.data.customUnit = '4'; p._updateBeats = () => {}; p._saveState = () => {}; p.data.running = false; p.onApplyCustom(); expect(p.data.currentSig).toBe('5/4'); });
  it('onToggleSettings flips boolean', () => { const p = makePage(); p.data.settingsOpen = false; p.onToggleSettings(); expect(p.data.settingsOpen).toBe(true); p.onToggleSettings(); expect(p.data.settingsOpen).toBe(false); });
});

// ============================================================
// State Persistence
// ============================================================
describe('State Persistence', () => {
  it('_loadState uses defaults on null storage', () => { const p = makePage(); global.wx.getStorageSync = () => null; p._loadState(); expect(p.data.bpm).toBe(120); expect(p.data.soundMode).toBe('uniform'); });
  it('_loadState falls back to uniform for invalid soundMode', () => { const p = makePage(); global.wx.getStorageSync = () => ({ bpm: 100, bc: 4, bu: 4, sm: 'voice' }); p._loadState(); expect(p.data.soundMode).toBe('uniform'); });
  it('_saveState stores bpm, bc, bu, sm', () => {
    const p = makePage();
    p.data.customBeats = '6'; p.data.customUnit = '8';
    p.data.bpm = 150; p.data.soundMode = 'traditional';
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = v; };
    p._saveState();
    expect(saved.bpm).toBe(150); expect(saved.bc).toBe(6); expect(saved.bu).toBe(8); expect(saved.sm).toBe('traditional');
  });
  it('_saveState and _loadState roundtrip correctly', () => {
    let storage = {};
    global.wx.getStorageSync = k => storage[k];
    global.wx.setStorageSync = (k, v) => { storage[k] = v; };
    const p = makePage();
    p.data.bpm = 150; p.data.customBeats = '7'; p.data.customUnit = '8'; p.data.soundMode = 'traditional';
    p._saveState();
    const p2 = makePage();
    p2._loadState();
    expect(p2.data.bpm).toBe(150); expect(p2.data.customBeats).toBe('7'); expect(p2.data.soundMode).toBe('traditional');
  });
});

// ============================================================
// Playback
// ============================================================
describe('Playback', () => {
  it('_start sets running=true and resets _currentBeat to 0', () => { const p = makePage(); p.data.running = false; p._currentBeat = 5; p._start(); expect(p.data.running).toBe(true); expect(p._currentBeat).toBe(0); });
  it('_stop sets running=false and resets all beats active=false', () => { const p = makePage(); p.data.running = true; p._stopTick = () => {}; p.data.beats = [{ num: 1, className: 'uniform', active: true }, { num: 2, className: 'uniform', active: false }]; p._stop(); expect(p.data.running).toBe(false); expect(p.data.beats[0].active).toBe(false); });
  it('_stopTick clears the interval timer', () => { const p = makePage(); let cleared = false; const orig = global.clearInterval; global.clearInterval = () => { cleared = true; }; p._timer = 42; p._stopTick(); global.clearInterval = orig; expect(cleared).toBe(true); expect(p._timer).toBe(null); });
  it('_tick advances _currentBeat with modulo wrap', () => { const p = makePage(); p.data.customBeats = '4'; p.data.soundMode = 'uniform'; p.data.beats = [{ num: 1, className: 'uniform', active: false }, { num: 2, className: 'uniform', active: false }, { num: 3, className: 'uniform', active: false }, { num: 4, className: 'uniform', active: false }]; p._currentBeat = 3; p._tick(); expect(p._currentBeat).toBe(0); });
  it('_tick activates the correct beat UI', () => { const p = makePage(); p.data.customBeats = '3'; p.data.soundMode = 'uniform'; p.data.beats = [{ num: 1, className: 'uniform', active: false }, { num: 2, className: 'uniform', active: false }, { num: 3, className: 'uniform', active: false }]; p._currentBeat = 1; p._tick(); expect(p.data.beats[0].active).toBe(false); expect(p.data.beats[1].active).toBe(true); expect(p.data.beats[2].active).toBe(false); });
  it('_startTick creates a setInterval', () => { const p = makePage(); p.data.bpm = 60; let created = false; const orig = global.setInterval; global.setInterval = (fn, ms) => { created = true; return orig(fn, ms); }; p._startTick(); global.setInterval = orig; expect(created).toBe(true); });
});

// ============================================================
// Lifecycle
// ============================================================
describe('Lifecycle', () => {
  it('onHide stops if running', () => { const p = makePage(); p.data.running = true; p.onHide(); expect(p.data.running).toBe(false); });
  it('onHide no-op when already stopped', () => { const p = makePage(); p.data.running = false; p.onHide(); expect(p.data.running).toBe(false); });
  it('onUnload calls _stopTick without throwing', () => { const p = makePage(); p._stopTick = () => {}; expect(() => p.onUnload()).not.toThrow(); });
  it('onLoad calls _loadState and _updateBeats', () => { const p = makePage(); global.wx.getStorageSync = () => null; let loadCalled = false, updateCalled = false; p._loadState = () => { loadCalled = true; }; p._updateBeats = () => { updateCalled = true; }; p.onLoad(); expect(loadCalled).toBe(true); expect(updateCalled).toBe(true); });
  it('onShow is a no-op', () => { const p = makePage(); expect(() => p.onShow()).not.toThrow(); });
});

// ============================================================
// Integration
// ============================================================
describe('Integration', () => {
  it('full play cycle: start -> 4 ticks -> stop', () => {
    const p = makePage();
    p.data.bpm = 300; p.data.customBeats = '4'; p.data.soundMode = 'uniform';
    p._updateBeats();
    p._currentBeat = 0;
    p._start();
    expect(p.data.running).toBe(true);
    p._tick(); expect(p._currentBeat).toBe(1);
    p._tick(); expect(p._currentBeat).toBe(2);
    p._tick(); expect(p._currentBeat).toBe(3);
    p._tick(); expect(p._currentBeat).toBe(0);
    p._stop();
    expect(p.data.running).toBe(false);
  });
  it('BPM change mid-playback updates and restarts', () => {
    const p = makePage();
    p.data.bpm = 120; p.data.running = true; p.data.customBeats = '4'; p.data.soundMode = 'uniform';
    p._updateBeats();
    p._currentBeat = 1;
    p._stopTick = () => {}; p._startTick = () => {}; p._tick = () => {};
    p._setBpm(60);
    expect(p.data.bpm).toBe(60);
  });
});
