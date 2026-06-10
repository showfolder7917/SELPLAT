# theme

这里放前端共享主题能力与正式主题包。

适合内容：

- 主题变量
- 主题皮肤
- 平台壳主题规则
- 可被多个模块直接消费的正式主题包

当前已接入主题：

- `glass-theme`

当前玻璃主题家族：

- `glass-theme`
  当前包含 `11` 套皮肤：
  - `indigo-amber-dark`
  - `cyan-amber-dark`
  - `emerald-aqua-dark`
  - `violet-rose-dark`
  - `crimson-amber-dark`
  - `cobalt-mint-dark`
  - `slate-lime-dark`
  - `ivory-pearl-light`
  - `champagne-blush-light`
  - `frost-sky-light`
  - `sage-cream-light`

使用入口：

- 家族静态预览入口：`glass-theme/index.html`
  当前为左侧皮肤列表、右侧常驻完整预览的双栏浏览模式。
- 皮肤样式入口：`glass-theme/skins/<skin-name>/skin-components.css`

放置原则：

- 共享主题包进入这里。
- 只属于单业务且不会复用的临时皮肤，不建议放到共享层。
