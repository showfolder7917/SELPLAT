"""验证当前用户规则通过 Python 分层加载器完整命中。"""

from __future__ import annotations

# 导入 importlib，从生产路径复用唯一 Python 分层加载器。
import importlib.util
# 导入 sys，保证 dataclass 初始化能够回查真实模块。
import sys
# 导入 unittest，接入工程统一 core Python 测试入口。
import unittest
# 导入 Path，动态识别工程根与生产能力路径。
from pathlib import Path


# 工程根只由 settings.gradle 识别，不依赖本机绝对路径。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 用户规则集成测试直接调用生产登记能力，避免测试复制加载逻辑。
ABILITY_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/abilities"
    / "layered_rule_loader.py"
)


def load_module():
    """按 executor 相同顺序加载生产模块。"""

    module_name = "active_user_layered_rule_loader_test_module"
    spec = importlib.util.spec_from_file_location(module_name, ABILITY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 Python 分层加载器：{ABILITY_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


loader = load_module()


class ActiveUserRuleOverrideIntegrationTest(unittest.TestCase):
    """覆盖当前用户索引登记、物理归属和代表性规则语义。"""

    # 每个既有 Java 集成测试入口迁移为同一张 Python 参数表，减少重复启动和样板代码。
    ACTIVE_USER_RULE_CASES = (
        (
            "REFERENCE_DATA_WORKBENCH_NAVIGATION_AND_LAZY_LOADING_RULES",
            "selplat",
            "selplat/应用/reference-data/rule/RUL_ReferenceData工作台导航与按需加载规则.md",
            "reference_data_top_level_modules = types",
        ),
        (
            "SELPLAT_PUBLIC_COMPONENT_GOVERNANCE_GATE_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT公共控件治理门禁规则.md",
            "selplat_component_registry = shared/frontend/sel-ui/src/components/component-registry.json",
        ),
        (
            "SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT程序源码语言与归属门禁规则.md",
            "selplat_standard_gradle_backend_language_allowlist = java",
        ),
        (
            "SELPLAT_TOOL_RUNTIME_TEMP_PATH_ESCAPE_GUARD_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT工具运行临时目录防逃逸规则.md",
            "selplat_project_rule_overrides_generic_skill_temp_default = true",
        ),
        (
            "SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT应用脚手架生成规则.md",
            "selplat_scaffold_required_inputs = projectName",
        ),
        (
            "JAPANESE_QUESTION_BANK_AI_MEDIA_GENERATION_RULES",
            "selplat",
            "selplat/应用/japanese/rule/RUL_日本语题库AI媒体生成规则.md",
            "japanese_generation_confirmation_policy = direct_execution_without_second_confirmation",
        ),
        (
            "AI_RULE_PACKAGE_INTELLIGENCE_RULES",
            "selplat",
            "selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md",
            "ai_rule_driven_execution_and_continuous_rule_package_growth",
        ),
        (
            "AI_FACTORY_LOCAL_DRIVER_AND_TASK_RUNTIME_RULES",
            "selplat",
            "selplat/应用/rule-engine/rule/RUL_AI工厂本地驱动与任务目录规则.md",
            "ai_factory_only_active_workflow_driver = local_ai_memory_python_polling_client",
        ),
        (
            "SELPLAT_DATABASE_SQL_FILE_STRUCTURE_AND_NAMING_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT数据库SQL文件结构与命名规则.md",
            "selplat_schema_sql_single_formal_table_policy",
        ),
        (
            "SELPLAT_GRID_HORIZONTAL_SCROLL_DEFAULT_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT表格横向滚动默认规则.md",
            "selgrid_horizontal_scrollbar_activation = automatic_when_scroll_width_exceeds_client_width",
        ),
        (
            "SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT短时操作反馈规则.md",
            "selplat_transient_toast_lifecycle = fixed_overlay_auto_remove_after_2_to_4_seconds",
        ),
        (
            "SELPLAT_DYNAMIC_TABS_WORKSPACE_LIFECYCLE_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT动态页签工作区生命周期规则.md",
            "dynamic_tab_switch_lifecycle = hide_inactive_panel_and_preserve_session_state",
        ),
        (
            "SELPLAT_BASE_DAO_PROJECT_DATASOURCE_CONTEXT_RULES",
            "selplat",
            "selplat/通用/rule/RUL_SELPLAT基础DAO项目数据源上下文规则.md",
            "common_base_datasource_policy = abstract_project_context_only",
        ),
        (
            "MDA_LOCAL_DATABASE_WORKBENCH_FUNCTIONAL_RULES",
            "selplat",
            "selplat/应用/mda/rule/RUL_MDA本地数据库工作台功能规则.md",
            "mda_control_database_forbidden_business_tables = authentication",
        ),
        (
            "CHINESE_PINYIN_CORRECTION_RULES",
            "中文教学",
            "中文教学/通用/rule/RUL_规则引用迁移修正规则.md",
            "load_original_rule_semantics_then_replace_only_registered_stale_references",
        ),
        (
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES",
            "selplat",
            "跨工程通用规则/RUL_用户明确委托AI修正规则.md",
            "explicit_user_delegation_with_standalone_1_only",
        ),
        (
            "EXCEL_REVISION_HISTORY_RULES",
            "fujitsu",
            "跨工程通用规则/RUL_Excel修订履历填写规则.md",
            "excel_revision_history_write_scope = actually_modified_worksheets_only",
        ),
        (
            "TEST_CASE_ISOLATION_AND_SUITE_CONSISTENCY_RULES",
            "fujitsu",
            "跨工程通用规则/RUL_测试用例隔离一致性规则.md",
            "test_data_repair_completion_requires = full_suite_run + affected_single_case_run + result_comparison",
        ),
        (
            "UTF8_FILE_AND_COMMAND_RULES",
            "selplat",
            "跨工程通用规则/RUL_UTF8文件与命令规则.md",
            "powershell_51_unlabeled_json_auto_decode_policy = forbidden_for_unicode_read_or_mutation_input",
        ),
    )

    def test_validates_complete_active_user_index_tree(self) -> None:
        """当前用户二十二层索引完整登记七十九个规则逻辑 ID。"""

        self.assertEqual(
            loader.IndexValidation(22, 79),
            loader.validate_current_user_index_tree(),
        )

    def test_loads_all_migrated_active_user_rule_cases(self) -> None:
        """原 Java 集成测试覆盖的用户规则全部由 Python 命中。"""

        active_user = loader.current_stable_user_id()
        for logical_id, scope, relative_path, expected_content in self.ACTIVE_USER_RULE_CASES:
            with self.subTest(logical_id=logical_id):
                rule = loader.load_for_current_user(logical_id, scope)
                self.assertEqual(active_user, rule.layer)
                expected_path = (
                    "ruleengine/active-user/rules/平台/"
                    "RUL_SELPLAT程序源码语言与归属门禁规则.md"
                    if logical_id
                    == "SELPLAT_PROGRAM_SOURCE_LANGUAGE_AND_OWNERSHIP_GUARD_RULES"
                    else f"local/{active_user}/{relative_path}"
                )
                self.assertEqual(expected_path, rule.resource_path)
                self.assertIn(expected_content, rule.content)

    def test_utf8_user_rule_is_complete_without_common_layer(self) -> None:
        """common 迁空后，UTF-8 规则仅由当前用户层提供完整语义。"""

        active_user = loader.current_stable_user_id()
        stack = loader.load_rule_stack(
            "UTF8_FILE_AND_COMMAND_RULES", "selplat", active_user
        )
        self.assertEqual((active_user,), tuple(item.layer for item in stack.layers))
        self.assertEqual("extend", stack.override_mode)
        self.assertEqual(
            "strict_utf8_round_trip",
            stack.effective_values["unicode_text_prewrite_integrity_gate"],
        )
        self.assertEqual(
            "forbidden_for_unicode_read_or_mutation_input",
            stack.effective_values[
                "powershell_51_unlabeled_json_auto_decode_policy"
            ],
        )


if __name__ == "__main__":
    unittest.main()
