# 🐰 小兔头节拍器 - 微信小程序

> 移植自网页版，同一产品多端支持。

**功能：** 三种音效模式（传统/均匀/童音）、6种节拍预设、自定义、BPM 40-208、配置持久化。

**目录结构：**
```
miniapp/
├── app.js / app.json / app.wxss   # 全局入口
├── pages/index/                    # 主页面
└── sounds/                         # 音频文件（打包用）
```

**快速开始：**
1. 在微信开发者工具导入本目录
2. 填入 AppID
3. `sounds/` 已本地打包，也可改用 CDN（见 `index.js` 注释）

**开发调试：**
- 音频 CDN 加载慢时，注释掉 `index.js` 中的 CDN 路径，改用 `assets/sounds/` 本地路径
- 小程序切后台会被暂停（平台限制）

**相关链接：**
- 网页版：https://jpq.weichao.studio/
- 仓库：https://github.com/toolazytoname/metronome
