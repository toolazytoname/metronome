# 原生真机测试工具（手动选择运行）

这是执行说明，不是新的发布清单。发布标准仍以 [AGENTS.md](../../AGENTS.md) 为准；历史证据和限制见 [体检报告](../audits/2026-09-06-health-check.md)。这些脚本不接入普通 CI，不以设备测试设施的完善度新增上线阻断。

## iOS：已签名 WDA + 本机 USB 转发

前提：用户明确同意操作测试机，iPhone 已连接、已解锁；在设备上通过 **XCTest** 启动已正确签名的 WebDriverAgentRunner，并通过本机 USB 转发提供 WDA HTTP 端口。

- 用 `Debug-iphoneos` / `*_iphoneos*.xctestrun`。模拟器的 `.xctestrun` 不能装真机。
- 单独 `devicectl process launch` 一个 WDA Runner App 不等于启动 XCTest 服务；先确认 WDA `/status` ready。
- 复用自己的有效 Development 签名和测试 Runner profile。不要为了执行此脚本自动创建证书、注册 App ID、上传商店或覆盖其它产品。
- 脚本只接受 `localhost` / `127.0.0.1` HTTP 转发入口，并拒绝模拟器。它不构建、安装 App，也不启动 WDA。

```sh
# 项目根目录。每次使用一个不存在的新目录，禁止覆盖旧证据。
python3 scripts/test_ios_device_wda.py \
  --wda-url http://127.0.0.1:18100 \
  --output /tmp/bunny-ios-$(date +%Y%m%d-%H%M%S)

# 短验证：明确 SKIPPED 三段 60 秒保持，不得替代完整运行。
python3 scripts/test_ios_device_wda.py --smoke-only \
  --output /tmp/bunny-ios-smoke-$(date +%Y%m%d-%H%M%S)
```

覆盖：播放/暂停、中英切换、精确 40/120/208 各保持至少 60 秒的 **界面状态**、播放中 BPM ±、恢复原 BPM/语言和停止测试 App。初始 App 正在播放时中止，不打断已有播放会话。

安全和结果口径：

- 不改媒体音量、静音开关、账号；不买东西、不录音、不取系统截图。
- 唯一新 XML，根 bundle 必须是 `studio.weichao.jpq`；前后确认 App 在前台。点击按真实 accessibility **label**，不是把 label 当 identifier。
- 20 分钟总测试时限；UI 恢复另有 180 秒时限；HTTP 请求各有超时。清理失败仍是失败，应检查设备，不能仅因测试主体通过就忽略残留。
- 正常结束会关闭测试 App；只恢复本脚本更改的 BPM/语言。不用内部偏好写入代替 UI 操作。
- 看 `result.json` 的逐项状态，并检查进程退出码。失败返回非零。`PASS_UI_STATE` / `PASS_UI_STATE_ONLY` **不证明**扬声器有声、静音键/锁屏音频、节拍不漂/不插拍或 StoreKit 购买/Restore。
- 测试手机的硬件听感和真实商店验收仍需独立证据；不能把“已签名安装”“UI 显示播放”勾成这些项目通过。

## Android：单方法 instrumentation wrapper（明确选择运行）

仅在用户授权的已连接测试机运行；不要自动循环整套。需要可用 Android SDK、`adb` 和同签名可保留数据的测试安装。

```sh
# 只构建，不连接设备运行测试
(cd android && ./gradlew :policy:test :app:assembleDebug :app:assembleDebugAndroidTest --offline)
# 仅在已获安装授权时，使用 adb -s SERIAL install -r 安装 app 与 androidTest APK。
# 运行前只读备份（仅 debuggable App 支持 run-as；失败时不要 root 或卸载）
adb -s SERIAL shell run-as studio.weichao.jpq cat shared_prefs/metro.xml > /tmp/bunny-prefs-before.xml
# 一次一方法，每次新证据目录；替换为已获授权的设备 serial
python3 scripts/test_android_device.py --serial SERIAL \
  --method a01_playRecreateThenPauseReleasesFgs \
  --evidence-dir /tmp/bunny-android-$(date +%Y%m%d-%H%M%S)
```

- 用例会改 BPM、语言、模式、拍号。事先记录原始值，结束后通过真实 UI 恢复，并只读比对偏好；`a09` 只是固定值 UI 回拨，不是通用快照恢复，历史运行曾失败。wrapper **不恢复偏好**。
- selector 只允许本项目一个 `aNN_method`（或完整类名加该方法）；超时默认 180 秒、可设 1–600 秒。未授权不得覆盖安装、运行或停止用户正在使用的 App。
- 绿判据必须同时满足：adb rc 0、精确 `OK (1 test)`、方法状态序列 `[1,0]`、唯一终结码 `INSTRUMENTATION_CODE:-1`、无 error/fail/skip/shortMsg，以及清理验证成功。shell 0、单条 PASS 日志都不够。
- `finally` 仅 force-stop 本包，并检查无本包 pid/Service；清理失败非零退出。SIGTERM/键盘中断可能没有 `verdict.txt`，这不是 PASS；再次中断也可能打断清理，必须人工确认目标进程和 Service 已退出。
- 日志按目标包精确 UID 过滤 main/crash 缓冲，不导出其它 App 日志。UID/日志抓取失败明确标未采集；不能声称涵盖 root-owned native crash 全部证据。
- `a11` 因测试和 App 共进程而 `@Ignore`；wrapper **没有**外部划掉任务流程。N2.10 真实 recents 划掉仍未覆盖，force-stop 清理不能充当此项 PASS。
- 最终 wrapper 已通过离线解析/模拟清理检查，但修订后没有重新跑真机 instrumentation。历史可信 a01 recreate smoke 与其它失败/部分运行分别记在审计中，不能写成最终 suite 全绿。
