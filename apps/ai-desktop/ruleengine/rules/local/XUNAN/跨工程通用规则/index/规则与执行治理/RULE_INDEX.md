# 规则与执行治理规则索引

<!-- 本叶子索引由原索引按职责无损分片；逻辑 ID、路径和触发映射保持不变。 -->

<!-- 用户明确委托规则适用于当前稳定用户点名的任意 core/common 修改，不归属单个业务项目。 -->
RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES = local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md

<!-- 当前用户是实际规则和关联代码的唯一活跃归属层。 -->
ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES = local/XUNAN/跨工程通用规则/RUL_当前用户规则与代码归属规则.md

<!-- 迁移、创建或修改规则层级时加载当前用户归属规则。 -->
load_rule_for_rule_or_code_layer_migration = ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES

<!-- common 与当前用户发生规则或文件冲突时加载当前用户归属规则。 -->
load_rule_for_common_and_active_user_conflict = ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES

<!-- 新增或修改规则 DSL 写法时加载当前用户归属规则。 -->
load_rule_for_single_fact_rule_dsl_authoring = ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES

<!-- 测试数据修正必须同时验证受影响 case 单跑和全量套件，防止共享状态或数据库残留形成顺序依赖。 -->
TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES = local/XUNAN/跨工程通用规则/RUL_测试用例隔离一致性规则.md

<!-- 用户指出单 case 与全量结果不一致，或任务涉及测试数据冲突、顺序依赖和覆盖率恢复时加载。 -->
load_rule_for_active_user_single_case_and_full_suite_divergence = TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES

<!-- load_rule_for_active_user_test_data_conflict_or_coverage_repair 的当前独立事实为 TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES。 -->
load_rule_for_active_user_test_data_conflict_or_coverage_repair = TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES

<!-- 界面组件、图片产物或 IPC 修改需要选择快速自动测试与真实系统点击边界时加载。 -->
load_rule_for_active_user_fast_feedback_or_real_ui_test_selection = TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES

<!-- 用户触发统一测试时加载；统一测试包含全部登记门禁、失败修正、循环复测，以及桌面应用的生产构建和正式窗口尺寸验证。 -->
load_rule_for_active_user_unified_automated_and_system_ui_testing = TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES

<!-- PowerShell 5.1、原生命令管道或 HTTP JSON 涉及中日文时，在写入前扩展 common UTF-8 规则。 -->
UTF8_FILE_AND_COMMAND_RULES = local/XUNAN/跨工程通用规则/RUL_UTF8文件与命令规则.md

<!-- 使用 PowerShell 5.1 读取未声明 charset 的 JSON，或向原生程序传递中日文时加载本扩展。 -->
load_rule_for_active_user_powershell_http_json_or_native_unicode_pipeline = UTF8_FILE_AND_COMMAND_RULES

<!-- 文件、HTTP、数据库或消息写入的来源文本出现乱码或编码歧义时加载并阻断。 -->
load_rule_for_active_user_mojibake_or_ambiguous_text_mutation = UTF8_FILE_AND_COMMAND_RULES

<!-- 更新 Unicode 记录的非目标字段保全和写后对比时加载本扩展。 -->
load_rule_for_active_user_unicode_non_target_field_preservation = UTF8_FILE_AND_COMMAND_RULES

<!-- 系统实现评估必须以当前源码和真实接线为主要证据，并区分设计、实现、构建、测试与运行状态。 -->
SYSTEM_IMPLEMENTATION_SOURCE_EVIDENCE_ASSESSMENT_RULES = local/XUNAN/跨工程通用规则/RUL_系统实现评估源码证据规则.md

<!-- 评估系统、应用、自动化流程或 AI 能力是否已经实现、可运行或达到能力门槛时加载。 -->
load_rule_for_system_application_automation_or_ai_capability_assessment = SYSTEM_IMPLEMENTATION_SOURCE_EVIDENCE_ASSESSMENT_RULES

<!-- 规则新增、移动、删除、分类和分级索引维护的主治理规则。 -->
RULE_LIFECYCLE_GOVERNANCE_RULES = local/XUNAN/跨工程通用规则/RUL_规则生命周期治理规则.md

<!-- load_rule_for_rule_creation_move_delete_or_classification 的当前独立事实为 RULE_LIFECYCLE_GOVERNANCE_RULES。 -->
load_rule_for_rule_creation_move_delete_or_classification = RULE_LIFECYCLE_GOVERNANCE_RULES

<!-- load_rule_for_rule_index_maintenance 的当前独立事实为 RULE_LIFECYCLE_GOVERNANCE_RULES。 -->
load_rule_for_rule_index_maintenance = RULE_LIFECYCLE_GOVERNANCE_RULES

<!-- 执行文档按当前任务页面隔离，并接入 begin、step、active、ready、finish 统一任务门禁。 -->
EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES = local/XUNAN/跨工程通用规则/RUL_执行文档任务生命周期门禁规则.md

<!-- load_rule_for_execution_document_thread_isolation 的当前独立事实为 EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES。 -->
load_rule_for_execution_document_thread_isolation = EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES

<!-- load_rule_for_execution_document_history_or_legacy_migration 的当前独立事实为 EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES。 -->
load_rule_for_execution_document_history_or_legacy_migration = EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES

<!-- load_rule_for_formal_task_begin_step_or_finish 的当前独立事实为 EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES。 -->
load_rule_for_formal_task_begin_step_or_finish = EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES

<!-- load_rule_for_quick_special_full_or_root_delivery_gate 的当前独立事实为 EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES。 -->
load_rule_for_quick_special_full_or_root_delivery_gate = EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES

<!-- load_rule_for_test_document_record_result_or_archive 的当前独立事实为 EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES。 -->
load_rule_for_test_document_record_result_or_archive = EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES

<!-- load_rule_for_deferred_or_manual_unified_testing 的当前独立事实为 EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES。 -->
load_rule_for_deferred_or_manual_unified_testing = EXECUTION_DOCUMENT_TASK_LIFECYCLE_GATE_RULES

<!-- 工具运行数据、报告、日志、临时文件和缓存归属规则。 -->
TOOL_RUNTIME_DATA_OWNERSHIP_RULES = local/XUNAN/跨工程通用规则/RUL_工具运行数据归属规则.md

<!-- load_rule_for_tool_runtime_data_output_log_report_or_temp_ownership 的当前独立事实为 TOOL_RUNTIME_DATA_OWNERSHIP_RULES。 -->
load_rule_for_tool_runtime_data_output_log_report_or_temp_ownership = TOOL_RUNTIME_DATA_OWNERSHIP_RULES

<!-- 独立 3 记录最新一轮完整问答并在落盘后执行该轮明确任务。 -->
SESSION_LATEST_TURN_RECORD_AND_EXECUTE_RULES = local/XUNAN/跨工程通用规则/RUL_会话最新问答记录与执行规则.md
