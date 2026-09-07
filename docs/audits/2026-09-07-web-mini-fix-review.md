# Web / 小程序修复提交前复核 — 2026-09-07

基准：`develop` 的 `aa1b27a` 加本轮工作树修改。只提交到 `origin/develop`；不合并 `main`、不发布 Web 或微信包。此前线上 Web 与 `main` 一致不属于发布故障。

## 结论

本轮修复的代码与本地自动回归通过，可作为开发提交。不是全平台验收、真机听感通过、零安全风险或已发布的声明。可选优化未全部实现。

## 修复与复核范围

- Web：采样加载截止时间、停止已预约音源、丢弃严重落后的拍钟积压；自定义拍号回写；可见启动失败与重试；启动/暂停代际隔离；异步亮屏申请与释放所有权；BPM 拖动提交事件；播放按钮可访问名称。
- 小程序：应用态拍号与输入草稿分离、边界规范化、BPM/模式/拍号事件；拖动时状态文字同步；web-view 无效参数与加载失败的可见兜底。
- 缓存/PWA：rewrite HTML 路由使用 network-first，错误响应不覆盖缓存，英文支持入口离线回退保持英文；英文 manifest 与预缓存。
- SEO：10 个英文长尾页 CSS 路径、双向 hreflang、场景导航、规范 URL、6/8 与引擎一致的说明；删减跑步/钢琴页的泛化承诺；未改的支持页不虚增 sitemap 日期。
- 工程：更新 Vitest/coverage 依赖和锁文件；已有与新增 Web/小程序行为检查接入原 CI；收紧 Vercel 发布产物；澄清 npm 构建步骤和统计披露。

## 复核中补正

1. `test_engine.js` 原先创建真实循环调度计时器，即使打印通过也不会退出。改用受控调度测试，且 BPM 测试断言实际预约时间，不以兜底常量冒充测量。
2. 页面原保护只检查当前 playing，旧启动失败仍可覆盖更新的启动。加入独立播放代际，并测试旧成功、旧失败、迟到亮屏、重复申请和旧 release 事件。
3. 小程序 slider changing 已提前更新 BPM，change 因此漏记事件。保存拖动起点，仅在提交时上报一次；Web 键盘步进也更新后续拖动基线。
4. AudioContext 构造同步抛错现在进入启动失败 Promise 路径，可恢复重试。
5. 英文儿童数拍页面描述含引号，原模板生成无效 JSON-LD/HTML 属性。生成器分别使用 HTML 属性转义与 JSON 编码，所有长尾页加入实际解析断言。
6. 补英文 manifest 预缓存、英文 `/about/en/` 离线回退和部署文档中旧的“无需 Node.js”矛盾说明。

## 本地证据

- `npm ci --prefix miniapp`：通过。
- `npm test --prefix miniapp`：3 文件、123 测试通过；index.js 行覆盖 97.48%、分支 83.16%，门槛通过。覆盖率范围没有冒充全项目。
- `node scripts/test_web_prefs.js`：通过。
- `node scripts/test_sw_fetch.js`：通过。
- `node scripts/test_engine.js`：通过并正常退出。
- `node scripts/test_web_start.js`：中英文生命周期、亮屏与控件回归通过。
- `node scripts/test_longtail.js`：20 页 CSS/hreflang/文案/JSON-LD 与源数据断言通过。
- `python3 scripts/test_local.py`：通过。
- 额外静态检查：20 个生成页与模板/源数据一致；28 个 HTML 页的本地资源/页面引用可解析、无重复 ID、JSON-LD 可解析；8 段内联 JS 通过 `node --check`。
- `git diff --check`：通过。

原始本机日志在 `/tmp/metronome-fix-review-20260907/`，临时目录不进入 Git，也不保证跨机器持久存在。

## 未验证与保留项

- 本轮没有新跑模拟器、浏览器仿真或真机音频/微信发布包；Node/Vitest 使用替身 API，不证明设备真实听感、业务域名配置或 PWA 安装体验。
- 官方 npm audit 两次请求均因 TLS 连接断开失败，不能声明升级后“零漏洞”。依赖安装和测试通过与安全数据库复查通过是两回事。
- 分享携带当前练习、共享中英文页面逻辑、音频池/字体性能实测、完整无障碍与跨浏览器窄屏布局仍属后续项。折叠面板的不可见控件焦点等未据本轮声称全部解决。
- CSP 仍是 Report-Only，隐私文案解释这一事实，不代表已启用强制策略或完成法律合规审查。
- CI 仍只监听 main 的 push/PR；推 develop 不会自动运行这些 workflow。未更改原生源码、签名、商店配置和真机上线勾选。
