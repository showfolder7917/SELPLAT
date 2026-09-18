"""规则测试 Python 依赖预检回归。"""

from __future__ import annotations

import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
TEST_RUNNER_PATH = PROJECT_ROOT / "apps/ai-desktop/ruleengine/tests/run_tests.py"


def load_test_runner():
    """从当前工作树加载入口，避免误用已安装副本。"""

    specification = importlib.util.spec_from_file_location(
        "rule_test_dependency_preflight_runner", TEST_RUNNER_PATH
    )
    assert specification is not None
    assert specification.loader is not None
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


class RuleTestDependencyPreflightTests(unittest.TestCase):
    """确保缺依赖时在测试发现前给出环境修复指引。"""

    def setUp(self) -> None:
        self.runner = load_test_runner()

    def test_active_user_reports_missing_dependencies_before_discovery(self) -> None:
        """当前用户测试缺依赖时不能进入 unittest 发现并输出难定位导入异常。"""

        error_output = io.StringIO()
        with (
            patch.object(self.runner, "missing_runtime_dependencies", return_value=["openpyxl"]),
            patch("unittest.TestLoader.discover") as discover,
            contextlib.redirect_stderr(error_output),
        ):
            exit_code = self.runner.main(["active-user", "--summary"])

        self.assertEqual(3, exit_code)
        discover.assert_not_called()
        self.assertIn("openpyxl", error_output.getvalue())
        self.assertIn("-m pip install -r", error_output.getvalue())

    def test_core_does_not_require_user_ability_dependencies(self) -> None:
        """核心规则测试不应因当前用户能力包未安装而被阻断。"""

        with (
            patch.object(self.runner, "missing_runtime_dependencies") as missing,
            patch("unittest.TestLoader.discover", return_value=unittest.TestSuite()),
        ):
            self.assertEqual(0, self.runner.main(["core", "--summary"]))

        missing.assert_not_called()


if __name__ == "__main__":
    unittest.main()
