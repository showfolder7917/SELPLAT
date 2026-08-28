"""源码归属语言登记模块测试。"""

from __future__ import annotations

import unittest

from _source_ownership_test_support import PROJECT_ROOT
from source_ownership.language_registry import registered_languages


class SourceOwnershipLanguageRegistryTests(unittest.TestCase):
    """验证 rule-engine 固定语言集合和显式模块登记入口。"""

    def test_rule_engine_keeps_registered_language_contract(self) -> None:
        """扁平 rule-engine 必须继续登记 Java、Python 和 Node 兼容扫描域。"""
        module_root = PROJECT_ROOT / "apps/ai-desktop/ruleengine"
        self.assertEqual(
            registered_languages(PROJECT_ROOT, module_root),
            {"java", "python", "node"},
        )


if __name__ == "__main__":
    unittest.main()
