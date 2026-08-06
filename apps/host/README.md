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
              ├── 显式装配 reference-data、uniauth 等业务模块
              └── 统一发布 shared/frontend/sel-ui 公共资源
```

当前 Host 已显式装配 `reference-data` 与 `uniauth`，并通过一个 `8080` 端口发布 Uniauth 页面和 `/sel/**` 公共资源。Uniauth 仍保留独立启动入口，但业务模块配置已经与启动类分离，Host 不会启动第二个 Web 容器。
