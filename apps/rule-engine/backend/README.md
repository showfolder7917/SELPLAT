# rule-engine backend

这里保存按规则运行所需的分层加载、语言原生能力、规则包资产和离线验证入口。

当前主线：

- 启动协议只建立执行边界和唯一规则索引入口，不批量加载全部规则。
- AI 根据任务、当前工程作用域和当前用户命中最少必要规则。
- 规则通过模板、案例、程序和验证资产约束执行结果，重复偏差推动规则包持续升级。
- Java、Python、Node 程序保持原语言实现，并通过 ability 入口复用。

当前状态：规则分层和索引治理已经运行；规则包资产与程序引用仍在持续补全。Java 21 健康服务只用于离线容器验证，不代表传统规则执行链。

运行方式：

- 编译：`.\gradlew.bat --offline --console plain :apps:rule-engine:backend:classes`
- 启动：`.\gradlew.bat --offline --console plain :apps:rule-engine:backend:run`
- 启动验证：`.\gradlew.bat --offline --console plain :apps:rule-engine:backend:run --args=--verify`
- 健康检查：`http://localhost:8081/rule-engine/health`

Python 验证：

- 全量：`python3 apps/rule-engine/backend/src/test/python/run_tests.py all`
- core：`python3 apps/rule-engine/backend/src/test/python/run_tests.py core`
- XUNAN：`python3 apps/rule-engine/backend/src/test/python/run_tests.py XUNAN`
- 统一入口会把 `.pyc` 写入工程 `cache/python-pycache`，不得直接使用会在源码旁生成 `__pycache__` 的裸测试命令。

规则智慧整合入口：

- 当前用户：`XUNAN`
- 当前工程：`SELPLAT`
- 规则：`src/main/resources/local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md`
- 程序：`python3 apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/ai_rule_package_integrator.py '{"action":"audit"}'`
