# Card-Studio 对内项目说明（维护者专用）

> 本文件位于 `DOCS/`，由根目录 `AGENTS.md` 的「对内/对外文档分区」一节引用。
> 根目录 `README.md` 一律对外；维护者备忘只写在这里。

## 工程备忘（原 README「工程备忘」章迁移）

- 180° 背面黑屏根因：PlaneGeometry 默认单面渲染 → 已改 `THREE.DoubleSide`。
- 服务器对 html/js/css/json 发 `Cache-Control: no-cache`，改代码刷新即生效。
- 模型按路径独立缓存，切换模型自动重新加载（修复 session 单例导致"换模型不生效"）。
- 未生成时查看器卡片 mesh 初始隐藏，避免白色空卡面块。

## 阶段排期内部口径

原「阶段计划」中第二/第三阶段标为「暂缓」，对外版已改写为 Roadmap（规划中）。排期决策如有更新记录在此。
