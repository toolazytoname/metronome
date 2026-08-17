/**
 * Loads the shipped web engine (js/engine.js), not a copy.
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ENGINE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../js/engine.js'
);

function stubAudioContext() {
  function Gain() {
    this.gain = {
      value: 1,
      setTargetAtTime: function () {},
      setValueAtTime: function () {},
      exponentialRampToValueAtTime: function () {},
    };
  }
  Gain.prototype.connect = function () {};

  function Osc() {
    this.type = 'sine';
    this.frequency = {
      setValueAtTime: function () {},
      exponentialRampToValueAtTime: function () {},
    };
  }
  Osc.prototype.connect = function () {};
  Osc.prototype.start = function () {};
  Osc.prototype.stop = function () {};

  function Src() {
    this.buffer = null;
  }
  Src.prototype.connect = function () {};
  Src.prototype.start = function () {};

  function Filter() {
    this.type = '';
    this.frequency = { value: 0 };
  }
  Filter.prototype.connect = function () {};

  function AC() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
  }
  AC.prototype.resume = function () { return Promise.resolve(); };
  AC.prototype.createGain = function () { return new Gain(); };
  AC.prototype.createOscillator = function () { return new Osc(); };
  AC.prototype.createBufferSource = function () { return new Src(); };
  AC.prototype.createBiquadFilter = function () { return new Filter(); };
  AC.prototype.createBuffer = function (ch, len) {
    return { getChannelData: function () { return new Float32Array(len); } };
  };
  AC.prototype.decodeAudioData = function () { return Promise.resolve(null); };
  return AC;
}

function loadShippedEngine(opts) {
  opts = opts || {};
  const gate = opts.gate || null;
  const stats = { lookaheadArms: 0 };
  const code = fs.readFileSync(ENGINE_PATH, 'utf8');
  const sandbox = {
    console: console,
    setTimeout: function (fn, ms) {
      if (ms === 25) stats.lookaheadArms += 1;
      return setTimeout(fn, ms);
    },
    clearTimeout: clearTimeout,
    Promise: Promise,
    Math: Math,
    Date: Date,
    String: String,
    Number: Number,
    Object: Object,
    Array: Array,
    Float32Array: Float32Array,
    Error: Error,
    fetch: function () {
      const fail = function () { return Promise.reject(new Error('offline-stub')); };
      return gate ? gate.then(fail, fail) : fail();
    },
  };
  sandbox.window = sandbox;
  sandbox.AudioContext = stubAudioContext();
  sandbox.webkitAudioContext = sandbox.AudioContext;
  vm.runInNewContext(code, sandbox);
  if (typeof sandbox.MetronomeEngine !== 'function') {
    throw new Error('shipped js/engine.js did not export MetronomeEngine');
  }
  return { Engine: sandbox.MetronomeEngine, stats: stats };
}

describe('shipped js/engine.js', () => {
  let MetronomeEngine;

  beforeEach(() => {
    MetronomeEngine = loadShippedEngine().Engine;
  });

  it('is the real engine file (lookahead, no setInterval / speechSynthesis)', () => {
    const src = fs.readFileSync(ENGINE_PATH, 'utf8');
    expect(src).toContain('MetronomeEngine');
    expect(src).toContain('_scheduler');
    expect(src).toContain('SCHEDULE_AHEAD');
    expect(src).not.toMatch(/setInterval/);
    expect(src).not.toMatch(/speechSynthesis/);
  });

  it('clamps BPM to 40–208', () => {
    const e = new MetronomeEngine();
    e.setBpm(10);
    expect(e.bpm).toBe(40);
    e.setBpm(999);
    expect(e.bpm).toBe(208);
    e.setBpm(120);
    expect(e.bpm).toBe(120);
  });

  it('clamps beats to 1–16', () => {
    const e = new MetronomeEngine();
    e.setBeats(0);
    expect(e.bc).toBe(1);
    e.setBeats(99);
    expect(e.bc).toBe(16);
    e.setBeats(7);
    expect(e.bc).toBe(7);
  });

  it('clamps volume to 0.05–1', () => {
    const e = new MetronomeEngine();
    e.setVolume(0);
    expect(e.vol).toBe(0.05);
    e.setVolume(2);
    expect(e.vol).toBe(1);
    e.setVolume(0.4);
    expect(e.vol).toBe(0.4);
  });

  it('accepts only traditional / uniform / voice', () => {
    const e = new MetronomeEngine();
    e.setMode('voice');
    expect(e.sm).toBe('voice');
    e.setMode('laser');
    expect(e.sm).toBe('voice');
    e.setMode('traditional');
    expect(e.sm).toBe('traditional');
  });

  it('start then stop toggles playing; setBpm while running does not fire extra onBeat', async () => {
    const beats = [];
    const e = new MetronomeEngine({
      onBeat: function (b) { beats.push(b); },
    });
    await e.start();
    expect(e.playing).toBe(true);
    const n = beats.length;
    e.setBpm(180);
    expect(e.bpm).toBe(180);
    // setBpm only changes the next interval — it must not schedule another tick
    expect(beats.length).toBe(n);
    e.stop();
    expect(e.playing).toBe(false);
  });

  it('sets playing immediately and ignores a second start while init is in-flight', async () => {
    let release;
    const gate = new Promise(function (resolve) { release = resolve; });
    const loaded = loadShippedEngine({ gate: gate });
    const e = new loaded.Engine();
    const first = e.start();
    expect(e.playing).toBe(true);
    const second = e.start();
    expect(second).toBe(first);
    expect(loaded.stats.lookaheadArms).toBe(0);
    release();
    await first;
    expect(e.playing).toBe(true);
    // One lookahead loop only — a doubled clock would arm this twice.
    expect(loaded.stats.lookaheadArms).toBe(1);
    e.stop();
  });

  it('stop during in-flight init does not arm the scheduler', async () => {
    let release;
    const gate = new Promise(function (resolve) { release = resolve; });
    const loaded = loadShippedEngine({ gate: gate });
    const e = new loaded.Engine();
    const p = e.start();
    expect(e.playing).toBe(true);
    e.stop();
    expect(e.playing).toBe(false);
    release();
    await p;
    expect(loaded.stats.lookaheadArms).toBe(0);
  });
});

describe('shipped play() glue cannot double-arm', () => {
  const pages = [
    path.resolve(path.dirname(ENGINE_PATH), '../index.html'),
    path.resolve(path.dirname(ENGINE_PATH), '../en/index.html'),
  ];
  pages.forEach((file) => {
    it(`${path.basename(path.dirname(file)) === 'en' ? 'en/' : ''}index.html flips s.r before engine.start`, () => {
      const src = fs.readFileSync(file, 'utf8');
      const m = src.match(/function start\(\)\{[\s\S]*?\nfunction stop/);
      expect(m).toBeTruthy();
      const body = m[0];
      expect(body.indexOf('s.r=true')).toBeGreaterThan(-1);
      expect(body.indexOf('s.r=true')).toBeLessThan(body.indexOf('engine.start('));
      expect(body.indexOf('classList.add("running")')).toBeLessThan(body.indexOf('engine.start('));
    });
  });
});
