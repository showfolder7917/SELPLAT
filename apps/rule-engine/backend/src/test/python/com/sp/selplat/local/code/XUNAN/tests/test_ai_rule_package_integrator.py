"""XUNAN AI 规则包智慧整合能力测试。"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 文件直接运行时必须在动态加载 XUNAN 程序前切换字节码缓存根；
# 否则 importlib 会先在生产源码旁创建 __pycache__，程序自身再设置已经来不及。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)
PROGRAM_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/abilities/ai_rule_package_integrator.py"
)
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def _load_program():
    """直接加载真实 XUNAN 智慧整合程序，不经过注册表或二次执行器。"""

    spec = importlib.util.spec_from_file_location("xunan_integrator_test", PROGRAM_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class AiRulePackageIntegratorTests(unittest.TestCase):
    """覆盖只读审查、用户覆盖识别和 OPTION 安全输出。"""

    def setUp(self) -> None:
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        self.program = _load_program()

    def test_audit_returns_registered_rule_package_facts(self) -> None:
        result = self.program.execute({"action": "audit"}, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["model"], "ai_rule_driven_execution_and_continuous_rule_package_growth")
        self.assertEqual(result["indexes"], 19)
        self.assertEqual(result["indexed_rules"], 65)
        self.assertEqual(result["xunan_indexes"], 7)
        self.assertEqual(result["xunan_user_overrides"], 4)
        self.assertEqual(result["xunan_user_rule_files"], 3)
        self.assertEqual(result["xunan_standard_asset_packages"], 1)
        self.assertEqual(result["xunan_rules_with_program_references"], 2)
        self.assertEqual(result["decision_boundary"], "facts_only_ai_must_review_before_merge_or_delete")

    def test_write_report_is_limited_to_option(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ai_rule_integrator_", dir=OPTION_TEMP_ROOT) as temp_dir:
            output_path = Path(temp_dir) / "audit.json"
            relative_output = output_path.relative_to(PROJECT_ROOT)
            result = self.program.execute(
                {"action": "write_report", "output_path": str(relative_output)},
                {},
                {},
            )

            self.assertEqual(result["status"], "completed")
            self.assertEqual(Path(result["report_path"]), output_path)
            self.assertTrue(output_path.is_file())

    def test_write_report_blocks_path_outside_option(self) -> None:
        result = self.program.execute(
            {"action": "write_report", "output_path": "outside-audit.json"},
            {},
            {},
        )

        self.assertEqual(result["status"], "blocked")
        self.assertIn("OPTION", result["message"])

    def test_xunan_rule_assignments_have_line_level_chinese_comments(self) -> None:
        user_root = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/XUNAN"
        )
        rule_paths = sorted(user_root.rglob("RUL_*.md"))
        self.assertEqual(len(rule_paths), 3)
        for rule_path in rule_paths:
            previous_nonempty = ""
            for line_number, raw_line in enumerate(
                    rule_path.read_text(encoding="utf-8").splitlines(), 1):
                line = raw_line.strip()
                if "=" in line and not line.startswith(("#", "<!--")):
                    self.assertTrue(
                        previous_nonempty.startswith("<!--") and previous_nonempty.endswith("-->"),
                        f"{rule_path}:{line_number} 的规则声明缺少上一行中文业务注释",
                    )
                    self.assertRegex(
                        previous_nonempty,
                        r"[\u4e00-\u9fff]",
                        f"{rule_path}:{line_number} 的规则注释必须包含中文业务说明",
                    )
                if line:
                    previous_nonempty = line

    def test_ai_rule_requires_memory_edit_and_lifecycle_preflight(self) -> None:
        rule_path = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/XUNAN/selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md"
        )
        text = rule_path.read_text(encoding="utf-8")
        self.assertIn(
            "rule_edit_preflight_required_rules = MEMORY_FILE_EDIT_RULES,RULE_LIFECYCLE_GOVERNANCE_RULES",
            text,
        )

    def test_explicit_delegation_rule_is_registered_for_xunan(self) -> None:
        """用户明确委托规则必须通过稳定治理逻辑 ID 覆盖，而不是绕过索引。"""

        index_path = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/RULE_INDEX.md"
        )
        text = index_path.read_text(encoding="utf-8")
        self.assertIn("USER_RULE_INDEX@XUNAN = local/XUNAN/RULE_INDEX.md", text)
        leaf_index = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/XUNAN/跨工程通用规则/RULE_INDEX.md"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES = "
            "local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md",
            leaf_index,
        )

    def test_registry_and_secondary_executor_are_removed(self) -> None:
        """单一用户程序必须直接运行，不保留无用注册表和二次执行器。"""

        self.assertFalse((
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/XUNAN/registry"
        ).exists())
        self.assertFalse((
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/XUNAN/executor.py"
        ).exists())
        self.assertTrue(callable(self.program.main))



if __name__ == "__main__":
    unittest.main()
