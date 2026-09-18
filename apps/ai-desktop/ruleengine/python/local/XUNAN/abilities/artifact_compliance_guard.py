"""验证 schema 2 规则与首批 Java、脚手架产物合同。"""

from __future__ import annotations

import ast
import hashlib
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


ABILITY_ID = "artifact_compliance_guard"
SCHEMA_FIELDS = (
    "rule_schema",
    "rule_logical_id",
    "rule_scope",
    "rule_kind",
    "rule_status",
    "rule_version",
    "rule_owner",
    "rule_trigger",
    "rule_check_refs",
)
RULE_KINDS = {"protocol", "gate", "policy", "recipe"}
JAVA_METHOD_PATTERN = re.compile(
    r"(?m)^[ \t]*(?:@[A-Za-z0-9_.$()\", =]+\s*)*"
    r"(?P<visibility>public|protected)\s+"
    r"(?:(?:static|final|synchronized|abstract|default)\s+)*"
    r"(?P<return>[A-Za-z_$][\w$<>,.?\[\] ]*)\s+"
    r"(?P<name>[A-Za-z_$][\w$]*)\s*\((?P<params>[^)]*)\)"
    r"(?P<throws>\s+throws\s+[^\{;]+)?\s*(?:\{|;)",
)
JAVA_CLASS_PATTERN = re.compile(
    r"(?m)^[ \t]*(?:public\s+)?(?:abstract\s+|final\s+)?(?:class|interface|enum|record)\s+"
)


def _violation(code: str, path: str, message: str) -> dict[str, str]:
    return {"code": code, "path": path, "message": message}


def _schema_violations(logical_id: str) -> list[dict[str, str]]:
    try:
        stack = layered_rule_loader.load_rule_stack(
            logical_id,
            active_user=layered_rule_loader.current_stable_user_id(),
        )
    except (OSError, ValueError) as error:
        return [_violation("RULE_LOAD_FAILED", logical_id, str(error))]
    values = stack.effective_values
    path = stack.effective_rule.resource_path
    violations: list[dict[str, str]] = []
    if values.get("rule_schema") != "2":
        violations.append(_violation("RULE_SCHEMA_NOT_V2", path, logical_id))
        return violations
    for field in SCHEMA_FIELDS:
        if not values.get(field):
            violations.append(_violation("RULE_SCHEMA_FIELD_MISSING", path, field))
    if values.get("rule_logical_id") != logical_id:
        violations.append(
            _violation(
                "RULE_SCHEMA_LOGICAL_ID_MISMATCH",
                path,
                f"expected={logical_id}, actual={values.get('rule_logical_id', '')}",
            )
        )
    if values.get("rule_kind") not in RULE_KINDS:
        violations.append(
            _violation("RULE_SCHEMA_KIND_INVALID", path, values.get("rule_kind", ""))
        )
    if values.get("rule_kind") == "recipe" and (
        values.get("recipe_resource_path") or values.get("recipe_resource_sha256")
    ):
        resource_path = values.get("recipe_resource_path", "")
        expected_hash = values.get("recipe_resource_sha256", "")
        if not resource_path or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
            violations.append(
                _violation("RECIPE_RESOURCE_METADATA_MISSING", path, logical_id)
            )
        else:
            resource_file = layered_rule_loader.RESOURCE_ROOT / resource_path
            if not resource_file.is_file():
                violations.append(
                    _violation("RECIPE_RESOURCE_MISSING", resource_path, logical_id)
                )
            else:
                actual_hash = hashlib.sha256(
                    resource_file.read_text(encoding="utf-8").encode("utf-8")
                ).hexdigest()
                if actual_hash != expected_hash:
                    violations.append(
                        _violation("RECIPE_RESOURCE_HASH_MISMATCH", resource_path, logical_id)
                    )
    return violations


def _safe_project_file(raw_path: str, suffix: str) -> tuple[Path | None, dict[str, str] | None]:
    candidate = (PROJECT_ROOT / raw_path).resolve()
    if not candidate.is_relative_to(PROJECT_ROOT.resolve()):
        return None, _violation("ARTIFACT_PATH_ESCAPE", raw_path, "path escapes project root")
    if candidate.suffix.lower() != suffix:
        return None, _violation("ARTIFACT_TYPE_INVALID", raw_path, f"expected {suffix}")
    if not candidate.is_file():
        return None, _violation("ARTIFACT_MISSING", raw_path, "file does not exist")
    return candidate, None


def _preceding_javadoc(text: str, position: int) -> str:
    start = text.rfind("/**", 0, position)
    if start < 0:
        return ""
    end = text.find("*/", start, position)
    if end < 0:
        return ""
    between = text[end + 2:position]
    if re.fullmatch(r"(?:\s|@[A-Za-z0-9_.$()\", =]+)*", between) is None:
        return ""
    return text[start:end + 2]


def _parameter_names(raw_params: str) -> list[str]:
    names: list[str] = []
    for raw_param in raw_params.split(","):
        cleaned = re.sub(r"@[A-Za-z0-9_.$()\", =]+", "", raw_param).strip()
        if not cleaned:
            continue
        match = re.search(r"([A-Za-z_$][\w$]*)\s*(?:\[\])?$", cleaned)
        if match:
            names.append(match.group(1))
    return names


def _java_violations(raw_paths: list[str], business_contract: bool) -> list[dict[str, str]]:
    violations: list[dict[str, str]] = []
    if not raw_paths:
        return [_violation("JAVA_ARTIFACTS_EMPTY", "", "file_paths must not be empty")]
    for raw_path in raw_paths:
        path, path_error = _safe_project_file(raw_path, ".java")
        if path_error:
            violations.append(path_error)
            continue
        assert path is not None
        text = path.read_text(encoding="utf-8")
        if "System.out.println" in text:
            violations.append(
                _violation("JAVA_SYSTEM_OUT_FORBIDDEN", raw_path, "use the project logger")
            )
        class_match = JAVA_CLASS_PATTERN.search(text)
        if class_match:
            javadoc = _preceding_javadoc(text, class_match.start())
            if not javadoc or not re.search(r"[\u4e00-\u9fff]", javadoc):
                violations.append(
                    _violation(
                        "JAVA_CLASS_BUSINESS_JAVADOC_MISSING",
                        raw_path,
                        "class contract requires Chinese business responsibility and boundary",
                    )
                )
        for method in JAVA_METHOD_PATTERN.finditer(text):
            javadoc = _preceding_javadoc(text, method.start())
            method_name = method.group("name")
            if not javadoc or not re.search(r"[\u4e00-\u9fff]", javadoc):
                violations.append(
                    _violation(
                        "JAVA_METHOD_BUSINESS_JAVADOC_MISSING",
                        raw_path,
                        method_name,
                    )
                )
                continue
            if not business_contract:
                continue
            for parameter in _parameter_names(method.group("params")):
                if not re.search(rf"@param\s+{re.escape(parameter)}\b", javadoc):
                    violations.append(
                        _violation(
                            "JAVA_PARAM_CONTRACT_MISSING",
                            raw_path,
                            f"{method_name}:{parameter}",
                        )
                    )
            has_example = bool(re.search(r"示例|例如|example", javadoc, re.IGNORECASE))
            if not has_example:
                violations.append(
                    _violation("JAVA_CONTRACT_EXAMPLE_MISSING", raw_path, method_name)
                )
            if method.group("return").strip() != "void" and "@return" not in javadoc:
                violations.append(
                    _violation("JAVA_RETURN_CONTRACT_MISSING", raw_path, method_name)
                )
            if method.group("throws") and "@throws" not in javadoc:
                violations.append(
                    _violation("JAVA_THROWS_CONTRACT_MISSING", raw_path, method_name)
                )
    return violations


def _scaffold_violations() -> list[dict[str, str]]:
    logical_id = "SELPLAT_APPLICATION_SCAFFOLD_GENERATOR_RULES"
    violations = _schema_violations(logical_id)
    stack = layered_rule_loader.load_rule_stack(
        logical_id,
        active_user=layered_rule_loader.current_stable_user_id(),
    )
    values = stack.effective_values
    required = (
        "generator_contract",
        "generator_program",
        "verification_scope",
        "selplat_scaffold_delivery_gate",
    )
    for field in required:
        if not values.get(field):
            violations.append(
                _violation("SCAFFOLD_CONTRACT_FIELD_MISSING", logical_id, field)
            )
    for field in ("generator_contract", "generator_program"):
        raw_path = values.get(field, "")
        if raw_path and not (PROJECT_ROOT / raw_path).is_file():
            violations.append(
                _violation("SCAFFOLD_PROGRAM_MISSING", raw_path, field)
            )
    return violations


def _python_violations(raw_paths: list[str]) -> list[dict[str, str]]:
    violations: list[dict[str, str]] = []
    if not raw_paths:
        return [_violation("PYTHON_ARTIFACTS_EMPTY", "", "file_paths must not be empty")]
    for raw_path in raw_paths:
        path, path_error = _safe_project_file(raw_path, ".py")
        if path_error:
            violations.append(path_error)
            continue
        assert path is not None
        text = path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(text)
        except SyntaxError as error:
            violations.append(_violation("PYTHON_SYNTAX_INVALID", raw_path, str(error)))
            continue
        if re.search(r"(?i)(?:[a-z]:[\\/]|/Users/)", text):
            violations.append(
                _violation("PYTHON_MACHINE_PATH_FORBIDDEN", raw_path, "machine absolute path")
            )
        for node in ast.walk(tree):
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                violations.append(
                    _violation("PYTHON_BARE_EXCEPT_FORBIDDEN", raw_path, f"line {node.lineno}")
                )
            if isinstance(node, ast.ExceptHandler) and len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                violations.append(
                    _violation("PYTHON_SWALLOWED_EXCEPTION_FORBIDDEN", raw_path, f"line {node.lineno}")
                )
    return violations


def _vue_violations(raw_paths: list[str]) -> list[dict[str, str]]:
    violations: list[dict[str, str]] = []
    if not raw_paths:
        return [_violation("VUE_ARTIFACTS_EMPTY", "", "file_paths must not be empty")]
    for raw_path in raw_paths:
        path, path_error = _safe_project_file(raw_path, ".vue")
        if path_error:
            violations.append(path_error)
            continue
        assert path is not None
        text = path.read_text(encoding="utf-8")
        if "<template" not in text or "<script" not in text:
            violations.append(
                _violation("VUE_SFC_SECTION_MISSING", raw_path, "template and script are required")
            )
        if re.search(r"<[^>]*\bv-if\s*=\s*[^>]*\bv-for\s*=|<[^>]*\bv-for\s*=\s*[^>]*\bv-if\s*=", text):
            violations.append(
                _violation("VUE_V_IF_WITH_V_FOR_FORBIDDEN", raw_path, "split filtering from iteration")
            )
        if re.search(r"<[^>]+\stitle\s*=", text):
            violations.append(
                _violation("VUE_NATIVE_TITLE_FORBIDDEN", raw_path, "use the project tooltip component")
            )
        if re.search(r"(?i)(?:[a-z]:[\\/]|/Users/)", text):
            violations.append(
                _violation("VUE_MACHINE_PATH_FORBIDDEN", raw_path, "machine absolute path")
            )
    return violations


def _rule_evidence(
    logical_ids: list[str], raw_paths: list[str]
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    if not logical_ids:
        raise ValueError("logical_ids must not be empty")
    checks: list[dict[str, Any]] = []
    all_violations: list[dict[str, str]] = []
    dispatch = {
        "rule_schema": lambda logical_id: _schema_violations(logical_id),
        "java_source_policy": lambda _logical_id: _java_violations(
            [path for path in raw_paths if path.lower().endswith(".java")], False
        ),
        "java_business_contract": lambda _logical_id: _java_violations(
            [path for path in raw_paths if path.lower().endswith(".java")], True
        ),
        "python_source_policy": lambda _logical_id: _python_violations(
            [path for path in raw_paths if path.lower().endswith(".py")]
        ),
        "vue_source_policy": lambda _logical_id: _vue_violations(
            [path for path in raw_paths if path.lower().endswith(".vue")]
        ),
        "selplat_scaffold_contract": lambda _logical_id: _scaffold_violations(),
    }
    for logical_id in logical_ids:
        stack = layered_rule_loader.load_rule_stack(
            logical_id, active_user=layered_rule_loader.current_stable_user_id()
        )
        values = stack.effective_values
        raw_refs = [
            value
            for key, value in values.items()
            if key == "rule_check_refs" or key.startswith("rule_check_refs.")
        ]
        if values.get("rule_schema") == "2" and not raw_refs:
            raw_refs = ["missing"]
        for raw_ref in raw_refs:
            for check_ref in (part.strip() for part in raw_ref.split(",")):
                if not check_ref or check_ref == "none":
                    continue
                ability_id, separator, check_id = check_ref.partition(":")
                if ability_id != ABILITY_ID or not separator or check_id not in dispatch:
                    violations = [
                        _violation(
                            "RULE_CHECKER_UNSUPPORTED",
                            stack.effective_rule.resource_path,
                            check_ref,
                        )
                    ]
                else:
                    violations = dispatch[check_id](logical_id)
                checks.append({
                    "rule_id": logical_id,
                    "check_id": check_ref,
                    "result": "passed" if not violations else "failed",
                    "evidence": violations or [{"code": "CHECK_PASSED"}],
                })
                all_violations.extend(violations)
    return checks, all_violations


def execute(context: dict[str, Any], skills: dict, apps: dict) -> dict[str, Any]:
    _ = skills, apps
    action = str(context.get("action") or "rule_schema").strip().lower()
    violations: list[dict[str, str]] = []
    checks: list[dict[str, Any]] | None = None
    try:
        if action == "rule_schema":
            logical_ids = [str(value) for value in context.get("logical_ids") or []]
            if not logical_ids:
                raise ValueError("logical_ids must not be empty")
            for logical_id in logical_ids:
                violations.extend(_schema_violations(logical_id))
        elif action == "java_source_policy":
            violations = _java_violations(
                [str(value) for value in context.get("file_paths") or []], False
            )
        elif action == "java_business_contract":
            violations = _java_violations(
                [str(value) for value in context.get("file_paths") or []], True
            )
        elif action == "selplat_scaffold_contract":
            violations = _scaffold_violations()
        elif action == "python_source_policy":
            violations = _python_violations(
                [str(value) for value in context.get("file_paths") or []]
            )
        elif action == "vue_source_policy":
            violations = _vue_violations(
                [str(value) for value in context.get("file_paths") or []]
            )
        elif action == "rule_evidence":
            checks, violations = _rule_evidence(
                [str(value) for value in context.get("logical_ids") or []],
                [str(value) for value in context.get("file_paths") or []],
            )
        else:
            raise ValueError(f"unsupported action: {action}")
    except (OSError, ValueError) as error:
        return {
            "status": "blocked",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "action": action,
            "message": str(error),
        }
    result = {
        "status": "completed" if not violations else "blocked",
        "exit_code": 0 if not violations else 2,
        "ability": ABILITY_ID,
        "action": action,
        "violation_count": len(violations),
        "violations": violations,
    }
    if checks is not None:
        result["checks"] = checks
    return result


def main(arguments: list[str] | None = None) -> int:
    raw = (arguments or sys.argv[1:] or ["{}"])[0]
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
