// @ts-nocheck
// 小兔头节拍器 · 国际化文案
// 用法：const { getI18n } = require('../../utils/i18n')
//
// 注：WeChat 小程序 JS 引擎只支持 CommonJS（require/module.exports），
// 不支持 ES module 的 import/export。TypeScript 提示 "may be converted
// to an ES module" 在小程序环境是误报，文件顶部 @ts-nocheck 抑制。

const I18N = {
  zh: {
    title: '小兔头节拍器',
    subtitle: '微信小程序 · 永久免费',
    bpm: 'BPM',
    np_idle: '待开始',
    np_playing: '正在播放',
    np_paused: '已暂停',
    sm_traditional: '传统',
    sm_uniform: '均匀',
    settings: '设置',
    section_sound: '音效模式',
    section_beat: '节拍',
    section_custom: '自定义',
    apply: '应用',
    ts_labels: {
      '4/4': '四拍',
      '3/4': '圆舞曲',
      '2/4': '进行曲',
      '6/8': '八六拍',
      '5/4': '复合拍',
      '7/8': '现代',
    },
    donate_title: '支持我们',
    donate_desc: '如果小兔头陪你练过琴，欢迎去浏览器打开项目地址支持一下持续开发。',
    donate_btn_open: '在浏览器中打开',
    donate_btn_copy: '复制项目地址',
    donate_copied: '已复制，去浏览器粘贴吧',
    donate_tip: '小程序中不支持直接扫码支付，请到浏览器操作',
    silent_title: '听不到节拍？',
    silent_msg_part1: '把 iPhone 侧边的',
    silent_msg_em: '静音开关',
    silent_msg_part2: '推上来，或调高音量',
    info_title: '小兔头节拍器 · v2.2',
    info_content: [
      '使用提示：',
      '· 拖滑块或 ± 调节 BPM',
      '· 中央按钮开始 / 暂停',
      '· 展开「设置」切换音效和拍号',
      '',
      '听不到声音？',
      '检查 iPhone 侧边静音键',
      '',
      '网页版同步开放：',
      'jpq.weichao.studio',
      '',
      '永久免费 · MIT License',
    ].join('\n'),
    info_btn: '知道了',
    share_title: '小兔头节拍器 · 练琴节奏稳了',
    share_timeline: '小兔头节拍器 · 在线练琴神器',
    lang_btn: 'EN', // 按钮显示的"对面语言"
  },
  en: {
    title: 'Little Rabbit',
    subtitle: 'WeChat mini-program · Forever free',
    bpm: 'BPM',
    np_idle: 'Idle',
    np_playing: 'Playing',
    np_paused: 'Paused',
    sm_traditional: 'Traditional',
    sm_uniform: 'Steady',
    settings: 'Settings',
    section_sound: 'Sound Mode',
    section_beat: 'Beat',
    section_custom: 'Custom',
    apply: 'Apply',
    ts_labels: {
      '4/4': 'Four',
      '3/4': 'Waltz',
      '2/4': 'March',
      '6/8': 'Compound',
      '5/4': 'Quintuple',
      '7/8': 'Modern',
    },
    silent_title: 'No sound?',
    silent_msg_part1: 'Flip the ',
    silent_msg_em: 'silent switch',
    silent_msg_part2: ' on your iPhone, or turn up the volume',
    info_title: 'Little Rabbit Metronome · v2.2',
    info_content: [
      'How to use:',
      '· Drag slider or ± to adjust BPM',
      '· Center button to start / pause',
      '· Open "Settings" to switch sound & time sig',
      '',
      'No sound?',
      'Check the silent switch on your iPhone',
      '',
      'Also on web:',
      'jpq.weichao.studio',
      '',
      'Forever free · MIT License',
    ].join('\n'),
    info_btn: 'Got it',
    donate_title: 'Support us',
    donate_desc: 'If Little Rabbit helped your practice, pop over to a browser to support the ongoing development.',
    donate_btn_open: 'Open in browser',
    donate_btn_copy: 'Copy project URL',
    donate_copied: 'Copied — paste in a browser',
    donate_tip: 'In-app QR payment is restricted in mini-programs. Please use a browser.',
    share_title: 'Little Rabbit Metronome · steady tempo for practice',
    share_timeline: 'Little Rabbit Metronome · in-browser practice tool',
    lang_btn: '中',
  },
};

/**
 * @param {'zh'|'en'} lang
 * @returns {object} flat i18n map
 */
function getI18n(lang) {
  return I18N[lang] || I18N.zh;
}

/**
 * 检测设备首选语言（启发式：wx.getSystemInfoSync().language）
 * @returns {'zh'|'en'}
 */
function detectDefaultLang() {
  try {
    const sys = wx.getSystemInfoSync();
    const lang = (sys && sys.language) || '';
    if (lang.toLowerCase().indexOf('en') === 0) return 'en';
  } catch (e) {
    // ignore
  }
  return 'zh';
}

module.exports = {
  getI18n,
  detectDefaultLang,
};
