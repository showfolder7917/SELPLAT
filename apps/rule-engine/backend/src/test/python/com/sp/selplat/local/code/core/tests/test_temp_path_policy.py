"""SELPLAT 临时路径收敛规则测试。"""

from __future__ import annotations

import ast
import importlib.util
from pathlib import Path
import re
# 从迁移后的测试包向上识别工程根，测试数据和输出必须继续归属当前工程。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 生产 Python core 的唯一位置与测试 source set 分离，测试统一通过该路径加载真实能力。
MAIN_CODE_ROOT = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core"
)
import unittest


# 测试从真实代码树推导 SELPLAT 根，禁止用机器相关绝对路径替代工程结构。
CODE_ROOT = MAIN_CODE_ROOT
RULEENGINE_ROOT = (
    PROJECT_ROOT / "apps/rule-engine/backend/src/main/python/com/sp/selplat/ruleengine"
)
SELPLAT_ROOT = PROJECT_ROOT
# 所有受检入口必须把短期产物归入当前 SELPLAT 的 OPTION/temp。
OPTION_TEMP_ROOT = SELPLAT_ROOT / "OPTION" / "temp"
# 当前稳定用户只从 AGENTS.md 读取，禁止扫描代码目录推断。
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1:
    raise RuntimeError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
# 生产入口和可直接运行的当前用户测试入口必须在动态加载工程模块前主动设置缓存根，
# 不能只依赖 VS Code 环境变量或统一测试入口。
PYTHON_ENTRY_PATHS = [
    CODE_ROOT / "abilities" / "startup_protocol_loader.py",
    RULEENGINE_ROOT / "执行器.py",
    PROJECT_ROOT / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code"
    / ACTIVE_STABLE_USER_ID / "abilities/ai_rule_package_integrator.py",
    PROJECT_ROOT / "apps/rule-engine/backend/src/test/python/com/sp/selplat/local/code"
    / ACTIVE_STABLE_USER_ID / "tests/test_ai_rule_package_integrator.py",
]
# Python 测试统一入口必须在发现测试模块前设置同一个缓存根。
PYTHON_TEST_RUNNER_PATH = (
    PROJECT_ROOT / "apps/rule-engine/backend/src/test/python/run_tests.py"
)


def load_module(module_path: Path, module_name: str):
    """从真实文件加载待测临时路径常量。"""

    # 动态加载保持技能无需包安装即可独立执行的生产契约。
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    # 加载规格缺失说明真实入口已不可调用，测试必须立即失败。
    assert spec is not None
    assert spec.loader is not None
    # 执行真实模块以读取其路径策略，不复制生产常量。
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TempPathPolicyTests(unittest.TestCase):
    """验证程序和测试不会把临时文件写回旧目录或系统目录。"""

    def test_all_tempfile_calls_declare_owned_directory(self) -> None:
        """代码树内 tempfile 创建调用必须显式声明 dir 参数。"""

        # 扫描正式能力和 util，确保新增 tempfile 调用也受同一回归门保护。
        python_files = sorted({
            path
            for root in (CODE_ROOT, RULEENGINE_ROOT)
            for area in ("abilities", "util")
            for path in (root / area).glob("*.py")
        })
        violations: list[str] = []
        # AST 检查不依赖文本换行格式，可稳定识别多行调用和关键字参数。
        for python_file in python_files:
            source = python_file.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(python_file))
            for node in ast.walk(tree):
                # 仅检查会创建真实临时文件或目录的 tempfile API。
                if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                    continue
                if node.func.attr not in {"TemporaryDirectory", "NamedTemporaryFile", "mkdtemp"}:
                    continue
                # 缺少 dir 会回退系统临时目录，记录文件和行号供修复定位。
                if not any(keyword.arg == "dir" for keyword in node.keywords):
                    violations.append(f"{python_file}:{node.lineno}")
        # 空清单表示所有创建入口均显式声明了工程归属目录。
        self.assertEqual(violations, [])

    def test_python_entries_set_project_pycache_before_dynamic_imports(self) -> None:
        """生产和测试入口必须主动设置 cache/python-pycache。"""

        # 生产入口和统一测试入口共同组成受检清单。
        entry_paths = [*PYTHON_ENTRY_PATHS, PYTHON_TEST_RUNNER_PATH]
        # 每个入口都必须同时约束当前解释器和未来子进程。
        for entry_path in entry_paths:
            source = entry_path.read_text(encoding="utf-8")
            # 当前解释器通过 sys.pycache_prefix 立即切换缓存位置。
            self.assertIn("sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)", source)
            # 子进程通过环境变量继承同一工程缓存位置。
            self.assertIn(
                'os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)',
                source,
            )
            # 稳定缓存目录必须来自工程根派生或公共路径配置，禁止机器绝对路径。
            self.assertTrue(
                'PROJECT_ROOT / "cache/python-pycache"' in source
                or '_路径.取得("python_cache")' in source
            )


if __name__ == "__main__":
    # 保留文件直跑入口，与现有无 package 的 tests 目录执行方式一致。
    unittest.main()
