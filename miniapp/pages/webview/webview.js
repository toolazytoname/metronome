// web-view 容器页：包一层外链，避免在主页面里直接渲染外部 URL
Page({
  data: {
    url: '',
  },
  onLoad(options) {
    if (options && options.url) {
      this.setData({ url: decodeURIComponent(options.url) });
    }
    // 标题：去掉域名尾巴
    const titleMap = {
      'jpq.weichao.studio/about#donate': '支持我们',
      'jpq.weichao.studio/about#donate': 'Support us',
    };
    const matched = titleMap[this.data.url];
    if (matched) {
      wx.setNavigationBarTitle({ title: matched });
    }
  },
});
