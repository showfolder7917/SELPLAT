from pathlib import Path
import tempfile
import unittest

from com.sp.selplat.core.文件读取器 import (
    FileAccessError,
    FileReadError,
    FileReader,
    UnsupportedFileTypeError,
)
from com.sp.selplat.memory.codex.Codex连接池 import CodexConnectionPool, CodexConnectionPools
from com.sp.selplat.memory.model.接口模型 import AgentRegistration
from com.sp.selplat.memory.workspace.工作空间管理器 import WorkspaceManager

PROJECT_ROOT = next(candidate for candidate in Path(__file__).resolve().parents
                    if (candidate / "settings.gradle").is_file())
TEST_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp/ai-factory/测试"


class MemoryRuntimeTest(unittest.TestCase):
    def test_batch_entry_is_http_client_without_server_binding(self) -> None:
        batch_entry = (PROJECT_ROOT / "apps/ai-memory/ai-memory.bat").read_text(encoding="utf-8")
        python_sources = "\n".join(
            source.read_text(encoding="utf-8")
            for source in (PROJECT_ROOT / "apps/ai-memory/src/main/python").rglob("*.py"))

        self.assertIn("ai_memory_entry.py", batch_entry)
        self.assertIn("SELPLAT_PYTHON", batch_entry)
        self.assertNotIn("HTTPServer", python_sources)
        self.assertNotIn("uvicorn.run", python_sources)

    def test_managed_file_reader_supports_markdown_and_blocks_invalid_targets(self) -> None:
        """统一入口正常读取 Markdown，并阻断未知类型、越界路径和缺失文件。"""
        TEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as directory:
            allowed_root = Path(directory) / "允许目录"
            allowed_root.mkdir()
            markdown = allowed_root / "需求.md"
            markdown.write_bytes("# 需求\n".encode("utf-8"))
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
            "apps/ai-memory/src/main/resources/core/IDX_核心总索引.md",
            "apps/ai-memory/src/main/resources/core/启动链/IDX_需求分析启动链.md",
            "apps/ai-memory/src/main/resources/core/启动链/USER.PROTOCOL.md",
            "apps/ai-memory/src/main/resources/core/规则/IDX_核心规则总索引.md",
            "apps/ai-memory/src/main/resources/core/规则/RUL_文件统一读取规则.md",
            "apps/ai-memory/src/main/resources/core/规则/RUL_需求文档与需求要件拆分规则.md",
            "apps/ai-memory/src/main/resources/memory/智能体/AGENT_需求分析师.md",
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

    def test_role_experience_selects_persistent_or_disposable_pool(self) -> None:
        pools = CodexConnectionPools(1, 1)
        experienced = AgentRegistration(
            "EXPERIENCED", "1", "LOCAL_CODEX", "codex://agents/experienced", "1", (), "d",
            experience_level="EXPERIENCED", codex_pool_type="PERSISTENT")
        inexperienced = AgentRegistration(
            "INEXPERIENCED", "1", "LOCAL_CODEX", "codex://agents/inexperienced", "1", (), "d",
            experience_level="INEXPERIENCED", codex_pool_type="DISPOSABLE")

        persistent_first = pools.acquire(experienced, "RUN-PERSISTENT-1", timeout=0.01)
        pools.release(persistent_first)
        persistent_second = pools.acquire(experienced, "RUN-PERSISTENT-2", timeout=0.01)
        pools.release(persistent_second)
        self.assertEqual(persistent_first.connection_id, persistent_second.connection_id)

        disposable_first = pools.acquire(inexperienced, "RUN-DISPOSABLE-1", timeout=0.01)
        pools.release(disposable_first)
        disposable_second = pools.acquire(inexperienced, "RUN-DISPOSABLE-2", timeout=0.01)
        pools.release(disposable_second)
        self.assertNotEqual(disposable_first.connection_id, disposable_second.connection_id)


if __name__ == "__main__":
    unittest.main()
