"""源码归属稳定入口兼容测试。"""

from __future__ import annotations

import importlib.util
import unittest

from _source_ownership_test_support import ABILITY_ROOT
from source_ownership.audit_runner import audit_source_ownership
from source_ownership.database_governance import sql_statements
from source_ownership.frontend_governance import audit_sel_ui_component_governance


class SourceOwnershipEntryCompatibilityTests(unittest.TestCase):
    """验证旧入口继续导出既有调用方依赖的函数对象。"""

    def test_thin_entry_reexports_public_functions(self) -> None:
        """模块化后旧路径、函数名和调用对象必须保持兼容。"""
        entry_path = ABILITY_ROOT / "selplat_source_ownership_guard.py"
        spec = importlib.util.spec_from_file_location("source_ownership_entry_contract", entry_path)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertIs(module.audit_source_ownership, audit_source_ownership)
        self.assertIs(module.sql_statements, sql_statements)
        self.assertIs(module.audit_sel_ui_component_governance, audit_sel_ui_component_governance)


if __name__ == "__main__":
    unittest.main()
