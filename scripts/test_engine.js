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

  await check('invalid engine BPM inputs never poison the clock', () => {
    const eng = new (loadEngine().MetronomeEngine)();
    for (const value of [NaN, Infinity, null, undefined, '', ' ', '120x', '1e2', '0x78', 120.5, true, [], {}]) {
      eng.setBpm(value);
      assert.equal(eng.bpm, 120, String(value));
    }
    eng.setBpm('208'); assert.equal(eng.bpm, 208);
    eng.setBpm(999); assert.equal(eng.bpm, 208);
  });

  await check('reload ignores old sample decode and readiness completions', async () => {
    const callbacks = [];
    const box = loadEngine({ fetch() { return Promise.resolve({ ok: true, arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); } }); } });
    const eng = new box.MetronomeEngine();
    eng.ctx = fakeCtx(0);
    eng.ctx.decodeAudioData = (_, ok) => { callbacks.push(ok); };
    const old = eng._ensureSamples();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(callbacks.length, 19);
    eng.reloadSamples();
    const current = eng._ensureSamples();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    callbacks.slice(0, 19).forEach(ok => ok({ generation: 'old' }));
    await old;
    assert.equal(eng.ready, false, 'old load must not publish ready');
    assert.equal(Object.keys(eng.buffers).length, 0, 'old decode must not install');
    callbacks.slice(19).forEach(ok => ok({ generation: 'current' }));
    await current;
    assert.equal(eng.ready, true);
    assert.equal(eng.buffers.uniform.generation, 'current');
  });

  await check('a hanging AudioContext resume times out and remains retryable', async () => {
    const ctx = fakeCtx(0); ctx.state = 'suspended';
    ctx.resume = () => new Promise(() => {});
    const box = loadEngine({ AudioContext: function () { return ctx; } });
    box.MetronomeEngine.RESUME_TIMEOUT_MS = 20;
    const eng = new box.MetronomeEngine();
    await assert.rejects(eng.start(), /timeout/);
    assert.equal(eng.playing, false);
    ctx.resume = () => { ctx.state = 'running'; return Promise.resolve(); };
    await eng.start();
    assert.equal(eng.playing, true);
    eng.stop();
  });


  await check('scheduler failure stops all sources and reports a fixed error', async () => {
    const errors = [];
    const eng = new (loadEngine().MetronomeEngine)({ onError: code => errors.push(code) });
    await eng.start();
    eng._scheduleBeat = () => { throw new Error('device gone'); };
    clearTimeout(eng.timer); eng.nextNoteTime = eng.ctx.currentTime;
    eng._scheduler();
    assert.equal(eng.playing, false); assert.equal(eng.timer, null);
    assert.equal(eng._liveSources.length, 0); assert.deepEqual(errors, ['scheduler_failed']);
  });
  await check('state interruption and stalled audio cannot falsely remain playing', async () => {
    const errors = [];
    const eng = new (loadEngine().MetronomeEngine)({ onError: code => errors.push(code) });
    await eng.start(); eng.ctx.state = 'suspended'; eng.ctx.onstatechange();
    assert.equal(eng.playing, false); assert.deepEqual(errors, ['audio_interrupted']);
    eng.ctx.state = 'running'; await eng.start(); clearTimeout(eng.timer);
    eng._lastProgressAt = Date.now() - 4000; eng._scheduler();
    assert.equal(eng.playing, false); assert.equal(errors[1], 'audio_stalled');
  });
  await check('reset and closed-context retry create a fresh single playback', async () => {
    const eng = new (loadEngine().MetronomeEngine)();
    await eng.start(); const old = eng.ctx; old.state = 'closed';
    await eng.start(); assert.notEqual(eng.ctx, old); assert.equal(eng.playing, true);
    const current = eng.ctx; eng.reset();
    assert.equal(eng.ctx, null); assert.equal(eng.playing, false); assert.equal(eng.ready, false);
    await eng.start(); assert.notEqual(eng.ctx, current); eng.stop();
  });
  await check('reset invalidates a pending resume even when a newer run starts', async () => {
    let resume;
    const old = fakeCtx(0); old.state = 'suspended';
    old.resume = () => new Promise(resolve => { resume = resolve; });
    let n = 0;
    const eng = new (loadEngine({ AudioContext: function () { return n++ ? fakeCtx(0) : old; } }).MetronomeEngine)();
    const pending = eng.start(); const rejection = assert.rejects(pending, /audio_cancelled/);
    eng.reset(); await eng.start(); old.state = 'running'; resume(); await rejection;
    assert.equal(eng.playing, true); eng.stop();
  });
  await check('visuals follow audio time, not independently delayed beat timers', () => {
    let timers = 0;
    const drawn = [];
    const eng = new (loadEngine({ setTimeout() { timers++; return timers; }, clearTimeout() {} }).MetronomeEngine)({ onBeat: beat => drawn.push(beat) });
    eng.ctx = fakeCtx(0); eng.playing = true; eng._playBuffer = () => {};
    eng._scheduleBeat(0, 0.02); eng._scheduleBeat(1, 0.62);
    assert.equal(timers, 0, 'scheduling audio must not spawn per-beat visual timers');
    eng._renderVisuals(0.01); assert.deepEqual(drawn, []);
    eng._renderVisuals(0.02); assert.deepEqual(drawn, [0]);
    eng._renderVisuals(0.4); assert.deepEqual(drawn, [0]);
    eng._renderVisuals(0.62); assert.deepEqual(drawn, [0, 1]);
    assert.equal(eng.renderedBeat, 1); assert.equal(eng.visualUpdates, 2);
    eng.stop(); eng._renderVisuals(1); assert.equal(eng._visualQueue.length, 0);
    assert.equal(eng.renderedBeat, -1);
  });
  await check('delayed visuals draw only latest due beat, preserve future beat and clear on stop', () => {
    const drawn = [];
    const eng = new (loadEngine().MetronomeEngine)({ onBeat: beat => drawn.push(beat) });
    eng.ctx = fakeCtx(0); eng.playing = true; eng._playBuffer = () => {};
    [0, 1, 2, 3].forEach(i => eng._scheduleBeat(i, i * 0.6));
    eng._renderVisuals(1.4); assert.deepEqual(drawn, [2]); assert.equal(eng._visualQueue.length, 1);
    eng.stop(); eng.playing = true; eng._renderVisuals(2);
    assert.deepEqual(drawn, [2], 'previous playback must not light a stale beat');
    for (let i = 0; i < 100; i++) eng._scheduleBeat(i % 4, i);
    assert.ok(eng._visualQueue.length <= 32); eng.stop();
  });
  await check('normal scheduler advances visible beats at 40 / 100 / 208 BPM', () => {
    for (const bpm of [40, 100, 208]) {
      const drawn = [];
      const eng = new (loadEngine({ setTimeout() { return 1; }, clearTimeout() {} }).MetronomeEngine)({ onBeat: beat => drawn.push(beat) });
      eng.ctx = fakeCtx(0); eng.playing = true; eng.bpm = bpm; eng.nextNoteTime = 0.02;
      eng._lastAudioTime = 0; eng._lastProgressAt = Date.now(); eng._playBuffer = () => {};
      for (let i = 0; i <= 240; i++) { eng.ctx.currentTime = i * 0.025; eng._scheduler(); }
      assert.ok(drawn.length >= Math.floor(6 * bpm / 60));
      drawn.forEach((beat, i) => assert.equal(beat, i % 4)); eng.stop();
    }
  });
  await check('failed visual callback cannot leave sound silently running', () => {
    for (const onBeat of [() => { throw Error('private detail'); }, () => false]) {
      const errors = [], events = [];
      const eng = new (loadEngine().MetronomeEngine)({ onBeat, onError: code => errors.push(code), onDiagnostic: code => events.push(code) });
      eng.ctx = fakeCtx(1); eng.master = eng.ctx.createGain(); eng.playing = true;
      eng._scheduleBeat(0, 1); assert.ok(eng._liveSources.length);
      assert.equal(eng._renderVisuals(1), false);
      assert.equal(eng.playing, false); assert.equal(eng._liveSources.length, 0);
      assert.equal(eng._visualQueue.length, 0);
      assert.deepEqual(errors, ['visual_failed']); assert.deepEqual(events, ['visual_failed']);
    }
  });
  console.log('All engine checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
