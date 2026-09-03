# 水晶科技主题

- 稳定 ID：`crystal-tech`
- 主题定义：当前目录的 `manifest.js`、`theme.css` 和 `modes/`
- 独占素材：`../../../assets/themes/crystal-tech/`
- 素材布局：`<mode>/base/` 保存基础皮肤的 `frame.webp` 与 `background.webp`；`<mode>/accents/<accent-id>/` 保存该颜色皮肤成对的同名素材
- 边界：manifest 只能自动引用 `../../../assets/themes/crystal-tech/` 中的背景，不得引用其他主题或公共背景

新增深浅模式或 Accent 时，必须同步更新 manifest、对应模式令牌、独占素材和资源结构测试。
