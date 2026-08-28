# 执行文档任务生命周期门禁规则

<!-- 当前用户规则物理层始终从 AGENTS.md 当前稳定用户解析并进入 local/<stable-user-id>。 -->
rule_resource_layer_source = AGENTS.md.current_stable_user_id

<!-- 问题：执行文档能力只登记不接入任务与构建生命周期时，AI 可能遗漏创建、步骤回写或归档，规则存在却没有技术阻断。 -->
<!-- 场景：Codex 或本地开发者在任意工程开始正式修改、执行阶段验证并完成最终交付。 -->
<!-- 业务含义：独立 1、当前线程文档、真实步骤、构建门禁和历史归档形成一条不可跳过的任务链。 -->

<!-- 当前执行文档必须含当前 Codex 任务页面线程标识；不同页面不得共享授权、步骤或归档状态。 -->
execution_document_must_use_current_thread_id = true

<!-- 当前线程文件名固定带线程标识，非 Codex 本地调用使用 local，禁止回退写入旧共享文件。 -->
execution_document_filename = 执行文档.<CURRENT_THREAD_ID>.md
<!-- execution_document_non_codex_fallback_thread_id 的当前独立事实为 local。 -->
execution_document_non_codex_fallback_thread_id = local

<!-- 同日归档文件和锁文件必须携带相同线程标识，保证页面内串行、页面间隔离。 -->
execution_history_filename = 执行文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md
<!-- execution_document_lock_filename 的当前独立事实为 执行文档.<CURRENT_THREAD_ID>.lock。 -->
execution_document_lock_filename = 执行文档.<CURRENT_THREAD_ID>.lock

<!-- 线程标识优先由调用参数传入，未传时读取 Codex 页面环境；禁止扫描文件猜测当前页面。 -->
execution_document_thread_id_source = context.thread_id
<!-- execution_document_thread_id_source.2 的当前独立事实为 then_CODEX_THREAD_ID。 -->
execution_document_thread_id_source.2 = then_CODEX_THREAD_ID
<!-- execution_document_thread_id_source.3 的当前独立事实为 then_local。 -->
execution_document_thread_id_source.3 = then_local

<!-- 正式任务只能通过 begin 创建，且必须把 USER 协议取得的独立 1、目标和步骤写入同一文档。 -->
execution_task_begin_gate = action_begin_requires_confirmation_1_goal_steps_and_current_thread

<!-- 每个完成步骤必须通过 step 写入真实结果，禁止只改内存计划或在最终答复中口头声称完成。 -->
execution_task_step_gate = action_step_requires_existing_step_number_and_actual_result

<!-- 快速、专项和全量开发门禁必须先执行 active，缺少授权、目标或步骤时立即以非零状态阻断。 -->
execution_task_active_gate = quick_special_full_gate_depend_on_action_active

<!-- 最终交付前必须执行 ready，任一步骤尚未回写时禁止进入归档。 -->
execution_task_ready_gate = task_close_requires_all_steps_completed

<!-- 修改任务完成时只在测试文档登记验证责任，不自动重复运行测试；用户明确触发统一测试后再逐项回写。 -->
test_document_filename = 测试文档.<CURRENT_THREAD_ID>.md
<!-- test_history_filename 的当前独立事实为 测试文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md。 -->
test_history_filename = 测试文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md
<!-- test_document_thread_id_source 的当前独立事实为 same_as_execution_document。 -->
test_document_thread_id_source = same_as_execution_document
<!-- change_close_requires_test_document_record 的当前独立事实为 title。 -->
change_close_requires_test_document_record = title
<!-- change_close_requires_test_document_record.2 的当前独立事实为 change。 -->
change_close_requires_test_document_record.2 = change
<!-- change_close_requires_test_document_record.3 的当前独立事实为 command。 -->
change_close_requires_test_document_record.3 = command
<!-- change_close_requires_test_document_record.4 的当前独立事实为 expected_result。 -->
change_close_requires_test_document_record.4 = expected_result
<!-- test_execution_timing 的当前独立事实为 defer_until_user_requests_unified_testing。 -->
test_execution_timing = defer_until_user_requests_unified_testing
<!-- test_result_status 的当前独立事实为 待测试。 -->
test_result_status = 待测试
<!-- test_result_status.2 的当前独立事实为 通过。 -->
test_result_status.2 = 通过
<!-- test_result_status.3 的当前独立事实为 失败。 -->
test_result_status.3 = 失败
<!-- test_document_finish_requires 的当前独立事实为 no_pending_item + no_failed_item。 -->
test_document_finish_requires = no_pending_item + no_failed_item

<!-- 执行文档与测试文档生命周期解耦：执行步骤和待测内容登记完成即可关闭修改任务，测试文档持续保留。 -->
execution_task_finish_gate = ready_then_test_document_pending_then_finish_archive
<!-- root_check_role 的当前独立事实为 manual_unified_full_test_entry。 -->
root_check_role = manual_unified_full_test_entry
<!-- unverified_change_handoff_requires 的当前独立事实为 explicit_pending_test_document_path_and_items。 -->
unverified_change_handoff_requires = explicit_pending_test_document_path_and_items

<!-- 正式生命周期只允许 check、begin、step、active、ready、finish，旧写动作不得继续作为生产入口。 -->
execution_task_public_actions = check
<!-- execution_task_public_actions.2 的当前独立事实为 begin。 -->
execution_task_public_actions.2 = begin
<!-- execution_task_public_actions.3 的当前独立事实为 step。 -->
execution_task_public_actions.3 = step
<!-- execution_task_public_actions.4 的当前独立事实为 active。 -->
execution_task_public_actions.4 = active
<!-- execution_task_public_actions.5 的当前独立事实为 ready。 -->
execution_task_public_actions.5 = ready
<!-- execution_task_public_actions.6 的当前独立事实为 finish。 -->
execution_task_public_actions.6 = finish

<!-- execution_task_public_actions.7 的当前独立事实为一次写入多个步骤结果。 -->
execution_task_public_actions.7 = complete_steps

<!-- 测试文档通过一次写入接收多个测试结果。 -->
test_document_batch_result_action = complete_tests

<!-- 两份文档均就绪后通过一次能力调用完成统一归档。 -->
task_document_unified_archive_action = finish_all

<!-- 批量动作必须在同一文件锁中只写入一次目标文档。 -->
task_document_batch_write_contract = one_lock_and_one_write_per_document

<!-- Gradle 或其他外部门禁必须接收能力的非零退出码，禁止把业务阻断 JSON 当作命令成功。 -->
execution_task_process_exit_contract = blocked_or_unknown_action_returns_nonzero

<!-- Python 启动器保持跨平台配置；受限环境必须显式传入已验证解释器并取得所需权限，失败后禁止重复调用同一错误入口。 -->
execution_task_python_launcher = project_property_or_environment_override
<!-- execution_task_python_launcher.2 的当前独立事实为 verified_runtime_under_restricted_environment。 -->
execution_task_python_launcher.2 = verified_runtime_under_restricted_environment
<!-- execution_task_python_launcher.3 的当前独立事实为 no_committed_machine_absolute_path。 -->
execution_task_python_launcher.3 = no_committed_machine_absolute_path

<!-- 旧无线程执行文档仅可在首个线程文档不存在时原子迁移一次；迁移后仍必须通过 begin 写入独立 1 才能进入门禁。 -->
legacy_execution_document_must_migrate_once = true
<!-- legacy_execution_document_requires_reauthorization_before_gate 的当前独立事实为 true。 -->
legacy_execution_document_requires_reauthorization_before_gate = true

<!-- 统一能力、执行器退出码、构建依赖顺序、线程隔离和归档行为必须同时有自动化测试。 -->
execution_task_gate_verification = execution_and_test_manager_unit_tests
<!-- execution_task_gate_verification.2 的当前独立事实为 executor_exit_code_test。 -->
execution_task_gate_verification.2 = executor_exit_code_test
<!-- execution_task_gate_verification.3 的当前独立事实为 gradle_task_dependency_test。 -->
execution_task_gate_verification.3 = gradle_task_dependency_test
<!-- execution_task_gate_verification.4 的当前独立事实为 thread_isolation_and_archive_regression。 -->
execution_task_gate_verification.4 = thread_isolation_and_archive_regression
