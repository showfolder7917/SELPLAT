"""验证 rule-engine 跨调用缓存与单进程批量调度。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch


PROJECT_ROOT = next(path for path in Path(__file__).resolve().parents if (path / "settings.gradle").is_file())
PYTHON_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/python/ruleengine"
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def _加载(名称: str, 路径: Path):
    """从生产路径加载指定中文模块。"""

    规格 = importlib.util.spec_from_file_location(名称, 路径)
    assert 规格 and 规格.loader
    模块 = importlib.util.module_from_spec(规格)
    规格.loader.exec_module(模块)
    return 模块


class RuleEnginePerformanceTests(unittest.TestCase):
    """覆盖快照命中、变更失效和批量失败短路。"""

    def test_rule_snapshot_hits_and_invalidates_after_revision_change(self) -> None:
        """相同版本复用快照，资源版本变化后重新加载。"""

        模块 = _加载("rule_snapshot_test", PYTHON_ROOT / "abilities/规则快照管理器.py")
        with tempfile.TemporaryDirectory(prefix="snapshot_", dir=OPTION_TEMP_ROOT) as 临时目录:
            模块._缓存根 = Path(临时目录)
            版本 = ["v1"]
            模块._资源版本 = lambda: 版本[0]
            调用 = []
            加载器 = SimpleNamespace(execute=lambda context, skills, apps: 调用.append(context) or {
                "status": "completed", "result": {"receipt": ["demo"], "rules": {"DEMO": {
                    "effective_values": {"enabled": "true"}, "layers": [{"resource_path": "demo.md"}]
                }}}
            })
            上下文 = {"thread_id": "thread", "logical_ids": ["DEMO"], "active_scope": "selplat", "active_user": "XUNAN"}
            self.assertEqual("miss", 模块.execute(上下文, {"layered_rule_loader": 加载器}, {})["cache"])
            self.assertEqual("hit", 模块.execute(上下文, {"layered_rule_loader": 加载器}, {})["cache"])
            版本[0] = "v2"
            self.assertEqual("miss", 模块.execute(上下文, {"layered_rule_loader": 加载器}, {})["cache"])
            self.assertEqual(2, len(调用))

    def test_rule_snapshot_defaults_to_verified_active_user(self) -> None:
        """正式快照入口未显式传用户时仍加载 AGENTS.md 的稳定用户层。"""

        模块 = _加载("rule_snapshot_default_user_test", PYTHON_ROOT / "abilities/规则快照管理器.py")
        with tempfile.TemporaryDirectory(prefix="snapshot_user_", dir=OPTION_TEMP_ROOT) as 临时目录:
            模块._缓存根 = Path(临时目录)
            模块._资源版本 = lambda: "v1"
            调用 = []
            加载器 = SimpleNamespace(execute=lambda context, skills, apps: 调用.append(context) or {
                "status": "completed", "result": {"receipt": [], "rules": {}}
            })
            with patch.object(
                    模块.layered_rule_loader,
                    "current_stable_user_id",
                    return_value="XUNAN"):
                结果 = 模块.execute(
                    {"thread_id": "thread", "logical_ids": ["DEMO"]},
                    {"layered_rule_loader": 加载器},
                    {},
                )
            self.assertEqual("completed", 结果["status"])
            self.assertEqual("XUNAN", 调用[0]["active_user"])

    def test_executor_batch_stops_after_blocking_result(self) -> None:
        """批量执行遇到阻断后不再启动后续能力。"""

        模块 = _加载("executor_batch_test", PYTHON_ROOT / "执行器.py")
        调用 = []
        模块.execute = lambda ability, context=None: 调用.append(ability) or ({"exit_code": 1} if ability == "bad" else {"status": "completed"})
        结果 = 模块._批量执行([{"ability": "ok"}, {"ability": "bad"}, {"ability": "later"}])
        self.assertEqual("blocked_batch", 结果["status"])
        self.assertEqual(["ok", "bad"], 调用)


if __name__ == "__main__":
    unittest.main()
