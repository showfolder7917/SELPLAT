# Fujitsu Database Integration Coverage Rules

## 说明

- 本规则适用于 Fujitsu 的 CP、IT、SB、AP 系 Java 批处理或数据库集成测试。
- 本规则解决为了追求覆盖率而用 Mock、反射或模拟正常结果替代真实 SQL 的问题，并规定如何用隔离测试库中的真实数据覆盖正常分支和技术异常分支。
- 工程专属表名、Case 编号和字段契约仍由对应工程规则维护，本规则只承载组织级可复用测试方法。

## 适用范围

<!-- 当 Fujitsu 工程使用 JSON、fixture 或同类结构化数据驱动真实 Mapper、SQL 和数据库结果校验时加载；业务含义是统一批处理数据库集成测试的覆盖率证据口径 -->
rule_scope = fujitsu_cp_it_sb_ap_java_batch_and_database_integration_coverage

<!-- 本规则只允许在隔离测试库或可重建 H2 环境中制造约束异常；业务含义是覆盖率测试不得污染共享开发库或运行库 -->
real_database_fault_coverage_requires_isolated_rebuildable_test_database = true

## 真实数据覆盖策略

<!-- 正常业务分支必须由表定义完整、可装载的真实 DB 输入数据驱动；业务含义是更新、插入、删除、零件数、非零件数、循环、分批和正常返回都必须经过实际 Mapper 与 SQL -->
normal_business_branches_must_use_real_database_fixture_data = update
<!-- normal_business_branches_must_use_real_database_fixture_data.2 的当前独立事实为 insert。 -->
normal_business_branches_must_use_real_database_fixture_data.2 = insert
<!-- normal_business_branches_must_use_real_database_fixture_data.3 的当前独立事实为 delete。 -->
normal_business_branches_must_use_real_database_fixture_data.3 = delete
<!-- normal_business_branches_must_use_real_database_fixture_data.4 的当前独立事实为 zero_count。 -->
normal_business_branches_must_use_real_database_fixture_data.4 = zero_count
<!-- normal_business_branches_must_use_real_database_fixture_data.5 的当前独立事实为 nonzero_count。 -->
normal_business_branches_must_use_real_database_fixture_data.5 = nonzero_count
<!-- normal_business_branches_must_use_real_database_fixture_data.6 的当前独立事实为 loop。 -->
normal_business_branches_must_use_real_database_fixture_data.6 = loop
<!-- normal_business_branches_must_use_real_database_fixture_data.7 的当前独立事实为 batch。 -->
normal_business_branches_must_use_real_database_fixture_data.7 = batch
<!-- normal_business_branches_must_use_real_database_fixture_data.8 的当前独立事实为 normal_return。 -->
normal_business_branches_must_use_real_database_fixture_data.8 = normal_return

<!-- 需要判定业务覆盖率时禁止用模拟正常结果代替业务本体；业务含义是测试驱动器直接返回成功不能计入被测批处理覆盖率 -->
forbid_simulated_normal_result_as_business_coverage_evidence = true

<!-- 采用真实数据覆盖策略时禁止用 Mock 或反射伪造 Mapper 返回件数、查询结果或异常；业务含义是覆盖证据必须来自真实表状态、SQL 件数和数据库行为 -->
real_data_coverage_strategy_forbids_mock_and_reflection = mapper_return_count
<!-- real_data_coverage_strategy_forbids_mock_and_reflection.2 的当前独立事实为 query_result。 -->
real_data_coverage_strategy_forbids_mock_and_reflection.2 = query_result
<!-- real_data_coverage_strategy_forbids_mock_and_reflection.3 的当前独立事实为 technical_exception。 -->
real_data_coverage_strategy_forbids_mock_and_reflection.3 = technical_exception

<!-- 表定义必须来自当前字段契约或可信表定义书，并补齐全部必需表和非空字段；业务含义是不得把缺表、错列或残缺 DDL 造成的启动失败伪装成异常分支覆盖 -->
database_fixture_schema_must_match_authoritative_table_contract = all_required_tables + all_required_columns + primary_keys + non_null_constraints

<!-- 正常分支数据矩阵必须同时覆盖空集合与非空集合、更新命中与新增命中、复合条件真与假、循环零次与至少一次；业务含义是通过数据关系自然驱动条件，而不是从测试代码篡改分支结果 -->
normal_branch_fixture_matrix = empty_and_nonempty + update_and_insert + compound_condition_true_and_false + loop_zero_and_nonzero

## 数据集驱动的 Case 隔离

<!-- 使用 DBUnit CLEAN_INSERT 或同类“仅处理已声明表”的装载方式时，每个 Case 必须显式声明全部可变表；业务含义是单件和全件都由当前 Case 自身数据决定，不继承前件残留 -->
clean_insert_case_isolation_requires_all_mutable_tables_per_case = true

<!-- 当前 Case 预期某张可变表为空时仍须提供空数据集，不能省略该表；业务含义是利用 CLEAN_INSERT 先清表，并明确表达零件数业务前提 -->
expected_empty_mutable_table_requires_explicit_empty_dataset = true

<!-- 多个 Case 共用的控制类主数据必须使用统一 canonical 数据集；业务含义是每件执行前恢复相同的控制状态，同时避免在测试 Java 中重复维护普通数据 SQL -->
shared_control_master_requires_canonical_fixture_per_case = true

<!-- 普通覆盖数据应维护在 Case 对应的结构化 fixture 中；业务含义是测试 Java 仅负责调用与异常场景控制，数据关系可独立审查并可由装载器重复建立 -->
ordinary_coverage_data_belongs_to_case_fixture_not_test_java_sql = true

## 真实数据库异常覆盖

<!-- 技术异常分支优先使用可重复的真实数据库约束冲突触发；业务含义是让 Mapper 执行真实 SQL 后由数据库产生异常，再验证框架异常转换和业务异常收口 -->
technical_exception_branch_prefers_real_database_constraint_violation = primary_key_or_unique_or_not_null_or_length_constraint

<!-- 异常数据必须能够按正式表结构完成准备，并在被测业务的目标写入点发生冲突；业务含义是异常来自实际业务 SQL，而不是测试准备阶段提前失败 -->
constraint_fault_fixture_must_fail_at_business_write_point = fixture_load_succeeds AND production_mapper_sql_triggers_constraint

<!-- CPMAB081 的可复用实例是在不同发行业者记录中设置重复 ISSUER_CD，使格付信息写入真实 TB_FCPRANK 时触发主键冲突；业务含义是无需 Mock 或反射即可进入 Mapper 技术异常路径 -->
cpmab081_real_constraint_fault_example = duplicate_ISSUER_CD -> real_TB_FCPRANK_primary_key_conflict -> mapper_exception_path

<!-- 约束冲突 Case 必须明确标记为异常系，禁止把故意冲突的数据归类为正常业务；业务含义是保持正常功能验证和技术故障验证的语义边界 -->
constraint_violation_case_must_be_classified_as_technical_exception_case = true

<!-- 若被测 SQL 不存在可安全、稳定、可重复的数据约束异常入口，则无 Mock 策略下必须报告异常覆盖缺口并取得新的执行决定；业务含义是不得为了数字破坏表结构、共享环境或测试可信度 -->
no_deterministic_real_fault_path_requires_explicit_coverage_gap_or_new_authorization = true

## 覆盖率与完成证据

<!-- JaCoCo 四项覆盖率固定指指令、分支、源码行和方法覆盖率；业务含义是不得只以行覆盖率 100% 代替完整覆盖门槛 -->
jacoco_four_metrics = instruction
<!-- jacoco_four_metrics.2 的当前独立事实为 branch。 -->
jacoco_four_metrics.2 = branch
<!-- jacoco_four_metrics.3 的当前独立事实为 line。 -->
jacoco_four_metrics.3 = line
<!-- jacoco_four_metrics.4 的当前独立事实为 method。 -->
jacoco_four_metrics.4 = method

<!-- 声明四项 100% 前必须重新采集当前编译产物报告；业务含义是旧 exec、旧 class 或旧 HTML 报告不能证明本轮真实数据测试结果 -->
jacoco_100_percent_gate = instruction_100_percent AND branch_100_percent AND line_100_percent AND method_100_percent
<!-- stale_jacoco_report_must_be_recollected 的当前独立事实为 true。 -->
stale_jacoco_report_must_be_recollected = true

<!-- 完成证据必须包含真实执行用例数、数据库期待差分、真实异常根因和四项覆盖率计数；业务含义是让无 Mock、无反射的覆盖率结论可以复核 -->
real_database_coverage_completion_evidence = executed_case_count
<!-- real_database_coverage_completion_evidence.2 的当前独立事实为 database_expected_diff。 -->
real_database_coverage_completion_evidence.2 = database_expected_diff
<!-- real_database_coverage_completion_evidence.3 的当前独立事实为 real_constraint_root_cause。 -->
real_database_coverage_completion_evidence.3 = real_constraint_root_cause
<!-- real_database_coverage_completion_evidence.4 的当前独立事实为 jacoco_instruction_branch_line_method_counts。 -->
real_database_coverage_completion_evidence.4 = jacoco_instruction_branch_line_method_counts
