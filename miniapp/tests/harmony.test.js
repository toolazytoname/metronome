/** Executes shipped ArkTS engine/business logic with mocked platform adapters.
 * This is NOT an ArkTS SDK compile or a real-device audio acceptance test.
 */
import { describe, it, expect } from 'vitest';
import { transformSync } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../harmony/entry/src/main');
function load(rel, modules = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
  const box = { module: { exports: {} }, console, ...globals, require: name => {
    if (!(name in modules)) throw new Error('Unexpected platform import: ' + name);
    return modules[name];
  } };
  vm.runInNewContext(code, box, { timeout: 1000, filename: rel });
  return box.module.exports;
}
const policy = load('ets/engine/Policy.ets');
const wav = load('ets/engine/Wav.ets');
function sample() {
  const bytes = fs.readFileSync(path.join(root, 'resources/rawfile/sounds/click-weak.wav'));
  return new Uint8Array(bytes);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
function worker(create) {
  const messages = [];
  const port = { postMessage: m => messages.push(m) };
  const audio = {
    createAudioRenderer: create,
    AudioSamplingRate: {}, AudioEncodingType: {}, AudioSampleFormat: {}, AudioChannel: {},
    StreamUsage: {}, ContentType: {}
  };
  load('ets/engine/ClockWorker.ets', { '@ohos.worker': { workerPort: port }, '@ohos.multimedia.audio': audio,
    './Policy': policy, './Wav': wav });
  const send = m => port.onmessage({ data: m });
  const names = ['click-strong', 'click-weak', 'click-uniform'];
  for (const lang of ['zh', 'en']) for (let i = 1; i <= 16; i++) names.push(`voice/${lang}/${String(i).padStart(2, '0')}`);
  const bytes = sample();
  const put = name => send({ t: 'sample', name, data: bytes.buffer });
  return { messages, send, names, put };
}
function renderer() {
  const writes = [];
  const blocked = deferred();
  return { writes, blocked, starts: 0, stops: 0, releases: 0,
    async start() { this.starts++; }, async stop() { this.stops++; }, async release() { this.releases++; },
    write(buf) { writes.push(buf.byteLength); return blocked.promise; } };
}

describe('Harmony shipped PCM and clock', () => {
  it('parses every bundled WAV and rejects wrong/truncated/missing formats', () => {
    const visit = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? visit(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const sounds = visit(path.join(root, 'resources/rawfile/sounds')).filter(p => p.endsWith('.wav'));
    expect(sounds.length).toBe(35);
    for (const sound of sounds) expect(wav.Wav.parseInto(new Uint8Array(fs.readFileSync(sound))).length).toBeGreaterThan(0);
    for (const mutate of [
      b => new DataView(b.buffer).setUint32(16, 0xfffffffe, true),
      b => new DataView(b.buffer).setUint16(34, 8, true),
      b => b.set([0, 0, 0, 0], 12),
      b => new DataView(b.buffer).setUint32(4, b.length + 100, true)
    ]) { const b = sample(); mutate(b); expect(wav.Wav.parseInto(b)).toBeNull(); }
    const b = sample(); expect(wav.Wav.parseInto(b.subarray(0, b.length - 1))).toBeNull();
  });

  it('requires all 35 free sounds and acknowledges only after samplesDone', () => {
    const w = worker(() => { throw new Error('must not start'); });
    w.names.slice(0, 3).forEach(w.put);
    expect(w.messages).toEqual([]);
    w.send({ t: 'samplesDone', id: 1 });
    expect(w.messages.at(-1)).toEqual({ t: 'ready', ok: false, id: 1 });
    w.names.slice(3).forEach(w.put);
    w.send({ t: 'samplesDone', id: 2 });
    expect(w.messages.at(-1)).toEqual({ t: 'ready', ok: true, id: 2 });
  });

  it('stop during create then restart never starts the obsolete renderer', async () => {
    const pending = deferred(); const old = renderer(), current = renderer(); let calls = 0;
    const w = worker(() => ++calls === 1 ? pending.promise : Promise.resolve(current));
    w.names.forEach(w.put);
    w.send({ t: 'start', id: 1 }); await flush();
    w.send({ t: 'stop' }); w.send({ t: 'start', id: 2 });
    pending.resolve(old); await flush();
    expect(old.starts).toBe(0); expect(old.releases).toBe(1);
    expect(current.starts).toBe(1);
    expect(w.messages.filter(m => m.t === 'started').map(m => m.id)).toEqual([2]);
    w.send({ t: 'stop' }); current.blocked.resolve(1024); await flush();
    expect(current.releases).toBe(1);
  });

  it('partial writes retry only the unwritten suffix; zero progress stops visibly', async () => {
    const r = renderer(); let calls = 0;
    r.write = buf => { r.writes.push(buf.byteLength); return Promise.resolve(++calls === 1 ? 256 : calls === 2 ? 768 : 0); };
    const w = worker(() => Promise.resolve(r)); w.names.forEach(w.put);
    w.send({ t: 'start', id: 7 }); await flush();
    expect(r.writes).toEqual([1024, 768, 1024]);
    expect(w.messages.some(m => m.t === 'died' && m.id === 7)).toBe(true);
    expect(r.releases).toBe(1);
  });

  it('start and stop errors still release the renderer', async () => {
    const r = renderer(); r.start = () => Promise.reject(new Error('start')); r.stop = () => Promise.reject(new Error('stop'));
    const w = worker(() => Promise.resolve(r)); w.names.forEach(w.put);
    w.send({ t: 'start', id: 8 }); await flush();
    expect(r.releases).toBe(1);
    expect(w.messages.filter(m => m.t === 'died').length).toBe(1);
  });

  it('old run failure cannot cancel a pending newer run', async () => {
    const first = deferred(), r = renderer(); let calls = 0;
    const w = worker(() => ++calls === 1 ? first.promise : Promise.resolve(r)); w.names.forEach(w.put);
    w.send({ t: 'start', id: 1 }); await flush();
    w.send({ t: 'stop' }); w.send({ t: 'start', id: 2 }); first.reject(new Error('obsolete'));
    await flush();
    expect(w.messages.some(m => m.t === 'died')).toBe(false);
    expect(r.starts).toBe(1);
    w.send({ t: 'stop' }); r.blocked.resolve(1024); await flush();
  });

  it('preserves sixty-second timelines and next-beat tempo changes', () => {
    for (const bpm of [40, 120, 208]) {
      const clock = new policy.BeatScheduler(); clock.setBpm(bpm); clock.start(0);
      const beats = clock.pull(60);
      expect(beats.length).toBe(bpm);
      beats.forEach((b, i) => expect(Math.abs(b.time - (0.02 + i * 60 / bpm))).toBeLessThan(1e-8));
    }
    const clock = new policy.BeatScheduler(); clock.start(0);
    expect(clock.pull(0.1).length).toBe(1); clock.setBpm(60);
    expect(clock.pull(0.6)[0].time).toBe(0.52);
    expect(clock.pull(1.6)[0].time).toBe(1.52);
  });
});

// Keep the shipped page's lifecycle/persistence methods, excluding only ArkUI
// builder syntax that is meaningful to the device compiler, not JavaScript.
function pageHarness() {
  let source = fs.readFileSync(path.join(root, 'ets/pages/Index.ets'), 'utf8');
  source = source.slice(0, source.indexOf('  @Builder')) + '\n}\nexport { Index };';
  source = source.replace(/^import .*;$/gm, '').replace(/@Entry\s*|@Component\s*|@State\s*/g, '').replace('struct Index', 'class Index');
  const requests = [], background = [], saves = [];
  const bgStart = deferred();
  let owner;
  class Worker {
    sent = [];
    constructor() { owner = this; }
    postMessage(m) { this.sent.push(m); }
    terminate() { this.terminated = true; }
  }
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  const box = { module: { exports: {} },
    ...policy,
    Copy: { t: (_, key) => key },
    worker: { ThreadWorker: Worker },
    window: { getLastWindow: () => Promise.resolve({ setWindowKeepScreenOn: () => Promise.resolve() }) },
    backgroundTaskManager: {
      BackgroundMode: { AUDIO_PLAYBACK: 1 },
      startBackgroundRunning() { background.push('start'); return bgStart.promise; },
      stopBackgroundRunning() { background.push('stop'); return Promise.resolve(); }
    }
  };
  vm.runInNewContext(code, box, { timeout: 1000 });
  const page = new box.module.exports.Index();
  page.getUIContext = () => ({ getHostContext: () => ({ resourceManager: {
    getRawFileContent() { const d = deferred(); requests.push(d); return d.promise; }
  } }) });
  page.prefsStore = { async put(_, val) { saves.push(JSON.parse(val).bpm); }, async flush() { saves.push('flush'); } };
  return { page, requests, background, bgStart, saves, owner: () => owner };
}

describe('Harmony shipped page lifecycle', () => {
  it('publishes readiness only on the current worker acknowledgment, not on send completion', async () => {
    const h = pageHarness(); h.page.startWorkerAndLoad();
    const owner = h.owner();
    h.requests.forEach(d => d.resolve(sample())); await flush();
    expect(h.page.loading).toBe(true); expect(h.page.samplesReady).toBe(false);
    const done = owner.sent.at(-1); expect(done.t).toBe('samplesDone');
    owner.onmessage({ data: { t: 'ready', id: done.id - 1, ok: true } });
    expect(h.page.samplesReady).toBe(false);
    owner.onmessage({ data: { t: 'ready', id: done.id, ok: true } });
    expect(h.page.samplesReady).toBe(true); expect(h.page.loading).toBe(false);
  });

  it('late started/beat messages after cancellation do not resurrect playback', async () => {
    const h = pageHarness(); h.page.startWorkerAndLoad();
    h.page.samplesReady = true; h.page.loading = false;
    h.page.toggle(); expect(h.page.starting).toBe(true); expect(h.page.playing).toBe(false);
    const id = h.owner().sent.at(-1).id;
    h.page.toggle();
    h.owner().onmessage({ data: { t: 'started', id } });
    h.owner().onmessage({ data: { t: 'beat', id, index: 3 } });
    expect(h.page.playing).toBe(false); expect(h.page.activeBeat).toBe(-1);
    expect(h.background).toEqual([]);
    await flush();
  });

  it('releases a background grant that completes after stop', async () => {
    const h = pageHarness();
    h.page.startBgTask(); await flush();
    h.page.stopBgTask(); h.bgStart.resolve(); await flush();
    expect(h.background).toEqual(['start', 'stop']); expect(h.page.bgTaskOn).toBe(false);
  });

  it('serializes preference put + flush, preserving the latest value', async () => {
    const h = pageHarness(); h.page.bpm = 80; h.page.savePrefs();
    h.page.bpm = 208; h.page.savePrefs(); await flush();
    expect(h.saves).toEqual([80, 'flush', 208, 'flush']);
  });

  it('disappearance invalidates outstanding resource reads', async () => {
    const h = pageHarness(); h.page.startWorkerAndLoad();
    const old = h.owner(); h.page.aboutToDisappear();
    h.requests.forEach(d => d.resolve(sample())); await flush();
    expect(old.terminated).toBe(true);
    expect(old.sent.filter(m => m.t === 'sample').length).toBe(0);
  });
});
