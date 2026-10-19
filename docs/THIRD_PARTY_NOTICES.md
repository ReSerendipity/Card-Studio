# 第三方源码与许可证声明（Third Party Notices）

本文件登记**随本仓库分发的第三方代码、二进制与模型权重**。本仓自研代码为 Apache-2.0，见根目录 [`LICENSE`](LICENSE)（11,314 B）。

本仓的第三方不是"构建时拉取的依赖"，而是**直接放在 `src-web/` 里、随 Web 端与桌面安装包一起发出去的实体文件**，
所以逐条列出，包括体积——`vendor/` 与 `assets/models/` 合计约 99.5 MB（blob 口径实测 99,522,623 B ≈ 94.9 MiB），是本仓发布物体积的主要构成。

登记基准：`Card-Studio @ 9262e9681aaf2b0b54f35c1257e072cba0643196`（该 ref 共 110 个 blob）——下文逐条体积与逐字节比对都是在这份文件树上做的。

台账复核：当前 `main` tip 为 `2f661ac130d656374a03270617ceac0770b2befc`（111 个 blob）。`compare/9262e96…2f661ac` 的差集只有本文件自身（`status=ahead`、`ahead_by=1`），即上述被登记的第三方文件在本文件落地之后一个字节都没动过。

最后核验日期：2026-10-12（`git/trees?recursive=1`，`truncated=false`）。

---

## 一、第三方运行时库

### 1. `src-web/vendor/three.min.js`（669,884 B）— **MIT**，three.js **r160**

文件第 1–6 行逐字（第 1 行是上游自带的弃用告警，本仓未改动）：

```
console.warn('Scripts "build/three.js" and "build/three.min.js" are deprecated with r150+, and will be removed with r160. Please use ES Modules or alternatives: https://threejs.org/docs/index.html#manual/en/introduction/Installation'),
/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */
```

| 项 | 内容 |
|---|---|
| 上游 | `mrdoob/three.js`，**r160** |
| 版本依据 | 压缩主体内 `REVISION` 字面量：字节偏移 570 处为 `const e="160"`（本文件按 0-based 计），另有 `t.REVISION=e` 的导出赋值 |
| 许可证 | **MIT**，全文见 §三·A |
| 引用方式 | `src-web/index.html:160` `<script src="vendor/three.min.js">` —— **本地引用，无 CDN 外链** |

义务：MIT 要求保留版权声明 ⇒ **头部第 2–6 行的 `@license` 块不得在压缩/格式化时被删**。
说明：`build/three.min.js` 这种 UMD 形式自 r150 起被上游标记为弃用，本仓使用的是仍带该形态的 r160 发行物；这是**技术选型问题**，不影响许可归属。

### 2. `src-web/vendor/ort.min.js`（540,029 B）+ 5 个 WASM — **MIT**，ONNX Runtime Web **v1.17.1**

文件第 1–5 行逐字：

```
/*!
 * ONNX Runtime Web v1.17.1
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
```

| 项 | 内容 |
|---|---|
| 上游 | `microsoft/onnxruntime`，标签 **`v1.17.1`** |
| 许可证 | **MIT**（上游 `LICENSE` 1,073 B，全文见 §三·B） |
| 引用方式 | `src-web/index.html:161`，本地引用 |

同一发行物的 5 个 WASM 载体（逐个列出，因为它们是本仓体积最大的第三方内容）：

| 文件 | 字节数 |
|---|---|
| `src-web/vendor/ort-wasm-simd-threaded.jsep.wasm` | 19,514,999 |
| `src-web/vendor/ort-wasm-simd.jsep.wasm` | 17,411,110 |
| `src-web/vendor/ort-wasm-simd-threaded.wasm` | 10,646,922 |
| `src-web/vendor/ort-wasm-simd.wasm` | 10,550,433 |
| `src-web/vendor/ort-wasm.wasm` | 9,725,745 |
| **小计** | **67,849,209** |

它们与 `ort.min.js` 同属 ONNX Runtime Web 1.17.1 的官方发行物，登记在同一许可条目下。

---

## 二、模型权重

> 「代码许可 ≠ 权重许可」是这类清单最容易出错的地方。下面两条都**以上游明文声明为准**，并写明依据在哪一行。

### 3. `src-web/assets/models/modnet.onnx`（25,888,640 B）— **Apache-2.0**

| 项 | 内容 |
|---|---|
| 上游 | `ZHKKKe/MODNet`（官方主仓，`master`） |
| 许可证 | **Apache-2.0**（该仓 `LICENSE` 11,357 B） |
| **权重被明确覆盖的依据** | 该仓 `README.md:101-102` 逐字：`## License` / `The code, models, and demos in this repository (excluding GIF files under the folder `doc/gif`) are released under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) license.` ⇒ 该声明**显式包含 models**，故本例不存在"权重另属非商用许可"的落差 |

置信度：**中**。锚定这份权重的版本需要一次哈希比对，而 GitHub 侧给不出可与之比对的对方（2026-10-12 实测两次只读查询）：

- 上游 `ZHKKKe/MODNet @ master` 的文件树共 34 个 blob（`truncated=false`），其中**没有任何 `.onnx` / `.pth` / `.pt`** ⇒ 权重不在该仓的 git 历史里，不存在能与本仓这份 25,888,640 B 对齐的「上游提交」。
- 上游存放权重的 `danielgatis/rembg` release `v0.0.0`（41 个资产）里**没有 `modnet.onnx`**。

⇒ 要把本条升为「高」，需要的是上游在其文档中指定的外部渠道原始权重文件，以及该渠道与作者身份的对应关系；仅在本仓与 GitHub 之间比对无法完成锚定。

### 4. `src-web/assets/models/u2netp.onnx`（4,574,861 B）— **Apache-2.0**

| 项 | 内容 |
|---|---|
| 权重原始来源 | `xuebinqin/U-2-Net`（`master`），其仓 `LICENSE` 11,357 B = **Apache-2.0** |
| 分发渠道 | `danielgatis/rembg` 的 release `v0.0.0` 资产 |
| 字节锚定（2026-10-12 实测） | 本仓这份与 rembg release `v0.0.0` 的资产 `u2netp.onnx` **SHA256 相同**：`309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`（4,574,861 B，两侧字节数一致） ⇒ 本仓持有的是上游发布物的原样副本，未重导出、未改动 |
| 来源指认的依据 | rembg `README.md:516` 对 `u2netp` 明写 `[source](https://github.com/xuebinqin/U-2-Net)` |
| 关于 rembg 自身的 MIT | rembg 只声明**其代码**为 MIT（`README.md:599`），该声明**不覆盖**它列出的模型权重 ⇒ 权重的许可回到上表的来源仓，即 Apache-2.0 |

置信度：**中**。U-2-Net 仓内没有单独针对权重的许可段落，Apache-2.0 的依据是**仓级 LICENSE + 分发渠道的来源指认**；权重本身无版本号。

上表的字节锚定只把「本仓这份 == rembg 发布的那份」从推断升为实测，**不改变许可结论**：它证明的是分发物一致，不是授权范围。

---

## 三、许可证全文

### A. MIT — three.js（`mrdoob/three.js` 的 `r160` 包级 `LICENSE`，1,081 B，逐字）

```
The MIT License

Copyright © 2010-2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### B. MIT — ONNX Runtime（`microsoft/onnxruntime` 的 `v1.17.1` `LICENSE`，1,073 B，逐字）

```
MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### C. Apache-2.0

第 3、4 条适用 Apache-2.0。本仓根目录 [`LICENSE`](LICENSE)（11,314 B）即 Apache-2.0 全文，与本文件一同分发，满足 §4(a)。
上游 `ZHKKKe/MODNet` 与 `xuebinqin/U-2-Net` 各自的 `LICENSE`（均 11,357 B）为同一份 Apache-2.0 文本。
两个上游均未使用 `NOTICE` 文件 ⇒ Apache-2.0 §4(d) 的 NOTICE 传递义务**不触发**。

---

## 四、与发布物的关系

§一、§二 列出的全部文件（含 5 个 WASM 与 2 个 ONNX）**都会进入 Tauri 桌面安装包与 GitHub Release 资产**。
本文件即这些内容的许可与归属说明；对外分发安装包时应一并携带本文件（当前随仓库分发已满足）。

---

## 五、范围说明与未定项

**不在本文件登记范围的**：`src-tauri/Cargo.lock`（112,257 B）所列 Rust crate —— 仓内**无 `vendor/` 目录**，crate 源码未入库，构建时才拉取，故不构成再分发物；npm/pip 侧依赖同理。

**未定项（如实列出，不做推测）**：

- `src-web/assets/samples/{front,right,back,left,single,wide,alpha}.png`（7 张）：仓内**未记录出处**，来源与授权状态未知。它们是用户首次打开时看到的默认展示卡面，且随 Web 端与安装包分发。本文件不声称其可商用；如需商用，请补充出处或替换为自制素材。
- 两份 ONNX 权重的**具体版本锚点**：上游无 tag/release，只能钉到 `master`，故 §二 两条的置信度为「中」。
- `docs/shot1-3.png`、`docs/ux/**.png`、`docs/icons/*`、`src-tauri/icons/*`：自产截图与自制图标（`docs/icons/README.md` 声明设计源 SVG 在仓内），随本仓 Apache-2.0 分发。
- 字体：仓内无自带字体文件，页面使用系统楷体/宋体/黑体 ⇒ 不涉及第三方字体分发。
