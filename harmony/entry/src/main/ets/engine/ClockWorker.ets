/**
 * 拍钟 worker：AudioRenderer + 512 帧阻塞写循环，拍点按绝对帧位置预约混音。
 * 与 Android AudioTrackClock 同构；UI 线程禁止 setInterval 当拍钟。
 *
 * 消息协议（JSON-safe）：
 *   入：{t:'sample', name, data:ArrayBuffer}   逐个传采样（transfer）
 *       {t:'config', bpm, bc, sm, lang, vol}
 *       {t:'start'} / {t:'stop'}
 *   出：{t:'ready', ok:boolean}
 *       {t:'beat', index:number}
 *       {t:'died', reason:string}
 */
import worker, { ThreadWorkerGlobalScope, MessageEvents } from '@ohos.worker';
import audio from '@ohos.multimedia.audio';
import { BeatScheduler, MetronomePolicy, PcmMixer } from './Policy';
import { Wav } from './Wav';

const port: ThreadWorkerGlobalScope = worker.workerPort;
const SAMPLE_RATE = 44100;
const CHUNK = 512;

class ActiveVoice {
  pcm: Int16Array = new Int16Array(1);
  origin: number = 0;
  gain: number = 1.0;
}

class PendingBeat {
  index: number = 0;
  origin: number = 0;
}

const samples = new Map<string, Int16Array>();
const scheduler = new BeatScheduler();
let mode: string = 'uniform';
let lang: string = 'zh';
let volume = 0.85;
let running = false;
let generation = 0;
let runTask: Promise<void> = Promise.resolve();

function ready(): boolean {
  const keys = ['click-strong', 'click-weak', 'click-uniform'];
  for (const l of ['zh', 'en']) {
    for (let i = 1; i <= 16; i++) {
      keys.push(`voice/${l}/${i < 10 ? '0' + i : i}`);
    }
  }
  return keys.every((key: string) => {
    const pcm = samples.get(key);
    return pcm !== undefined && pcm.length > 0;
  });
}

function isLive(token: number): boolean {
  return running && generation === token;
}

function post(msg: object): void {
  port.postMessage(msg);
}

async function runLoop(token: number, requestId: number): Promise<void> {
  if (!isLive(token)) return;
  const renderer = await audio.createAudioRenderer({
    streamInfo: {
      samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_44100,
      encoding: audio.AudioEncodingType.ENCODING_TYPE_PCM,
      format: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
      channels: audio.AudioChannel.CHANNEL_1
    },
    rendererInfo: {
      usage: audio.StreamUsage.STREAM_USAGE_MUSIC,
      contentType: audio.ContentType.CONTENT_TYPE_MUSIC,
      rendererFlags: 0
    }
  });
  const buf = new ArrayBuffer(CHUNK * 2);
  const view = new Int16Array(buf);
  const active: ActiveVoice[] = [];
  const pending: PendingBeat[] = [];
  let framesWritten = 0;
  try {
    if (!isLive(token)) return;
    await renderer.start();
    if (!isLive(token)) return;
    scheduler.start(0.0);
    post({ t: 'started', id: requestId });
    while (isLive(token)) {
      const chunkOrigin = framesWritten;
      const chunkEnd = framesWritten + CHUNK;
      const horizon = chunkEnd / SAMPLE_RATE + 0.05;
      for (const beat of scheduler.pull(horizon)) {
        const origin = PcmMixer.frameForTime(beat.time, SAMPLE_RATE);
        const pb = new PendingBeat();
        pb.index = beat.index;
        pb.origin = origin;
        pending.push(pb);
        const voices = MetronomePolicy.sampleVoices(beat.index, mode as 'traditional' | 'uniform' | 'voice', lang);
        for (const v of voices) {
          const pcm = samples.get(v.key);
          if (pcm === undefined) {
            continue; // 缺采样的拍跳过，不排队补发
          }
          const av = new ActiveVoice();
          av.pcm = pcm;
          av.origin = origin;
          av.gain = v.gain * volume;
          active.push(av);
        }
      }
      view.fill(0);
      for (let i = active.length - 1; i >= 0; i--) {
        const v = active[i];
        PcmMixer.mix(view, chunkOrigin, v.pcm, v.origin, v.gain);
        if (v.origin + v.pcm.length <= chunkEnd) {
          active.splice(i, 1);
        }
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const b = pending[i];
        if (b.origin >= chunkOrigin && b.origin < chunkEnd) {
          post({ t: 'beat', index: b.index, id: requestId });
          pending.splice(i, 1);
        }
      }
      let offset = 0;
      while (offset < buf.byteLength && isLive(token)) {
        const remaining = buf.byteLength - offset;
        const wrote = await renderer.write(offset === 0 ? buf : buf.slice(offset));
        if (!isLive(token)) return;
        if (!Number.isInteger(wrote) || wrote <= 0 || wrote > remaining || wrote % 2 !== 0) {
          throw new Error('AudioRenderer write failed');
        }
        offset += wrote;
        framesWritten += wrote / 2;
      }
    }
  } finally {
    try { await renderer.stop(); } catch (_) {}
    try { await renderer.release(); } catch (_) {}
  }
}

port.onmessage = (e: MessageEvents) => {
  const m = e.data as Record<string, Object>;
  const t = m['t'] as string;
  if (t === 'sample') {
    const name = m['name'] as string;
    const data = m['data'] as ArrayBuffer;
    const pcm = Wav.parseInto(new Uint8Array(data));
    if (pcm !== null && pcm.length > 0) {
      samples.set(name, pcm);
    }
    return;
  }
  if (t === 'samplesDone') {
    post({ t: 'ready', ok: ready(), id: m['id'] });
    return;
  }
  if (t === 'config') {
    const bpm = m['bpm'] as number;
    const bc = m['bc'] as number;
    const sm = m['sm'] as string;
    const lg = m['lang'] as string;
    const vol = m['vol'] as number;
    scheduler.setBpm(MetronomePolicy.clampBpm(bpm));
    scheduler.setBeats(MetronomePolicy.clampBeats(bc));
    if (sm === 'traditional' || sm === 'uniform' || sm === 'voice') {
      mode = sm;
    }
    if (lg === 'zh' || lg === 'en') {
      lang = lg;
    }
    volume = Math.min(Math.max(vol / 100.0, 0.05), 1.0);
    return;
  }
  if (t === 'start') {
    if (running) return;
    const requestId = m['id'] as number;
    if (!ready()) {
      post({ t: 'died', reason: 'samples', id: requestId });
      return;
    }
    running = true;
    const token = ++generation;
    // Serialize renderer ownership: a new run waits for the previous finally
    // block, but never inherits its scheduler progress or failure callbacks.
    runTask = runTask.then(() => runLoop(token, requestId)).catch((err: Error) => {
      if (!isLive(token)) return;
      running = false;
      scheduler.stop();
      post({ t: 'died', reason: err.message, id: requestId });
    });
    return;
  }
  if (t === 'stop') {
    generation += 1;
    running = false;
    scheduler.stop();
  }
};
