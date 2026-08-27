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
├── index.html              # 网页版入口（留在仓库根）
├── vercel.json             # Vercel 部署配置
├── assets/sounds/          # 采样唯一来源（Web / 小程序 / 原生共用）
├── miniapp/                # 微信小程序（Vercel 忽略）
├── ios/                    # SwiftUI 参考实现（Vercel 忽略；上架清单见 AGENTS.md）
├── android/                # 按冻结说明书移植（Vercel 忽略）
├── AGENTS.md               # 多端规则 + 原生待办
└── docs/                   # 架构与契约
```

网页版变更才应触发 Vercel。Dashboard → Settings → Git → Ignored Paths 建议包含：`miniapp/**`、`ios/**`、`android/**`、`docs/**`。

---

## 🍎 iOS（TestFlight / 提审）

证书、Team ID、`Secrets.xcconfig` **不进 git**。CI 保持 `CODE_SIGNING_ALLOWED=NO`。

1. 本机用个人/公司 Team 打开 `ios/BunnyMetronome.xcodeproj`，把 Debug/Release 的签名改成 Automatic（不要提交这步）。
2. Scheme 已挂 `Configuration.storekit`，本地可测 IAP。
3. 真机过完 `AGENTS.md` N1.25–N1.30。
4. App Store Connect 建 App，Bundle ID `studio.weichao.jpq`。
5. 建非消耗型 IAP `studio.weichao.jpq.soundpack`。价格档对齐 ¥12 / $1.99。
6. 隐私营养：无账户、无跟踪（Analytics ≠ Tracking）。勾产品交互 + 设备 ID（应用实例，非 IDFA）。隐私 / 支持 URL 见 `docs/store/README.md`。
7. 截图按商店清单。审核备注也在那份文件。
8. Archive → 上传 → 内部 TestFlight → 提审。

## 🤖 Android（Play 内测 / 签名 APK）

Play **不是免费**。开发者账号一次性约 **US$25**，无年费。2023-11 之后的个人账号，生产轨还要先做封闭测试（至少 12 名测试者连续 14 天）。内部测试轨本身不收费。

功能面已按 iOS 冻结说明书对齐（含工坊震动）。视觉不 1:1 搬马卡龙，不挡内测。

### 自动出 GitHub Release 包

1. 推 tag：`git tag v2.1.0 && git push origin v2.1.0`
2. GitHub Actions `Native packages` 并行出：
   - Android：`:policy:test` + `assembleDebug`（有 keystore secrets 再加 `assembleRelease`）
   - iOS：`swift test` + iphoneos `CODE_SIGNING_ALLOWED=NO`，打成 **unsigned IPA**
3. tag 会建 GitHub Release 并挂上这些文件。`workflow_dispatch` 只出 artifact、不建 Release。
4. iOS unsigned IPA **不能**装真机，也 **不能** 传 App Store Connect。TestFlight 仍要本机发行证书 Archive。
5. 要签 **Android release** APK，把这些塞进 GitHub Secrets（**不要进 git**）：
   - `ANDROID_KEYSTORE_BASE64`（`.jks` 的 base64）
   - `ANDROID_STORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
6. 没有 keystore 时只出 debug APK，能装，不能上 Play。

不要自动把包传到 App Store / Play：证书、`.p8`、服务账号 JSON 不进仓库。Console 仍要你点一次。

官网 / GitHub 旁路安装的 APK **不要免费送工坊**。Play Billing 只在 Play 装的包上可靠。同包名禁止后门解锁。

### 本机 / Console

1. `cd android && ./gradlew :policy:test`
2. `./gradlew assembleDebug` 做功能核验。
3. Release 用本地 keystore 签（`*.jks` 不进 git）。
4. Play Console 建应用 `studio.weichao.jpq`，同一 SKU，内部测试轨先于生产。
5. Data safety：应用内活动 + Firebase 实例 ID，与 Google 共享；广告标识关闭。IAP 由 Google Play 处理。详见 `docs/store/README.md`。

### Firebase Analytics

控制台建项目，包名 / Bundle ID 都是 `studio.weichao.jpq`：

1. [Firebase Console](https://console.firebase.google.com) 加 Android + iOS App。
2. 把 `google-services.json` 放到 `android/app/`（有这个文件 Gradle 才应用 Google Services 插件）。
3. 把 `GoogleService-Info.plist` 放到 `ios/BunnyMetronome/`（已列入 Xcode 资源；占位文件里的 `YOUR_` 前缀会跳过初始化）。
4. 客户端配置可以进 git。不要提交 Firebase **Admin** 密钥。
5. 控制台关闭 Google Analytics 广告功能 / 数据共享（能关的都关）。App 里已关 ADID 采集。
6. 商店文案 / 截图见 `docs/store/README.md`。国内商店与软著不做。

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