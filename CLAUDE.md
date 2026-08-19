# CLAUDE.md

本仓库的规则、目录、免费边界、禁止事项以 **[AGENTS.md](./AGENTS.md)** 为准。先读那一份。

下面只列本环境里常用的入口，避免和 `AGENTS.md` 各写各的。

## 日常

```bash
python3 -m http.server 8000          # Web：/ 中文，/en/ 英文
cd miniapp && npm test               # 小程序单测
python3 tools/gen-sounds.py          # 重渲 click + 数拍，并拷到 miniapp
```

改节拍逻辑：Web 看 `js/engine.js`，小程序看 `miniapp/pages/index/index.js`。两套时钟不要强行合并。

## 读文档的顺序

1. `AGENTS.md` — 约束
2. `docs/engine-contract.md` — 状态和拍钟
3. `docs/architecture.md` — 多端地图
4. `docs/iap.md` — 音色包
5. `DEPLOY.md` — 怎么发布（没有云后端）

不要新建 `CLOUD.md`。
