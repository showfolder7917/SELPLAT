# shared frontend

这里保存 SELPLAT 唯一正式公共前端模块。

## 当前结构

```text
shared/frontend/
├─ README.md
└─ sel-ui/
```

`sel-ui` 是原生 JavaScript 公共组件、主题契约、主题包和运行素材的唯一源码来源，并通过 Gradle 标准资源 JAR 发布到 `/sel/**`。

组件、运行时、主题和素材必须继续进入 `sel-ui/src` 的对应职责目录，禁止在 `shared/frontend` 下建立平行的 `components`、`composables`、`services`、`theme` 或 `utils` 源码根。

旧静态玻璃主题及占位目录已经退役，恢复材料位于：

```text
OPTION/recovery/shared-frontend-legacy-20260813/
```

恢复材料只用于历史追溯，不得未经 `sel-ui` 主题契约适配直接恢复为正式运行入口。
