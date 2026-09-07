#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');

function fakeCtx(currentTime) {
  const sources = [];
  const ctx = {
    currentTime: currentTime == null ? 0 : currentTime,
    state: 'running',
    sampleRate: 44100,
    destination: {},
    resume() { return Promise.resolve(); },
    createGain() {
      return {
        gain: {
          value: 1,
          setTargetAtTime() {},
          setValueAtTime() {},
          exponentialRampToValueAtTime() {}
        },
        connect() {}
      };
    },
    createOscillator() {
      const o = {
        type: '',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { o.started = true; },
        stop() { o.stopped = true; },
        onended: null
      };
      sources.push(o);
      return o;
    },
    createBuffer() {
      return { getChannelData() { return new Float32Array(8); } };
    },
    createBufferSource() {
      const n = {
        buffer: null,
        connect() {},
        start() { n.started = true; },
        stop() { n.stopped = true; },
        onended: null
      };
      sources.push(n);
      return n;
    },
    createBiquadFilter() {
      return { type: '', frequency: { value: 0 }, connect() {} };
    },
    decodeAudioData(ab, ok) {
      const buf = { length: 1 };
      if (ok) ok(buf);
      return Promise.resolve(buf);
    },
    _sources: sources
  };
  return ctx;
}

function loadEngine(extra) {
  const sandbox = Object.assign({
    console,
    setTimeout,
    clearTimeout,
    Promise,
    AbortController,
    fetch() { return Promise.reject(new Error('offline')); },
    AudioContext: function () { return fakeCtx(0); },
    webkitAudioContext: undefined
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log('  ok  ' + name); })
    .catch((err) => {
      console.error('  FAIL  ' + name);
      throw err;
    });
}

async function main() {
  console.log('Web engine');

  await check('5s scheduler gap at 120 BPM does not burst expired beats', () => {
    const box = loadEngine({ setTimeout() { return 1; }, clearTimeout() {} });
    const eng = new box.MetronomeEngine();
    const scheduled = [];
    eng.ctx = fakeCtx(5);
    eng.playing = true;
    eng.nextNoteTime = 0;
    eng.bpm = 120;
    eng.bc = 4;
    eng._scheduleBeat = function (beat, time) { scheduled.push({ beat, time }); };
    eng._scheduler();
    assert.ok(scheduled.length <= 2, 'expected at most a lookahead window, got ' + scheduled.length);
    assert.ok(scheduled.length >= 1, 'should resume with the current beat');
    assert.ok(scheduled[0].time >= 5 - 1e-9, 'must not schedule at t=0 after a 5s stall');
  });

  await check('changing BPM only changes the next interval', () => {
    const box = loadEngine({ setTimeout() { return 1; }, clearTimeout() {} });
    const eng = new box.MetronomeEngine();
    const scheduled = [];
    eng.ctx = fakeCtx(0);
    eng.playing = true;
    eng.nextNoteTime = 0.02;
    eng.bpm = 120;
    eng.bc = 4;
    eng._scheduleBeat = function (beat, time) { scheduled.push({ beat, time, bpm: eng.bpm }); };
    eng._scheduler();
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].time, 0.02);
    assert.equal(eng.nextNoteTime, 0.52);
    eng.setBpm(60);
    assert.equal(scheduled.length, 1, 'BPM change must not insert a beat');
    assert.equal(eng.nextNoteTime, 0.52, 'already due next beat keeps its deadline');
    eng.ctx.currentTime = 0.5;
    eng._scheduler();
    assert.equal(scheduled.length, 2);
    assert.equal(scheduled[1].time, 0.52);
    assert.equal(eng.nextNoteTime, 1.52, 'subsequent interval is now one second');
    eng.stop();
  });

  await check('hanging sample fetch times out and still becomes ready', async () => {
    const box = loadEngine({
      fetch() { return new Promise(() => {}); }
    });
    box.MetronomeEngine.SAMPLE_TIMEOUT_MS = 30;
    const eng = new box.MetronomeEngine();
    eng.ctx = fakeCtx(0);
    eng.master = eng.ctx.createGain();
    const t0 = Date.now();
    await eng._ensureSamples();
    const dt = Date.now() - t0;
    assert.equal(eng.ready, true);
    assert.ok(dt < 2000, 'timeout should be bounded, took ' + dt + 'ms');
  });

  await check('stop() stops already-scheduled sources', () => {
    const box = loadEngine();
    const eng = new box.MetronomeEngine();
    eng.ctx = fakeCtx(0);
    eng.master = eng.ctx.createGain();
    eng.playing = true;
    eng._synthClick('uniform', 0.2, 1);
    assert.ok(eng._liveSources.length >= 1);
    eng.stop();
    assert.equal(eng._liveSources.length, 0);
    assert.ok(eng.ctx._sources.every((s) => s.stopped), 'all scheduled sources must stop');
  });

  await check('start then stop before init resolves does not arm the scheduler', async () => {
    const box = loadEngine({
      fetch() { return Promise.resolve({ ok: false }); }
    });
    const eng = new box.MetronomeEngine();
    let scheduled = 0;
    eng._scheduler = function () { scheduled += 1; };
    const p = eng.start();
    eng.stop();
    await p.catch(() => {});
    await Promise.resolve();
    assert.equal(eng.playing, false);
    assert.equal(scheduled, 0, 'stale start must not run the scheduler');
  });

  await check('synchronous AudioContext construction failure rejects and allows retry', async () => {
    const box = loadEngine({ AudioContext: function () { throw new Error('constructor failure'); } });
    const eng = new box.MetronomeEngine();
    await assert.rejects(eng.start(), /constructor failure/);
    assert.equal(eng.playing, false);
    assert.equal(eng._starting, false);
    box.AudioContext = function () { return fakeCtx(0); };
    await eng.start();
    assert.equal(eng.playing, true);
    eng.stop();
  });

  console.log('All engine checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
