/* Shared metronome preference clamp. Used by Web zh/en pages. */
(function (global) {
  'use strict';

  var MODES = ['traditional', 'uniform', 'voice'];

  function toInt(n, fallback) {
    if (n === null || n === undefined || n === '') return fallback;
    var x = typeof n === 'number' ? n : Number(String(n).trim());
    if (!isFinite(x)) return fallback;
    return Math.round(x);
  }

  function clampBpm(n) {
    return Math.max(40, Math.min(208, toInt(n, 120)));
  }

  function clampBeats(n) {
    return Math.max(1, Math.min(16, toInt(n, 4)));
  }

  function clampBeatUnit(n) {
    return Math.max(1, Math.min(16, toInt(n, 4)));
  }

  function clampVol(n) {
    return Math.max(10, Math.min(100, toInt(n, 85)));
  }

  function parseMode(raw) {
    return MODES.indexOf(raw) !== -1 ? raw : 'uniform';
  }

  function parseSig(raw) {
    if (raw == null || raw === '') return null;
    var m = String(raw).match(/^([1-9][0-9]?)\/([1-9][0-9]?)$/);
    if (!m) return null;
    var bc = +m[1];
    var bu = +m[2];
    if (bc < 1 || bc > 16 || bu < 1 || bu > 16) return null;
    return { bc: bc, bu: bu };
  }

  function parseBpmQuery(raw) {
    if (raw == null || raw === '') return null;
    var x = Number(raw);
    if (!isFinite(x)) return null;
    x = Math.round(x);
    if (x < 40 || x > 208) return null;
    return x;
  }

  function readStoredObject(raw) {
    if (raw == null || raw === '') return {};
    try {
      var cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return {};
      return cfg;
    } catch (e) {
      return {};
    }
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function resolveState(qs, storedRaw) {
    qs = qs || { get: function () { return null; } };
    var stored = readStoredObject(storedRaw);
    var s = { bpm: 120, bc: 4, bu: 4, sm: 'uniform', vol: 85 };
    var qBpm = qs.get('bpm');
    var qSig = qs.get('sig');
    var qMode = qs.get('mode');

    if (qBpm != null && qBpm !== '') {
      var b = parseBpmQuery(qBpm);
      if (b != null) s.bpm = b;
    } else if (hasOwn(stored, 'bpm')) {
      s.bpm = clampBpm(stored.bpm);
    }

    if (qSig != null && qSig !== '') {
      var sig = parseSig(qSig);
      if (sig) {
        s.bc = sig.bc;
        s.bu = sig.bu;
      }
    } else {
      if (hasOwn(stored, 'bc')) s.bc = clampBeats(stored.bc);
      if (hasOwn(stored, 'bu')) s.bu = clampBeatUnit(stored.bu);
    }

    if (qMode != null && qMode !== '') {
      if (MODES.indexOf(qMode) !== -1) s.sm = qMode;
    } else if (hasOwn(stored, 'sm')) {
      s.sm = parseMode(stored.sm);
    }

    if (hasOwn(stored, 'vol')) s.vol = clampVol(stored.vol);
    return s;
  }

  function urlPreset(qs) {
    return !!(qs && (qs.get('bpm') || qs.get('sig') || qs.get('mode')));
  }

  function getLocalStorage() {
    try {
      var root = typeof window !== 'undefined' ? window : globalThis;
      var ls = root.localStorage;
      return ls || null;
    } catch (e) {
      return null;
    }
  }

  function safeGet(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(storage, key, val) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(key, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadPref(key) {
    return safeGet(getLocalStorage(), key);
  }

  function savePref(key, val) {
    return safeSet(getLocalStorage(), key, val);
  }

  function adoptScreenLock(lock, isPlaying) {
    if (!lock) return null;
    if (!isPlaying) {
      try {
        var released = typeof lock.release === 'function' ? lock.release() : null;
        if (released && typeof released.catch === 'function') released.catch(function () {});
      } catch (e) { /* ignore */ }
      return null;
    }
    return lock;
  }

  var api = {
    clampBpm: clampBpm,
    clampBeats: clampBeats,
    clampBeatUnit: clampBeatUnit,
    clampVol: clampVol,
    parseMode: parseMode,
    parseSig: parseSig,
    parseBpmQuery: parseBpmQuery,
    readStoredObject: readStoredObject,
    resolveState: resolveState,
    urlPreset: urlPreset,
    getLocalStorage: getLocalStorage,
    safeGet: safeGet,
    safeSet: safeSet,
    loadPref: loadPref,
    savePref: savePref,
    adoptScreenLock: adoptScreenLock
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.MetronomePrefs = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
