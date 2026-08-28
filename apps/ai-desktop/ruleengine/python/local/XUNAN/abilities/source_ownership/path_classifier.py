"""识别稳定用户和中央登记路径，不扫描目录猜测身份。"""

from __future__ import annotations

from pathlib import Path
import re


MANAGED_DATABASE_REGISTRY_RELATIVE = Path("apps/ai-desktop/ruleengine/rules/local")


def active_stable_user_id(project_root: Path) -> str:
    """Read the one stable user ID from the project authority file."""
    matches = re.findall(
        r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
        (project_root / "AGENTS.md").read_text(encoding="utf-8"),
    )
    if len(matches) != 1 or not re.fullmatch(
            r"[A-Za-z][A-Za-z0-9_-]{0,63}", matches[0].strip()):
        raise RuntimeError("AGENTS.md must declare exactly one safe stable user ID")
    return matches[0].strip()


def managed_database_registry_path(project_root: Path, stable_user_id: str) -> Path:
    """Return the current user's one central managed-database application registry."""
    return (
        project_root / MANAGED_DATABASE_REGISTRY_RELATIVE / stable_user_id
        / "selplat/通用/registry/managed-database-applications.json"
    )
