# rule-engine backend

这里保存按规则运行所需的分层加载、Python 能力、规则包资产和离线验证入口。

当前主线：

- 启动协议只建立执行边界和唯一规则索引入口，不批量加载全部规则。
- AI 根据任务、当前工程作用域和当前用户命中最少必要规则。
- 规则通过模板、案例、程序和验证资产约束执行结果，重复偏差推动规则包持续升级。
- XUNAN 的正式能力程序统一使用 Python；`abilities` 保存完整业务能力，`util` 只保存共享实现。
- Java 与 Node 旧能力完成 Python 等价迁移后删除，不再参与构建或运行。

当前状态：规则分层、索引治理和 Python 能力入口已经运行。

Python 运行时依赖登记在 `requirements-python.txt`。rule-engine 不注册为 Gradle 子项目，
也不启动常驻 HTTP 服务；规则加载器、执行器和 abilities 由 Codex、根门禁或明确的 Python
命令按任务调用，工程不保存机器绝对路径。

运行边界：

- 唯一服务端 HTTP 入口是 Host 的 `8080`。
- rule-engine 不提供健康检查、静态页面转发或桌面代理端口。
- Python 解释器只按任务运行规则加载、执行和可重复能力，命令结束后进程退出。

Python 验证：

- 全量：`python3 apps/ai-desktop/ruleengine/backend/src/test/python/run_tests.py all`
- core：`python3 apps/ai-desktop/ruleengine/backend/src/test/python/run_tests.py core`
- XUNAN：`python3 apps/ai-desktop/ruleengine/backend/src/test/python/run_tests.py XUNAN`
- 统一入口会把 `.pyc` 写入工程 `cache/python-pycache`，不得直接使用会在源码旁生成 `__pycache__` 的裸测试命令。

分层规则加载：

- 唯一实现：`src/main/python/com/sp/selplat/local/code/core/abilities/layered_rule_loader.py`
- 注册入口：`layered_rule_loader`
- 加载顺序：`core → 跨工程 common → 当前 common 作用域 → 当前用户`
- 同一 Python 进程会复用未变化的 UTF-8 资源快照，避免 JVM 启动和重复磁盘读取。

测试文档与统一测试：

- 每次修改后通过 `test_doc_manager record` 把验证内容写入 `OPTION/测试文档.<线程ID>.md`。
- 每项必须记录变更内容、测试命令和预期结果；相同标题与命令不会重复登记。
- 用户提出“统一测试”后按文档逐项执行，并通过 `result` 回写通过或失败；全部通过后调用 `finish` 归档。
- 根 `check` 是手动全量测试入口，不再负责每次修改后的执行文档归档。

规则智慧整合入口：

- 当前用户：`XUNAN`
- 当前工程：`SELPLAT`
- 规则：`src/main/resources/local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md`
- 程序：`python3 apps/ai-desktop/ruleengine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/ai_rule_package_integrator.py '{"action":"audit"}'`
