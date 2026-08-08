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
     * 验证当前稳定用户通过九层动态递归索引完整登记十个用户逻辑 ID。
     * 真实传参示例：读取工程根 {@code AGENTS.md} 中的当前稳定用户并递归加载其 {@code RULE_INDEX.md}。
     * 真实返回示例：索引验证结果为 {@code indexCount=9, ruleCount=10}。
     * 异常或副作用示例：身份、索引或规则路径无效时抛出 {@link IOException}，不修改规则资源。
     */
    @Test
    void shouldValidateCompleteActiveUserIndexTree() throws IOException {
        LayeredRuleLoader.IndexValidation validation =
            LayeredRuleLoader.validateCurrentUserIndexTree();

        assertEquals(9, validation.indexCount());
        assertEquals(10, validation.ruleCount());
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
