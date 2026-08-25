# host backend

这里是 SELPLAT 的 platform-runtime 后端，是统一进程和统一 HTTP 端口的唯一目标启动入口。

当前职责：

- `PlatformRuntimeApplication`：启动 Spring Boot 宿主。
- `config`：显式导入服务端业务模块，避免扫描全部应用造成数据源边界冲突。
- `controller`：提供平台运行状态和后续平台级路由。
- `application.properties`：维护宿主端口和平台级配置。

当前装配模块：

- `reference-data:backend`
- `uniauth:backend`
- `mda:backend`
- `ai-factiory:backend`
- `japanese:backend`
- `shared:frontend:sel-ui`：通过 `/sel/**` 发布唯一公共组件、主题和素材。

不参与统一服务端启动：

- `rule-engine:backend`：Python 规则能力不注册为 Gradle 子项目。
- `ai-desktop`：Electron 桌面应用保持自己的 npm 构建、启动和发行生命周期。

开发启动：

```powershell
.\启动SELPLAT.ps1
```

健康检查：

```text
GET http://localhost:8080/api/platform/runtime/health
```

Uniauth 与公共前端：

```text
http://127.0.0.1:8080/uniauth/uniauth.html
http://127.0.0.1:8080/sel/core/selBaseRuntime.js
```

开发期自动重启采用两个终端，但只有 Host 使用 `8080` 端口：

```text
终端一：./gradlew :apps:host:backend:run --offline
终端二：./gradlew :apps:host:backend:signalDevReload --continuous --offline
```

终端二只监听 Java、资源和共享前端源码变化并重新编译；全部模块 JAR 写入完成后，
先将工程依赖展开到独立开发快照，再由 `signalDevReload` 更新 `reload.trigger`。
DevTools 随后从完整快照安全重启 Host，不会与 Gradle 正在写入的 JAR 共用文件。生产运行不使用 `--continuous`。

新增业务模块时，必须同时更新 Gradle 工程登记、Host 依赖、显式模块配置、桌面应用清单、测试和本 README。
