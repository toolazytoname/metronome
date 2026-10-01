/**
 * 鸿蒙端文案：packages/strings/{zh,en}.json 的 cn 变体子集（无工坊/商店 key）。
 * 改 key 先改 packages/strings，再同步这里。
 */
export class Copy {
  static readonly zh: Map<string, string> = new Map<string, string>([
    ['app_name', '小兔头节拍器'],
    ['app_name_lead', '小兔头'],
    ['app_name_em', '节拍器'],
    ['tagline', '打开就能练 · 核心永久免费'],
    ['status_idle', '待开始'],
    ['status_playing', '正在播放'],
    ['bpm', 'BPM'],
    ['play', '播放'],
    ['pause', '暂停'],
    ['settings', '设置'],
    ['done', '完成'],
    ['sound_traditional', '传统'],
    ['sound_uniform', '均匀'],
    ['sound_voice', '童声'],
    ['volume', '音量'],
    ['sound_mode', '音效模式'],
    ['time_signature', '拍号'],
    ['sig_44', '四拍'],
    ['sig_34', '圆舞曲'],
    ['sig_24', '进行曲'],
    ['sig_68', '八六拍'],
    ['sig_54', '复合拍'],
    ['sig_78', '现代'],
    ['beats', '拍数'],
    ['beat_unit', '拍值'],
    ['language', '语言'],
    ['haptic', '震动拍'],
    ['keep_awake', '播放时保持亮屏'],
    ['custom_meter', '自定义'],
    ['play_error', '采样没加载好，先检查音量后再试'],
    ['samples_loading', '正在加载音色…'],
    ['support', '支持我们'],
    ['privacy', '隐私政策'],
    ['donate', '投喂打赏'],
    ['donate_title', '☕ 投喂打赏 · 持续更新动力'],
    ['donate_wechat', '微信打赏'],
    ['donate_alipay', '支付宝打赏'],
    ['donate_blurb', '打赏完全自愿，不解锁任何功能；所有功能永久免费。'],
    ['app_version', '版本 %s']
  ]);

  static readonly en: Map<string, string> = new Map<string, string>([
    ['app_name', 'Bunny Metronome'],
    ['app_name_lead', 'Bunny'],
    ['app_name_em', 'Metronome'],
    ['tagline', 'Open and practice · Core is free forever'],
    ['status_idle', 'Ready'],
    ['status_playing', 'Playing'],
    ['bpm', 'BPM'],
    ['play', 'Play'],
    ['pause', 'Pause'],
    ['settings', 'Settings'],
    ['done', 'Done'],
    ['sound_traditional', 'Traditional'],
    ['sound_uniform', 'Even'],
    ['sound_voice', 'Voice'],
    ['volume', 'Volume'],
    ['sound_mode', 'Sound mode'],
    ['time_signature', 'Time signature'],
    ['sig_44', 'Quarter'],
    ['sig_34', 'Waltz'],
    ['sig_24', 'March'],
    ['sig_68', 'Compound'],
    ['sig_54', 'Hybrid'],
    ['sig_78', 'Modern'],
    ['beats', 'Beats'],
    ['beat_unit', 'Beat unit'],
    ['language', 'Language'],
    ['haptic', 'Haptic beat'],
    ['keep_awake', 'Keep screen on while playing'],
    ['custom_meter', 'Custom'],
    ['play_error', 'Samples not loaded yet. Check volume and retry'],
    ['samples_loading', 'Loading sounds…'],
    ['support', 'Support us'],
    ['privacy', 'Privacy'],
    ['donate', 'Buy us a coffee'],
    ['donate_title', '☕ Tip jar · Keeps updates coming'],
    ['donate_wechat', 'WeChat tip'],
    ['donate_alipay', 'Alipay tip'],
    ['donate_blurb', 'Tips are voluntary and unlock nothing; everything stays free.'],
    ['app_version', 'Version %s']
  ]);

  static t(lang: string, key: string): string {
    const m = lang === 'en' ? Copy.en : Copy.zh;
    return m.get(key) ?? Copy.zh.get(key) ?? key;
  }
}
