"""解析模块显式登记的程序语言与真实生命周期入口。"""

from __future__ import annotations

import json
from pathlib import Path

from .path_classifier import MANAGED_DATABASE_REGISTRY_RELATIVE, active_stable_user_id


LANGUAGE_ROOT_NAMES = {"java", "python", "node", "swift", "kotlin", "go", "rust"}
RULE_ENGINE_MODULE = Path("apps/ai-desktop/ruleengine")
RULE_ENGINE_LANGUAGES = {"java", "python", "node"}
PROGRAM_LANGUAGE_REGISTRY_NAME = "program-language-applications.json"


def registered_languages(project_root: Path, module_root: Path) -> set[str]:
    """Return languages explicitly owned by one Gradle module."""
    relative_module = module_root.relative_to(project_root)
    if relative_module == RULE_ENGINE_MODULE:
        return set(RULE_ENGINE_LANGUAGES)
    # 非 Gradle 应用必须通过当前用户中央登记同时声明语言与真实运行、测试入口。
    stable_user_id = active_stable_user_id(project_root)
    registry_path = (
        project_root / MANAGED_DATABASE_REGISTRY_RELATIVE / stable_user_id
        / "selplat/通用/registry" / PROGRAM_LANGUAGE_REGISTRY_NAME
    )
    if registry_path.is_file() and relative_module.parent == Path("apps"):
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        matches = [
            item for item in registry.get("applications", [])
            if item.get("projectName") == module_root.name
        ]
        if len(matches) == 1:
            registration = matches[0]
            required_entries = (
                registration.get("buildEntry"),
                registration.get("runtimeEntry"),
                registration.get("testEntry"),
                registration.get("lifecycleOwner"),
            )
            # 登记只有在四类入口均位于工程内且真实存在时才授予语言所有权。
            if all(
                isinstance(entry, str)
                and entry.strip()
                and (project_root / entry).exists()
                for entry in required_entries
            ):
                languages = registration.get("languages", [])
                if isinstance(languages, list) and all(
                        language in LANGUAGE_ROOT_NAMES for language in languages):
                    return set(languages)
    if (module_root / "build.gradle").is_file() or (module_root / "build.gradle.kts").is_file():
        return {"java"}
    return set()
