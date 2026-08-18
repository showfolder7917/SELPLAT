# CPMAB082 Test Data and Coverage Rules

## 说明

- 本规则只适用于 CPMAB082 的测试数据、测试 Case、数据库集成测试和 JaCoCo 覆盖率判定。
- 本文件中的工程内相对路径以 CPMAB082 工程根目录为基准，不因本规则存储在统一 MEMORIES 中而改按 SELPLAT 工程解释。

## 适用范围

<!-- 仅在 CPMAB082 新增或修改测试数据、Tester Case、数据库集成测试或覆盖率验证时加载；业务含义是防止批处理专属表契约和 Case 编号误用于其他工程 -->
rule_scope = CPMAB082/test_data_database_integration_and_coverage

<!-- 规则内测试路径以 CPMAB082 工程根目录为基准；业务含义是让统一记忆库中的工程专属规则仍能稳定定位实际工程文件 -->
relative_path_base = CPMAB082_project_root

## 测试数据定义

<!-- 测试数据统一放在 CPMAB082 的固定 UT 数据根目录；业务含义是保证 Tester、数据库定义和报文数据能够按 Case 稳定对应 -->
test_data_root = test/inputData/CPMA/CPMAB082

<!-- 表定义由字段契约与参考工程同表完整定义共同确定；业务含义是避免只声明 SQL 用到的少数字段而遗漏数据库非空字段 -->
table_define_path = test/inputData/CPMA/CPMAB082/db/define/<physical_table_name>.json
<!-- table_define_source 的当前独立事实为 table_definition_contract + reference_project_complete_same_table_definition。 -->
table_define_source = table_definition_contract + reference_project_complete_same_table_definition

<!-- 输入 JSON 使用的字段必须已定义，实际表的全部非空业务字段也必须赋值；业务含义是避免 UT 驱动忽略未定义字段后触发非空约束失败 -->
table_define_completeness = input_json_fields_exist_in_db_define AND all_non_null_business_fields_are_assigned

<!-- subjectOfEntry=false 时 AP 审计字段由 UT 基盘补值，期待值使用 null 忽略动态比较；业务含义是避免运行时审计值造成无意义差分 -->
audit_field_expectation_when_subject_of_entry_false = framework_populates_values_and_expectation_uses_null

<!-- CPMAB082 的数据来源表、目标表和目标字段契约固定如下；业务含义是测试数据必须覆盖实际批处理读写边界 -->
source_tables = TB_FCPCORP
<!-- source_tables.2 的当前独立事实为 TB_FCPISSUER。 -->
source_tables.2 = TB_FCPISSUER
<!-- target_table 的当前独立事实为 TB_FCPISSUERORGNINM。 -->
target_table = TB_FCPISSUERORGNINM
<!-- target_contract 的当前独立事实为 CO_CD。 -->
target_contract = CO_CD
<!-- target_contract.2 的当前独立事实为 CP_ISSUER_CD。 -->
target_contract.2 = CP_ISSUER_CD
<!-- target_contract.3 的当前独立事实为 ORGNI_NM。 -->
target_contract.3 = ORGNI_NM
<!-- target_contract.4 的当前独立事实为 CO_EDIT_NM。 -->
target_contract.4 = CO_EDIT_NM
<!-- target_contract.5 的当前独立事实为 six_AP_audit_fields。 -->
target_contract.5 = six_AP_audit_fields

## Case 与 Tester 同步

<!-- 数据库与报文 Case 目录必须与 Tester 标签形成一一对应；业务含义是防止出现未执行数据或空壳测试方法 -->
database_case_path = test/inputData/CPMA/CPMAB082/db/testCase/<case_id>/{input,expect}
<!-- telegram_case_path 的当前独立事实为 test/inputData/CPMA/CPMAB082/telegram/testCase/<case_id>/{input,expect}。 -->
telegram_case_path = test/inputData/CPMA/CPMAB082/telegram/testCase/<case_id>/{input,expect}
<!-- test_method_contract 的当前独立事实为 CPMAB082Tester.test<case_id> + @Tag("testCaseId:<case_id>")。 -->
test_method_contract = CPMAB082Tester.test<case_id> + @Tag("testCaseId:<case_id>")
<!-- case_bijection 的当前独立事实为 database_case_ids == telegram_case_ids == tester_tag_case_ids。 -->
case_bijection = database_case_ids == telegram_case_ids == tester_tag_case_ids

<!-- 新增数据 Case 时必须在同一变更中追加对应测试方法和标签；业务含义是让新增数据一定通过真实测试入口执行 -->
new_case_must_add_matching_test_method_and_tag_in_same_change = true

<!-- 需要覆盖真实批处理逻辑时必须关闭模拟正常结果；业务含义是 setResultNormal(true) 不能被误当作业务覆盖率证据 -->
real_batch_execution_requires_concierge_result_normal = false
<!-- simulated_normal_result_allowed_only_when_explicitly_excluded_from_business_coverage 的当前独立事实为 true。 -->
simulated_normal_result_allowed_only_when_explicitly_excluded_from_business_coverage = true

## 必测场景矩阵

<!-- 正常、分批、删除和异常转换场景必须共同覆盖；业务含义是以真实数据变化与异常契约验证发行业者组织名称批处理 -->
case_010001 = zero_source_rows + delete_all_existing_targets + trace_off + normal_end
<!-- case_010002 的当前独立事实为 one_source_row + organization_name_edit_variants + trace_on + normal_insert。 -->
case_010002 = one_source_row + organization_name_edit_variants + trace_on + normal_insert
<!-- case_010003 的当前独立事实为 three_source_rows + insertMaxCount_2 + two_batches + delete_existing_targets + normal_end。 -->
case_010003 = three_source_rows + insertMaxCount_2 + two_batches + delete_existing_targets + normal_end
<!-- case_010004 的当前独立事实为 mapper_throws_APZZPartsRetryException + defect_recovery_code + convert_to_APZZBizSysException + keep_target_table。 -->
case_010004 = mapper_throws_APZZPartsRetryException + defect_recovery_code + convert_to_APZZBizSysException + keep_target_table
<!-- case_010005 的当前独立事实为 APZZStringUtil_throws_APZZPartsSysException + defect_recovery_code + convert_to_APZZBizSysException + keep_target_table。 -->
case_010005 = APZZStringUtil_throws_APZZPartsSysException + defect_recovery_code + convert_to_APZZBizSysException + keep_target_table

<!-- Spring Spy 抛出受检异常时沿用参考工程 doAnswer 写法；业务含义是保证异常从真实调用点进入转换分支 -->
checked_exception_spy_stub = doAnswer(invocation -> { throw expected_exception; })

<!-- 至少一个正常场景开启 trace 且至少一个关闭 trace；业务含义是覆盖开始与结束日志的两侧分支 -->
trace_branch_coverage = at_least_one_normal_case_trace_on AND at_least_one_case_trace_off

## 验证与覆盖率判定

<!-- 全部测试 JSON 必须按 UTF-8 成功解析且 Case 结构必须双向一致；业务含义是先排除数据格式与目录映射缺陷 -->
verify_test_json = all_json_files_parse_as_utf8
<!-- verify_case_structure 的当前独立事实为 tester_case_ids_match_database_and_telegram_case_directories。 -->
verify_case_structure = tester_case_ids_match_database_and_telegram_case_directories

<!-- Tester 与受影响主代码必须使用本机离线依赖编译；业务含义是测试数据完成不能替代代码可编译证据 -->
verify_compile = CPMAB082Tester_and_affected_production_code_compile_with_local_offline_dependencies

<!-- 每个 Case 的数据准备和期待表比较都必须成功；业务含义是数据库差分结果是批处理正确性的直接证据 -->
verify_database = every_case_preparation_succeeds AND every_expected_table_result_has_no_difference

<!-- 两个异常 Case 的根因和统一外层异常必须同时符合契约；业务含义是防止只断言外层异常而遗漏真实转换来源 -->
verify_exception_010004 = root_APZZPartsRetryException AND outer_APZZBizSysException
<!-- verify_exception_010005 的当前独立事实为 root_APZZPartsSysException AND outer_APZZBizSysException。 -->
verify_exception_010005 = root_APZZPartsSysException AND outer_APZZBizSysException

<!-- JaCoCo 只允许以当前编译产物 CPMAB082.class 判定四类覆盖率；业务含义是旧报告或失效成员不能作为完成证据 -->
coverage_subject = current_compiled_CPMAB082.class
<!-- coverage_gate 的当前独立事实为 instruction_100_percent AND branch_100_percent AND line_100_percent AND method_100_percent。 -->
coverage_gate = instruction_100_percent AND branch_100_percent AND line_100_percent AND method_100_percent
<!-- stale_coverage_report_must_be_recollected 的当前独立事实为 true。 -->
stale_coverage_report_must_be_recollected = true

<!-- 手工离线采集时 JUnit Launcher 与测试必须处于挂载 agent 的同一 JVM；业务含义是确保 exec 确实包含本轮测试执行数据 -->
manual_offline_jacoco_requires_launcher_and_tests_in_same_agent_jvm = true

<!-- 手工离线 classpath 每个 artifact 只保留一个兼容版本并排除重复 Mapper；业务含义是重复资源导致的启动失败不能误判为测试失败 -->
manual_offline_classpath_requires_single_compatible_artifact_version = true
<!-- manual_offline_classpath_must_exclude_duplicate_CPMACOMMON_mapper_resources 的当前独立事实为 true。 -->
manual_offline_classpath_must_exclude_duplicate_CPMACOMMON_mapper_resources = true

<!-- 收口证据必须包含测试数、数据库差分、四类覆盖率、离线回退原因和剩余风险；业务含义是让完成判定可复核 -->
completion_evidence = successful_test_count
<!-- completion_evidence.2 的当前独立事实为 database_diff_result。 -->
completion_evidence.2 = database_diff_result
<!-- completion_evidence.3 的当前独立事实为 jacoco_instruction_branch_line_method_counts。 -->
completion_evidence.3 = jacoco_instruction_branch_line_method_counts
<!-- completion_evidence.4 的当前独立事实为 offline_fallback_reason。 -->
completion_evidence.4 = offline_fallback_reason
<!-- completion_evidence.5 的当前独立事实为 residual_risks。 -->
completion_evidence.5 = residual_risks
