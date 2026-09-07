// Mock WeChat miniprogram globals
global.__audioAutoCanplay = true;
global.wx = {
  createInnerAudioContext: () => {
    let canplayFn = null;
    let errorFn = null;
    const ctx = {
      src: '',
      volume: 0.8,
      autoplay: false,
      loop: false,
      _played: 0,
      onError(fn) { errorFn = fn; ctx._errorFn = fn; },
      onCanplay(fn) {
        canplayFn = fn;
        ctx._canplayFn = fn;
        if (fn && global.__audioAutoCanplay !== false) fn();
      },
      play() { ctx._played += 1; },
      seek() {},
      stop() {},
      destroy() {},
      __fireCanplay() { if (canplayFn) canplayFn(); },
      __fireError() { if (errorFn) errorFn(); },
    };
    return ctx;
  },
  getStorageSync: () => null,
  setStorageSync: () => {},
};

// Mock Date.now for deterministic tick tests
let _mockNow = 0;
global.Date.now = () => _mockNow;
global.__setMockNow = (t) => { _mockNow = t; };

// Mock setInterval/setTimeout for timer control
const _timers = { interval: new Map(), timeout: new Map() };
let _timerId = 0;

global.setInterval = (fn, ms) => {
  const id = ++_timerId;
  _timers.interval.set(id, { fn, ms });
  return id;
};

global.clearInterval = (id) => {
  _timers.interval.delete(id);
};

global.setTimeout = (fn, ms) => {
  const id = ++_timerId;
  _timers.timeout.set(id, { fn, ms });
  return id;
};

global.clearTimeout = (id) => {
  _timers.timeout.delete(id);
};

global.__runInterval = (id) => {
  const t = _timers.interval.get(id);
  if (t) t.fn();
};

global.__runTimeout = (id) => {
  const t = _timers.timeout.get(id);
  if (t) t.fn();
  _timers.timeout.delete(id);
};

global.__clearAllTimers = () => {
  _timers.interval.clear();
  _timers.timeout.clear();
};

global.__timeoutIds = () => Array.from(_timers.timeout.keys());

global.__peekTimeout = (id) => {
  const t = _timers.timeout.get(id);
  return t ? t.fn : null;
};

global.__timeoutEntries = () => Array.from(_timers.timeout.entries()).map(([id, t]) => ({ id, ms: t.ms }));
