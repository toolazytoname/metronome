/* 小兔头节拍器 · 音频引擎
 * Lookahead scheduler on AudioContext.currentTime (Chris Wilson).
 * Clicks + pre-rendered counts are AudioBuffers; a synth click is the fallback.
 */
(function (global) {
  'use strict';

  var LOOKAHEAD_MS = 25;
  var SCHEDULE_AHEAD = 0.1;
  var MAX_VOICE = 16;
  var SAMPLE_TIMEOUT_MS = 8000;

  function withTimeout(promise, ms, onTimeout) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        if (onTimeout) {
          try { onTimeout(); } catch (e) { /* ignore */ }
        }
        reject(new Error('timeout'));
      }, ms);
      promise.then(function (value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function MetronomeEngine(opts) {
    opts = opts || {};
    this.lang = opts.lang === 'en' ? 'en' : 'zh';
    this.base = opts.base || '/assets/sounds';
    this.onBeat = opts.onBeat || function () {};
    this.bpm = 120;
    this.bc = 4;
    this.sm = 'uniform';
    this.vol = 0.85;
    this.playing = false;
    this.cb = 0;
    this.ctx = null;
    this.master = null;
    this.buffers = {};
    this.timer = null;
    this.nextNoteTime = 0;
    this.visualTimers = [];
    this._liveSources = [];
    this._loadPromise = null;
    this._starting = false;
    this._startPromise = null;
    this._runId = 0;
    this.ready = false;
  }

  MetronomeEngine.prototype.init = function () {
    var self = this;
    if (!this.ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return Promise.reject(new Error('No AudioContext'));
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(this.ctx.destination);
    }
    var resume = this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
    return resume.then(function () { return self._ensureSamples(); });
  };

  MetronomeEngine.prototype._url = function (rel) {
    return this.base + '/' + rel;
  };

  MetronomeEngine.prototype._ensureSamples = function () {
    if (this._loadPromise) return this._loadPromise;
    var self = this;
    var jobs = [
      this._fetchBuffer('strong', 'click-strong.mp3'),
      this._fetchBuffer('weak', 'click-weak.mp3'),
      this._fetchBuffer('uniform', 'click-uniform.mp3')
    ];
    for (var i = 1; i <= MAX_VOICE; i++) {
      var id = i < 10 ? '0' + i : String(i);
      jobs.push(this._fetchBuffer('v' + i, 'voice/' + this.lang + '/' + id + '.mp3'));
    }
    this._loadPromise = Promise.all(jobs).then(function () {
      self.ready = true;
    }).catch(function () {
      self.ready = true; // synth fallback still works
    });
    return this._loadPromise;
  };

  MetronomeEngine.prototype.reloadSamples = function () {
    this._loadPromise = null;
    this.ready = false;
    this.buffers = {};
  };

  MetronomeEngine.prototype._fetchBuffer = function (key, rel) {
    var self = this;
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var fetchOpts = ac ? { signal: ac.signal } : {};
    var work = fetch(this._url(rel), fetchOpts).then(function (res) {
      if (!res.ok) throw new Error(rel);
      return res.arrayBuffer();
    }).then(function (ab) {
      return new Promise(function (resolve) {
        var done = false;
        function ok(buf) {
          if (done || !buf) return;
          done = true;
          self.buffers[key] = buf;
          resolve(buf);
        }
        function fail() {
          if (done) return;
          done = true;
          resolve(null);
        }
        try {
          var ret = self.ctx.decodeAudioData(ab, ok, fail);
          if (ret && typeof ret.then === 'function') ret.then(ok, fail);
        } catch (e) {
          fail();
        }
      });
    });
    return withTimeout(work, MetronomeEngine.SAMPLE_TIMEOUT_MS || SAMPLE_TIMEOUT_MS, function () {
      if (ac) {
        try { ac.abort(); } catch (e) { /* ignore */ }
      }
    }).catch(function () {
      return null;
    });
  };

  MetronomeEngine.prototype.setBpm = function (bpm) {
    this.bpm = clamp(bpm, 40, 208);
  };

  MetronomeEngine.prototype.setBeats = function (bc) {
    this.bc = clamp(bc | 0, 1, 16);
    if (this.cb >= this.bc) this.cb = 0;
  };

  MetronomeEngine.prototype.setMode = function (sm) {
    if (sm === 'traditional' || sm === 'uniform' || sm === 'voice') this.sm = sm;
  };

  MetronomeEngine.prototype.setVolume = function (v) {
    this.vol = clamp(v, 0.05, 1);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.02);
    }
  };

  MetronomeEngine.prototype.resetBeat = function () {
    this.cb = 0;
  };

  MetronomeEngine.prototype.start = function () {
    var self = this;
    if (this.playing || this._starting) {
      return this._startPromise || Promise.resolve();
    }
    // Arm immediately so a second play click cannot open another scheduler
    // while samples are still fetching.
    this.playing = true;
    this._starting = true;
    var runId = ++this._runId;
    var init;
    try { init = this.init(); } catch (err) { init = Promise.reject(err); }
    this._startPromise = init.then(function () {
      if (!self.playing || self._runId !== runId) return;
      self._starting = false;
      self.cb = 0;
      self.nextNoteTime = self.ctx.currentTime + 0.02;
      self._scheduler();
    }).catch(function (err) {
      if (self._runId === runId) {
        self.playing = false;
        self._starting = false;
        self._startPromise = null;
      }
      throw err;
    });
    return this._startPromise;
  };

  MetronomeEngine.prototype.stop = function () {
    this.playing = false;
    this._starting = false;
    this._runId += 1;
    this._startPromise = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._stopLiveSources();
    this._clearVisuals();
  };

  MetronomeEngine.prototype._trackSource = function (src) {
    if (!src) return src;
    var self = this;
    this._liveSources.push(src);
    var prev = src.onended;
    src.onended = function (ev) {
      var i = self._liveSources.indexOf(src);
      if (i >= 0) self._liveSources.splice(i, 1);
      if (typeof prev === 'function') prev.call(src, ev);
    };
    return src;
  };

  MetronomeEngine.prototype._stopLiveSources = function () {
    var list = this._liveSources;
    this._liveSources = [];
    for (var i = 0; i < list.length; i++) {
      try { list[i].stop(); } catch (e) { /* already stopped */ }
    }
  };

  MetronomeEngine.prototype._clearVisuals = function () {
    for (var i = 0; i < this.visualTimers.length; i++) clearTimeout(this.visualTimers[i]);
    this.visualTimers = [];
  };

  MetronomeEngine.prototype._scheduler = function () {
    if (!this.playing || !this.ctx) return;
    var now = this.ctx.currentTime;
    var interval = 60 / this.bpm;
    var ahead = now + SCHEDULE_AHEAD;
    // More than one interval behind: drop expired beats and resume from now.
    // Do not burst-schedule the backlog. Changing BPM still only changes `interval`.
    if (this.nextNoteTime < now - interval) {
      this.nextNoteTime = now;
    }
    while (this.nextNoteTime < ahead) {
      this._scheduleBeat(this.cb, this.nextNoteTime);
      this.nextNoteTime += interval;
      this.cb = (this.cb + 1) % this.bc;
    }
    var self = this;
    this.timer = setTimeout(function () { self._scheduler(); }, LOOKAHEAD_MS);
  };

  MetronomeEngine.prototype._scheduleBeat = function (beat, time) {
    if (this.sm === 'traditional') {
      this._playBuffer(beat === 0 ? 'strong' : 'weak', time, 1);
    } else if (this.sm === 'uniform') {
      this._playBuffer('uniform', time, 1);
    } else {
      // Count sample + a light click so the downbeat still has an attack.
      this._playBuffer('v' + (beat + 1), time, 1);
      this._playBuffer('weak', time, 0.28);
    }

    var delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
    var self = this;
    var id = setTimeout(function () { self.onBeat(beat); }, delay);
    this.visualTimers.push(id);
    if (this.visualTimers.length > 24) {
      clearTimeout(this.visualTimers.shift());
    }
  };

  MetronomeEngine.prototype._playBuffer = function (key, time, gain) {
    var buf = this.buffers[key];
    if (buf) {
      var src = this.ctx.createBufferSource();
      var g = this.ctx.createGain();
      g.gain.value = gain;
      src.buffer = buf;
      src.connect(g);
      g.connect(this.master);
      this._trackSource(src);
      src.start(time);
      return;
    }
    this._synthClick(key, time, gain);
  };

  MetronomeEngine.prototype._synthClick = function (key, time, gain) {
    if (!this.ctx) return;
    var freq = key === 'strong' ? 980 : key === 'weak' ? 1680 : 1240;
    var dur = key === 'strong' ? 0.045 : 0.032;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, time);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.7 * gain, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(this.master);
    this._trackSource(o);
    o.start(time);
    o.stop(time + dur + 0.01);

    // short noise tick so it still cuts through a piano
    var n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.012), this.ctx.sampleRate);
    var data = n.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    var ns = this.ctx.createBufferSource();
    var ng = this.ctx.createGain();
    var bp = this.ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 1800;
    ns.buffer = n;
    ng.gain.setValueAtTime(0.35 * gain, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
    ns.connect(bp);
    bp.connect(ng);
    ng.connect(this.master);
    this._trackSource(ns);
    ns.start(time);
  };

  MetronomeEngine.SAMPLE_TIMEOUT_MS = SAMPLE_TIMEOUT_MS;
  MetronomeEngine.SCHEDULE_AHEAD = SCHEDULE_AHEAD;
  MetronomeEngine.LOOKAHEAD_MS = LOOKAHEAD_MS;

  global.MetronomeEngine = MetronomeEngine;
})(typeof window !== 'undefined' ? window : this);
