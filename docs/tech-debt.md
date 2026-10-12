# 技术债登记（tech-debt）

本仓代码里 `TODO` / `FIXME` 标记为 **0**（实测于 `2f661ac130d656374a03270617ceac0770b2befc`），
也就是说没有任何散落在源码里的待办线索。这份文件因此是**唯一的债项登记面**：
每条给出可复算的证据、影响、建议动作。证据全部来自 `git/trees?recursive=1` 与逐文件读取，
未使用推测；核对日期 2026-10-12。

| 编号 | 债项 | 严重度 | 状态 |
|---|---|---|---|
| TD-1 | 渲染循环每帧无条件重绘 | P1 | 未处理 |
| TD-2 | `docs/ux/` 的 CDP 前导被复制成 11 份 | P1 | 未处理 |
| TD-3 | `.gitignore` 的忽略规则与已跟踪的二进制互相矛盾 | P1 | 未处理 |
| TD-4 | CI 只做语法检查，且用的 Node 版本低于 README 要求 | P1 | 未处理 |

---

## TD-1 渲染循环每帧无条件重绘（P1）

**证据**：`src-web/js/viewer.js:247-260`

```js
function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  if (autoRotate && !dragging) { group.rotation.y += speed * (1 / 60); }
  else if (!dragging && Math.abs(velX) > 0.05) { group.rotation.y += velX * 0.006; velX *= 0.94;
           if (Math.abs(velX) < 0.05) velX = 0; }
  paintMix();
  renderer.render(scene, camera);
}
```

静止时（`autoRotate` 关闭、`velX` 归零）仍然每帧调用 `renderer.render()`；`paintMix()` 也在无条件路径上。

**影响**：这是桌面/Web 两端都会跑的前台循环，笔记本上表现为持续 GPU 占用与风扇。
另外 `speed * (1 / 60)` 把帧率假定为 60Hz，120Hz 屏上自转速度会翻倍。

**建议动作**：加脏标记（只有旋转变量、素材或混合参数变化时才 render），
并把 `1/60` 换成实际帧间隔（`requestAnimationFrame` 的回调参数就有时间戳）。
不要顺手把 `paintMix()` 也挪进脏分支之前——它的调用次序是当前出图效果的一部分。

## TD-2 `docs/ux/` 的 CDP 前导被复制成 11 份（P1）

**证据**：`docs/ux/` 下共 11 个 `.js` 脚本。对 `final_verify.js:11-27` 那段前导
（`CDP_HTTP` 拼接 → `/json/list` 取 page → `send/ev/sleep/poll/shot` 五个 helper）做逐字节比对，
**只有 1/11 完全相同**；按 token 统计：

| token | 出现的文件数 / 11 |
|---|---|
| `/json/list` | 11 |
| `Runtime.evaluate` | 11 |
| `CDP_HTTP` | 8 |
| `Page.captureScreenshot` | 6 |

⇒ 不是"共享模块被引用"，而是**复制后各改**：端口默认值、页面筛选条件、helper 名字在各文件里已经出现分叉。

**影响**：改一次 CDP 连接方式（例如换端口来源）要改 8–11 处，漏掉的地方不会报错，只会截出旧图。

**建议动作**：抽 `docs/ux/_cdp.js` 导出 `connect()/ev()/shot()`，各脚本只留场景差异。
抽之前先跑一遍全部脚本确认基线截图不变——这批脚本是唯一的视觉回归手段（见 TD-4）。

## TD-3 `.gitignore` 与已跟踪二进制互相矛盾（P1）

**证据**：`.gitignore:13-17`

```
# Large binaries (models + wasm + screenshots) — not for git
*.onnx
*.wasm
docs/**/*.png
docs/*.png
```

而同一 commit 的树里实际**已跟踪**：`*.onnx` 2 个（`src-web/assets/models/modnet.onnx` 25,888,640 B、
`u2netp.onnx` 4,574,861 B）、`*.wasm` 5 个（`src-web/vendor/`，合计 67,849,209 B）、`docs/**` 下 `.png` 32 个。
`CONTRIBUTING.md:19` 又写着"不要提交大文件 / 二进制（`*.onnx`、`*.wasm`、截图等已 `.gitignore`），
请勿强制入库"。

**影响**：三条规则（ignore / CONTRIBUTING / 实际跟踪）两两冲突，且它们都是**发布物的组成部分**——
`THIRD_PARTY_NOTICES.md` 登记的就是这些 `.onnx` 与 `.wasm`。后果不是"仓库变脏"，而是
按 `.gitignore` 做一次 `git clean -fdx` 之后，本地看起来正常、`git status` 干净，但页面会白掉一个模型。

**建议动作**：这些是发布物，不该 ignore。把 `.gitignore` 改成**只忽略导出与临时件**，
删掉 `*.onnx` / `*.wasm` 两条全局忽略；`docs/**/*.png` 若确有未跟踪的截图需求，就改成
`docs/ux/tmp/` 之类的前缀。改完 `CONTRIBUTING.md:19` 那句要同步，否则又是三处不一致。

## TD-4 CI 只做语法检查，Node 版本还低于 README 要求（P1）

**证据**：`.github/workflows/ci.yml` 只有一个 `syntax` job（`:16-37`），执行
`node --check` 于 `src-web/js/*.js src-web/server.js docs/ux/*.js`，**不运行任何测试或回归脚本**；
`:24` 固定 `node-version: "20"`。而 `README.md` 的回归前置条件要求 Node ≥ 22（人工三条：起服务、
起调试浏览器、手动跑脚本）。

**影响**：绿灯的 CI 只证明"这些 JS 能解析"。运行时错误、导出链路、以及需要 Node 22 特性的脚本
在 CI 里根本不会被执行——而 `docs/ux/` 那 11 个脚本恰好是有断言的回归工具。

**建议动作**：先把 CI 的 Node 与 README 对齐（选一个版本写死在两边），再考虑把 `pure_check.js`
这类不依赖设备的脚本放进 CI；依赖 CDP + 起服务的脚本不适合直接进 CI，不要为了绿而改成假通过。
