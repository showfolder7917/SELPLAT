# Code Java Test Rules

## 目标
- 本文件定义 Java 测试策略、测试分层、bug 修复验证闭环和 bugfix/test matrix 选择规则
- 本文件服务于 Java 代码修改后的可执行验证，不替代后端工程架构规则和编码规范规则
- 本文件重点回答 Java 改动后测试应该怎么做，才能支撑自动修复 bug 级别的判定

## 必须遵守
<!-- Java 代码变更后必须做可执行验证，不能只靠静态阅读判断正确 -->
require_executable_verification_after_java_change

<!-- 当 bug 可以稳定复现时，优先先构造失败测试或失败证据，再进行修复 -->
prefer_failing_test_before_java_bug_fix_when_reproducible

<!-- Java bug 修复至少要有最小复现用例、失败日志、失败接口、失败查询或失败脚本中的一种证据 -->
require_minimal_repro_or_evidence_for_java_bug_fix

<!-- Java bug 修复完成后必须补针对性回归验证，不能只验证主路径恢复 -->
require_targeted_regression_test_after_java_bug_fix

<!-- Java 测试默认优先使用 JUnit 5，保持测试工具链统一 -->
prefer_junit5_for_java_tests

<!-- 复杂场景测试数据优先使用 JSON、fixture 或结构化样例，避免硬编码长串散落在测试里 -->
require_json_or_fixture_based_test_data_for_complex_cases

## 测试分层规则
<!-- 修复或新增功能前，先识别问题位于 controller、service、dao、mapper、schema、utility、script、config 哪一层，再选最小测试入口 -->
require_layer_identification_before_java_test_selection

<!-- 纯逻辑、转换、校验和分支判断优先使用单元测试，不要一开始就上全链路重测试 -->
prefer_unit_tests_for_pure_java_logic

<!-- SQL、MyBatis 映射、字段落库和主键策略优先用 repository 或 mapper 级测试验证 -->
prefer_repository_or_mapper_tests_for_sql_and_mapping_changes

<!-- 业务编排、事务、写入顺序和状态迁移优先用 service 级集成测试验证 -->
prefer_service_integration_tests_for_business_workflow_changes

<!-- 接口输入输出、状态码、错误响应和序列化契约优先用 controller 或 API 测试验证 -->
prefer_controller_api_tests_for_contract_changes

<!-- 持久层测试优先使用隔离测试库或 H2 等可重建环境，避免污染共享运行库 -->
prefer_h2_or_isolated_test_db_for_repository_and_mapper_tests

## Bugfix/Test Matrix
<!-- Bug 修复测试必须按问题类型选择最小而稳定的验证层，不允许凭感觉随意跳层 -->
require_bugfix_test_matrix_selection_for_java_bug_fix = true

<!-- 问题在 utility、converter、validator、parser、formatter 等纯逻辑层时，优先写单元测试直接断言输入输出 -->
matrix_pure_logic_bug_prefers_unit_test = utility,converter,validator,parser,formatter -> unit_test

<!-- 问题在 service 业务编排、事务、状态流转、批处理顺序时，优先写 service 集成测试 -->
matrix_service_workflow_bug_prefers_service_integration_test = service,transaction,state_transition,batch_order -> service_integration_test

<!-- 问题在 SQL、MyBatis、字段映射、主键策略、唯一约束时，优先写 mapper 或 repository 测试 -->
matrix_persistence_bug_prefers_mapper_or_repository_test = sql,mybatis,mapping,primary_key,unique_constraint,repository,dao -> mapper_or_repository_test

<!-- 问题在接口参数绑定、响应结构、状态码、异常响应时，优先写 controller 或 API 测试 -->
matrix_api_contract_bug_prefers_controller_test = controller,request_binding,response_shape,status_code,error_response -> controller_or_api_test

<!-- 问题在 schema 升级、DDL 兼容、旧数据兼容时，优先写 schema 初始化或 repository 兼容测试，并附迁移验证 -->
matrix_schema_bug_requires_schema_and_repository_verification = schema,ddl,migration,compatibility -> schema_plus_repository_verification

<!-- 问题在启动脚本、命令入口、配置装载、环境变量读取时，优先写脚本级或配置级可执行验证，并附日志证据 -->
matrix_script_or_config_bug_requires_executable_command_verification = startup_script,command_script,config,env_loading -> executable_command_verification

<!-- Java 问题跨越多层时，先选最小复现层，再补一层相邻回归；规则键保留 Java 范围，避免与其他技术栈加载时互相覆盖 -->
java_matrix_cross_layer_bug_prefers_smallest_repro_then_neighbor_regression = cross_layer -> smallest_repro_plus_neighbor_regression

## Bug 修复闭环规则
<!-- bug 修复时，断言应直接对应现象，例如错误码、错误消息、关键字段、写入结果、查询结果或日志关键字 -->
require_assertion_on_error_message_or_error_code_when_fixing_bug

<!-- bug 修复后至少要验证一组成功路径和一组异常或边界路径，防止只修一个入口 -->
require_success_and_boundary_path_verification_for_java_bug_fix

<!-- 当修复涉及 schema、dao、service、controller、script 或配置契约时，必须把相邻层一并回归 -->
require_neighbor_layer_regression_when_java_contract_changes

<!-- 如果无法补失败测试，也必须明确记录为何不能自动复现，以及采用了什么替代验证证据 -->
require_reason_when_java_bug_fix_lacks_failing_test

<!-- 修复 bug 时必须说明最终采用了哪一层测试作为主验证层，以及为什么不是其他层 -->
require_primary_test_layer_explanation_for_java_bug_fix

## 自动修复级别要求
<!-- 自动修复级别的测试规范要求能够让代理判断问题复现、修复生效和相邻回归都已完成 -->
auto_bug_fix_validation_must_cover_repro_fix_and_regression = true

<!-- 自动修复判断不能只依赖编译通过，必须有目标验证动作和结构化结果 -->
forbid_declaring_bug_fixed_without_executable_verification

<!-- 对 Java bug 修复，不能把人工 UI 观察当作主要证据，除非问题天然只能在 UI 上验证 -->
forbid_using_manual_ui_only_as_primary_evidence_for_java_bug_fix

<!-- 自动修复类任务优先选择最小且稳定的测试入口，避免用脆弱的大而全流程代替目标验证 -->
prefer_smallest_stable_test_entry_for_java_bug_fix

<!-- 自动修复类任务完成时，验证输出中至少要体现复现证据、修复证据和回归证据三部分 -->
require_repro_fix_regression_evidence_triplet_for_auto_bug_fix = true

<!-- Java 自动纠错若落在 CRUD/API 工程，必须先补齐 controller 主路径、错误路径、service 校验分支和 mapper/dao 关键验证，再宣称稳定；业务含义是避免只修一个接口或一条 happy path -->
java_auto_correction_requires_minimum_crud_test_closure = true

<!-- Java CRUD/API 自动纠错最小集合至少覆盖单查、列表、新增、更新、删除中的实际受影响接口，以及对应 400/不存在/唯一约束等错误响应；业务含义是把接口契约补测提升为正式门槛 -->
java_crud_api_auto_correction_requires_success_and_error_contract_coverage = true

<!-- Java 自动纠错涉及业务校验、唯一约束、存在性校验或查询条件时，必须补 service 分支测试和 mapper SQL 条件测试；业务含义是避免 controller 冒烟通过但底层分支仍缺口明显 -->
java_auto_correction_requires_service_and_mapper_branch_validation = true

## 验证证据规则
<!-- 测试证据应尽量结构化，至少要能回放测试动作、结果和关键证据位置 -->
require_structured_java_test_evidence = actions,result,evidence

<!-- 如果主要证据来自日志、SQL 查询或命令行输出，必须保留关键输出摘要，不得只说“已通过” -->
require_key_output_excerpt_for_java_test_evidence

<!-- 如果问题涉及数据变更，验证应体现变更前后差异，而不只是最终状态 -->
require_before_after_state_evidence_for_java_data_bug_fix

## 自动纠错最小集合口径

1. 对 Java CRUD/API 工程，自动纠错前应先盘点接口总数、现有测试类数量和测试报告中的真实用例数，不得只看 `src/test` 目录存在与否。
2. 若 controller 层存在多个接口而测试只覆盖部分主路径，必须先补齐受影响接口的成功路径和对应错误路径，再继续宣称自动纠错完成。
3. 若 service 层存在参数校验、唯一约束、存在性校验、状态流转或空条件兜底逻辑，必须至少为受影响分支补一组针对性测试或等价可执行验证。
4. 若 mapper / dao 层存在 SQL 条件、排序、主键回填、字段映射或唯一键语义，必须至少补一组 repository 或 mapper 级测试，或给出同等强度的查询验证证据。
5. 若异常通过 `@ExceptionHandler`、统一响应壳或状态码转换收口，自动纠错必须验证错误码、错误消息和 HTTP 状态的实际输出，不得只验证异常被抛出。

## 禁止事项
<!-- 禁止改完 Java bug 后只看编译成功就宣称已修复 -->
forbid_compile_only_as_bug_fix_evidence

<!-- 禁止只跑全量大测试而没有与当前问题直接对应的目标测试 -->
forbid_full_suite_only_without_targeted_java_test

<!-- 禁止把共享开发数据库当默认测试环境直接写坏 -->
forbid_using_shared_runtime_database_as_default_java_test_target

<!-- 禁止在没有说明原因的情况下跳过失败复现而直接声称修复 -->
forbid_skipping_repro_without_reason_in_java_bug_fix
