# Code Protocol

## 说明

- 这是 rule-engine 多语言 core 运行层的协议文件
- 本文件承接分层规则和核心能力执行前的高频约束

## 强制协议（Mandatory）

<!-- CODE 协议装载完成后，启动链必须继续装载 COMMAND.PROTOCOL.md；由 Python startup_protocol_loader 清洗解析协议 DSL 并在任一资源缺失时阻断 -->
after_code_next_protocol_loader_prefer = startup_protocol_loader
after_code_must_load_next_protocol_via_ability = startup_protocol_loader
after_code_next_protocol = ${PRT}COMMAND.PROTOCOL.md
command_protocol_loading_is_not_execution = true
command_protocol_loaded_is_prerequisite_for_command_task = true

<!-- 工程文件读取必须保持 UTF-8 完整原文，禁止使用会清洗或截断正文的入口。 -->
project_file_read_must_preserve_complete_utf8_content = true

<!-- 生产执行代码按原语言进入 com.sp.selplat.local.code 的同名分层目录，禁止跨语言源根混放。 -->
production_java_code_root = src/main/java/com/sp/selplat/local/code/
production_python_code_root = src/main/python/com/sp/selplat/local/code/
production_node_code_root = src/main/node/com/sp/selplat/local/code/
production_code_languages = java,python,node

<!-- skill 作为 ability 的内部依赖 -->
skill_is_internal_dependency_of_ability

<!-- 所有工程项目任务默认进入多语言分层能力系统，先检查是否已有能力覆盖 -->
all_engineering_project_tasks_enter_code_ability_system_by_default
check_existing_ability_before_code_task_execute
prefer_existing_ability_for_engineering_task = true

<!-- 已登记能力可覆盖时必须按登记语言和分层入口复用，禁止为了统一实现语言而改写有效能力。 -->
execute_existing_ability_via_registered_language_entry = true
preserve_registered_ability_language_during_layer_migration = true

<!-- 只读调查、一次性低复用任务、紧急小修允许先执行，但收口时必须评估是否沉淀为 ability -->
allow_direct_execution_for_readonly_low_reuse_or_urgent_small_fix = true
evaluate_ability_growth_on_closeout = true

<!-- 重复出现、跨项目可复用或流程稳定的工程任务，必须新增或扩展 ability 后纳入 registry -->
repeated_or_cross_project_reusable_task_must_create_or_extend_ability = true
sync_abilities_registry_after_ability_change = true
verify_minimally_after_ability_change = true

<!-- 执行完成后必须把可复用步骤写入经验或记账，作为能力成长依据 -->
record_reusable_steps_to_experience_or_ledger_after_execution = true

<!-- 执行文档内务统一通过 execution_doc_manager 能力维护；任务前检查未完成任务，任务后归档完成记录 -->
execution_doc_management_ability = execution_doc_manager
use_execution_doc_manager_before_formal_task = true
execution_doc_manager_checks_unfinished_steps_before_new_task = true
execution_doc_manager_archives_completed_doc_after_task = true
<!-- 正式任务统一使用生命周期动作，禁止只读取规则后依靠人工记忆维护执行文档。 -->
execution_doc_manager_required_lifecycle = begin,step,active,ready,finish
formal_task_must_enter_unified_execution_document_gate = true
delivery_must_fail_when_execution_document_is_missing_unauthorized_pending_or_unarchived = true
fallback_to_manual_execution_doc_rules_only_when_ability_unavailable = true

<!-- 新增能力前必须按语言从根索引加载对应编码、测试与注释规则。 -->
load_language_specific_rules_before_new_ability = true

<!-- 一次工程任务必须先形成所有相关逻辑 ID 集合，禁止在首条用户规则命中后停止识别测试、分层或安全规则。 -->
task_rule_selection_unit = all_relevant_logical_ids_not_first_match_only
<!-- 规则集合必须递归补全有效 DSL 中 requires_rule_ids 的依赖闭包，循环依赖闭锁失败。 -->
task_rule_dependency_loading = recursive_requires_rule_ids_with_cycle_blocking
<!-- 每个逻辑 ID 都必须读取所有相关层，用户层命中不得阻断 core/common 的读取。 -->
same_logical_id_layer_loading = core_then_cross_project_common_then_matched_scope_common_then_active_user
<!-- 分层默认 extend：高层只覆盖同名 DSL 键，其他低层键继续有效；只有精确 override_mode=replace 才整份替换低层有效结果。 -->
layered_rule_default_override_mode = extend
<!-- 整份替换必须使用精确机器值，历史自然语义 override_mode 按 extend 兼容。 -->
layered_rule_explicit_full_replace = override_mode=replace
<!-- 同名 DSL 键冲突使用 active_user > matched_scope_common > cross_project_common > core。 -->
layered_rule_value_conflict_priority = active_user,matched_scope_common,cross_project_common,core
<!-- 正式执行前必须回执每个逻辑 ID 实际读取的层、物理路径和覆盖模式。 -->
task_rule_loading_receipt_required = logical_id,layer,resource_path,override_mode
<!-- 规则读取与规则写入权限分离；core/common 默认可读可执行但不可写，只有 USER 协议的明确委托和独立 1 可打开指定范围写入。 -->
core_common_default_access = readable_and_executable_but_not_writable
<!-- core/common 写入门必须同时具备明确目标和独立 1，读取不需要打开写入门。 -->
core_common_write_gate = explicit_target_plus_standalone_1

## 读取链路（Routing）

<!-- Code 运行层先加载 core 协议，再由唯一根索引对任务逻辑 ID 集合逐条执行分层叠加。 -->
code_runtime_loading_order = core_protocol -> root_RULE_INDEX -> matched_rule_id_set -> core_common_active_user_layer_stack

## 文件定位（Locations）

<!-- 以下路径均相对项目根目录，避免依赖已废弃的外部记忆目录 -->
path_root_is_project_root = true

<!-- core、common 与用户能力在 Java、Python、Node 下使用相同层名 -->
core_code_root=apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/core/
common_code_root=apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/common/
user_code_root_pattern=apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/<stable-user-id>/
core_python_code_root=apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/
common_python_code_root=apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/common/
user_python_code_root_pattern=apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/<stable-user-id>/
core_node_code_root=apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/core/
common_node_code_root=apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/common/
user_node_code_root_pattern=apps/rule-engine/backend/src/main/node/com/sp/selplat/local/code/<stable-user-id>/

<!-- 机器索引作为已退役记忆库的初始迁移快照保存在 core；实体迁入 Python/Node core 后必须同步其登记路径。 -->
registry_root=apps/rule-engine/backend/src/main/resources/local/core/registry/
legacy_registry_entry_status=language_native_core_paths_active

<!-- AI 任务执行前必须先检查是否已有对应 ability -->
check_existing_ability_before_code_execution

<!-- 执行时只解析根 RULE_INDEX 显式登记的逻辑 ID 和当前用户覆盖。 -->
check_root_rule_index_explicit_logical_id_before_execution = true

<!-- 缺少 ability、skill 或 app 时，若任务具备复用价值或需要新增能力文件，先说明新增范围并等待用户确认 -->
ask_before_add_when_reusable_ability_or_dependency_is_missing

<!-- 迁移期遗留源只允许作为原语言搬迁输入，不得继续新增；完成调用路径和测试切换前保留既有入口。 -->
legacy_source_policy = read_for_language_native_move_only,no_new_authoring,retain_verified_entry_until_cutover

## 结构说明（Structure）

<!-- skill 表示单技能 -->
skill_means_single_skill_unit

<!-- app 表示能力内部依赖的应用入口 -->
app_means_internal_application_entry

<!-- abilities 表示 AI 可调用的能力入口 -->
abilities_mean_ai_callable_entries

## 调用规则（Invocation Rules）

<!-- ability 可以组合已有 skill 与 app -->
ability_can_compose_skills_and_apps

<!-- AI 执行本项目内部 ability 时优先通过 executor -->
prefer_executor_for_ability_execution

<!-- AI 需要先解析 ability，再由 ability 按依赖顺序调用内部 skill 与 app -->
read_ability_then_invoke_internal_dependencies_in_order

<!-- 具备复用价值的单 skill 任务，也应包装成 ability 后沉淀 -->
wrap_reusable_single_skill_task_as_ability_before_execution

## 缺失处理（Missing Dependencies）

<!-- 缺少 ability 时，若任务是重复、跨项目可复用或流程稳定任务，必须提示并询问是否新增或扩展 ability -->
ask_before_add_or_extend_ability_for_reusable_task

<!-- ability 存在但内部 skill 不完整时，必须提示并询问是否新增依赖 -->
ask_before_add_when_internal_skill_dependency_is_missing

<!-- ability 存在但内部 app 不完整时，必须提示并询问是否新增依赖 -->
ask_before_add_when_internal_app_dependency_is_missing

## 禁止事项（Forbidden）

<!-- 禁止绕过多语言分层运行时直接执行重复、跨项目可复用或流程稳定且本应沉淀为能力的工程任务 -->
forbid_bypass_code_runtime_for_reusable_ability_suitable_task

<!-- 禁止在用户未确认前自行补全缺失依赖并继续执行 -->
forbid_auto_fill_missing_dependency_before_user_confirmation

<!-- 禁止直接调用本项目内部 skill -->
forbid_direct_project_internal_skill_invocation

<!-- 禁止直接调用本项目内部 app -->
forbid_direct_project_internal_app_invocation
