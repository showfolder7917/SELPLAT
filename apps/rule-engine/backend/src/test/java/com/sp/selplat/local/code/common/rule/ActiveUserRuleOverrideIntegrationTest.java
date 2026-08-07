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
     * 当前稳定用户必须通过动态解析的独立递归索引完整登记八个用户逻辑 ID。
     */
    @Test
    void shouldValidateCompleteActiveUserIndexTree() throws IOException {
        LayeredRuleLoader.IndexValidation validation =
            LayeredRuleLoader.validateCurrentUserIndexTree();

        assertEquals(9, validation.indexCount());
        assertEquals(8, validation.ruleCount());
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
