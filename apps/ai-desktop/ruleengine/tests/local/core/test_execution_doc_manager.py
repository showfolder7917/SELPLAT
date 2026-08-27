"""执行文档维护能力测试。"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import importlib.util
import os
from pathlib import Path
import sys
# 从迁移后的测试包向上识别工程根，测试数据和输出必须继续归属当前工程。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 生产 Python core 的唯一位置与测试 source set 分离，测试统一通过该路径加载真实能力。
PYTHON_SOURCE_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/python"
if str(PYTHON_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_SOURCE_ROOT))
MAIN_CODE_ROOT = PYTHON_SOURCE_ROOT / "ruleengine"
import tempfile
import unittest


ABILITY_PATH = MAIN_CODE_ROOT / "abilities" / "执行文档管理器.py"
# 执行文档测试的模拟工程统一位于当前工程 OPTION/temp。
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("execution_doc_manager_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExecutionDocManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()
        # 确保统一测试运行目录存在。
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # 模拟工程和执行文档在自动清理目录中隔离。
        self.temp_dir = tempfile.TemporaryDirectory(prefix="execution_doc_", dir=OPTION_TEMP_ROOT)
        option_root = Path(self.temp_dir.name) / "OPTION"
        # 每个测试固定使用专属线程，验证能力不会回退到共享无线程执行文档。
        self.thread_id = "test-thread"
        self.previous_thread_id = os.environ.get("CODEX_THREAD_ID")
        os.environ["CODEX_THREAD_ID"] = self.thread_id
        self.module.OPTION_ROOT = option_root
        self.module.LEGACY_EXECUTION_DOC_PATH = option_root / "执行文档.md"
        self.doc_path = self.module._execution_doc_path(self.thread_id)
        # 为每个隔离测试指定历史归档目录，验证生产能力不会再把历史混入 OPTION 根目录。
        self.module.HISTORY_ROOT = option_root / "temp"

    def tearDown(self) -> None:
        # 还原测试前的页面线程环境，避免影响同一进程中的其他能力测试。
        if self.previous_thread_id is None:
            os.environ.pop("CODEX_THREAD_ID", None)
        else:
            os.environ["CODEX_THREAD_ID"] = self.previous_thread_id
        self.temp_dir.cleanup()

    def test_start_task_writes_formatted_pending_steps(self) -> None:
        result = self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "整理测试流程",
                "steps": ["检查旧文档", "生成新步骤"],
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "completed")
        text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("# 本次执行文档", text)
        self.assertIn("## 执行授权", text)
        self.assertIn("独立确认：1", text)
        self.assertIn("任务线程：test-thread", text)
        self.assertIn("## 总体任务目标", text)
        self.assertIn("整理测试流程", text)
        self.assertIn("1. **未完成**：检查旧文档", text)
        self.assertIn("2. **未完成**：生成新步骤", text)

    def test_begin_blocks_without_standalone_confirmation(self) -> None:
        result = self.module.execute(
            {"action": "begin", "goal": "未授权任务", "steps": ["不得执行"]},
            {},
            {},
        )

        self.assertEqual(result["status"], "blocked_missing_confirmation")
        self.assertEqual(result["exit_code"], 1)
        self.assertFalse(self.doc_path.exists())

    def test_begin_with_three_requires_valid_latest_turn_receipt(self) -> None:
        missing = self.module.execute(
            {"action": "begin", "confirmation": "3", "goal": "执行记录问答", "steps": ["执行"]},
            {},
            {},
        )
        self.module.验证记录回执 = lambda thread, receipt: (
            thread == self.thread_id and receipt == "valid-receipt"
        )
        valid = self.module.execute(
            {
                "action": "begin",
                "confirmation": "3",
                "session_record_receipt": "valid-receipt",
                "goal": "执行记录问答",
                "steps": ["执行"],
            },
            {},
            {},
        )

        self.assertEqual(missing["status"], "blocked_invalid_session_record_receipt")
        self.assertEqual(valid["status"], "completed")
        self.assertTrue(valid["authorized"])
        text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("独立确认：3", text)
        self.assertIn("会话记录回执：valid-receipt", text)

    def test_begin_with_three_blocks_reused_receipt(self) -> None:
        self.module.验证记录回执 = lambda thread, receipt: True
        context = {
            "action": "begin",
            "confirmation": "3",
            "session_record_receipt": "same-receipt",
            "goal": "执行记录问答",
            "steps": ["执行"],
        }
        first = self.module.execute(context, {}, {})
        self.module.execute({"action": "step", "step": 1, "result": "完成。"}, {}, {})
        self.module.execute({"action": "finish"}, {}, {})
        second = self.module.execute(context, {}, {})

        self.assertEqual(first["status"], "completed")
        self.assertEqual(second["status"], "blocked_reused_session_record_receipt")

    def test_active_and_ready_gates_follow_document_lifecycle(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "验证统一任务门禁",
                "steps": ["完成唯一步骤"],
            },
            {},
            {},
        )

        active = self.module.execute({"action": "active"}, {}, {})
        not_ready = self.module.execute({"action": "ready"}, {}, {})

        self.assertEqual(active["status"], "completed")
        self.assertTrue(active["authorized"])
        self.assertEqual(active["goal"], "验证统一任务门禁")
        self.assertEqual(not_ready["status"], "blocked_task_document_not_ready")
        self.assertEqual(not_ready["exit_code"], 1)

    def test_start_task_blocks_when_existing_steps_are_unfinished(self) -> None:
        self.doc_path.parent.mkdir(parents=True, exist_ok=True)
        self.doc_path.write_text(
            "# 本次执行文档\n\n## 执行步骤\n\n1. **未完成**：旧任务\n",
            encoding="utf-8",
        )

        result = self.module.execute(
            {"action": "begin", "confirmation": "1", "goal": "新任务", "steps": ["新步骤"]},
            {},
            {},
        )

        self.assertEqual(result["status"], "blocked_unfinished_steps")
        self.assertEqual(result["pending_steps"], [1])

    def test_finish_archives_only_fully_completed_authorized_task(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "完成并归档",
                "steps": ["完成唯一步骤"],
            },
            {},
            {},
        )
        self.module.execute(
            {"action": "step", "step_number": 1, "result": "步骤已经验证。"},
            {},
            {},
        )

        result = self.module.execute({"action": "finish"}, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["action"], "finish")
        self.assertTrue(Path(result["history_path"]).exists())
        self.assertNotIn("完成并归档", self.doc_path.read_text(encoding="utf-8"))

    def test_result_text_containing_pending_word_does_not_break_completion_state(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "验证状态行解析",
                "steps": ["验证门禁结果"],
            },
            {},
            {},
        )

        result = self.module.execute(
            {
                "action": "step",
                "step_number": 1,
                "result": "ready 已正确阻断未完成步骤。",
            },
            {},
            {},
        )

        self.assertEqual(result["pending_steps"], [])
        self.assertTrue(result["all_completed"])

    def test_complete_step_replaces_status_and_writes_result(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "整理测试流程",
                "steps": ["检查旧文档", "生成新步骤"],
            },
            {},
            {},
        )

        result = self.module.execute(
            {
                "action": "step",
                "step_number": 1,
                "result": "已确认旧文档存在。",
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["pending_steps"], [2])
        text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("1. **完成**：检查旧文档", text)
        self.assertIn("   - 实际结果：已确认旧文档存在。", text)

    def test_complete_steps_writes_multiple_results_once(self) -> None:
        """complete_steps 应一次完成多个步骤并返回统一最终状态。"""

        self.module.execute({
            "action": "begin",
            "confirmation": "1",
            "goal": "批量回写",
            "steps": ["第一步", "第二步", "第三步"],
        }, {}, {})

        result = self.module.execute({
            "action": "complete_steps",
            "results": {"1": "第一步完成。", "2": "第二步完成。"},
        }, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["completed_steps"], [1, 2])
        self.assertEqual(result["pending_steps"], [3])
        text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("第一步完成。", text)
        self.assertIn("第二步完成。", text)

    def test_complete_step_keeps_document_consistent_under_parallel_updates(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "整理测试流程",
                "steps": ["检查旧文档", "生成新步骤", "收口"],
            },
            {},
            {},
        )

        def complete(step_number: int, result: str) -> dict:
            return self.module.execute(
                {
                    "action": "step",
                    "step_number": step_number,
                    "result": result,
                },
                {},
                {},
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_one = executor.submit(complete, 1, "第一步完成。")
            future_two = executor.submit(complete, 2, "第二步完成。")
            result_one = future_one.result()
            result_two = future_two.result()

        self.assertEqual(result_one["status"], "completed")
        self.assertEqual(result_two["status"], "completed")
        # 两个并发更新都应该回看到同一份稳定快照，而不是各自返回中间态 pending_steps。
        self.assertEqual(result_one["pending_steps"], [3])
        self.assertEqual(result_two["pending_steps"], [3])
        self.assertFalse(result_one["all_completed"])
        self.assertFalse(result_two["all_completed"])
        text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("1. **完成**：检查旧文档", text)
        self.assertIn("   - 实际结果：第一步完成。", text)
        self.assertIn("2. **完成**：生成新步骤", text)
        self.assertIn("   - 实际结果：第二步完成。", text)
        self.assertIn("3. **未完成**：收口", text)
        self.assertEqual(self.module._pending_steps(text), [3])

    def test_complete_step_parallel_returns_latest_snapshot_after_all_steps_finish(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "整理测试流程",
                "steps": ["检查旧文档", "生成新步骤", "收口"],
            },
            {},
            {},
        )

        def complete(step_number: int, result: str) -> dict:
            return self.module.execute(
                {
                    "action": "step",
                    "step_number": step_number,
                    "result": result,
                },
                {},
                {},
            )

        with ThreadPoolExecutor(max_workers=3) as executor:
            # 三个步骤并发完成时，所有返回值都应收敛到“整份文档已完成”的最终快照。
            futures = [
                executor.submit(complete, 1, "第一步完成。"),
                executor.submit(complete, 2, "第二步完成。"),
                executor.submit(complete, 3, "第三步完成。"),
            ]
            results = [future.result() for future in futures]

        for result in results:
            self.assertEqual(result["status"], "completed")
            self.assertEqual(result["pending_steps"], [])
            self.assertTrue(result["all_completed"])
            self.assertTrue(result["doc_revision"])

    def test_start_task_archives_completed_previous_doc(self) -> None:
        self.doc_path.parent.mkdir(parents=True, exist_ok=True)
        self.doc_path.write_text(
            "# 本次执行文档\n\n## 总体任务目标\n\n旧任务\n\n## 执行步骤\n\n1. **完成**：旧步骤\n   - 实际结果：完成。\n",
            encoding="utf-8",
        )

        result = self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "新任务",
                "steps": ["新步骤"],
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "completed")
        history_path = Path(result["archived_path"])
        self.assertTrue(history_path.exists())
        # 历史文件必须由能力写入统一临时目录，避免仅验证“文件存在”而漏掉路径回归。
        self.assertEqual(history_path.parent, self.module.HISTORY_ROOT)
        history_text = history_path.read_text(encoding="utf-8")
        self.assertIn("**执行时间：", history_text)
        self.assertIn("旧任务", history_text)
        current_text = self.doc_path.read_text(encoding="utf-8")
        self.assertIn("新任务", current_text)

    def test_archive_completed_blocks_unfinished_without_force(self) -> None:
        self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "goal": "整理测试流程",
                "steps": ["检查旧文档"],
            },
            {},
            {},
        )

        result = self.module.execute({"action": "finish"}, {}, {})

        self.assertEqual(result["status"], "blocked_task_document_not_ready")
        self.assertEqual(result["pending_steps"], [1])

    def test_different_threads_use_independent_execution_documents(self) -> None:
        # 先为第一个任务页面创建未完成步骤，模拟用户打开的第一个 Codex 页面。
        first_result = self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "thread_id": "page-one",
                "goal": "第一个页面任务",
                "steps": ["页面一的步骤"],
            },
            {},
            {},
        )
        # 再为第二个页面创建任务；它不得被第一个页面的未完成步骤阻塞。
        second_result = self.module.execute(
            {
                "action": "begin",
                "confirmation": "1",
                "thread_id": "page-two",
                "goal": "第二个页面任务",
                "steps": ["页面二的步骤"],
            },
            {},
            {},
        )

        first_path = self.module._execution_doc_path("page-one")
        second_path = self.module._execution_doc_path("page-two")
        self.assertEqual(first_result["status"], "completed")
        self.assertEqual(second_result["status"], "completed")
        self.assertNotEqual(first_path, second_path)
        self.assertIn("第一个页面任务", first_path.read_text(encoding="utf-8"))
        self.assertIn("第二个页面任务", second_path.read_text(encoding="utf-8"))
        self.assertNotIn("第二个页面任务", first_path.read_text(encoding="utf-8"))

    def test_first_thread_migrates_legacy_document_once(self) -> None:
        # 模拟升级前留下的旧共享执行文档，其中包含尚未完成的真实任务。
        self.module.LEGACY_EXECUTION_DOC_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.module.LEGACY_EXECUTION_DOC_PATH.write_text(
            "# 本次执行文档\n\n## 执行步骤\n\n1. **未完成**：旧任务\n",
            encoding="utf-8",
        )

        result = self.module.execute(
            {"action": "check", "thread_id": "migrated-page"},
            {},
            {},
        )

        migrated_path = self.module._execution_doc_path("migrated-page")
        self.assertTrue(result["exists"])
        self.assertTrue(migrated_path.exists())
        self.assertFalse(self.module.LEGACY_EXECUTION_DOC_PATH.exists())
        self.assertIn("旧任务", migrated_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
