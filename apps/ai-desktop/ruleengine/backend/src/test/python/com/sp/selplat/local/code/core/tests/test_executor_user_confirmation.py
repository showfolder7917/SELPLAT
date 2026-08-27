"""执行器基础执行链测试。

功能：
验证 executor 会在不经过确认门的前提下直接加载 ability。

作用：
保证执行器只承担依赖解析与执行调度职责，不再内置额外限制逻辑。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
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
from unittest.mock import patch


EXECUTOR_PATH = MAIN_CODE_ROOT / "执行器.py"


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
            }

        def fake_load(module_path: Path, module_name: str):
            _ = module_name
            if module_path == Path("/tmp/demo_ability.py"):
                return ability_module
            raise AssertionError(module_path)

        self.module._解析能力 = fake_resolve
        self.module._加载模块 = fake_load

        result = self.module.execute(
            "demo_ability",
            {"task_text": "直接执行，不再经过确认门"},
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["task_text"], "直接执行，不再经过确认门")
        self.assertEqual(result["skills_loaded"], [])
        self.assertEqual(result["apps_loaded"], [])

    def test_execute_ability_returns_missing_ability_without_running_module(self) -> None:
        self.module._解析能力 = lambda name: {
            "status": "missing_ability",
            "ability": name,
            "message": "未找到对应 ability。",
        }

        result = self.module.execute("demo_ability", {"task_text": "检查缺失能力"})

        self.assertEqual(result["status"], "missing_ability")

    def test_main_returns_ability_declared_blocking_exit_code(self) -> None:
        self.module.execute = lambda ability_name, context=None: {
            "status": "blocked_task_document_not_active",
            "exit_code": 1,
            "ability": ability_name,
        }

        with patch.object(sys, "argv", ["executor.py", "execution_doc_manager", "{}"]):
            exit_code = self.module.main()

        self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
