# 当前用户跨工程通用规则索引

<!-- 用户明确委托规则适用于当前稳定用户点名的任意 core/common 修改，不归属单个业务项目。 -->
RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES = local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md

<!-- Excel 修订履历规则只对当前稳定用户的工作簿修正任务生效，避免把局部修改误登记到全部 Sheet。 -->
EXCEL_REVISION_HISTORY_RULES = local/XUNAN/跨工程通用规则/RUL_Excel修订履历填写规则.md
<!-- 用户要求修正Excel内容、修订标识或履历时加载本规则。 -->
load_rule_for_active_user_excel_revision_or_correction = EXCEL_REVISION_HISTORY_RULES

<!-- 测试数据修正必须同时验证受影响 case 单跑和全量套件，防止共享状态或数据库残留形成顺序依赖。 -->
TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES = local/XUNAN/跨工程通用规则/RUL_测试用例隔离一致性规则.md
<!-- 用户指出单 case 与全量结果不一致，或任务涉及测试数据冲突、顺序依赖和覆盖率恢复时加载。 -->
load_rule_for_active_user_single_case_and_full_suite_divergence = TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES
load_rule_for_active_user_test_data_conflict_or_coverage_repair = TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES

<!-- PowerShell 5.1、原生命令管道或 HTTP JSON 涉及中日文时，在写入前扩展 common UTF-8 规则。 -->
UTF8_FILE_AND_COMMAND_RULES = local/XUNAN/跨工程通用规则/RUL_UTF8文件与命令规则.md
<!-- 使用 PowerShell 5.1 读取未声明 charset 的 JSON，或向原生程序传递中日文时加载本扩展。 -->
load_rule_for_active_user_powershell_http_json_or_native_unicode_pipeline = UTF8_FILE_AND_COMMAND_RULES
<!-- 文件、HTTP、数据库或消息写入的来源文本出现乱码或编码歧义时加载并阻断。 -->
load_rule_for_active_user_mojibake_or_ambiguous_text_mutation = UTF8_FILE_AND_COMMAND_RULES
<!-- 更新 Unicode 记录的非目标字段保全和写后对比时加载本扩展。 -->
load_rule_for_active_user_unicode_non_target_field_preservation = UTF8_FILE_AND_COMMAND_RULES
