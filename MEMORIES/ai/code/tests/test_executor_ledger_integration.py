"""执行器返回结构测试。

功能：
验证 executor 对 execute()、run() 和无入口 ability 的返回行为。

作用：
保证执行器在移除自动记账后，仍然能稳定返回最小可用执行结果。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest


EXECUTOR_PATH = Path(__file__).resolve().parents[1] / "executor.py"


def load_executor_module():
    spec = importlib.util.spec_from_file_location("executor_result_shape_test_module", EXECUTOR_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExecutorResultShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_executor_module()

    def test_execute_ability_normalizes_non_dict_execute_result(self) -> None:
        ability_module = SimpleNamespace(execute=lambda context, skills, apps: "能力执行完成")

        self.module.resolve_ability_dependencies = lambda name: {
            "status": "ready_ability",
            "ability": name,
            "ability_path": "/tmp/demo_ability.py",
            "required_skills": [],
            "required_apps": [],
            "skill_paths": {},
            "app_paths": {},
        }
        self.module.load_python_module = lambda module_path, module_name: ability_module
        self.module.build_app_configs = lambda required_apps, app_paths: {}

        result = self.module.execute_ability("demo_ability", {})

        self.assertEqual(result["result"], "能力执行完成")

    def test_execute_ability_returns_planned_ability_when_only_run_exists(self) -> None:
        ability_module = SimpleNamespace(run=lambda context: {"summary": "仅提供 run 入口"})

        self.module.resolve_ability_dependencies = lambda name: {
            "status": "ready_ability",
            "ability": name,
            "ability_path": "/tmp/demo_ability.py",
            "required_skills": [],
            "required_apps": [],
            "skill_paths": {},
            "app_paths": {},
        }
        self.module.load_python_module = lambda module_path, module_name: ability_module
        self.module.build_app_configs = lambda required_apps, app_paths: {}

        result = self.module.execute_ability("demo_ability", {})

        self.assertEqual(result["status"], "planned_ability")
        self.assertEqual(result["ability"], "demo_ability")
        self.assertEqual(result["result"]["summary"], "仅提供 run 入口")

    def test_execute_ability_returns_invalid_ability_when_no_execute_or_run_exists(self) -> None:
        ability_module = SimpleNamespace()

        self.module.resolve_ability_dependencies = lambda name: {
            "status": "ready_ability",
            "ability": name,
            "ability_path": "/tmp/demo_ability.py",
            "required_skills": [],
            "required_apps": [],
            "skill_paths": {},
            "app_paths": {},
        }
        self.module.load_python_module = lambda module_path, module_name: ability_module
        self.module.build_app_configs = lambda required_apps, app_paths: {}

        result = self.module.execute_ability("demo_ability", {})

        self.assertEqual(result["status"], "invalid_ability")
        self.assertEqual(result["ability"], "demo_ability")


if __name__ == "__main__":
    unittest.main()
