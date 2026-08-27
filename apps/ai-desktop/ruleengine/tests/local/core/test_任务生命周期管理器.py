"""批量文档动作和统一归档能力测试。"""

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
PYTHON_SOURCE_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/python"
if str(PYTHON_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_SOURCE_ROOT))
RULEENGINE_ROOT = PYTHON_SOURCE_ROOT / "ruleengine"
ABILITY_PATH = RULEENGINE_ROOT / "abilities/任务生命周期管理器.py"
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def load_ability_module():
    """从中文正式路径加载统一生命周期能力。"""

    spec = importlib.util.spec_from_file_location("task_lifecycle_manager_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TaskLifecycleManagerTests(unittest.TestCase):
    """验证公共路径配置、批量动作和一次统一归档。"""

    def setUp(self) -> None:
        """为每个测试建立独立 OPTION 和线程状态。"""

        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        self.temp_dir = tempfile.TemporaryDirectory(prefix="task_lifecycle_", dir=OPTION_TEMP_ROOT)
        self.option_root = Path(self.temp_dir.name) / "OPTION"
        self.history_root = self.option_root / "temp"
        self.module = load_ability_module()
        self.execution = self.module.执行文档管理器
        self.tests = self.module.测试文档管理器
        self.execution.OPTION_ROOT = self.option_root
        self.execution.HISTORY_ROOT = self.history_root
        self.execution.LEGACY_EXECUTION_DOC_PATH = self.option_root / "执行文档.md"
        self.tests.OPTION_ROOT = self.option_root
        self.tests.HISTORY_ROOT = self.history_root
        self.module.OPTION_ROOT = self.option_root
        self.previous_thread = os.environ.get("CODEX_THREAD_ID")
        os.environ["CODEX_THREAD_ID"] = "batch-thread"

    def tearDown(self) -> None:
        """恢复线程环境并清理隔离目录。"""

        if self.previous_thread is None:
            os.environ.pop("CODEX_THREAD_ID", None)
        else:
            os.environ["CODEX_THREAD_ID"] = self.previous_thread
        self.temp_dir.cleanup()

    def test_finish_all_archives_both_ready_documents(self) -> None:
        """finish_all 应一次调用归档已完成的执行和测试文档。"""

        self.execution.execute({
            "action": "begin",
            "confirmation": "1",
            "goal": "批量完成",
            "steps": ["修改", "验证"],
        }, {}, {})
        self.execution.execute({
            "action": "complete_steps",
            "results": {"1": "修改完成", "2": "验证完成"},
        }, {}, {})
        self.tests.execute({
            "action": "record",
            "title": "核心测试",
            "change": "批量能力",
            "command": "test core",
            "expected": "通过",
        }, {}, {})
        self.tests.execute({
            "action": "complete_tests",
            "results": {"1": {"status": "passed", "result": "全部通过"}},
        }, {}, {})

        result = self.module.execute({"action": "finish_all"}, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertTrue(Path(result["execution_history_path"]).exists())
        self.assertTrue(Path(result["test_history_path"]).exists())

    def test_path_config_contains_only_project_relative_values(self) -> None:
        """公共路径配置不得保存机器绝对路径。"""

        config_path = PROJECT_ROOT / "apps/ai-desktop/ruleengine/rules/config/路径配置.toml"
        text = config_path.read_text(encoding="utf-8")
        self.assertNotIn("/Users/", text)
        self.assertNotRegex(text, r"(?m)^\w+\s*=\s*\"[A-Za-z]:[/\\]")


if __name__ == "__main__":
    unittest.main()
