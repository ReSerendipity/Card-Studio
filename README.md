# Card Studio · 闪卡工坊

多视角 3D 立体旋转闪光卡生成器（不依赖大语言模型，纯前端本地运行）。

## 项目目标

用户上传 N 张同一角色/物体的不同视角位图，程序在浏览器内自动完成：

1. 自动抠图（ONNX Runtime Web 跑本地模型，透明背景）
2. 分层合成（主体 + 渐变/星空/纯色背景 + 烫金描边文字）
3. 生成 3D 旋转查看器：任意角度环形插值，转到哪个角度显示对应视角（相邻帧平滑过渡）
4. 导出本地产物（PNG 帧 + config.json）

## 技术决策

| 项 | 决策 |
| --- | --- |
| 输入形态 | B 方案：N 张视角位图（N≥1，按文件名排序，可逐张自定义角度） |
| 抠图 | ONNX Runtime Web（WASM）跑本地 ONNX 模型，无 Python、无 LLM、无后端 |
| 合成 | Canvas2D（统一画布、渐变背景、烫金/描边文字、PNG 导出） |
| 3D 渲染 | Three.js + 自写拖拽交互（任意角度环形插值 + 双面渲染） |
| 应用壳 | Tauri v2（桌面 + 移动，第二阶段，当前暂缓） |

关键约束：**全程无 LLM、无 Python 依赖**（抠图/合成/渲染全部在 WebView 内完成，以支持 iOS/Android 移动端）。

## 目录结构

```
card-studio/
├── src-web/                  # 前端核心（网页版）
│   ├── index.html            # 入口
│   ├── server.js             # 零依赖 Node 静态服务器（含 no-cache 头）
│   ├── start.bat             # Windows 双击启动
│   ├── css/style.css         # 暗夜香槟金 / 象牙浅白 双主题（CSS 变量）
│   ├── js/
│   │   ├── app.js            # 主控：上传→抠图→合成→导出 + 主题切换
│   │   ├── cutout.js         # ONNX 抠图（model/keep/key 三模式）
│   │   ├── compose.js        # Canvas2D 卡面合成
│   │   └── viewer.js         # Three.js 3D 查看器
│   └── vendor/               # 本地化 three.min.js、onnxruntime-web + wasm
├── assets/
│   ├── models/               # ONNX 抠图模型（见下表）
│   └── samples/              # 示例视角图（front/right/back/left 等）
├── docs/                     # 设计文档、截图、测试脚本
├── README.md
├── start.bat                  # Windows 一键启动
└── LICENSE
```

## 运行方式

```bash
# 方式一：双击 start.bat（Windows 推荐，独立窗口不被回收）
# 方式二：命令行
cd src-web
node server.js
# 浏览器打开 http://127.0.0.1:4173/
```

使用步骤：
1. 上传 N 张视角图（可逐张在缩略图下改角度，默认 0/90/180/270 均匀分布）
2. 选择抠图方式（自动模型 / 透明底直通 / 色键去白底）与模型精度
3. 填写卡面参数（卡名、编号、稀有度、背景样式、背景色、字体、主体大小）
4. 点「生成闪卡」→ 右侧拖拽/滑动/键盘 ←→/跳转按钮旋转查看
5. 导出 PNG（文件名带角度，如 `card_0deg.png`）或 config.json

## 抠图模型

| 模型 | 大小 | 输入 | 定位 |
| --- | --- | --- | --- |
| MODNet FP32 | 25.9MB | 256×256 | 通用平衡（默认） |
| MODNet INT8 | 6.6MB | 256×256 | 快速 / 移动端推荐 |
| U²-Net 便携（u2netp） | 4.7MB | 320×320 | 轻量通用，比 MODNet 更稳 |
| ISNet-Anime | ~176MB | 1024×1024 | 动漫立绘最佳 |

模型按路径独立缓存，下拉切换自动重新加载。移动端 CPU 跑 MODNet INT8 足够；Tauri 阶段可升级原生 ONNX Runtime（自动 CoreML/NNAPI 加速）。

## 功能清单

- **上传**：多图拖拽/点选、逐张角度输入、单张删除、一键清空
- **抠图**：ONNX 模型推理 / 透明底直通 / 色键去白底三模式
- **合成**：渐变/星空/纯色/自定义渐变背景、5 种字体、主体缩放、烫金描边
- **3D 查看**：拖拽惯性、键盘 ←/→（6°/格）、0/90/180/270 跳转 + 自定义角度、自动旋转、任意角度环形插值、双面渲染
- **效果**：光泽扫光、景深、转速滑块
- **导出**：PNG（文件名带角度）、config.json、生成进度条、状态提示
- **主题**：深/浅双主题（右上角 🌙/☀️ 切换，localStorage 记忆）

## 阶段计划

1. **第一阶段（已完成）**：纯 Web 版功能闭环，端到端验证通过
2. **第二阶段（暂缓）**：套 Tauri v2 壳，出 Windows 桌面版
3. **第三阶段（暂缓）**：Tauri Android / iOS 移动端打包

## 工程备忘

- 180° 背面黑屏根因：PlaneGeometry 默认单面渲染 → 已改 `THREE.DoubleSide`。
- 服务器对 html/js/css/json 发 `Cache-Control: no-cache`，改代码刷新即生效。
- 模型按路径独立缓存，切换模型自动重新加载（修复 session 单例导致"换模型不生效"）。
- 未生成时查看器卡片 mesh 初始隐藏，避免白色空卡面块。
