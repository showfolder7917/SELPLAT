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
启动SELPLAT.ps1 / 启动SELPLAT.bat
              │
              ├── 结束占用 8080 的旧进程
              ▼
apps/host/backend
              │
              ├── 显式装配服务端业务模块
              └── 统一发布 shared/frontend/sel-ui 公共资源
```

当前 Host 已显式装配 `reference-data`、`uniauth`、`mda`、`ai-factiory` 与 `japanese`，并通过一个 `8080` 端口发布业务页面和 `/sel/**` 公共资源。服务端业务模块不提供面向用户的独立启动入口；`apps/ai-desktop` 是独立桌面应用，不参与本入口。

统一桌面入口：

```text
http://127.0.0.1:8080/desktop/desktop.html
```

桌面的每个图标对应一个工程，点击后在新标签页打开现有页面。入口当前来自 `applications.json`，字段已预留 `permissionCode`，未来可由后端按权限返回同结构 JSON。
