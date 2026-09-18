"""协作工作树规则测试路径隔离回归。"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import sys
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
TEST_RUNNER_PATH = PROJECT_ROOT / "apps/ai-desktop/ruleengine/tests/run_tests.py"
INTEGRATOR_PATH = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local/XUNAN/abilities"
    / "ai_rule_package_integrator.py"
)


def load_test_runner():
    """从当前工作树加载统一测试入口，避免依赖已安装副本。"""

    specification = importlib.util.spec_from_file_location(
        "rule_test_workspace_isolation_runner", TEST_RUNNER_PATH
    )
    assert specification is not None
    assert specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


class RuleTestWorkspaceIsolationTests(unittest.TestCase):
    """保证候选源码测试不会混用主工程规则资源。"""

    def setUp(self) -> None:
        self.previous_root = os.environ.get("SELPLAT_ROOT")
        self.runner = load_test_runner()

    def tearDown(self) -> None:
        if self.previous_root is None:
            os.environ.pop("SELPLAT_ROOT", None)
        else:
            os.environ["SELPLAT_ROOT"] = self.previous_root

    def test_collaboration_worktree_replaces_inherited_runtime_root(self) -> None:
        """候选工作树必须覆盖继承的主工程运行时根。"""

        candidate_root = Path("/tmp/collaboration/worktrees/rule-test")
        os.environ["SELPLAT_ROOT"] = "/tmp/main-project"

        self.runner._configure_test_workspace_root(candidate_root)

        self.assertEqual(str(candidate_root), os.environ["SELPLAT_ROOT"])

    def test_regular_project_keeps_selected_runtime_root(self) -> None:
        """非协作工作树继续保留调用方选择的工程根。"""

        os.environ["SELPLAT_ROOT"] = "/tmp/selected-project"

        self.runner._configure_test_workspace_root(Path("/tmp/regular-project"))

        self.assertEqual("/tmp/selected-project", os.environ["SELPLAT_ROOT"])

    def test_direct_integrator_import_configures_workspace_before_path_loading(self) -> None:
        """直接导入规则能力也必须先隔离工作树路径配置。"""

        source = INTEGRATOR_PATH.read_text(encoding="utf-8")

        self.assertIn("_configure_workspace_root(PROJECT_ROOT)", source)
        self.assertLess(
            source.index("_configure_workspace_root(PROJECT_ROOT)"),
            source.index("加载路径配置()"),
        )


if __name__ == "__main__":
    unittest.main()
