"""由本地 Python 生成任务级哈希链审计事实。"""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from threading import Lock
from typing import Any

from com.sp.selplat.core.文件读取器 import FileReader


class AuditLogger:
    def __init__(self, task_root: Path) -> None:
        self.path = task_root / "审计日志/审计事件.jsonl"
        self._lock = Lock()
        self._previous_hash = "GENESIS"
        if self.path.is_file():
            # 历史审计事实也必须经过统一读取入口，避免常驻进程形成旁路读取。
            lines = [line for line in FileReader((task_root,)).read_text(self.path).splitlines() if line]
            if lines:
                self._previous_hash = str(json.loads(lines[-1])["eventHash"])

    def append(self, action: str, facts: dict[str, Any]) -> dict[str, Any]:
        """追加脱敏事实并返回带 previousHash/eventHash 的事件。"""
        with self._lock:
            body = {
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "action": action,
                "facts": facts,
                "previousHash": self._previous_hash,
            }
            canonical = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            body["eventHash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8", newline="\n") as stream:
                stream.write(json.dumps(body, ensure_ascii=False, sort_keys=True) + "\n")
            self._previous_hash = body["eventHash"]
            return body
