# SEL UI 公共前端

本模块是 SELPLAT 原生 JavaScript 公共组件、主题契约和运行素材的唯一源码来源。

## 目录边界

- `src/core`：基础运行时、国际化和通用请求工具。
- `src/components`：表格、树、窗口、面板等基础控件。
- `src/components/component-registry.json`：公共控件唯一中央登记；新增控件必须先登记，未登记目录、源码、依赖或业务私造交互由门禁阻断。
- `src/theme`：主题契约、主题注册器和 `packs/<theme-id>` 主题定义。
- `src/assets/themes/<theme-id>`：主题独占边框、纹理和配套背景，目录 ID 与主题包一致。
- `src/assets/components/<component>`：不随主题切换的组件专属素材。
- `src/assets/backgrounds`：只由用户在背景面板独立选择的公共背景，不作为主题自动配套素材。
- `src/assets/shared`：至少被两个基础控件真实复用的其他公共素材；没有真实复用时不建立空目录。

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
终端二：./gradlew :apps:host:backend:signalDevReload --continuous --offline
```

第二个终端不启动服务，只负责完成本模块及 Java 产物更新；所有模块写入完成后会生成独立开发快照，
再更新安全触发文件并由 Host 的 DevTools 自动重启。整个页面系统仍只使用 `8080` 一个 HTTP 端口。

Vite 的压缩、内容 Hash 和 manifest 属于生产构建阶段。当前工程缓存尚未提供 Vite、Rollup 和 esbuild 离线依赖，因此本模块暂不提交无法离线执行的伪构建配置；离线依赖补齐后再原子增加 `package.json`、`vite.config.js` 和生产构建验证。
