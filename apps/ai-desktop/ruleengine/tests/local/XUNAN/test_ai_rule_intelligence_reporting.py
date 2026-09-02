"""规则冲突候选与任务闭包体量报告测试。"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import re
import sys
import unittest
from unittest import mock


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 测试动态导入前先把字节码缓存切到工程 cache，避免测试污染源码树。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "apps/ai-desktop/ruleengine/AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1:
    raise RuntimeError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
PROGRAM_PATH = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local"
    / ACTIVE_STABLE_USER_ID
    / "abilities/ai_rule_package_integrator.py"
)


def _load_program():
    """按当前稳定用户加载真实智慧整合能力。"""

    spec = importlib.util.spec_from_file_location(
        "active_user_rule_intelligence_reporting_test", PROGRAM_PATH
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class _FakeCoreExecutor:
    """返回稳定规则闭包，隔离墙钟时间以外的文件系统变化。"""

    def execute(self, ability_name: str, context: dict) -> dict:
        """模拟 core layered_rule_loader 的公开返回契约。"""

        if ability_name != "layered_rule_loader" or context.get("action") != "load_bundle":
            raise AssertionError(f"unexpected request: {ability_name}, {context}")
        return {
            "status": "completed",
            "result": {
                "rules": {
                    "SAMPLE_RULES": {
                        "layers": [
                            {
                                "layer": "active_user",
                                "resource_path": "local/XUNAN/sample/RUL_示例规则.md",
                                "content": "sample_policy = enabled",
                            }
                        ],
                        "effective_rule": {
                            "content": "# Effective\n\nsample_policy = enabled\n"
                        },
                    }
                },
                "receipt": [
                    "SAMPLE_RULES | [active_user] local/XUNAN/sample/RUL_示例规则.md "
                    "| override_mode=extend"
                ],
            },
        }


class AiRuleIntelligenceReportingTests(unittest.TestCase):
    """验证候选只提供证据，并验证体量指标明确标注代理语义。"""

    def setUp(self) -> None:
        self.program = _load_program()

    def test_migrated_rules_reference_the_current_authority(self) -> None:
        """迁移收敛规则不得继续依赖已经删除的两个旧实体路径。"""

        rule_path = (
            PROJECT_ROOT
            / "apps/ai-desktop/ruleengine/rules/local"
            / ACTIVE_STABLE_USER_ID
            / "中文教学/通用/rule/RUL_规则引用迁移修正规则.md"
        )
        text = rule_path.read_text(encoding="utf-8")

        self.assertIn(
            "CHINESE_PINYIN_CORRECTION_RULES.current_authority_rule = "
            f"local/{ACTIVE_STABLE_USER_ID}/中文教学/通用/rule/RUL_规则引用迁移修正规则.md",
            text,
        )
        self.assertIn(
            "ANCIENT_POEM_BACKGROUND_RULES.current_authority_rule = "
            f"local/{ACTIVE_STABLE_USER_ID}/中文教学/通用/rule/RUL_规则引用迁移修正规则.md",
            text,
        )
        self.assertNotIn("RUL_拼音标注与朗读版校正规则.md", text)
        self.assertNotIn("RUL_古诗无文字底图生成工作流程规则.md", text)

    def test_same_key_different_values_are_candidates_not_verdicts(self) -> None:
        """跨规则同键异值只能进入人工复核候选。"""

        audited_rules = [
            {
                "logical_id": "FIRST_RULES",
                "path": "local/XUNAN/first.md",
                "_assignments": {
                    "shared_business_policy": "enabled",
                    "rule_version": "1.0.0",
                },
            },
            {
                "logical_id": "SECOND_RULES",
                "path": "local/XUNAN/second.md",
                "_assignments": {
                    "shared_business_policy": "disabled",
                    "rule_version": "2.0.0",
                },
            },
        ]

        candidates = self.program._semantic_conflict_candidates(audited_rules)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["dslKey"], "shared_business_policy")
        self.assertEqual(
            candidates[0]["decision"],
            "evidence_review_required_not_an_automatic_conflict_verdict",
        )

    def test_explicit_relative_rule_references_enter_stale_path_audit(self) -> None:
        """明确的同目录或点号相对路径不能因缺少工程前缀而漏报。"""

        self.assertTrue(
            self.program._is_project_reference(
                "继续读取同目录的`RUL_已迁移规则.md`。",
                "RUL_已迁移规则.md",
            )
        )
        self.assertTrue(
            self.program._is_project_reference(
                "读取相邻规则。",
                "../相邻目录/RUL_已迁移规则.md",
            )
        )
        self.assertFalse(
            self.program._is_project_reference(
                "仅以文档名举例。",
                "RUL_示例规则.md",
            )
        )

    def test_bundle_benchmark_reports_receipt_and_explicit_proxies(self) -> None:
        """闭包报告必须同时给出来源回执、体量代理和语义免责声明。"""

        fake_executor = _FakeCoreExecutor()
        with mock.patch.object(
            self.program, "_load_core_executor", return_value=fake_executor
        ):
            result = self.program.execute(
                {
                    "action": "benchmark_bundle",
                    "logical_ids": ["SAMPLE_RULES"],
                    "iterations": 2,
                },
                {},
                {},
            )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["resolvedLogicalIds"], ["SAMPLE_RULES"])
        self.assertEqual(result["physicalSourceCount"], 1)
        self.assertEqual(len(result["receipt"]), 1)
        self.assertGreater(result["contentMetrics"]["tokenProxyFourUtf8Bytes"], 0)
        self.assertEqual(
            result["contentMetrics"]["tokenProxyDisclaimer"],
            "size_proxy_only_not_model_billing_or_tokenizer_output",
        )
        self.assertEqual(result["timingMetrics"]["iterations"], 2)
        self.assertEqual(
            result["timingMetrics"]["timingDisclaimer"],
            "local_loader_wall_time_not_end_to_end_agent_latency",
        )

    def test_mandatory_rule_relationships_are_in_the_real_dependency_closure(self) -> None:
        """正文中的必须共同加载必须落到 requires_rule_ids，而不是只停留在说明文字。"""

        expected_closures = {
            "IDIOM_FABLE_PICTURE_BOOK_PPT_RULES": [
                "HORIZONTAL_TEACHING_PPT_RULES",
                "IDIOM_FABLE_PICTURE_BOOK_PPT_RULES",
            ],
            "ANCIENT_POEM_PPT_LAYOUT_RULES": [
                "ANCIENT_POEM_BACKGROUND_RULES",
                "ANCIENT_POEM_IMAGE_FULL_FLOW_RULES",
                "ANCIENT_POEM_PPT_LAYOUT_RULES",
            ],
        }

        for logical_id, expected in expected_closures.items():
            with self.subTest(logical_id=logical_id):
                result = self.program.execute(
                    {
                        "action": "benchmark_bundle",
                        "logical_ids": [logical_id],
                        "iterations": 1,
                    },
                    {},
                    {},
                )
                self.assertEqual(result["status"], "completed")
                self.assertEqual(result["resolvedLogicalIds"], expected)

    def test_benchmark_rejects_invalid_logical_ids(self) -> None:
        """无效逻辑 ID 必须在进入真实加载器前阻断。"""

        with mock.patch.object(
            self.program, "_load_core_executor", return_value=_FakeCoreExecutor()
        ):
            result = self.program.execute(
                {"action": "benchmark_bundle", "logical_ids": ["invalid-id"]},
                {},
                {},
            )

        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["exit_code"], 1)


if __name__ == "__main__":
    unittest.main()
