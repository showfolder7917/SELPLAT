"""会话最新问答记录与独立 3 授权回执测试。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
PYTHON_SOURCE_ROOT = PROJECT_ROOT / "apps/rule-engine/backend/src/main/python"
if str(PYTHON_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_SOURCE_ROOT))
ABILITY_PATH = PYTHON_SOURCE_ROOT / "com/sp/selplat/ruleengine/abilities/会话记录执行器.py"
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("session_turn_recorder_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SessionTurnRecorderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        self.temp_dir = tempfile.TemporaryDirectory(prefix="session_turn_", dir=OPTION_TEMP_ROOT)
        temp_root = Path(self.temp_dir.name)
        self.module.资源根 = temp_root / "resources"
        self.module.身份文件 = temp_root / "AGENTS.md"
        self.module.身份文件.write_text("- 当前稳定用户 ID：`TESTER`\n", encoding="utf-8")
        self.thread_id = "thread-001"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _record(self, **overrides):
        context = {
            "action": "record_latest_turn",
            "command": "3",
            "thread_id": self.thread_id,
            "role": "代码",
            "question": "修改程序\n并保留原文",
            "answer": "先记录\t再执行修改",
            **overrides,
        }
        return self.module.execute(context, {}, {})

    def test_records_exactly_two_flattened_lines_and_returns_valid_receipt(self) -> None:
        result = self._record()

        self.assertTrue(result["recorded"])
        self.assertTrue(result["execution_authorized"])
        record_path = Path(result["record_path"])
        self.assertEqual(record_path.name, "会话_thread-001.md")
        self.assertEqual(
            record_path.read_text(encoding="utf-8").splitlines(),
            [
                "0001Q｜代码｜修改程序 并保留原文",
                "0001A｜代码｜先记录 再执行修改",
            ],
        )
        self.assertTrue(self.module.验证记录回执(self.thread_id, result["authorization_receipt"]))

    def test_duplicate_latest_pair_does_not_record_or_authorize_again(self) -> None:
        first = self._record()
        second = self._record()

        self.assertTrue(first["recorded"])
        self.assertFalse(second["recorded"])
        self.assertTrue(second["duplicate"])
        self.assertFalse(second["execution_authorized"])
        self.assertEqual(Path(first["record_path"]).read_text(encoding="utf-8").count("Q｜"), 1)

    def test_different_threads_write_different_conversation_documents(self) -> None:
        first = self._record()
        second = self._record(thread_id="thread-002", question="第二个会话")

        self.assertNotEqual(first["record_path"], second["record_path"])
        self.assertTrue(Path(first["record_path"]).is_file())
        self.assertTrue(Path(second["record_path"]).is_file())

    def test_non_standalone_three_and_unknown_role_are_blocked(self) -> None:
        non_standalone = self._record(command="3 继续")
        unknown_role = self._record(role="其他")

        self.assertEqual(non_standalone["status"], "blocked")
        self.assertEqual(unknown_role["status"], "blocked")
        self.assertFalse(non_standalone["execution_authorized"])
        self.assertFalse(unknown_role["execution_authorized"])

    def test_malformed_existing_document_blocks_append(self) -> None:
        record_path = self.module._会话路径("TESTER", self.thread_id)
        record_path.parent.mkdir(parents=True, exist_ok=True)
        record_path.write_text("0001Q｜代码｜只有问题\n", encoding="utf-8")

        result = self._record()

        self.assertEqual(result["status"], "blocked")
        self.assertIn("Q/A 两行结构", result["message"])

    def test_protocol_and_root_index_register_standalone_three(self) -> None:
        protocol_text = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/core/protocol/USER.PROTOCOL.md"
        ).read_text(encoding="utf-8")
        root_index_text = (
            PROJECT_ROOT / "apps/rule-engine/backend/src/main/resources/RULE_INDEX.md"
        ).read_text(encoding="utf-8")
        user_rule_text = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/XUNAN/跨工程通用规则"
            / "RUL_会话最新问答记录与执行规则.md"
        ).read_text(encoding="utf-8")

        self.assertIn(
            "standalone_reply_3_means_record_latest_completed_qa_then_execute = true",
            protocol_text,
        )
        self.assertIn("standalone_3_record_ability = session_turn_recorder", protocol_text)
        self.assertIn(
            "standalone_3_execution_thread = current_luna_max_main_thread",
            protocol_text,
        )
        self.assertIn("standalone_3_agent_subthread_policy = forbidden", protocol_text)
        self.assertIn(
            "session_record_execution_thread = current_luna_max_main_thread",
            user_rule_text,
        )
        self.assertIn("session_record_agent_subthread_policy = forbidden", user_rule_text)
        self.assertIn(
            "load_rule_for_active_user_standalone_3_record_and_execute = "
            "SESSION_LATEST_TURN_RECORD_AND_EXECUTE_RULES",
            root_index_text,
        )


if __name__ == "__main__":
    unittest.main()
