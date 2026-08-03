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
project_rule_conflict_scope = same_topic,same_applicability
resource_path_change_maintenance = update_owning_leaf_index_and_validate_parent_chain
rule_main_file_pattern = RUL_<主题>规则.md
rule_asset_directory_pattern = RUL_<主题>规则/
rule_file_name_policy = main_rule_file_and_same_name_asset_directory_are_siblings

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
CODE_VUE_RULES = local/core/rule/CODE_VUE_RULES.md
CODE_VUE_TEST_RULES = local/core/rule/CODE_VUE_TEST_RULES.md
GUI_VIDEO_TASK_RULES = local/core/rule/GUI_VIDEO_TASK_RULES.md
MEMORY_FILE_EDIT_RULES = local/core/rule/MEMORY_FILE_EDIT_RULES.md
PROJECT_EXECUTION_RULES = local/core/rule/PROJECT_EXECUTION_RULES.md
AUTO_UPGRADE_AND_REPAIR_RULES = local/core/rule/common_rules/auto_upgrade_and_repair_rules.md
EXPERIENCE_ADJUDICATION_PROMPT_RULES = local/core/rule/common_rules/experience_adjudication_prompt.md
DETAILED_DESIGN_DOC_RULES = local/core/rule/common_rules/md_detailed_design_rules.md
DETAILED_DESIGN_XLS_RULES = local/core/rule/common_rules/xls_detailed_design_rules.md
XLS_OUTPUT_TEST_RULES = local/core/rule/common_rules/xls_output_test_rules.md
TABLE_STRUCTURE_XLS_RULES = local/core/rule/common_rules/xls_table_structure_definition_rules.md
