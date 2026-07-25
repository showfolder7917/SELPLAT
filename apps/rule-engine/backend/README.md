# rule-engine backend

这里放规则引擎后端实现。

适合内容：

- `parser/`
- `validator/`
- `executor/`
- `adapter/`
- `api/`

当前状态：已接入 Java 21 最小运行骨架，使用 JDK 内置 HTTP 服务保证离线可运行。

运行方式：

- 编译：`.\gradlew.bat --offline --console plain :apps:rule-engine:backend:classes`
- 启动：`.\gradlew.bat --offline --console plain :apps:rule-engine:backend:run`
- 启动验证：`.\gradlew.bat --offline --console plain :apps:rule-engine:backend:run --args=--verify`
- 健康检查：`http://localhost:8081/rule-engine/health`

当前启动入口只负责建立独立后端容器；规则解析、校验、执行和调试能力按对应业务契约继续增量接入。
