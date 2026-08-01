"""页面真实视觉测试能力测试。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


ABILITY_PATH = Path(__file__).resolve().parents[1] / "abilities" / "page_visual_tester.py"


def load_ability_module():
    spec = importlib.util.spec_from_file_location("page_visual_tester_test_module", ABILITY_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PageVisualTesterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_ability_module()

    def test_execute_requires_url(self) -> None:
        result = self.module.execute({}, {}, {})

        self.assertEqual(result["status"], "failed")
        self.assertIn("缺少 url", result["message"])

    def test_execute_normalizes_config_and_uses_injected_runner(self) -> None:
        captured_config = {}

        def fake_runner(config):
            captured_config.update(config)
            return {
                "status": "completed",
                "runner": "fake",
                "screenshots": [f"{config['output_dir']}/initial.png"],
                "selector_results": [{"name": "facts", "selector": ".fact-field-row", "count": 8, "passed": True}],
                "text_results": [{"name": "事实字段", "selector": "body", "text": "事实字段", "passed": True}],
            }

        result = self.module.execute(
            {
                "url": "http://127.0.0.1:5174/?view=governance",
                "width": 1440,
                "height": 810,
                "scrolls": [{"selector": ".governance-layout", "y": 640}],
                "selector_checks": [{"name": "facts", "selector": ".fact-field-row", "expected_count": 8}],
                "must_contain": "事实字段",
                "_runner": fake_runner,
            },
            {},
            {},
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["ability"], "page_visual_tester")
        self.assertEqual(captured_config["viewport_width"], 1440)
        self.assertEqual(captured_config["viewport_height"], 810)
        self.assertEqual(captured_config["scrolls"][0]["selector"], ".governance-layout")
        self.assertEqual(captured_config["selector_checks"][0]["expected_count"], 8)
        self.assertEqual(captured_config["text_checks"][0]["text"], "事实字段")

    def test_cli_count_parser_supports_min_max(self) -> None:
        parsed = self.module._parse_count_arg("facts=.fact-field-row:8:8")

        self.assertEqual(parsed["name"], "facts")
        self.assertEqual(parsed["selector"], ".fact-field-row")
        self.assertEqual(parsed["min_count"], 8)
        self.assertEqual(parsed["max_count"], 8)


if __name__ == "__main__":
    unittest.main()
