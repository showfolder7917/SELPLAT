# Fujitsu 规则作用域索引

<!-- 本索引维护 Fujitsu 组织共用规则，并汇总明确项目的下级索引。 -->
fujitsu_resource_root = local/common/fujitsu/
fujitsu_rule_root = local/common/fujitsu/rule/
fujitsu_sql_generator_resource_root = local/common/fujitsu/template/sql/SQL仕様書生成ツール/
fujitsu_gradle_offline_rule_asset_root = local/common/fujitsu/rule/RUL_FujitsuGradle离线依赖闭包恢复规则/
fujitsu_sql_code_root = ../java/com/sp/selplat/local/code/common/fujitsu/sql/

<!-- CPMAB082 项目规则由项目叶子索引唯一维护。 -->
FUJITSU_CPMAB082_RULE_INDEX = local/common/fujitsu/rule/CPMAB082/RULE_INDEX.md

<!-- Fujitsu Gradle 离线依赖闭包恢复。 -->
FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES = local/common/fujitsu/rule/RUL_FujitsuGradle离线依赖闭包恢复规则.md
load_rule_for_fujitsu_gradle_offline_dependency_gap = FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES
load_rule_for_fujitsu_dynamic_version_or_local_artifact_recovery = FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES
load_rule_for_fujitsu_offline_normal_test_or_jacoco = FUJITSU_GRADLE_OFFLINE_DEPENDENCY_CLOSURE_RULES

<!-- Fujitsu Java 规则工具约束。 -->
FUJITSU_JAVA_RULE_TOOL_CONSTRAINT_RULES = local/common/fujitsu/rule/RUL_FujitsuJava规则工具约束规则.md
load_rule_for_fujitsu_java_rule_tool_creation_or_modification = FUJITSU_JAVA_RULE_TOOL_CONSTRAINT_RULES

<!-- Fujitsu SQL 规格书 Excel 生成。 -->
FUJITSU_SQL_SPEC_EXCEL_GENERATION_RULES = local/common/fujitsu/rule/RUL_FujitsuSQL规格书Excel生成规则.md
load_rule_for_fujitsu_sql_spec_excel_generation = FUJITSU_SQL_SPEC_EXCEL_GENERATION_RULES

<!-- Fujitsu 不可达分支处理。 -->
FUJITSU_UNREACHABLE_BRANCH_RULES = local/common/fujitsu/rule/RUL_Fujitsu不可达分支规则.md
load_rule_for_fujitsu_unreachable_branch_analysis_or_cleanup = FUJITSU_UNREACHABLE_BRANCH_RULES

<!-- Fujitsu 工程风格。 -->
FUJITSU_ENGINEERING_STYLE_RULES = local/common/fujitsu/rule/RUL_Fujitsu工程风格规则.md
load_rule_for_fujitsu_engineering_style = FUJITSU_ENGINEERING_STYLE_RULES

<!-- Fujitsu 数据库集成覆盖。 -->
FUJITSU_DATABASE_INTEGRATION_COVERAGE_RULES = local/common/fujitsu/rule/RUL_Fujitsu数据库集成覆盖规则.md
load_rule_for_fujitsu_database_integration_coverage = FUJITSU_DATABASE_INTEGRATION_COVERAGE_RULES

<!-- Fujitsu 文件测试数据一致性。 -->
FUJITSU_FILE_TEST_DATA_CONSISTENCY_RULES = local/common/fujitsu/rule/RUL_Fujitsu文件测试数据一致性规则.md
load_rule_for_fujitsu_file_test_data_consistency = FUJITSU_FILE_TEST_DATA_CONSISTENCY_RULES
