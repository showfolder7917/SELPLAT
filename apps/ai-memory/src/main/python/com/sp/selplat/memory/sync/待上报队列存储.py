"""SQLite outbox 保存尚未被服务端确认的本地事实。"""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
from typing import Any


class OutboxStore:
    def __init__(self, database: Path) -> None:
        database.parent.mkdir(parents=True, exist_ok=True)
        self.database = database
        with self._connect() as connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS local_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, event_type TEXT NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, payload_digest TEXT NOT NULL,
                state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, server_receipt_json TEXT,
                created_at TEXT NOT NULL, confirmed_at TEXT)""")

    def append(self, task_id: str, event_type: str, payload: dict[str, Any], key: str) -> int:
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        with self._connect() as connection:
            cursor = connection.execute(
                "INSERT INTO local_outbox(task_id,event_type,idempotency_key,payload_json,payload_digest,state,created_at) VALUES(?,?,?,?,?,'PENDING',?)",
                (task_id, event_type, key, canonical, digest, datetime.now(timezone.utc).isoformat()),
            )
            return int(cursor.lastrowid)

    def pending(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            return [dict(row) for row in connection.execute(
                "SELECT * FROM local_outbox WHERE state='PENDING' ORDER BY id LIMIT ?", (limit,))]

    def confirm(self, record_id: int, receipt: dict[str, Any]) -> None:
        with self._connect() as connection:
            connection.execute("UPDATE local_outbox SET state='CONFIRMED',server_receipt_json=?,confirmed_at=? WHERE id=?",
                               (json.dumps(receipt, ensure_ascii=False), datetime.now(timezone.utc).isoformat(), record_id))

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database)
