/* Local, bounded diagnostics. Outbound reporting is explicit user action via share/mail. */
(function (global) {
  'use strict';
  var VERSION = '2026.10.03.3';
  var KEY = 'metronome_diagnostics_v1';
  var MAX = 80, TTL = 86400000;
  var events = [], hooks = {};
  var codes = ['page_open', 'play_requested', 'play_ready', 'play_failed', 'paused',
    'context_state', 'audio_interrupted', 'audio_stalled', 'scheduler_failed',
    'visual_failed', 'audio_reset', 'page_hidden', 'page_visible', 'page_exit', 'page_restored',
    'script_error', 'promise_error', 'boot_failed', 'samples_fallback'];
  function clean(value) {
    var out = {};
    ['bpm', 'bc', 'bu', 'vol', 'buffers'].forEach(function (key) {
      if (value && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 208) out[key] = value[key];
    });
    ['playing', 'loading', 'ready', 'uiPlaying'].forEach(function (key) {
      if (value && typeof value[key] === 'boolean') out[key] = value[key];
    });
    var enums = { mode: ['traditional', 'uniform', 'voice'], audio: ['none', 'running', 'suspended', 'interrupted', 'closed'], visibility: ['visible', 'hidden'] };
    Object.keys(enums).forEach(function (key) {
      if (value && enums[key].indexOf(value[key]) !== -1) out[key] = value[key];
    });
    var visualBounds = { scheduledBeat: [-1, 15], renderedBeat: [-1, 15], visualUpdates: [0, 65535], visualAgeMs: [0, 60000], visualNodes: [0, 16] };
    Object.keys(visualBounds).forEach(function (key) {
      var n = value && value[key], range = visualBounds[key];
      if (Number.isInteger(n) && n >= range[0] && n <= range[1]) out[key] = n;
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
  function reportForSending(note) {
    var payload;
    try { payload = JSON.parse(report()); } catch (_) { payload = { product: 'Bunny Metronome Web', version: VERSION }; }
    // Keep mailto URLs usable on mobile browsers; the full report remains available via Copy.
    var recentEvents = (payload.events || []).slice(-32);
    delete payload.events;
    if (note) payload.userNote = String(note).slice(0, 1200);
    payload.events = recentEvents;
    var text = JSON.stringify(payload, null, 2);
    return text.length > 6000 ? text.slice(0, 6000) + '\n... [report truncated; use Copy for full report]' : text;
  }
  function sendReport(note, done) {
    var subject = '[Bunny Metronome Web] Audio issue · ' + VERSION;
    var body = 'Please describe what happened above this line if needed.\n\n' + reportForSending(note);
    var text = subject + '\n\n' + body;
    function mail() {
      try {
        global.location.href = 'mailto:lazywc@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        done('mail');
      } catch (_) { done('fallback'); }
    }
    try {
      if (navigator.share) {
        navigator.share({ title: subject, text: text }).then(function () { done('share'); }, function (err) {
          if (err && err.name === 'AbortError') done('cancel'); else mail();
        });
      } else mail();
    } catch (_) { mail(); }
  }
  global.MetronomeDiagnostics = { record: record, report: report, send: sendReport, attach: function (value) { hooks = value; }, version: VERSION };
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
  var send = document.getElementById('diagnostic-send');
  if (send) send.onclick = function () {
    var noteEl = document.getElementById('diagnostic-note');
    var note = noteEl && noteEl.value ? noteEl.value : '';
    status.textContent = en ? 'Opening share or email…' : '正在打开分享或邮件…';
    sendReport(note, function (kind) {
      if (kind === 'share') status.textContent = en ? 'Share sheet opened. Confirm to send the report.' : '分享面板已打开，请确认发送诊断。';
      else if (kind === 'mail') status.textContent = en ? 'Email draft opened. Review and press Send.' : '邮件草稿已打开，请确认内容后点击发送。';
      else if (kind === 'cancel') status.textContent = en ? 'Report not sent.' : '已取消发送，诊断未发出。';
      else status.textContent = en ? 'Could not open share or email. Copy the report below.' : '无法打开分享或邮件，请复制下方诊断信息。';
    });
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
