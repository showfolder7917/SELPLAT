"""SELPLAT 临时路径收敛规则测试。"""

from __future__ import annotations

import ast
import importlib.util
from pathlib import Path
import unittest


# 测试从真实代码树推导 SELPLAT 根，禁止用机器相关绝对路径替代工程结构。
CODE_ROOT = Path(__file__).resolve().parents[1]
SELPLAT_ROOT = Path(__file__).resolve().parents[4]
# 所有受检入口必须把短期产物归入当前 SELPLAT 的 OPTION/temp。
OPTION_TEMP_ROOT = SELPLAT_ROOT / "OPTION" / "temp"
# 三个转码技能共享同一进度日志归属规则，逐一验证可防止单个入口回退系统目录。
FFMPEG_SKILL_PATHS = [
    CODE_ROOT / "skill" / "ffmpeg_mp4_to_wav.py",
    CODE_ROOT / "skill" / "ffmpeg_vob_to_mp3.py",
    CODE_ROOT / "skill" / "ffmpeg_vob_to_mp4.py",
]


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

    def test_ffmpeg_progress_roots_use_selplat_option_temp(self) -> None:
        """三个 ffmpeg 技能的进度日志必须进入统一临时根。"""

        # 分别加载每个技能，避免一个正确常量掩盖其他技能的路径回退。
        for index, skill_path in enumerate(FFMPEG_SKILL_PATHS):
            module = load_module(skill_path, f"temp_policy_ffmpeg_{index}")
            # 进度日志允许使用业务子目录，但必须直属统一 OPTION/temp 管辖范围。
            self.assertTrue(module.FFMPEG_TEMP_ROOT.is_relative_to(OPTION_TEMP_ROOT))

    def test_all_tempfile_calls_declare_owned_directory(self) -> None:
        """代码树内 tempfile 创建调用必须显式声明 dir 参数。"""

        # 扫描正式能力、技能和测试入口，确保新增 tempfile 调用也受同一回归门保护。
        python_files = sorted(
            path
            for area in ("abilities", "skill", "tests")
            for path in (CODE_ROOT / area).glob("*.py")
        )
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


if __name__ == "__main__":
    # 保留文件直跑入口，与现有无 package 的 tests 目录执行方式一致。
    unittest.main()
