# Code Protocol

## 说明

- 这是 `ai/code` 运行层的协议文件
- 本文件承接 `ai/code` 运行任务执行前的高频约束

## 强制协议（Mandatory）

<!-- CODE 协议装载完成后，启动链必须继续装载 COMMAND.PROTOCOL.md；优先由 startup_protocol_loader 完成链式装载，不可用时再用 ai_memory_file_reader 逐个读取 -->
after_code_next_protocol_loader_prefer = startup_protocol_loader
after_code_must_load_next_protocol_via_ability = ai_memory_file_reader
after_code_next_protocol = ${PRT}COMMAND.PROTOCOL.md
command_protocol_loading_is_not_execution = true
command_protocol_loaded_is_prerequisite_for_command_task = true

<!-- 记忆库外的工程文件读取统一走完整读取能力 -->
outside_memory_library_use_memory_file_full_reader = true

<!-- 本项目内部 ai/code 能力系统中，AI 对外只调用 ability，不直接调用内部 skill 或 app -->
project_code_runtime_ai_calls_ability_only
project_code_runtime_skill_and_app_are_internal_dependencies

<!-- skill 作为 ability 的内部依赖 -->
skill_is_internal_dependency_of_ability

<!-- 所有工程项目任务默认进入 ai/code 能力系统，先检查是否已有 ability 覆盖 -->
all_engineering_project_tasks_enter_code_ability_system_by_default
check_existing_ability_before_code_task_execute
prefer_existing_ability_for_engineering_task = true

<!-- 已有 ability 可覆盖时，必须优先通过 executor.py 调用 -->
execute_existing_ability_via_executor = true

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
fallback_to_manual_execution_doc_rules_only_when_ability_unavailable = true

<!-- 新增 .py 文件前先读取模板 -->
read_code_template_before_new_py_file

## 读取链路（Routing）

<!-- Code 运行层优先读取 router -->
code_runtime_reads_router_early

<!-- Code 运行层优先读取 executor -->
code_runtime_reads_executor_early

<!-- Code 运行层按顺序读取 abilities skills apps 三类 registry -->
code_runtime_reads_registry_in_order

## 文件定位（Locations）

<!-- 以下路径均相对项目根目录，避免依赖已废弃的外部记忆目录 -->
path_root_is_project_root = true

<!-- ability 实体目录 -->
ability_root=MEMORIES/ai/code/abilities/

<!-- skill 实体目录 -->
skill_root=MEMORIES/ai/code/skill/

<!-- app 实体目录 -->
app_root=MEMORIES/ai/code/app/

<!-- 机器索引目录 -->
registry_root=MEMORIES/ai/code/registry/

<!-- Code 运行能力库位于 ai/code -->
code_runtime_root=MEMORIES/ai/code/

<!-- AI 任务执行前必须先检查是否已有对应 ability -->
check_existing_ability_before_code_execution

<!-- 执行时按 abilities skills apps 三类 registry 顺序校验依赖 -->
check_abilities_skills_and_apps_registry_in_order

<!-- 缺少 ability、skill 或 app 时，若任务具备复用价值或需要新增能力文件，先说明新增范围并等待用户确认 -->
ask_before_add_when_reusable_ability_or_dependency_is_missing

<!-- 新增 py 文件前先读取模板 -->
read_code_template_before_create_new_py_file

<!-- 模板文件不进入高频启动链 -->
code_template_is_not_in_high_frequency_startup_chain

<!-- 模板文件只在新增 py 文件时按需读取 -->
read_code_template_on_demand_only_when_creating_new_py_file

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

<!-- 禁止绕过 ai/code 直接执行重复、跨项目可复用或流程稳定且本应沉淀为能力的工程任务 -->
forbid_bypass_code_runtime_for_reusable_ability_suitable_task

<!-- 禁止在用户未确认前自行补全缺失依赖并继续执行 -->
forbid_auto_fill_missing_dependency_before_user_confirmation

<!-- 禁止直接调用本项目内部 skill -->
forbid_direct_project_internal_skill_invocation

<!-- 禁止直接调用本项目内部 app -->
forbid_direct_project_internal_app_invocation
