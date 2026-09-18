"""rule-engine Python 统一测试入口。

该入口在导入 unittest 和测试模块前，把当前进程及子进程的字节码缓存固定到
SELPLAT/cache/python-pycache，避免测试发现阶段在 main 或 test 源码旁生成 __pycache__。
"""

from __future__ import annotations

# 导入 os，把统一缓存根传递给测试可能启动的 Python 子进程。
import os
# 导入 re，从 AGENTS.md 唯一身份声明中解析当前稳定用户。
import re
# 导入 importlib.util，在测试发现前只读检查已声明的 Python 依赖。
import importlib.util
# 导入 sys，在测试模块加载前设置当前解释器的字节码缓存根并返回退出码。
import sys
import io
# 导入 Path，从当前测试入口稳定识别 SELPLAT 工程根。
from pathlib import Path


# 从当前文件向上寻找 settings.gradle，禁止依赖机器固定绝对路径。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# Python 测试与生产入口共享同一个可清理缓存根。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
# 当前测试进程后续导入全部写入工程 cache。
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
# 测试启动的子进程继承相同缓存根。
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)


def _is_collaboration_worktree(project_root: Path) -> bool:
    """判断测试源码是否位于协作候选工作树。"""

    path_parts = project_root.resolve().parts
    return any(
        current == "collaboration" and following == "worktrees"
        for current, following in zip(path_parts, path_parts[1:])
    )


def _configure_test_workspace_root(project_root: Path) -> None:
    """让候选工作树测试读取同一工作树内的规则与源码。"""

    if _is_collaboration_worktree(project_root):
        # 测试源码、规则资源与路径配置必须同根，不能继承主工程运行时数据根。
        os.environ["SELPLAT_ROOT"] = str(project_root)


_configure_test_workspace_root(PROJECT_ROOT)

# 缓存策略完成后才导入 unittest，保证发现的测试模块不会污染源码目录。
import unittest


# 测试源根集中定义，core 与动态当前用户可以单独运行或一次全量运行。
TEST_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/tests/local"
# 当前稳定用户只从工程根 AGENTS.md 读取，禁止扫描测试目录选择用户。
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "apps/ai-desktop/ruleengine/AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1 or not re.fullmatch(
        r"[A-Za-z][A-Za-z0-9_-]{0,63}", ACTIVE_USER_MATCHES[0].strip()):
    raise RuntimeError("AGENTS.md 必须且只能声明一个安全的当前稳定用户 ID。")
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
# 命令行作用域到真实测试目录的稳定映射。
TEST_SCOPES = {
    "core": TEST_ROOT / "core",
    "active-user": TEST_ROOT / ACTIVE_STABLE_USER_ID,
}
TEST_PATTERNS = {
    "core": "test_*.py",
    "active-user": "test_*.py",
    "performance": "test_performance_*.py",
}
# 依赖清单中的发布包名与 Python 导入模块名并不总是一致，统一在这里维护映射。
RUNTIME_DEPENDENCY_MODULES = {
    "python-pptx": "pptx",
    "openpyxl": "openpyxl",
    "python-docx": "docx",
    "Pillow": "PIL",
    "lxml": "lxml",
    "pypinyin": "pypinyin",
}
PYTHON_DEPENDENCY_MANIFEST = PROJECT_ROOT / "apps/ai-desktop/ruleengine/requirements-python.txt"


def missing_runtime_dependencies() -> list[str]:
    """返回当前解释器未安装的规则能力运行依赖，不修改环境。"""

    return [
        package_name
        for package_name, module_name in RUNTIME_DEPENDENCY_MODULES.items()
        if importlib.util.find_spec(module_name) is None
    ]


def report_missing_runtime_dependencies(missing_dependencies: list[str]) -> None:
    """输出可执行的依赖修复指引，避免测试发现阶段只留下导入堆栈。"""

    dependencies = ", ".join(missing_dependencies)
    print(
        "无法运行当前用户规则测试：当前 Python 解释器缺少依赖 "
        f"{dependencies}。\n"
        f"解释器：{sys.executable}\n"
        f"依赖清单：{PYTHON_DEPENDENCY_MANIFEST.relative_to(PROJECT_ROOT)}\n"
        "请由环境管理步骤安装清单依赖后重试：\n"
        f"{sys.executable} -m pip install -r {PYTHON_DEPENDENCY_MANIFEST}",
        file=sys.stderr,
    )


def main(arguments: list[str] | None = None) -> int:
    """按 all、core 或当前稳定用户运行 unittest，并返回标准进程退出码。"""

    # 默认执行全部 Python 测试；显式参数只允许稳定作用域名称。
    raw_arguments = list(arguments or sys.argv[1:] or ["all"])
    summary_only = "--summary" in raw_arguments
    raw_scope = next((item for item in raw_arguments if not item.startswith("--")), "all")
    # 当前用户既允许使用稳定别名 active-user，也允许传入 AGENTS.md 的实际用户 ID。
    scope = (
        "active-user"
        if raw_scope.lower() in {"active-user", ACTIVE_STABLE_USER_ID.lower()}
        else raw_scope.lower()
    )
    # 未登记作用域立即返回用法错误，禁止悄悄漏跑测试。
    if scope != "all" and scope not in {*TEST_SCOPES, "performance"}:
        print(
            "Usage: python3 apps/ai-desktop/ruleengine/tests/run_tests.py "
            "[all|core|active-user|performance|<current-stable-user-id>] [--summary]"
        )
        return 2
    # all 按 core、当前稳定用户的稳定顺序组合两个发现结果。
    selected_scopes = list(TEST_SCOPES) if scope == "all" else [scope]
    # 当前用户能力依赖外部 Python 包，先给出确定的环境错误，避免测试发现时导入失败。
    if "active-user" in selected_scopes:
        missing_dependencies = missing_runtime_dependencies()
        if missing_dependencies:
            report_missing_runtime_dependencies(missing_dependencies)
            return 3
    # 每个作用域使用独立加载器，避免 unittest 复用首个目录为 top_level_dir 后拒绝相邻作用域。
    # 多个作用域组合为一个套件，最终只输出一份总结果。
    suite = unittest.TestSuite(
        unittest.TestLoader().discover(
            str(TEST_SCOPES["core"] if selected == "performance" else TEST_SCOPES[selected]),
            pattern=TEST_PATTERNS[selected],
        )
        for selected in selected_scopes
    )
    # 摘要模式缓存详细输出；成功只显示统计，失败仍完整返回定位信息。
    details = io.StringIO() if summary_only else sys.stderr
    result = unittest.TextTestRunner(stream=details, verbosity=2).run(suite)
    if summary_only:
        if result.wasSuccessful():
            print(f"OK: scope={scope}, tests={result.testsRun}, failures=0, errors=0")
        else:
            print(details.getvalue(), file=sys.stderr, end="")
    # 全部通过返回 0，否则返回 1 供 CI 和命令调用方阻断。
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    # 脚本直跑时把测试结果转换成标准退出状态。
    raise SystemExit(main())
