# Fujitsu 通用规则索引

<!-- 本索引只维护 Fujitsu 各二级项目可以共同复用的规则。 -->
fujitsu_rule_root = local/common/fujitsu/通用/rule/
fujitsu_template_root = local/common/fujitsu/通用/template/
fujitsu_sql_generator_resource_root = local/common/fujitsu/通用/template/RUL_FujitsuSQL规格书Excel生成规则/SQL仕様書生成ツール/
fujitsu_gradle_offline_rule_asset_root = local/common/fujitsu/通用/template/RUL_FujitsuGradle离线依赖闭包恢复规则/
fujitsu_java_app_root = ../java/com/sp/selplat/local/code/common/fujitsu/app/
fujitsu_db_app_root = ../java/com/sp/selplat/local/code/common/fujitsu/app/db/
fujitsu_sql_app_root = ../java/com/sp/selplat/local/code/common/fujitsu/app/sql/
fujitsu_design_app_root = ../java/com/sp/selplat/local/code/common/fujitsu/app/design/

<!-- Fujitsu Gradle 离线依赖闭包恢复。 -->
FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES = local/common/fujitsu/通用/rule/RUL_FujitsuGradle离线依赖闭包恢复规则.md
load_rule_for_fujitsu_gradle_offline_dependency_gap = FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES
load_rule_for_fujitsu_dynamic_version_or_local_artifact_recovery = FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES
load_rule_for_fujitsu_offline_normal_test_or_jacoco = FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES

<!-- Fujitsu Java 规则工具约束。 -->
FUJITSU_JAVA_RULE_TOOL_CONSTRAINT_RULES = local/common/fujitsu/通用/rule/RUL_FujitsuJava规则工具约束规则.md
load_rule_for_fujitsu_java_rule_tool_creation_or_modification = FUJITSU_JAVA_RULE_TOOL_CONSTRAINT_RULES

<!-- Fujitsu SQL 规格书 Excel 生成。 -->
FUJITSU_SQL_SPEC_EXCEL_GENERATION_RULES = local/common/fujitsu/通用/rule/RUL_FujitsuSQL规格书Excel生成规则.md
load_rule_for_fujitsu_sql_spec_excel_generation = FUJITSU_SQL_SPEC_EXCEL_GENERATION_RULES

<!-- Fujitsu API基本设计Excel生成。 -->
FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES = local/common/fujitsu/通用/rule/RUL_Fujitsu基本设计Excel生成规则.md
load_rule_for_fujitsu_api_overview_excel_generation = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES
load_rule_for_fujitsu_interface_item_specification_excel_generation = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES
load_rule_for_fujitsu_basic_design_section_method_detail_sheet_trace = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES
load_rule_for_fujitsu_basic_design_json_driven_generation = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES
load_rule_for_fujitsu_basic_design_drawing_text_visibility = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES
load_rule_for_fujitsu_basic_design_template_geometry_or_overflow_repair = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES
load_rule_for_fujitsu_basic_design_reference_processing_adoption = FUJITSU_BASIC_DESIGN_EXCEL_GENERATION_RULES

<!-- Fujitsu 不可达分支处理。 -->
FUJITSU_UNREACHABLE_BRANCH_RULES = local/common/fujitsu/通用/rule/RUL_Fujitsu不可达分支规则.md
load_rule_for_fujitsu_unreachable_branch_analysis_or_cleanup = FUJITSU_UNREACHABLE_BRANCH_RULES

<!-- Fujitsu 工程风格。 -->
FUJITSU_ENGINEERING_STYLE_RULES = local/common/fujitsu/通用/rule/RUL_Fujitsu工程风格规则.md
load_rule_for_fujitsu_engineering_style = FUJITSU_ENGINEERING_STYLE_RULES

<!-- Fujitsu 数据库集成覆盖。 -->
FUJITSU_DATABASE_INTEGRATION_COVERAGE_RULES = local/common/fujitsu/通用/rule/RUL_Fujitsu数据库集成覆盖规则.md
load_rule_for_fujitsu_database_integration_coverage = FUJITSU_DATABASE_INTEGRATION_COVERAGE_RULES

<!-- Fujitsu 文件测试数据一致性。 -->
FUJITSU_FILE_TEST_DATA_CONSISTENCY_RULES = local/common/fujitsu/通用/rule/RUL_Fujitsu文件测试数据一致性规则.md
load_rule_for_fujitsu_file_test_data_consistency = FUJITSU_FILE_TEST_DATA_CONSISTENCY_RULES

<!-- Fujitsu 新增或修改 JSON 的单行格式与交付门禁。 -->
FUJITSU_JSON_SINGLE_LINE_FORMAT_GATE_RULES = local/common/fujitsu/通用/rule/RUL_FujitsuJSON单行格式门禁规则.md
load_rule_for_fujitsu_json_creation_or_modification = FUJITSU_JSON_SINGLE_LINE_FORMAT_GATE_RULES
load_rule_for_fujitsu_json_delivery_validation = FUJITSU_JSON_SINGLE_LINE_FORMAT_GATE_RULES
