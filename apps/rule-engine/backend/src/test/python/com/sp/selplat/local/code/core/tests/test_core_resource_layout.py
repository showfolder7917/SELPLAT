"""local/core 精简布局回归测试。"""

from __future__ import annotations

import ast
import json
from pathlib import Path
import re
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
RESOURCE_ROOT = PROJECT_ROOT / "apps/rule-engine/backend/src/main/resources"
CORE_ROOT = RESOURCE_ROOT / "local/core"
ROOT_RULE_INDEX = RESOURCE_ROOT / "RULE_INDEX.md"
PYTHON_CORE_ROOT = (
    PROJECT_ROOT / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core"
)


class CoreResourceLayoutTests(unittest.TestCase):
    """保证 core 只保留运行基线和简单分类。"""

    def test_deprecated_core_categories_are_removed(self) -> None:
        """历史人工资料、重复文档层和二次 common 分类不得回流。"""

        self.assertFalse((CORE_ROOT / "human").exists())
        self.assertFalse((CORE_ROOT / "docs").exists())
        self.assertFalse((CORE_ROOT / "rule/common_rules").exists())
        self.assertFalse((CORE_ROOT / "rule/template").exists())

    def test_protocol_chain_uses_single_root_rule_index(self) -> None:
        """core 只保留五份协议，规则索引统一使用 resources 根入口。"""

        protocol_names = sorted(path.name for path in (CORE_ROOT / "protocol").glob("*.md"))
        self.assertEqual(
            protocol_names,
            [
                "CODE.PROTOCOL.md",
                "COMMAND.PROTOCOL.md",
                "GENERATOR_REPAIR_PROTOCOL.md",
                "STARTER_PROTOCOL.md",
                "USER.PROTOCOL.md",
            ],
        )
        command_text = (CORE_ROOT / "protocol/COMMAND.PROTOCOL.md").read_text(encoding="utf-8")
        self.assertIn("after_command_rule_index = ${RES}RULE_INDEX.md", command_text)

    def test_all_indexed_core_rule_targets_exist(self) -> None:
        """根索引中的每个 core 规则路径都必须能加载。"""

        index_text = ROOT_RULE_INDEX.read_text(encoding="utf-8")
        paths = re.findall(r"=\s*(local/core/rule/\S+\.md)\s*$", index_text, re.MULTILINE)
        self.assertGreaterEqual(len(paths), 12)
        for relative_path in paths:
            self.assertTrue((RESOURCE_ROOT / relative_path).is_file(), relative_path)

    def test_auto_upgrade_rule_is_absorbed_by_generator_repair_protocol(self) -> None:
        """自动升级约束只保留在强制启动协议，不再维护重复普通规则。"""

        index_text = ROOT_RULE_INDEX.read_text(encoding="utf-8")
        protocol_text = (
            CORE_ROOT / "protocol/GENERATOR_REPAIR_PROTOCOL.md"
        ).read_text(encoding="utf-8")
        self.assertNotIn("AUTO_UPGRADE_AND_REPAIR_RULES", index_text)
        self.assertFalse((CORE_ROOT / "rule/AUTO_UPGRADE_AND_REPAIR_RULES.md").exists())
        self.assertIn(
            "generator_repair_must_verify_compile_return_registry_and_index = true",
            protocol_text,
        )

    def test_legacy_vue_id_reuses_current_rule(self) -> None:
        """旧 Vue 逻辑 ID 只保留索引别名，不再保留兼容规则文件。"""

        index_text = ROOT_RULE_INDEX.read_text(encoding="utf-8")
        self.assertIn(
            "CODE_VUE_RULES = local/core/rule/CODE_VUE_CODING_RULES.md",
            index_text,
        )
        self.assertFalse((CORE_ROOT / "rule/CODE_VUE_RULES.md").exists())

    def test_superseded_project_execution_rule_is_removed(self) -> None:
        """项目执行旧规则不得与现行 CODE 协议和 common 线程规则重复并存。"""

        index_text = ROOT_RULE_INDEX.read_text(encoding="utf-8")
        self.assertNotIn("PROJECT_EXECUTION_RULES", index_text)
        self.assertFalse((CORE_ROOT / "rule/PROJECT_EXECUTION_RULES.md").exists())

    def test_registered_python_core_has_no_placeholder_or_orphan_entry(self) -> None:
        """core 注册能力必须可执行，注册依赖必须真实且不存在已知孤立入口。"""

        registry_root = CORE_ROOT / "registry"
        abilities = json.loads((registry_root / "abilities.json").read_text(encoding="utf-8"))
        skills = json.loads((registry_root / "skills.json").read_text(encoding="utf-8"))
        apps = json.loads((registry_root / "apps.json").read_text(encoding="utf-8"))
        referenced_skills: set[str] = set()
        referenced_apps: set[str] = set()
        registered_ability_paths: set[Path] = set()
        for ability_id, definition in abilities.items():
            ability_path = PYTHON_CORE_ROOT / definition["path"].removeprefix("./")
            self.assertTrue(ability_path.is_file(), ability_id)
            registered_ability_paths.add(ability_path.resolve())
            function_names = {
                node.name
                for node in ast.parse(ability_path.read_text(encoding="utf-8")).body
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            }
            self.assertIn("execute", function_names, ability_id)
            referenced_skills.update(definition.get("skills", []))
            referenced_apps.update(definition.get("apps", []))
        self.assertEqual(referenced_skills, set(skills))
        self.assertEqual(referenced_apps, set(apps))
        for skill_id, definition in skills.items():
            skill_path = PYTHON_CORE_ROOT / definition["path"].removeprefix("./")
            self.assertTrue(skill_path.is_file(), skill_id)
        for app_id, definition in apps.items():
            app_path = PYTHON_CORE_ROOT / definition["path"].removeprefix("./")
            self.assertTrue(app_path.is_file(), app_id)
        production_ability_paths = {
            path.resolve() for path in (PYTHON_CORE_ROOT / "abilities").glob("*.py")
        }
        self.assertEqual(production_ability_paths, registered_ability_paths)
        self.assertFalse((PYTHON_CORE_ROOT / "router.py").exists())
        self.assertFalse((PYTHON_CORE_ROOT / "tools/cleanup_lancedb_storage.py").exists())


if __name__ == "__main__":
    unittest.main()
