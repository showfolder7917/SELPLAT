"""规则引擎结构与 history 解耦门禁测试。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import re
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
ACTIVE_USER = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "apps/ai-desktop/ruleengine/AGENTS.md").read_text(encoding="utf-8"),
)[0]
PROGRAM_PATH = (
    PROJECT_ROOT / "apps/ai-desktop/ruleengine/python/local"
    / ACTIVE_USER / "abilities/ruleengine_structure_guard.py"
)


def load_guard_module():
    """从稳定当前用户能力路径加载真实门禁。"""
    spec = importlib.util.spec_from_file_location("ruleengine_structure_guard_test", PROGRAM_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuleengineStructureGuardTests(unittest.TestCase):
    """覆盖索引、当前规则、缓存和 history 零依赖的统一报告。"""

    def test_real_ruleengine_has_no_hard_structure_violation(self) -> None:
        """真实工程在严格模式升级前也必须先达到硬违规为零。"""
        result = load_guard_module().audit_ruleengine_structure(PROJECT_ROOT)
        self.assertEqual(result["hardViolations"], [])
        self.assertGreater(result["logicalRuleCount"], 0)
        self.assertGreater(result["triggerCount"], 0)

    def test_all_active_rules_use_compact_schema_2(self) -> None:
        result = load_guard_module().audit_ruleengine_structure(PROJECT_ROOT)
        self.assertTrue(result["metrics"]["rules"])
        self.assertTrue(
            all(rule["schemaVersion"] == "2" for rule in result["metrics"]["rules"])
        )
        self.assertTrue(
            all(rule["dslCount"] >= 9 for rule in result["metrics"]["rules"])
        )

    def test_active_rules_and_indexes_contain_machine_dsl_only(self) -> None:
        rule_root = PROJECT_ROOT / "apps/ai-desktop/ruleengine/rules"
        result = load_guard_module().audit_ruleengine_structure(PROJECT_ROOT)
        paths = [item["resourcePath"] for item in result["metrics"]["rules"]]
        paths.extend(item["resourcePath"] for item in result["metrics"]["indexes"])
        for relative_path in paths:
            with self.subTest(relative_path=relative_path):
                lines = (rule_root / relative_path).read_text(encoding="utf-8").splitlines()
                self.assertTrue(lines)
                self.assertTrue(
                    all(
                        re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]*\s*=\s*.+", line)
                        for line in lines
                    )
                )

    def test_active_user_owner_and_recipe_paths_are_portable(self) -> None:
        rule_root = PROJECT_ROOT / "apps/ai-desktop/ruleengine/rules"
        result = load_guard_module().audit_ruleengine_structure(PROJECT_ROOT)
        for metric in result["metrics"]["rules"]:
            relative_path = metric["resourcePath"]
            text = (rule_root / relative_path).read_text(encoding="utf-8")
            if relative_path.startswith(f"local/{ACTIVE_USER}/"):
                self.assertIn("rule_owner = active_user", text, relative_path)
                self.assertNotIn(f"rule_owner = {ACTIVE_USER}", text, relative_path)
            for line in text.splitlines():
                if line.startswith("recipe_resource_path = "):
                    self.assertNotIn("\\", line, relative_path)


if __name__ == "__main__":
    unittest.main()
