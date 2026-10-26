# Card Studio · 闪卡工坊

多视角 3D 立体旋转闪光卡生成器 —— 纯前端本地运行，无 LLM、无 Python、无后端。

[![CI](https://github.com/ReSerendipity/Card-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/ReSerendipity/Card-Studio/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ReSerendipity/Card-Studio)](https://github.com/ReSerendipity/Card-Studio/releases/latest)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![last commit](https://img.shields.io/github/last-commit/ReSerendipity/Card-Studio)](https://github.com/ReSerendipity/Card-Studio/commits/main)
![JavaScript](https://img.shields.io/badge/JS-vanilla-yellow)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**[中文](#中文) · [English](#english)**

---

## 中文

### 项目简介

上传 N 张同一角色/物体的不同视角位图，Card Studio 在浏览器内完成自动抠图、卡面合成与 3D 旋转查看，并导出按角度命名的 PNG 帧与 `config.json`。全程数据不离开本机。

### 核心特性

- **本地推理抠图**：ONNX Runtime Web（WASM）跑内置 MODNet FP32 / U²-Net（u2netp）模型；另有「透明底直通」「色键去白底」两种零模型降级模式。
- **Canvas2D 卡面合成**：渐变 / 星空 / 纯色 / 自定义背景，5 种字体，烫金/纯白/淡紫/深墨卡名字色，金边/银边/玫瑰金边框，角饰开关。
- **Three.js 3D 查看器**：相邻视角帧环形插值，拖拽惯性、键盘 ←/→（6°/格）、0/90/180/270 跳转、任意角度输入、自动旋转、光泽/景深/转速滑块。
- **按角度导出**：导出 `card_<angle>.png` 帧序列与 `config.json`，便于二次加工。
- **双主题**：暗夜香槟金 / 象牙浅白，右上角 🌙/☀️ 切换，localStorage 记忆。
- **零构建前端**：原生 JS，无打包步骤；Node 静态服务器即开即用。

### 展示

![主界面：已上传 4 张真实样例视角图](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-1-main-20261026.png)

*图 1 · 主界面：4 张内置样例视角图已载入，左侧为上传/抠图/卡面参数面板。*

![生成完成：REZE 紫渐变闪卡](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-2-generated-20261026.png)

*图 2 · 生成完成：色键去白底后 Canvas2D 合成的卡面，REZE 标题、SSR 稀有度、No.001 编号。*

![样式与参数面板](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-3-style-20261026.png)

*图 3 · 卡面参数面板：背景样式、字体、卡名字色、边框样式、角饰、主体大小、随机种子等选项。*

![旋转 3D 预览视角](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-4-rotated-20261026.png)

*图 4 · 旋转预览：相邻视角帧以环形插值呈现，本图为背面视角（180°）。*

![模块与数据流架构](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-architecture.svg)

*图 5 · 模块与数据流（基于仓库目录结构绘制，非运行界面截图）。*

### 快速开始

**环境要求**

- Node.js ≥ 22（仅用于本地静态服务器；前端本身在浏览器内运行）
- 现代浏览器（Chrome / Edge / Firefox / Safari，需支持 WebGL 2）

**启动**

```bash
git clone https://github.com/ReSerendipity/Card-Studio.git
cd Card-Studio
node src-web/server.js
# 浏览器打开 http://127.0.0.1:4173/
```

Windows 用户可直接双击根目录 `start.bat`。

**最小验证**

1. 打开首页，左侧出现「① 上传视角图」面板。
2. 点击面板下方「加载示例」按钮，载入 4 张内置视角图。
3. 点击「✦ 生成闪卡」，等待状态栏出现「生成完成」。
4. 在右侧舞台拖拽鼠标，卡牌应随之旋转；右上角「导出卡面 PNG」按钮变为可用。

> 首次使用「自动抠图（MODNet 模型）」时会加载约 25.9 MB 的 ONNX 模型，请耐心等待；移动端 CPU 亦可跑。

### 系统要求与兼容性

- **桌面浏览器**：Chrome / Edge / Firefox / Safari 最新两个大版本。
- **移动端浏览器**：iOS Safari / Android Chrome 可运行（WebView 内推理），受内存限制建议优先选 u2netp（4.6 MB）模型。
- **桌面壳**：`src-tauri/` 为 Tauri v2 工程，当前处于第二阶段（暂缓）；v1.0.0 Release 附带 Windows `.msi` / `.exe` 安装包与 Android debug 签名 APK。

### 使用示例

1. **上传视角图**：点选或拖拽 N 张位图，按文件名排序；缩略图下方可逐张修改角度（默认 0/90/180/270 均匀分布）。
2. **选择抠图方式**：自动模型 / 透明底直通 / 色键去白底。
3. **填写卡面参数**：卡名、编号、稀有度（N/R/SR/SSR/UR）、背景样式与颜色、字体、边框。
4. **生成**：点「生成闪卡」，状态栏与进度条实时反馈。
5. **查看与导出**：拖拽旋转、滑块调光泽/景深/转速；点「导出卡面 PNG」导出当前帧，「导出配置 JSON」导出合成参数。

### FAQ

**Q1：必须联网吗？**
不必须。前端、模型、Three.js 与 ONNX Runtime 均已本地化（`src-web/vendor/`、`src-web/assets/models/`）。在线 Demo 由 GitHub Pages 托管，首次加载模型后可离线使用。

**Q2：我的图片会被上传到服务器吗？**
不会。抠图与合成全部在浏览器内完成，没有后端接口，也没有遥测。

**Q3：自动抠图失败或边缘不干净怎么办？**
- 切换模型精度：MODNet FP32（25.9 MB，通用）↔ U²-Net u2netp（4.6 MB，更稳）。
- 若原图已是透明 PNG，改用「透明底直通」。
- 若为白底产品图，改用「色键去白底」（无需加载模型）。
- 日志在浏览器 DevTools Console，模块前缀为 `[cutout]` / `[app]`。

**Q4：导出的 PNG 是什么？**
每张 PNG 是当前角度的卡面静态帧（带光泽效果），文件名含角度（如 `card_0deg.png`）；`config.json` 记录本次合成的全部参数，便于复现。

**Q5：支持多少张视角图？**
N ≥ 1。单张时为静态卡面；多张时按角度环形插值生成中间帧。

### 文档与治理

- [CHANGELOG.md](CHANGELOG.md) — 版本变更（Keep a Changelog 格式）
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南与回归脚本入口
- [docs/release-governance.md](docs/release-governance.md) — 发布治理规范
- [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) — 第三方组件与模型声明
- [docs/ux/](docs/ux/) — CDP 回归/诊断脚本（改动 UI 后请运行对应脚本）

### 贡献、安全与支持

- 欢迎 Issue 与 PR，请遵循 [CONTRIBUTING.md](CONTRIBUTING.md) 与 Conventional Commits。
- 安全问题请通过 Issue 私下披露，勿公开暴露 PoC。
- 单人维护的 pre-1.0 项目，改动请小而聚焦。

### 许可证

本项目以 [Apache-2.0](LICENSE) 许可证发布。© 2026 ReSerendipity

---

## English

### Overview

Card Studio is a browser-based, fully client-side generator for multi-view 3D "holographic" rotating trading cards. Upload N photos of the same character or object from different angles; the app cuts out the subject locally, composites a card on Canvas2D, and renders a Three.js viewer that ring-interpolates between views as you drag. It exports angle-named PNG frames plus a `config.json`. No photo ever leaves the device.

### Features

- **Local cutout**: ONNX Runtime Web (WASM) runs bundled MODNet FP32 / U²-Net (u2netp) models; plus "transparent passthrough" and "color-key white removal" zero-model fallbacks.
- **Canvas2D compositing**: gradient / starfield / solid / custom backgrounds, 5 fonts, gold-foil / white / purple / ink card-name colors, gold / silver / rose-gold borders, corner ornaments toggle.
- **Three.js 3D viewer**: ring-interpolated rotation between adjacent views, drag inertia, arrow keys (6°/step), 0/90/180/270 jump, arbitrary angle input, auto-rotate, gloss / depth-of-field / speed sliders.
- **Angle-based export**: `card_<angle>.png` frame sequence + `config.json`.
- **Dark / light theme** with localStorage memory.
- **Zero-build frontend**: vanilla JS, no bundler; a Node static server is the only runtime.

### Showcase

![Main UI: 4 sample views loaded](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-1-main-20261026.png)

*Fig 1 · Main UI: 4 built-in sample views loaded; left panel holds upload / cutout / card parameters.*

![Generated REZE purple-gradient card](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-2-generated-20261026.png)

*Fig 2 · Generated: Canvas2D card after color-key white removal — REZE title, SSR badge, No.001.*

![Style and parameters panel](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-3-style-20261026.png)

*Fig 3 · Card parameters: background style, font, name color, border, corners, subject scale, seed.*

![Rotated 3D preview](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-4-rotated-20261026.png)

*Fig 4 · Rotated preview: ring-interpolated between adjacent views; this frame shows the back (180°) view.*

![Module and data-flow architecture](https://gcore.jsdelivr.net/gh/ReSerendipity/Card-Studio@main/docs/assets/readme-card-studio-architecture.svg)

*Fig 5 · Module and data-flow map (derived from the repository layout; not a runtime screenshot).*

### Quick start

**Prerequisites**

- Node.js ≥ 22 (only for the local static server; the frontend runs in the browser)
- A modern browser with WebGL 2 (Chrome / Edge / Firefox / Safari)

**Run**

```bash
git clone https://github.com/ReSerendipity/Card-Studio.git
cd Card-Studio
node src-web/server.js
# open http://127.0.0.1:4173/
```

Windows users can double-click `start.bat` in the repo root.

**Minimal smoke test**

1. Open the page; you should see the "① Upload views" panel.
2. Click "Load sample" to load the 4 built-in views.
3. Click "✦ Generate card"; the status bar should report "生成完成 / done".
4. Drag on the right stage — the card rotates. The "Export PNG" button becomes enabled.

> First run with "auto cutout (MODNet model)" downloads the ~25.9 MB ONNX model; CPU inference on mobile is fine.

### Requirements & compatibility

- **Desktop browsers**: latest two major versions of Chrome / Edge / Firefox / Safari.
- **Mobile browsers**: iOS Safari / Android Chrome work in-WebView; prefer the 4.6 MB u2netp model under memory pressure.
- **Desktop shell**: `src-tauri/` is a Tauri v2 project currently on hold (phase 2). The v1.0.0 release ships Windows `.msi` / `.exe` installers and an Android debug-signed APK.

### Usage

1. Upload N views (click or drag); files are sorted by name. Adjust per-view angles under each thumbnail (defaults to 0/90/180/270).
2. Pick a cutout mode: auto model / transparent passthrough / color-key white removal.
3. Fill card parameters: name, number, rarity (N/R/SR/SSR/UR), background style & color, font, border.
4. Click "Generate card"; progress bar and status update live.
5. Rotate with drag, tune gloss/depth/speed sliders; export the current frame as PNG or dump all parameters as `config.json`.

### FAQ

**Q1: Does it need internet?**
No. The frontend, models, Three.js, and ONNX Runtime are all vendored under `src-web/vendor/` and `src-web/assets/models/`. The online demo is hosted on GitHub Pages; once models are loaded the app works offline.

**Q2: Are my photos uploaded?**
No. Cutout and compositing run entirely in the browser — there is no backend and no telemetry.

**Q3: The auto cutout looks rough. What now?**
- Switch model precision between MODNet FP32 (25.9 MB, general) and U²-Net u2netp (4.6 MB, more stable).
- If the source image is already transparent, use "transparent passthrough".
- For white-background product shots, use "color-key white removal" (no model download).
- Check the browser DevTools Console for `[cutout]` / `[app]` prefixed warnings.

**Q4: What do the exported PNGs contain?**
Each PNG is a static card frame at the current angle (with gloss effect), named by angle (e.g. `card_0deg.png`). `config.json` records every compositing parameter for reproducibility.

**Q5: How many views can I use?**
N ≥ 1. A single view yields a static card; multiple views are ring-interpolated into intermediate frames.

### Docs & governance

- [CHANGELOG.md](CHANGELOG.md) — release history (Keep a Changelog)
- [CONTRIBUTING.md](CONTRIBUTING.md) — contributing guide and regression entry point
- [docs/release-governance.md](docs/release-governance.md) — release governance
- [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) — third-party and model notices
- [docs/ux/](docs/ux/) — CDP regression/diagnostic scripts (run after UI changes)

### Contributing, security & support

- Issues and PRs welcome; follow [CONTRIBUTING.md](CONTRIBUTING.md) and Conventional Commits.
- For security issues, please open a private report — do not disclose public PoCs.
- This is a single-maintainer pre-1.0 project; keep changes small and focused.

### License

Released under [Apache-2.0](LICENSE). © 2026 ReSerendipity
