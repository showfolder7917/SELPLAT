"""按 schema 2 触发条件计算规则闭包并阻断漏载、错载和未知规则。"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
from typing import Any


PROJECT_ROOT = next(
    path for path in Path(__file__).resolve().parents if (path / "settings.gradle").is_file()
)
sys.pycache_prefix = str(PROJECT_ROOT / "cache/python-pycache")
os.environ["PYTHONPYCACHEPREFIX"] = sys.pycache_prefix
PYTHON_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from local.core.abilities import layered_rule_loader


ABILITY_ID = "rule_selection_guard"
TRIGGER_PATTERN = re.compile(r"([a-z][a-z0-9_-]{0,63}):(.+)")


def _registrations(active_user: str) -> dict[str, Any]:
    root_entries = layered_rule_loader._parse_index(
        layered_rule_loader.ROOT_INDEX,
        layered_rule_loader._read_resource(layered_rule_loader.ROOT_INDEX),
    )
    registrations = layered_rule_loader._direct_rule_entries(
        layered_rule_loader.ROOT_INDEX, root_entries
    )
    user_index = layered_rule_loader._optional_user_index_reference(
        root_entries, active_user
    )
    user_rules = layered_rule_loader._collect_rule_entries(
        user_index, 0, set(), set(), set(), layered_rule_loader._read_resource
    )
    layered_rule_loader._merge_rules(registrations, user_rules)
    return registrations


def _index_triggers(active_user: str) -> dict[str, set[str]]:
    triggers: dict[str, set[str]] = {}
    visited: set[str] = set()

    def walk(index_path: str) -> None:
        if index_path in visited:
            return
        visited.add(index_path)
        entries = layered_rule_loader._parse_index(
            index_path, layered_rule_loader._read_resource(index_path)
        )
        for key, value in entries.items():
            if key.startswith("load_rule_for_") or key.endswith("_trigger"):
                triggers.setdefault(key, set()).update(
                    part.strip() for part in value.split(",") if part.strip()
                )
        for key, value in entries.items():
            if key == layered_rule_loader.USER_INDEX_PATTERN_KEY:
                walk(value.replace(layered_rule_loader.USER_ID_PLACEHOLDER, active_user))
            elif layered_rule_loader.LOGICAL_ID_PATTERN.fullmatch(key) and value.endswith(
                "/RULE_INDEX.md"
            ):
                walk(value)

    walk(layered_rule_loader.ROOT_INDEX)
    return triggers


def _feature_values(features: dict[str, Any], name: str) -> set[str]:
    raw = features.get(name)
    values = raw if isinstance(raw, (list, tuple, set)) else [raw]
    return {
        str(value).strip().lower()
        for value in values
        if value is not None and str(value).strip()
    }


def _triggers(values: dict[str, str]) -> list[tuple[str, set[str]]]:
    parsed: list[tuple[str, set[str]]] = []
    for key, raw_value in values.items():
        if key != "rule_trigger" and not key.startswith("rule_trigger."):
            continue
        match = TRIGGER_PATTERN.fullmatch(raw_value.strip())
        if not match:
            raise ValueError(f"invalid trigger: {key}={raw_value}")
        options = {
            option.strip().lower()
            for option in match.group(2).split("|")
            if option.strip()
        }
        if not options:
            raise ValueError(f"empty trigger options: {key}")
        parsed.append((match.group(1), options))
    return parsed


def _matches_scope(rule_scope: str, features: dict[str, Any]) -> bool:
    if rule_scope == "cross_project":
        return True
    requested = _feature_values(features, "scope")
    return bool(requested and rule_scope.lower() in requested)


def _matches(triggers: list[tuple[str, set[str]]], features: dict[str, Any]) -> bool:
    return bool(triggers) and all(
        bool(_feature_values(features, dimension) & options)
        for dimension, options in triggers
    )


def select_rules(
    features: dict[str, Any], required_rule_ids: list[str] | None = None
) -> dict[str, Any]:
    active_user = layered_rule_loader.current_stable_user_id()
    registrations = _registrations(active_user)
    matched: set[str] = set()
    routable: set[str] = set()
    evidence: dict[str, list[str]] = {}
    for logical_id in sorted(registrations):
        stack = layered_rule_loader.load_rule_stack(logical_id, None, active_user)
        values = stack.effective_values
        if values.get("rule_schema") != "2" or values.get("rule_status") != "active":
            continue
        triggers = _triggers(values)
        if not triggers:
            continue
        routable.add(logical_id)
        if _matches_scope(values.get("rule_scope", ""), features) and _matches(triggers, features):
            matched.add(logical_id)
            evidence[logical_id] = [
                f"{dimension}:{'|'.join(sorted(options))}"
                for dimension, options in triggers
            ]
    index_triggers = _index_triggers(active_user)
    requested_triggers = _feature_values(features, "index_trigger")
    normalized_triggers = {key.lower(): key for key in index_triggers}
    unknown_triggers = sorted(requested_triggers - set(normalized_triggers))
    if unknown_triggers:
        raise ValueError(f"unknown index trigger: {','.join(unknown_triggers)}")
    for requested in requested_triggers:
        trigger_key = normalized_triggers[requested]
        for logical_id in index_triggers[trigger_key]:
            if logical_id not in registrations:
                raise ValueError(f"index trigger references unknown rule id: {logical_id}")
            matched.add(logical_id)
            evidence.setdefault(logical_id, []).append(f"index_trigger:{trigger_key}")
    for logical_id in required_rule_ids or []:
        if logical_id not in registrations:
            raise ValueError(f"unknown required rule id: {logical_id}")
        matched.add(logical_id)
        evidence.setdefault(logical_id, ["explicit_required_rule_id"])
    if matched:
        bundle = layered_rule_loader.load_bundle(
            sorted(matched), None, active_user, include_sources=False
        )
        expected = set(bundle.rules)
    else:
        expected = set()
    return {
        "expected_rule_ids": sorted(expected),
        "direct_match_rule_ids": sorted(matched),
        "evidence": evidence,
        "registered_rule_count": len(registrations),
        "routable_schema_2_rule_count": len(routable),
        "registered_index_trigger_count": len(index_triggers),
    }


def execute(context: dict[str, Any], skills: dict, apps: dict) -> dict[str, Any]:
    _ = skills, apps
    try:
        features = context.get("features") or {}
        if not isinstance(features, dict) or not features:
            raise ValueError("features must be a non-empty object")
        loaded = {str(value) for value in context.get("loaded_rule_ids") or []}
        selected = select_rules(
            features,
            [str(value) for value in context.get("required_rule_ids") or []],
        )
        expected = set(selected["expected_rule_ids"])
        known = set(_registrations(layered_rule_loader.current_stable_user_id()))
        unknown = sorted(loaded - known)
        missing = sorted(expected - loaded)
        unexpected = sorted((loaded & known) - expected)
        blocked = bool(unknown or missing or unexpected)
        return {
            "status": "blocked" if blocked else "completed",
            "exit_code": 2 if blocked else 0,
            "ability": ABILITY_ID,
            "features": features,
            **selected,
            "loaded_rule_ids": sorted(loaded),
            "missing_rule_ids": missing,
            "unexpected_rule_ids": unexpected,
            "unknown_rule_ids": unknown,
        }
    except (OSError, ValueError) as error:
        return {
            "status": "blocked",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "message": str(error),
        }


def main(arguments: list[str] | None = None) -> int:
    raw_arguments = arguments or sys.argv[1:] or ["{}"]
    raw = raw_arguments[0]
    try:
        context = json.loads(raw)
    except json.JSONDecodeError as error:
        print(json.dumps({"status": "blocked", "message": str(error)}, ensure_ascii=False))
        return 1
    result = execute(context, {}, {})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return int(result.get("exit_code") or 0)


if __name__ == "__main__":
    raise SystemExit(main())
