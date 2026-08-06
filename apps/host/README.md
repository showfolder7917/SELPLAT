# host

这里是 SELPLAT 的 platform-runtime 宿主模块，不承载具体业务数据和业务规则。

负责内容：

- 平台启动入口
- 模块装配
- 路由挂载
- 平台壳布局
- 平台级配置
- 单一 Spring Boot 进程与统一 HTTP 端口
- 显式装配可启用的业务模块

不负责内容：

- CRM、CMS、考勤等业务私有实现
- 其他项目的 DAO、数据库表和本地事务

启动关系：

```text
scripts/startup/start-host.ps1
              │
              ▼
apps/host/backend
              │
              └── 显式装配 reference-data 等模块
```

当前阶段先装配 `reference-data` 框架。Uniauth 的独立启动类和单数据源配置尚未迁入宿主，必须在后续多数据源任务中单独接入，禁止在本次骨架中隐式合并。
