# SELPLAT 运行时修改后即时启动测试规则

<!-- 本规则直接约束 SELPLAT 修改任务的收口时机，不需要新增 Java、Python 或 Node 能力。 -->
java_ability_refs = none
<!-- 当前启动入口和 HTTP 检查已经可重复执行，不为本规则复制新的 Python 程序。 -->
python_ability_refs = none
<!-- 页面访问沿用真实 Host 和 HTTP 响应，不新增 Node 包装入口。 -->
node_ability_refs = none
<!-- 本规则首次固化运行时修改完成后立即启动的防跑偏门禁。 -->
rule_version = 1.0.0
<!-- 规则所有者由工程根 AGENTS.md 的当前稳定用户动态解析。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- active 表示本规则已经进入当前用户 SELPLAT 通用索引。 -->
rule_status = active
<!-- 本次升级来源于用户确认：不启动测试会让后续执行偏离真实运行状态。 -->
upgrade_record = 2026-08-20:运行时修改完成后立即执行目标启动冒烟测试_启动失败当场阻断_完整回归仍等待统一测试
<!-- 启动冒烟测试仍遵守 core 测试规则的命令、结果和失败报告约束。 -->
requires_rule_ids = CODE_TEST_RULES

<!-- 问题：只登记待统一测试而不实际启动，会让后续页面访问和实现判断建立在未运行的代码上。 -->
<!-- 场景：SELPLAT 可执行源码、运行时配置、模块登记或页面资源完成一轮可启动修改。 -->
<!-- 业务含义：每轮修改先回到真实运行状态，再继续页面交付或下一轮实现。 -->

<!-- 影响可执行源码时必须触发即时启动冒烟测试。 -->
selplat_immediate_startup_test_trigger = executable_source_change
<!-- 影响运行时配置时必须触发即时启动冒烟测试。 -->
selplat_immediate_startup_test_trigger.2 = runtime_configuration_change
<!-- 影响模块登记时必须触发即时启动冒烟测试。 -->
selplat_immediate_startup_test_trigger.3 = module_registration_change
<!-- 影响运行页面及其静态资源时必须触发即时启动冒烟测试。 -->
selplat_immediate_startup_test_trigger.4 = runtime_page_resource_change

<!-- 启动测试在一轮可启动修改完成后立即执行，禁止延后到页面交付之后。 -->
selplat_immediate_startup_test_timing = immediately_after_startable_change_batch
<!-- 启动测试必须早于下一轮依赖真实运行状态的实现。 -->
selplat_immediate_startup_test_timing.2 = before_next_runtime_dependent_change
<!-- 启动测试必须早于页面访问结论。 -->
selplat_immediate_startup_test_timing.3 = before_page_delivery

<!-- 能被统一 Host 装配的 SELPLAT 模块统一使用 Host 作为启动目标。 -->
selplat_immediate_startup_test_target = unified_platform_host_when_host_managed
<!-- 未被 Host 装配的独立工具只启动其唯一正式入口。 -->
selplat_immediate_startup_test_target.2 = unique_formal_entry_when_standalone

<!-- 启动冒烟测试至少验证进程没有提前退出。 -->
selplat_immediate_startup_test_evidence = process_remains_running
<!-- 存在健康接口时必须取得成功响应。 -->
selplat_immediate_startup_test_evidence.2 = health_endpoint_success_when_available
<!-- 页面或静态资源受影响时必须访问目标 URL 并取得成功响应。 -->
selplat_immediate_startup_test_evidence.3 = affected_page_http_success_when_applicable

<!-- 启动失败必须在当前任务内立即阻断，禁止继续给出页面可用结论。 -->
selplat_immediate_startup_failure_policy = block_current_task_and_repair_before_continuation
<!-- 失败原因和实际输出必须回写当前线程测试文档。 -->
selplat_immediate_startup_failure_policy.2 = record_actual_failure_in_current_test_document

<!-- 即时启动只属于目标冒烟门禁，不等价于完整统一测试。 -->
selplat_immediate_startup_test_boundary = targeted_startup_smoke_not_full_unified_test
<!-- 其他编译、单元、集成和完整回归仍保留待测试状态，直到用户明确提出统一测试。 -->
selplat_immediate_startup_test_boundary.2 = keep_remaining_regressions_pending_until_explicit_unified_test
<!-- 即时启动的实际结果可以单项回写，但不得借此把未执行项目标记为通过。 -->
selplat_immediate_startup_test_result_policy = update_only_executed_startup_item

