package com.sp.selplat.local.code.common.rule;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.local.code.core.rule.LayeredRuleLoader;
import java.io.IOException;
import org.junit.jupiter.api.Test;

/**
 * 验证 AGENTS.md 当前稳定用户层能够覆盖旧引用，同时保持 core/common 实体不变。
 */
class ActiveUserRuleOverrideIntegrationTest {

    /**
     * 验证当前稳定用户通过十层动态递归索引完整登记十五个用户逻辑 ID。
     * 真实传参示例：读取工程根 {@code AGENTS.md} 中的当前稳定用户并递归加载其 {@code RULE_INDEX.md}。
     * 真实返回示例：索引验证结果为 {@code indexCount=10, ruleCount=15}。
     * 异常或副作用示例：身份、索引或规则路径无效时抛出 {@link IOException}，不修改规则资源。
     */
    @Test
    void shouldValidateCompleteActiveUserIndexTree() throws IOException {
        LayeredRuleLoader.IndexValidation validation =
            LayeredRuleLoader.validateCurrentUserIndexTree();

        assertEquals(10, validation.indexCount());
        assertEquals(15, validation.ruleCount());
    }

    /**
     * 验证 SELPLAT 全部程序的源码语言与归属门禁能从当前用户通用索引命中。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES}。
     * 真实返回示例：规则正文要求普通 Gradle 后端只登记 Java，rule-engine 按语言和层级管理能力。
     * 异常或副作用示例：索引缺失或规则路径失效时抛出 {@link IOException}，不创建或移动源码。
     */
    @Test
    void shouldLoadProgramSourceLanguageAndOwnershipGuardFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT程序源码语言与归属门禁规则.md",
            "selplat_standard_gradle_backend_language_allowlist = java"
        );
        assertTrue(rule.content().contains(
            "selplat_rule_engine_language_allowlist = java,python,node"
        ));
        assertTrue(rule.content().contains(
            "selplat_source_ownership_blocking_gate = zero_violations_required"
        ));
        assertTrue(rule.content().contains(
            "selplat_python_bytecode_cache_root = <SELPLAT_ROOT>/cache/python-pycache"
        ));
        assertTrue(rule.content().contains(
            "selplat_application_http_request_contract = CommonParam,CommonBatchParam,CommonPageParam"
        ));
        assertTrue(rule.content().contains(
            "selplat_application_private_http_protocol_type_policy = forbidden"
        ));
    }

    /**
     * 验证工具运行临时目录防逃逸规则能从当前用户通用索引命中。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES}。
     * 真实返回示例：规则正文要求工程规则覆盖通用技能默认目录，并在读写前执行路径预检。
     * 异常或副作用示例：索引缺失或规则路径失效时抛出 {@link IOException}，不创建临时文件。
     */
    @Test
    void shouldLoadToolRuntimeTempPathEscapeGuardFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT工具运行临时目录防逃逸规则.md",
            "selplat_project_rule_overrides_generic_skill_temp_default = true"
        );
        assertTrue(rule.content().contains(
            "selplat_temp_path_preflight = resolve_before_io,descendant_of_OPTION_temp,root_itself_forbidden"
        ));
        assertTrue(rule.content().contains(
            "selplat_root_pollution_delivery_gate = scan_tmp_runtime_logs_and_temporary_copies"
        ));
    }

    /**
     * 验证 SELPLAT 应用脚手架规则能从当前用户通用索引命中。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES}。
     * 真实返回示例：规则正文包含两个输入、无覆盖策略和 reference-data Provider 登记。
     * 异常或副作用示例：索引或规则失效时抛出 {@link IOException}，不修改规则资源。
     */
    @Test
    void shouldLoadApplicationScaffoldGeneratorRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT应用脚手架生成规则.md",
            "selplat_scaffold_required_inputs = projectName,tableName"
        );
        assertTrue(rule.content().contains(
            "selplat_scaffold_existing_target_policy = reject_entire_operation_without_overwrite"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_reference_data_registration = provider(projectCode,resourceCode)"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_controller_service_dependency = interface_only,no_service_impl_import"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_service_architecture_gate = current_mda_contract"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_empty_data_script = explanatory_comment,SELECT_1_statement,no_business_rows"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_desktop_registration = applications_json_entry,internal_path_allowlist"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_final_runtime = unified_host_required,standalone_application_not_sufficient"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_http_contract = CommonParam,CommonResult,"
                + "no_private_Request_Response_Result_Page_Param"
        ));
    }

    /**
     * 验证 Japanese 题库生成规则从应用叶子索引命中并固定指定语音环境。
     * 真实传参示例：逻辑 ID 为 {@code JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES}。
     * 真实返回示例：规则正文包含 NanamiNeural、edge-tts venv 和云存储接口边界。
     * 异常或副作用示例：索引或规则失效时抛出 {@link IOException}，不调用任何外部生成进程。
     */
    @Test
    void shouldLoadJapaneseQuestionBankAiMediaRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES",
            "selplat",
            "selplat/应用/japanese/rule/RUL_日本语题库AI媒体生成规则.md",
            "japanese_generation_confirmation_policy = direct_execution_without_second_confirmation"
        );
        assertTrue(rule.content().contains(
            "OPTION/edge-tts-venv/bin/edge-tts"
        ));
        assertTrue(rule.content().contains(
            "japanese_media_cloud_migration_boundary = JapaneseMediaStorage_interface"
        ));
        assertTrue(rule.content().contains(
            "japanese_question_http_contract = CommonParam,CommonBatchParam,CommonPageParam,"
                + "CommonResult,no_private_protocol_types"
        ));
    }

    /**
     * AI 智慧整合规则必须由当前用户层直接命中。
     */
    @Test
    void shouldLoadAiRulePackageIntelligenceFromActiveUser() throws IOException {
        assertCurrentUserRule(
            "AI_RULE_PACKAGE_INTELLIGENCE_RULES",
            "selplat",
            "selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md",
            "ai_rule_driven_execution_and_continuous_rule_package_growth"
        );
    }

    /**
     * SELPLAT 数据库 SQL 文件结构规则必须从当前用户通用叶子索引命中。
     */
    @Test
    void shouldLoadDatabaseSqlStructureRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT数据库SQL文件结构与命名规则.md",
            "selplat_schema_sql_single_formal_table_policy"
        );
        assertTrue(rule.content().contains("selplat_database_field_requires_real_call_chain"));
    }

    /**
     * 验证 SELPLAT 公共表格规则能从当前用户通用索引命中，并固定真实溢出自动启用的默认边界。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES}，作用域为 {@code selplat}。
     * 真实返回示例：加载结果路径为 {@code selplat/通用/rule/RUL_SELPLAT表格横向滚动默认规则.md}，正文包含自动溢出声明。
     * 异常或副作用示例：索引缺失、路径逃逸或正文缺少默认声明时抛出 {@link IOException} 或断言失败，不修改规则文件。
     */
    @Test
    void shouldLoadGridHorizontalScrollDefaultRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT表格横向滚动默认规则.md",
            "selgrid_horizontal_scrollbar_activation = automatic_when_scroll_width_exceeds_client_width"
        );
        assertTrue(rule.content().contains(
            "selgrid_explicit_horizontal_scroll_option_boundary = wide_column_layout_only_not_scrollbar_visibility"
        ));
    }

    /**
     * 验证 SELPLAT 短时反馈规则能从当前用户通用索引命中，并固定 Toast 与状态栏职责边界。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES}，作用域为 {@code selplat}。
     * 真实返回示例：加载结果路径为 {@code selplat/通用/rule/RUL_SELPLAT短时操作反馈规则.md}，正文包含二至四秒自动清理声明。
     * 异常或副作用示例：索引缺失、路径逃逸或正文缺少状态栏边界时抛出 {@link IOException} 或断言失败，不修改规则文件。
     */
    @Test
    void shouldLoadTransientOperationFeedbackRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT短时操作反馈规则.md",
            "selplat_transient_toast_lifecycle = fixed_overlay_auto_remove_after_2_to_4_seconds"
        );
        // 短时 Toast 加载成功 → 编辑器状态栏仍只承担实时位置或上下文展示。
        assertTrue(rule.content().contains(
            "selplat_editor_status_bar_boundary = current_position_or_live_context_not_completed_action_message"
        ));
    }

    /**
     * 验证 SELPLAT 动态页签规则能从当前用户通用索引命中，并固定切换保留和关闭销毁边界。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES}，作用域为 {@code selplat}。
     * 真实返回示例：规则正文包含 {@code dynamic_tab_switch_lifecycle} 和 {@code dynamic_tab_close_lifecycle} 声明。
     * 异常或副作用示例：索引缺失、路径逃逸或生命周期声明缺失时抛出 {@link IOException} 或断言失败，不修改规则文件。
     */
    @Test
    void shouldLoadDynamicTabsWorkspaceLifecycleRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT动态页签工作区生命周期规则.md",
            "dynamic_tab_switch_lifecycle = hide_inactive_panel_and_preserve_session_state"
        );
        assertTrue(rule.content().contains(
            "dynamic_tab_close_lifecycle = destroy_dom_events_controllers_observers_timers_and_registry"
        ));
        assertTrue(rule.content().contains(
            "dynamic_workspace_visual_token_policy = unified_theme_semantic_tokens_without_application_color_override"
        ));
    }

    /**
     * SELPLAT 基础 DAO 必须从当前用户规则中命中项目数据源上下文约束。
     */
    @Test
    void shouldLoadBaseDaoProjectDataSourceContextRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT基础DAO项目数据源上下文规则.md",
            "common_base_datasource_policy = abstract_project_context_only"
        );
        assertTrue(rule.content().contains(
            "concrete_dao_inheritance = concrete_DAO_to_project_BaseDao_to_common_BaseDaoImpl"
        ));
        assertTrue(rule.content().contains(
            "default_table_definition_source = project_BaseDao_real_database_metadata"
        ));
        assertTrue(rule.content().contains(
            "table_definition_resolution = reference_data_configuration_when_present_otherwise_project_metadata"
        ));
        assertTrue(rule.content().contains(
            "business_service_interface_contract = inherit_standard_base_service_signatures_and_declare_real_extensions_only"
        ));
        assertTrue(rule.content().contains(
            "business_service_redundant_wrapper_policy = remove_unused_long_id_no_arg_paging_and_super_only_wrappers"
        ));
    }

    /**
     * 验证 MDA 应用规则能从当前用户应用索引命中，并固定控制库只保留连接配置与号段的边界。
     * 真实传参示例：逻辑 ID 为 {@code MDA_LOCAL_DATABASE_WORKBENCH_RULES}，作用域为 {@code selplat}。
     * 真实返回示例：规则路径为 {@code selplat/应用/mda/rule/RUL_MDA本地数据库工作台架构规则.md}，
     * 正文包含控制库禁止引入其他业务表和身份字段的声明。
     * 异常或副作用示例：当前用户、索引路径或规则正文无效时抛出 {@link IOException} 或断言失败，不修改规则资源。
     */
    @Test
    void shouldLoadMdaControlDatabaseBoundaryRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "MDA_LOCAL_DATABASE_WORKBENCH_RULES",
            "selplat",
            "selplat/应用/mda/rule/RUL_MDA本地数据库工作台架构规则.md",
            "mda_control_database_forbidden_business_tables = authentication,tenant,role,permission,operator"
        );
        assertTrue(rule.content().contains(
            "mda_control_database_forbidden_identity_columns = tenantId,lastOperateUserId"
        ));
        assertTrue(rule.content().contains(
            "mda_legacy_identity_artifact_policy = remove_from_mda_without_recreating_foreign_application_tables_or_fixtures"
        ));
        assertTrue(rule.content().contains(
            "mda_table_node_open_behavior = open_or_reuse_table_query_tab_execute_select_from_plain_table_name_without_schema_or_identifier_quotes"
        ));
        assertTrue(rule.content().contains(
            "mda_result_row_double_click_behavior = highlight_exact_row_and_open_shared_data_edit_window"
        ));
        assertTrue(rule.content().contains(
            "mda_row_edit_field_label_policy = database_field_name_only_without_inline_type"
        ));
        assertTrue(rule.content().contains(
            "mda_row_edit_character_field_control = multiline_textarea"
        ));
        assertTrue(rule.content().contains(
            "mda_double_clicked_cell_field_feedback = highlight_and_focus_matching_editable_control"
        ));
        assertTrue(rule.content().contains(
            "mda_row_edit_target_identity = actual_database_primary_key_required"
        ));
        assertTrue(rule.content().contains(
            "mda_row_edit_save_policy = prepared_single_row_update_then_refresh_and_reselect"
        ));
        assertTrue(rule.content().contains(
            "mda_ad_hoc_query_edit_policy = read_only_without_verified_table_and_primary_key"
        ));
        assertTrue(rule.content().contains(
            "mda_table_structure_edit_template = current_jdbc_database_dialect_with_original_table_and_column_comments"
        ));
        assertTrue(rule.content().contains(
            "mda_missing_original_column_comment = emit_empty_sql_string_without_synthetic_fallback"
        ));
    }

    /**
     * 旧拼音程序路径修正必须优先于 common 原规则返回给当前稳定用户。
     */
    @Test
    void shouldLoadMigratedReferenceRepairForActiveUser() throws IOException {
        assertCurrentUserRule(
            "CHINESE_PINYIN_CORRECTION_RULES",
            "中文教学",
            "中文教学/通用/rule/RUL_规则引用迁移修正规则.md",
            "load_original_rule_semantics_then_replace_only_registered_stale_references"
        );
    }

    /**
     * 用户明确委托规则必须覆盖默认冻结策略，并且只对当前稳定用户生效。
     */
    @Test
    void shouldLoadExplicitAiManagedChangeDelegationForActiveUser() throws IOException {
        assertCurrentUserRule(
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES",
            "selplat",
            "跨工程通用规则/RUL_用户明确委托AI修正规则.md",
            "explicit_user_delegation_with_standalone_1_only"
        );
    }

    /**
     * Excel 修订履历规则必须限制到实际修改 Sheet，并要求履历字体可见。
     */
    @Test
    void shouldLoadExcelRevisionHistoryRuleForActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "EXCEL_REVISION_HISTORY_RULES",
            "fujitsu",
            "跨工程通用规则/RUL_Excel修订履历填写规则.md",
            "excel_revision_history_write_scope = actually_modified_worksheets_only"
        );
        assertTrue(rule.content().contains(
            "excel_revision_history_visibility_policy = revision_red_font_for_version_update_date_updater,visible_contrast"
        ));
        assertTrue(rule.content().contains(
            "excel_cell_edit_implementation_policy = native_excel_or_apache_poi,no_manual_ooxml_cell_splicing"
        ));
    }

    /**
     * 加载规则后统一验证层名、动态物理路径和关键业务声明。
     *
     * @param logicalId 真实调用逻辑 ID，例如 {@code EXCEL_REVISION_HISTORY_RULES}
     * @param activeScope 真实 common 作用域，例如 {@code selplat}
     * @param userRelativePath 当前用户根索引下的规则相对路径
     * @param expectedContent 返回正文必须包含的业务声明
     * @return 已验证的当前用户规则，可继续断言其他业务内容
     * @throws IOException 当前身份、索引、路径或规则正文无效
     */
    private LayeredRuleLoader.LoadedRule assertCurrentUserRule(
            String logicalId,
            String activeScope,
            String userRelativePath,
            String expectedContent) throws IOException {
        String activeUser = LayeredRuleLoader.currentStableUserId();
        LayeredRuleLoader.LoadedRule rule =
            LayeredRuleLoader.loadForCurrentUser(logicalId, activeScope);

        assertEquals(activeUser, rule.layer());
        assertEquals("local/" + activeUser + "/" + userRelativePath, rule.resourcePath());
        assertTrue(rule.content().contains(expectedContent));
        return rule;
    }
}
