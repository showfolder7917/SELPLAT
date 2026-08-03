"""最小用户确认门能力测试。"""

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
MAIN_CODE_ROOT = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core"
)
import tempfile
import unittest


ABILITY_PATH = MAIN_CODE_ROOT / "abilities" / "user_confirmation_gatekeeper.py"
# 所有能力测试运行数据统一归入当前工程 OPTION/temp。
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("user_confirmation_gatekeeper_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class UserConfirmationGatekeeperTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()
        # 确保统一测试运行目录存在。
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # 确认门状态文件只在 OPTION/temp 的自动清理目录内生成。
        self.temp_dir = tempfile.TemporaryDirectory(prefix="user_confirmation_", dir=OPTION_TEMP_ROOT)
        self.state_path = str(Path(self.temp_dir.name) / "gate.json")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_guard_requires_standalone_confirmation_first(self) -> None:
        result = self.module.execute(
            {
                "state_path": self.state_path,
                "session_id": "demo",
                "timestamp_id": "t1",
                "task_text": "排查 USER 协议未执行",
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "needs_confirmation")
        self.assertIn("1 立即执行", result["message"])

    def test_reply_one_confirms_execution(self) -> None:
        self.module.execute(
            {
                "state_path": self.state_path,
                "session_id": "demo",
                "timestamp_id": "t1",
                "task_text": "排查 USER 协议未执行",
            },
            {},
            {},
        )

        result = self.module.execute(
            {
                "state_path": self.state_path,
                "session_id": "demo",
                "timestamp_id": "t1",
                "action": "reply",
                "user_reply": "1",
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "execution_confirmed")
        self.assertEqual(result["confirmed_task_understanding"], "排查 USER 协议未执行")

    def test_reply_two_defers_execution(self) -> None:
        self.module.execute(
            {
                "state_path": self.state_path,
                "session_id": "demo",
                "timestamp_id": "t1",
                "task_text": "排查 USER 协议未执行",
            },
            {},
            {},
        )

        result = self.module.execute(
            {
                "state_path": self.state_path,
                "session_id": "demo",
                "timestamp_id": "t1",
                "action": "reply",
                "user_reply": "2",
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "execution_deferred")


if __name__ == "__main__":
    unittest.main()
