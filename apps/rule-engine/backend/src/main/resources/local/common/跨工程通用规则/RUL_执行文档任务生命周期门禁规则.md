# 执行文档任务生命周期门禁规则

<!-- 问题：执行文档能力只登记不接入任务与构建生命周期时，AI 可能遗漏创建、步骤回写或归档，规则存在却没有技术阻断。 -->
<!-- 场景：Codex 或本地开发者在任意工程开始正式修改、执行阶段验证并完成最终交付。 -->
<!-- 业务含义：独立 1、当前线程文档、真实步骤、构建门禁和历史归档形成一条不可跳过的任务链。 -->

<!-- 当前执行文档必须含当前 Codex 任务页面线程标识；不同页面不得共享授权、步骤或归档状态。 -->
execution_document_must_use_current_thread_id = true

<!-- 当前线程文件名固定带线程标识，非 Codex 本地调用使用 local，禁止回退写入旧共享文件。 -->
execution_document_filename = 执行文档.<CURRENT_THREAD_ID>.md
execution_document_non_codex_fallback_thread_id = local

<!-- 同日归档文件和锁文件必须携带相同线程标识，保证页面内串行、页面间隔离。 -->
execution_history_filename = 执行文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md
execution_document_lock_filename = 执行文档.<CURRENT_THREAD_ID>.lock

<!-- 线程标识优先由调用参数传入，未传时读取 Codex 页面环境；禁止扫描文件猜测当前页面。 -->
execution_document_thread_id_source = context.thread_id,then_CODEX_THREAD_ID,then_local

<!-- 正式任务只能通过 begin 创建，且必须把 USER 协议取得的独立 1、目标和步骤写入同一文档。 -->
execution_task_begin_gate = action_begin_requires_confirmation_1_goal_steps_and_current_thread

<!-- 每个完成步骤必须通过 step 写入真实结果，禁止只改内存计划或在最终答复中口头声称完成。 -->
execution_task_step_gate = action_step_requires_existing_step_number_and_actual_result

<!-- 快速、专项和全量开发门禁必须先执行 active，缺少授权、目标或步骤时立即以非零状态阻断。 -->
execution_task_active_gate = quick_special_full_gate_depend_on_action_active

<!-- 最终交付前必须执行 ready，任一步骤尚未回写时禁止进入归档。 -->
execution_task_ready_gate = root_delivery_requires_all_steps_completed_before_full_gate

<!-- 完整门禁成功后由 finish 再次核验并归档；验证失败时必须保留当前文档供继续修正。 -->
execution_task_finish_gate = root_check_runs_ready_then_full_gate_then_finish_archive

<!-- 正式生命周期只允许 check、begin、step、active、ready、finish，旧写动作不得继续作为生产入口。 -->
execution_task_public_actions = check,begin,step,active,ready,finish

<!-- Gradle 或其他外部门禁必须接收能力的非零退出码，禁止把业务阻断 JSON 当作命令成功。 -->
execution_task_process_exit_contract = blocked_or_unknown_action_returns_nonzero

<!-- Python 启动器保持跨平台配置；受限环境必须显式传入已验证解释器并取得所需权限，失败后禁止重复调用同一错误入口。 -->
execution_task_python_launcher = project_property_or_environment_override,verified_runtime_under_restricted_environment,no_committed_machine_absolute_path

<!-- 旧无线程执行文档仅可在首个线程文档不存在时原子迁移一次；迁移后仍必须通过 begin 写入独立 1 才能进入门禁。 -->
legacy_execution_document_must_migrate_once = true
legacy_execution_document_requires_reauthorization_before_gate = true

<!-- 统一能力、执行器退出码、构建依赖顺序、线程隔离和归档行为必须同时有自动化测试。 -->
execution_task_gate_verification = manager_unit_tests,executor_exit_code_test,gradle_task_dependency_test,thread_isolation_and_archive_regression
