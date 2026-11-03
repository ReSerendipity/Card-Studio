# 架构 — Card-Studio

> 治理定位：`delivery=release`、`lifecycle=maintenance`（`governance/desired-state.json`）。
> 本文按 2026-11-03 的实际目录结构生成；数据流与边界须由维护者在实现变更时同步复核。

## 1. 定位

多视角 3D 立体旋转闪光卡生成器 —— 纯前端本地运行，无 LLM、无 Python、无后端。

## 2. 组件与依赖方向

```text
应用层：src-tauri/ (25)、src-web/ (23)
支撑层：docs/ (59)、.github/ (8)
根级层：根级文件 (7)
```

| 组件 | 目录 | 文件数 | 代表文件 |
|---|---|---|---|
| `docs` | `docs/` | 59 | `docs/THIRD_PARTY_NOTICES.md`, `docs/agent-contract.md`, `docs/assets/architecture.svg` |
| `src-tauri` | `src-tauri/` | 25 | `src-tauri/.gitignore`, `src-tauri/Cargo.lock`, `src-tauri/Cargo.toml` |
| `src-web` | `src-web/` | 23 | `src-web/assets/models/modnet.onnx`, `src-web/assets/models/u2netp.onnx`, `src-web/assets/samples/alpha.png` |
| 根级文件 | `/` | 7 | `.editorconfig`, `.gitignore`, `CHANGELOG.md` |

依赖方向：入口层（应用 / 页面）调用领域层（业务模块），领域层依赖基础设施层（脚本、配置、模型资产）；反向引用不允许。

## 3. 数据流

浏览器加载页面 → 选择卡片模板与视角 → Canvas/WebGL 合成 → 导出图片或视频；全程本地运行，无网络请求。

## 4. 外部依赖

| 依赖 | 用途 | 不可用时 |
|---|---|---|
| Node.js / npm | 前端构建与依赖 | 无法构建 dist |

## 5. 边界与非目标

- 发布链只走 §10：远端优先、tag 驱动、资产附 `SHA256SUMS.txt`。
- 分发产物由 CI 生成，不入库。
- 不入库：密钥 / token / 口令 / 连接串、本机绝对路径、`local/` 与 `AGENTS.md`、构建产物。
- 治理正文只在 `ReSerendipity/.github/governance`，本仓不复制规则正文。

## 6. 变更影响面

| 改什么 | 必须同步 | 由谁校验 |
|---|---|---|
| 目录结构 / 入口 | 本文「组件与依赖方向」与「数据流」 | 维护者 |
| CI 与门禁 | 本仓 `README.md` 的测试命令；治理仓 §20 远端载体口径 | `audit-drift.py` |
| 依赖清单 | 锁文件与 `.github/dependabot.yml` 的生态段 | Dependabot / `lock-consistency` |
| README 展示图 | §8.1 真实性红线（图必须来自真实运行） | 治理仓 `readme-image-provenance` |
