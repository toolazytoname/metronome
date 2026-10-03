---
type: synthesis
sources:
  - 用户本线程两份 Web 2026.10.03.2 诊断与“有声音，但是拍点不跳”的补充
  - js/engine.js
  - js/diagnostics.js
  - index.html
  - en/index.html
---
# Web 拍点显示故障核查 · 2026-10-03

## 状态和证据边界

候选版本 `2026.10.03.3` / SW `xiaotutou-v15`。初轮验证时未提交、推送或发布；随后用户授权提交推送，本修复单元走 `develop`，不包含 `main` 发布。iOS / Android 的进行中改动不混入此提交和验证范围。

用户明确是声音继续、拍点不跳，不是暂停后持续出声。第二份报告包含重置后重新就绪，不能再以“没重置音频”解释。日志没有视觉回调信息，未确认 Safari 26 原始故障根因。

旧代码 `onBeat` 在独立每拍 timeout 中调用，异常不会进入调度器的 catch；目标 DOM 不存在也静默返回。此次修复这些代码可证的缺口，改为音频时间驱动的有界视觉队列，失败显式停止并报错。规则见 [[engine-contract]] 和根目录 `AGENTS.md`。

两份用户日志还存在共同前缀后轨迹分离；本地双执行环境测试已证明诊断存储会被不同页面的内存副本互相覆盖。这是另一项已确认缺陷，**此次未修复**，也不足以证明用户当时开了多个标签。错误来源分类、故障后大播放键统一重建音频也尚未在本次实现。

## 自动验证

通过：
- `node scripts/test_engine.js`：17 项，含四项新增视觉队列 / 40、100、208 BPM / 停止清理 / 故障退出测试。
- `node scripts/test_web_start.js`：中英拍点缺失重建、活动节点切换、不可恢复失败；原启停、亮屏、输入回归。
- `node scripts/test_diagnostics.js`：新增绘制字段白名单、类型与上下界、固定 `visual_failed`，原隐私 / 发送回归。
- `test_web_prefs.js`、`test_sw_fetch.js`、`test_longtail.js`。
- `test_local.py`、`test_repository.py`、`test_release_assets.py`、`git diff --check`。

## 本地协作浏览器验证

Chromium，本地端口 8001；不是 Safari 真机验证，也不宣称已人耳确认输出：
- 中英 100 BPM / 4/4 / uniform：采集 `.pop` 活动节点，观察 0–3 按拍推进；诊断 `visualUpdates` 增长、`loading=false`。
- 删除拍点子节点后，下一拍恢复 4 个节点，1 个活动节点，保持播放。
- 注入视觉回调异常 / 返回 false：播放和 UI 均停止，音源和视觉队列清空，中英页面显示专门的拍点错误，并记录 `visual_failed`。
- 截图确认本地中文页面存在活动拍点样式。未验证 Safari 长时间使用 / 切后台后合成层刷新；回调正常但画面不刷新仍属于待排查情况。

## 后续判断

若新报告里 `visualUpdates` 持续增长且 `renderedBeat` 正常推进，但用户仍看不到变化，应进一步核验绘制/样式与用户实际可见页面；不要再误判为采样失败。新版本只有待发布后用户才可验证，旧版本不会自动获得本地修改。
