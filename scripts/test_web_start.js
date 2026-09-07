#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const prefs = require('../js/prefs.js');
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function element() {
  const classes = new Set();
  return {
    innerHTML: '', textContent: '', attrs: {}, children: [],
    classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); } },
    appendChild(c) { this.children.push(c); },
    setAttribute(k, v) { this.attrs[k] = v; }
  };
}
function loadPage(rel) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const a = html.indexOf('function hideAudioError(){');
  const b = html.indexOf('document.addEventListener("visibilitychange"', a);
  assert.ok(a >= 0 && b > a);
  const els = {}, starts = [], locks = [];
  let reloads = 0;
  const box = {
    s: { r: false, bpm: 120, bc: 4, bu: 4, sm: 'uniform', vol: 85 },
    _wake: null, _wakeGen: 0, _wakePending: null, _playGen: 0,
    engine: {
      setBpm() {}, setBeats() {}, setMode() {}, setVolume() {}, stop() {},
      reloadSamples() { reloads++; },
      start() { const p = deferred(); starts.push(p); return p.promise; }
    },
    document: {
      getElementById(id) { return els[id] || (els[id] = element()); },
      querySelectorAll() { return []; }, createElement: element,
      createTextNode(text) { return { textContent: text }; }
    },
    navigator: { wakeLock: { request() { const p = deferred(); locks.push(p); return p.promise; } } },
    MetronomePrefs: prefs, refreshNowPlaying() {}, log() {}
  };
  vm.createContext(box);
  vm.runInContext(html.slice(a, b), box);
  return { box, starts, locks, els, reloads: () => reloads };
}
function lock() {
  return { releases: 0, listeners: [], release() { this.releases++; return Promise.resolve(); },
    addEventListener(_, f) { this.listeners.push(f); }, ended() { this.listeners.forEach(f => f()); } };
}
async function runPage(rel) {
  let p = loadPage(rel), b = p.box;
  b.start(); b.stop(); p.starts[0].resolve(); await flush();
  assert.equal(b.s.r, false); assert.equal(p.locks.length, 0);

  for (const fail of [true, false]) {
    p = loadPage(rel); b = p.box;
    b.start(); b.stop(); b.start();
    if (fail) p.starts[0].reject(new Error('stale')); else p.starts[0].resolve();
    await flush();
    assert.equal(b.s.r, true, 'old start must not overwrite newer run');
    assert.equal(p.locks.length, 0, 'old start must not request a new run lock');
    assert.equal(p.els['audio-error'].classList.contains('show'), false);
    p.starts[1].resolve(); await flush();
    assert.equal(p.locks.length, 1);
  }

  p = loadPage(rel); b = p.box;
  b.start(); p.starts[0].resolve(); await flush();
  b.requestWakeLock(); b.requestWakeLock(); await flush();
  assert.equal(p.locks.length, 1, 'deduplicate pending requests');
  b.stop(); const late = lock(); p.locks[0].resolve(late); await flush();
  assert.equal(late.releases, 1); assert.equal(b._wake, null);

  p = loadPage(rel); b = p.box;
  b.start(); p.starts[0].resolve(); await flush();
  const old = lock(); p.locks[0].resolve(old); await flush();
  b.requestWakeLock(); await flush(); assert.equal(p.locks.length, 1, 'deduplicate held lock');
  b.stop(); b.start(); p.starts[1].resolve(); await flush();
  const current = lock(); p.locks[1].resolve(current); await flush(); old.ended();
  assert.equal(b._wake, current, 'old release event must not clear newer lock');
  b.stop(); assert.equal(current.releases, 1);

  p = loadPage(rel); b = p.box;
  b.start(); p.starts[0].reject(new Error('startup failed')); await flush();
  assert.equal(b.s.r, false); assert.equal(p.els['audio-error'].classList.contains('show'), true);
  const retry = p.els['audio-error'].children.find(c => c.id === 'audio-retry');
  assert.ok(retry && typeof retry.onclick === 'function'); retry.onclick();
  assert.equal(p.reloads(), 1); assert.equal(p.starts.length, 2);
  assert.equal(p.els['play-btn'].attrs['aria-label'], rel === 'index.html' ? '暂停' : 'Pause');
  b.stop(); assert.equal(p.els['play-btn'].attrs['aria-label'], rel === 'index.html' ? '播放' : 'Play');
  console.log('  ok  ' + rel + ': stale success/error, late/duplicate locks, release ownership, visible retry, labels');
}
function runControls(rel) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const els = {}, events = [];
  const box = {
    s: { bpm: 120, bc: 4, bu: 4 }, _bpmCommit: 120,
    document: { getElementById(id) { return els[id] || (els[id] = element()); }, querySelectorAll() { return []; } },
    engine: { setBpm() {}, setBeats() {}, resetBeat() {} },
    MetronomePrefs: prefs, refreshNowPlaying() {}, updateBeats() {}, save() {},
    track(name, data) { events.push({ name, data }); }
  };
  vm.createContext(box);
  for (const [from, to] of [['function setBpm(', 'function setVol('], ['function setTS(', 'function updateBeats(']]) {
    vm.runInContext(html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from))), box);
  }
  for (const line of html.split('\n')) {
    if (line.startsWith('document.getElementById("bpm-slider").on')) vm.runInContext(line, box);
  }
  const slider = els['bpm-slider'];
  slider.oninput({ target: { value: '130' } });
  slider.oninput({ target: { value: '140' } });
  assert.equal(events.length, 0);
  slider.onchange({ target: { value: '140' } });
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [{ name: 'bpm_change', data: { from: 120, to: 140 } }]);
  box.setBpm(141); // keyboard step commits a new baseline
  slider.oninput({ target: { value: '150' } });
  slider.onchange({ target: { value: '150' } });
  assert.equal(events.at(-1).data.from, 141);
  box.setTS('3/4');
  assert.equal(els['custom-beats'].value, 3);
  assert.equal(els['custom-unit'].value, 4);
  box.setTS('99/99');
  assert.equal(box.s.bc, 16); assert.equal(box.s.bu, 16);
  assert.equal(els['custom-beats'].value, 16); assert.equal(els['custom-unit'].value, 16);
  console.log('  ok  ' + rel + ': BPM preview/commit analytics and normalized meter inputs');
}
(async () => {
  console.log('Web start / wake lock');
  const l = lock(); assert.equal(prefs.adoptScreenLock(l, false), null); assert.equal(l.releases, 1);
  await runPage('index.html'); await runPage('en/index.html');
  runControls('index.html'); runControls('en/index.html');
  console.log('All web start checks passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
