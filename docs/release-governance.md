# 发布 / 回滚 规范（Card-Studio）

> **来源与权威**：公共条款见 `ReSerendipity/.github` 的 `REPOSITORY_GUIDELINES.md` §10（发布 / 分发统一规范）。
> 本文件是本仓的本地化发布规范，只记录本仓特有内容，不重写或抵触 §10 的公共条款。

---

## 0. 远端优先（根原则，不可改写）

发布链的构建、打包、扫描、上传、推送**全部在 GitHub Actions 远端完成**；本地只做三件事：改版本位、落 CHANGELOG、`git tag` + `git push`。本地不执行打包 / 镜像构建 / 发布上传。

## 1. 版本号规范

- 遵循 **SemVer** `MAJOR.MINOR.PATCH`；预发布用 `-alpha.N` / `-beta.N` / `-rc.N`。
- **唯一权威版本位**：`src-tauri/tauri.conf.json` 顶层 `version` 字段（当前 `1.0.0`）。
- 必须同步的其它版本位：
  - `src-tauri/Cargo.toml` 的 `[package] version`
  - `src-tauri/Cargo.lock` 中 `card-studio` 包条目的 `version`
- 版本位漂移由 **待定（负责人 + 触发条件）** 钉住——当前无自动化版本一致性测试，发版前须人工核对三处一致。
- 自动化方式：**手动 tag（人工）**。

## 2. CHANGELOG 管理

- 遵循 **Keep a Changelog**：`Added / Changed / Fixed / Deprecated / Removed / Security`。
- 每次合并 `main` 在 `[Unreleased]` 追加；type 映射 `feat→Added`、`fix→Fixed`、`refactor→Changed`。
- 发版时 `[Unreleased]` → `[VERSION] - YYYY-MM-DD`。
- 当前状态：`CHANGELOG.md` 已建立（2026-10-18，根级，遵循 Keep a Changelog）。

## 3. 发布流程（远端）

1. 确认 `[Unreleased]` 条目完整
2. 同步版本位（见 §1 清单：`tauri.conf.json` / `Cargo.toml` / `Cargo.lock` 三处一致）
3. 本地打 tag 并推送：`git tag v<X.Y.Z>` → `git push origin v<X.Y.Z>`
4. 远端凭 tag 触发 `.github/workflows/release.yml` 构建产物
5. 远端建 Release 并挂资产（Windows 安装包 / Android APK / SBOM / SHA256SUMS.txt）
6. 盯到终态：`gh run list` 确认绿；红了当场修或 revert 止损

## 4. 分发产物与完整性

| 产物 | 构建位置 | 标签 / 命名 | 完整性手段 |
|---|---|---|---|
| Windows NSIS 安装包（`.exe`） | **远端**（windows-latest） | tag = `v<semver>`，不可变 | `SHA256SUMS.txt` |
| Windows MSI 安装包（`.msi`） | **远端**（windows-latest） | tag = `v<semver>`，不可变 | `SHA256SUMS.txt` |
| Android debug APK | **远端**（ubuntu-latest） | tag = `v<semver>`，不可变 | 随 `SHA256SUMS.txt` 校验 |
| SBOM（SPDX JSON） | **远端** | `Card-Studio-sbom.spdx.json` | 随 Release 资产 |

- 本仓不构建容器镜像，不涉及 ghcr.io / Trivy 扫描 / `latest` tag 策略。
- 桌面分发签名：本仓当前未启用 Tauri ed25519 更新器签名（`*.sig`）；`SHA256SUMS.txt` 仅用于防传输损坏。
- **不使用 GPG 分离签名**（2026-10-18 裁决）。

### 发布产物判断依据

本仓**确有可分发产物**，判断如下：

1. 存在 Tauri v2 桌面壳（`src-tauri/`），`tauri.conf.json` 声明 bundle targets 为 `nsis` + `msi`，可产出 Windows 安装包；
2. 现有 `.github/workflows/release.yml` 已 tag 驱动构建 Windows 安装包、Android debug APK，并上传 SBOM 与 SHA256SUMS.txt；
3. 网页版通过 GitHub Pages 部署（`pages.yml`），属 deployment 范畴而非 Release 产物。

结论：发布链已存在且符合 tag 驱动 + 远端优先 + SHA256SUMS 标准，无需新建 workflow。

## 5. 回滚

- **判定**（满足任一即触发）：待定（负责人 + 触发条件）
- **执行**：`git revert <bad-commit>`（保历史、可再 forward）；不可变产物按上一版 tag 重推
- **破坏性动作**：重指向 / 删除 tag、移动任何远端 ref → **须仓库所有者单独授权**
- **回滚后验证**：待定（负责人 + 触发条件）

## 6. SLA / 错误预算

- 目标可用性 待定（负责人 + 触发条件）；超出即冻结非紧急发布并复盘。

## 7. 发布前检查清单

- [ ] 版本位全部同步（见 §1 清单：tauri.conf.json / Cargo.toml / Cargo.lock）
- [ ] CHANGELOG `[Unreleased]` 已改版本 + 日期
- [ ] `cargo build --locked` 通过（release.yml pre-publish check 已覆盖）
- [ ] JS 语法检查 + smoke 通过（ci.yml 已覆盖）
- [ ] 镜像类仓：不适用（本仓无容器镜像）
- [ ] **本地未产出任何发布交付物**（全部远端构建）
