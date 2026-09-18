"""验证 schema 2 与首批 Java、脚手架合规门禁。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest


PROJECT_ROOT = next(
    path for path in Path(__file__).resolve().parents if (path / "settings.gradle").is_file()
)
PROGRAM_PATH = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/artifact_compliance_guard.py"
)
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def _load_program():
    name = "artifact_compliance_guard_test"
    spec = importlib.util.spec_from_file_location(name, PROGRAM_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class ArtifactComplianceGuardTests(unittest.TestCase):
    """覆盖机器规则字段、Java 正反例和脚手架合同。"""

    @classmethod
    def setUpClass(cls) -> None:
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        cls.program = _load_program()

    def test_first_schema_2_batch_is_valid(self) -> None:
        result = self.program.execute({
            "action": "rule_schema",
            "logical_ids": [
                "CODE_JAVA_CODING_RULES",
                "MEMORY_FILE_EDIT_RULES",
                "ACTIVE_USER_RULE_AND_CODE_OWNERSHIP_RULES",
                "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES",
                "RULE_LIFECYCLE_GOVERNANCE_RULES",
                "AI_RULE_PACKAGE_INTELLIGENCE_RULES",
                "SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES",
                "SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES",
                "CHINESE_PINYIN_CORRECTION_RULES",
                "ANCIENT_POEM_BACKGROUND_RULES",
            ],
        }, {}, {})
        self.assertEqual([], result["violations"])
        self.assertEqual("completed", result["status"])

    def test_java_business_contract_accepts_real_example_and_rejects_missing_contract(self) -> None:
        with tempfile.TemporaryDirectory(prefix="java_contract_", dir=OPTION_TEMP_ROOT) as root:
            root_path = Path(root)
            valid = root_path / "ValidService.java"
            valid.write_text(
                """/** 用户查询服务，负责返回真实用户名。 */
public class ValidService {
    /** 查询用户。参数示例：id=1；返回示例：admin。
     * @param id 用户编号，示例 1
     * @return 用户名，示例 admin
     */
    public String find(String id) { return \"admin\"; }
}
""",
                encoding="utf-8",
            )
            invalid = root_path / "InvalidService.java"
            invalid.write_text(
                """public class InvalidService {
    public String find(String id) { System.out.println(id); return id; }
}
""",
                encoding="utf-8",
            )
            valid_relative = valid.relative_to(PROJECT_ROOT).as_posix()
            invalid_relative = invalid.relative_to(PROJECT_ROOT).as_posix()
            accepted = self.program.execute({
                "action": "java_business_contract", "file_paths": [valid_relative],
            }, {}, {})
            rejected = self.program.execute({
                "action": "java_business_contract", "file_paths": [invalid_relative],
            }, {}, {})
            self.assertEqual("completed", accepted["status"])
            self.assertEqual("blocked", rejected["status"])
            self.assertGreaterEqual(rejected["violation_count"], 3)

    def test_scaffold_contract_has_real_program_and_delivery_gate(self) -> None:
        result = self.program.execute({"action": "selplat_scaffold_contract"}, {}, {})
        self.assertEqual([], result["violations"])
        self.assertEqual("completed", result["status"])

    def test_python_source_policy_rejects_bare_swallowed_exception(self) -> None:
        with tempfile.TemporaryDirectory(prefix="python_policy_", dir=OPTION_TEMP_ROOT) as root:
            invalid = Path(root) / "invalid.py"
            invalid.write_text("try:\n    run()\nexcept:\n    pass\n", encoding="utf-8")
            result = self.program.execute({
                "action": "python_source_policy",
                "file_paths": [invalid.relative_to(PROJECT_ROOT).as_posix()],
            }, {}, {})
            codes = {item["code"] for item in result["violations"]}
            self.assertIn("PYTHON_BARE_EXCEPT_FORBIDDEN", codes)
            self.assertIn("PYTHON_SWALLOWED_EXCEPTION_FORBIDDEN", codes)

    def test_vue_source_policy_rejects_ambiguous_directives_and_native_title(self) -> None:
        with tempfile.TemporaryDirectory(prefix="vue_policy_", dir=OPTION_TEMP_ROOT) as root:
            invalid = Path(root) / "InvalidView.vue"
            invalid.write_text(
                '<template><button v-if="ok" v-for="item in items" title="x">{{ item }}</button></template>\n'
                '<script setup>const ok = true; const items = []</script>\n',
                encoding="utf-8",
            )
            result = self.program.execute({
                "action": "vue_source_policy",
                "file_paths": [invalid.relative_to(PROJECT_ROOT).as_posix()],
            }, {}, {})
            codes = {item["code"] for item in result["violations"]}
            self.assertIn("VUE_V_IF_WITH_V_FOR_FORBIDDEN", codes)
            self.assertIn("VUE_NATIVE_TITLE_FORBIDDEN", codes)

    def test_rule_evidence_dispatches_every_loaded_gate(self) -> None:
        with tempfile.TemporaryDirectory(prefix="rule_evidence_", dir=OPTION_TEMP_ROOT) as root:
            valid = Path(root) / "ValidService.java"
            valid.write_text(
                "/** 用户服务，负责读取用户。 */\n"
                "public class ValidService {\n"
                "    /** 查询用户。参数示例：id=1；返回示例：admin。\n"
                "     * @param id 用户编号，示例 1\n"
                "     * @return 用户名，示例 admin\n"
                "     */\n"
                "    public String find(String id) { return \"admin\"; }\n"
                "}\n",
                encoding="utf-8",
            )
            result = self.program.execute({
                "action": "rule_evidence",
                "logical_ids": [
                    "CODE_JAVA_CODING_RULES",
                    "SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES",
                ],
                "file_paths": [valid.relative_to(PROJECT_ROOT).as_posix()],
            }, {}, {})
            self.assertEqual("completed", result["status"])
            self.assertEqual(2, len(result["checks"]))
            self.assertTrue(all(item["result"] == "passed" for item in result["checks"]))


if __name__ == "__main__":
    unittest.main()
