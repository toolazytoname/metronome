// web-view 容器页：包一层外链，避免在主页面里直接渲染外部 URL
// Keys must stay distinct (zh vs en donate URLs). Lookup is exact match
// on the decoded query url passed from onDonate.
var DONATE_TITLES = {
  'https://jpq.weichao.studio/about#donate': '支持我们',
  'https://jpq.weichao.studio/about/#donate': '支持我们',
  'https://jpq.weichao.studio/about/en#donate': 'Support us',
  'https://jpq.weichao.studio/about/en/#donate': 'Support us',
};

var FALLBACK_ZH = 'https://jpq.weichao.studio/about#donate';
var FALLBACK_EN = 'https://jpq.weichao.studio/about/en#donate';

function decodeQueryUrl(raw) {
  if (raw == null || raw === '') return '';
  try {
    return decodeURIComponent(String(raw));
  } catch (e) {
    return '';
  }
}

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

Page({
  data: {
    url: '',
    failed: false,
    failReason: '',
  },
  onLoad(options) {
    var url = decodeQueryUrl(options && options.url);
    if (!isHttpUrl(url)) {
      this._fail('invalid', url);
      return;
    }
    this.setData({ url: url, failed: false, failReason: '' });
    var title = DONATE_TITLES[url];
    if (title) {
      wx.setNavigationBarTitle({ title: title });
    }
  },
  onWebError() {
    this._fail('load', this.data.url);
  },
  _fail(reason, url) {
    var copyUrl = isHttpUrl(url) ? url : FALLBACK_ZH;
    var isEn = /\/about\/en/.test(copyUrl);
    this.setData({
      url: '',
      failed: true,
      failReason: reason || 'load',
      copyUrl: copyUrl,
      failTitle: isEn ? 'Could not open the support page' : '支持页打不开',
      failHint: isEn
        ? 'The in-app page failed to load. Copy the link and open it in a browser.'
        : '应用内网页加载失败。可复制链接，到浏览器打开。',
      copyLabel: isEn ? 'Copy link' : '复制链接',
    });
    try {
      wx.setNavigationBarTitle({ title: isEn ? 'Support us' : '支持我们' });
    } catch (e) { /* ignore */ }
  },
  onCopy() {
    var url = this.data.copyUrl || FALLBACK_ZH;
    wx.setClipboardData({
      data: url,
      success: function () {
        wx.showToast({ title: 'OK', icon: 'none', duration: 1600 });
      },
    });
  },
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decodeQueryUrl, isHttpUrl, DONATE_TITLES };
}
