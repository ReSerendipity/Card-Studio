# 贡献指南（Contributing）

欢迎提交 Issue 与 Pull Request。这是一个单人维护的 pre-1.0 项目，改动请尽量小而聚焦。

## 本地开发

```bash
# 零依赖，仅需 Node：启动本地静态服务器
node src-web/server.js
# 浏览器打开 http://127.0.0.1:4173/
```

Windows 可直接双击根目录 `start.bat`。

## 改动前请先了解

- **文档分区**：根 `README.md` 一律对外（这是什么 / 怎么用 / 怎么参与）；内部进度、决策与备忘写入 `docs/`（约定见 `AGENTS.md`）。
- **回归自检**：UI / 交互类改动请运行 `docs/ux/` 下相应的 CDP 回归脚本（前置条件见 `README.md`「改动后自检」）。
- **不要提交生成物 / 大二进制**：`*.onnx`、`*.wasm`、截图等见 `.gitignore`，请勿强制入库。

## 提交 PR

- 使用 PR 模板并逐项勾选检查清单。
- 提交信息建议采用 Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:` …）。
