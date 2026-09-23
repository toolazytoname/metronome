# 🚀 部署指南

## 🖥️ 网页版部署

网页版自动通过 Vercel 部署，每次推送到 `main` 分支会自动上线。

**在线地址：** https://jpq.weichao.studio/

### 改 js/ 或采样时必须同步的事（缓存一致性）

- `sw.js` 的 `CACHE` 常量 bump 一版（`xiaotutou-v8` → `v9`…）。HTML 是 network-first，但 JS/采样走 SW 缓存优先——**不 bump 就是新 HTML 配旧 JS/旧采样**，且旧缓存无过期时间。
- 同步改 `scripts/test_sw_fetch.js` 里的 `CACHE` 断言（CI 会跑）。
- 采样（`assets/sounds/`）属于 precache + runtime 缓存，改文件同样要 bump。
- `/download/*`（官网 APK）在 `sw.js` 里**整段绕过 SW**：固定文件名内容会更新，绝不能进缓存优先分支。新增任何「同名换内容」的下载文件都要走 `/download/` 前缀。

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

### 第二步：安装 npm 依赖并构建

干净环境（新克隆或 CI）必须先装依赖，再让开发者工具构建 npm。`app.js` 顶层 `import 'umtrack-wx'`，不走这一步真机/预览会失败。

```bash
cd miniapp
npm ci
```

然后用微信开发者工具打开 `miniapp/`：

1. 工具 → 构建 npm（生成 `miniprogram_npm/`）
2. 基准基础库以仓库里的 `miniapp/project.config.json` 为准（当前 `libVersion` **3.4.6**）。本机 `project.private.config.json` 可能不同，那是本地覆盖，不要当成发布基准，也不要为了对齐去删别人的 private 配置
3. 当前个人主体不使用 `web-view`，支持区只复制网站链接，无需为此配置业务域名。网络请求仍按 request 等服务器域名要求配置；本地关闭 `urlCheck` 不能替代真机 / 正式版验证

### 第三步：导入项目

1. 打开微信开发者工具
2. 点击「导入项目」
3. 选择 `miniapp/` 目录作为项目根目录
4. 填入 AppID
5. 点击「确定」

### 第四步：开发调试

- **模拟器**：左侧选择设备型号
- **真机调试**：点击「真机调试」→ 扫描二维码
- **编译模式**：建议选择「普通编译」，每次保存自动刷新

### 第五步：上传发布

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
cd miniapp && npm ci
# 用开发者工具导入 miniapp/，然后：工具 → 构建 npm
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

证书、Team ID、`Secrets.xcconfig` **不进 git**。CI 保持 `CODE_SIGNING_ALLOWED=NO`。CI 出的 unsigned IPA **不能**装真机、也不能传 App Store Connect。

商店名称、副标题、关键词、描述、隐私营养点选项、IAP 字段、审核备注、6.9" 截图路径：见 `docs/store/README.md`「App Store Connect 粘贴稿」。

1. 本机用个人/公司 Team 打开 `ios/BunnyMetronome.xcodeproj`，把 Debug/Release 的签名改成 Automatic（不要提交这步）。
2. Scheme 已挂 `Configuration.storekit`，本地可测 IAP。
3. 真机过完 `AGENTS.md` N1.25–N1.30。
4. App Store Connect 建 App，Bundle ID `studio.weichao.jpq`，**iPhone + iPad 通用**（`TARGETED_DEVICE_FAMILY = "1,2"`，2026-09-22 起）。
5. 先签付费协议 + 税务/银行，再建非消耗型 IAP `studio.weichao.jpq.soundpack`。价格档对齐 ¥12 / $1.99。第一个 IAP 必须跟这一版 App 一起送审。
6. 隐私营养：无账户、无跟踪（Analytics ≠ Tracking）。勾产品交互 + 设备 ID（应用实例，非 IDFA）。出口合规选否（工程已 `ITSAppUsesNonExemptEncryption = NO`）。
7. 截图上传 iPhone 6.9"（1320×2868）四张 `docs/store/screenshots/ios-*.png` + **iPad 13"（2064×2752）三张 `ipad-*.png`（通用 App 必传，缺了 Guideline 4 再拒）**。
8. Archive → 上传 → 内部 TestFlight → 过完真机清单再提审。

## 🤖 Android（Play 内测 / 签名 APK）

Play **不是免费**。开发者账号一次性约 **US$25**，无年费。2023-11 之后的个人账号，生产轨还要先做封闭测试（至少 12 名测试者连续 14 天）。内部测试轨本身不收费。

功能面已按 iOS 冻结说明书对齐（含工坊震动）。视觉不 1:1 搬马卡龙，不挡内测。

2026-08-31 起 Play **新应用必须 `targetSdk` 36**（Android 16）。工程已是 `compileSdk` / `targetSdk` 36。新应用上传 **AAB**，不要传 APK。

### 自动出 GitHub Release 包

1. 推 tag：`git tag v2.1.0 && git push origin v2.1.0`
2. GitHub Actions `Native packages` 并行出：
   - Android：`:policy:test` + `assemblePlayDebug`（有 keystore secrets 再加 `assemblePlayRelease` + `bundlePlayRelease`）
   - iOS：`swift test` + iphoneos `CODE_SIGNING_ALLOWED=NO`，打成 **unsigned IPA**
3. tag 会建 GitHub Release 并挂上这些文件。`workflow_dispatch` 只出 artifact、不建 Release。
4. iOS unsigned IPA **不能**装真机，也 **不能** 传 App Store Connect。TestFlight 仍要本机发行证书 Archive。
5. 要签 **Android release** APK / AAB，把这些塞进 GitHub Secrets（**不要进 git**）：
   - `ANDROID_KEYSTORE_BASE64`（`.jks` 的 base64）
   - `ANDROID_STORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
6. 没有 keystore 时只出 debug APK，能装，不能上 Play。有 keystore 时 AAB 才是传 Console 的那份。

不要自动把包传到 App Store / Play：证书、`.p8`、服务账号 JSON 不进仓库。Console 仍要你点一次。

官网 / GitHub 旁路安装的 APK **不要免费送工坊**。Play Billing 只在 Play 装的包上可靠。同包名禁止后门解锁。

### 本机 / Console

1. `cd android && ./gradlew :policy:test`
2. `./gradlew assemblePlayDebug`（Play 变体）或 `assembleCnDebug`（国内/官网变体）做功能核验。
3. Release / Play 用本地 keystore 签（`*.jks` 不进 git）：

   ```bash
   export ANDROID_KEYSTORE_PATH=/absolute/path/to/release.jks
   export ANDROID_STORE_PASSWORD=...
   export ANDROID_KEY_ALIAS=...
   export ANDROID_KEY_PASSWORD=...
   cd android && ./gradlew :app:bundlePlayRelease
   # 产物：android/app/build/outputs/bundle/release/app-release.aab
   ```

4. Play Console 建应用 `studio.weichao.jpq`，同一 SKU，内部测试轨先于生产。**默认语言 English (United States)**；默认官网 / 隐私 / 支持 URL 用英文页 `https://jpq.weichao.studio/en/`、`/en/privacy`、`/en/support`。中文作为本地化列表。网站根路径仍默认中文；App 内链接随当前语言跳转。商店文案、1024×500 宣传图、512 图标、Data safety 点选项见 `docs/store/README.md`「Play Console 粘贴稿」。
5. Data safety **提交时依据实际 AAB、Play Billing SDK 官方 Data safety 指引和 Console 提示逐项确认**。Android 2.1.7+ 无 Firebase Analytics、无广告/归因 SDK、不发送开发者定义的产品分析事件，但不要预先勾「完全不采集/不共享」。音色工坊 / Restore 走 Google Play Billing；Billing SDK / Google Play 可能为交易、反欺诈、服务运行或诊断向 Google 处理必要数据（这不是 Firebase Analytics）。付款界面由 Google Play 提供，不要把信用卡/支付详情写成 App 直接收集。粘贴稿不是 Console 已提交证明，不要勾完成。
6. 不要把 iOS 截图传到 Play。Android 真机截图仍要你拍。

### Firebase Analytics（仅 iOS）

Android **不要**加 `google-services.json`，也不要接 Firebase / Google Services 插件。iOS 暂时仍用 Firebase Analytics（产品内事件，广告标识关）：

1. [Firebase Console](https://console.firebase.google.com) 只加 iOS App（包名 / Bundle ID `studio.weichao.jpq`）。不要为 Android 建客户端配置。
2. `GoogleService-Info.plist` 放在 `ios/BunnyMetronome/`（已列入 Xcode 资源；占位文件里的 `YOUR_` 前缀会跳过初始化）。
3. iOS 客户端配置可以进 git。不要提交 Firebase **Admin** 密钥，也不要提交 Play 服务账号 JSON。
4. iOS 控制台关闭 Google Analytics 广告功能 / 数据共享（能关的都关）。
5. 商店文案 / 截图见 `docs/store/README.md`。国内商店与软著不做。

---

## 🐛 常见问题

### 微信开发者工具报错「请先安装 Node.js」

本项目依赖 `umtrack-wx`，需要可用的 Node.js / npm 来执行 `cd miniapp && npm ci`，再在微信开发者工具中执行「工具 → 构建 npm」。不要通过关闭编译选项跳过依赖安装；小程序运行时本身不使用 Node.js。

### 音频首次播放有延迟

**已解决**：所有鼓点采样已本地打包在 `assets/sounds/`，无 CDN 依赖，首次播放无延迟。

### 推送到 GitHub 后 Vercel 没反应

Vercel 默认会部署整个仓库。请在 Vercel Dashboard → Settings → Git → **Ignored Paths** 添加 `miniapp/**`，这样只有网页版变更才会触发部署。

### 小程序审核被驳回

常见原因：
- 页面无实际内容（节拍器属工具类，正常）
- 音频文件过大。2026-09-06 按文件字节（`stat`/`st_size`，不是 `du` 磁盘块、也不是微信最终包体）计：`miniapp/assets/sounds/` **35** 个 mp3，合计 **76 974 字节（约 75.2 KiB）**——3 个 click 3 186 字节，32 个数拍 73 788 字节。`du -sk` 在本机显示约 140 KiB，那是文件系统块分配，不是上传给微信的压缩包大小。对照主包 2MB 上限仍有余量；最终审核包体以开发者工具上传结果为准。
- 缺少隐私协议弹窗（首次使用需获取用户信息时）

### 想添加新音效

1. 用 Audacity 或 ffmpeg 制作采样（建议 0.1-0.2 秒，MP3 格式）
2. 放入 `miniapp/assets/sounds/`
3. 在 `AudioManager.init()` 中注册新 key
4. 在 `_tick()` 中对应分支调用 `audioManager.play('your-key')`