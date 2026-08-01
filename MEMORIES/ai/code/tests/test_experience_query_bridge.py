"""经验查询桥接能力测试。

功能：
验证 experience_query_bridge 的查询参数提取与 view 透传。

作用：
确保本地能力在接入 compact 模式后仍保持兼容。
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import unittest


ABILITY_PATH = Path(__file__).resolve().parents[1] / "abilities" / "experience_query_bridge.py"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("experience_query_bridge_test_module", ABILITY_PATH)
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


class ExperienceQueryBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()

    def test_execute_passes_compact_view_to_query_url(self) -> None:
        captured_urls: list[str] = []

        def fake_urlopen(url):
            captured_urls.append(getattr(url, "full_url", str(url)))
            return _FakeResponse('{"code":0,"message":"ok","data":{"page":{"total":1},"records":[{"id":"EXP-001"}]}}')

        result = self.module.execute(
            {
                "query_host": "http://127.0.0.1:8780",
                "username": "admin",
                "tenant_id": "default_tenant",
                "workspace_id": "default_workspace",
                "question_text": "经验查询接口怎么用",
                "view": "compact",
                "urlopen_func": fake_urlopen,
            },
            {},
            {},
        )

        parsed = urlparse(captured_urls[0])
        params = parse_qs(parsed.query)
        self.assertEqual(params["query"], ["经验"])
        self.assertEqual(params["view"], ["compact"])
        self.assertEqual(result["view"], "compact")
        self.assertEqual(result["查询条数"], 1)

    def test_execute_defaults_to_compact_view(self) -> None:
        captured_urls: list[str] = []

        def fake_urlopen(url):
            captured_urls.append(getattr(url, "full_url", str(url)))
            return _FakeResponse('{"code":0,"message":"ok","data":{"page":{"total":0},"records":[]}}')

        result = self.module.execute(
            {
                "query_host": "http://127.0.0.1:8780",
                "username": "admin",
                "tenant_id": "default_tenant",
                "workspace_id": "default_workspace",
                "question_text": "session_id 查询怎么做",
                "urlopen_func": fake_urlopen,
            },
            {},
            {},
        )

        parsed = urlparse(captured_urls[0])
        params = parse_qs(parsed.query)
        self.assertEqual(params["view"], ["compact"])
        self.assertEqual(result["view"], "compact")
        self.assertEqual(result["参数"], "session_id")


if __name__ == "__main__":
    unittest.main()
