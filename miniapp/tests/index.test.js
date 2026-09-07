/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

// Capture the real Page definition from index.js
let RealPageDef = null;
global.__audioAutoCanplay = true;
global.wx = {
  createInnerAudioContext: () => {
    let canplayFn = null;
    let errorFn = null;
    const ctx = {
      src: '', volume: 0.8, autoplay: false, loop: false, _played: 0,
      onError(fn) { errorFn = fn; ctx._errorFn = fn; },
      onCanplay(fn) {
        canplayFn = fn;
        ctx._canplayFn = fn;
        if (fn && global.__audioAutoCanplay !== false) fn();
      },
      onPlay() {}, onPause() {}, onStop() {}, onEnded() {}, onWaiting() {},
      play() { ctx._played += 1; },
      seek() {}, stop() {}, pause() {}, destroy() {},
      __fireCanplay() { if (canplayFn) canplayFn(); },
      __fireError() { if (errorFn) errorFn(); },
    };
    return ctx;
  },
  getStorageSync: () => null,
  setStorageSync: () => {},
  getSystemInfoSync: () => ({ language: 'zh_CN', platform: 'devtools' }),
};
global.Page = def => { RealPageDef = def; };
const mini = require('../pages/index/index.js');
const { AudioManager, getAudioManager, VOICE_CLICK_GAIN, OVERLAY_KEY, parseStrictInt, clampBpmInput, clampVolInput, normalizeTimeSig, clampMeterPart } = mini;
const { getI18n } = require('../utils/i18n');

const TIME_SIGS = [
  { sig: '4/4', label: '四拍' },
  { sig: '3/4', label: '圆舞曲' },
  { sig: '2/4', label: '进行曲' },
  { sig: '6/8', label: '八六拍' },
  { sig: '5/4', label: '复合拍' },
  { sig: '7/8', label: '现代' },
];
const DEFAULT_STATE = { bpm: 120, bc: 4, bu: 4, sm: 'uniform' };

function makePage() {
  const instance = Object.create(RealPageDef);
  const i18nZh = getI18n('zh');
  const data = {
    bpm: DEFAULT_STATE.bpm,
    running: false,
    beats: [],
    soundMode: DEFAULT_STATE.sm,
    vol: 85,
    settingsOpen: false,
    timeSigs: TIME_SIGS,
    currentSig: '4/4',
    bc: 4,
    bu: 4,
    customBeats: '4',
    customUnit: '4',
    // v2.2 新增字段（_refreshNowPlaying / handlers 会读）
    nowPlayingText: '',
    audioNote: '',
    silentHintShow: false,
    lang: 'zh',
    i18n: i18nZh,
  };
  instance.data = data;
  instance._currentBeat = 0;
  instance._timer = null;
  instance._tickBase = 0;
  instance._tickCount = 0;
  instance._prevActive = undefined;
  // Path-aware setData mock: 'beats[1].active' → data.beats[1].active,
  // auto-creates intermediate arrays/objects when missing
  instance.setData = obj => {
    for (const [k, v] of Object.entries(obj)) {
      const m = /^([^\[]+)(?:\[(\d+)\])?(?:\.([^.[\]]+))?$/.exec(k);
      if (!m) { Object.assign(data, obj); return; }
      const [, base, idx, leaf] = m;
      if (idx !== undefined) {
        if (!data[base]) data[base] = [];
        while (data[base].length <= parseInt(idx)) data[base].push({});
        if (leaf) data[base][parseInt(idx)][leaf] = v;
        else data[base][parseInt(idx)] = v;
      } else if (leaf) {
        if (!data[base] || typeof data[base] !== 'object') data[base] = {};
        data[base][leaf] = v;
      } else {
        data[base] = v;
      }
    }
  };
  return instance;
}

// ============================================================
// AudioManager Tests
// ============================================================
describe('AudioManager', () => {
  it('init is idempotent — calling twice does not re-init', () => {
    const am = new AudioManager();
    am.init();
    const n = am._pool.uniform.length;
    am.init();
    expect(am._inited).toBe(true);
    expect(am._pool.uniform.length).toBe(n);
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
      onCanplay(fn) { if (fn) fn(); },
    });
    const am = new AudioManager();
    am.init();
    am.allowPlay();
    am.play('uniform');
    wx.createInnerAudioContext = orig;
    expect(seeked).toBe(true);
    expect(played).toBe(true);
  });

  it('init creates click pools plus isolated weak overlay', () => {
    const am = new AudioManager();
    am.init();
    expect(am._pool.strong.length).toBeGreaterThan(0);
    expect(am._pool.weak.length).toBeGreaterThan(0);
    expect(am._pool.uniform.length).toBeGreaterThan(0);
    expect(am._pool[OVERLAY_KEY].length).toBeGreaterThan(0);
    expect(VOICE_CLICK_GAIN).toBe(0.28);
  });

  it('overlay volume is master * 0.28; uniform stays at master', () => {
    const am = new AudioManager();
    am.init();
    am.setVolume(1);
    expect(am._pool.uniform[0].volume).toBeCloseTo(1, 5);
    expect(am._pool.weak[0].volume).toBeCloseTo(1, 5);
    expect(am._pool[OVERLAY_KEY][0].volume).toBeCloseTo(0.28, 5);
    am.setVolume(0.5);
    expect(am._pool.uniform[0].volume).toBeCloseTo(0.5, 5);
    expect(am._pool[OVERLAY_KEY][0].volume).toBeCloseTo(0.14, 5);
  });

  it('ensureVoice does not retune overlay or click pools', () => {
    const am = new AudioManager();
    am.init();
    am.setVolume(0.8);
    am.ensureVoice('zh');
    am.ensureVoice('en');
    expect(am._pool[OVERLAY_KEY][0].volume).toBeCloseTo(0.8 * 0.28, 5);
    expect(am._pool.uniform[0].volume).toBeCloseTo(0.8, 5);
    expect(am._voiceLang).toBe('en');
  });

  it('destroy releases pools so later init is clean', () => {
    const am = new AudioManager();
    am.init();
    am.ensureVoice('zh');
    am.destroy();
    expect(am._inited).toBe(false);
    expect(am._pool.uniform).toBeUndefined();
    am.init();
    expect(am._pool.uniform.length).toBeGreaterThan(0);
    expect(am._pool[OVERLAY_KEY][0].volume).toBeCloseTo(am._vol * 0.28, 5);
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

describe('normalizeTimeSig', () => {
  it('clamps complete integers and keeps fallback for junk', () => {
    expect(normalizeTimeSig('5', '8', 4, 4)).toEqual({ bc: 5, bu: 8 });
    expect(normalizeTimeSig('99', '99', 4, 4)).toEqual({ bc: 16, bu: 16 });
    expect(normalizeTimeSig('0', '-3', 4, 4)).toEqual({ bc: 1, bu: 1 });
    expect(normalizeTimeSig('', 'abc', 3, 4)).toEqual({ bc: 3, bu: 4 });
    expect(normalizeTimeSig('12a', '4.5', 3, 4)).toEqual({ bc: 3, bu: 4 });
    expect(clampMeterPart('7', 4)).toBe(7);
    expect(clampMeterPart('nope', 4)).toBe(4);
  });
});

// ============================================================
// _getBeatCount
// ============================================================
describe('_getBeatCount', () => {
  it('uses applied bc, not the draft input', () => {
    const p = makePage();
    p.data.bc = 3;
    p.data.customBeats = '7';
    expect(p._getBeatCount()).toBe(3);
  });
  it('defaults to 4 when applied bc is missing', () => {
    const p = makePage();
    p.data.bc = undefined;
    p.data.customBeats = '9';
    expect(p._getBeatCount()).toBe(4);
  });
  it('clamps applied bc to 1–16', () => {
    const p = makePage();
    p.data.bc = 99;
    expect(p._getBeatCount()).toBe(16);
    p.data.bc = 0;
    expect(p._getBeatCount()).toBe(1);
  });
});

// ============================================================
// _updateBeats
// ============================================================
describe('_updateBeats', () => {
  it('creates correct number of beats from applied bc', () => { const p = makePage(); p.data.bc = 5; p.data.soundMode = 'uniform'; p._updateBeats(); expect(p.data.beats.length).toBe(5); });
  it('uniform mode: all beats get className uniform', () => { const p = makePage(); p.data.bc = 4; p.data.soundMode = 'uniform'; p._updateBeats(); p.data.beats.forEach(b => expect(b.className).toBe('uniform')); });
  it('traditional mode: first beat strong, rest traditional', () => { const p = makePage(); p.data.bc = 4; p.data.soundMode = 'traditional'; p._updateBeats(); expect(p.data.beats[0].className).toBe('strong'); expect(p.data.beats[1].className).toBe('traditional'); expect(p.data.beats[2].className).toBe('traditional'); });
  it('all active false initially', () => { const p = makePage(); p.data.bc = 3; p.data.soundMode = 'uniform'; p._updateBeats(); p.data.beats.forEach(b => expect(b.active).toBe(false)); });
  it('sequential nums starting at 1', () => { const p = makePage(); p.data.bc = 4; p.data.soundMode = 'uniform'; p._updateBeats(); expect(p.data.beats[0].num).toBe(1); expect(p.data.beats[3].num).toBe(4); });
});

// ============================================================
// _setBpm
// ============================================================
describe('_setBpm', () => {
  it('clamps to minimum 40', () => { const p = makePage(); p.data.running = false; p._setBpm(10); expect(p.data.bpm).toBe(40); });
  it('clamps to maximum 208', () => { const p = makePage(); p.data.running = false; p._setBpm(999); expect(p.data.bpm).toBe(208); });
  it('early return when BPM unchanged', () => { const p = makePage(); p.data.running = false; p.data.bpm = 100; p._setBpm(100); expect(p.data.bpm).toBe(100); });
  it('does not restart the clock when running', () => {
    const p = makePage();
    p.data.running = true;
    p.data.bpm = 120;
    let ticks = 0;
    p._tick = () => { ticks += 1; };
    p._startTick = () => { throw new Error('must not restart'); };
    p._stopTick = () => { throw new Error('must not stop'); };
    p._setBpm(100);
    expect(p.data.bpm).toBe(100);
    expect(ticks).toBe(0);
  });
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
  it('onModeChange switches to voice mode', () => { const p = makePage(); p.data.soundMode = 'uniform'; p.onModeChange({ currentTarget: { dataset: { mode: 'voice' } } }); expect(p.data.soundMode).toBe('voice'); });
  it('onModeChange switches to traditional', () => { const p = makePage(); p.data.soundMode = 'uniform'; p.data.running = true; p.onModeChange({ currentTarget: { dataset: { mode: 'traditional' } } }); expect(p.data.soundMode).toBe('traditional'); });
  it('onTimeSigChange parses sig and updates fields', () => { const p = makePage(); p._updateBeats = () => {}; p._saveState = () => {}; p.data.running = false; p.onTimeSigChange({ currentTarget: { dataset: { sig: '3/4' } } }); expect(p.data.currentSig).toBe('3/4'); expect(p.data.bc).toBe(3); expect(p.data.customBeats).toBe('3'); expect(p.data.customUnit).toBe('4'); });
  it('onCustomBeatsInput updates draft only', () => { const p = makePage(); p.onCustomBeatsInput({ detail: { value: '6' } }); expect(p.data.customBeats).toBe('6'); expect(p.data.bc).toBe(4); expect(p._getBeatCount()).toBe(4); });
  it('onCustomUnitInput updates customUnit', () => { const p = makePage(); p.onCustomUnitInput({ detail: { value: '8' } }); expect(p.data.customUnit).toBe('8'); expect(p.data.bu).toBe(4); });
  it('onApplyCustom builds sig and calls _updateBeats', () => { const p = makePage(); p.data.customBeats = '5'; p.data.customUnit = '4'; p._updateBeats = () => {}; p._saveState = () => {}; p.data.running = false; p.onApplyCustom(); expect(p.data.currentSig).toBe('5/4'); expect(p.data.bc).toBe(5); });
  it('unapplied custom draft does not change clock, beats, or storage', () => {
    const p = makePage();
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = v; };
    p.onTimeSigChange({ currentTarget: { dataset: { sig: '3/4' } } });
    expect(p.data.currentSig).toBe('3/4');
    expect(p.data.beats.length).toBe(3);
    p.onCustomBeatsInput({ detail: { value: '5' } });
    expect(p.data.currentSig).toBe('3/4');
    expect(p.data.beats.length).toBe(3);
    expect(p._getBeatCount()).toBe(3);
    p._saveState();
    expect(saved.bc).toBe(3);
    expect(saved.bu).toBe(4);
  });
  it('onApplyCustom 99/99 normalizes label, beats, and storage together', () => {
    const p = makePage();
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = v; };
    p.data.customBeats = '99';
    p.data.customUnit = '99';
    p.onApplyCustom();
    expect(p.data.currentSig).toBe('16/16');
    expect(p.data.bc).toBe(16);
    expect(p.data.bu).toBe(16);
    expect(p.data.customBeats).toBe('16');
    expect(p.data.customUnit).toBe('16');
    expect(p.data.beats.length).toBe(16);
    expect(saved.bc).toBe(16);
    expect(saved.bu).toBe(16);
  });
  it('onApplyCustom rejects incomplete integers and keeps applied meter', () => {
    const p = makePage();
    p.data.bc = 3;
    p.data.bu = 4;
    p.data.currentSig = '3/4';
    p.data.customBeats = '12a';
    p.data.customUnit = '';
    p.onApplyCustom();
    expect(p.data.currentSig).toBe('3/4');
    expect(p.data.bc).toBe(3);
    expect(p.data.customBeats).toBe('3');
    expect(p.data.customUnit).toBe('4');
  });
  it('onToggleSettings flips boolean', () => { const p = makePage(); p.data.settingsOpen = false; p.onToggleSettings(); expect(p.data.settingsOpen).toBe(true); p.onToggleSettings(); expect(p.data.settingsOpen).toBe(false); });
  it('onVolChange clamps and persists volume', () => {
    const p = makePage();
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = v; };
    p.onVolChange({ detail: { value: '250' } });
    expect(p.data.vol).toBe(100);
    expect(saved.vol).toBe(100);
    p.onVolChange({ detail: { value: '1' } });
    expect(p.data.vol).toBe(10);
  });
});

// ============================================================
// State Persistence
// ============================================================
describe('State Persistence', () => {
  it('_loadState uses defaults on null storage', () => { const p = makePage(); global.wx.getStorageSync = () => null; p._loadState(); expect(p.data.bpm).toBe(120); expect(p.data.soundMode).toBe('uniform'); });
  it('_loadState keeps voice soundMode', () => { const p = makePage(); global.wx.getStorageSync = () => ({ bpm: 100, bc: 4, bu: 4, sm: 'voice', vol: 70 }); p._loadState(); expect(p.data.soundMode).toBe('voice'); expect(p.data.vol).toBe(70); });
  it('_loadState falls back to uniform for invalid soundMode', () => { const p = makePage(); global.wx.getStorageSync = () => ({ bpm: 100, bc: 4, bu: 4, sm: 'laser' }); p._loadState(); expect(p.data.soundMode).toBe('uniform'); });
  it('_loadState clamps illegal bpm/bc/vol', () => {
    const p = makePage();
    global.wx.getStorageSync = () => ({ bpm: 999, bc: 0, bu: 99, sm: 'voice', vol: 3 });
    p._loadState();
    expect(p.data.bpm).toBe(208);
    expect(p.data.bc).toBe(1);
    expect(p.data.bu).toBe(16);
    expect(p.data.customBeats).toBe('1');
    expect(p.data.customUnit).toBe('16');
    expect(p.data.vol).toBe(10);
    expect(p.data.soundMode).toBe('voice');
  });
  it('_saveState stores bpm, bc, bu, sm, vol', () => {
    const p = makePage();
    p.data.bc = 6; p.data.bu = 8;
    p.data.customBeats = '6'; p.data.customUnit = '8';
    p.data.bpm = 150; p.data.soundMode = 'traditional'; p.data.vol = 40;
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = v; };
    p._saveState();
    expect(saved.bpm).toBe(150); expect(saved.bc).toBe(6); expect(saved.bu).toBe(8);
    expect(saved.sm).toBe('traditional'); expect(saved.vol).toBe(40);
  });
  it('_saveState and _loadState roundtrip voice + volume', () => {
    let storage = {};
    global.wx.getStorageSync = k => storage[k];
    global.wx.setStorageSync = (k, v) => { storage[k] = v; };
    const p = makePage();
    p.data.bpm = 150; p.data.bc = 7; p.data.bu = 8; p.data.customBeats = '7'; p.data.customUnit = '8';
    p.data.soundMode = 'voice'; p.data.vol = 62;
    p._saveState();
    const p2 = makePage();
    p2._loadState();
    expect(p2.data.bpm).toBe(150); expect(p2.data.customBeats).toBe('7');
    expect(p2.data.soundMode).toBe('voice'); expect(p2.data.vol).toBe(62);
  });
});

// ============================================================
// Playback
// ============================================================
describe('Playback', () => {
  it('_start sets running=true, resets _currentBeat to 0, fires one immediate tick', () => { const p = makePage(); p.data.running = false; p._currentBeat = 5; p._start(); expect(p.data.running).toBe(true); expect(p._currentBeat).toBe(1); });
  it('_stop sets running=false and resets all beats active=false', () => { const p = makePage(); p.data.running = true; p._stopTick = () => {}; p.data.beats = [{ num: 1, className: 'uniform', active: true }, { num: 2, className: 'uniform', active: false }]; p._stop(); expect(p.data.running).toBe(false); expect(p.data.beats[0].active).toBe(false); });
  it('_tick advances _currentBeat with modulo wrap', () => { const p = makePage(); p.data.bc = 4; p.data.soundMode = 'uniform'; p.data.beats = [{ num: 1, className: 'uniform', active: false }, { num: 2, className: 'uniform', active: false }, { num: 3, className: 'uniform', active: false }, { num: 4, className: 'uniform', active: false }]; p._currentBeat = 3; p._tick(); expect(p._currentBeat).toBe(0); });
  it('_tick activates the correct beat UI', () => { const p = makePage(); p.data.bc = 3; p.data.soundMode = 'uniform'; p.data.beats = [{ num: 1, className: 'uniform', active: false }, { num: 2, className: 'uniform', active: false }, { num: 3, className: 'uniform', active: false }]; p._currentBeat = 1; p._tick(); expect(p.data.beats[0].active).toBe(false); expect(p.data.beats[1].active).toBe(true); expect(p.data.beats[2].active).toBe(false); });
  it('_tick deactivates previous beat on subsequent ticks', () => { const p = makePage(); p.data.bc = 3; p.data.soundMode = 'uniform'; p.data.beats = [{ num: 1, className: 'uniform', active: false }, { num: 2, className: 'uniform', active: false }, { num: 3, className: 'uniform', active: false }]; p._currentBeat = 0; p._tick(); expect(p.data.beats[0].active).toBe(true); p._currentBeat = 1; p._tick(); expect(p.data.beats[0].active).toBe(false); expect(p.data.beats[1].active).toBe(true); });
  it('_startTick uses setTimeout chain (not setInterval)', () => { const p = makePage(); p.data.bpm = 60; p.data.running = true; p._tick = () => {}; let timeoutCreated = false; let intervalCreated = false; const origSetTimeout = global.setTimeout; const origSetInterval = global.setInterval; global.setTimeout = (fn, ms) => { timeoutCreated = true; return origSetTimeout(fn, ms); }; global.setInterval = (fn, ms) => { intervalCreated = true; return origSetInterval(fn, ms); }; p._startTick(); global.setTimeout = origSetTimeout; global.setInterval = origSetInterval; expect(timeoutCreated).toBe(true); expect(intervalCreated).toBe(false); });
  it('_stopTick clears the setTimeout timer', () => { const p = makePage(); let cleared = false; const orig = global.clearTimeout; global.clearTimeout = () => { cleared = true; }; p._timer = 42; p._stopTick(); global.clearTimeout = orig; expect(cleared).toBe(true); expect(p._timer).toBe(null); });
  it('_armNext uses absolute _nextAt — delay = target - now', () => {
    const p = makePage();
    p.data.running = true;
    p._runId = 1;
    p._tick = () => {};
    const captured = [];
    const orig = global.setTimeout;
    global.setTimeout = (...args) => { captured.push(args[1]); return 99; };
    global.__setMockNow(1000);
    p._nextAt = 1500;
    p._armNext();
    global.setTimeout = orig;
    expect(captured.length).toBe(1);
    expect(captured[0]).toBe(500);
  });
  it('_armNext stops chaining when running=false', () => {
    const p = makePage();
    p.data.running = false;
    p._tick = () => {};
    let timeoutCreated = false;
    const orig = global.setTimeout;
    global.setTimeout = () => { timeoutCreated = true; return 99; };
    p._armNext();
    global.setTimeout = orig;
    expect(timeoutCreated).toBe(false);
  });
  it('voice tick plays count sample plus weak overlay', () => {
    const am = getAudioManager();
    am.init();
    am.ensureVoice('zh');
    am.allowPlay();
    const plays = [];
    const orig = am.play.bind(am);
    am.play = (key) => { plays.push(key); return true; };
    const p = makePage();
    p.data.soundMode = 'voice';
    p.data.customBeats = '4';
    p._updateBeats();
    p._currentBeat = 0;
    p._tick();
    am.play = orig;
    expect(plays).toEqual(['v1', OVERLAY_KEY]);
  });
  it('traditional tick does not use overlay', () => {
    const am = getAudioManager();
    const plays = [];
    const orig = am.play.bind(am);
    am.play = (key) => { plays.push(key); };
    const p = makePage();
    p.data.soundMode = 'traditional';
    p.data.customBeats = '4';
    p._updateBeats();
    p._currentBeat = 1;
    p._tick();
    am.play = orig;
    expect(plays).toEqual(['weak']);
  });
});

// ============================================================
// Lifecycle
// ============================================================
describe('Lifecycle', () => {
  it('onHide stops if running', () => { const p = makePage(); p.data.running = true; p.onHide(); expect(p.data.running).toBe(false); });
  it('onHide no-op when already stopped', () => { const p = makePage(); p.data.running = false; p.onHide(); expect(p.data.running).toBe(false); });
  it('onUnload calls _stopTick without throwing', () => { const p = makePage(); expect(() => p.onUnload()).not.toThrow(); expect(p.data.running).toBe(false); });
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
    // _start() now fires one immediate tick (better UX: instant feedback on press)
    expect(p._currentBeat).toBe(1);
    p._tick(); expect(p._currentBeat).toBe(2);
    p._tick(); expect(p._currentBeat).toBe(3);
    p._tick(); expect(p._currentBeat).toBe(0);
    p._tick(); expect(p._currentBeat).toBe(1);
    p._stop();
    expect(p.data.running).toBe(false);
  });
  it('BPM change mid-playback keeps beat index and does not fire extra tick', () => {
    const p = makePage();
    p.data.bpm = 60;
    p.data.customBeats = '4';
    p.data.soundMode = 'uniform';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    expect(p._currentBeat).toBe(1);
    const pending = p._timer;
    p._setBpm(120);
    expect(p.data.bpm).toBe(120);
    expect(p._currentBeat).toBe(1);
    expect(p._timer).toBe(pending);
    global.__setMockNow(1000);
    global.__runTimeout(pending);
    expect(p._currentBeat).toBe(2);
    const nextId = p._timer;
    expect(nextId).not.toBe(null);
    global.__setMockNow(1500);
    global.__runTimeout(nextId);
    expect(p._currentBeat).toBe(3);
  });

  it('slider drag and release do not open a second clock', () => {
    const p = makePage();
    p.data.bpm = 60;
    p.data.customBeats = '4';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    const pending = p._timer;
    const beat = p._currentBeat;
    p.onBpmChanging({ detail: { value: '90' } });
    p.onBpmChanging({ detail: { value: '110' } });
    p.onBpmChange({ detail: { value: '120' } });
    expect(p.data.bpm).toBe(120);
    expect(p._timer).toBe(pending);
    expect(p._currentBeat).toBe(beat);
    expect(global.__timeoutIds().length).toBe(1);
  });

  it('stop then invoking the old timeout callback does not tick or reschedule', () => {
    const p = makePage();
    p.data.bpm = 60;
    p.data.customBeats = '4';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    const pending = p._timer;
    const late = global.__peekTimeout(pending);
    expect(typeof late).toBe('function');
    const beatAtStop = p._currentBeat;
    p._stop();
    expect(p.data.running).toBe(false);
    expect(p._timer).toBe(null);
    late();
    expect(p._currentBeat).toBe(beatAtStop);
    expect(p._timer).toBe(null);
    expect(p.data.running).toBe(false);

    global.__setMockNow(0);
    p._start();
    const beatAfterRestart = p._currentBeat;
    const timerAfterRestart = p._timer;
    late();
    expect(p.data.running).toBe(true);
    expect(p._currentBeat).toBe(beatAfterRestart);
    expect(p._timer).toBe(timerAfterRestart);
  });

  it('second start while running is a no-op', () => {
    const p = makePage();
    p.data.customBeats = '4';
    p._updateBeats();
    global.__setMockNow(0);
    p._start();
    const beat = p._currentBeat;
    const timer = p._timer;
    p._start();
    expect(p._currentBeat).toBe(beat);
    expect(p._timer).toBe(timer);
  });
});

describe('Silent hint', () => {
  it('shows then dismisses on iOS first play', () => {
    const p = makePage();
    global.wx.getStorageSync = () => '';
    global.wx.getSystemInfoSync = () => ({ platform: 'ios', system: 'iOS 17' });
    global.__clearAllTimers();
    p._maybeShowSilentHint();
    expect(p._silentHintShown).toBe(true);
    const first = global.__timeoutIds()[0];
    global.__runTimeout(first);
    expect(p.data.silentHintShow).toBe(true);
    p.onSilentHintClose();
    expect(p.data.silentHintShow).toBe(false);
  });

  it('_dismissSilentHint writes storage and is idempotent', () => {
    const p = makePage();
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = [k, v]; };
    p.data.silentHintShow = true;
    p._silentHintTimer = 1;
    p._dismissSilentHint();
    expect(p.data.silentHintShow).toBe(false);
    expect(saved[0]).toBe('metronome_silent_hint_v1');
    p._dismissSilentHint();
    expect(p.data.silentHintShow).toBe(false);
  });

  it('skips silent hint on non-iOS', () => {
    const p = makePage();
    global.wx.getStorageSync = () => '';
    global.wx.getSystemInfoSync = () => ({ platform: 'android', system: 'Android 14' });
    p._maybeShowSilentHint();
    expect(p._silentHintShown).toBeUndefined();
  });
});

describe('Donate and share hooks', () => {
  it('onDonate navigates to zh donate url', () => {
    const p = makePage();
    let url = null;
    global.wx.navigateTo = (opts) => { url = opts.url; };
    p.onDonate();
    expect(url).toContain(encodeURIComponent('https://jpq.weichao.studio/about#donate'));
  });

  it('onDonate falls back to modal when navigate fails', () => {
    const p = makePage();
    let modal = false;
    global.wx.navigateTo = (opts) => { opts.fail(new Error('domain')); };
    global.wx.showModal = () => { modal = true; };
    p.onDonate();
    expect(modal).toBe(true);
  });

  it('onCopyUrl copies the donate link', () => {
    const p = makePage();
    let copied = null;
    global.wx.setClipboardData = (opts) => { copied = opts.data; if (opts.success) opts.success(); };
    global.wx.showToast = () => {};
    p.onCopyUrl();
    expect(copied).toBe('https://jpq.weichao.studio/about#donate');
  });

  it('onShareAppMessage returns a path', () => {
    const p = makePage();
    const msg = p.onShareAppMessage();
    expect(msg.path).toContain('/pages/index/index');
  });

  it('onShareTimeline returns a title', () => {
    const p = makePage();
    expect(p.onShareTimeline().title).toBeTruthy();
  });

  it('onInfo shows a modal', () => {
    const p = makePage();
    let opened = false;
    global.wx.showModal = () => { opened = true; };
    p.onInfo();
    expect(opened).toBe(true);
  });

  it('onLangToggle flips lang and persists', () => {
    const p = makePage();
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = [k, v]; };
    p.onLangToggle();
    expect(p.data.lang).toBe('en');
    expect(saved[0]).toBe('metronome_lang');
    p.onLangToggle();
    expect(p.data.lang).toBe('zh');
  });

  it('onVolChanging updates live volume without overlay leak', () => {
    const am = getAudioManager();
    am.init();
    am.setVolume(0.85);
    const p = makePage();
    p.onVolChanging({ detail: { value: '50' } });
    expect(p.data.vol).toBe(50);
    expect(am._pool[OVERLAY_KEY][0].volume).toBeCloseTo(0.5 * 0.28, 5);
    expect(am._pool.uniform[0].volume).toBeCloseTo(0.5, 5);
  });
});

describe('parseStrictInt / clampBpmInput', () => {
  it('accepts whole numbers and decimal-digit strings', () => {
    expect(parseStrictInt(80)).toBe(80);
    expect(parseStrictInt('80')).toBe(80);
    expect(parseStrictInt(' 208 ')).toBe(208);
    expect(clampBpmInput(10)).toBe(40);
    expect(clampBpmInput(999)).toBe(208);
    expect(clampBpmInput('120')).toBe(120);
  });
  it('rejects prefix parses, floats, empty, NaN', () => {
    expect(parseStrictInt('80abc')).toBeNull();
    expect(parseStrictInt('1e2')).toBeNull();
    expect(parseStrictInt('')).toBeNull();
    expect(parseStrictInt(' ')).toBeNull();
    expect(parseStrictInt(NaN)).toBeNull();
    expect(parseStrictInt(100.5)).toBeNull();
    expect(parseStrictInt(null)).toBeNull();
    expect(parseStrictInt(undefined)).toBeNull();
    expect(clampBpmInput('80abc')).toBeNull();
    expect(clampBpmInput('')).toBeNull();
  });
});

describe('R05 illegal BPM events are ignored', () => {
  it('onBpmChange ignores illegal values and does not persist them', () => {
    const p = makePage();
    p.data.bpm = 120;
    let saved = null;
    global.wx.setStorageSync = (k, v) => { saved = v; };
    ['80abc', '', 'NaN', '1e2', null, undefined, '  ', 100.5].forEach((v) => {
      p.onBpmChange({ detail: { value: v } });
      expect(p.data.bpm).toBe(120);
    });
    expect(saved).toBeNull();
  });
  it('onBpmChanging ignores illegal values', () => {
    const p = makePage();
    p.data.bpm = 90;
    p.onBpmChanging({ detail: { value: '80abc' } });
    p.onBpmChanging({ detail: { value: '' } });
    p.onBpmChanging({ detail: {} });
    expect(p.data.bpm).toBe(90);
  });
  it('_setBpm ignores NaN/empty and still clamps legal extremes', () => {
    const p = makePage();
    p.data.bpm = 100;
    p._setBpm(NaN);
    p._setBpm('');
    p._setBpm('80abc');
    expect(p.data.bpm).toBe(100);
    p._setBpm(10);
    expect(p.data.bpm).toBe(40);
    p._setBpm(999);
    expect(p.data.bpm).toBe(208);
  });
  it('illegal BPM cannot produce a 0ms timer loop', () => {
    const p = makePage();
    p.data.bpm = 120;
    p.data.customBeats = '4';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    p.onBpmChange({ detail: { value: '80abc' } });
    p.onBpmChanging({ detail: { value: '' } });
    p._setBpm(NaN);
    expect(p.data.bpm).toBe(120);
    const entries = global.__timeoutEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].ms).toBe(500);
  });
});

describe('R04 late clock drops expired beats', () => {
  it('a callback late by many intervals fires one beat then waits one interval', () => {
    const p = makePage();
    p.data.bpm = 120;
    p.data.customBeats = '4';
    p.data.soundMode = 'uniform';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    let ticks = 0;
    const realTick = p._tick.bind(p);
    p._tick = () => { ticks += 1; realTick(); };
    p._start();
    expect(ticks).toBe(1);
    const first = p._timer;
    global.__setMockNow(5000);
    global.__runTimeout(first);
    expect(ticks).toBe(2);
    expect(p._currentBeat).toBe(2);
    expect(p._nextAt).toBe(5500);
    const pending = global.__timeoutEntries();
    expect(pending.length).toBe(1);
    expect(pending[0].ms).toBe(500);
    expect(pending.every((e) => e.ms > 0)).toBe(true);
  });
  it('40 to 208 while playing does not burst or restart', () => {
    const p = makePage();
    p.data.bpm = 40;
    p.data.customBeats = '4';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    const pending = p._timer;
    const beat = p._currentBeat;
    p._setBpm(208);
    expect(p.data.bpm).toBe(208);
    expect(p._timer).toBe(pending);
    expect(p._currentBeat).toBe(beat);
    global.__setMockNow(10000);
    global.__runTimeout(pending);
    expect(p._currentBeat).toBe(beat + 1);
    const next = global.__timeoutEntries();
    expect(next.length).toBe(1);
    const interval = 60000 / 208;
    expect(next[0].ms).toBeCloseTo(interval, 5);
    expect(p._nextAt).toBeCloseTo(10000 + interval, 5);
  });
});

describe('R06 audio skip / cancel', () => {
  it('counts 4 click pools x3 plus 16 voice x2 = 44', () => {
    const am = new AudioManager();
    am.init();
    expect(am.ctxCount()).toBe(12);
    am.ensureVoice('zh');
    expect(am.ctxCount()).toBe(44);
  });
  it('skips the beat when a slot is not ready and does not queue retry', () => {
    global.__audioAutoCanplay = false;
    const am = new AudioManager();
    am.init();
    am.allowPlay();
    expect(am.play('uniform')).toBe(false);
    expect(am._pool.uniform[0]._played).toBe(0);
    am._pool.uniform[0].__fireCanplay();
    expect(am.play('uniform')).toBe(true);
    expect(am._pool.uniform[0]._played).toBe(1);
    global.__audioAutoCanplay = true;
  });
  it('voice needs both count and overlay ready; they do not catch up independently', () => {
    global.__audioAutoCanplay = false;
    const am = new AudioManager();
    am.init();
    am.ensureVoice('zh');
    am.allowPlay();
    expect(am.playVoiceBeat(0)).toBe(false);
    am._pool.v1[0].__fireCanplay();
    expect(am.playVoiceBeat(0)).toBe(false);
    expect(am._pool.v1[0]._played).toBe(0);
    am._pool[OVERLAY_KEY][0].__fireCanplay();
    expect(am.playVoiceBeat(0)).toBe(true);
    expect(am._pool.v1[0]._played).toBe(1);
    expect(am._pool[OVERLAY_KEY][0]._played).toBe(1);
    global.__audioAutoCanplay = true;
  });
  it('stop then late canplay does not sound', () => {
    global.__audioAutoCanplay = false;
    const am = getAudioManager();
    am.destroy();
    const p = makePage();
    p.data.soundMode = 'uniform';
    p._updateBeats();
    p._start();
    const ctx = am._pool.uniform[0];
    p._stop();
    ctx.__fireCanplay();
    expect(ctx._played).toBe(0);
    expect(am.play('uniform')).toBe(false);
    am.destroy();
    global.__audioAutoCanplay = true;
    am.init();
  });
  it('switching language invalidates old voice gen so old canplay cannot replay', () => {
    global.__audioAutoCanplay = false;
    const am = new AudioManager();
    am.init();
    am.ensureVoice('zh');
    const old = am._pool.v1[0];
    am.ensureVoice('en');
    expect(am._pool.v1[0]).not.toBe(old);
    old.__fireCanplay();
    am._pool.v1[0].__fireCanplay();
    am._pool[OVERLAY_KEY][0].__fireCanplay();
    am.allowPlay();
    expect(am.playVoiceBeat(0)).toBe(true);
    expect(am._pool.v1[0]._played).toBe(1);
    expect(old._played).toBe(0);
    expect(am._pool.v1[0].src).toContain('/en/');
    global.__audioAutoCanplay = true;
  });
  it('audio status note is visible and clears when ready', () => {
    const p = makePage();
    p._onAudioStatus('loading');
    expect(p.data.audioNote).toBe(p.data.i18n.audio_loading);
    p._onAudioStatus('ready');
    expect(p.data.audioNote).toBe('');
    p._onAudioStatus('error');
    expect(p.data.audioNote).toBe(p.data.i18n.audio_error);
  });
  it('failed uniform slots rebuild on ensurePlayable without onUnload', () => {
    global.__audioAutoCanplay = false;
    const am = new AudioManager();
    am.init();
    am._pool.uniform.forEach((c) => c.__fireError());
    expect(am.modeStatus('uniform', 0)).toBe('error');
    const old = am._pool.uniform[0];
    global.__audioAutoCanplay = true;
    am.ensurePlayable('uniform');
    expect(am._pool.uniform[0]).not.toBe(old);
    expect(old._dead).toBe(true);
    am.allowPlay();
    expect(am.play('uniform')).toBe(true);
    expect(am.modeStatus('uniform', 0)).toBe('ready');
  });
});

describe('B2-R02 current-mode loading is visible', () => {
  function startMode(sm) {
    getAudioManager().destroy();
    global.__audioAutoCanplay = false;
    const p = makePage();
    p.data.soundMode = sm;
    p.data.customBeats = '4';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p.onLoad();
    p._start();
    return p;
  }
  it('uniform cold start without canplay shows loading, beans move, no sound', () => {
    global.__audioAutoCanplay = false;
    const p = startMode('uniform');
    const am = getAudioManager();
    expect(p.data.audioNote).toBe(p.data.i18n.audio_loading);
    expect(p.data.beats.some((b) => b.active)).toBe(true);
    expect(am._pool.uniform.every((c) => c._played === 0)).toBe(true);
    global.__audioAutoCanplay = true;
  });
  it('traditional and voice also show loading when needed ctx not ready', () => {
    global.__audioAutoCanplay = false;
    const t = startMode('traditional');
    expect(t.data.audioNote).toBe(t.data.i18n.audio_loading);
    t._stop();
    const v = startMode('voice');
    expect(v.data.audioNote).toBe(v.data.i18n.audio_loading);
    global.__audioAutoCanplay = true;
  });
  it('ready needed ctx plays on a new beat and clears note; unused overlay error does not', () => {
    global.__audioAutoCanplay = false;
    const p = startMode('uniform');
    const am = getAudioManager();
    am._pool[OVERLAY_KEY].forEach((c) => c.__fireError());
    expect(p.data.audioNote).toBe(p.data.i18n.audio_loading);
    am._pool.uniform[0].__fireCanplay();
    const pending = p._timer;
    global.__setMockNow(500);
    global.__runTimeout(pending);
    expect(p.data.audioNote).toBe('');
    expect(am._pool.uniform.some((c) => c._played > 0)).toBe(true);
    global.__audioAutoCanplay = true;
  });
  it('never-ready without error stays loading, not error, and does not queue old beats', () => {
    global.__audioAutoCanplay = false;
    const p = startMode('uniform');
    const am = getAudioManager();
    const pending = p._timer;
    global.__setMockNow(500);
    global.__runTimeout(pending);
    expect(p.data.audioNote).toBe(p.data.i18n.audio_loading);
    expect(am.modeStatus('uniform', 0)).toBe('loading');
    expect(am._pool.uniform.every((c) => c._played === 0)).toBe(true);
    expect(p._currentBeat).toBe(2);
    global.__audioAutoCanplay = true;
  });
  it('all uniform slots error shows error; overlay ready does not clear it', () => {
    global.__audioAutoCanplay = false;
    const p = startMode('uniform');
    const am = getAudioManager();
    am._pool[OVERLAY_KEY][0].__fireCanplay();
    am._pool.uniform.forEach((c) => c.__fireError());
    const pending = p._timer;
    global.__setMockNow(500);
    global.__runTimeout(pending);
    expect(p.data.audioNote).toBe(p.data.i18n.audio_error);
    expect(am.modeStatus('uniform', 0)).toBe('error');
    global.__audioAutoCanplay = true;
  });
});

describe('B2-R03 destroyed ctx cannot pollute a new pool', () => {
  it('old language ctx late error does not mark new voice error', () => {
    global.__audioAutoCanplay = false;
    const am = new AudioManager();
    am.init();
    am.ensureVoice('zh');
    const old = am._pool.v1[0];
    am.ensureVoice('en');
    old.__fireError();
    expect(old._dead).toBe(true);
    expect(am.modeStatus('voice', 0)).toBe('loading');
    am._pool.v1[0].__fireCanplay();
    am._pool[OVERLAY_KEY][0].__fireCanplay();
    expect(am.modeStatus('voice', 0)).toBe('ready');
    global.__audioAutoCanplay = true;
  });
  it('stop then play rebuilds failed slots and can sound', () => {
    global.__audioAutoCanplay = false;
    const am = getAudioManager();
    am.destroy();
    const p = makePage();
    p.data.soundMode = 'uniform';
    p._updateBeats();
    p._start();
    am._pool.uniform.forEach((c) => c.__fireError());
    p._tick();
    expect(p.data.audioNote).toBe(p.data.i18n.audio_error);
    p._stop();
    global.__audioAutoCanplay = true;
    p._start();
    expect(am.play('uniform')).toBe(true);
    expect(p.data.audioNote).toBe('');
  });
  it('voice v5 failed slots recover on real page _start without rebuilding healthy keys', () => {
    getAudioManager().destroy();
    global.__audioAutoCanplay = false;
    const p = makePage();
    p.data.soundMode = 'voice';
    p.data.lang = 'zh';
    p.data.customBeats = '8';
    p.data.bc = 8;
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    const am = getAudioManager();
    am._pool[OVERLAY_KEY][0].__fireCanplay();
    am._pool.v1[0].__fireCanplay();
    const v1Before = am._pool.v1[0];
    const overlayBefore = am._pool[OVERLAY_KEY][0];
    const oldV5 = am._pool.v5.slice();
    oldV5.forEach((c) => c.__fireError());
    expect(am.keyFailed('v5')).toBe(true);
    expect(am.keyReady('v1')).toBe(true);
    p._stop();
    p._start();
    expect(am._pool.v5[0]).not.toBe(oldV5[0]);
    expect(am._pool.v1[0]).toBe(v1Before);
    expect(am._pool[OVERLAY_KEY][0]).toBe(overlayBefore);
    expect(am.ctxCount()).toBe(44);
    oldV5[0].__fireCanplay();
    oldV5[0].__fireError();
    expect(oldV5[0]._dead).toBe(true);
    expect(am._pool.v5[0]._slotReady).toBe(false);
    am._pool.v5[0].__fireCanplay();
    p._currentBeat = 4;
    p._tick();
    expect(am._pool.v5.some((c) => c._played > 0)).toBe(true);
    expect(am._pool[OVERLAY_KEY].some((c) => c._played > 0)).toBe(true);
    expect(p.data.audioNote).toBe('');
    global.__audioAutoCanplay = true;
  });
  it('voice v1 failed slots recover on real page _start same language', () => {
    getAudioManager().destroy();
    global.__audioAutoCanplay = false;
    const p = makePage();
    p.data.soundMode = 'voice';
    p.data.lang = 'zh';
    p._updateBeats();
    global.__setMockNow(0);
    global.__clearAllTimers();
    p._start();
    const am = getAudioManager();
    am._pool[OVERLAY_KEY][0].__fireCanplay();
    const oldV1 = am._pool.v1.slice();
    oldV1.forEach((c) => c.__fireError());
    p._stop();
    p._start();
    expect(am._pool.v1[0]).not.toBe(oldV1[0]);
    oldV1[0].__fireCanplay();
    expect(am.playVoiceBeat(0)).toBe(false);
    am._pool.v1[0].__fireCanplay();
    p._currentBeat = 0;
    p._tick();
    expect(am._pool.v1.some((c) => c._played > 0)).toBe(true);
    expect(am._pool[OVERLAY_KEY].some((c) => c._played > 0)).toBe(true);
    global.__audioAutoCanplay = true;
  });
  it('destroyed callback canplay does not ready a removed ctx', () => {
    global.__audioAutoCanplay = false;
    const am = new AudioManager();
    am.init();
    const ctx = am._pool.uniform[0];
    am._destroyPool('uniform');
    ctx.__fireCanplay();
    expect(ctx._dead).toBe(true);
    expect(am._pool.uniform).toBeUndefined();
    global.__audioAutoCanplay = true;
  });
});

describe('batch3 miniapp remaining', () => {
  it('onLoad prebuilds click pools but does not play', () => {
    getAudioManager().destroy();
    global.__audioAutoCanplay = true;
    const p = makePage();
    p.onLoad();
    const am = getAudioManager();
    expect(am._pool.uniform.length).toBe(3);
    expect(am.play('uniform')).toBe(false);
    expect(am._pool.uniform[0]._played).toBe(0);
  });
  it('stop clears stale audioNote', () => {
    const p = makePage();
    p.data.audioNote = p.data.i18n.audio_loading;
    p.data.running = true;
    p._stop();
    expect(p.data.audioNote).toBe('');
  });
  it('illegal volume events are ignored', () => {
    const p = makePage();
    p.data.vol = 85;
    p.onVolChanging({ detail: { value: '80abc' } });
    p.onVolChange({ detail: { value: '' } });
    p.onVolChange({ detail: { value: 'NaN' } });
    expect(p.data.vol).toBe(85);
    expect(clampVolInput('80abc')).toBeNull();
    p.onVolChange({ detail: { value: '250' } });
    expect(p.data.vol).toBe(100);
  });
  it('switching to voice while running rebuilds a failed overlay only', () => {
    getAudioManager().destroy();
    global.__audioAutoCanplay = false;
    const p = makePage();
    p.data.soundMode = 'uniform';
    p._updateBeats();
    p._start();
    const am = getAudioManager();
    const oldOverlay = am._pool[OVERLAY_KEY].slice();
    const oldUniform = am._pool.uniform[0];
    oldOverlay.forEach((c) => c.__fireError());
    p.onModeChange({ currentTarget: { dataset: { mode: 'voice' } } });
    expect(am._pool[OVERLAY_KEY][0]).not.toBe(oldOverlay[0]);
    expect(am._pool.uniform[0]).toBe(oldUniform);
    expect(am.ctxCount()).toBe(44);
    global.__audioAutoCanplay = true;
  });
});

describe('BPM drag analytics', () => {
  it('records one committed drag from its original BPM and keeps the status text current', () => {
    const page = makePage();
    const events = [];
    const previous = wx.uma;
    wx.uma = { trackEvent(name, data) { events.push({ name, data }); } };
    try {
      page.onBpmChanging({ detail: { value: 130 } });
      page.onBpmChanging({ detail: { value: 140 } });
      expect(page.data.nowPlayingText).toContain('140');
      expect(events).toHaveLength(0);
      page.onBpmChange({ detail: { value: 140 } });
      expect(events).toEqual([{ name: 'bpm_change', data: { from: 120, to: 140 } }]);
      page.onBpmChange({ detail: { value: 140 } });
      expect(events).toHaveLength(1);
      page.onBpmChanging({ detail: { value: 150 } });
      page.onBpmChange({ detail: { value: 150 } });
      expect(events[1]).toEqual({ name: 'bpm_change', data: { from: 140, to: 150 } });
    } finally { wx.uma = previous; }
  });
});
