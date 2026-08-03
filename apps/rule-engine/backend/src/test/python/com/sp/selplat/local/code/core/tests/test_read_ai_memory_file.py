"""AI 记忆读取技能测试。"""

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
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core"
)
import unittest


CODE_ROOT = MAIN_CODE_ROOT
SKILL_PATH = CODE_ROOT / "skill" / "read_ai_memory_file.py"
# 固定测试资源位于 core 文档示例，不在运行时向不可变 core 创建临时数据。
AI_READER_FIXTURE = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/local/core/docs/code/examples/python-tests/read_ai_memory_file/temp_protocol.md"
)


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

        # 读取 core 内稳定 fixture，运行期不向不可变资源写入测试数据。
        result = self.module.run(str(AI_READER_FIXTURE))

        # 返回路径保持相对于 rule-engine resources 的稳定位置。
        self.assertEqual(
            result["source_path"],
            "local/core/docs/code/examples/python-tests/read_ai_memory_file/temp_protocol.md",
        )
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
