// web-view 容器页：包一层外链，避免在主页面里直接渲染外部 URL
// Keys must stay distinct (zh vs en donate URLs). Lookup is exact match
// on the decoded query url passed from onDonate.
var DONATE_TITLES = {
  'https://jpq.weichao.studio/about#donate': '支持我们',
  'https://jpq.weichao.studio/about/#donate': '支持我们',
  'https://jpq.weichao.studio/about/en#donate': 'Support us',
  'https://jpq.weichao.studio/about/en/#donate': 'Support us',
};

Page({
  data: {
    url: '',
  },
  onLoad(options) {
    var url = '';
    if (options && options.url) {
      url = decodeURIComponent(options.url);
      this.setData({ url: url });
    }
    var title = DONATE_TITLES[url];
    if (title) {
      wx.setNavigationBarTitle({ title: title });
    }
  },
});
