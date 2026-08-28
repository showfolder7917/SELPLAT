"""源码归属数据库治理模块测试。"""

from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from _source_ownership_test_support import PROJECT_ROOT
from source_ownership.database_governance import (
    load_managed_database_registry,
    sql_statements,
)


class SourceOwnershipDatabaseGovernanceTests(unittest.TestCase):
    """验证登记缺失报告与 SQL 引号内分号解析保持独立。"""

    def test_missing_registry_and_quoted_semicolon_contract(self) -> None:
        """数据库模块必须返回稳定违规码，并且不能拆开字符串内分号。"""
        with tempfile.TemporaryDirectory(dir=PROJECT_ROOT / "OPTION/temp") as temp_root:
            fixture = Path(temp_root)
            registrations, violations = load_managed_database_registry(fixture, "TESTUSER")
            self.assertEqual(registrations, {})
            self.assertEqual(violations[0]["code"], "MANAGED_DATABASE_REGISTRY_MISSING")
        self.assertEqual(
            sql_statements("INSERT INTO Demo(value) VALUES ('a;b'); SELECT 1;"),
            ["INSERT INTO Demo(value) VALUES ('a;b')", "SELECT 1"],
        )


if __name__ == "__main__":
    unittest.main()
