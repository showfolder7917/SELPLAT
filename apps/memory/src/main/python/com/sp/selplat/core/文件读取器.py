"""为 memory 启动链、Agent 和业务模块提供唯一的本地文件读取入口。"""

from pathlib import Path
from typing import Iterable


TEXT_SUFFIXES = frozenset({
    ".csv", ".java", ".js", ".json", ".jsonl", ".md", ".properties",
    ".py", ".sql", ".toml", ".ts", ".txt", ".vue", ".yaml", ".yml",
})


class FileReadError(RuntimeError):
    """读取受管文件失败。"""


class FileAccessError(FileReadError):
    """文件不属于允许读取的目录。"""


class UnsupportedFileTypeError(FileReadError):
    """文件类型尚未登记对应读取能力。"""


class FileReader:
    """在明确允许的目录内统一读取受管文件。"""

    def __init__(self, allowed_roots: Iterable[Path], max_bytes: int = 8 * 1024 * 1024) -> None:
        roots = tuple(Path(root).resolve() for root in allowed_roots)
        if not roots:
            raise ValueError("至少需要一个允许读取的目录")
        if max_bytes < 1:
            raise ValueError("max_bytes 必须大于 0")
        self.allowed_roots = roots
        self.max_bytes = max_bytes

    def read_text(self, path: Path) -> str:
        """读取已登记的 UTF-8 文本类型，未知类型必须等待新增专用 Reader。"""
        target = self.resolve_file(path)
        if target.suffix.lower() not in TEXT_SUFFIXES:
            raise UnsupportedFileTypeError(f"尚未支持的文本文件类型: {target.suffix or '<无扩展名>'}")
        try:
            return self._read_bytes(target).decode("utf-8")
        except UnicodeDecodeError as error:
            raise FileReadError(f"文件不是有效 UTF-8: {target}") from error

    def read_markdown(self, path: Path) -> str:
        """读取启动协议、规则、索引、Agent 定义或其他 Markdown 文档。"""
        target = self.resolve_file(path)
        if target.suffix.lower() != ".md":
            raise UnsupportedFileTypeError(f"Markdown Reader 不支持: {target.suffix or '<无扩展名>'}")
        try:
            return self._read_bytes(target).decode("utf-8")
        except UnicodeDecodeError as error:
            raise FileReadError(f"Markdown 不是有效 UTF-8: {target}") from error

    def read_bytes(self, path: Path) -> bytes:
        """为摘要、Gate 等无需解析业务内容的场景读取原始字节。"""
        return self._read_bytes(self.resolve_file(path))

    def resolve_file(self, path: Path) -> Path:
        """解析真实文件并阻断不存在、目录目标、符号链接和跨允许根访问。"""
        source = Path(path)
        try:
            target = source.resolve(strict=True)
        except FileNotFoundError as error:
            raise FileReadError(f"文件不存在: {source}") from error
        if source.is_symlink():
            raise FileAccessError(f"禁止通过符号链接读取受管文件: {source}")
        if not target.is_file():
            raise FileReadError(f"读取目标不是文件: {source}")
        if not any(target == root or root in target.parents for root in self.allowed_roots):
            raise FileAccessError(f"文件不属于允许读取目录: {source}")
        return target

    def _read_bytes(self, target: Path) -> bytes:
        """限制单文件大小后一次读取，防止错误输入占满常驻进程内存。"""
        size = target.stat().st_size
        if size > self.max_bytes:
            raise FileReadError(f"文件超过读取上限 {self.max_bytes} 字节: {target}")
        try:
            with target.open("rb") as stream:
                return stream.read()
        except OSError as error:
            raise FileReadError(f"读取文件失败: {target}") from error

