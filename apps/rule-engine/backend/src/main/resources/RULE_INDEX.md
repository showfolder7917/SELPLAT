# rule-engine 全局规则索引

<!-- 问题：core、跨工程规则和多个工程作用域需要从一个稳定入口按层定位，禁止根索引复制所有 common 规则。 -->
<!-- 场景：启动后按任务命中逻辑 ID，并根据当前工程作用域和用户身份加载最少规则。 -->
<!-- 业务含义：冻结 core 由根索引直接登记，common 通过唯一汇总索引递归进入，用户覆盖保持最高优先级。 -->

project_resource_index_scope = apps/rule-engine
rule_engine_layer_migration_status = migration_complete_core_frozen
rule_engine_hierarchical_index_status = active_core_refrozen
rule_engine_core_resource_root = local/core/
rule_engine_common_resource_root = local/common/
rule_engine_user_resource_root_pattern = local/<stable-user-id>/
rule_engine_core_java_root = ../java/com/sp/selplat/local/code/core/
rule_engine_common_java_root = ../java/com/sp/selplat/local/code/common/
rule_engine_user_java_root_pattern = ../java/com/sp/selplat/local/code/<stable-user-id>/
rule_engine_core_python_root = ../python/com/sp/selplat/local/code/core/
rule_engine_common_python_root = ../python/com/sp/selplat/local/code/common/
rule_engine_user_python_root_pattern = ../python/com/sp/selplat/local/code/<stable-user-id>/
rule_engine_core_node_root = ../node/com/sp/selplat/local/code/core/
rule_engine_common_node_root = ../node/com/sp/selplat/local/code/common/
rule_engine_user_node_root_pattern = ../node/com/sp/selplat/local/code/<stable-user-id>/
core_startup_protocol_loader = ../python/com/sp/selplat/local/code/core/abilities/startup_protocol_loader.py
core_layered_rule_loader = ../java/com/sp/selplat/local/code/core/rule/LayeredRuleLoader.java

project_rule_loading_order = root_RULE_INDEX -> common_aggregate_index -> matched_scope_index
target_layered_rule_loading_order = local/core -> local/common/跨工程通用规则 -> local/common/matched_scope -> local/active_user
target_layered_rule_conflict_priority = local/active_user > local/common/matched_scope > local/common/跨工程通用规则 > local/core
layered_loading_activation_requires = indexes,recursive_loader,scope_selection,registries,call_paths,build,tests
protected_protocol_priority = STARTER,USER,CODE,COMMAND,GENERATOR_REPAIR_PROTOCOL > project_resource_rule
user_confirmation_protocol = local/core/protocol/USER.PROTOCOL.md
project_rule_conflict_scope = same_topic,same_applicability
resource_path_change_maintenance = update_owning_leaf_index_and_validate_parent_chain
rule_main_file_pattern = RUL_<主题>规则.md
rule_template_directory_pattern = <project-or-subproject>/template/RUL_<主题>规则/
rule_file_name_policy = main_rule_in_rule_directory_and_optional_verified_materials_in_same_name_template_directory

<!-- common 只通过一个汇总入口进入；其规则逻辑 ID 由所属叶子索引唯一维护。 -->
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
GUI_VIDEO_TASK_RULES = local/core/rule/GUI_VIDEO_TASK_RULES.md
MEMORY_FILE_EDIT_RULES = local/core/rule/MEMORY_FILE_EDIT_RULES.md

<!-- 当前稳定用户只从工程根 AGENTS.md 读取；加载器把安全校验后的值代入该唯一模式。 -->
USER_RULE_INDEX_PATTERN = local/<stable-user-id>/RULE_INDEX.md
load_rule_for_active_user_rule_cleanup_package_completion_or_continuous_upgrade = AI_RULE_PACKAGE_INTELLIGENCE_RULES
load_rule_for_active_user_explicit_ai_managed_core_or_common_change = RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES
load_rule_for_active_user_same_task_followup_after_standalone_1 = RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES
