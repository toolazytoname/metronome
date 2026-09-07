#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const prefsPath = path.join(root, 'js/prefs.js');
const code = fs.readFileSync(prefsPath, 'utf8');
const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const P = sandbox.module.exports || sandbox.MetronomePrefs;

function qs(obj) {
  return { get: (k) => (Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : null) };
}

function sameState(actual, expected) {
  assert.equal(actual.bpm, expected.bpm);
  assert.equal(actual.bc, expected.bc);
  assert.equal(actual.bu, expected.bu);
  assert.equal(actual.sm, expected.sm);
  assert.equal(actual.vol, expected.vol);
}

function check(name, fn) {
  fn();
  console.log('  ok  ' + name);
}

console.log('Web preference clamp');
check('illegal JSON storage falls back to defaults', () => {
  const s = P.resolveState(qs({}), '{not json');
  sameState(s, { bpm: 120, bc: 4, bu: 4, sm: 'uniform', vol: 85 });
});
check('null / array / non-object storage ignored', () => {
  assert.equal(P.resolveState(qs({}), 'null').bpm, 120);
  assert.equal(P.resolveState(qs({}), '[]').bc, 4);
  assert.equal(P.resolveState(qs({}), '"x"').sm, 'uniform');
});
check('stored out-of-range values clamp', () => {
  const s = P.resolveState(qs({}), JSON.stringify({ bpm: 999, bc: 0, bu: 99, sm: 'laser', vol: 3 }));
  assert.equal(s.bpm, 208);
  assert.equal(s.bc, 1);
  assert.equal(s.bu, 16);
  assert.equal(s.sm, 'uniform');
  assert.equal(s.vol, 10);
});
check('legal query wins; illegal bpm query ignored (not forced to 208)', () => {
  const legal = P.resolveState(qs({ bpm: '80', sig: '3/4', mode: 'voice' }), JSON.stringify({ bpm: 120, bc: 4, bu: 4, sm: 'uniform', vol: 85 }));
  sameState(legal, { bpm: 80, bc: 3, bu: 4, sm: 'voice', vol: 85 });
  const illegalBpm = P.resolveState(qs({ bpm: '999' }), JSON.stringify({ bpm: 140 }));
  assert.equal(illegalBpm.bpm, 120);
});
check('illegal sig query does not render 99 beats; storage not mixed in', () => {
  const s = P.resolveState(qs({ sig: '99/4' }), JSON.stringify({ bc: 7, bu: 8 }));
  assert.equal(s.bc, 4);
  assert.equal(s.bu, 4);
});
check('urlPreset true even for illegal query so save will not clobber', () => {
  assert.equal(P.urlPreset(qs({ bpm: '999' })), true);
  assert.equal(P.urlPreset(qs({})), false);
});
check('safeGet/safeSet swallow throws and null storage', () => {
  const boom = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(P.safeGet(boom, 'metronome'), null);
  assert.equal(P.safeSet(boom, 'metronome', '{}'), false);
  assert.equal(P.safeGet(null, 'metronome'), null);
  assert.equal(P.safeSet(null, 'metronome', '{}'), false);
});

check('getLocalStorage swallows window.localStorage SecurityError', () => {
  const denied = makeDeniedWindow();
  const api = loadPrefsIn(denied);
  assert.equal(api.getLocalStorage(), null);
  assert.equal(api.loadPref('metronome'), null);
  assert.equal(api.savePref('metronome', '{}'), false);
});

function makeDeniedWindow() {
  const win = {};
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage access denied', 'SecurityError');
    }
  });
  return win;
}

function loadPrefsIn(win) {
  const box = {
    window: win,
    globalThis: win,
    module: { exports: {} },
    console,
    DOMException
  };
  vm.runInNewContext(code, box);
  return box.module.exports || box.MetronomePrefs;
}

function stubEl() {
  return {
    textContent: '',
    value: '',
    className: '',
    onclick: null,
    oninput: null,
    onchange: null,
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
    dataset: {}
  };
}

function runPageInit(rel) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(html.includes('src="/js/prefs.js"'), rel + ' must load prefs.js');
  assert(!html.includes('speechSynthesis'), rel + ' no speechSynthesis');
  assert(!/\blocalStorage\b/.test(html), rel + ' must not mention localStorage (including as a safeGet argument)');
  assert(html.includes('MetronomePrefs.getLocalStorage()'), rel + ' must take storage inside getLocalStorage');
  const m = html.match(/var s=\{bpm:120,bc:4,bu:4,r:false,sm:"uniform",vol:85\};[\s\S]*?document\.getElementById\("play-btn"\)\.onclick=function\(\)\{[\s\S]*?\};/);
  assert(m, rel + ' missing init+play binding snippet');
  const els = {};
  const get = (id) => {
    if (!els[id]) els[id] = stubEl();
    return els[id];
  };
  const box = {
    module: { exports: {} },
    console,
    DOMException,
    URLSearchParams,
    location: { search: '' },
    document: {
      getElementById: get,
      querySelectorAll: () => []
    },
    log() {},
    track() {},
    MetronomeEngine: function () {
      this.setBpm = function () {};
      this.setBeats = function () {};
      this.setMode = function () {};
      this.setVolume = function () {};
    }
  };
  Object.defineProperty(box, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage access denied', 'SecurityError');
    }
  });
  box.window = box;
  box.globalThis = box;
  vm.runInNewContext(
    code + '\nvar engine=new MetronomeEngine({onBeat:function(){}});\n' + m[0],
    box
  );
  assert.equal(box.s.bpm, 120, rel + ' bpm');
  assert.equal(box.s.bc, 4, rel + ' bc');
  assert.equal(box.s.sm, 'uniform', rel + ' sm');
  assert.equal(typeof get('play-btn').onclick, 'function', rel + ' play binding');
}

console.log('Page wiring under localStorage SecurityError getter');
check('index.html init+play with denied storage getter', () => runPageInit('index.html'));
check('en/index.html init+play with denied storage getter', () => runPageInit('en/index.html'));

console.log('All web pref checks passed');
