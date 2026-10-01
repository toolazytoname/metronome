/**
 * 鸿蒙端策略层：移植 android/policy 的 MetronomePolicy / BeatScheduler / PcmMixer。
 * cn 变体：无音色工坊、无 pack bank、无内购；震动只有免费档（all + standard）。
 * 语义必须与 docs/engine-contract.md 一致。
 */

export type SoundModeRaw = 'traditional' | 'uniform' | 'voice';

export class SoundMode {
  static readonly TRADITIONAL: SoundModeRaw = 'traditional';
  static readonly UNIFORM: SoundModeRaw = 'uniform';
  static readonly VOICE: SoundModeRaw = 'voice';

  static parse(raw: string | undefined): SoundModeRaw {
    if (raw === 'traditional' || raw === 'uniform' || raw === 'voice') {
      return raw;
    }
    return SoundMode.UNIFORM;
  }
}

export class SampleVoice {
  key: string = '';
  gain: number = 1.0;

  constructor(key: string, gain: number) {
    this.key = key;
    this.gain = gain;
  }
}

export class MetronomePolicy {
  static readonly MIN_BPM = 40;
  static readonly MAX_BPM = 208;
  static readonly MIN_BEATS = 1;
  static readonly MAX_BEATS = 16;
  static readonly DEFAULT_BANK = 'default';
  static readonly BEAT_ROW_MAX = 4;

  static clampBpm(n: number): number {
    return Math.min(Math.max(MetronomePolicy.round(n), MetronomePolicy.MIN_BPM), MetronomePolicy.MAX_BPM);
  }

  static clampBeats(n: number): number {
    return Math.min(Math.max(MetronomePolicy.round(n), MetronomePolicy.MIN_BEATS), MetronomePolicy.MAX_BEATS);
  }

  static clampBeatUnit(n: number): number {
    return Math.min(Math.max(MetronomePolicy.round(n), 1), 16);
  }

  static clampVolume(n: number): number {
    return Math.min(Math.max(MetronomePolicy.round(n), 10), 100);
  }

  private static round(n: number): number {
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.round(n);
  }

  static intervalSeconds(bpm: number): number {
    return 60.0 / MetronomePolicy.clampBpm(bpm);
  }

  /** BPM 输入只接受完整有限十进制整数；非法返回 NaN 由调用方忽略。 */
  static parseIntStrict(raw: string): number {
    if (!/^\d+$/.test(raw)) {
      return NaN;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  static sampleVoices(beat: number, mode: SoundModeRaw, lang: string): SampleVoice[] {
    if (mode === SoundMode.TRADITIONAL) {
      const name = beat === 0 ? 'click-strong' : 'click-weak';
      return [new SampleVoice(name, 1.0)];
    }
    if (mode === SoundMode.UNIFORM) {
      return [new SampleVoice('click-uniform', 1.0)];
    }
    const n = Math.min(Math.max(beat + 1, 1), MetronomePolicy.MAX_BEATS);
    const id = n < 10 ? `0${n}` : `${n}`;
    const l = lang === 'en' ? 'en' : 'zh';
    return [
      new SampleVoice(`voice/${l}/${id}`, 1.0),
      new SampleVoice('click-weak', 0.28)
    ];
  }
}

export class MetronomePrefs {
  bpm: number = 120;
  bc: number = 4;
  bu: number = 4;
  sm: string = SoundMode.UNIFORM;
  vol: number = 85;
  lang: string = 'zh';
  haptic: boolean = false;
  keepAwake: boolean = true;
  // cn 变体无工坊：bank 字段仅为偏好形状对齐，恒为 default。
  clickBank: string = MetronomePolicy.DEFAULT_BANK;
  voiceBank: string = MetronomePolicy.DEFAULT_BANK;
  hapticPattern: string = 'all';
  hapticFeel: string = 'standard';

  mode(): SoundModeRaw {
    return SoundMode.parse(this.sm);
  }

  static fromRecord(raw: Record<string, Object | undefined>): MetronomePrefs {
    const p = new MetronomePrefs();
    const bpm = raw['bpm'];
    if (typeof bpm === 'number') {
      p.bpm = MetronomePolicy.clampBpm(bpm);
    }
    const bc = raw['bc'];
    if (typeof bc === 'number') {
      p.bc = MetronomePolicy.clampBeats(bc);
    }
    const bu = raw['bu'];
    if (typeof bu === 'number') {
      p.bu = MetronomePolicy.clampBeatUnit(bu);
    }
    const sm = raw['sm'];
    if (typeof sm === 'string') {
      p.sm = SoundMode.parse(sm);
    }
    const vol = raw['vol'];
    if (typeof vol === 'number') {
      p.vol = MetronomePolicy.clampVolume(vol);
    }
    const lang = raw['lang'];
    if (lang === 'en' || lang === 'zh') {
      p.lang = lang;
    }
    const haptic = raw['haptic'];
    if (typeof haptic === 'boolean') {
      p.haptic = haptic;
    }
    const keepAwake = raw['keepAwake'];
    if (typeof keepAwake === 'boolean') {
      p.keepAwake = keepAwake;
    }
    return p;
  }

  toRecord(): Record<string, Object> {
    const r: Record<string, Object> = {};
    r['bpm'] = this.bpm;
    r['bc'] = this.bc;
    r['bu'] = this.bu;
    r['sm'] = this.sm;
    r['vol'] = this.vol;
    r['lang'] = this.lang;
    r['haptic'] = this.haptic;
    r['keepAwake'] = this.keepAwake;
    r['clickBank'] = this.clickBank;
    r['voiceBank'] = this.voiceBank;
    r['hapticPattern'] = this.hapticPattern;
    r['hapticFeel'] = this.hapticFeel;
    return r;
  }
}

export class ScheduledBeat {
  index: number = 0;
  time: number = 0.0;
}

/** 音频时间线拍钟：与 Android BeatScheduler 同语义。 */
export class BeatScheduler {
  private bpmValue: number = 120;
  private beatsPerBar: number = 4;
  private beatIdx: number = 0;
  private nextTime: number = 0.0;
  playing: boolean = false;

  start(now: number): void {
    this.playing = true;
    this.beatIdx = 0;
    this.nextTime = now + 0.02;
  }

  stop(): void {
    this.playing = false;
  }

  setBpm(value: number): void {
    this.bpmValue = MetronomePolicy.clampBpm(value);
  }

  setBeats(value: number): void {
    this.beatsPerBar = MetronomePolicy.clampBeats(value);
    if (this.beatIdx >= this.beatsPerBar) {
      this.beatIdx = 0;
    }
  }

  /** 只改下一拍间隔：setBpm 不动 nextTime / beatIdx。 */
  pull(untilHorizon: number): ScheduledBeat[] {
    if (!this.playing) {
      return [];
    }
    const out: ScheduledBeat[] = [];
    while (this.nextTime < untilHorizon) {
      const b = new ScheduledBeat();
      b.index = this.beatIdx;
      b.time = this.nextTime;
      out.push(b);
      this.nextTime += MetronomePolicy.intervalSeconds(this.bpmValue);
      this.beatIdx = (this.beatIdx + 1) % this.beatsPerBar;
    }
    return out;
  }
}

/** 绝对帧坐标混音：dest 覆盖 [destOrigin, destOrigin+dest.length)。 */
export class PcmMixer {
  static mix(dest: Int16Array, destOrigin: number, src: Int16Array, srcOrigin: number, gain: number): void {
    const destEnd = destOrigin + dest.length;
    const srcEnd = srcOrigin + src.length;
    const start = Math.max(destOrigin, srcOrigin);
    const end = Math.min(destEnd, srcEnd);
    for (let frame = start; frame < end; frame++) {
      const di = frame - destOrigin;
      const si = frame - srcOrigin;
      const mixed = dest[di] + src[si] * gain;
      dest[di] = Math.max(-32768, Math.min(32767, Math.round(mixed)));
    }
  }

  static frameForTime(seconds: number, sampleRate: number): number {
    return Math.round(seconds * sampleRate);
  }
}
