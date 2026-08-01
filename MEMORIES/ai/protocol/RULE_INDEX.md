# RULE INDEX 兼容入口

## 说明

- 本文件仅作为启动协议中的规则索引兼容入口，不是正式规则主索引。
- 唯一正式规则索引是 rule-engine resources 下的 `RULE_INDEX.md`；所有已迁入 rule-engine 的规则只通过该入口加载。
- 本文件不重复登记 rule-engine 中的具体规则，只保留一个正式索引入口和尚未迁移的 `MEMORIES/ai/rule` 兼容规则。
- 本文件不默认触发全量读取，规则必须按任务类型按需最小进入。
- 工程项目任务默认先按 `CODE.PROTOCOL.md` 进入 `ai/code` 能力系统，再根据正式索引或兼容入口加载最少必要规则。

<!--协议层只保留一个 rule-engine 正式索引入口，禁止继续复制其内部具体规则路由-->
protocol_rule_index_is_compatibility_entry_only = true
protocol_rule_index_must_not_duplicate_rule_engine_routes = true

<!--禁止规则批量加载-->
rule_index_is_not_bulk_rule_loading = true

<!--禁止默认加载全部规则-->
do_not_load_all_rule_files_by_default = true

<!--规则文件不属于默认启动链-->
rule_files_are_not_part_of_default_startup_chain = true

<!--非命中场景不得读取无关规则-->
do_not_read_unrelated_rule_files = true

<!--单任务只读取最少必要规则-->
read_minimum_required_rule_files_per_task = true

<!--项目执行规则-->
PROJECT_EXECUTION_RULES = ${RUL}PROJECT_EXECUTION_RULES.md
load_rule_for_project_structure_or_closeout = PROJECT_EXECUTION_RULES

<!--记忆库文件编辑规则-->
MEMORY_FILE_EDIT_RULES = ${RUL}MEMORY_FILE_EDIT_RULES.md
load_rule_for_memory_file_edit = MEMORY_FILE_EDIT_RULES

<!--rule-engine 唯一正式规则索引：所有正式规则的目录、作用域、加载条件和冲突优先级均由该索引统一维护-->
RULE_ENGINE_PROJECT_RESOURCE_INDEX = ../apps/rule-engine/backend/src/main/resources/RULE_INDEX.md
load_formal_rule_index_for_all_rule_tasks = RULE_ENGINE_PROJECT_RESOURCE_INDEX
rule_engine_project_resource_index_is_authoritative = true

<!--临时启动环境约束入口：当任务涉及本机会话 Python、ai/code executor 或执行文档启动检查时，按需读取 COMMAND.PROTOCOL.md 中的临时启动环境约束-->
TEMPORARY_SESSION_STARTUP_ENV_PROTOCOL = ${PRT}COMMAND.PROTOCOL.md
load_protocol_for_temporary_session_startup_environment = TEMPORARY_SESSION_STARTUP_ENV_PROTOCOL

<!--通用详细设计文档规则-->
DETAILED_DESIGN_DOC_RULES = ${RUL}common_rules/md_detailed_design_rules.md
load_rule_for_detailed_design_doc_generation = DETAILED_DESIGN_DOC_RULES
load_rule_for_design_doc_structure_or_template_task = DETAILED_DESIGN_DOC_RULES

<!--详细设计 Excel 模板规则-->
DETAILED_DESIGN_XLS_RULES = ${RUL}common_rules/xls_detailed_design_rules.md
load_rule_for_detailed_design_xls_generation = DETAILED_DESIGN_XLS_RULES
load_rule_for_detailed_design_excel_template_task = DETAILED_DESIGN_XLS_RULES
load_rule_for_batch_detailed_design_workbook_task = DETAILED_DESIGN_XLS_RULES

<!--生成器通用修复协议-->
GENERATOR_REPAIR_PROTOCOL = ${PRT}GENERATOR_REPAIR_PROTOCOL.md
load_rule_for_generator_repair_task = GENERATOR_REPAIR_PROTOCOL
load_rule_for_detailed_design_generator_self_repair_task = GENERATOR_REPAIR_PROTOCOL

<!--生成器通用升级与修复规则-->
AUTO_UPGRADE_AND_REPAIR_RULES = ${RUL}common_rules/auto_upgrade_and_repair_rules.md
load_rule_for_auto_upgrade_and_repair_task = AUTO_UPGRADE_AND_REPAIR_RULES
load_rule_for_detailed_design_generator_upgrade_task = AUTO_UPGRADE_AND_REPAIR_RULES
load_rule_for_api_detailed_design_auto_generator_task = AUTO_UPGRADE_AND_REPAIR_RULES

<!--表结构定义 Excel 模板规则-->
TABLE_STRUCTURE_XLS_RULES = ${RUL}common_rules/xls_table_structure_definition_rules.md
load_rule_for_table_structure_definition_xls_generation = TABLE_STRUCTURE_XLS_RULES
load_rule_for_table_structure_definition_template_task = TABLE_STRUCTURE_XLS_RULES
load_rule_for_schema_definition_workbook_task = TABLE_STRUCTURE_XLS_RULES

<!--通用经验裁决提示词规则-->
EXPERIENCE_ADJUDICATION_PROMPT_RULES = ${RUL}common_rules/experience_adjudication_prompt.md
load_rule_for_experience_adjudication_task = EXPERIENCE_ADJUDICATION_PROMPT_RULES
load_rule_for_experience_query_prompt_design_task = EXPERIENCE_ADJUDICATION_PROMPT_RULES

<!--GUI 与视频任务规则-->
GUI_VIDEO_TASK_RULES = ${RUL}GUI_VIDEO_TASK_RULES.md
load_rule_for_gui_or_video_task = GUI_VIDEO_TASK_RULES

<!--代码测试规则-->
CODE_TEST_RULES = ${RUL}CODE_TEST_RULES.md
load_rule_for_code_test_task = CODE_TEST_RULES
load_rule_for_page_test_or_visual_layout_verification = CODE_TEST_RULES
standard_ability_for_page_visual_test = ${CODE}abilities/page_visual_tester.py

<!--Excel 输出测试规则-->
XLS_OUTPUT_TEST_RULES = ${RUL}common_rules/xls_output_test_rules.md
load_rule_for_excel_output_test_task = XLS_OUTPUT_TEST_RULES
load_rule_for_xlsx_visual_verification_task = XLS_OUTPUT_TEST_RULES
load_rule_for_detailed_design_xls_output_verification = XLS_OUTPUT_TEST_RULES
load_rule_for_table_structure_xls_output_verification = XLS_OUTPUT_TEST_RULES

<!-- Python 编码规则-->
CODE_PYTHON_RULES = ${RUL}CODE_PYTHON_RULES.md
load_rule_for_python_task = CODE_PYTHON_RULES

<!-- JavaScript 编码规则-->
CODE_JS_RULES = ${RUL}CODE_JS_RULES.md
load_rule_for_js_task = CODE_JS_RULES

<!-- Vue 兼容入口规则-->
CODE_VUE_RULES = ${RUL}CODE_VUE_RULES.md
load_rule_for_legacy_vue_rule_entry = CODE_VUE_RULES

<!-- Vue 编码规则-->
CODE_VUE_CODING_RULES = ${RUL}CODE_VUE_CODING_RULES.md
load_rule_for_vue_task = CODE_VUE_CODING_RULES

<!-- Vue 测试规则-->
CODE_VUE_TEST_RULES = ${RUL}CODE_VUE_TEST_RULES.md
load_rule_for_vue_test_task = CODE_VUE_TEST_RULES

<!--Vue 前端项目规则-->
CODE_VUE_FRONTEND_PROJECT_RULES = ${RUL}CODE_VUE_FRONTEND_PROJECT_RULES.md
load_rule_for_vue_architecture_task = CODE_VUE_FRONTEND_PROJECT_RULES
load_rule_for_vue_frontend_project_task = CODE_VUE_FRONTEND_PROJECT_RULES

<!--Java 编码规则-->
CODE_JAVA_CODING_RULES = ${RUL}CODE_JAVA_CODING_RULES.md
load_rule_for_java_task = CODE_JAVA_CODING_RULES

<!--Java 测试规范规则-->
CODE_JAVA_TEST_RULES = ${RUL}CODE_JAVA_TEST_RULES.md
load_rule_for_java_test_task = CODE_JAVA_TEST_RULES

<!--Java 后端项目规则-->
CODE_JAVA_BACKEND_PROJECT_RULES = ${RUL}CODE_JAVA_BACKEND_PROJECT_RULES.md
load_rule_for_java_backend_project_task = CODE_JAVA_BACKEND_PROJECT_RULES
