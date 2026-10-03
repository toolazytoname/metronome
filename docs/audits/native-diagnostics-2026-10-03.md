---
type: synthesis
sources:
  - AGENTS.md
  - ios/BunnyMetronome/Engine/LocalDiagnostics.swift
  - ios/BunnyMetronome/DiagnosticsView.swift
  - android/app/src/main/java/studio/weichao/jpq/LocalDiagnostics.kt
  - android/app/src/main/java/studio/weichao/jpq/ui/DiagnosticsDialog.kt
---
# 原生诊断交付核查 · 2026-10-03

用户授权完善 iOS / Android 手头工作并提交推送到 develop；不包含商店上传、tag 或 main 发布。此前 Web 拍点修复已单独提交 a4c1834，见 [[web-visual-2026-10-03]]。

## 实现

- 中英设置显示「诊断与反馈」与真实版本/构建号，保持免费可用；Android Play / CN 共用功能，不加 Firebase 或新 SDK。
- 固定事件枚举：打开、前后台、播放请求/成功/失败、暂停、中断、采样成功/失败；iOS 额外记录采样降级。
- 80 条 / 24 小时，后台串行文件写入、原子落盘、损坏/不可写回退、字段规范化。版本或渠道切换清空旧历史，避免误归因。
- 用户可刷新预览、复制、清除、填写不落盘的描述并发送完整文本；收件人 lazywc@gmail.com。发送由系统邮件或分享应用完成，用户核对后确认。UI 不承诺收到、不把取消当成功。
- 修正 iOS 的版本 %s 模板显示；诊断预览/清除不在主线程同步等磁盘；清除落盘失败显示失败；安卓记录入口 best effort，不能让诊断异常打断 Service 清理。
- 没有更改原生拍钟、亮屏/后台策略、IAP/free 边界、签名、包名或版本号；原先的真机与商店阻断勾选保持不变。

## 验证

- 完整 `./scripts/check-quality.sh` 通过：Web 回归、脚本/资源校验、小程序测试、Swift 测试、Android policy 测试及 diff 格式检查。
- iOS `swift test`：44 项、0 失败。新增 5 项覆盖容量/TTL/未来时间、恢复字段规范化和隐私白名单、FIFO/清除、持久化往返/损坏/版本隔离、不可写目录与清除失败。
- iOS `xcodebuild ... -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` 成功（非签名发行包）。
- Android `:policy:test`：64 项、0 失败。新增 5 项覆盖容量、过期/未来、输入范围、清除/无 snapshot、未知错误文本拒绝。
- Android `:app:assemblePlayDebug :app:assembleCnDebug :app:lintPlayDebug :app:lintCnDebug` 通过；两变体 lint 均 0 Error，仍有 Warning（45 条），不把警告清零说成已完成。
- 中英字符串 90 个 key，中央表与两端副本一致。未新加网络依赖或运行时权限。

## 尚未验证 / 发布边界

- 尚未在真机或模拟器 UI 实测新诊断弹窗、iPad 系统分享定位、邮件账户存在/不存在、第三方分享目标和取消返回。编译/单测不能替代这些交互验证。
- 尚未真实发信；没有收件成功证据。Android Sharesheet 可能忽略 EXTRA_EMAIL，已有可见核对提示和正文地址；系统选择器打开不保证存在合适的邮件应用。
- 未运行 Android app 级存储 instrumentation 测试；Android 直接验证的是 policy 和实际 APK 编译/lint，不将其等同磁盘/API 真机验证。
- 不新增后台定时器清理日志：闲置未运行时不会唤醒 App 擦除文件；下次加载、记录、导出时按 TTL 剔除。缓存/私有文件可由系统清除。
- 旧版 App 不会自动获得入口，需要之后安装更新包。Web 仍有多页面日志覆盖等已记录待办，本次未扩展范围。
