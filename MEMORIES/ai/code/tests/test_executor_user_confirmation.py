"""执行器基础执行链测试。

功能：
验证 executor 会在不经过确认门的前提下直接加载 ability 和 skill。

作用：
保证执行器只承担依赖解析与执行调度职责，不再内置额外限制逻辑。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest


EXECUTOR_PATH = Path(__file__).resolve().parents[1] / "executor.py"


def load_executor_module():
    spec = importlib.util.spec_from_file_location("executor_basic_execution_test_module", EXECUTOR_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExecutorBasicExecutionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_executor_module()

    def test_execute_ability_directly_runs_execute_without_confirmation_gate(self) -> None:
        skill_module = SimpleNamespace(name="helper_skill")
        ability_module = SimpleNamespace(
            execute=lambda context, skills, apps: {
                "status": "completed",
                "ability": "demo_ability",
                "task_text": context["task_text"],
                "skills_loaded": sorted(skills.keys()),
                "apps_loaded": sorted(apps.keys()),
            }
        )

        def fake_resolve(name: str) -> dict:
            if name != "demo_ability":
                raise AssertionError(name)
            return {
                "status": "ready_ability",
                "ability": "demo_ability",
                "ability_path": "/tmp/demo_ability.py",
                "required_skills": ["helper_skill"],
                "required_apps": [],
                "skill_paths": {"helper_skill": "/tmp/helper_skill.py"},
                "app_paths": {},
            }

        def fake_load(module_path: str, module_name: str):
            _ = module_name
            if module_path == "/tmp/demo_ability.py":
                return ability_module
            if module_path == "/tmp/helper_skill.py":
                return skill_module
            raise AssertionError(module_path)

        self.module.resolve_ability_dependencies = fake_resolve
        self.module.load_python_module = fake_load
        self.module.build_app_configs = lambda required_apps, app_paths: {}

        result = self.module.execute_ability(
            "demo_ability",
            {"task_text": "直接执行，不再经过确认门"},
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["task_text"], "直接执行，不再经过确认门")
        self.assertEqual(result["skills_loaded"], ["helper_skill"])
        self.assertEqual(result["apps_loaded"], [])

    def test_execute_ability_returns_missing_dependency_without_running_ability(self) -> None:
        self.module.resolve_ability_dependencies = lambda name: {
            "status": "missing_dependency",
            "ability": name,
            "missing_skills": ["helper_skill"],
            "missing_apps": [],
        }

        result = self.module.execute_ability("demo_ability", {"task_text": "检查缺失依赖"})

        self.assertEqual(result["status"], "missing_dependency")
        self.assertEqual(result["missing_skills"], ["helper_skill"])


if __name__ == "__main__":
    unittest.main()
