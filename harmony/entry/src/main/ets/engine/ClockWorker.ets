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
import { BeatScheduler, MetronomePolicy, PcmMixer, SampleVoice } from './Policy';
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

function ready(): boolean {
  return samples.has('click-strong') && samples.has('click-weak') && samples.has('click-uniform');
}

function post(msg: object): void {
  port.postMessage(msg);
}

async function runLoop(): Promise<void> {
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
  await renderer.start();
  const buf = new ArrayBuffer(CHUNK * 2);
  const view = new Int16Array(buf);
  const active: ActiveVoice[] = [];
  const pending: PendingBeat[] = [];
  let framesWritten = 0;
  try {
    while (running) {
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
          post({ t: 'beat', index: b.index });
          pending.splice(i, 1);
        }
      }
      await renderer.write(buf);
      framesWritten += CHUNK;
    }
  } finally {
    try {
      await renderer.stop();
      await renderer.release();
    } catch (_) {
    }
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
      if (!ready()) {
        post({ t: 'ready', ok: false });
      } else {
        post({ t: 'ready', ok: true });
      }
    }
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
    if (running || !ready()) {
      return; // 可重入：连点不开两个钟；未就绪不假响
    }
    running = true;
    scheduler.start(0.0);
    runLoop().catch((err: Error) => {
      running = false;
      scheduler.stop();
      post({ t: 'died', reason: err.message ?? 'audio' });
    });
    return;
  }
  if (t === 'stop') {
    running = false;
    scheduler.stop();
    return;
  }
};
