"""记账 HTTP 提交能力测试。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


ABILITY_PATH = Path(__file__).resolve().parents[1] / "abilities" / "ledger_http_submitter.py"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("ledger_http_submitter_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _FakeResponse:
    def __init__(self, payload: str) -> None:
        self.payload = payload.encode("utf-8")

    def read(self) -> bytes:
        return self.payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        _ = exc_type, exc, tb
        return False


class LedgerHttpSubmitterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()

    def test_execute_submits_to_ingest(self) -> None:
        responses = [
            _FakeResponse('{"code":0,"message":"ok","data":{"run_id":"RUN-001","ledger_status":"ledger_recorded","closeout_summary":{"summary":"已完成记账"}}}'),
        ]

        def fake_urlopen(request):
            self.assertIn("/api/ai-os/experience/ingest", request.full_url)
            return responses.pop(0)

        result = self.module.execute(
            {
                "username": "admin",
                "tenant_id": "default_tenant",
                "workspace_id": "default_workspace",
                "task_title": "测试标题",
                "task_text": "测试事实",
                "task_type": "project_task",
                "tags": ["测试主题"],
                "summary": "测试摘要",
                "changed_paths": [],
                "lessons": ["经验一"],
                "repeated_fixes": [],
                "verification": {"actions": ["已验证"], "result": "passed", "evidence": []},
                "urlopen_func": fake_urlopen,
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["run_id"], "RUN-001")
        self.assertEqual(result["ledger_status"], "ledger_recorded")
        self.assertEqual(result["closeout_summary"], "已完成记账")
        self.assertEqual(result["ledger_tags"], ["测试主题"])
        self.assertEqual(result["ledger_summary"], "已完成记账")

    def test_execute_fails_when_identity_fields_are_missing(self) -> None:
        result = self.module.execute(
            {
                "task_title": "缺少启动参数",
                "urlopen_func": lambda request: (_ for _ in ()).throw(AssertionError("should_not_call_http")),
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "missing_bootstrap_identity_fields")
        self.assertEqual(result["failure_reason"], "缺少 username/tenant_id/workspace_id。")
        self.assertEqual(result["missing_fields"], ["username", "tenant_id", "workspace_id"])
        self.assertEqual(result["ledger_status"], "failed")

    def test_execute_returns_http_rejection_for_invalid_payload(self) -> None:
        responses = [
            _FakeResponse('{"code":400,"message":"记账数据不足，缺少字段后补足重试。","data":{"status":"ledger_payload_insufficient","missing_fields":["task_text"]}}'),
        ]

        def fake_urlopen(request):
            _ = request
            return responses.pop(0)

        result = self.module.execute(
            {
                "username": "admin",
                "tenant_id": "default_tenant",
                "workspace_id": "default_workspace",
                "task_title": "只给了标题",
                "urlopen_func": fake_urlopen,
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "ledger_submit_rejected")
        self.assertEqual(result["failure_reason"], "记账数据不足，缺少字段后补足重试。")
        self.assertEqual(result["submit_response"]["data"]["status"], "ledger_payload_insufficient")


if __name__ == "__main__":
    unittest.main()
