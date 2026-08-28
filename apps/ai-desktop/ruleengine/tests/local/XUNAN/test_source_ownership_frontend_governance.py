"""源码归属前端治理模块测试。"""

from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from _source_ownership_test_support import PROJECT_ROOT
from source_ownership.frontend_governance import (
    audit_frontend_identity_write_governance,
    audit_sel_ui_component_governance,
    audit_sel_ui_typography_governance,
)


class SourceOwnershipFrontendGovernanceTests(unittest.TestCase):
    """验证缺少前端模块时不误报，并保留真实工程的独立审查入口。"""

    def test_empty_project_has_no_frontend_domain_violation(self) -> None:
        """没有 apps/SEL UI 的工程夹具不应被前端领域门禁误判。"""
        with tempfile.TemporaryDirectory(dir=PROJECT_ROOT / "OPTION/temp") as temp_root:
            fixture = Path(temp_root)
            self.assertEqual(audit_sel_ui_component_governance(fixture), [])
            self.assertEqual(audit_sel_ui_typography_governance(fixture), [])
            self.assertEqual(audit_frontend_identity_write_governance(fixture), [])


if __name__ == "__main__":
    unittest.main()
