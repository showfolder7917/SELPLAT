"""AI 记忆读取技能测试。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


CODE_ROOT = Path(__file__).resolve().parents[1]
MEMORIES_ROOT = CODE_ROOT.parent.parent
SKILL_PATH = CODE_ROOT / "skill" / "read_ai_memory_file.py"
# 固定测试资源属于源码夹具，不在运行时向 MEMORIES/ai 创建临时目录。
AI_READER_FIXTURE = CODE_ROOT / "tests" / "fixtures" / "read_ai_memory_file" / "temp_protocol.md"


def load_skill_module():
    """加载被测技能模块。"""

    spec = importlib.util.spec_from_file_location("read_ai_memory_file", SKILL_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReadAiMemoryFileTests(unittest.TestCase):
    """机器可读清洗规则测试。"""

    def setUp(self) -> None:
        self.module = load_skill_module()

    def test_clean_content_filters_human_readable_lines(self) -> None:
        """应过滤标题、中文说明和列表说明。"""

        raw_content = """
# User Protocol
## 说明
### 规则索引
- 这是用户协作层的协议文件
中文说明行
default_language = zh
code_runtime_reads_registry_in_order
"""
        cleaned = self.module.clean_ai_memory_content(raw_content)
        self.assertEqual(
            cleaned.splitlines(),
            [
                "default_language = zh",
                "code_runtime_reads_registry_in_order",
            ],
        )

    def test_run_reads_ai_file_and_returns_filtered_content(self) -> None:
        """应返回过滤后的 AI 记忆内容。"""

        # 读取仓库内稳定 fixture，运行期不再向 MEMORIES 写入测试数据。
        result = self.module.run(str(AI_READER_FIXTURE))

        # 返回路径保持相对于 MEMORIES 的稳定位置。
        self.assertEqual(result["source_path"], "ai/code/tests/fixtures/read_ai_memory_file/temp_protocol.md")
        self.assertEqual(
            result["cleaned_content"].splitlines(),
            [
                "startup_entry_is_single_minimum_entry = true",
                "ai_calls_ability_only",
            ],
        )
        self.assertEqual(result["line_count"], 2)


if __name__ == "__main__":
    unittest.main()
