"""源码归属门禁的稳定数据结构。"""

from __future__ import annotations

from typing import Any, TypedDict


class Violation(TypedDict):
    """描述一条可排序、可序列化的门禁违规。"""

    code: str
    path: str
    message: str


AuditResult = dict[str, Any]
