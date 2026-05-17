# 🚀 部署指南

## 🖥️ 网页版部署

网页版自动通过 Vercel 部署，每次推送到 `main` 分支会自动上线。

**在线地址：** https://jpq.weichao.studio/

---

## 📱 微信小程序部署

### 前置准备

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 在 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序，获取 AppID

### 第一步：配置 AppID

修改 `miniapp/project.config.json`，将 `YOUR_APPID_HERE` 替换为你的真实 AppID：

```json
{
  "appid": "wx1234567890abcdef",
  "projectname": "metronome-miniapp"
}
```

### 第二步：导入项目

1. 打开微信开发者工具
2. 点击「导入项目」
3. 选择 `miniapp/` 目录作为项目根目录
4. 填入 AppID
5. 点击「确定」

### 第三步：开发调试

- **模拟器**：左侧选择设备型号
- **真机调试**：点击「真机调试」→ 扫描二维码
- **编译模式**：建议选择「普通编译」，每次保存自动刷新

### 第四步：上传发布

1. 开发者工具右上角点击「上传」
2. 填写版本号（如 `1.0.0`）和备注
3. 登录 [微信公众平台](https://mp.weixin.qq.com/) → 管理版本
4. 提交审核（个人小程序通常 1-7 天）
5. 审核通过后点击「发布」

---

## ⚙️ Vercel 网页版配置（如需迁移）

Vercel 配置已存在（`vercel.json`），但需要手动在 Dashboard 添加忽略规则：

1. 登录 [Vercel Dashboard](https://vercel.com/)
2. 选择项目 → Settings → Git
3. 在 **Ignored Paths** 中添加：`miniapp/**`
4. 以后只有网页版文件变更会触发部署

---

## 🔧 本地开发

### 网页版

```bash
cd metronome
python3 -m http.server 8080
# 打开 http://localhost:8080
```

### 小程序（需安装微信开发者工具）

```bash
# 直接用开发者工具导入 miniapp/ 目录
```

---

## 📁 目录说明

```
metronome/
├── index.html              # 网页版入口
├── vercel.json             # Vercel 部署配置
├── miniapp/                # 微信小程序
│   ├── app.js              # 全局入口
│   ├── app.json            # 全局配置
│   ├── project.config.json # 开发者工具配置（需填入 AppID）
│   └── pages/index/        # 主页面
│       ├── index.js        # 核心逻辑（计时器、音频）
│       ├── index.wxml      # 页面结构
│       └── index.wxss      # 页面样式
└── assets/sounds/          # （仅供网页版使用）
```

---

## 🐛 常见问题

### 微信开发者工具报错「请先安装 Node.js」

小程序项目不需要 Node.js，纯 JS 文件可以直接运行。如遇此提示，在项目设置中关闭「编译 TypeScript」等选项。

### 音频首次播放有延迟

**已解决**：所有鼓点采样已本地打包在 `assets/sounds/`，无 CDN 依赖，首次播放无延迟。

### 推送到 GitHub 后 Vercel 没反应

Vercel 默认会部署整个仓库。请在 Vercel Dashboard → Settings → Git → **Ignored Paths** 添加 `miniapp/**`，这样只有网页版变更才会触发部署。

### 小程序审核被驳回

常见原因：
- 页面无实际内容（节拍器属工具类，正常）
- 音频文件过大（当前仅 3 个鼓点采样，总计 ~4KB，远低于限制）
- 缺少隐私协议弹窗（首次使用需获取用户信息时）

### 想添加新音效

1. 用 Audacity 或 ffmpeg 制作采样（建议 0.1-0.2 秒，MP3 格式）
2. 放入 `miniapp/assets/sounds/`
3. 在 `AudioManager.init()` 中注册新 key
4. 在 `_tick()` 中对应分支调用 `audioManager.play('your-key')`