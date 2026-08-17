/* 小兔头节拍器 · 音频引擎
 * Lookahead scheduler on AudioContext.currentTime (Chris Wilson).
 * Clicks + pre-rendered counts are AudioBuffers; a synth click is the fallback.
 */
(function (global) {
  'use strict';

  var LOOKAHEAD_MS = 25;
  var SCHEDULE_AHEAD = 0.1;
  var MAX_VOICE = 16;

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

  MetronomeEngine.prototype._fetchBuffer = function (key, rel) {
    var self = this;
    return fetch(this._url(rel)).then(function (res) {
      if (!res.ok) throw new Error(rel);
      return res.arrayBuffer();
    }).then(function (ab) {
      return new Promise(function (resolve, reject) {
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
    this._startPromise = this.init().then(function () {
      self._starting = false;
      if (!self.playing || self._runId !== runId) return;
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
    this._clearVisuals();
  };

  MetronomeEngine.prototype._clearVisuals = function () {
    for (var i = 0; i < this.visualTimers.length; i++) clearTimeout(this.visualTimers[i]);
    this.visualTimers = [];
  };

  MetronomeEngine.prototype._scheduler = function () {
    if (!this.playing || !this.ctx) return;
    var ahead = this.ctx.currentTime + SCHEDULE_AHEAD;
    while (this.nextNoteTime < ahead) {
      this._scheduleBeat(this.cb, this.nextNoteTime);
      this.nextNoteTime += 60 / this.bpm;
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
    ns.start(time);
  };

  global.MetronomeEngine = MetronomeEngine;
})(typeof window !== 'undefined' ? window : this);
