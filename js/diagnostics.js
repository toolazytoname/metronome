/* Local, bounded, opt-in export only. Never send diagnostics over the network. */
(function (global) {
  'use strict';
  var VERSION = '2026.10.02.2';
  var KEY = 'metronome_diagnostics_v1';
  var MAX = 80, TTL = 86400000;
  var events = [], hooks = {};
  var codes = ['page_open', 'play_requested', 'play_ready', 'play_failed', 'paused',
    'context_state', 'audio_interrupted', 'audio_stalled', 'scheduler_failed',
    'audio_reset', 'page_hidden', 'page_visible', 'page_exit', 'page_restored',
    'script_error', 'promise_error', 'boot_failed', 'samples_fallback'];
  function clean(value) {
    var out = {};
    ['bpm', 'bc', 'bu', 'vol', 'buffers'].forEach(function (key) {
      if (value && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 208) out[key] = value[key];
    });
    ['playing', 'loading', 'ready'].forEach(function (key) {
      if (value && typeof value[key] === 'boolean') out[key] = value[key];
    });
    var enums = { mode: ['traditional', 'uniform', 'voice'], audio: ['none', 'running', 'suspended', 'interrupted', 'closed'], visibility: ['visible', 'hidden'] };
    Object.keys(enums).forEach(function (key) {
      if (value && enums[key].indexOf(value[key]) !== -1) out[key] = value[key];
    });
    return out;
  }
  function prune() { events = events.filter(function (e) { return Date.now() - e.at < TTL && e.at <= Date.now(); }).slice(-MAX); }
  function persist() { prune(); try { localStorage.setItem(KEY, JSON.stringify(events)); } catch (_) {} }
  try {
    var stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(stored)) stored.slice(-MAX).forEach(function (e) {
      if (e && Number.isFinite(e.at) && codes.indexOf(e.code) !== -1 && /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(e.version)) {
        events.push({ at: e.at, version: e.version, code: e.code, state: clean(e.state) });
      }
    });
  } catch (_) {}
  function state() {
    try { return clean(Object.assign({ visibility: document.visibilityState }, hooks.snapshot ? hooks.snapshot() : {})); } catch (_) { return {}; }
  }
  function record(code) {
    if (codes.indexOf(code) === -1) return;
    events.push({ at: Date.now(), version: VERSION, code: code, state: state() });
    persist();
  }
  function report() {
    prune();
    var ua = navigator.userAgent || '';
    var browser = ua.match(/(Firefox|Edg|Chrome|Version)\/(\d+)/);
    return JSON.stringify({ product: 'Bunny Metronome Web', version: VERSION,
      browser: browser ? browser[1] + '/' + browser[2] : 'other',
      os: /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'other',
      online: navigator.onLine, serviceWorker: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      state: state(), events: events }, null, 2);
  }
  global.MetronomeDiagnostics = { record: record, report: report, attach: function (value) { hooks = value; }, version: VERSION };
  record('page_open');
  global.addEventListener('error', function () { record('script_error'); }, true);
  global.addEventListener('unhandledrejection', function () { record('promise_error'); });
  document.addEventListener('visibilitychange', function () { record(document.visibilityState === 'hidden' ? 'page_hidden' : 'page_visible'); });
  global.addEventListener('pagehide', function () { record('page_exit'); });
  global.addEventListener('pageshow', function (event) { if (event.persisted) record('page_restored'); });
  var en = document.documentElement.lang.indexOf('en') === 0;
  var text = document.getElementById('diagnostic-text');
  var status = document.getElementById('diagnostic-status');
  var version = document.getElementById('web-version');
  if (version) version.textContent = 'Web ' + VERSION;
  function show() { if (text) text.value = report(); }
  var panel = document.getElementById('diagnostics');
  if (panel) panel.addEventListener('toggle', function () { if (panel.open) show(); });
  var copy = document.getElementById('diagnostic-copy');
  if (copy) copy.onclick = function () {
    show();
    function fallback() { text.focus(); text.select(); status.textContent = en ? 'Copy unavailable. Select and copy the text below.' : '无法自动复制，请选中下方文本手动复制。'; }
    try {
      if (!navigator.clipboard) { fallback(); return; }
      navigator.clipboard.writeText(text.value).then(function () {
        status.textContent = en ? 'Copied. Send it with what happened to support.' : '已复制，请连同故障经过一起发给支持。';
      }).catch(fallback);
    } catch (_) { fallback(); }
  };
  var clear = document.getElementById('diagnostic-clear');
  if (clear) clear.onclick = function () { events = []; persist(); show(); status.textContent = en ? 'Local logs cleared.' : '本机诊断记录已清除。'; };
  var reset = document.getElementById('diagnostic-reset');
  if (reset) reset.onclick = function () {
    try {
      if (!hooks.reset) throw new Error('not ready');
      hooks.reset(); show(); status.textContent = en ? 'Audio reset. Press Play to try again.' : '音频已重置，请再点播放。';
    } catch (_) { status.textContent = en ? 'Please copy diagnostics, then reload this page.' : '请先复制诊断信息，再刷新页面。'; }
  };
  global.addEventListener('load', function () {
    if (!hooks.snapshot) {
      record('boot_failed');
      if (panel) panel.open = true;
      if (status) status.textContent = en ? 'Startup failed. Copy diagnostics, then reload.' : '页面启动失败，请复制诊断后刷新。';
    }
  });
})(window);
