# theme

这里放前端共享主题能力与正式主题包。

适合内容：

- 主题变量
- 主题皮肤
- 平台壳主题规则
- 可被多个模块直接消费的正式主题包

当前已接入主题：

- `glass-theme`

兼容保留目录：

- `_legacy/`
  仅用于保留重构前的旧皮肤目录快照，后续消费应以 `glass-theme` 为准。

当前玻璃主题家族：

- `glass-theme`
  当前包含两套皮肤：
  - `indigo-amber-dark`
  - `cyan-amber-dark`

使用入口：

- 家族静态预览入口：`glass-theme/index.html`
- 皮肤样式入口：`glass-theme/skins/<skin-name>/skin-components.css`

放置原则：

- 共享主题包进入这里。
- 只属于单业务且不会复用的临时皮肤，不建议放到共享层。
