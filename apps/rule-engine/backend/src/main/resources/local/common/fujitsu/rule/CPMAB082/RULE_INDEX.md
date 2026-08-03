# Fujitsu CPMAB082 项目规则索引

<!-- 本索引只维护 CPMAB082 项目专属规则。 -->
fujitsu_project_scope = CPMAB082

<!-- CPMAB082 项目风格。 -->
FUJITSU_CPMAB082_PROJECT_STYLE_RULES = local/common/fujitsu/rule/CPMAB082/RUL_CPMAB082项目风格规则.md
load_rule_for_cpmab082_project_style = FUJITSU_CPMAB082_PROJECT_STYLE_RULES

<!-- CPMAB082 测试数据、数据库集成 Case 与覆盖率。 -->
FUJITSU_CPMAB082_TEST_DATA_COVERAGE_RULES = local/common/fujitsu/rule/CPMAB082/RUL_CPMAB082测试数据覆盖规则.md
load_rule_for_cpmab082_test_data_or_database_integration = FUJITSU_CPMAB082_TEST_DATA_COVERAGE_RULES
load_rule_for_cpmab082_tester_case_or_jacoco_coverage = FUJITSU_CPMAB082_TEST_DATA_COVERAGE_RULES

<!-- CPMAB082 离线参考工程、目标编译、Checkstyle 和 MyBatis 配置。 -->
FUJITSU_CPMAB082_OFFLINE_DEPENDENCY_CONFIG_RULES = local/common/fujitsu/rule/CPMAB082/RUL_CPMAB082离线依赖配置规则.md
load_rule_for_cpmab082_offline_reference_or_fallback_verification = FUJITSU_CPMAB082_OFFLINE_DEPENDENCY_CONFIG_RULES
