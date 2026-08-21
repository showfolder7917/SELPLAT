# ai-factory 服务端控制面

`ai-factiory` 是可独立部署的 Java HTTP 服务。它登记角色与 Agent、保存任务和阶段权威状态、接收本地 Python 上报的产物/Gate/Agent 事实，并提供只读进度页面。

服务端不会启动 Agent、连接 Codex、执行本地 Gate 或读取本地任务正文。AI 工厂正式运行数据库固定在 `apps/ai-factiory/db` 并由根 `.gitignore` 排除；Git 只提交 `db/sql/**` 等可重建定义。测试库、审计日志、备份和其他运行生成物仍进入 `OPTION/temp/ai-factory`。

AI 工厂只暴露应用根级统一启动入口；不要把 backend 当作人工启动入口。`ai-memory` 是独立应用，仍由它自己的入口单独启动，不随 AI 工厂启动。

待统一测试通过后，从 SELPLAT 工程根启动：

```bash
./gradlew :apps:ai-factiory:run
```

该入口统一启动 8091 Java 控制面和 `/aifactory/aifactory.html` 页面。
