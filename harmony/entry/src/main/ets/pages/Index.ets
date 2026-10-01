/**
 * 鸿蒙练琴屏（cn 变体）：完整免费 + 打赏入口，无音色工坊、无内购。
 * 只竖屏。时钟在 ClockWorker（音频时间线），本页只做 UI / 偏好 / 震动 / 亮屏 / 后台任务。
 */
import { worker } from '@kit.ArkTS';
import { vibrator } from '@kit.SensorServiceKit';
import { window } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { backgroundTaskManager } from '@kit.BackgroundTasksKit';
import { bundleManager } from '@kit.AbilityKit';
import { dataPreferences } from '@kit.ArkData';
import { i18n } from '@kit.LocalizationKit';
import { Copy } from '../store/Copy';
import { MetronomePolicy, MetronomePrefs } from '../engine/Policy';

const BG = '#FDF7F1';
const SURFACE = '#FFFFFF';
const INK = '#251E1A';
const MUTED = '#8C7D73';
const BORDER = '#EEE3DB';
const CORAL = '#E07A6A';
const CORAL_DEEP = '#B85147';
const CORAL_SOFT = '#FAECE8';
const MINT_SOFT = '#EBFAF0';
const MINT_DEEP = '#2E7A66';
const LEMON_SOFT = '#FCF2D1';
const LEMON_DEEP = '#856B1A';
const LAVENDER_SOFT = '#F5F0FA';
const LAVENDER_DEEP = '#5C477D';
const IDLE_BTN = '#D1C7BD';

interface SigPreset {
  bc: number;
  bu: number;
  label: string;
}

class ChipStyle {
  bg: string = SURFACE;
  fg: string = MUTED;
}

@Entry
@Component
struct Index {
  @State bpm: number = 120;
  @State bc: number = 4;
  @State bu: number = 4;
  @State sm: string = 'uniform';
  @State vol: number = 85;
  @State lang: string = 'zh';
  @State haptic: boolean = false;
  @State keepAwake: boolean = true;
  @State playing: boolean = false;
  @State activeBeat: number = -1;
  @State samplesReady: boolean = false;
  @State loadFailed: boolean = false;
  @State loading: boolean = true;
  @State message: string = '';
  @State settingsOpen: boolean = false;
  @State donateOpen: boolean = false;
  @State versionName: string = '';
  private clock: worker.ThreadWorker | null = null;
  private sentSamples = 0;
  private totalSamples = 0;
  private prefsStore: dataPreferences.Preferences | null = null;
  private bgTaskOn = false;

  t(key: string): string {
    return Copy.t(this.lang, key);
  }

  aboutToAppear(): void {
    this.init();
  }

  aboutToDisappear(): void {
    this.stopClock();
    if (this.clock !== null) {
      this.clock.terminate();
      this.clock = null;
    }
  }

  private async init(): Promise<void> {
    const ui = this.getUIContext();
    const context = ui.getHostContext()!;
    try {
      this.prefsStore = await dataPreferences.getPreferences(context, 'metronome_store');
      const raw = this.prefsStore.getSync('metronome', '') as string;
      const prefs = MetronomePrefs.fromRecord(raw === '' ? {} : JSON.parse(raw) as Record<string, Object>);
      if (raw === '') {
        prefs.lang = i18n.System.getSystemLanguage().startsWith('zh') ? 'zh' : 'en';
      }
      this.applyPrefs(prefs);
    } catch (_) {
      this.applyPrefs(new MetronomePrefs());
    }
    try {
      const info = await bundleManager.getBundleInfoForSelf(bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_BASE_INFO);
      this.versionName = info.versionName;
    } catch (_) {
      this.versionName = '';
    }
    this.startWorkerAndLoad();
    this.pushConfig();
  }

  private applyPrefs(p: MetronomePrefs): void {
    this.bpm = p.bpm;
    this.bc = p.bc;
    this.bu = p.bu;
    this.sm = p.sm;
    this.vol = p.vol;
    this.lang = p.lang;
    this.haptic = p.haptic;
    this.keepAwake = p.keepAwake;
  }

  private prefsObject(): MetronomePrefs {
    const p = new MetronomePrefs();
    p.bpm = this.bpm;
    p.bc = this.bc;
    p.bu = this.bu;
    p.sm = this.sm;
    p.vol = this.vol;
    p.lang = this.lang;
    p.haptic = this.haptic;
    p.keepAwake = this.keepAwake;
    return p;
  }

  private savePrefs(): void {
    if (this.prefsStore === null) {
      return;
    }
    this.prefsStore.put('metronome', JSON.stringify(this.prefsObject().toRecord()));
  }

  private startWorkerAndLoad(): void {
    if (this.clock === null) {
      this.clock = new worker.ThreadWorker('entry/ets/engine/ClockWorker.ets');
      this.clock.onmessage = (e) => {
        const m = e.data as Record<string, Object>;
        const t = m['t'] as string;
        if (t === 'ready') {
          const ok = m['ok'] as boolean;
          if (ok) {
            this.samplesReady = true;
            this.loadFailed = false;
            this.loading = false;
          } else if (this.sentSamples >= this.totalSamples) {
            this.loading = false;
            this.loadFailed = true;
          }
        } else if (t === 'beat') {
          this.activeBeat = m['index'] as number;
          if (this.haptic) {
            this.pulse(m['index'] as number === 0);
          }
        } else if (t === 'died') {
          this.playing = false;
          this.activeBeat = -1;
          this.loading = false;
          this.message = this.t('play_error');
          this.setKeepScreen(false);
          this.stopBgTask();
        }
      };
      this.clock.onerror = () => {
        this.playing = false;
        this.activeBeat = -1;
        this.message = this.t('play_error');
        this.stopBgTask();
      };
    }
    this.loading = true;
    this.loadFailed = false;
    this.sentSamples = 0;
    const names: string[] = ['click-strong', 'click-weak', 'click-uniform'];
    for (const l of ['zh', 'en']) {
      for (let i = 1; i <= 16; i++) {
        names.push(`voice/${l}/${i < 10 ? '0' + i : i}`);
      }
    }
    this.totalSamples = names.length;
    const ui = this.getUIContext();
    const context = ui.getHostContext()!;
    for (const n of names) {
      context.resourceManager.getRawFileContent(`sounds/${n}.wav`).then((bytes: Uint8Array) => {
        if (this.clock === null) {
          return;
        }
        const copyBuf = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(copyBuf).set(bytes);
        const msg: Record<string, Object> = { t: 'sample', name: n, data: copyBuf };
        this.clock.postMessage(msg, [copyBuf]);
        this.sentSamples += 1;
        if (this.sentSamples >= this.totalSamples && !this.samplesReady) {
          this.loading = false;
          this.loadFailed = true;
        }
      }).catch(() => {
        this.sentSamples += 1;
        if (this.sentSamples >= this.totalSamples && !this.samplesReady) {
          this.loading = false;
          this.loadFailed = true;
        }
      });
    }
  }

  private pushConfig(): void {
    if (this.clock === null) {
      return;
    }
    const msg: Record<string, Object> = {
      t: 'config', bpm: this.bpm, bc: this.bc, sm: this.sm, lang: this.lang, vol: this.vol
    };
    this.clock.postMessage(msg);
    this.savePrefs();
  }

  private toggle(): void {
    if (this.playing) {
      this.stopClock();
      return;
    }
    if (this.loadFailed || !this.samplesReady) {
      this.message = this.t('play_error');
      if (this.loadFailed) {
        this.startWorkerAndLoad();
      }
      return;
    }
    if (this.loading) {
      this.message = this.t('samples_loading');
      return;
    }
    this.pushConfig();
    this.clock?.postMessage({ t: 'start' } as Record<string, Object>);
    this.playing = true;
    this.message = '';
    this.startBgTask();
    this.setKeepScreen(this.keepAwake);
  }

  private stopClock(): void {
    this.clock?.postMessage({ t: 'stop' } as Record<string, Object>);
    this.playing = false;
    this.activeBeat = -1;
    this.setKeepScreen(false);
    this.stopBgTask();
  }

  private pulse(strong: boolean): void {
    try {
      vibrator.startVibration({
        type: 'time',
        count: 1,
        duration: strong ? 28 : 12
      } as vibrator.VibratePreset, { usage: 'touch' } as vibrator.VibrateAttribute);
    } catch (_) {
    }
  }

  private setKeepScreen(on: boolean): void {
    const ui = this.getUIContext();
    const context = ui.getHostContext()!;
    window.getLastWindow(context).then((w) => {
      w.setWindowKeepScreenOn(on);
    }).catch((_e: BusinessError) => {
    });
  }

  private startBgTask(): void {
    const ui = this.getUIContext();
    const context = ui.getHostContext()!;
    try {
      const r = backgroundTaskManager.startBackgroundRunning(context,
        backgroundTaskManager.BackgroundMode.AUDIO_PLAYBACK);
      r.then(() => {
        this.bgTaskOn = true;
      }).catch((_e: BusinessError) => {
      });
    } catch (_) {
    }
  }

  private stopBgTask(): void {
    if (!this.bgTaskOn) {
      return;
    }
    const ui = this.getUIContext();
    const context = ui.getHostContext()!;
    try {
      backgroundTaskManager.stopBackgroundRunning(context);
    } catch (_) {
    }
    this.bgTaskOn = false;
  }

  private openUrl(path: string): void {
    const url = `https://jpq.weichao.studio${this.lang === 'en' ? '/en' : ''}${path}`;
    const ui = this.getUIContext();
    const context = ui.getHostContext()!;
    try {
      context.openLink(url);
    } catch (_) {
    }
  }

  private setMode(m: string): void {
    this.sm = m;
    this.pushConfig();
  }

  private setSignature(bc: number, bu: number): void {
    this.bc = MetronomePolicy.clampBeats(bc);
    this.bu = MetronomePolicy.clampBeatUnit(bu);
    this.pushConfig();
  }

  private nudgeBpm(delta: number): void {
    this.bpm = MetronomePolicy.clampBpm(this.bpm + delta);
    this.pushConfig();
  }

  private nudgeBeats(delta: number): void {
    this.bc = MetronomePolicy.clampBeats(this.bc + delta);
    this.pushConfig();
  }

  private beatRows(): number[][] {
    const rows: number[][] = [];
    for (let i = 0; i < this.bc; i += MetronomePolicy.BEAT_ROW_MAX) {
      const row: number[] = [];
      for (let j = i; j < Math.min(i + MetronomePolicy.BEAT_ROW_MAX, this.bc); j++) {
        row.push(j);
      }
      rows.push(row);
    }
    return rows;
  }

  private sigPresets(): SigPreset[] {
    return [
      { bc: 4, bu: 4, label: this.t('sig_44') },
      { bc: 3, bu: 4, label: this.t('sig_34') },
      { bc: 2, bu: 4, label: this.t('sig_24') },
      { bc: 6, bu: 8, label: this.t('sig_68') },
      { bc: 5, bu: 4, label: this.t('sig_54') },
      { bc: 7, bu: 8, label: this.t('sig_78') }
    ];
  }

  private modeChipStyle(m: string): ChipStyle {
    const s = new ChipStyle();
    const on = this.sm === m;
    if (on) {
      if (m === 'traditional') {
        s.bg = LEMON_SOFT;
        s.fg = LEMON_DEEP;
      } else if (m === 'uniform') {
        s.bg = MINT_SOFT;
        s.fg = MINT_DEEP;
      } else {
        s.bg = LAVENDER_SOFT;
        s.fg = LAVENDER_DEEP;
      }
    }
    return s;
  }

  @Builder
  beatDot(index: number) {
    Circle({ width: 24, height: 24 })
      .fill(this.playing && this.activeBeat === index ? CORAL : CORAL_SOFT)
      .stroke(this.playing && this.activeBeat === index ? CORAL_DEEP : BORDER)
      .strokeWidth(1.5)
  }

  @Builder
  chip(label: string, on: boolean, onTap: () => void, onBg: string, onFg: string) {
    Text(label)
      .fontSize(14)
      .fontColor(on ? onFg : MUTED)
      .padding({ left: 14, right: 14, top: 8, bottom: 8 })
      .backgroundColor(on ? onBg : SURFACE)
      .borderRadius(18)
      .border({ width: 1, color: on ? onFg : BORDER })
      .onClick(() => onTap())
  }

  @Builder
  toggleRow(label: string, isOn: boolean, onChange: (v: boolean) => void) {
    Row({ space: 10 }) {
      Text(label)
        .fontSize(15)
        .fontColor(INK)
        .layoutWeight(1)
      Toggle({ type: ToggleType.Switch, isOn: isOn })
        .selectedColor(CORAL)
        .onChange((v: boolean) => onChange(v))
    }
    .width('100%')
    .padding({ top: 10, bottom: 10 })
  }

  build() {
    Stack() {
      Column() {
        // 顶栏
          Row({ space: 10 }) {
            Image($r('app.media.app_icon'))
            .width(36)
            .height(36)
            .borderRadius(10)
          Column({ space: 1 }) {
            Row({ space: 4 }) {
              Text(this.t('app_name_lead'))
                .fontSize(17)
                .fontWeight(FontWeight.Bold)
                .fontColor(INK)
              Text(this.t('app_name_em'))
                .fontSize(17)
                .fontWeight(FontWeight.Bold)
                .fontColor(CORAL_DEEP)
            }
            Text(this.t('tagline'))
              .fontSize(11)
              .fontColor(MUTED)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text('⚙')
            .fontSize(22)
            .fontColor(MUTED)
            .padding(8)
            .onClick(() => {
              this.settingsOpen = true;
            })
        }
        .width('100%')
        .padding({ left: 20, right: 12, top: 14, bottom: 6 })

        // 状态
        Text(this.playing ? this.t('status_playing') : this.t('status_idle'))
          .fontSize(12)
          .fontColor(this.playing ? CORAL_DEEP : MUTED)
          .padding({ left: 12, right: 12, top: 4, bottom: 4 })
          .backgroundColor(this.playing ? CORAL_SOFT : SURFACE)
          .borderRadius(12)
          .margin({ top: 6 })

        // 大 BPM
        Column({ space: 2 }) {
          Text(`${this.bpm}`)
            .fontSize(88)
            .fontWeight(FontWeight.Bold)
            .fontColor(INK)
          Text(this.t('bpm'))
            .fontSize(13)
            .fontColor(MUTED)
        }
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)

        // 豆子：每行最多 4 个，居中，空位不占位
        Column({ space: 16 }) {
          ForEach(this.beatRows(), (row: number[]) => {
            Row({ space: 18 }) {
              ForEach(row, (i: number) => {
                this.beatDot(i)
              }, (i: number) => `${i}`)
            }
            .justifyContent(FlexAlign.Center)
          }, (row: number[], idx: number) => `${idx}-${row.length}`)
        }

        // BPM 滑块 + ±
        Row({ space: 14 }) {
          Text('−')
            .fontSize(24)
            .fontColor(this.bpm <= MetronomePolicy.MIN_BPM ? BORDER : CORAL_DEEP)
            .padding(8)
            .onClick(() => this.nudgeBpm(-1))
          Slider({ value: this.bpm, min: MetronomePolicy.MIN_BPM, max: MetronomePolicy.MAX_BPM, step: 1 })
            .layoutWeight(1)
            .blockColor(CORAL)
            .selectedColor(CORAL_SOFT)
            .trackColor(BORDER)
            .onChange((v: number) => {
              this.bpm = MetronomePolicy.clampBpm(v);
              this.pushConfig();
            })
          Text('+')
            .fontSize(24)
            .fontColor(this.bpm >= MetronomePolicy.MAX_BPM ? BORDER : CORAL_DEEP)
            .padding(8)
            .onClick(() => this.nudgeBpm(1))
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 26 })

        // 播放
        Text(this.playing ? '⏸' : '▶')
          .fontSize(34)
          .fontColor('#FFFFFF')
          .textAlign(TextAlign.Center)
          .width(84)
          .height(84)
          .borderRadius(42)
          .backgroundColor(this.playing ? CORAL : IDLE_BTN)
          .margin({ top: 22, bottom: 6 })
          .onClick(() => this.toggle())

        if (this.message !== '') {
          Text(this.message)
            .fontSize(12)
            .fontColor(CORAL_DEEP)
            .padding(6)
        }
        if (this.loading && !this.samplesReady) {
          Text(this.t('samples_loading'))
            .fontSize(12)
            .fontColor(MUTED)
            .padding(4)
        }

        // 底栏：模式 + 拍号
        Column({ space: 10 }) {
          Row({ space: 8 }) {
            ForEach(['traditional', 'uniform', 'voice'], (m: string) => {
              Text(this.t(m === 'traditional' ? 'sound_traditional' : m === 'uniform' ? 'sound_uniform' : 'sound_voice'))
                .fontSize(13)
                .fontColor(this.modeChipStyle(m).fg)
                .padding({ left: 14, right: 14, top: 7, bottom: 7 })
                .backgroundColor(this.modeChipStyle(m).bg)
                .borderRadius(16)
                .border({ width: 1, color: this.sm === m ? this.modeChipStyle(m).fg : BORDER })
                .onClick(() => this.setMode(m))
            }, (m: string) => m)
          }
          Row({ space: 8 }) {
            ForEach(this.sigPresets(), (p: SigPreset) => {
              Text(`${p.bc}/${p.bu}`)
                .fontSize(13)
                .fontColor(this.bc === p.bc && this.bu === p.bu ? CORAL_DEEP : MUTED)
                .padding({ left: 12, right: 12, top: 6, bottom: 6 })
                .backgroundColor(this.bc === p.bc && this.bu === p.bu ? CORAL_SOFT : SURFACE)
                .borderRadius(14)
                .border({ width: 1, color: this.bc === p.bc && this.bu === p.bu ? CORAL_DEEP : BORDER })
                .onClick(() => this.setSignature(p.bc, p.bu))
            }, (p: SigPreset) => `${p.bc}/${p.bu}`)
          }
        }
        .margin({ top: 10, bottom: 18 })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(BG)

      // 设置页（整页覆盖）
      if (this.settingsOpen) {
        Column() {
          Row() {
            Text('‹')
              .fontSize(26)
              .fontColor(MUTED)
              .padding({ left: 12, right: 12, top: 6, bottom: 6 })
              .onClick(() => {
                this.settingsOpen = false;
              })
            Text(this.t('settings'))
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor(INK)
              .layoutWeight(1)
            Text(this.t('done'))
              .fontSize(15)
              .fontColor(CORAL_DEEP)
              .padding(10)
              .onClick(() => {
                this.settingsOpen = false;
              })
          }
          .width('100%')

          Scroll() {
            Column({ space: 4 }) {
              Column({ space: 10 }) {
                Text(this.t('sound_mode'))
                  .fontSize(13)
                  .fontColor(MUTED)
                  .alignSelf(ItemAlign.START)
                Row({ space: 8 }) {
                  ForEach(['traditional', 'uniform', 'voice'], (m: string) => {
                    this.chip(
                      this.t(m === 'traditional' ? 'sound_traditional' : m === 'uniform' ? 'sound_uniform' : 'sound_voice'),
                      this.sm === m,
                      () => this.setMode(m),
                      this.modeChipStyle(m).bg,
                      this.modeChipStyle(m).fg)
                  }, (m: string) => m)
                }
              }
              .width('100%')
              .padding({ top: 14, bottom: 14 })

              Column({ space: 10 }) {
                Text(this.t('time_signature'))
                  .fontSize(13)
                  .fontColor(MUTED)
                  .alignSelf(ItemAlign.START)
                Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
                  ForEach(this.sigPresets(), (p: SigPreset) => {
                    Text(`${p.bc}/${p.bu} · ${p.label}`)
                      .fontSize(13)
                      .fontColor(this.bc === p.bc && this.bu === p.bu ? CORAL_DEEP : MUTED)
                      .padding({ left: 12, right: 12, top: 7, bottom: 7 })
                      .backgroundColor(this.bc === p.bc && this.bu === p.bu ? CORAL_SOFT : SURFACE)
                      .borderRadius(15)
                      .border({ width: 1, color: this.bc === p.bc && this.bu === p.bu ? CORAL_DEEP : BORDER })
                      .margin(4)
                      .onClick(() => this.setSignature(p.bc, p.bu))
                  }, (p: SigPreset) => `${p.bc}/${p.bu}`)
                }
                Row({ space: 12 }) {
                  Text(`${this.t('beats')} (${MetronomePolicy.MIN_BEATS}–${MetronomePolicy.MAX_BEATS})`)
                    .fontSize(13)
                    .fontColor(MUTED)
                    .layoutWeight(1)
                  Text('−')
                    .fontSize(20)
                    .fontColor(this.bc <= MetronomePolicy.MIN_BEATS ? BORDER : CORAL_DEEP)
                    .padding({ left: 10, right: 10 })
                    .onClick(() => this.nudgeBeats(-1))
                  Text(`${this.bc}`)
                    .fontSize(17)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(INK)
                    .width(34)
                    .textAlign(TextAlign.Center)
                  Text('+')
                    .fontSize(20)
                    .fontColor(this.bc >= MetronomePolicy.MAX_BEATS ? BORDER : CORAL_DEEP)
                    .padding({ left: 10, right: 10 })
                    .onClick(() => this.nudgeBeats(1))
                }
              }
              .width('100%')
              .padding({ top: 14, bottom: 14 })

              Column({ space: 10 }) {
                Text(this.t('volume'))
                  .fontSize(13)
                  .fontColor(MUTED)
                  .alignSelf(ItemAlign.START)
                Row({ space: 10 }) {
                  Slider({ value: this.vol, min: 10, max: 100, step: 1 })
                    .layoutWeight(1)
                    .blockColor(CORAL)
                    .selectedColor(CORAL_SOFT)
                    .trackColor(BORDER)
                    .onChange((v: number) => {
                      this.vol = MetronomePolicy.clampVolume(v);
                      this.pushConfig();
                    })
                  Text(`${this.vol}`)
                    .fontSize(15)
                    .fontColor(INK)
                    .width(34)
                    .textAlign(TextAlign.Center)
                }
              }
              .width('100%')
              .padding({ top: 14, bottom: 14 })

              Column({ space: 10 }) {
                Text(this.t('language'))
                  .fontSize(13)
                  .fontColor(MUTED)
                  .alignSelf(ItemAlign.START)
                Row({ space: 8 }) {
                  this.chip('中文', this.lang === 'zh', () => {
                    this.lang = 'zh';
                    this.pushConfig();
                  }, CORAL_SOFT, CORAL_DEEP)
                  this.chip('English', this.lang === 'en', () => {
                    this.lang = 'en';
                    this.pushConfig();
                  }, CORAL_SOFT, CORAL_DEEP)
                }
              }
              .width('100%')
              .padding({ top: 14, bottom: 14 })

              Divider().color(BORDER).margin({ top: 8, bottom: 4 })

              this.toggleRow(this.t('haptic'), this.haptic, (v: boolean) => {
                this.haptic = v;
                this.pushConfig();
              })
              this.toggleRow(this.t('keep_awake'), this.keepAwake, (v: boolean) => {
                this.keepAwake = v;
                this.pushConfig();
                if (this.playing) {
                  this.setKeepScreen(v);
                }
              })

              Divider().color(BORDER).margin({ top: 8, bottom: 4 })

              // 投喂打赏（cn 变体专属；纯自愿不解锁任何功能）
              Row({ space: 10 }) {
                Text(this.t('donate'))
                  .fontSize(15)
                  .fontColor(CORAL_DEEP)
                  .layoutWeight(1)
                Text('›')
                  .fontSize(20)
                  .fontColor(MUTED)
              }
              .width('100%')
              .padding({ top: 12, bottom: 12 })
              .onClick(() => {
                this.donateOpen = true;
              })

              Row({ space: 10 }) {
                Text(this.t('support'))
                  .fontSize(15)
                  .fontColor(INK)
                  .layoutWeight(1)
                Text('›')
                  .fontSize(20)
                  .fontColor(MUTED)
              }
              .width('100%')
              .padding({ top: 12, bottom: 12 })
              .onClick(() => this.openUrl('/support'))

              Row({ space: 10 }) {
                Text(this.t('privacy'))
                  .fontSize(15)
                  .fontColor(INK)
                  .layoutWeight(1)
                Text('›')
                  .fontSize(20)
                  .fontColor(MUTED)
              }
              .width('100%')
              .padding({ top: 12, bottom: 12 })
              .onClick(() => this.openUrl('/privacy'))

              if (this.versionName !== '') {
                Text(this.t('app_version').replace('%s', this.versionName))
                  .fontSize(12)
                  .fontColor(MUTED)
                  .opacity(0.7)
                  .margin({ top: 18, bottom: 24 })
              }
            }
            .width('100%')
            .padding({ left: 20, right: 20 })
          }
          .layoutWeight(1)
          .scrollBar(BarState.Off)
        }
        .width('100%')
        .height('100%')
        .backgroundColor(BG)
      }

      // 打赏弹层
      if (this.donateOpen) {
        Column({ space: 16 }) {
          Text(this.t('donate_title'))
            .fontSize(17)
            .fontWeight(FontWeight.Bold)
            .fontColor(INK)
          Text(this.t('donate_blurb'))
            .fontSize(12)
            .fontColor(MUTED)
            .textAlign(TextAlign.Center)
          Row({ space: 24 }) {
            Column({ space: 8 }) {
              Image($rawfile('qr-wechat.jpg'))
                .width(150)
                .height(150)
                .borderRadius(12)
                .objectFit(ImageFit.Contain)
                .backgroundColor(SURFACE)
              Text(this.t('donate_wechat'))
                .fontSize(13)
                .fontColor(INK)
            }
            Column({ space: 8 }) {
              Image($rawfile('qr-alipay.jpg'))
                .width(150)
                .height(150)
                .borderRadius(12)
                .objectFit(ImageFit.Contain)
                .backgroundColor(SURFACE)
              Text(this.t('donate_alipay'))
                .fontSize(13)
                .fontColor(INK)
            }
          }
          Text(this.t('done'))
            .fontSize(15)
            .fontColor(CORAL_DEEP)
            .padding({ top: 10, bottom: 10, left: 24, right: 24 })
            .backgroundColor(CORAL_SOFT)
            .borderRadius(18)
            .onClick(() => {
              this.donateOpen = false;
            })
        }
        .width('92%')
        .padding(24)
        .backgroundColor(SURFACE)
        .borderRadius(24)
        .shadow({ radius: 24, color: 'rgba(37,30,26,0.18)' })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(BG)
  }

  onBackPress(): boolean {
    if (this.donateOpen) {
      this.donateOpen = false;
      return true;
    }
    if (this.settingsOpen) {
      this.settingsOpen = false;
      return true;
    }
    return false;
  }
}
