# ai-factory 服务端控制面

`ai-factiory` 是由 SELPLAT Host 装配的 Java 服务端模块。它登记角色与 Agent、保存任务和阶段权威状态、接收本地 Python 上报的产物/Gate/Agent 事实，并提供只读进度页面。

服务端不会启动 Agent、连接 Codex、执行本地 Gate 或读取本地任务正文。AI 工厂正式运行数据库固定在 `apps/ai-factiory/db` 并由根 `.gitignore` 排除；Git 只提交 `db/sql/**` 等可重建定义。测试库、审计日志、备份和其他运行生成物仍进入 `OPTION/temp/ai-factory`。

AI 工厂不提供模块级启动入口，只随 SELPLAT Host 启动，也不维护额外的本地工作流驱动应用。

待统一测试通过后，从 SELPLAT 工程根启动：

```bash
启动SELPLAT.ps1
```

该入口在平台 8080 端口发布 AI 工厂控制面和 `/aifactory/aifactory.html` 页面。
