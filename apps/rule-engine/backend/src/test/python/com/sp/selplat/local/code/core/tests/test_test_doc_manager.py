"""测试文档维护能力测试。"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest


PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
PYTHON_SOURCE_ROOT = PROJECT_ROOT / "apps/rule-engine/backend/src/main/python"
if str(PYTHON_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_SOURCE_ROOT))
ABILITY_PATH = PYTHON_SOURCE_ROOT / "com/sp/selplat/ruleengine/abilities/测试文档管理器.py"
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("test_doc_manager_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestDocManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        self.temp_dir = tempfile.TemporaryDirectory(prefix="test_doc_", dir=OPTION_TEMP_ROOT)
        self.module.OPTION_ROOT = Path(self.temp_dir.name) / "OPTION"
        self.module.HISTORY_ROOT = self.module.OPTION_ROOT / "temp"
        self.thread_id = "test-thread"
        self.previous_thread_id = os.environ.get("CODEX_THREAD_ID")
        os.environ["CODEX_THREAD_ID"] = self.thread_id
        self.doc_path = self.module._test_doc_path(self.thread_id)

    def tearDown(self) -> None:
        if self.previous_thread_id is None:
            os.environ.pop("CODEX_THREAD_ID", None)
        else:
            os.environ["CODEX_THREAD_ID"] = self.previous_thread_id
        self.temp_dir.cleanup()

    def test_record_creates_same_thread_pending_document(self) -> None:
        result = self.module.execute({
            "action": "record",
            "title": "规则引擎 Python 回归",
            "change": "新增测试文档能力",
            "command": "python3 run_tests.py core",
            "expected": "全部用例通过",
        }, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["pending_items"], [1])
        self.assertEqual(self.doc_path.name, "测试文档.test-thread.md")
        text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("1. **待测试**：规则引擎 Python 回归", text)
        self.assertIn("测试命令：python3 run_tests.py core", text)

    def test_record_requires_complete_test_contract(self) -> None:
        result = self.module.execute({"action": "record", "title": "缺少命令"}, {}, {})

        self.assertEqual(result["status"], "blocked_invalid_test_items")
        self.assertEqual(result["exit_code"], 1)
        self.assertFalse(self.doc_path.exists())

    def test_record_deduplicates_same_pending_title_and_command(self) -> None:
        item = {
            "action": "record",
            "title": "核心回归",
            "change": "修改能力",
            "command": "python3 run_tests.py core",
            "expected": "通过",
        }
        first = self.module.execute(item, {}, {})
        second = self.module.execute(item, {}, {})

        self.assertEqual(first["added_items"], [1])
        self.assertEqual(second["added_items"], [])
        self.assertEqual(second["item_count"], 1)

    def test_result_tracks_pass_and_failure_until_all_pass(self) -> None:
        self.module.execute({
            "action": "record",
            "items": [
                {"title": "单测", "change": "能力", "command": "test core", "expected": "通过"},
                {"title": "门禁", "change": "Gradle", "command": "gradle gate", "expected": "零违规"},
            ],
        }, {}, {})

        passed = self.module.execute({
            "action": "result", "item_number": 1, "status": "passed", "actual_result": "20 tests passed"
        }, {}, {})
        failed = self.module.execute({
            "action": "result", "item_number": 2, "status": "失败", "actual_result": "发现 1 项违规"
        }, {}, {})

        self.assertEqual(passed["pending_items"], [2])
        self.assertEqual(failed["failed_items"], [2])
        self.assertFalse(failed["all_completed"])
        self.assertEqual(
            self.module.execute({"action": "ready"}, {}, {})["status"],
            "blocked_test_document_not_ready",
        )

        repaired = self.module.execute({
            "action": "result", "item_number": 2, "status": "通过", "actual_result": "零违规"
        }, {}, {})
        self.assertTrue(repaired["all_completed"])

    def test_complete_tests_writes_multiple_results_once(self) -> None:
        """complete_tests 应一次回写多个测试结果。"""

        self.module.execute({
            "action": "record",
            "items": [
                {"title": "单测", "change": "能力", "command": "test core", "expected": "通过"},
                {"title": "门禁", "change": "结构", "command": "test gate", "expected": "零违规"},
            ],
        }, {}, {})

        result = self.module.execute({
            "action": "complete_tests",
            "results": {
                "1": {"status": "passed", "result": "单测通过"},
                "2": {"status": "通过", "result": "零违规"},
            },
        }, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["completed_items"], [1, 2])
        self.assertTrue(result["all_completed"])

    def test_pending_gate_requires_recorded_work(self) -> None:
        empty = self.module.execute({"action": "pending"}, {}, {})
        self.assertEqual(empty["status"], "blocked_test_document_has_no_pending_items")

        self.module.execute({
            "action": "record",
            "title": "专项回归",
            "change": "修改测试流程",
            "command": "gradlew selplatSpecialGate",
            "expected": "BUILD SUCCESSFUL",
        }, {}, {})
        pending = self.module.execute({"action": "pending"}, {}, {})
        self.assertEqual(pending["status"], "completed")

    def test_finish_archives_only_after_every_item_passes(self) -> None:
        self.module.execute({
            "action": "record",
            "title": "统一回归",
            "change": "测试文档能力",
            "command": "gradlew check",
            "expected": "BUILD SUCCESSFUL",
        }, {}, {})
        blocked = self.module.execute({"action": "finish"}, {}, {})
        self.assertEqual(blocked["status"], "blocked_test_document_not_ready")

        self.module.execute({
            "action": "result", "item_number": 1, "status": "通过", "actual_result": "BUILD SUCCESSFUL"
        }, {}, {})
        finished = self.module.execute({"action": "finish"}, {}, {})

        self.assertEqual(finished["status"], "completed")
        self.assertTrue(Path(finished["history_path"]).exists())
        self.assertEqual(self.module._item_numbers(self.doc_path.read_text(encoding="utf-8")), [])

    def test_different_threads_keep_independent_test_documents(self) -> None:
        base_item = {
            "action": "record",
            "change": "线程隔离",
            "command": "test",
            "expected": "通过",
        }
        first = self.module.execute({**base_item, "thread_id": "page-one", "title": "页面一"}, {}, {})
        second = self.module.execute({**base_item, "thread_id": "page-two", "title": "页面二"}, {}, {})

        self.assertNotEqual(first["doc_path"], second["doc_path"])
        self.assertIn("页面一", Path(first["doc_path"]).read_text(encoding="utf-8"))
        self.assertNotIn("页面二", Path(first["doc_path"]).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
