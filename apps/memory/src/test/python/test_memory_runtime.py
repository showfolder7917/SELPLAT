from pathlib import Path
import tempfile
import unittest

from com.sp.selplat.core.文件读取器 import (
    FileAccessError,
    FileReadError,
    FileReader,
    UnsupportedFileTypeError,
)
from com.sp.selplat.memory.codex.Codex连接池 import CodexConnectionPool
from com.sp.selplat.memory.model.接口模型 import AgentRegistration
from com.sp.selplat.memory.workspace.工作空间管理器 import WorkspaceManager

PROJECT_ROOT = next(candidate for candidate in Path(__file__).resolve().parents
                    if (candidate / "settings.gradle").is_file())
TEST_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp/ai-factory/测试"


class MemoryRuntimeTest(unittest.TestCase):
    def test_managed_file_reader_supports_markdown_and_blocks_invalid_targets(self) -> None:
        """统一入口正常读取 Markdown，并阻断未知类型、越界路径和缺失文件。"""
        TEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as directory:
            allowed_root = Path(directory) / "允许目录"
            allowed_root.mkdir()
            markdown = allowed_root / "需求.md"
            markdown.write_text("# 需求\n", encoding="utf-8")
            excel = allowed_root / "需求.xlsx"
            excel.write_bytes(b"not-an-excel-file")
            outside = Path(directory) / "外部.md"
            outside.write_text("# 外部\n", encoding="utf-8")
            reader = FileReader((allowed_root,))

            self.assertEqual("# 需求\n", reader.read_markdown(markdown))
            with self.assertRaises(UnsupportedFileTypeError):
                reader.read_text(excel)
            with self.assertRaises(FileAccessError):
                reader.read_markdown(outside)
            with self.assertRaises(FileReadError):
                reader.read_markdown(allowed_root / "不存在.md")

    def test_requirement_startup_chain_resources_are_readable(self) -> None:
        """需求分析启动链中的协议、索引、规则和 Agent 定义都能由统一入口读取。"""
        reader = FileReader((PROJECT_ROOT,))
        relative_paths = (
            "apps/memory/src/main/resources/core/IDX_核心总索引.md",
            "apps/memory/src/main/resources/core/启动链/IDX_需求分析启动链.md",
            "apps/memory/src/main/resources/core/启动链/USER.PROTOCOL.md",
            "apps/memory/src/main/resources/core/规则/IDX_核心规则总索引.md",
            "apps/memory/src/main/resources/core/规则/RUL_文件统一读取规则.md",
            "apps/memory/src/main/resources/core/规则/RUL_需求文档与需求要件拆分规则.md",
            "apps/memory/src/main/resources/memory/智能体/AGENT_需求分析师.md",
        )
        contents = tuple(reader.read_markdown(PROJECT_ROOT / path) for path in relative_paths)
        self.assertTrue(all(content.strip() for content in contents))
        self.assertIn("一个按钮触发的一次完整业务动作", contents[5])

    def test_task_workspace_contains_all_generated_content(self) -> None:
        TEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as directory:
            workspace = WorkspaceManager(Path(directory)).create("TASK-10001")
            self.assertTrue((workspace.task_root / "审计日志").is_dir())
            with self.assertRaises(ValueError):
                workspace.resolve("../../逃逸")

    def test_codex_connection_is_exclusive_by_run(self) -> None:
        pool = CodexConnectionPool(1)
        registration = AgentRegistration("A", "1", "LOCAL_CODEX", "codex://agents/a", "1", (), "d")
        connection = pool.acquire(registration, "RUN-1", timeout=0.01)
        with self.assertRaises(TimeoutError):
            pool.acquire(registration, "RUN-2", timeout=0.01)
        pool.release(connection)


if __name__ == "__main__":
    unittest.main()
