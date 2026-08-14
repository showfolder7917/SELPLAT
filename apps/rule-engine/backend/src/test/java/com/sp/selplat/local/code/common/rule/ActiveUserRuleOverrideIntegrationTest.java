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
     * 验证当前稳定用户通过十一层动态递归索引完整登记十七个用户逻辑 ID。
     * 真实传参示例：读取工程根 {@code AGENTS.md} 中的当前稳定用户并递归加载其 {@code RULE_INDEX.md}。
     * 真实返回示例：索引验证结果为 {@code indexCount=11, ruleCount=17}。
     * 异常或副作用示例：身份、索引或规则路径无效时抛出 {@link IOException}，不修改规则资源。
     */
    @Test
    void shouldValidateCompleteActiveUserIndexTree() throws IOException {
        LayeredRuleLoader.IndexValidation validation =
            LayeredRuleLoader.validateCurrentUserIndexTree();

        assertEquals(11, validation.indexCount());
        assertEquals(17, validation.ruleCount());
    }

    /**
     * 验证 Reference Data 工作台导航与按需加载规则能够从当前用户应用索引命中。
     * 真实传参示例：逻辑 ID 为 {@code REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES}。
     * 真实返回示例：规则正文要求五个一级模块，并禁止表格字段重新成为一级节点。
     * 异常或副作用示例：索引或规则路径失效时抛出 {@link IOException}，不修改应用源码。
     */
    @Test
    void shouldLoadReferenceDataNavigationRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES",
            "selplat",
            "selplat/应用/reference-data/rule/RUL_ReferenceData工作台导航与按需加载规则.md",
            "reference_data_top_level_modules = types,tree,options,menus,tables"
        );
        assertTrue(rule.content().contains(
            "reference_data_table_column_navigation_level = "
                + "internal_table_definition_drilldown_only_not_top_level"
        ));
        assertTrue(rule.content().contains(
            "reference_data_initial_business_request_scope = "
                + "navigation_plus_active_module_records_plus_active_module_columns_only"
        ));
    }

    /**
     * 验证公共控件治理规则能够从当前用户通用索引命中，并递归声明源码归属规则依赖。
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES}。
     * 真实返回示例：规则正文要求先登记后实现，并由中央登记驱动未来控件检查。
     * 异常或副作用示例：索引、规则或依赖逻辑 ID 失效时抛出 {@link IOException}，不修改控件源码。
     */
    @Test
    void shouldLoadPublicComponentGovernanceGateFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT公共控件治理门禁规则.md",
            "selplat_component_registry = shared/frontend/sel-ui/src/components/"
                + "component-registry.json,version=2,one_authoritative_source,kernel=core/selKernel.js"
        );
        assertTrue(rule.content().contains(
            "requires_rule_ids = SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES"
        ));
        assertTrue(rule.content().contains(
            "selplat_component_creation_sequence = classify_reusable_interaction,"
                + "register_public_component,implement_public_component,connect_first_consumer,verify"
        ));
        assertTrue(rule.content().contains(
            "selplat_component_legacy_replacement_policy = enable_registered_component,"
                + "delete_private_legacy_implementation,no_compatibility_branch"
        ));
        assertTrue(rule.content().contains(
            "selplat_component_future_extension_gate = "
                + "registry_driven_directory_source_api_theme_dependency_and_application_scan"
        ));
        assertTrue(rule.content().contains(
            "selplat_truncated_text_tooltip_behavior = grid_and_tree_default_enabled,"
                + "real_overflow_only,pointer_and_focus,hide_on_scroll_resize_escape"
        ));
        assertTrue(rule.content().contains(
            "selplat_truncated_text_native_title_policy = forbidden_in_grid_and_tree,"
                + "delete_legacy_title,no_compatibility_branch"
        ));
        assertTrue(rule.content().contains(
            "selplat_grid_icon_action_tooltip_contract = "
                + "icon_only_record_action_requires_selTooltip_always,"
                + "aria_label_matches_tooltip,no_native_title"
        ));
        assertTrue(rule.content().contains(
            "selplat_grid_state_action_semantics = label_and_icon_describe_next_action,"
                + "enabled_record_shows_disable,disabled_record_shows_enable"
        ));
        assertTrue(rule.content().contains(
            "selplat_destructive_action_confirmation_component = "
                + "selConfirmDialog,compact_boolean_confirmation,no_selWindow"
        ));
        assertTrue(rule.content().contains(
            "selplat_destructive_confirmation_safety = execute_after_true_only,"
                + "cancel_close_escape_return_false,default_focus_cancel"
        ));
        assertTrue(rule.content().contains(
            "selplat_destructive_confirmation_truthful_copy = current_relation_count,"
                + "actual_soft_or_physical_delete_semantics,"
                + "no_unimplemented_database_block_claim"
        ));
        assertTrue(rule.content().contains(
            "selplat_page_editor_owner = selPersonalization,"
                + "application_registers_root_title_coordinates_capture_restore_save_only,"
                + "no_private_editor_shell"
        ));
        assertTrue(rule.content().contains(
            "selplat_page_editor_authorization = backend_capability_controls_visibility,"
                + "service_isAdmin_rechecks_every_save,no_frontend_only_authorization"
        ));
        assertTrue(rule.content().contains(
            "selplat_page_editor_session_lifecycle = preview_edit_segmented_mode,"
                + "capture_baseline,live_draft,dirty_indicator,cancel_restore,"
                + "explicit_save_then_new_baseline"
        ));
        assertTrue(rule.content().contains(
            "selplat_grid_page_editor_persistence = live_memory_resize,"
                + "one_terminal_change_event,batch_save_widths,"
                + "write_then_business_getGridColumn_refresh,no_request_per_pointermove"
        ));
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
        assertTrue(rule.content().contains(
            "selplat_application_table_domain_policy = "
                + "forbidden_use_CommonParam_Map_database_metadata"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_application_package_pattern = "
                + "<table-business>/controller|service|dao,"
                + "common/config|persistence|util/<actual-capability>"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_database_application_detection = "
                + "db_sql_directory|generated_project_ownership_marker|"
                + "active_user_central_registry,central_registration_required_for_all"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_non_persistent_capability_structure = "
                + "capability/<actual-capability>/controller|service,one_service_contract,"
                + "one_service_impl,no_dao,reusable_helpers_to_common_util,no_project_name_branch"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_database_application_registry = "
                + "local/<active-stable-user-id>/selplat/通用/registry/"
                + "managed-database-applications.json,version=1,unique_projectName,"
                + "registered_project_required"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_database_application_root_allowlist = "
                + "backend,frontend,db,doc,README.md,build.gradle,"
                + "generated_project_ownership_marker,no_contract,no_manifest,no_registry,"
                + "no_temp,no_placeholder"
        ));
        assertTrue(rule.content().contains(
            "selplat_nested_gitignore_policy = "
                + "apps_and_shared_forbidden,use_SELPLAT_root_gitignore,scan_all_modules"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_database_rebuild_sql_gate = "
                + "schema_create_if_not_exists,index_create_if_not_exists,matching_data_file,"
                + "seed_insert_where_not_exists,no_drop,no_truncate,no_delete,no_seed_update,"
                + "no_seed_merge"
        ));
        assertTrue(rule.content().contains(
            "selplat_authoritative_database_git_tracking_gate = "
                + "no_mvdb_ignore_pattern,all_mvdb_visible_and_trackable,"
                + "ignore_trace,ignore_lock,ignore_temp"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_business_service_cardinality = "
                + "one_contract,one_impl,no_common_service,no_common_crud"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_common_persistence_class_pattern = "
                + "<project>BaseDao,<capability>PersistenceConfiguration,"
                + "no_database_context_wrapper,use_qualified_infrastructure_beans"
        ));
        assertTrue(rule.content().contains(
            "selplat_query_representation_controller_boundary = "
                + "tree:own_table_business,options:own_table_business,"
                + "context-menu:own_table_business"
        ));
        assertTrue(rule.content().contains(
            "selplat_table_business_schema_mapping = "
                + "bidirectional,normalize_case_and_separator,allow_application_prefix_omission"
        ));
        assertTrue(rule.content().contains(
            "selplat_table_business_role_set = controller,service,service/impl,dao,no_other_role"
        ));
        assertTrue(rule.content().contains(
            "selplat_table_business_call_boundary = controller_to_own_service,"
                + "service_to_own_dao,service_to_other_service,service_to_common_util,no_cross_table_dao"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_database_file_location = "
                + "db/<application-name>.mv.db,no_nested_data_directory,no_parallel_migration_directory"
        ));
        assertTrue(rule.content().contains(
            "selplat_table_sequence_mapping = fully_empty_for_manual_setup_or_one_business_table_one_sequence_row,"
                + "seqCode=<TableName>Id,exactly_one_active_owner,no_partial_seed_set"
        ));
        assertTrue(rule.content().contains(
            "selplat_business_primary_key_strategy = CommonSequenceSegment:id_identity_exception,"
                + "business_table:no_identity,use_shared_SequenceGenerator"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_database_credential_gate = datasourcePrefix_required,"
                + "username=sa,password=123456,production_empty_password_forbidden"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_application_contract_gate = external_production_java_caller_required,"
                + "no_future_placeholder,internal_shape_use_CommonResult_Map_List"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_application_manifest_gate = manifestConsumer_required,"
                + "root_relative_reader_path,src_main_reader,manifest_module_json_read_evidence,"
                + "no_metadata_placeholder"
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
     * 真实返回示例：规则正文包含两个输入、无覆盖策略和按真实需求创建框架扩展。
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
            "selplat_scaffold_default_tree_source = local_all_records_root,"
                + "no_placeholder_backend_api,"
                + "real_tree_requirement_before_framework_extension"
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
        assertTrue(rule.content().contains(
            "selplat_scaffold_table_domain_policy = "
                + "no_domain_use_CommonParam_Map_database_metadata"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_java_package_pattern = <business>/controller,"
                + "<business>/service,<business>/service/impl,<business>/dao,"
                + "common/config,common/persistence,common/util/<capability>"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_business_service_cardinality = "
                + "one_table_one_service_contract_one_service_impl,"
                + "no_project_base_service,no_single_consumer_intermediate_service"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_framework_extension_policy = "
                + "real_interface_and_caller_and_dependency_and_registration_required,"
                + "no_default_reference_data_provider"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_primary_key_sequence = "
                + "<ActualTableName>Id,insert_where_not_exists,no_merge,no_cursor_reset"
        ));
        assertTrue(rule.content().contains(
            "selplat_scaffold_frontend_identity_fields = "
                + "tenantId,lastOperateUserId:no_editor,no_write_payload"
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
        assertTrue(rule.content().contains(
            "japanese_question_table_domain_policy = "
                + "no_domain_use_CommonParam_Map_database_metadata"
        ));
        assertTrue(rule.content().contains(
            "japanese_java_package_structure = n2bluebookquestion/"
                + "controller|service|service/impl|dao,"
                + "common/config|persistence|util"
        ));
        assertTrue(rule.content().contains(
            "japanese_business_service_policy = one_business_one_service_contract_and_impl,"
                + "no_single_consumer_content_service,service_calls_common_util_directly"
        ));
        assertTrue(rule.content().contains(
            "japanese_common_package_boundary = no_business_service,"
                + "no_crud_root,no_generation_root,no_media_root,no_runtime_root,"
                + "util/codex,util/speech,util/image,util/media,util/process"
        ));
        assertTrue(rule.content().contains(
            "japanese_crud_abstraction_policy = single_business_keep_in_business_service,"
                + "extract_only_after_multiple_real_consumers"
        ));
        assertTrue(rule.content().contains(
            "japanese_reference_data_policy = no_pre_reserved_provider,"
                + "no_reference_data_runtime_import,no_reference_data_dependency,"
                + "local_fixed_question_type_tree"
        ));
        assertTrue(rule.content().contains(
            "japanese_scanned_question_ai_review_without_pdf = explicit_user_choice_only,"
                + "local_codex_cli,all_records,locked_official_answer_letter,no_pdf_access"
        ));
        assertTrue(rule.content().contains(
            "japanese_audio_text_completion = locked_correct_option_fills_all_placeholders,"
                + "paired_answer_segments_supported,no_parenthesis_placeholder_to_tts"
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
     * 真实传参示例：逻辑 ID 为 {@code SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES}。
     * 真实返回示例：规则正文包含缺库重建、重复启动保留数据及种子写入门禁。
     * 异常或副作用示例：规则缺失或路径失效时抛出 {@link IOException}，不执行数据库 SQL。
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
        assertTrue(rule.content().contains(
            "selplat_application_authoritative_database_root = apps/<app>/db/<app>.mv.db"
        ));
        assertTrue(rule.content().contains(
            "selplat_business_table_sequence_cardinality = "
                + "fully_empty_for_manual_setup_or_one_table_one_row,"
                + "seqCode=<ActualTableName>Id,no_shared_business_sequence,no_partial_seed_set"
        ));
        assertTrue(rule.content().contains(
            "selplat_managed_local_database_default_credentials = "
                + "datasourcePrefix_required,username=sa,password=123456,exactly_once"
        ));
        assertTrue(rule.content().contains(
            "selplat_database_rebuild_and_reopen_contract = "
                + "missing_file_rebuild_from_sql,existing_file_no_reset,preserve_business_rows,"
                + "preserve_sequence_cursor,compatible_upgrade_only"
        ));
        assertTrue(rule.content().contains(
            "selplat_seed_sql_write_gate = "
                + "insert_where_not_exists,read_only_noop,no_merge,no_update,no_delete,no_ddl"
        ));
        assertTrue(rule.content().contains(
            "selplat_h2_gitignore_ownership = SELPLAT_root_only,"
                + "no_mvdb_ignore_pattern,all_mvdb_visible_and_trackable,trace_ignored,"
                + "lock_ignored,temp_ignored,before_backup_ignored,"
                + "no_nested_gitignore_any_module"
        ));
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
        assertTrue(rule.content().contains(
            "selgrid_column_resize_opt_out = grid_columnResize_false_only"
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
        assertTrue(rule.content().contains(
            "selplat_dangerous_action_confirmation_scope = permanent_delete,overwrite_existing_files,"
                + "discard_unsaved_content,cross_file_write"
        ));
        assertTrue(rule.content().contains(
            "selplat_multiple_risk_confirmation_policy = one_combined_dialog_per_user_action_no_stacked_confirmations"
        ));
        assertTrue(rule.content().contains(
            "selplat_confirmation_cancel_boundary = no_mutation_request_no_delete_no_file_replace_no_unsaved_state_disposal"
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
        assertTrue(rule.content().contains(
            "dynamic_tab_unsaved_close_confirmation = single_close,batch_close,data_source_switch,"
                + "confirm_before_disposal,cancel_preserves_complete_session"
        ));
        assertTrue(rule.content().contains(
            "dynamic_tab_user_batch_close_policy = closable_only,collect_all_dirty_tabs,"
                + "one_combined_confirmation,confirmed_force_cleanup,cancel_keeps_all"
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
            "table_definition_resolution = local_reference_data_provider_then_remote_resolve_http_then_real_field_names_silent"
        ));
        assertTrue(rule.content().contains(
            "managed_application_private_pool_delivery_gate = central_registry_driven_source_scan"
        ));
        assertTrue(rule.content().contains(
            "business_service_interface_contract = inherit_standard_base_service_signatures_and_declare_real_extensions_only"
        ));
        assertTrue(rule.content().contains(
            "business_service_redundant_wrapper_policy = remove_unused_long_id_no_arg_paging_and_super_only_wrappers"
        ));
        assertTrue(rule.content().contains(
            "base_service_current_operator_source = "
                + "BaseServiceImpl.getCurrentOperatorId,temporary_admin_id_1"
        ));
        assertTrue(rule.content().contains(
            "base_service_current_tenant_source = "
                + "BaseServiceImpl.getCurrentTenantId,temporary_tenant_id_1"
        ));
        assertTrue(rule.content().contains(
            "base_service_current_admin_source = BaseServiceImpl.isAdmin,temporary_true,"
                + "service_authorization_recheck,no_frontend_only_permission"
        ));
        assertTrue(rule.content().contains(
            "frontend_identity_write_policy = tenantId,lastOperateUserId:"
                + "read_only_or_hidden,forbid_form_and_write_payload"
        ));
    }

    /**
     * 验证 MDA 功能规则能从当前用户应用索引命中，并且不再声明应用专属源码架构。
     * 真实传参示例：逻辑 ID 为 {@code MDA_LOCAL_DATABASE_WORKBENCH_FUNCTIONAL_RULES}，作用域为 {@code selplat}。
     * 真实返回示例：规则路径为 {@code selplat/应用/mda/rule/RUL_MDA本地数据库工作台功能规则.md}，
     * 正文包含控制库禁止引入其他业务表和身份字段的声明。
     * 异常或副作用示例：当前用户、索引路径或规则正文无效时抛出 {@link IOException} 或断言失败，不修改规则资源。
     */
    @Test
    void shouldLoadMdaControlDatabaseBoundaryRuleFromActiveUser() throws IOException {
        LayeredRuleLoader.LoadedRule rule = assertCurrentUserRule(
            "MDA_LOCAL_DATABASE_WORKBENCH_FUNCTIONAL_RULES",
            "selplat",
            "selplat/应用/mda/rule/RUL_MDA本地数据库工作台功能规则.md",
            "mda_control_database_forbidden_business_tables = authentication,tenant,role,permission,operator"
        );
        assertTrue(rule.content().contains(
            "mda_control_database_forbidden_identity_columns = tenantId,lastOperateUserId"
        ));
        assertTrue(rule.content().contains(
            "mda_legacy_identity_artifact_policy = remove_from_mda_without_recreating_foreign_application_tables_or_fixtures"
        ));
        assertTrue(rule.content().contains(
            "mda_source_structure_owner = SELPLAT_uniform_managed_application_gate_no_mda_exception"
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
        assertTrue(rule.content().contains(
            "mda_query_tab_unsaved_close_policy = compare_initial_or_last_successful_execution,"
                + "single_and_batch_and_connection_switch_confirm,one_dialog_for_all_dirty_tabs"
        ));
        assertTrue(rule.content().contains(
            "mda_project_generation_confirmation = shared_confirm_dialog_with_project_and_table_before_request_cancel_writes_nothing"
        ));
        assertTrue(rule.content().contains(
            "mda_table_context_actions = inspect_structure_first_edit_structure_delete_real_target_object_"
                + "copy_display_label_with_table_type_physical_table_export_last"
        ));
        assertTrue(rule.content().contains(
            "mda_table_structure_view_content = field_grid_only_name_comment_type_primary_nullable_"
                + "default_auto_increment_generated"
        ));
        assertTrue(rule.content().contains(
            "mda_table_structure_view_safety = jdbc_metadata_only_without_sql_execution_or_database_mutation"
        ));
        assertTrue(rule.content().contains(
            "mda_dynamic_grid_payload_contract = shared_complete_title_messages_for_query_and_structure_grids"
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
