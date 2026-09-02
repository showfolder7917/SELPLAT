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


if __name__ == "__main__":
    unittest.main()
