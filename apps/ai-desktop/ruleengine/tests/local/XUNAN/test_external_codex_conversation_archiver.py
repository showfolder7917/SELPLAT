"""验证外部 Codex 会话只能在显式调用时保存为可迁移文件。"""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[6]
PROGRAM_PATH = PROJECT_ROOT / "apps/ai-desktop/ruleengine/python/local/XUNAN/abilities/external_codex_conversation_archiver.py"
SPEC = importlib.util.spec_from_file_location("external_codex_conversation_archiver_test", PROGRAM_PATH)
assert SPEC and SPEC.loader
ARCHIVER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = ARCHIVER
SPEC.loader.exec_module(ARCHIVER)


class ExternalCodexConversationArchiverTest(unittest.TestCase):
    """覆盖人工保存、内容过滤、未完成轮标记和幂等更新。"""

    def test_archives_only_visible_messages_and_never_imports_automatically(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_root:
            root = Path(temporary_root)
            project_root = root / "SELPLAT"
            codex_home = root / ".codex"
            rollout = codex_home / "sessions/2026/08/31/rollout-thread-manual.jsonl"
            project_root.mkdir(parents=True)
            (project_root / "AGENTS.md").write_text("# test\n", encoding="utf-8")
            rollout.parent.mkdir(parents=True)
            records = [
                {"timestamp": "2026-08-31T01:00:00.000Z", "type": "session_meta", "payload": {"session_id": "thread-manual", "thread_source": "user", "originator": "codex_work_desktop"}},
                {"ordinal": 1, "timestamp": "2026-08-31T01:00:01.000Z", "type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"text": "请手动保存本轮。"}]}},
                {"ordinal": 2, "timestamp": "2026-08-31T01:00:02.000Z", "type": "response_item", "payload": {"type": "message", "role": "assistant", "phase": "commentary", "content": [{"text": "内部过程不得保存。"}]}},
                {"ordinal": 3, "timestamp": "2026-08-31T01:00:03.000Z", "type": "response_item", "payload": {"type": "message", "role": "assistant", "phase": "final_answer", "content": [{"text": "已手动保存。\n<!-- SELPLAT_CORPUS_META {\"title\":\"手动保存\",\"type\":\"会话存档\",\"intent\":\"保存当前会话\",\"tags\":[\"会话\"],\"summary\":\"会话已保存。\"} -->"}]}},
                {"timestamp": "2026-08-31T01:00:04.000Z", "type": "event_msg", "payload": {"type": "task_complete"}},
                {"ordinal": 4, "timestamp": "2026-08-31T01:01:01.000Z", "type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"text": "当前请求还没有完成。"}]}},
            ]
            rollout.write_text("\n".join(json.dumps(record, ensure_ascii=False) for record in records) + "\n", encoding="utf-8")

            first = ARCHIVER.archive_conversation(project_root, "thread-manual", codex_home)
            self.assertTrue(first["changed"])
            archive_path = Path(first["archivePath"])
            stored = json.loads(archive_path.read_text(encoding="utf-8"))
            self.assertEqual(stored["archiveMode"], "manual-only")
            self.assertEqual(stored["migration"]["status"], "pending")
            self.assertEqual(stored["migration"]["policy"], "manual-command-only")
            self.assertEqual([turn["status"] for turn in stored["turns"]], ["completed", "incomplete"])
            self.assertEqual(stored["turns"][0]["messages"][1]["content"], "已手动保存。")
            self.assertEqual(stored["turns"][0]["corpusMeta"]["summary"], "会话已保存。")
            self.assertNotIn("内部过程不得保存", archive_path.read_text(encoding="utf-8"))

            second = ARCHIVER.archive_conversation(project_root, "thread-manual", codex_home)
            self.assertFalse(second["changed"])


if __name__ == "__main__":
    unittest.main()
