"""执行器统一 execute 返回结构测试。

功能：
验证执行器对 execute() 和缺少统一入口 ability 的返回行为。

作用：
保证执行器在移除自动记账后，仍然能稳定返回最小可用执行结果。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
# 从迁移后的测试包向上识别工程根，测试数据和输出必须继续归属当前工程。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 生产 Python core 的唯一位置与测试 source set 分离，测试统一通过该路径加载真实能力。
MAIN_CODE_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/backend/src/main/python/com/sp/selplat/ruleengine"
from types import SimpleNamespace
import unittest


EXECUTOR_PATH = MAIN_CODE_ROOT / "执行器.py"


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

        self.module._解析能力 = lambda name: {
            "status": "ready_ability",
            "ability": name,
            "ability_path": "/tmp/demo_ability.py",
            "required_skills": [],
            "required_apps": [],
            "skill_paths": {},
            "app_paths": {},
        }
        self.module._加载模块 = lambda module_path, module_name: ability_module

        result = self.module.execute("demo_ability", {})

        self.assertEqual(result["result"], "能力执行完成")

    def test_execute_ability_rejects_legacy_run_only_module(self) -> None:
        """只提供 run 的旧模块不得绕过统一 execute 契约。"""

        ability_module = SimpleNamespace(run=lambda context: {"summary": "仅提供 run 入口"})

        self.module._解析能力 = lambda name: {
            "status": "ready_ability",
            "ability": name,
            "ability_path": "/tmp/demo_ability.py",
            "required_skills": [],
            "required_apps": [],
            "skill_paths": {},
            "app_paths": {},
        }
        self.module._加载模块 = lambda module_path, module_name: ability_module

        result = self.module.execute("demo_ability", {})

        self.assertEqual(result["status"], "invalid_ability")
        self.assertEqual(result["ability"], "demo_ability")
        self.assertEqual(result["exit_code"], 1)

    def test_execute_ability_returns_invalid_ability_when_no_execute_or_run_exists(self) -> None:
        ability_module = SimpleNamespace()

        self.module._解析能力 = lambda name: {
            "status": "ready_ability",
            "ability": name,
            "ability_path": "/tmp/demo_ability.py",
            "required_skills": [],
            "required_apps": [],
            "skill_paths": {},
            "app_paths": {},
        }
        self.module._加载模块 = lambda module_path, module_name: ability_module

        result = self.module.execute("demo_ability", {})

        self.assertEqual(result["status"], "invalid_ability")
        self.assertEqual(result["ability"], "demo_ability")


if __name__ == "__main__":
    unittest.main()
