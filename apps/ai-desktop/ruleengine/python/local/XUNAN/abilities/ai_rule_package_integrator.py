"""AI 规则包智慧整合能力。

程序只负责提供完整、可复核的规则包事实；重复、合并和删除结论由 AI 按正式规则结合语义证据判断。
"""

from __future__ import annotations

# 导入 os，让直接程序启动的 Python 子进程继承工程字节码缓存根。
import os
from pathlib import Path
import sys

# 直接入口在动态加载 core 前识别工程根，禁止源码旁生成 __pycache__。
PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 用户程序与 core 共用工程 cache 中的 Python 字节码目录。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
# 当前解释器后续导入立即使用工程缓存根。
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
# 用户程序启动的子进程继承相同缓存位置。
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)

from collections import Counter
import importlib.util
import json
import re
from typing import Any

PYTHON_SOURCE_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents if candidate.name == "python"
)
if str(PYTHON_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_SOURCE_ROOT))

from ruleengine.util.路径配置 import 加载路径配置


ABILITY_ID = "ai_rule_package_integrator"
ABILITY_NAME = "AI 规则包智慧整合"
REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

_PATHS = 加载路径配置()
RESOURCE_ROOT = _PATHS.取得("resource_root")
RESOURCE_RELATIVE_ROOT = RESOURCE_ROOT.relative_to(PROJECT_ROOT)
CORE_EXECUTOR_PATH = _PATHS.取得("ruleengine_python") / "执行器.py"
OPTION_ROOT = _PATHS.取得("option_root")
AGENTS_PATH = _PATHS.取得("agents_file")
LOGICAL_ID_PATTERN = re.compile(r"[A-Z][A-Z0-9_]{1,127}")
ACTIVE_USER_PATTERN = re.compile(r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$")
SAFE_USER_ID_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}")
REFERENCE_FIELDS = ("java_ability_refs", "python_ability_refs", "node_ability_refs")
NOT_APPLICABLE_VALUES = {"none", "null", "n/a", "无", "[]"}
PROJECT_REFERENCE_PREFIXES = ("apps/", "shared/", "local/", "ai/", "公共/工具/")
DEPRECATED_CHAIN_TEXTS = (
    "规则解析 → 校验 → 裁决 → 执行 → 解释 → 审计",
    "parser/validator/adjudicator/executor/explainer/auditor",
)


def _load_core_executor():
    """复用冻结 core 的完整文件读取能力，禁止绕过协议直接读取规则 Markdown。"""

    spec = importlib.util.spec_from_file_location("active_user_integrator_core_executor", CORE_EXECUTOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 core executor：{CORE_EXECUTOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _read_markdown(relative_path: str, core_executor: Any) -> str:
    """通过已登记 ability 完整读取工程 Markdown。"""

    result = core_executor.execute(
        "memory_file_full_reader",
        {"file_path": str(RESOURCE_RELATIVE_ROOT / relative_path)},
    )
    if result.get("status") != "completed":
        raise RuntimeError(f"规则读取失败：{relative_path}：{result}")
    return str(result["result"]["content"])


def _parse_assignments(text: str) -> list[tuple[str, str, int]]:
    """解析 Markdown 中的稳定 key=value 声明并保留行号。"""

    assignments: list[tuple[str, str, int]] = []
    for line_number, raw_line in enumerate(text.splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("<!--") or "=" not in line:
            continue
        key, value = (part.strip() for part in line.split("=", 1))
        if key and value:
            assignments.append((key, value, line_number))
    return assignments


def _active_stable_user_id() -> str:
    """从工程根 AGENTS.md 读取唯一且路径安全的当前稳定用户。"""

    agents_text = AGENTS_PATH.read_text(encoding="utf-8")
    matches = ACTIVE_USER_PATTERN.findall(agents_text)
    if len(matches) != 1:
        raise RuntimeError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
    active_user = matches[0].strip()
    if not SAFE_USER_ID_PATTERN.fullmatch(active_user):
        raise RuntimeError(f"当前稳定用户 ID 不符合安全格式：{active_user}")
    return active_user


def _collect_indexed_rules(
        core_executor: Any,
) -> tuple[str, list[str], list[dict[str, Any]], list[str], list[dict[str, Any]], int]:
    """从唯一根索引递归收集正式规则，并单独统计当前用户覆盖。"""

    active_user = _active_stable_user_id()
    active_user_prefix = f"local/{active_user}/"
    visited: list[str] = []
    rules: list[dict[str, Any]] = []
    user_indexes: list[str] = []
    user_rules_by_path: dict[str, dict[str, Any]] = {}
    user_registration_count = 0

    def walk(index_path: str) -> None:
        if index_path in visited:
            return
        visited.append(index_path)
        text = _read_markdown(index_path, core_executor)
        for key, value, line_number in _parse_assignments(text):
            if not LOGICAL_ID_PATTERN.fullmatch(key):
                continue
            if key == "USER_RULE_INDEX_PATTERN":
                continue
            if value.endswith("/RULE_INDEX.md"):
                walk(value)
            elif value.startswith("local/") and value.endswith(".md"):
                rules.append({
                    "logical_id": key,
                    "path": value,
                    "index": index_path,
                    "index_line": line_number,
                })

    def walk_user(index_path: str) -> None:
        """只递归 AGENTS.md 当前用户索引树，并按物理规则文件去重审查。"""

        nonlocal user_registration_count
        if index_path in user_indexes:
            return
        user_indexes.append(index_path)
        text = _read_markdown(index_path, core_executor)
        for key, value, line_number in _parse_assignments(text):
            if not LOGICAL_ID_PATTERN.fullmatch(key):
                continue
            if value.endswith("/RULE_INDEX.md"):
                walk_user(value)
            elif value.startswith(active_user_prefix) and value.endswith(".md"):
                user_registration_count += 1
                existing = user_rules_by_path.setdefault(value, {
                    "logical_id": key,
                    "logical_ids": [],
                    "path": value,
                    "index": index_path,
                    "index_line": line_number,
                })
                existing["logical_ids"].append(key)

    walk("RULE_INDEX.md")
    root_text = _read_markdown("RULE_INDEX.md", core_executor)
    user_patterns = [
        value for key, value, _ in _parse_assignments(root_text)
        if key == "USER_RULE_INDEX_PATTERN"
    ]
    if user_patterns != ["local/<stable-user-id>/RULE_INDEX.md"]:
        raise RuntimeError("根索引必须登记唯一标准 USER_RULE_INDEX_PATTERN。")
    walk_user(user_patterns[0].replace("<stable-user-id>", active_user))
    return (
        active_user,
        visited,
        rules,
        user_indexes,
        list(user_rules_by_path.values()),
        user_registration_count,
    )


def _asset_facts(rule_path: Path) -> dict[str, Any]:
    """统计规则对应的可选模板目录，兼容跨工程和用户层既有并列包。"""

    if rule_path.parent.name == "rule":
        asset_root = rule_path.parent.parent / "template" / rule_path.stem
    else:
        asset_root = rule_path.with_suffix("")
    files = [path for path in asset_root.rglob("*") if path.is_file()] if asset_root.is_dir() else []
    return {
        "asset_root": str(asset_root.relative_to(PROJECT_ROOT)) if asset_root.is_dir() else "",
        "asset_file_count": len(files),
        "has_readme": any(path.name.lower() == "readme.md" for path in files),
        "has_docs": (asset_root / "docs").is_dir(),
        "has_template": asset_root.is_dir(),
        "has_examples": (asset_root / "examples").is_dir(),
        "has_project": (asset_root / "project").is_dir(),
    }


def _resolve_reference(rule_path: Path, raw_reference: str) -> tuple[bool, list[str]]:
    """验证没有占位符的工程路径，并返回可复核候选位置。"""

    if any(marker in raw_reference for marker in ("<", ">", "*", "${")):
        return True, []
    normalized = raw_reference.replace("\\", "/")
    candidates = [
        PROJECT_ROOT / normalized,
        RESOURCE_ROOT / normalized,
        rule_path.parent / normalized,
        RESOURCE_ROOT / "local/core/rule" / normalized,
    ]
    existing = [str(path.resolve()) for path in candidates if path.exists()]
    return bool(existing), existing


def _is_project_reference(line: str, raw_reference: str) -> bool:
    """只校验规则引擎声明拥有的路径，跳过 URL、占位符和外部项目相对路径。"""

    if "http://" in line or "https://" in line or any(marker in line for marker in ("<", ">", "${")):
        return False
    normalized = raw_reference.lstrip("./").replace("\\", "/")
    return normalized.startswith(PROJECT_REFERENCE_PREFIXES)


def _collect_reference_fields(assignments: dict[str, str]) -> dict[str, str | None]:
    """合并一条事实一个键的 ability 引用，同时兼容未拆分旧规则。"""

    reference_fields: dict[str, str | None] = {}
    for field in REFERENCE_FIELDS:
        # 基础键是第一条事实，点号数字后缀按声明顺序承载其余独立引用。
        matching_values = [
            value
            for key, value in assignments.items()
            if key == field or key.startswith(f"{field}.")
        ]
        # 审查结果继续提供单一字符串契约，内部规则文件则保持单事实 DSL。
        reference_fields[field] = ",".join(matching_values) if matching_values else None
    return reference_fields


def _audit_rule(rule: dict[str, Any], core_executor: Any) -> dict[str, Any]:
    """形成单条规则的规则包事实和缺口，不自动决定删除或合并。"""

    text = _read_markdown(rule["path"], core_executor)
    assignments = {key: value for key, value, _ in _parse_assignments(text)}
    absolute_rule_path = RESOURCE_ROOT / rule["path"]
    assets = _asset_facts(absolute_rule_path)
    reference_fields = _collect_reference_fields(assignments)
    program_refs = {
        field: value for field, value in reference_fields.items()
        if value and value.lower() not in NOT_APPLICABLE_VALUES
    }
    stale_references: list[dict[str, Any]] = []
    for line_number, line in enumerate(text.splitlines(), 1):
        quoted_references = re.findall(r"`([^`]+)`", line)
        raw_path_references = re.findall(
            r"[A-Za-z0-9_\u4e00-\u9fff./-]+\.(?:java|py|mjs|xlsx|json|md|html?|template|tsv)",
            line,
            re.I,
        )
        for raw_reference in dict.fromkeys([*quoted_references, *raw_path_references]):
            if not _is_project_reference(line, raw_reference):
                continue
            if not re.search(r"\.(?:java|py|mjs|xlsx|json|md|html?|template|tsv)$", raw_reference, re.I):
                continue
            if "/" not in raw_reference and "\\" not in raw_reference:
                continue
            exists, resolved = _resolve_reference(absolute_rule_path, raw_reference)
            if not exists:
                stale_references.append({
                    "line": line_number,
                    "reference": raw_reference,
                    "reason": "path_not_found",
                    "resolved_candidates": resolved,
                })
    gaps: list[str] = []
    # 模板包是可选稳定材料，不得把“没有模板”误判为规则缺口。
    if sum(value is not None for value in reference_fields.values()) != 3:
        gaps.append("ability_reference_fields_incomplete")
    if not any(key.lower() in {"version", "rule_version"} for key in assignments):
        gaps.append("version_metadata_missing")
    if not any(key.lower() in {"owner", "rule_owner", "rule_owner_source"} for key in assignments):
        gaps.append("owner_metadata_missing")
    if stale_references:
        gaps.append("stale_reference_detected")
    return {
        **rule,
        **assets,
        "ability_reference_fields": reference_fields,
        "program_references": program_refs,
        "has_verification_language": bool(re.search(r"验证|测试|校验|回归|验收|verify|test", text, re.I)),
        "has_upgrade_language": bool(re.search(r"升级|更新|修复|合并|退役|生命周期|upgrade|repair", text, re.I)),
        "stale_references": stale_references,
        "gaps": gaps,
    }


def _build_audit() -> dict[str, Any]:
    """生成全量规则包审查结果。"""

    core_executor = _load_core_executor()
    active_user, indexes, rules, user_indexes, user_rules, user_registration_count = (
        _collect_indexed_rules(core_executor)
    )
    audited_rules = [_audit_rule(rule, core_executor) for rule in rules]
    audited_user_rules = [_audit_rule(rule, core_executor) for rule in user_rules]
    gap_counts = Counter(gap for rule in audited_rules for gap in rule["gaps"])
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "model": "ai_rule_driven_execution_and_continuous_rule_package_growth",
        "indexes": len(indexes),
        "indexed_rules": len(rules),
        "active_user_id": active_user,
        "active_user_indexes": len(user_indexes),
        "active_user_overrides": user_registration_count,
        "active_user_rule_files": len(audited_user_rules),
        "active_user_standard_asset_packages": sum(bool(rule["asset_root"]) for rule in audited_user_rules),
        "active_user_rules_with_program_references": sum(
            bool(rule["program_references"]) for rule in audited_user_rules
        ),
        "standard_asset_packages": sum(bool(rule["asset_root"]) for rule in audited_rules),
        "template_packages": sum(rule["has_template"] for rule in audited_rules),
        "example_packages": sum(rule["has_examples"] for rule in audited_rules),
        "rules_with_program_references": sum(bool(rule["program_references"]) for rule in audited_rules),
        "rules_with_verification_language": sum(rule["has_verification_language"] for rule in audited_rules),
        "rules_with_upgrade_language": sum(rule["has_upgrade_language"] for rule in audited_rules),
        "stale_reference_count": sum(len(rule["stale_references"]) for rule in audited_rules),
        "gap_counts": dict(gap_counts),
        "rules": audited_rules,
        "active_user_rules": audited_user_rules,
        "decision_boundary": "facts_only_ai_must_review_before_merge_or_delete",
    }


def _safe_output_path(raw_path: str) -> Path:
    """报告只能写入项目 OPTION，禁止能力借输出参数修改规则层。"""

    target = (PROJECT_ROOT / raw_path).resolve() if raw_path else (
        OPTION_ROOT / "rule-intelligence/rule-package-audit.json"
    ).resolve()
    option_root = OPTION_ROOT.resolve()
    if target != option_root and option_root not in target.parents:
        raise ValueError("output_path 必须位于 OPTION。")
    return target


def execute(context: dict[str, Any], skills: dict[str, Any], apps: dict[str, Any]) -> dict[str, Any]:
    """执行只读审查，或把同一审查结果写入 OPTION。"""

    _ = skills, apps
    action = str(context.get("action") or "audit").strip().lower()
    if action not in {"audit", "write_report"}:
        return {"status": "blocked", "ability": ABILITY_ID, "message": "支持 audit/write_report。"}
    audit = _build_audit()
    if action == "audit":
        return audit
    try:
        output_path = _safe_output_path(str(context.get("output_path") or ""))
    except ValueError as error:
        return {"status": "blocked", "ability": ABILITY_ID, "message": str(error)}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {**{key: value for key, value in audit.items() if key != "rules"}, "report_path": str(output_path)}


def main(arguments: list[str] | None = None) -> int:
    """提供无需用户注册表和二次执行器的直接命令行入口。"""

    # 无参数默认只读审查；有参数时接收一份 JSON 上下文。
    raw_arguments = list(arguments if arguments is not None else sys.argv[1:])
    try:
        context = json.loads(raw_arguments[0]) if raw_arguments else {"action": "audit"}
    except json.JSONDecodeError as error:
        print(json.dumps({"status": "blocked", "message": f"context_json 无效：{error}"}, ensure_ascii=False))
        return 2
    # 上下文必须是对象，禁止数组或标量进入统一执行契约。
    if not isinstance(context, dict):
        print(json.dumps({"status": "blocked", "message": "context_json 必须是 JSON 对象。"}, ensure_ascii=False))
        return 2
    # 直接复用正式 execute，避免 CLI 和测试走不同审查逻辑。
    result = execute(context, {}, {})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    # completed 视为成功，其余状态供自动化调用方阻断。
    return 0 if result.get("status") == "completed" else 1


if __name__ == "__main__":
    # 用户程序直跑时返回标准进程状态。
    raise SystemExit(main())
