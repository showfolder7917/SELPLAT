"""为源码归属领域单测提供稳定用户解析和模块导入根。"""

from __future__ import annotations

from pathlib import Path
import re
import sys


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1:
    raise RuntimeError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
ABILITY_ROOT = (
    PROJECT_ROOT / "apps/ai-desktop/ruleengine/python/local"
    / ACTIVE_STABLE_USER_ID / "abilities"
)
if str(ABILITY_ROOT) not in sys.path:
    sys.path.insert(0, str(ABILITY_ROOT))
