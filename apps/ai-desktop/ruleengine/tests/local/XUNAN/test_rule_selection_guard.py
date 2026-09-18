"""验证 schema 2 规则选择回执和漏载、错载阻断。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest


PROJECT_ROOT = next(
    path for path in Path(__file__).resolve().parents if (path / "settings.gradle").is_file()
)
PROGRAM_PATH = PROJECT_ROOT / "apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/rule_selection_guard.py"


def _load_program():
    spec = importlib.util.spec_from_file_location("rule_selection_guard_test", PROGRAM_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class RuleSelectionGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.program = _load_program()

    def test_java_change_requires_core_and_selplat_java_gates(self) -> None:
        selected = self.program.select_rules({
            "scope": "selplat", "language": "java", "operation": "modify",
        })
        expected = selected["expected_rule_ids"]
        self.assertIn("CODE_JAVA_CODING_RULES", expected)
        self.assertIn("SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES", expected)
        accepted = self.program.execute({
            "features": {"scope": "selplat", "language": "java", "operation": "modify"},
            "loaded_rule_ids": expected,
        }, {}, {})
        self.assertEqual("completed", accepted["status"])

    def test_missing_and_unexpected_rules_are_blocked(self) -> None:
        result = self.program.execute({
            "features": {"scope": "selplat", "language": "java", "operation": "modify"},
            "loaded_rule_ids": ["MEMORY_FILE_EDIT_RULES"],
        }, {}, {})
        self.assertEqual("blocked", result["status"])
        self.assertIn("CODE_JAVA_CODING_RULES", result["missing_rule_ids"])
        self.assertIn("MEMORY_FILE_EDIT_RULES", result["unexpected_rule_ids"])

    def test_unknown_rule_is_blocked(self) -> None:
        result = self.program.execute({
            "features": {"artifact": "none", "operation": "review"},
            "loaded_rule_ids": ["UNKNOWN_RULE"],
        }, {}, {})
        self.assertEqual(["UNKNOWN_RULE"], result["unknown_rule_ids"])

    def test_exact_index_trigger_resolves_registered_rule(self) -> None:
        selected = self.program.select_rules({
            "scope": "selplat/rule-engine",
            "index_trigger": "load_rule_for_active_user_rule_cleanup_package_completion_or_continuous_upgrade",
        })
        self.assertIn("AI_RULE_PACKAGE_INTELLIGENCE_RULES", selected["expected_rule_ids"])

    def test_each_persona_role_selects_its_exact_contract(self) -> None:
        persona_rules = {
            "hanli": "AI_DESKTOP_HANLI_USER_QUESTIONING_RULES",
            "nangong": "AI_DESKTOP_NANGONG_ANALYSIS_PLANNING_RULES",
            "executor": "AI_DESKTOP_EXECUTOR_SOURCE_IMPLEMENTATION_RULES",
            "linghu": "AI_DESKTOP_LINGHU_FAILURE_TEST_RULES",
        }
        for role, logical_id in persona_rules.items():
            with self.subTest(role=role):
                selected = self.program.select_rules({"scope": "selplat", "role": role})
                self.assertIn(logical_id, selected["direct_match_rule_ids"])
                accepted = self.program.execute({
                    "features": {"scope": "selplat", "role": role},
                    "loaded_rule_ids": selected["expected_rule_ids"],
                }, {}, {})
                self.assertEqual("completed", accepted["status"])

    def test_hanli_recipe_restores_questioning_boundaries(self) -> None:
        loader = self.program.layered_rule_loader
        resource = loader.load_recipe_resource_for_current_user(
            "AI_DESKTOP_HANLI_USER_QUESTIONING_RULES", "selplat"
        )
        self.assertIn("hanli_question_contract =", resource.content)
        self.assertIn("hanli_investigation_question_boundary =", resource.content)

    def test_unknown_index_trigger_is_blocked(self) -> None:
        result = self.program.execute({
            "features": {"index_trigger": "load_rule_for_not_registered"},
            "loaded_rule_ids": [],
        }, {}, {})
        self.assertEqual("blocked", result["status"])
        self.assertIn("unknown index trigger", result["message"])


if __name__ == "__main__":
    unittest.main()
