# Card-Studio 应用图标 · 设计源

- `card-studio-icon.svg`：最终图标母版（1024×1024，自包含矢量）。三张卡叠成扇（香槟金卡居中 + 梅紫/墨青两翼），配开口腰环与旋转箭头，暗夜/白底皆可用。
- `icon-showcase.html`：高保真设计展示页（主视觉 / 尺寸阶梯 256→16px / 环境模拟 / 家族规则 / 底板配色），浏览器直接打开即可。

编译产物在 `src-tauri/icons/`（9 档 PNG + 7 层 ICO，已随构建更新）。
再生成方式：SVG → 无头 Edge 栅格化为 1024 PNG → Pillow 降采样出各档 PNG 与多图层 ICO。
