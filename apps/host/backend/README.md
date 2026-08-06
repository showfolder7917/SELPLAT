# host backend

这里是 SELPLAT 的 platform-runtime 后端，是统一进程和统一 HTTP 端口的唯一目标启动入口。

当前职责：

- `PlatformRuntimeApplication`：启动 Spring Boot 宿主。
- `config`：显式导入可运行模块，避免扫描全部应用造成独立启动类和数据源冲突。
- `controller`：提供平台运行状态和后续平台级路由。
- `application.properties`：维护宿主端口和平台级配置。

当前装配模块：

- `reference-data:backend`

暂未装配模块：

- `uniauth:backend`：当前仍拥有独立 `SpringApplication`、端口和单数据源配置，后续需要先完成模块化与多数据源边界。
- `mda:backend`：开发工具是否进入正式宿主需要独立决策。
- `rule-engine:backend`：当前是独立应用，不在本次骨架范围。

开发启动：

```powershell
.\scripts\startup\start-host.ps1
```

健康检查：

```text
GET http://localhost:8080/api/platform/runtime/health
```

新增业务模块时，必须同时更新 Gradle 依赖、显式模块配置、manifest、module metadata、测试和本 README。
