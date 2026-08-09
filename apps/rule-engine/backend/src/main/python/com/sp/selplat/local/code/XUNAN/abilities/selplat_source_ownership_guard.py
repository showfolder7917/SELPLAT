#!/usr/bin/env python3
"""Audit SELPLAT production source languages and ownership boundaries."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from typing import Any


PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
LANGUAGE_ROOT_NAMES = {"java", "python", "node", "swift", "kotlin", "go", "rust"}
RULE_ENGINE_MODULE = Path("apps/rule-engine/backend")
RULE_ENGINE_LANGUAGES = {"java", "python", "node"}
LANGUAGE_EXTENSIONS = {
    "java": {".java"},
    "python": {".py"},
    "node": {".js", ".mjs", ".cjs", ".ts"},
}
FORBIDDEN_APPLICATION_PROTOCOL_SUFFIXES = ("Request", "Response", "Result", "Page", "Param")


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


def registered_languages(project_root: Path, module_root: Path) -> set[str]:
    """Return languages explicitly owned by one Gradle module."""
    relative_module = module_root.relative_to(project_root)
    if relative_module == RULE_ENGINE_MODULE:
        return set(RULE_ENGINE_LANGUAGES)
    if (module_root / "build.gradle").is_file() or (module_root / "build.gradle.kts").is_file():
        return {"java"}
    return set()


def audit_source_ownership(project_root: Path = PROJECT_ROOT) -> dict[str, Any]:
    """Report unregistered language roots, misplaced rule abilities, and source pollution."""
    project_root = project_root.resolve()
    stable_user_id = active_stable_user_id(project_root)
    violations: list[dict[str, str]] = []
    checked_language_roots = 0

    for area_name in ("apps", "shared"):
        area_root = project_root / area_name
        if not area_root.exists():
            continue
        for source_main in sorted(path for path in area_root.rglob("src/main") if path.is_dir()):
            module_root = source_main.parent.parent
            allowed = registered_languages(project_root, module_root)
            for language_root in sorted(path for path in source_main.iterdir() if path.is_dir()):
                language = language_root.name
                if language not in LANGUAGE_ROOT_NAMES:
                    continue
                checked_language_roots += 1
                relative_language_root = language_root.relative_to(project_root)
                if language not in allowed:
                    violations.append({
                        "code": "UNREGISTERED_LANGUAGE_ROOT",
                        "path": str(relative_language_root),
                        "message": f"{module_root.relative_to(project_root)} does not register {language}",
                    })
                    continue
                if module_root.relative_to(project_root) == RULE_ENGINE_MODULE:
                    owned_root = (
                        language_root / "com/sp/selplat/local/code"
                    )
                    allowed_layers = {"core", "common", stable_user_id}
                    for source_file in sorted(path for path in language_root.rglob("*") if path.is_file()):
                        relative_source = source_file.relative_to(project_root)
                        if not source_file.is_relative_to(owned_root):
                            violations.append({
                                "code": "RULE_ENGINE_SOURCE_OUTSIDE_LAYER_ROOT",
                                "path": str(relative_source),
                                "message": "rule-engine source must be below local/code/<layer>",
                            })
                            continue
                        layer_relative = source_file.relative_to(owned_root)
                        if not layer_relative.parts or layer_relative.parts[0] not in allowed_layers:
                            violations.append({
                                "code": "RULE_ENGINE_SOURCE_UNKNOWN_LAYER",
                                "path": str(relative_source),
                                "message": "layer must be core, common, or the active stable user",
                            })
                        allowed_extensions = LANGUAGE_EXTENSIONS.get(language, set())
                        if source_file.suffix not in allowed_extensions:
                            violations.append({
                                "code": "LANGUAGE_ROOT_FOREIGN_FILE",
                                "path": str(relative_source),
                                "message": f"unexpected file in {language} source root",
                            })

    for area_name in ("apps", "shared"):
        area_root = project_root / area_name
        if not area_root.exists():
            continue
        pollution_paths = sorted({
            *area_root.rglob("__pycache__"),
            *area_root.rglob("*.pyc"),
            *area_root.rglob(".DS_Store"),
        })
        for pollution_path in pollution_paths:
            if "src" not in pollution_path.parts:
                continue
            violations.append({
                "code": "SOURCE_TREE_GENERATED_OR_OS_FILE",
                "path": str(pollution_path.relative_to(project_root)),
                "message": "generated cache or OS metadata is forbidden in source trees",
            })

    apps_root = project_root / "apps"
    if apps_root.exists():
        for java_file in sorted(apps_root.rglob("*.java")):
            relative_source = java_file.relative_to(project_root)
            if "src" not in relative_source.parts or "main" not in relative_source.parts:
                continue
            if java_file.stem.endswith(FORBIDDEN_APPLICATION_PROTOCOL_SUFFIXES):
                violations.append({
                    "code": "APPLICATION_PRIVATE_COMMON_PROTOCOL_TYPE",
                    "path": str(relative_source),
                    "message": (
                        "application HTTP input/output must reuse shared CommonParam, "
                        "CommonBatchParam, CommonPageParam, CommonResult, or common page results"
                    ),
                })

    return {
        "status": "completed" if not violations else "blocked",
        "checkedLanguageRoots": checked_language_roots,
        "violationCount": len(violations),
        "violations": violations,
    }


def main() -> int:
    """Print the audit result and return a blocking exit code on any violation."""
    result = audit_source_ownership()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["violationCount"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
