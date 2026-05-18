// Mock WeChat miniprogram globals
global.wx = {
  createInnerAudioContext: () => ({
    src: '',
    volume: 0.8,
    autoplay: false,
    loop: false,
    onError() {},
    play() {},
    seek() {},
    stop() {},
  }),
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
