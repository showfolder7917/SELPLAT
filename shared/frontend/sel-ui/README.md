# SEL UI 公共前端

本模块是 SELPLAT 原生 JavaScript 公共组件、主题契约和运行素材的唯一源码来源。

## 目录边界

- `src/core`：基础运行时、国际化和通用请求工具。
- `src/components`：表格、树、窗口、面板等基础控件。
- `src/theme`：主题契约、主题注册器和主题包。
- `src/assets`：背景、边框、光标等网页运行素材。

公共代码只接收宿主节点、标准数据、选项和回调，不得保存 Uniauth、MDA 等应用实体、接口地址或 mock 路径。

## 开发与发布

当前离线开发由 Gradle 将源码打入标准资源 JAR：

```text
src/** → META-INF/resources/sel/** → http://127.0.0.1:8080/sel/**
```

Uniauth、Host 和后续项目均依赖本模块，不复制 `/sel` 源码。浏览器地址不因源码归属变化而改变。

日常开发从统一 Host 启动：

```text
终端一：./gradlew :apps:host:backend:run --offline
终端二：./gradlew :apps:host:backend:classes --continuous --offline
```

第二个终端不启动服务，只负责把本模块及 Java 变化更新到运行类路径；Host 的 DevTools 随后自动重启。整个页面系统仍只使用 `8080` 一个 HTTP 端口。

Vite 的压缩、内容 Hash 和 manifest 属于生产构建阶段。当前工程缓存尚未提供 Vite、Rollup 和 esbuild 离线依赖，因此本模块暂不提交无法离线执行的伪构建配置；离线依赖补齐后再原子增加 `package.json`、`vite.config.js` 和生产构建验证。
