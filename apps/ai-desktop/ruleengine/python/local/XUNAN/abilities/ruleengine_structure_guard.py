#!/usr/bin/env python3
"""报告并可严格阻断 rule-engine 结构、索引和 history 解耦违规。"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
from typing import Any


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 任何后续导入都必须先使用工程缓存，禁止源码树重新出现字节码目录。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)
# Windows 日文代码页也必须稳定输出完整中文 JSON，避免报告阶段因编码中断。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ABILITY_ID = "ruleengine_structure_guard"
ABILITY_NAME = "规则引擎结构与解耦门禁"
RULEENGINE_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine"
RULE_ROOT = RULEENGINE_ROOT / "rules"
ROOT_INDEX = Path("RULE_INDEX.md")
LOGICAL_ID_PATTERN = re.compile(r"[A-Z][A-Z0-9_]{1,127}")
ASSIGNMENT_PATTERN = re.compile(r"^([A-Za-z][A-Za-z0-9_.-]*)\s*=\s*(.+)$")
WINDOWS_ABSOLUTE_PATTERN = re.compile(r"(?i)(?:^|[=\s`'\"])([A-Z]:[\\/][^\s`'\"]+)")
MACOS_ABSOLUTE_PATTERN = re.compile(r"(?:^|[=\s`'\"])(/Users/[^\s`'\"]+)")
INDEX_LINE_ADVISORY_LIMIT = 150
INDEX_TRIGGER_ADVISORY_LIMIT = 40
RULE_LINE_ADVISORY_LIMIT = 400


def active_stable_user_id(project_root: Path) -> str:
    """只从工程权威文件读取唯一安全的稳定用户 ID。"""
    matches = re.findall(
        r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
        (project_root / "apps/ai-desktop/ruleengine/AGENTS.md").read_text(encoding="utf-8"),
    )
    if len(matches) != 1 or not re.fullmatch(
            r"[A-Za-z][A-Za-z0-9_-]{0,63}", matches[0].strip()):
        raise RuntimeError("AGENTS.md must declare exactly one safe stable user ID")
    return matches[0].strip()


def parse_assignments(text: str) -> list[tuple[str, str, int]]:
    """解析稳定 DSL，并保留原始声明顺序和行号。"""
    assignments: list[tuple[str, str, int]] = []
    for line_number, raw_line in enumerate(text.splitlines(), 1):
        match = ASSIGNMENT_PATTERN.match(raw_line.strip())
        if match:
            assignments.append((match.group(1), match.group(2).strip(), line_number))
    return assignments


def safe_rule_path(relative_path: str) -> Path | None:
    """只解析规则资源根内的正向相对路径。"""
    candidate = (RULE_ROOT / relative_path).resolve()
    return candidate if candidate.is_relative_to(RULE_ROOT.resolve()) else None


def audit_ruleengine_structure(project_root: Path = PROJECT_ROOT) -> dict[str, Any]:
    """生成不读取 history 的结构报告；严格模式由 CLI 根据硬违规决定退出码。"""
    project_root = project_root.resolve()
    ruleengine_root = project_root / "apps/ai-desktop/ruleengine"
    rule_root = ruleengine_root / "rules"
    stable_user_id = active_stable_user_id(project_root)
    hard_violations: list[dict[str, Any]] = []
    advisories: list[dict[str, Any]] = []
    visited_indexes: dict[str, list[tuple[str, str, int]]] = {}
    rule_registrations: dict[str, dict[str, Any]] = {}
    logical_id_locations: dict[str, list[dict[str, Any]]] = {}
    trigger_records: list[dict[str, Any]] = []

    def add_hard(code: str, path: str, message: str) -> None:
        hard_violations.append({"code": code, "path": path, "message": message})

    def walk_index(relative_index: str) -> None:
        if relative_index in visited_indexes:
            return
        index_path = (rule_root / relative_index).resolve()
        if not index_path.is_relative_to(rule_root.resolve()):
            add_hard("RULE_INDEX_PATH_ESCAPE", relative_index, "index path escapes the rule resource root")
            return
        if not index_path.is_file():
            add_hard("RULE_INDEX_PATH_MISSING", relative_index, "registered child index does not exist")
            return
        text = index_path.read_text(encoding="utf-8")
        assignments = parse_assignments(text)
        visited_indexes[relative_index] = assignments
        trigger_count = sum(
            1 for key, _, _ in assignments
            if key.startswith("load_rule_for_") or key.endswith("_trigger")
        )
        line_count = len(text.splitlines())
        if line_count > INDEX_LINE_ADVISORY_LIMIT or trigger_count > INDEX_TRIGGER_ADVISORY_LIMIT:
            advisories.append({
                "code": "RULE_INDEX_SIZE_ADVISORY",
                "path": relative_index,
                "message": f"lines={line_count}, triggers={trigger_count}",
            })
        for key, raw_value, line_number in assignments:
            value = raw_value.replace("<stable-user-id>", stable_user_id)
            if key == "USER_RULE_INDEX_PATTERN":
                walk_index(value)
                continue
            if LOGICAL_ID_PATTERN.fullmatch(key):
                if value.endswith("/RULE_INDEX.md"):
                    if "history/" in value.replace("\\", "/"):
                        add_hard("PRODUCTION_INDEX_HISTORY_DEPENDENCY", relative_index, f"line {line_number} points to history")
                    walk_index(value)
                elif value.endswith(".md"):
                    location = {"index": relative_index, "line": line_number, "resourcePath": value}
                    logical_id_locations.setdefault(key, []).append(location)
                    rule_path = (rule_root / value).resolve()
                    if not rule_path.is_relative_to(rule_root.resolve()):
                        add_hard("RULE_RESOURCE_PATH_ESCAPE", relative_index, f"{key} escapes the rule root")
                    elif not rule_path.is_file():
                        add_hard("RULE_RESOURCE_PATH_MISSING", relative_index, f"{key} points to missing {value}")
                    else:
                        rule_registrations[key] = location
            elif key.startswith("load_rule_for_") or key.endswith("_trigger"):
                trigger_records.append({
                    "key": key,
                    "value": value,
                    "index": relative_index,
                    "line": line_number,
                })

    walk_index(str(ROOT_INDEX).replace("\\", "/"))

    for logical_id, locations in logical_id_locations.items():
        if len(locations) > 1:
            add_hard(
                "DUPLICATE_RULE_LOGICAL_ID",
                locations[0]["index"],
                f"{logical_id} is registered {len(locations)} times",
            )
    known_ids = set(rule_registrations)
    for trigger in trigger_records:
        for referenced_id in (part.strip() for part in trigger["value"].split(",")):
            if referenced_id and referenced_id not in known_ids:
                add_hard(
                    "RULE_TRIGGER_UNKNOWN_LOGICAL_ID",
                    trigger["index"],
                    f"{trigger['key']} references unknown {referenced_id}",
                )

    indexed_paths = {record["resourcePath"] for record in rule_registrations.values()}
    rule_metrics: list[dict[str, Any]] = []
    for logical_id, registration in sorted(rule_registrations.items()):
        relative_rule = registration["resourcePath"]
        rule_path = rule_root / relative_rule
        text = rule_path.read_text(encoding="utf-8")
        assignments = parse_assignments(text)
        requires = [
            value for key, value, _ in assignments if key == "requires_rule_ids"
        ]
        for dependency_list in requires:
            for dependency_id in (part.strip() for part in dependency_list.split(",")):
                if dependency_id not in known_ids:
                    add_hard(
                        "RULE_DEPENDENCY_UNKNOWN_LOGICAL_ID",
                        relative_rule,
                        f"{logical_id} requires unknown {dependency_id}",
                    )
        history_records = sum(1 for key, _, _ in assignments if "upgrade_record" in key)
        if history_records:
            add_hard(
                "ACTIVE_RULE_UPGRADE_HISTORY_FORBIDDEN",
                relative_rule,
                f"active rule contains {history_records} upgrade history records",
            )
        line_count = len(text.splitlines())
        if line_count > RULE_LINE_ADVISORY_LIMIT:
            advisories.append({
                "code": "RULE_SIZE_ADVISORY",
                "path": relative_rule,
                "message": f"lines={line_count}, dsl={len(assignments)}",
            })
        for key, value, line_number in assignments:
            normalized = value.replace("\\", "/")
            if key == "requires_rule_ids" and "history/" in normalized:
                add_hard("RULE_HISTORY_DEPENDENCY", relative_rule, f"line {line_number} requires history")
            if key.endswith("ability_refs") or re.match(r"^(?:java|python|node)_ability_refs\.\d+$", key):
                if "history/" in normalized:
                    add_hard("ABILITY_HISTORY_DEPENDENCY", relative_rule, f"line {line_number} points to history")
            if relative_rule.startswith("local/") and not relative_rule.startswith(
                    ("local/core/", "local/common/", f"local/{stable_user_id}/")):
                add_hard("CROSS_USER_RULE_REFERENCE", relative_rule, f"{logical_id} belongs to another user")
        rule_metrics.append({
            "logicalId": logical_id,
            "resourcePath": relative_rule,
            "lineCount": line_count,
            "dslCount": len(assignments),
            "dependencyCount": sum(len(value.split(",")) for value in requires),
        })

    for candidate in sorted((rule_root / "local").rglob("*.md")):
        relative = candidate.relative_to(rule_root).as_posix()
        if candidate.name == "RULE_INDEX.md" or "template" in candidate.parts or "protocol" in candidate.parts:
            continue
        if candidate.parent.name != "rule" and not candidate.name.startswith("RUL_"):
            continue
        if relative not in indexed_paths:
            add_hard("UNINDEXED_ACTIVE_RULE", relative, "active rule file is not reachable from the root index")

    legacy_active_user = rule_root / "active-user"
    if legacy_active_user.exists():
        add_hard("LEGACY_ACTIVE_USER_DIRECTORY", legacy_active_user.relative_to(project_root).as_posix(), "physical active-user directory is forbidden")
    for pollution in sorted({*ruleengine_root.rglob("__pycache__"), *ruleengine_root.rglob("*.pyc")}):
        if "history" in pollution.parts:
            continue
        add_hard("RULEENGINE_SOURCE_CACHE", pollution.relative_to(project_root).as_posix(), "generated Python cache is forbidden in rule-engine source")

    machine_absolute_hits: list[dict[str, Any]] = []
    for candidate in [
            *(rule_root / "local" / stable_user_id).rglob("*.md"),
            *(ruleengine_root / "python/local" / stable_user_id).rglob("*.py")]:
        if not candidate.is_file():
            continue
        for line_number, line in enumerate(candidate.read_text(encoding="utf-8").splitlines(), 1):
            # Windows、macOS 与 Linux 的标准系统字体候选是跨平台兼容清单，不是机器用户路径。
            normalized_line = line.replace("\\", "/")
            if "C:/Windows/Fonts/" in normalized_line:
                continue
            if WINDOWS_ABSOLUTE_PATTERN.search(line) or MACOS_ABSOLUTE_PATTERN.search(line):
                machine_absolute_hits.append({
                    "path": candidate.relative_to(project_root).as_posix(),
                    "line": line_number,
                })
    if machine_absolute_hits:
        advisories.append({
            "code": "MACHINE_ABSOLUTE_PATH_ADVISORY",
            "path": "ruleengine",
            "message": f"hits={len(machine_absolute_hits)}",
        })

    index_metrics = [
        {
            "resourcePath": index_path,
            "lineCount": len((rule_root / index_path).read_text(encoding="utf-8").splitlines()),
            "triggerCount": sum(
                1 for key, _, _ in assignments
                if key.startswith("load_rule_for_") or key.endswith("_trigger")
            ),
        }
        for index_path, assignments in sorted(visited_indexes.items())
    ]
    return {
        "status": "reported" if hard_violations else "completed",
        "stableUserId": stable_user_id,
        "indexCount": len(visited_indexes),
        "logicalRuleCount": len(rule_registrations),
        "triggerCount": len(trigger_records),
        "hardViolationCount": len(hard_violations),
        "advisoryCount": len(advisories),
        "hardViolations": hard_violations,
        "advisories": advisories,
        "metrics": {
            "indexes": index_metrics,
            "rules": rule_metrics,
            "machineAbsolutePathHits": machine_absolute_hits,
        },
    }


def main() -> int:
    """默认只报告；显式 strict 才把已确认的硬违规转换为阻断退出码。"""
    parser = argparse.ArgumentParser(description=ABILITY_NAME)
    parser.add_argument("--strict", action="store_true", help="硬违规存在时返回退出码 2")
    arguments = parser.parse_args()
    result = audit_ruleengine_structure()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if arguments.strict and result["hardViolationCount"] else 0


if __name__ == "__main__":
    sys.exit(main())
