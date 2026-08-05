package com.sp.selplat.local.code.common.rule;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.local.code.core.rule.LayeredRuleLoader;
import java.io.IOException;
import org.junit.jupiter.api.Test;

/**
 * 验证已登记的 XUNAN 用户层能够覆盖旧引用，同时保持 core/common 实体不变。
 */
class XunanRuleOverrideIntegrationTest {

    /**
     * XUNAN 必须通过独立递归索引完整登记五个用户逻辑 ID。
     */
    @Test
    void shouldValidateCompleteXunanIndexTree() throws IOException {
        LayeredRuleLoader.IndexValidation validation =
            LayeredRuleLoader.validateUserIndexTree("XUNAN");

        assertEquals(7, validation.indexCount());
        assertEquals(5, validation.ruleCount());
    }

    /**
     * AI 智慧整合规则必须由当前用户层直接命中。
     */
    @Test
    void shouldLoadAiRulePackageIntelligenceFromXunan() throws IOException {
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "AI_RULE_PACKAGE_INTELLIGENCE_RULES",
            "selplat",
            "XUNAN"
        );

        assertEquals("XUNAN", rule.layer());
        assertEquals(
            "local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md",
            rule.resourcePath()
        );
        assertTrue(rule.content().contains("ai_rule_driven_execution_and_continuous_rule_package_growth"));
    }

    /**
     * 旧拼音程序路径修正必须优先于 common 原规则返回给 XUNAN。
     */
    @Test
    void shouldLoadMigratedReferenceRepairForXunan() throws IOException {
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "CHINESE_PINYIN_CORRECTION_RULES",
            "中文教学",
            "XUNAN"
        );

        assertEquals("XUNAN", rule.layer());
        assertEquals(
            "local/XUNAN/中文教学/通用/rule/RUL_规则引用迁移修正规则.md",
            rule.resourcePath()
        );
        assertTrue(rule.content().contains(
            "apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/common/中文教学/拼音生成/"
        ));
        assertTrue(rule.content().contains("load_original_rule_semantics_then_replace_only_registered_stale_references"));
    }

    /**
     * 用户明确委托规则必须覆盖默认冻结策略，并且只对 XUNAN 生效。
     */
    @Test
    void shouldLoadExplicitAiManagedChangeDelegationForXunan() throws IOException {
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES",
            "selplat",
            "XUNAN"
        );

        assertEquals("XUNAN", rule.layer());
        assertEquals(
            "local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md",
            rule.resourcePath()
        );
        assertTrue(rule.content().contains(
            "explicit_user_delegation_with_standalone_1_only"
        ));
    }

    /**
     * Excel修订履历规则必须限制到实际修改Sheet，并要求履历字体可见。
     */
    @Test
    void shouldLoadExcelRevisionHistoryRuleForXunan() throws IOException {
        LayeredRuleLoader.LoadedRule rule = LayeredRuleLoader.load(
            "XUNAN_EXCEL_REVISION_HISTORY_RULES",
            "fujitsu",
            "XUNAN"
        );

        assertEquals("XUNAN", rule.layer());
        assertEquals(
            "local/XUNAN/跨工程通用规则/RUL_Excel修订履历填写规则.md",
            rule.resourcePath()
        );
        assertTrue(rule.content().contains(
            "excel_revision_history_write_scope = actually_modified_worksheets_only"
        ));
        assertTrue(rule.content().contains(
            "excel_revision_history_visibility_policy = revision_red_font_for_version_update_date_updater,visible_contrast"
        ));
        assertTrue(rule.content().contains(
            "excel_cell_edit_implementation_policy = native_excel_or_apache_poi,no_manual_ooxml_cell_splicing"
        ));
    }
}
