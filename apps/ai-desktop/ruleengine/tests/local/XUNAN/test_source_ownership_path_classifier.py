"""源码归属路径身份模块测试。"""

from __future__ import annotations

import unittest

from _source_ownership_test_support import ACTIVE_STABLE_USER_ID, PROJECT_ROOT
from source_ownership.path_classifier import (
    active_stable_user_id,
    managed_database_registry_path,
)


class SourceOwnershipPathClassifierTests(unittest.TestCase):
    """验证稳定用户只来自 AGENTS.md，中央登记路径不扫描目录猜测。"""

    def test_active_user_and_registry_path_follow_authority_file(self) -> None:
        """真实工程必须解析到同一个安全用户及其唯一中央登记。"""
        self.assertEqual(active_stable_user_id(PROJECT_ROOT), ACTIVE_STABLE_USER_ID)
        self.assertEqual(
            managed_database_registry_path(PROJECT_ROOT, ACTIVE_STABLE_USER_ID),
            PROJECT_ROOT
            / "apps/ai-desktop/ruleengine/rules/local"
            / ACTIVE_STABLE_USER_ID
            / "selplat/通用/registry/managed-database-applications.json",
        )


if __name__ == "__main__":
    unittest.main()
