# rule-engine 全局规则索引

<!-- 问题：core 与当前用户多个工程作用域需要从一个稳定入口按层定位。 -->
<!-- 场景：启动后按任务命中逻辑 ID，并根据当前用户身份加载最少规则。 -->
<!-- 业务含义：冻结 core 由根索引直接登记，common 保留空提升入口，实际业务规则由当前用户索引递归进入。 -->

project_resource_index_scope = apps/ai-desktop/ruleengine
rule_engine_layer_migration_status = common_consolidated_to_active_user_core_frozen
rule_engine_hierarchical_index_status = active_core_refrozen
rule_engine_core_resource_root = local/core/
rule_engine_common_resource_root = local/common/
<!-- common 资源层只保留空索引，实际规则全部由当前稳定用户索引承载。 -->
rule_engine_common_resource_status = reserved_empty
rule_engine_user_resource_root_pattern = local/<stable-user-id>/
<!-- rule-engine 是 Python 与规则资源工程，不承载 Java、Node 源码。 -->
rule_engine_supported_program_language = python
rule_engine_core_python_root = ../python/local/core/
rule_engine_common_python_root = ../python/local/common/
<!-- common Python 根只保留未来人工提升模式，当前没有生产实体。 -->
rule_engine_common_python_status = reserved_empty
rule_engine_user_python_root_pattern = ../python/local/<stable-user-id>/
core_startup_protocol_loader = ../python/local/core/abilities/startup_protocol_loader.py
core_layered_rule_loader = ../python/local/core/abilities/layered_rule_loader.py
<!-- CODE 协议的可复用成果沉淀目标已经收敛为 ability 或规则。 -->
core_code_protocol_recording_target = ability_or_rule

project_rule_loading_order = root_RULE_INDEX -> reserved_common_index -> active_user_index
target_layered_rule_loading_order = local/core -> local/common_reserved_empty -> local/active_user
target_layered_rule_conflict_priority = local/active_user > local/core
<!-- 一次任务以相关逻辑 ID 集合为加载单位，并递归补全显式依赖。 -->
task_rule_loading_unit = matched_logical_id_set_plus_requires_rule_ids_dependency_closure
<!-- 同一逻辑 ID 先读取所有相关层，再生成唯一有效 DSL 值。 -->
same_logical_id_loading_policy = read_all_relevant_layers_then_merge_effective_values
<!-- 用户层未明确整份替换时默认扩展低层规则。 -->
same_logical_id_default_override_mode = extend
<!-- 只有精确 override_mode=replace 可以清除低层有效结果。 -->
same_logical_id_explicit_replace_mode = override_mode=replace
<!-- extend 模式下未冲突的 core/common 键继续有效。 -->
same_logical_id_non_conflicting_lower_values = retained
<!-- 执行前回执逻辑 ID、已读层、路径和覆盖模式。 -->
task_rule_loading_receipt = logical_id,all_loaded_layers,resource_paths,override_mode
<!-- core/common 默认可读可执行但不可写。 -->
core_common_default_runtime_access = readable_and_executable_not_writable
<!-- 分层加载正式启用必须同时具备索引、规则集合、依赖、回执、调用和测试证据。 -->
layered_loading_activation_requires = indexes,recursive_loader,scope_selection,rule_bundles,dependency_closure,receipts,registries,call_paths,build,tests
protected_protocol_priority = STARTER,USER,CODE,COMMAND,GENERATOR_REPAIR_PROTOCOL > project_resource_rule
user_confirmation_protocol = local/core/protocol/USER.PROTOCOL.md
project_rule_conflict_scope = same_topic,same_applicability
resource_path_change_maintenance = update_owning_leaf_index_and_validate_parent_chain
rule_main_file_pattern = RUL_<主题>规则.md
rule_template_directory_pattern = <project-or-subproject>/template/RUL_<主题>规则/
rule_file_name_policy = main_rule_in_rule_directory_and_optional_verified_materials_in_same_name_template_directory

<!-- common 保留唯一空入口供未来人工提升；当前不得登记规则或子索引。 -->
COMMON_RULE_INDEX = local/common/RULE_INDEX.md

<!-- 已退役记忆库迁入后冻结的 core 规则基线；根索引直接登记但不移动实体文件。 -->
CODE_JAVA_BACKEND_PROJECT_RULES = local/core/rule/CODE_JAVA_BACKEND_PROJECT_RULES.md
CODE_JAVA_CODING_RULES = local/core/rule/CODE_JAVA_CODING_RULES.md
CODE_JAVA_TEST_RULES = local/core/rule/CODE_JAVA_TEST_RULES.md
CODE_JS_RULES = local/core/rule/CODE_JS_RULES.md
CODE_PYTHON_RULES = local/core/rule/CODE_PYTHON_RULES.md
CODE_TEST_RULES = local/core/rule/CODE_TEST_RULES.md
CODE_VUE_CODING_RULES = local/core/rule/CODE_VUE_CODING_RULES.md
CODE_VUE_FRONTEND_PROJECT_RULES = local/core/rule/CODE_VUE_FRONTEND_PROJECT_RULES.md
<!-- 旧 CODE_VUE_RULES 逻辑 ID 直接复用现行 Vue 编码规则，不再保留单独兼容文件。 -->
CODE_VUE_RULES = local/core/rule/CODE_VUE_CODING_RULES.md
CODE_VUE_TEST_RULES = local/core/rule/CODE_VUE_TEST_RULES.md
MEMORY_FILE_EDIT_RULES = local/core/rule/MEMORY_FILE_EDIT_RULES.md

<!-- 当前稳定用户只从工程根 AGENTS.md 读取；加载器把安全校验后的值代入该唯一模式。 -->
USER_RULE_INDEX_PATTERN = local/<stable-user-id>/RULE_INDEX.md
load_rule_for_active_user_rule_cleanup_package_completion_or_continuous_upgrade = AI_RULE_PACKAGE_INTELLIGENCE_RULES
<!-- 每个任务交付前必须递归命中当前用户生命周期治理规则并完成规则沉淀评估。 -->
load_rule_for_active_user_every_task_completion_rule_sedimentation_evaluation = RULE_LIFECYCLE_GOVERNANCE_RULES
load_rule_for_active_user_explicit_ai_managed_core_or_common_change = RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES
load_rule_for_active_user_same_task_followup_after_standalone_1 = RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES
<!-- 独立 3 必须加载当前用户的最新问答记录与执行规则。 -->
load_rule_for_active_user_standalone_3_record_and_execute = SESSION_LATEST_TURN_RECORD_AND_EXECUTE_RULES
<!-- common 规则、关联代码或冲突迁回当前用户时加载当前用户归属规则。 -->
load_rule_for_active_user_common_rule_or_related_code_migration = ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES
<!-- 规则采用一条注释和一条单事实 DSL 时加载当前用户归属规则。 -->
load_rule_for_active_user_single_fact_rule_dsl_authoring = ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES
