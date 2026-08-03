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
# 直接使用真实 STARTER 协议验证读取能力，避免在生产 core 中保留测试专用样本。
AI_READER_FIXTURE = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/local/core/protocol/STARTER_PROTOCOL.md"
)
# 唯一根索引是 core 读取器允许访问的唯一 core 外资源。
ROOT_RULE_INDEX = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/RULE_INDEX.md"
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
rule_path = local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md
code_runtime_reads_registry_in_order
"""
        cleaned = self.module.clean_ai_memory_content(raw_content)
        self.assertEqual(
            cleaned.splitlines(),
            [
                "default_language = zh",
                "rule_path = local/XUNAN/跨工程通用规则/RUL_用户明确委托AI修正规则.md",
                "code_runtime_reads_registry_in_order",
            ],
        )

    def test_run_reads_ai_file_and_returns_filtered_content(self) -> None:
        """应返回过滤后的 AI 记忆内容。"""

        # 读取 core 内真实协议，运行期不创建测试数据。
        result = self.module.run(str(AI_READER_FIXTURE))

        # 返回路径保持相对于 rule-engine resources 的稳定位置。
        self.assertEqual(
            result["source_path"],
            "local/core/protocol/STARTER_PROTOCOL.md",
        )
        self.assertIn(
            "startup_entry_is_single_minimum_entry = true",
            result["cleaned_content"].splitlines(),
        )
        self.assertGreater(result["line_count"], 2)

    def test_run_allows_unique_root_rule_index(self) -> None:
        """应允许启动链读取唯一根索引，而不需要 protocol 内兼容副本。"""

        result = self.module.run(str(ROOT_RULE_INDEX))

        self.assertEqual(result["source_path"], "RULE_INDEX.md")
        self.assertIn(
            "COMMON_RULE_INDEX = local/common/RULE_INDEX.md",
            result["cleaned_content"].splitlines(),
        )


if __name__ == "__main__":
    unittest.main()
