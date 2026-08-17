# 🐰 小兔头节拍器 - 微信小程序

> 同款产品，微信内即用，无需打开浏览器。

## 功能

- 🎵 **三种音效模式**：传统（强/弱）、均匀、童音数拍（预渲染采样）
- 🔊 **音量**：10–100%，和 BPM / 拍号一起记住
- 🎼 **节拍预设**：4/4、3/4、2/4、6/8、5/4、7/8 + 自定义
- 📊 **BPM 范围**：40 - 208，滑块 + 步进调节
- 💾 **配置持久化**：BPM、拍号、音效模式自动记忆
- 🔊 **切后台自动停止**：符合微信小程序平台规范

## 目录结构

```
miniapp/
├── app.js / app.json / app.wxss     # 全局入口
├── assets/sounds/                    # 音频文件（本地打包）
│   ├── click-strong.mp3 / click-weak.mp3 / click-uniform.mp3
│   └── voice/zh|en/01.mp3 … 16.mp3   # 数拍采样
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
- 微信小程序音频路径相对于**小程序包根目录**
- 代码里用 `/assets/sounds/click-strong.mp3` 以及 `/assets/sounds/voice/{zh|en}/01.mp3`

**包体积：**
- click 3 条 + 中英数拍 32 条，总计约 80KB，远低于 2MB 限制
- 无需 CDN，完全本地打包

**计时精度：**
- 绝对时间 `setTimeout` 链（按目标时刻排下一拍，不是 `setInterval`）
- 微信切后台会暂停计时，这是平台限制，无法绕过

## 相关

- 🖥️ 网页版：https://jpq.weichao.studio/
- 📦 主仓库：https://github.com/toolazytoname/metronome
