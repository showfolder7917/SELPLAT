"""能力测试运行目录归属规则测试。"""

from __future__ import annotations

# 导入正则能力，识别会回退系统临时目录或污染工程目录的调用。
import re
# 导入 unittest，使用现有能力测试框架执行路径门禁。
import unittest
# 导入 Path，遍历当前能力测试源码。
from pathlib import Path
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


# 当前测试目录是能力测试运行路径门禁的唯一扫描范围。
TEST_ROOT = Path(__file__).resolve().parent
# 禁止未声明 dir 的 TemporaryDirectory 回退到系统临时目录。
SYSTEM_TEMP_PATTERN = re.compile(r"TemporaryDirectory\(\s*\)")
# 禁止使用不会自动清理的 mkdtemp 创建测试目录。
UNCLEANED_TEMP_PATTERN = re.compile(r"tempfile\.mkdtemp\(")
# 禁止把测试运行目录直接放在 OPTION 根。
OPTION_ROOT_PATTERN = re.compile(r'dir\s*=\s*[^,\n]*OPTION["\']?\s*\)')
# 禁止测试运行时向 MEMORIES 目录创建临时文件。
MEMORIES_RUNTIME_PATTERN = re.compile(r"dir\s*=\s*[^,\n]*MEMORIES")


# 验证全部能力测试只在 OPTION/temp 创建可自动清理的运行数据。
class TestRuntimePathPolicyTests(unittest.TestCase):

    # 扫描测试源码并阻断不合规临时目录调用。
    def test_all_ability_test_temporary_directories_use_option_temp_and_cleanup(self) -> None:
        # 保存每个违规文件及其命中规则。
        violations: list[str] = []
        # 逐个读取能力测试 Python 文件。
        for test_path in sorted(TEST_ROOT.glob("test_*.py")):
            # 当前门禁文件本身包含用于扫描的正则文本，不参与自扫描。
            if test_path == Path(__file__).resolve():
                continue
            # 按 UTF-8 读取完整测试源码。
            source = test_path.read_text(encoding="utf-8")
            # 未指定 dir 的 TemporaryDirectory 会写入系统临时目录。
            if SYSTEM_TEMP_PATTERN.search(source):
                violations.append(f"{test_path.name}: TemporaryDirectory missing OPTION/temp dir")
            # mkdtemp 不具备上下文自动清理能力。
            if UNCLEANED_TEMP_PATTERN.search(source):
                violations.append(f"{test_path.name}: tempfile.mkdtemp is forbidden")
            # OPTION 根不得承接测试运行目录。
            if OPTION_ROOT_PATTERN.search(source):
                violations.append(f"{test_path.name}: runtime directory points to OPTION root")
            # MEMORIES 只能保存稳定 fixture，不能承接运行时临时目录。
            if MEMORIES_RUNTIME_PATTERN.search(source):
                violations.append(f"{test_path.name}: runtime directory points to MEMORIES")
        # 实际结果必须为空列表 → 所有测试运行数据均位于 OPTION/temp 且可自动清理。
        self.assertEqual([], violations)


# 允许直接运行当前路径门禁测试。
if __name__ == "__main__":
    # 启动 unittest 并返回实际违规列表。
    unittest.main()
