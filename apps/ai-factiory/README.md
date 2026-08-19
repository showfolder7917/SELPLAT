# ai-factory 服务端控制面

`ai-factiory` 是可独立部署的 Java HTTP 服务。它登记角色与 Agent、保存任务和阶段权威状态、接收本地 Python 上报的产物/Gate/Agent 事实，并提供只读进度页面。

服务端不会启动 Agent、连接 Codex、执行本地 Gate 或读取本地任务正文。开发数据库生成到 `OPTION/temp/ai-factory/服务端开发数据/数据库`。

待统一测试通过后，可从工程根启动：

```bash
./gradlew :apps:ai-factiory:backend:run
```

只读页面地址为 `/aifactory/aifactory.html`。
