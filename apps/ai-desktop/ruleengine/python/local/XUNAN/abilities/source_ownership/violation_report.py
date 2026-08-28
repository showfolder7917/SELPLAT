"""统一构造入口兼容的违规报告。"""

from __future__ import annotations

from .models import AuditResult, Violation


def build_audit_result(violations: list[Violation], checked_language_roots: int) -> AuditResult:
    """保持旧入口的字段、违规顺序和阻断状态不变。"""
    return {
        "status": "completed" if not violations else "blocked",
        "checkedLanguageRoots": checked_language_roots,
        "violationCount": len(violations),
        "violations": violations,
    }
