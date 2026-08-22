# 测试用例隔离一致性规则

<!-- 当前规则所有者由工程根 AGENTS.md 的稳定用户身份动态解析，禁止在规则正文固定具体用户。 -->
rule_owner_source = AGENTS.md.current_stable_user_id
<!-- 1.1.0 增加快速自动测试优先、真实系统交互按边界触发的分层测试策略。 -->
rule_version = 1.1.0
<!-- 当前规则已经登记到当前用户跨工程规则索引并保持生效。 -->
rule_status = active
<!-- 本次升级把用户确认的快速测试口径固定为跨工程可复用约束。 -->
upgrade_record = 2026-08-22:组件_产物_IPC_构建快速反馈优先_系统交互变化才做真实点击_统一测试执行全部登记项

<!-- 问题：同一测试 case 在全量运行与单独运行时可能因共享日志、静态状态、数据库残留或执行顺序而得到不同结果。 -->
<!-- 场景：修正测试数据、恢复覆盖率、处理单 case 与全量套件结果不一致。 -->
<!-- 业务含义：测试结果必须由当前 case 自身输入决定，不能依赖前序 case 留下的状态。 -->
rule_scope = cross_project/test_case_isolation_and_suite_consistency

<!-- 测试数据修正完成前必须同时执行全量套件和至少一个受影响 case 的独立运行，并记录两种结果。 -->
test_data_repair_completion_requires = full_suite_run + affected_single_case_run + result_comparison

<!-- 单跑与全量结果不一致时必须分别核对共享静态状态、日志残留、数据库残留、可变 fixture 是否完整以及执行顺序。 -->
single_suite_divergence_diagnosis = shared_static_state
<!-- single_suite_divergence_diagnosis.2 的当前独立事实为 log_residue。 -->
single_suite_divergence_diagnosis.2 = log_residue
<!-- single_suite_divergence_diagnosis.3 的当前独立事实为 database_residue。 -->
single_suite_divergence_diagnosis.3 = database_residue
<!-- single_suite_divergence_diagnosis.4 的当前独立事实为 mutable_fixture_completeness。 -->
single_suite_divergence_diagnosis.4 = mutable_fixture_completeness
<!-- single_suite_divergence_diagnosis.5 的当前独立事实为 execution_order。 -->
single_suite_divergence_diagnosis.5 = execution_order

<!-- 每个数据库 case 必须显式准备全部受影响可变表；预期为空的表也要提供空数据集以清除前序数据。 -->
database_case_fixture_isolation_requires = all_affected_mutable_tables + explicit_empty_dataset_for_expected_empty_table

<!-- 为覆盖业务分支而补充的数据必须通过正式 Mapper 和真实隔离数据库驱动，禁止用旧报告、Mock 或反射伪造覆盖证据。 -->
coverage_repair_evidence_requires = fresh_jacoco_report + production_mapper_sql + isolated_real_database_fixture

<!-- 全量通过不能替代单 case 验证，单 case 通过也不能替代相邻全量回归。 -->
forbid_one_execution_mode_as_substitute_for_the_other = full_suite
<!-- forbid_one_execution_mode_as_substitute_for_the_other.2 的当前独立事实为 single_case。 -->
forbid_one_execution_mode_as_substitute_for_the_other.2 = single_case

<!-- 当前用户确认修改阶段只登记测试责任，避免每个小改动重复启动完整测试环境；用户明确“统一测试”后再集中执行。 -->
change_phase_test_policy = record_required_tests_without_immediate_execution
<!-- test_document_naming 的当前独立事实为 测试文档.<CURRENT_THREAD_ID>.md。 -->
test_document_naming = 测试文档.<CURRENT_THREAD_ID>.md
<!-- manual_unified_test_trigger 的当前独立事实为 explicit_user_request。 -->
manual_unified_test_trigger = explicit_user_request

<!-- 延迟执行不降低原测试口径；涉及测试数据或覆盖率修复时，单 case 与相邻全量仍作为两个独立待测项登记并在统一测试阶段分别执行。 -->
deferred_test_plan_must_preserve_required_modes = affected_single_case + adjacent_full_suite
<!-- unexecuted_test_must_be_reported_as 的当前独立事实为 pending_not_passed。 -->
unexecuted_test_must_be_reported_as = pending_not_passed

## 快速反馈与真实界面测试分层

<!-- 普通业务逻辑和界面组件修改优先执行秒级自动检查，依次验证状态变化、生成产物、进程边界和受影响构建，禁止每次重复完整人工点击链路。 -->
fast_feedback_test_order = pure_logic_or_component_automation + generated_artifact_assertion + ipc_boundary_assertion + affected_build

<!-- 自动测试必须覆盖用户可观察到的相同状态变化、落盘或回填产物以及发送或不发送等副作用，不能用只检查函数被调用的弱断言替代真实效果。 -->
fast_test_effect_equivalence_requires = same_user_observable_state_transition + same_generated_or_saved_artifact + same_external_side_effect_or_no_side_effect

<!-- 只有本次修改触及操作系统窗口、权限、显示器截图、全屏蒙版、焦点、系统对话框或平台原生行为时，才必须增加真实界面点击回归。 -->
real_ui_interaction_test_trigger = os_window + permission + display_capture + fullscreen_overlay + focus + native_dialog + platform_native_behavior

<!-- 真实界面回归只覆盖实际发生变化的系统边界一次；纯组件、画布数据、图片生成或 IPC 逻辑修改不得重复跑完整手工点击流程。 -->
real_ui_interaction_scope = one_targeted_run_per_changed_system_boundary + no_repeated_full_click_path_for_non_system_change

<!-- 修改阶段允许先执行相关快速自动测试并登记结果；快速通过只能标记定向回归通过，不能冒充完整统一测试通过。 -->
fast_test_result_reporting = targeted_fast_pass_not_full_unified_pass

<!-- 用户明确触发统一测试后，必须执行测试文档中登记的全部自动测试以及确有系统边界变化的真实界面项目。 -->
unified_test_execution_scope = all_registered_automated_tests + required_real_ui_system_boundary_tests
