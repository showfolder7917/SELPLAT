"""提供线程文档共用的 UTF-8 原子读写、文件锁和版本摘要。"""

from __future__ import annotations

from contextlib import contextmanager
import hashlib
import os
from pathlib import Path
import re
import time
from typing import Iterator


线程环境变量 = "CODEX_THREAD_ID"
默认线程标识 = "local"
安全线程格式 = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class 文档存储:
    """封装执行文档和测试文档共享的磁盘操作。"""

    @staticmethod
    def 解析线程标识(上下文: dict) -> str:
        """优先使用调用参数，其次读取会话环境并过滤不安全文件名。"""

        候选 = str(上下文.get("thread_id") or os.environ.get(线程环境变量) or "").strip()
        return 候选 if 安全线程格式.fullmatch(候选) else 默认线程标识

    @staticmethod
    def 读取(路径: Path) -> str:
        """以 UTF-8 读取文档，不存在时返回空文本。"""

        return 路径.read_text(encoding="utf-8").strip() if 路径.exists() else ""

    @staticmethod
    def 写入(路径: Path, 正文: str) -> None:
        """在同目录写入临时副本后原子替换目标文档。"""

        路径.parent.mkdir(parents=True, exist_ok=True)
        临时路径 = 路径.with_name(f".{路径.name}.{os.getpid()}.tmp")
        临时路径.write_text(f"{正文.strip()}\n", encoding="utf-8")
        临时路径.replace(路径)

    @staticmethod
    def 版本(正文: str) -> str:
        """返回正文的稳定 SHA-1 版本标识。"""

        return hashlib.sha1(正文.encode("utf-8")).hexdigest()

    @staticmethod
    @contextmanager
    def 加锁(锁路径: Path, 超时秒数: float = 10.0) -> Iterator[None]:
        """使用当前线程专属锁文件串行修改同一份文档。"""

        锁路径.parent.mkdir(parents=True, exist_ok=True)
        截止时间 = time.monotonic() + 超时秒数
        文件描述符: int | None = None
        while 文件描述符 is None:
            try:
                文件描述符 = os.open(str(锁路径), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except FileExistsError:
                if time.monotonic() >= 截止时间:
                    raise TimeoutError(f"文档锁超时：{锁路径}")
                time.sleep(0.05)
        try:
            yield
        finally:
            os.close(文件描述符)
            try:
                锁路径.unlink()
            except FileNotFoundError:
                pass

    @classmethod
    def 读取稳定快照(
        cls,
        文档路径: Path,
        锁路径: Path,
        最长等待秒数: float = 1.2,
        稳定秒数: float = 0.08,
    ) -> str:
        """等待并发写入结束后返回连续稳定的最新正文。"""

        截止时间 = time.monotonic() + 最长等待秒数
        上次版本 = ""
        稳定起点 = 0.0
        最新正文 = ""
        while True:
            最新正文 = cls.读取(文档路径)
            当前版本 = cls.版本(最新正文)
            if not 锁路径.exists():
                if 当前版本 == 上次版本:
                    稳定起点 = 稳定起点 or time.monotonic()
                    if time.monotonic() - 稳定起点 >= 稳定秒数:
                        return 最新正文
                else:
                    稳定起点 = time.monotonic()
            else:
                稳定起点 = 0.0
            上次版本 = 当前版本
            if time.monotonic() >= 截止时间:
                return 最新正文
            time.sleep(0.02)
