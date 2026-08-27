"""记忆库完整读取技能测试。"""

from __future__ import annotations

import importlib.util
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
    / "apps/ai-desktop/ruleengine/python/local/core"
)
import tempfile
import unittest


CODE_ROOT = MAIN_CODE_ROOT
WORKSPACE_ROOT = PROJECT_ROOT
UTIL_PATH = CODE_ROOT / "util" / "full_file_reader.py"
# 固定完整读取夹具保存在 Python test source set，运行时不修改源码。
MEMORY_READER_FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures/read_memory_file_full/temp_note.md"
)
# 所有工程侧运行测试数据统一进入当前工程 OPTION/temp。
OPTION_TEMP_ROOT = WORKSPACE_ROOT / "OPTION" / "temp"


def load_util_module():
    """加载被测 util 模块。"""

    spec = importlib.util.spec_from_file_location("full_file_reader", UTIL_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReadMemoryFileFullTests(unittest.TestCase):
    """完整原文读取规则测试。"""

    def setUp(self) -> None:
        self.module = load_util_module()

    def test_run_keeps_comments_chinese_and_blank_lines(self) -> None:
        """应保留中文、注释和空行，不做清洗。"""

        # 从 test source set 稳定 fixture 读取期待原文，测试运行不污染源码。
        raw_content = MEMORY_READER_FIXTURE.read_text(encoding="utf-8")
        # 使用真实完整读取技能读取同一 fixture。
        result = self.module.run(str(MEMORY_READER_FIXTURE))

        # 返回路径保持相对于当前工程根的稳定位置。
        self.assertEqual(
            result["source_path"],
            "apps/ai-desktop/ruleengine/tests/local/core/fixtures/read_memory_file_full/temp_note.md",
        )
        self.assertEqual(result["content"], raw_content)
        self.assertEqual(result["line_count"], 5)

    def test_run_reads_project_file_outside_memories(self) -> None:
        """应允许读取工程目录内任意经过边界校验的文件。"""

        # 确保统一测试运行目录存在。
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # 自动清理的临时目录固定进入 OPTION/temp。
        with tempfile.TemporaryDirectory(prefix="project_full_reader_", dir=OPTION_TEMP_ROOT) as temp_dir_name:
            # 当前 Case 的真实工程文件位于统一临时目录。
            temp_dir = Path(temp_dir_name)
            # 创建待读取文本。
            target = temp_dir / "sample.txt"
            # 原文包含空行和注释，用于验证完整读取。
            raw_content = "第一行\n\n<!-- 注释 -->\n第三行"
            # 按 UTF-8 写入当前测试输入。
            target.write_text(raw_content, encoding="utf-8")

            # 调用真实完整读取技能。
            result = self.module.run(str(target))

            # 返回路径必须明确位于 OPTION/temp。
            self.assertEqual(result["source_path"], f"OPTION/temp/{temp_dir.name}/sample.txt")
            # 完整原文必须保持不变。
            self.assertEqual(result["content"], raw_content)
            # 原文行数必须保留空行后的实际四行。
            self.assertEqual(result["line_count"], 4)
        # 上下文结束后临时目录必须自动删除。
        self.assertFalse(temp_dir.exists())


if __name__ == "__main__":
    unittest.main()
