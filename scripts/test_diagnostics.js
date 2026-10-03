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
    location: { href: '' },
    document: { documentElement: { lang: 'zh' }, visibilityState: 'visible', addEventListener() {},
      getElementById(id) { return els[id] || (els[id] = { addEventListener() {}, focus() {}, select() {} }); } },
    addEventListener(type, cb) { listeners[type] = cb; } };
  box.window = box; vm.runInNewContext(src, box);
  return { api: box.MetronomeDiagnostics, els, box, listeners };
}
(async function () {
const storage = { value: JSON.stringify([{ at: Date.now(), code: 'paused', version: '2026.10.03.3', state: { bpm: 120, url: 'SECRET', audio: 'SECRET', playing: 'SECRET' } },
  { at: Date.now() - 86400001, code: 'paused', version: '2026.10.02.2' }]) };
let p = boot(storage);
p.api.attach({ snapshot: () => ({ bpm: 140, mode: 'voice', token: 'SECRET', audio: 'running', loading: false }) });
for (let i = 0; i < 100; i++) p.api.record('play_requested');
p.api.record('SECRET');
let r = JSON.parse(p.api.report());
assert.equal(r.events.length, 80); assert.equal(r.browser, 'Chrome/149');
assert.equal(r.state.bpm, 140); assert.ok(!p.api.report().includes('SECRET'));
p.api.attach({ snapshot: () => ({ scheduledBeat: 2, renderedBeat: 1, visualUpdates: 10, visualAgeMs: 650, visualNodes: 4, uiPlaying: true, domText: 'SECRET' }) });
p.api.record('visual_failed');
assert.deepEqual(JSON.parse(p.api.report()).state, { visibility: 'visible', uiPlaying: true, scheduledBeat: 2, renderedBeat: 1, visualUpdates: 10, visualAgeMs: 650, visualNodes: 4 });
assert.equal(JSON.parse(p.api.report()).events.at(-1).code, 'visual_failed');
p.api.attach({ snapshot: () => ({ scheduledBeat: 16, renderedBeat: -2, visualUpdates: Infinity, visualAgeMs: -1, visualNodes: 999, uiPlaying: 'SECRET' }) });
assert.deepEqual(JSON.parse(p.api.report()).state, { visibility: 'visible' });
p.listeners.error({ message: 'SECRET', filename: 'SECRET', error: { stack: 'SECRET' } });
p.listeners.unhandledrejection({ reason: 'SECRET' });
assert.ok(!p.api.report().includes('SECRET'));
p.els['diagnostic-copy'].onclick(); assert.ok(p.els['diagnostic-status'].textContent.includes('手动复制'));
p.els['diagnostic-clear'].onclick(); assert.equal(JSON.parse(storage.value).length, 0);
p = boot(storage, true); p.api.record('play_failed'); assert.equal(JSON.parse(p.api.report()).events.length, 2);
p.listeners.load(); assert.equal(p.els.diagnostics.open, true);
assert.equal(JSON.parse(p.api.report()).events.at(-1).code, 'boot_failed');
p = boot({ value: '{broken' }); assert.equal(JSON.parse(p.api.report()).events.length, 1);
// Explicit mail fallback targets the support mailbox and never calls a network API.
p = boot({ value: '[]' });
p.els['diagnostic-note'] = { value: '' };
p.els['diagnostic-note'].value = 'After switching tabs, Play stopped responding.';
p.els['diagnostic-send'].onclick();
assert.ok(p.box.location.href.startsWith('mailto:lazywc@gmail.com?'));
assert.ok(decodeURIComponent(p.box.location.href).includes('After switching tabs'));
assert.ok(decodeURIComponent(p.box.location.href).includes('2026.10.03.3'));
assert.equal(p.els['diagnostic-status'].textContent, '邮件草稿已打开，请确认内容后点击发送。');

// Mobile share path is explicit and user-controlled.
p = boot({ value: '[]' });
let shared;
p.box.navigator.share = payload => { shared = payload; return Promise.resolve(); };
p.els['diagnostic-note'] = { value: 'After switching tabs, Play stopped responding.' };
p.els['diagnostic-send'].onclick();
return new Promise(resolve => setImmediate(resolve)).then(() => {
assert.equal(shared.title, '[Bunny Metronome Web] Audio issue · 2026.10.03.3');
assert.ok(shared.text.includes('Bunny Metronome Web'));
assert.ok(shared.text.includes('After switching tabs'), 'user note must survive the sending size cap');
assert.ok(p.els['diagnostic-status'].textContent.includes('分享面板已打开'));

console.log('Diagnostics: bounded storage, retention, privacy allowlist, denied storage, clipboard fallback, clear, boot failure, mail and share reporting passed');
});

})().catch(error => { console.error(error); process.exitCode = 1; });
