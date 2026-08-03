"""UTF-8 记账能力测试。"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
# 从迁移后的测试包向上识别工程根，测试数据和输出必须继续归属当前工程。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 生产 Python core 的唯一位置与测试 source set 分离，测试统一通过该路径加载真实能力。
MAIN_CODE_ROOT = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core"
)
import tempfile
import unittest


ABILITY_PATH = MAIN_CODE_ROOT / "abilities" / "ledger_utf8_submitter.py"
# 所有记账测试文件统一归入当前工程 OPTION/temp。
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("ledger_utf8_submitter_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LedgerUtf8SubmitterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()
        # 确保统一测试运行目录存在。
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # UTF-8 payload 和失败队列只在自动清理目录内生成。
        self.temp_dir = tempfile.TemporaryDirectory(prefix="ledger_utf8_", dir=OPTION_TEMP_ROOT)
        self.module.LEDGER_PAYLOAD_ROOT = Path(self.temp_dir.name) / "ledger_payload_agents"
        self.module.FAILED_QUEUE_DIR = self.module.LEDGER_PAYLOAD_ROOT / "failed_queue"
        self.module.FAILED_QUEUE_ARCHIVE_DIR = self.module.FAILED_QUEUE_DIR / "completed"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_execute_reads_utf8_payload_file_and_preserves_chinese(self) -> None:
        payload_path = Path(self.temp_dir.name) / "ledger.json"
        payload = {
            "task_title": "中文能力记账",
            "task_text": "通过 UTF-8 文件读取中文字段。",
            "tags": ["编码能力"],
            "summary": "保持中文原文",
        }
        payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        captured_context: dict[str, object] = {}

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = skills, apps
                captured_context.update(context)
                return {"status": "completed", "ledger_status": "completed"}

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.execute({"payload_path": str(payload_path)}, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(captured_context["task_title"], "中文能力记账")
        self.assertEqual(captured_context["task_text"], "通过 UTF-8 文件读取中文字段。")
        self.assertEqual(captured_context["tags"], ["编码能力"])
        self.assertEqual(captured_context["summary"], "保持中文原文")
        self.assertNotIn("failed_queue_path", result)

    def test_submit_payload_file_preserves_chinese_fields(self) -> None:
        payload_path = Path(self.temp_dir.name) / "ledger.json"
        payload = {
            "task_title": "中文记账测试",
            "task_text": "验证中文通过 UTF-8 JSON 文件提交时不会变成问号。",
            "tags": ["中文编码"],
            "summary": "保持中文原文",
        }
        payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        captured_context: dict[str, object] = {}

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = skills, apps
                captured_context.update(context)
                return {"status": "completed", "ledger_status": "completed"}

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.submit_payload_file(str(payload_path))

        self.assertEqual(result["status"], "completed")
        self.assertEqual(captured_context["task_title"], "中文记账测试")
        self.assertEqual(captured_context["task_text"], "验证中文通过 UTF-8 JSON 文件提交时不会变成问号。")
        self.assertEqual(captured_context["tags"], ["中文编码"])
        self.assertEqual(captured_context["summary"], "保持中文原文")

    def test_execute_allows_runtime_context_to_override_file_fields(self) -> None:
        payload_path = Path(self.temp_dir.name) / "ledger.json"
        payload_path.write_text(
            json.dumps({"task_title": "旧标题", "summary": "旧摘要"}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        captured_context: dict[str, object] = {}

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = skills, apps
                captured_context.update(context)
                return {"status": "completed", "ledger_status": "completed"}

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        self.module.execute(
            {
                "payload_path": str(payload_path),
                "task_title": "新标题",
                "summary": "新摘要",
            },
            {},
            {},
        )

        self.assertEqual(captured_context["task_title"], "新标题")
        self.assertEqual(captured_context["summary"], "新摘要")

    def test_execute_records_failed_submission_to_local_queue(self) -> None:
        payload_path = Path(self.temp_dir.name) / "ledger.json"
        payload_path.write_text(
            json.dumps(
                {
                    "task_title": "失败记账测试",
                    "task_text": "模拟远端失败后应进入本地失败清单。",
                    "tags": ["失败队列"],
                    "summary": "等待补记",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = context, skills, apps
                return {
                    "status": "ledger_submit_failed",
                    "ledger_status": "failed",
                    "failure_reason": "remote down",
                }

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.execute({"payload_path": str(payload_path)}, {}, {})

        self.assertEqual(result["status"], "ledger_submit_failed")
        failed_queue_path = Path(result["failed_queue_path"])
        self.assertTrue(failed_queue_path.exists())
        queue_entry = json.loads(failed_queue_path.read_text(encoding="utf-8"))
        self.assertEqual(queue_entry["queue_status"], "pending")
        self.assertEqual(queue_entry["source_payload_path"], str(payload_path.resolve()))
        self.assertEqual(queue_entry["payload"]["task_title"], "失败记账测试")

    def test_execute_archives_failed_queue_entry_after_successful_retry(self) -> None:
        payload = {
            "task_title": "补记成功测试",
            "task_text": "模拟远端恢复后的补记成功。",
            "tags": ["补记"],
            "summary": "补记成功",
        }
        source_payload_path = str(Path("/tmp/ledger.json").resolve())
        failed_entry_path = self.module.record_failed_submission(
            payload,
            {"status": "ledger_submit_failed", "ledger_status": "failed"},
            source_payload_path=source_payload_path,
        )
        self.assertTrue(failed_entry_path.exists())

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = context, skills, apps
                return {"status": "completed", "ledger_status": "recorded", "run_id": "RUN-OK"}

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.execute(
            {
                **payload,
                "source_payload_path": source_payload_path,
                self.module.SKIP_FAILED_QUEUE_AUTO_RETRY_KEY: True,
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "completed")
        self.assertFalse(failed_entry_path.exists())
        archive_path = Path(result["failed_queue_cleared_path"])
        self.assertTrue(archive_path.exists())
        archived_entry = json.loads(archive_path.read_text(encoding="utf-8"))
        self.assertEqual(archived_entry["queue_status"], "completed")
        self.assertEqual(archived_entry["success_result"]["run_id"], "RUN-OK")

    def test_retry_failed_queue_replays_pending_entries_one_by_one(self) -> None:
        source_payload_path = str(Path("/tmp/original-ledger.json").resolve())
        payload = {
            "task_title": "待补记账本",
            "task_text": "远端恢复后逐条补记。",
            "tags": ["失败清单重试"],
            "summary": "单条重试",
        }
        entry_path = self.module.record_failed_submission(
            payload,
            {"status": "ledger_submit_failed", "ledger_status": "failed"},
            source_payload_path=source_payload_path,
        )

        captured_contexts: list[dict[str, object]] = []

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = skills, apps
                captured_contexts.append(dict(context))
                return {"status": "completed", "ledger_status": "recorded", "run_id": "RUN-RETRY-001"}

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.retry_failed_queue()

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["attempted_count"], 1)
        self.assertEqual(result["succeeded_count"], 1)
        self.assertEqual(result["failed_count"], 0)
        self.assertEqual(result["skipped_count"], 0)
        self.assertEqual(captured_contexts[0]["task_title"], "待补记账本")
        self.assertFalse(entry_path.exists())
        self.assertTrue((self.module.FAILED_QUEUE_ARCHIVE_DIR / entry_path.name).exists())

    def test_retry_failed_queue_archives_legacy_manual_entry_without_submit(self) -> None:
        entry_path = self.module.FAILED_QUEUE_DIR / "ledger_failed_manual_name.json"
        self.module.FAILED_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
        entry_path.write_text(
            json.dumps(
                {
                    "queue_status": "pending",
                    "source_payload_path": "/tmp/manual-ledger.json",
                    "payload": {
                        "task_title": "手工失败文件",
                        "task_text": "历史手工命名文件不再自动补记。",
                        "tags": ["失败清单"],
                        "summary": "直接归档",
                    },
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                raise AssertionError("历史手工命名失败文件不应自动提交远端")

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.retry_failed_queue()

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["succeeded_count"], 0)
        self.assertEqual(result["failed_count"], 0)
        self.assertEqual(result["skipped_count"], 1)
        self.assertFalse(entry_path.exists())
        archive_path = self.module.FAILED_QUEUE_ARCHIVE_DIR / entry_path.name
        self.assertTrue(archive_path.exists())
        archived_entry = json.loads(archive_path.read_text(encoding="utf-8"))
        self.assertEqual(archived_entry["resolution"], "manual_skip_not_submitted")

    def test_execute_auto_retries_failed_queue_before_current_payload(self) -> None:
        source_payload_path = str(Path("/tmp/auto-ledger.json").resolve())
        pending_payload = {
            "task_title": "自动补记任务",
            "task_text": "正式记账前先补记。",
            "tags": ["自动补记"],
            "summary": "自动补记成功",
        }
        entry_path = self.module.record_failed_submission(
            pending_payload,
            {"status": "ledger_submit_failed", "ledger_status": "failed"},
            source_payload_path=source_payload_path,
        )
        current_payload = {
            "task_title": "当前任务",
            "task_text": "补记完成后提交当前任务。",
            "tags": ["当前记账"],
            "summary": "当前任务成功",
        }
        submit_order: list[str] = []

        class _LedgerHttpModule:
            @staticmethod
            def execute(context, skills, apps):
                _ = skills, apps
                submit_order.append(context["task_title"])
                return {"status": "completed", "ledger_status": "recorded", "run_id": context["task_title"]}

        self.module._load_module = lambda module_path, module_name: _LedgerHttpModule()

        result = self.module.execute(current_payload, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(submit_order, ["自动补记任务", "当前任务"])
        self.assertFalse(entry_path.exists())
        self.assertTrue((self.module.FAILED_QUEUE_ARCHIVE_DIR / entry_path.name).exists())
        self.assertEqual(result["failed_queue_auto_retry"]["succeeded_count"], 1)


if __name__ == "__main__":
    unittest.main()
