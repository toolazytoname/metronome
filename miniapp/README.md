# 🐰 小兔头节拍器 - 微信小程序

> 同款产品，微信内即用，无需打开浏览器。

## 功能

- 🎵 **两种音效模式**：传统（强/弱）、均匀
- 🎼 **节拍预设**：4/4、3/4、2/4、6/8、5/4、7/8 + 自定义
- 📊 **BPM 范围**：40 - 208，滑块 + 步进调节
- 💾 **配置持久化**：BPM、拍号、音效模式自动记忆
- 🔊 **切后台自动停止**：符合微信小程序平台规范

## 目录结构

```
miniapp/
├── app.js / app.json / app.wxss     # 全局入口
├── assets/sounds/                    # 音频文件（本地打包）
│   ├── beat-strong.mp3               # 强拍（880Hz）
│   ├── beat-weak.mp3                  # 弱拍（440Hz）
│   └── beat-uniform.mp3               # 均匀拍（660Hz）
└── pages/index/                      # 主页面
    ├── index.wxml                    # 页面结构
    ├── index.wxss                    # 页面样式
    ├── index.js                      # 核心逻辑
    └── index.json                    # 页面配置
```

## 快速开始

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本目录（`miniapp/`）作为项目根目录
3. 填入你的小程序 AppID（个人 AppID 即可）
4. 点击"真机调试"在手机测试

## 开发说明

**音频路径：**
- `assets/sounds/` 中的音频在开发者工具和真机上都可用
- 微信小程序音频相对路径相对于**小程序包根目录**
- `pages/index/` 引用 `../../assets/sounds/beat-strong.mp3` 正确

**包体积：**
- 7 个音频文件总计约 13KB，远低于 2MB 限制
- 无需 CDN，完全本地打包

**计时精度：**
- 使用 `setInterval`（与原版网页一致）
- 微信切后台会暂停计时，这是平台限制，无法绕过
- 如需更高精度，可后续迁移到 `wx.createWorker` 或 `AudioContext`

## 相关

- 🖥️ 网页版：https://jpq.weichao.studio/
- 📦 主仓库：https://github.com/toolazytoname/metronome
