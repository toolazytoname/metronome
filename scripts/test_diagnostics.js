#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('js/diagnostics.js', 'utf8');
function boot(storage, blocked = false) {
  const listeners = {}, els = {};
  const box = { Date, Number, JSON, Object, Array, Promise,
    localStorage: { getItem() { if (blocked) throw Error(); return storage.value; }, setItem(_, v) { if (blocked) throw Error(); storage.value = v; } },
    navigator: { userAgent: 'Mozilla/5.0 secret Chrome/149.7.1', onLine: true },
    document: { documentElement: { lang: 'zh' }, visibilityState: 'visible', addEventListener() {},
      getElementById(id) { return els[id] || (els[id] = { addEventListener() {}, focus() {}, select() {} }); } },
    addEventListener(type, cb) { listeners[type] = cb; } };
  box.window = box; vm.runInNewContext(src, box);
  return { api: box.MetronomeDiagnostics, els, box, listeners };
}
const storage = { value: JSON.stringify([{ at: Date.now(), code: 'paused', version: '2026.10.02.2', state: { bpm: 120, url: 'SECRET', audio: 'SECRET', playing: 'SECRET' } },
  { at: Date.now() - 86400001, code: 'paused', version: '2026.10.02.2' }]) };
let p = boot(storage);
p.api.attach({ snapshot: () => ({ bpm: 140, mode: 'voice', token: 'SECRET', audio: 'running', loading: false }) });
for (let i = 0; i < 100; i++) p.api.record('play_requested');
p.api.record('SECRET');
let r = JSON.parse(p.api.report());
assert.equal(r.events.length, 80); assert.equal(r.browser, 'Chrome/149');
assert.equal(r.state.bpm, 140); assert.ok(!p.api.report().includes('SECRET'));
p.listeners.error({ message: 'SECRET', filename: 'SECRET', error: { stack: 'SECRET' } });
p.listeners.unhandledrejection({ reason: 'SECRET' });
assert.ok(!p.api.report().includes('SECRET'));
p.els['diagnostic-copy'].onclick(); assert.ok(p.els['diagnostic-status'].textContent.includes('手动复制'));
p.els['diagnostic-clear'].onclick(); assert.equal(JSON.parse(storage.value).length, 0);
p = boot(storage, true); p.api.record('play_failed'); assert.equal(JSON.parse(p.api.report()).events.length, 2);
p.listeners.load(); assert.equal(p.els.diagnostics.open, true);
assert.equal(JSON.parse(p.api.report()).events.at(-1).code, 'boot_failed');
p = boot({ value: '{broken' }); assert.equal(JSON.parse(p.api.report()).events.length, 1);
console.log('Diagnostics: bounded storage, retention, privacy allowlist, denied storage, clipboard fallback, clear, boot failure passed');
