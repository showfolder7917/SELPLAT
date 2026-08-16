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
BUSINESS_TECHNICAL_LAYER_NAMES = {"controller", "service", "dao", "reference"}
MANAGED_COMMON_ROLE_NAMES = {"config", "persistence", "util"}
MANAGED_COMMON_PERSISTENCE_SUFFIXES = ("BaseDao", "PersistenceConfiguration")
MANAGED_TABLE_BUSINESS_ROLES = {"controller", "service", "dao"}
MANAGED_CAPABILITY_ROLES = {"controller", "service"}
MANAGED_APPLICATION_ROOT_ALLOWLIST = {
    "backend",
    "frontend",
    "db",
    "doc",
    "README.md",
    "build.gradle",
    ".selplat-generated-project.json",
}
QUERY_REPRESENTATION_PATHS = {
    "tree": "/tree",
    "options": "/options",
    "context-menu": "/context-menu",
}
APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE = Path(
    "apps/mda/backend/src/main/java/com/sp/selplat/mda/common/util/projectgenerator/"
    "MdaProjectTemplateCatalog.java"
)
GENERATED_BUSINESS_DEFAULT_FIELDS = (
    "tenantId",
    "lastOperateUserId",
    "sortnum",
    "labelZh",
    "labelJa",
    "labelEn",
    "status",
    "createdAt",
    "updatedAt",
)
SEL_UI_COMPONENT_ROOT_RELATIVE = Path("shared/frontend/sel-ui/src/components")
SEL_UI_COMPONENT_REGISTRY_NAME = "component-registry.json"
SEL_UI_SOURCE_ROOT_RELATIVE = Path("shared/frontend/sel-ui/src")
SEL_UI_TYPOGRAPHY_TOKEN_RELATIVE = Path("theme/selThemeTokens.css")
SEL_UI_TYPOGRAPHY_CONTRACT_RELATIVE = Path("theme/selThemeTypography.css")
SEL_UI_SEMANTIC_FONT_ROLES = (
    "display", "title", "heading", "body", "label", "caption", "micro"
)
SEL_UI_FORBIDDEN_LEGACY_FONT_TOKENS = (
    "--sel-theme-font-size-primary", "--sel-theme-font-size-secondary"
)
SEL_UI_COMPONENT_TYPES = {"interactive", "layout", "presentation", "registry"}
SEL_UI_REQUIRED_GOVERNANCE_CHECKS = {
    "source-boundary",
    "namespaced-public-api",
    "kernel-first",
    "theme-contract",
    "dependency-order",
    "application-private-control",
}
MANAGED_DATABASE_REGISTRY_RELATIVE = Path(
    "apps/rule-engine/backend/src/main/resources/local"
)


def _strip_javascript_literals_and_comments(source_text: str) -> str:
    """Preserve JavaScript structure while hiding strings and comments from static scans."""
    output = list(source_text)
    index = 0
    state = "code"
    quote = ""
    while index < len(source_text):
        character = source_text[index]
        following = source_text[index + 1] if index + 1 < len(source_text) else ""
        if state == "code" and character == "/" and following == "/":
            output[index] = output[index + 1] = " "
            index += 2
            state = "line-comment"
            continue
        if state == "code" and character == "/" and following == "*":
            output[index] = output[index + 1] = " "
            index += 2
            state = "block-comment"
            continue
        if state == "code" and character in {"'", '"', "`"}:
            quote = character
            output[index] = " "
            index += 1
            state = "string"
            continue
        if state == "line-comment":
            if character == "\n":
                state = "code"
            else:
                output[index] = " "
            index += 1
            continue
        if state == "block-comment":
            if character == "*" and following == "/":
                output[index] = output[index + 1] = " "
                index += 2
                state = "code"
            else:
                if character != "\n":
                    output[index] = " "
                index += 1
            continue
        if state == "string":
            if character == "\\":
                output[index] = " "
                if index + 1 < len(source_text):
                    if source_text[index + 1] != "\n":
                        output[index + 1] = " "
                    index += 2
                else:
                    index += 1
                continue
            if character == quote:
                output[index] = " "
                index += 1
                state = "code"
                continue
            if character != "\n":
                output[index] = " "
            index += 1
            continue
        index += 1
    return "".join(output)


def has_nested_sel_freeze(source_text: str) -> bool:
    """Return true when one selFreeze call is syntactically inside another call."""
    structural_text = _strip_javascript_literals_and_comments(source_text)
    parenthesis_depth = 0
    active_freeze_depths: list[int] = []
    index = 0
    while index < len(structural_text):
        if structural_text.startswith("selFreeze", index):
            before = structural_text[index - 1] if index > 0 else ""
            after_index = index + len("selFreeze")
            after = structural_text[after_index] if after_index < len(structural_text) else ""
            if not (before.isalnum() or before in {"_", "$"}) and not (
                    after.isalnum() or after in {"_", "$"}):
                open_index = after_index
                while open_index < len(structural_text) and structural_text[open_index].isspace():
                    open_index += 1
                if open_index < len(structural_text) and structural_text[open_index] == "(":
                    if active_freeze_depths:
                        return True
                    parenthesis_depth += 1
                    active_freeze_depths.append(parenthesis_depth)
                    index = open_index + 1
                    continue
        if structural_text[index] == "(":
            parenthesis_depth += 1
        elif structural_text[index] == ")":
            if active_freeze_depths and active_freeze_depths[-1] == parenthesis_depth:
                active_freeze_depths.pop()
            parenthesis_depth = max(0, parenthesis_depth - 1)
        index += 1
    return False


def document_has_nested_sel_freeze(source_text: str, suffix: str) -> bool:
    """Scan JavaScript directly and generated Java text blocks with the same boundary rule."""
    candidates = [source_text] if suffix == ".js" else re.findall(
        r'"""(.*?)"""', source_text, flags=re.DOTALL
    )
    return any(has_nested_sel_freeze(candidate) for candidate in candidates)


def audit_sel_ui_typography_governance(project_root: Path) -> list[dict[str, str]]:
    """Validate the seven semantic text roles and reject retired font tokens."""
    source_root = project_root / SEL_UI_SOURCE_ROOT_RELATIVE
    if not source_root.is_dir():
        return []
    violations: list[dict[str, str]] = []
    token_path = source_root / SEL_UI_TYPOGRAPHY_TOKEN_RELATIVE
    contract_path = source_root / SEL_UI_TYPOGRAPHY_CONTRACT_RELATIVE
    token_text = token_path.read_text(encoding="utf-8") if token_path.is_file() else ""
    contract_text = contract_path.read_text(encoding="utf-8") if contract_path.is_file() else ""
    for role in SEL_UI_SEMANTIC_FONT_ROLES:
        token_name = f"--sel-theme-font-size-{role}:"
        if token_name not in token_text:
            violations.append({
                "code": "SEL_UI_TYPOGRAPHY_ROLE_MISSING",
                "path": str(token_path.relative_to(project_root)),
                "message": f"semantic typography token {token_name[:-1]} is required",
            })
    for required_token in (
            "--sel-theme-font-weight-regular:",
            "--sel-theme-font-weight-medium:",
            "--sel-theme-font-weight-semibold:",
            "--sel-theme-font-weight-bold:",
            "--sel-theme-line-height-body:"):
        if required_token not in token_text:
            violations.append({
                "code": "SEL_UI_TYPOGRAPHY_METRIC_MISSING",
                "path": str(token_path.relative_to(project_root)),
                "message": f"semantic typography metric {required_token[:-1]} is required",
            })
    for tree_role in ("heading", "body", "label", "caption"):
        selector = f".seltree-node-text-{tree_role} .seltree-node-label"
        if selector not in contract_text:
            violations.append({
                "code": "SEL_UI_TREE_TYPOGRAPHY_ROLE_MISSING",
                "path": str(contract_path.relative_to(project_root)),
                "message": f"tree typography contract requires {selector}",
            })
    governed_files = list(source_root.rglob("*.css")) + list(source_root.rglob("*.js"))
    application_static_root = project_root / "apps"
    if application_static_root.is_dir():
        governed_files.extend(application_static_root.glob(
            "*/backend/src/main/resources/static/**/*.css"
        ))
        governed_files.extend(application_static_root.glob(
            "*/backend/src/main/resources/static/**/*.js"
        ))
    for source_path in sorted(set(governed_files)):
        source_text = source_path.read_text(encoding="utf-8")
        for legacy_token in SEL_UI_FORBIDDEN_LEGACY_FONT_TOKENS:
            if legacy_token in source_text:
                violations.append({
                    "code": "SEL_UI_LEGACY_TYPOGRAPHY_TOKEN",
                    "path": str(source_path.relative_to(project_root)),
                    "message": f"retired typography token {legacy_token} is forbidden",
                })
    return violations


def audit_sel_ui_component_governance(project_root: Path) -> list[dict[str, str]]:
    """Validate the central component registry and reject private reusable controls."""
    component_root = project_root / SEL_UI_COMPONENT_ROOT_RELATIVE
    if not component_root.is_dir():
        return []
    registry_path = component_root / SEL_UI_COMPONENT_REGISTRY_NAME
    registry_relative = str(registry_path.relative_to(project_root))
    if not registry_path.is_file():
        return [{
            "code": "SEL_UI_COMPONENT_REGISTRY_MISSING",
            "path": registry_relative,
            "message": "sel-ui controls must be registered before implementation",
        }]
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exception:
        return [{
            "code": "SEL_UI_COMPONENT_REGISTRY_INVALID",
            "path": registry_relative,
            "message": f"component registry is unreadable: {exception}",
        }]
    components = registry.get("components") if isinstance(registry, dict) else None
    policy = registry.get("policy") if isinstance(registry, dict) else None
    kernel = registry.get("kernel") if isinstance(registry, dict) else None
    if not isinstance(registry, dict) or registry.get("version") != 2 \
            or not isinstance(components, list) \
            or not isinstance(policy, dict) \
            or kernel != {
                "script": "core/selKernel.js",
                "publicApi": "sel",
                "loadOrder": "first",
            }:
        return [{
            "code": "SEL_UI_COMPONENT_REGISTRY_INVALID",
            "path": registry_relative,
            "message": "component registry requires version 2, the SEL kernel, policy, and components",
        }]
    violations: list[dict[str, str]] = []
    kernel_path = project_root / SEL_UI_SOURCE_ROOT_RELATIVE / "core/selKernel.js"
    kernel_source = kernel_path.read_text(encoding="utf-8") if kernel_path.is_file() else ""
    for kernel_contract in (
            "function selFreeze(", "new WeakSet()", "Array.isArray(value)",
            "function selRegister(", "function selRequire(",
            'selRegister("core.freeze", selFreeze)',
            'Object.defineProperty(global, "sel"'):
        if kernel_contract not in kernel_source:
            violations.append({
                "code": "SEL_UI_KERNEL_CONTRACT_MISSING",
                "path": str(kernel_path.relative_to(project_root)),
                "message": f"selKernel.js requires {kernel_contract}",
            })
    expected_policy = {
        "creationMode": "register-before-implementation",
        "legacyCompatibility": "forbidden",
        "applicationPrivateReusableControl": "forbidden",
    }
    for field_name, expected_value in expected_policy.items():
        if policy.get(field_name) != expected_value:
            violations.append({
                "code": "SEL_UI_COMPONENT_POLICY_INVALID",
                "path": registry_relative,
                "message": f"policy.{field_name} must be {expected_value}",
            })
    if set(policy.get("requiredChecks", [])) != SEL_UI_REQUIRED_GOVERNANCE_CHECKS:
        violations.append({
            "code": "SEL_UI_COMPONENT_POLICY_INVALID",
            "path": registry_relative,
            "message": "policy.requiredChecks must contain the complete governance gate set",
        })

    component_ids: set[str] = set()
    component_entries: dict[str, dict[str, Any]] = {}
    owned_source_files: set[Path] = set()
    registered_directories: set[str] = set()
    owned_aria_roles: dict[str, str] = {}
    for component in components:
        component_id = component.get("id") if isinstance(component, dict) else None
        directory_name = component.get("directory") if isinstance(component, dict) else None
        if not isinstance(component_id, str) or not re.fullmatch(
                r"sel[A-Z][A-Za-z0-9]*", component_id):
            violations.append({
                "code": "SEL_UI_COMPONENT_REGISTRATION_INVALID",
                "path": registry_relative,
                "message": "every control requires a safe sel<Component> id",
            })
            continue
        if component_id in component_ids:
            violations.append({
                "code": "SEL_UI_COMPONENT_ID_DUPLICATE",
                "path": registry_relative,
                "message": f"component id {component_id} must be registered exactly once",
            })
            continue
        component_ids.add(component_id)
        component_entries[component_id] = component
        if not isinstance(directory_name, str) or not re.fullmatch(
                r"[a-z][a-z0-9-]*", directory_name):
            violations.append({
                "code": "SEL_UI_COMPONENT_REGISTRATION_INVALID",
                "path": registry_relative,
                "message": f"{component_id}.directory must be a safe relative name",
            })
            continue
        registered_directories.add(directory_name)
        component_directory = component_root / directory_name
        if not component_directory.is_dir():
            violations.append({
                "code": "SEL_UI_COMPONENT_DIRECTORY_MISSING",
                "path": str(component_directory.relative_to(project_root)),
                "message": f"registered component directory for {component_id} is missing",
            })
            continue
        if component.get("type") not in SEL_UI_COMPONENT_TYPES:
            violations.append({
                "code": "SEL_UI_COMPONENT_TYPE_INVALID",
                "path": registry_relative,
                "message": f"{component_id}.type is not a governed component type",
            })
        scripts = component.get("scripts")
        styles = component.get("styles")
        dependencies = component.get("dependencies")
        if not isinstance(scripts, list) or not isinstance(styles, list) \
                or not isinstance(dependencies, list) \
                or not all(isinstance(value, str) for value in scripts + styles + dependencies):
            violations.append({
                "code": "SEL_UI_COMPONENT_REGISTRATION_INVALID",
                "path": registry_relative,
                "message": f"{component_id} requires string arrays for scripts, styles, and dependencies",
            })
            continue
        public_api = component.get("publicApi")
        component_api_name = component_id[3:4].lower() + component_id[4:]
        expected_public_api = f"sel.components.{component_api_name}"
        if scripts and public_api != expected_public_api:
            violations.append({
                "code": "SEL_UI_COMPONENT_PUBLIC_API_INVALID",
                "path": registry_relative,
                "message": f"{component_id}.publicApi must be {expected_public_api}",
            })
        if not scripts and public_api is not None:
            violations.append({
                "code": "SEL_UI_COMPONENT_PUBLIC_API_INVALID",
                "path": registry_relative,
                "message": f"style-only component {component_id} cannot declare a public API",
            })
        for source_name in scripts + styles:
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*(?:\.js|\.css)", source_name):
                violations.append({
                    "code": "SEL_UI_COMPONENT_SOURCE_PATH_INVALID",
                    "path": registry_relative,
                    "message": f"{component_id} source {source_name} must be a direct JS or CSS file",
                })
                continue
            source_path = component_directory / source_name
            if source_path in owned_source_files:
                violations.append({
                    "code": "SEL_UI_COMPONENT_SOURCE_DUPLICATE_OWNER",
                    "path": str(source_path.relative_to(project_root)),
                    "message": "one component source file cannot have multiple registered owners",
                })
                continue
            owned_source_files.add(source_path)
            if not source_path.is_file():
                violations.append({
                    "code": "SEL_UI_COMPONENT_SOURCE_MISSING",
                    "path": str(source_path.relative_to(project_root)),
                    "message": f"registered source for {component_id} is missing",
                })
                continue
            source_text = source_path.read_text(encoding="utf-8")
            if source_path.suffix == ".js" and isinstance(public_api, str) \
                    and f'window.sel.register("components.{component_api_name}"' not in source_text:
                violations.append({
                    "code": "SEL_UI_COMPONENT_PUBLIC_API_MISSING",
                    "path": str(source_path.relative_to(project_root)),
                    "message": f"{component_id} must publish its registered global API",
                })
            if source_path.suffix == ".css" and component.get("themeAware") is True \
                    and "var(--sel-theme-" not in source_text:
                violations.append({
                    "code": "SEL_UI_COMPONENT_THEME_TOKEN_MISSING",
                    "path": str(source_path.relative_to(project_root)),
                    "message": f"theme-aware component {component_id} must consume SEL theme tokens",
                })
        for aria_role in component.get("ownedAriaRoles", []):
            if not isinstance(aria_role, str) or not re.fullmatch(r"[a-z][a-z0-9-]*", aria_role):
                violations.append({
                    "code": "SEL_UI_COMPONENT_ARIA_ROLE_INVALID",
                    "path": registry_relative,
                    "message": f"{component_id} contains an invalid owned ARIA role",
                })
            elif aria_role in owned_aria_roles:
                violations.append({
                    "code": "SEL_UI_COMPONENT_ARIA_ROLE_DUPLICATE_OWNER",
                    "path": registry_relative,
                    "message": f"ARIA role {aria_role} is owned by multiple controls",
                })
            else:
                owned_aria_roles[aria_role] = component_id

    actual_directories = {
        path.name for path in component_root.iterdir() if path.is_dir()
    }
    for unregistered_directory in sorted(actual_directories - registered_directories):
        violations.append({
            "code": "SEL_UI_COMPONENT_DIRECTORY_UNREGISTERED",
            "path": str((component_root / unregistered_directory).relative_to(project_root)),
            "message": "new component directories must be registered before implementation",
        })
    actual_source_files = {
        source_file
        for component_directory in component_root.iterdir() if component_directory.is_dir()
        for source_file in component_directory.iterdir()
        if source_file.is_file() and source_file.suffix in {".js", ".css"}
    }
    for unregistered_source in sorted(actual_source_files - owned_source_files):
        violations.append({
            "code": "SEL_UI_COMPONENT_SOURCE_UNREGISTERED",
            "path": str(unregistered_source.relative_to(project_root)),
            "message": "new component JS and CSS must belong to one registered control",
        })
    for component_id, component in component_entries.items():
        for dependency in component.get("dependencies", []):
            if dependency not in component_entries or dependency == component_id:
                violations.append({
                    "code": "SEL_UI_COMPONENT_DEPENDENCY_INVALID",
                    "path": registry_relative,
                    "message": f"{component_id} dependency {dependency} is missing or self-referential",
                })
                continue
            component_source = "\n".join(
                (component_root / component["directory"] / script).read_text(encoding="utf-8")
                for script in component.get("scripts", [])
                if (component_root / component["directory"] / script).is_file()
            )
            dependency_public_api = component_entries[dependency].get("publicApi")
            if not isinstance(dependency_public_api, str) \
                    or f"window.{dependency_public_api}" not in component_source:
                violations.append({
                    "code": "SEL_UI_COMPONENT_DEPENDENCY_CALL_MISSING",
                    "path": str((component_root / component["directory"]).relative_to(project_root)),
                    "message": f"{component_id} registers {dependency} but does not call its public API",
                })

    # selTooltip 登记后即成为截断文字提示的唯一实现；Grid/Tree 禁止退回浏览器原生 title。
    if "selTooltip" in component_entries:
        tooltip_entry = component_entries["selTooltip"]
        tooltip_source = "\n".join(
            (component_root / tooltip_entry["directory"] / script).read_text(encoding="utf-8")
            for script in tooltip_entry.get("scripts", [])
            if (component_root / tooltip_entry["directory"] / script).is_file()
        )
        tooltip_required = {
            "data-sel-tooltip", "selTooltipIsTruncated", "pointerover",
            "focusin", "aria-describedby", 'role", "tooltip',
            "if (selTooltipAriaElement &&",
        }
        for missing_contract in sorted(tooltip_required - set(
                contract for contract in tooltip_required if contract in tooltip_source)):
            violations.append({
                "code": "SEL_UI_TOOLTIP_CONTRACT_MISSING",
                "path": str((component_root / tooltip_entry["directory"]).relative_to(project_root)),
                "message": f"selTooltip is missing {missing_contract}",
            })
        for consumer_id in ("selGrid", "selTree"):
            consumer = component_entries.get(consumer_id)
            if not consumer:
                continue
            consumer_source = "\n".join(
                (component_root / consumer["directory"] / script).read_text(encoding="utf-8")
                for script in consumer.get("scripts", [])
                if (component_root / consumer["directory"] / script).is_file()
            )
            if "window.sel.components.tooltip.attach" not in consumer_source \
                    or "dataset.selTooltip" not in consumer_source:
                violations.append({
                    "code": "SEL_UI_TOOLTIP_CONSUMER_MISSING",
                    "path": str((component_root / consumer["directory"]).relative_to(project_root)),
                    "message": f"{consumer_id} must consume selTooltip for truncated text",
                })
            if re.search(r"\.title\s*=|setAttribute\(\s*[\"']title[\"']", consumer_source):
                violations.append({
                    "code": "SEL_UI_TOOLTIP_NATIVE_TITLE_FORBIDDEN",
                    "path": str((component_root / consumer["directory"]).relative_to(project_root)),
                    "message": f"{consumer_id} cannot use native title for truncated text",
                })
            # Grid 的纯图标记录操作必须复用统一 Tip，并让可访问名称与动态动作标签保持一致。
            if consumer_id == "selGrid":
                grid_action_required = {
                    "selGridResolveRecordActionValue",
                    'setAttribute("aria-label", selGridActionLabel)',
                    "dataset.selTooltip = selGridActionLabel",
                    'dataset.selTooltipMode = "always"',
                }
                for missing_contract in sorted(grid_action_required - {
                        contract for contract in grid_action_required if contract in consumer_source}):
                    violations.append({
                        "code": "SEL_UI_GRID_ACTION_TOOLTIP_CONTRACT_MISSING",
                        "path": str((component_root / consumer["directory"]).relative_to(project_root)),
                        "message": f"selGrid record icon action is missing {missing_contract}",
                    })

    # 树的叶子对齐符号必须是非交互占位，不能用无可访问名称的空按钮伪装。
    if "selTree" in component_entries:
        tree_entry = component_entries["selTree"]
        tree_directory = component_root / tree_entry["directory"]
        tree_source = "\n".join(
            (tree_directory / script).read_text(encoding="utf-8")
            for script in tree_entry.get("scripts", [])
            if (tree_directory / script).is_file()
        )
        tree_leaf_required = {
            'document.createElement(hasChildren ? "button" : "span")',
            'toggle.setAttribute("aria-hidden", "true")',
        }
        for missing_contract in sorted(tree_leaf_required - {
                contract for contract in tree_leaf_required if contract in tree_source}):
            violations.append({
                "code": "SEL_UI_TREE_LEAF_PLACEHOLDER_SEMANTICS_MISSING",
                "path": str(tree_directory.relative_to(project_root)),
                "message": f"selTree leaf alignment placeholder is missing {missing_contract}",
            })

    # 页面编辑必须由 selPersonalization 统一管理，并与 selGrid 的终值事件和宽度快照契约成对存在。
    personalization_entry = component_entries.get("selPersonalization")
    grid_entry = component_entries.get("selGrid")
    window_entry = component_entries.get("selWindow")
    if personalization_entry and grid_entry and window_entry:
        personalization_directory = component_root / personalization_entry["directory"]
        personalization_source = "\n".join(
            (personalization_directory / script).read_text(encoding="utf-8")
            for script in personalization_entry.get("scripts", [])
            if (personalization_directory / script).is_file()
        )
        personalization_style = "\n".join(
            (personalization_directory / style).read_text(encoding="utf-8")
            for style in personalization_entry.get("styles", [])
            if (personalization_directory / style).is_file()
        )
        grid_directory = component_root / grid_entry["directory"]
        grid_source = "\n".join(
            (grid_directory / script).read_text(encoding="utf-8")
            for script in grid_entry.get("scripts", [])
            if (grid_directory / script).is_file()
        )
        grid_style = "\n".join(
            (grid_directory / style).read_text(encoding="utf-8")
            for style in grid_entry.get("styles", [])
            if (grid_directory / style).is_file()
        )
        window_directory = component_root / window_entry["directory"]
        window_source = "\n".join(
            (window_directory / script).read_text(encoding="utf-8")
            for script in window_entry.get("scripts", [])
            if (window_directory / script).is_file()
        )
        window_style = "\n".join(
            (window_directory / style).read_text(encoding="utf-8")
            for style in window_entry.get("styles", [])
            if (window_directory / style).is_file()
        )
        page_editor_required = {
            "registerPageControl: selPersonalizationRegisterPageControl",
            "updatePageControl: selPersonalizationUpdatePageControl",
            "setPageMode: selPersonalizationSetPageMode",
            "data-sel-personal-page-edit-switch",
            'role="switch"',
            "selPersonalizationPageEditSwitch.checked = selPersonalizationEditing",
            "selPersonalizationPageControl.captureState()",
            '<span>保存${selPersonalizationPageControl.typeLabel}</span>',
            "Array.isArray(selPersonalizationDefinition.roots)",
            "Array.isArray(selPersonalizationDefinition.editHosts)",
        }
        for missing_contract in sorted(page_editor_required - {
                contract for contract in page_editor_required
                if contract in personalization_source}):
            violations.append({
                "code": "SEL_UI_PAGE_EDITOR_CONTRACT_MISSING",
                "path": str(personalization_directory.relative_to(project_root)),
                "message": f"selPersonalization page editor is missing {missing_contract}",
            })
        for missing_selector in sorted({
                ".selpersonal-page-edit-switch",
                ".selpersonal-page-control-edit",
        } - {
                selector for selector in {
                    ".selpersonal-page-edit-switch",
                    ".selpersonal-page-control-edit",
                } if selector in personalization_style}):
            violations.append({
                "code": "SEL_UI_PAGE_EDITOR_STYLE_MISSING",
                "path": str(personalization_directory.relative_to(project_root)),
                "message": f"selPersonalization page editor style is missing {missing_selector}",
            })
        for forbidden_contract in {
                "data-sel-personal-page-actions", "data-sel-personal-page-inspector",
                "savePage: selPersonalizationSavePageEditing", "cancelPage: selPersonalizationCancelPageEditing"}:
            if forbidden_contract in personalization_source:
                violations.append({
                    "code": "SEL_UI_PAGE_EDITOR_GLOBAL_ACTION_FORBIDDEN",
                    "path": str(personalization_directory.relative_to(project_root)),
                    "message": f"selPersonalization page switch must not own {forbidden_contract}",
                })
        if "--selpersonal-page-edit-accent: var(--sel-theme-semantic-warning)" not in personalization_style:
            violations.append({
                "code": "SEL_UI_PAGE_EDITOR_BUTTON_ACCENT_MISSING",
                "path": str(personalization_directory.relative_to(project_root)),
                "message": "selPersonalization page edit button must use the dedicated semantic accent",
            })
        if "margin-left: 0;" not in grid_style:
            violations.append({
                "code": "SEL_UI_GRID_PAGE_EDITOR_BUTTON_POSITION_INVALID",
                "path": str(grid_directory.relative_to(project_root)),
                "message": "selGrid page edit button must stay beside the database code",
            })
        grid_page_editor_required = {
            "selGrid:columnResizeChange",
            "captureColumnWidths: selGridCaptureColumnWidths",
            "setColumnWidths: selGridSetColumnWidths",
            "resetColumnWidths: selGridResetColumnWidths",
            'data-sel-grid-role="table-heading"',
            'data-sel-grid-role="table-code"',
        }
        for missing_contract in sorted(grid_page_editor_required - {
                contract for contract in grid_page_editor_required if contract in grid_source}):
            violations.append({
                "code": "SEL_UI_GRID_PAGE_EDITOR_ADAPTER_MISSING",
                "path": str(grid_directory.relative_to(project_root)),
                "message": f"selGrid page editor adapter is missing {missing_contract}",
            })
        window_page_editor_required = {
            "setPageEditMetadata",
            "getPageEditTarget",
            "setDefaultGeometry",
            "getGeometry",
            "selwindow-page-edit-heading",
        }
        for missing_contract in sorted(window_page_editor_required - {
                contract for contract in window_page_editor_required if contract in window_source or contract in window_style}):
            violations.append({
                "code": "SEL_UI_WINDOW_PAGE_EDITOR_ADAPTER_MISSING",
                "path": str(window_directory.relative_to(project_root)),
                "message": f"selWindow page editor adapter is missing {missing_contract}",
            })
        # 表头竖向分隔线属于列的右边界，必须覆盖第一列并仅排除最后一列。
        if ".selgrid-table th:not(:last-child)::after" not in grid_style \
                or ".selgrid-table th:not(:first-child)::after" in grid_style:
            violations.append({
                "code": "SEL_UI_GRID_HEADER_SEPARATOR_BOUNDARY_INVALID",
                "path": str(grid_directory.relative_to(project_root)),
                "message": "selGrid header separators must cover every column except the last column",
            })

    # selPanel 横向工具栏栏目默认使用同一分隔线契约；应用只传宽度，不得复制公共指针生命周期。
    if "selPanel" in component_entries:
        panel_entry = component_entries["selPanel"]
        panel_directory = component_root / panel_entry["directory"]
        panel_source = "\n".join(
            (panel_directory / script).read_text(encoding="utf-8")
            for script in panel_entry.get("scripts", [])
            if (panel_directory / script).is_file()
        )
        panel_style = "\n".join(
            (panel_directory / style).read_text(encoding="utf-8")
            for style in panel_entry.get("styles", [])
            if (panel_directory / style).is_file()
        )
        panel_required = {
            "columnResize !== false", "selpanel-toolbar-column-resizer",
            "selPanel:toolbarColumnResize", "requestAnimationFrame",
            "lostpointercapture", "dblclick",
        }
        panel_style_required = {
            "selpanel-toolbar-column-resizer", "cursor: col-resize",
            "touch-action: none", "selpanel-toolbar-column-resizing",
            ".selpanel-shell[hidden]", ".selpanel-header-actions span",
        }
        for missing_contract in sorted(panel_required - {
                contract for contract in panel_required if contract in panel_source}):
            violations.append({
                "code": "SEL_UI_PANEL_TOOLBAR_RESIZE_CONTRACT_MISSING",
                "path": str(panel_directory.relative_to(project_root)),
                "message": f"selPanel toolbar resize is missing {missing_contract}",
            })
        for missing_contract in sorted(panel_style_required - {
                contract for contract in panel_style_required if contract in panel_style}):
            violations.append({
                "code": "SEL_UI_PANEL_TOOLBAR_RESIZE_STYLE_MISSING",
                "path": str(panel_directory.relative_to(project_root)),
                "message": f"selPanel toolbar resize style is missing {missing_contract}",
            })
        mda_assembler = project_root / "apps/mda/backend/src/main/resources/static/mda/mda.js"
        mda_source = mda_assembler.read_text(encoding="utf-8") if mda_assembler.is_file() else ""
        mda_required = {
            "mdaToolbarOptions", "width: 360", "minWidth: 240",
            "maxWidth: 720", "toolbar: mdaToolbarOptions",
        }
        for missing_contract in sorted(mda_required - {
                contract for contract in mda_required if contract in mda_source}):
            violations.append({
                "code": "SEL_UI_PANEL_TOOLBAR_RESIZE_MDA_CONSUMER_MISSING",
                "path": str(mda_assembler.relative_to(project_root)),
                "message": f"MDA toolbar resize consumer is missing {missing_contract}",
            })

    application_static_files = sorted((project_root / "apps").glob(
        "*/backend/src/main/resources/static/**/*"
    )) if (project_root / "apps").is_dir() else []
    for application_file in application_static_files:
        if not application_file.is_file() or application_file.suffix not in {".js", ".html"}:
            continue
        source_text = application_file.read_text(encoding="utf-8")
        relative_source = str(application_file.relative_to(project_root))
        if application_file.suffix == ".js" and re.search(
                r"\bwindow\s*\.\s*sel[A-Z][A-Za-z0-9]*\s*=", source_text):
            violations.append({
                "code": "SEL_UI_APPLICATION_PRIVATE_PUBLIC_CONTROL",
                "path": relative_source,
                "message": "application code cannot publish a private sel<Component> control",
            })
        if application_file.suffix == ".js" and re.search(
                r"\bwindow\s*\.\s*sel[A-Z][A-Za-z0-9]*", source_text):
            violations.append({
                "code": "SEL_UI_LEGACY_FLAT_API_FORBIDDEN",
                "path": relative_source,
                "message": "application code must consume the namespaced window.sel API",
            })
        if application_file.suffix == ".js" and "Object.freeze" in source_text:
            violations.append({
                "code": "SEL_UI_NATIVE_FREEZE_OUTSIDE_KERNEL",
                "path": relative_source,
                "message": "application code must use sel.core.freeze",
            })
        # 业务应用统一通过 sel.core.element 创建安全节点，避免各页面重复文本和属性写入边界。
        if application_file.suffix == ".js" and re.search(
                r"\bdocument\s*\.\s*createElement\s*\(", source_text):
            violations.append({
                "code": "SEL_UI_APPLICATION_NATIVE_DOM_CREATION_FORBIDDEN",
                "path": relative_source,
                "message": "application code must create DOM nodes through sel.core.element",
            })
        if application_file.suffix == ".js" and has_nested_sel_freeze(source_text):
            violations.append({
                "code": "SEL_UI_NESTED_FREEZE_FORBIDDEN",
                "path": relative_source,
                "message": "selFreeze must be called once at the complete immutable boundary",
            })
        if application_file.suffix == ".js" and "window.sel.require(" in source_text:
            header = "\n".join(source_text.splitlines()[:30])
            if "SEL UI" not in header or not re.search(r"[\u4e00-\u9fff]", header):
                violations.append({
                    "code": "SEL_UI_APPLICATION_COMPONENT_DOCUMENTATION_MISSING",
                    "path": relative_source,
                    "message": "application header must explain SEL UI component purposes in Chinese",
                })
            # 应用入口和公共能力别名保持统一，避免每个项目重新发明一套启动与 API 命名。
            if not re.search(r"\(\s*function\s+app\s*\(", source_text):
                violations.append({
                    "code": "SEL_UI_APPLICATION_ENTRY_NAMING_INVALID",
                    "path": relative_source,
                    "message": "application JavaScript entry must be named app",
                })
            if not re.search(r"\bconst\s+selBase\s*=\s*window\.sel\.core\s*;", source_text):
                violations.append({
                    "code": "SEL_UI_APPLICATION_BASE_ALIAS_MISSING",
                    "path": relative_source,
                    "message": "application JavaScript must alias window.sel.core as selBase",
                })
            if '"net.ajax"' in source_text and not re.search(
                    r"\bajax\s*:\s*selAjax\b", source_text):
                violations.append({
                    "code": "SEL_UI_APPLICATION_AJAX_ALIAS_MISSING",
                    "path": relative_source,
                    "message": "application JavaScript must alias window.sel.net.ajax as selAjax",
                })
            # 具名业务函数前必须有中文契约或中文业务注释，空行不会打断最近注释识别。
            source_lines = source_text.splitlines()
            for line_number, line in enumerate(source_lines, start=1):
                if re.match(r"\s*(?:async\s+)?function\s+[A-Za-z_$]", line):
                    comment_index = line_number - 2
                    while comment_index >= 0 and not source_lines[comment_index].strip():
                        comment_index -= 1
                    comment_lines: list[str] = []
                    if comment_index >= 0 and re.match(r"\s*//", source_lines[comment_index]):
                        comment_lines.append(source_lines[comment_index])
                    elif comment_index >= 0 and "*/" in source_lines[comment_index]:
                        while comment_index >= 0:
                            comment_lines.append(source_lines[comment_index])
                            if "/*" in source_lines[comment_index]:
                                break
                            comment_index -= 1
                    comment_text = "\n".join(reversed(comment_lines))
                    if not comment_text or not re.search(r"[\u4e00-\u9fff]", comment_text):
                        violations.append({
                            "code": "SEL_UI_APPLICATION_FUNCTION_COMMENT_MISSING",
                            "path": relative_source,
                            "message": f"business function at line {line_number} requires a preceding Chinese contract comment",
                        })
        if application_file.suffix == ".js" and "document.body.appendChild" in source_text:
            violations.append({
                "code": "SEL_UI_APPLICATION_PRIVATE_BODY_PORTAL",
                "path": relative_source,
                "message": "body portals belong to a registered shared control",
            })
        # 删除等单步布尔确认必须使用紧凑 selConfirmDialog，禁止把空白 selWindow 当成确认框。
        destructive_window_patterns = (
            r"(?i)\b(?:delete|remove)[A-Za-z0-9_]*(?:window|dialog|confirm)?Controller\s*=\s*window\.selWindow\.mount",
            r"(?i)window\.selWindow\.mount\([^\n]*\n?\s*id\s*:\s*[\"'][^\"']*(?:delete|remove)[^\"']*[\"']",
        )
        if application_file.suffix == ".js" and any(
                re.search(pattern, source_text) for pattern in destructive_window_patterns):
            violations.append({
                "code": "SEL_UI_DESTRUCTIVE_CONFIRMATION_WINDOW_FORBIDDEN",
                "path": relative_source,
                "message": "destructive boolean confirmation must use registered selConfirmDialog, not selWindow",
            })
        # 未实现关联校验时不得在确认文案中虚构“数据库会阻止”，避免用户依据错误风险说明做决定。
        if application_file.suffix == ".js" and "存在关联数据时由数据库阻止不安全操作" in source_text:
            violations.append({
                "code": "SEL_UI_DESTRUCTIVE_CONFIRMATION_MISLEADING_COPY",
                "path": relative_source,
                "message": "destructive confirmation copy must describe implemented relation and delete semantics",
            })
        for aria_role, component_id in owned_aria_roles.items():
            role_pattern = rf"(?:(?<![-\w])role\s*=\s*[\"']{re.escape(aria_role)}[\"']|setAttribute\(\s*[\"']role[\"']\s*,\s*[\"']{re.escape(aria_role)}[\"'])"
            if re.search(role_pattern, source_text):
                violations.append({
                    "code": "SEL_UI_APPLICATION_PRIVATE_OWNED_INTERACTION",
                    "path": relative_source,
                    "message": f"ARIA role {aria_role} must use registered {component_id}",
                })

    dependency_documents = list(application_static_files)
    # 所有应用的 Java 生成模板都进入同一依赖检查，禁止按生成器宿主项目名建立扫描例外。
    dependency_documents.extend(sorted((project_root / "apps").glob(
        "*/backend/src/main/java/**/*.java"
    )))
    for document in dependency_documents:
        if not document.is_file() or document.suffix not in {".html", ".java"}:
            continue
        document_text = document.read_text(encoding="utf-8")
        if document.suffix == ".java" and document_has_nested_sel_freeze(document_text, ".java"):
            violations.append({
                "code": "SEL_UI_NESTED_FREEZE_FORBIDDEN",
                "path": str(document.relative_to(project_root)),
                "message": "generated JavaScript must freeze each complete immutable boundary once",
            })
        sel_script_sources = re.findall(
            r'<script[^>]+src=["\'](/sel/(?:core|theme|components)/[^"\']+\.js)[^"\']*["\']',
            document_text,
        )
        if sel_script_sources and (
                "/sel/core/selKernel.js" not in sel_script_sources
                or sel_script_sources[0] != "/sel/core/selKernel.js"):
            violations.append({
                "code": "SEL_UI_KERNEL_LOAD_ORDER_INVALID",
                "path": str(document.relative_to(project_root)),
                "message": "selKernel.js must load before every other SEL script",
            })
        for component_id, component in component_entries.items():
            own_resources_by_kind = {
                "scripts": [
                    f"/sel/components/{component['directory']}/{source_name}"
                    for source_name in component.get("scripts", [])
                ],
                "styles": [
                    f"/sel/components/{component['directory']}/{source_name}"
                    for source_name in component.get("styles", [])
                ],
            }
            if not any(
                    resource in document_text
                    for resources in own_resources_by_kind.values()
                    for resource in resources):
                continue
            for dependency in component.get("dependencies", []):
                dependency_entry = component_entries.get(dependency)
                if not dependency_entry:
                    continue
                missing_resources: list[str] = []
                late_resources: list[str] = []
                for resource_kind in ("styles", "scripts"):
                    own_kind_resources = own_resources_by_kind[resource_kind]
                    present_own_kind_resources = [
                        resource for resource in own_kind_resources if resource in document_text
                    ]
                    dependency_resources = [
                        f"/sel/components/{dependency_entry['directory']}/{source_name}"
                        for source_name in dependency_entry.get(resource_kind, [])
                    ]
                    missing_resources.extend(
                        resource for resource in dependency_resources if resource not in document_text
                    )
                    if present_own_kind_resources:
                        first_own_kind_index = min(
                            document_text.index(resource)
                            for resource in present_own_kind_resources
                        )
                        late_resources.extend(
                            resource for resource in dependency_resources
                            if resource in document_text
                            and document_text.index(resource) > first_own_kind_index
                        )
                if missing_resources or late_resources:
                    violations.append({
                        "code": "SEL_UI_COMPONENT_DEPENDENCY_RESOURCE_INVALID",
                        "path": str(document.relative_to(project_root)),
                        "message": (
                            f"{component_id} requires {dependency} resources before its own resources; "
                            f"missing={missing_resources}, late={late_resources}"
                        ),
                    })
    source_root = project_root / SEL_UI_SOURCE_ROOT_RELATIVE
    kernel_path = source_root / "core/selKernel.js"
    for shared_script in sorted(source_root.rglob("*.js")):
        if shared_script == kernel_path:
            continue
        shared_source = shared_script.read_text(encoding="utf-8")
        if "Object.freeze" in shared_source:
            violations.append({
                "code": "SEL_UI_NATIVE_FREEZE_OUTSIDE_KERNEL",
                "path": str(shared_script.relative_to(project_root)),
                "message": "shared code must use sel.core.freeze",
            })
        if has_nested_sel_freeze(shared_source):
            violations.append({
                "code": "SEL_UI_NESTED_FREEZE_FORBIDDEN",
                "path": str(shared_script.relative_to(project_root)),
                "message": "shared code must freeze each complete immutable boundary once",
            })
        if re.search(r"\b(?:window|global)\s*\.\s*sel[A-Z][A-Za-z0-9]*", shared_source):
            violations.append({
                "code": "SEL_UI_LEGACY_FLAT_API_FORBIDDEN",
                "path": str(shared_script.relative_to(project_root)),
                "message": "shared code must use the namespaced window.sel API",
            })
    return violations


def managed_database_registry_path(project_root: Path, stable_user_id: str) -> Path:
    """Return the current user's one central managed-database application registry."""
    return (
        project_root / MANAGED_DATABASE_REGISTRY_RELATIVE / stable_user_id
        / "selplat/通用/registry/managed-database-applications.json"
    )


def is_managed_database_application(
        project_root: Path,
        central_registrations: dict[str, dict[str, Any]]) -> bool:
    """Identify every application that owns database SQL or generated database structure."""
    return (
        (project_root / ".selplat-generated-project.json").is_file()
        or (project_root / "db/sql").is_dir()
        or project_root.name in central_registrations
    )


def load_managed_database_registry(
        project_root: Path,
        stable_user_id: str) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    """Load and validate the central registry without inferring applications from directories."""
    registry_path = managed_database_registry_path(project_root, stable_user_id)
    if not registry_path.is_file():
        return {}, [{
            "code": "MANAGED_DATABASE_REGISTRY_MISSING",
            "path": str(registry_path.relative_to(project_root)),
            "message": "the active user's central managed-database registry is required",
        }]
    relative_registry = str(registry_path.relative_to(project_root))
    try:
        document = json.loads(registry_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exception:
        return {}, [{
            "code": "MANAGED_DATABASE_REGISTRY_INVALID",
            "path": relative_registry,
            "message": f"central managed-database registry is unreadable: {exception}",
        }]
    applications = document.get("applications") if isinstance(document, dict) else None
    if not isinstance(document, dict) or document.get("version") != 1 \
            or not isinstance(applications, list):
        return {}, [{
            "code": "MANAGED_DATABASE_REGISTRY_INVALID",
            "path": relative_registry,
            "message": "central managed-database registry requires version 1 and an applications array",
        }]
    registrations: dict[str, dict[str, Any]] = {}
    violations: list[dict[str, str]] = []
    for application in applications:
        project_name = application.get("projectName") if isinstance(application, dict) else None
        if not isinstance(project_name, str) or not re.fullmatch(
                r"[a-z][a-z0-9-]{0,31}", project_name):
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_PROJECT_INVALID",
                "path": relative_registry,
                "message": "every central registration requires a safe lowercase projectName",
            })
            continue
        if project_name in registrations:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_PROJECT_DUPLICATE",
                "path": relative_registry,
                "message": f"projectName {project_name} must be registered exactly once",
            })
            continue
        registrations[project_name] = application
        if "structure" in application:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_SPECIAL_STRUCTURE_FORBIDDEN",
                "path": relative_registry,
                "message": (
                    f"{project_name}.structure is forbidden; every managed application "
                    "must use the same table-business, capability, and common architecture"
                ),
            })
        expected_fixed_values = {"schemaRoot": "db/sql"}
        for field_name, expected_value in expected_fixed_values.items():
            if application.get(field_name) != expected_value:
                violations.append({
                    "code": "MANAGED_DATABASE_REGISTRY_POLICY_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name}.{field_name} must be {expected_value}",
                })
        primary_key_strategy = application.get("primaryKeyStrategy")
        if primary_key_strategy not in {
                "one-table-one-sequence", "aggregate-global-code-sequence"}:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_POLICY_INVALID",
                "path": relative_registry,
                "message": (
                    f"{project_name}.primaryKeyStrategy must be one-table-one-sequence "
                    "or aggregate-global-code-sequence"
                ),
            })
        if primary_key_strategy == "aggregate-global-code-sequence":
            aggregate_sequence_code = application.get("aggregateSequenceCode")
            if not isinstance(aggregate_sequence_code, str) or not re.fullmatch(
                    r"[A-Z][A-Za-z0-9]{1,99}Id", aggregate_sequence_code):
                violations.append({
                    "code": "MANAGED_DATABASE_AGGREGATE_SEQUENCE_REGISTRATION_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name} aggregate strategy requires a safe aggregateSequenceCode",
                })
            if application.get("globalCodeNamespace") is not True:
                violations.append({
                    "code": "MANAGED_DATABASE_AGGREGATE_SEQUENCE_REGISTRATION_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name} aggregate strategy requires globalCodeNamespace=true",
                })
            if application.get("codePrefixStrategy") != "object-kind-plus-global-id":
                violations.append({
                    "code": "MANAGED_DATABASE_CODE_PREFIX_STRATEGY_INVALID",
                    "path": relative_registry,
                    "message": (
                        f"{project_name} aggregate code namespace must use "
                        "codePrefixStrategy=object-kind-plus-global-id"
                    ),
                })
        query_representation_model = application.get("queryRepresentationModel")
        if query_representation_model not in {None, "type-plus-tree-node"}:
            violations.append({
                "code": "MANAGED_DATABASE_QUERY_REPRESENTATION_MODEL_INVALID",
                "path": relative_registry,
                "message": (
                    f"{project_name}.queryRepresentationModel must be type-plus-tree-node "
                    "when an explicit polymorphic node model is used"
                ),
            })
    return registrations, violations


def audit_managed_datasource_pool_governance(
        project_root: Path,
        registrations: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    """Require every centrally managed database application to own one qualified Hikari pool."""
    violations: list[dict[str, str]] = []
    forbidden_source_patterns = {
        "DriverManagerDataSource": "Spring DriverManagerDataSource",
        "SimpleDriverDataSource": "Spring SimpleDriverDataSource",
        "DriverManager.getConnection": "direct DriverManager connection",
        "DataSourceBuilder.create": "untyped DataSourceBuilder creation",
    }
    for project_name, registration in sorted(registrations.items()):
        application_root = project_root / "apps" / project_name
        java_root = application_root / "backend/src/main/java"
        if not java_root.is_dir():
            continue
        java_files = sorted(java_root.rglob("*.java"))
        for java_file in java_files:
            source_text = java_file.read_text(encoding="utf-8")
            for forbidden_pattern, forbidden_name in forbidden_source_patterns.items():
                if forbidden_pattern in source_text:
                    violations.append({
                        "code": "MANAGED_APPLICATION_UNPOOLED_DATASOURCE_FORBIDDEN",
                        "path": str(java_file.relative_to(project_root)),
                        "message": (
                            f"{project_name} uses {forbidden_name}; managed private databases "
                            "must use a qualified HikariDataSource"
                        ),
                    })

        persistence_files = sorted(java_root.rglob("*PersistenceConfiguration.java"))
        datasource_prefix = registration.get("datasourcePrefix")
        hikari_contract_markers = (
            "com.zaxxer.hikari.HikariConfig",
            "com.zaxxer.hikari.HikariDataSource",
            "@ConfigurationProperties",
            "destroyMethod = \"close\"",
            "new HikariDataSource(",
        )
        matching_pool_configuration = None
        for persistence_file in persistence_files:
            source_text = persistence_file.read_text(encoding="utf-8")
            if all(marker in source_text for marker in hikari_contract_markers) \
                    and isinstance(datasource_prefix, str) \
                    and re.search(
                        rf"@ConfigurationProperties\(prefix\s*=\s*\"{re.escape(datasource_prefix)}\"\)",
                        source_text,
                    ):
                matching_pool_configuration = persistence_file
                break
        if matching_pool_configuration is None:
            violations.append({
                "code": "MANAGED_APPLICATION_HIKARI_POOL_CONFIGURATION_MISSING",
                "path": str((application_root / "backend/src/main/java").relative_to(project_root)),
                "message": (
                    f"{project_name} requires one PersistenceConfiguration with qualified "
                    "HikariConfig, HikariDataSource, ConfigurationProperties, and destroyMethod=close"
                ),
            })

        resource_root = application_root / "backend/src/main/resources"
        property_text = "\n".join(
            properties_file.read_text(encoding="utf-8")
            for properties_file in sorted(resource_root.glob("*.properties"))
        ) if resource_root.is_dir() else ""
        required_pool_properties = (
            "jdbc-url",
            "pool-name",
            "driver-class-name",
            "minimum-idle",
            "maximum-pool-size",
        )
        if isinstance(datasource_prefix, str):
            missing_properties = [
                property_name
                for property_name in required_pool_properties
                if not re.search(
                    rf"(?m)^{re.escape(datasource_prefix)}\.{re.escape(property_name)}\s*=",
                    property_text,
                )
            ]
            if missing_properties:
                violations.append({
                    "code": "MANAGED_APPLICATION_HIKARI_POOL_PROPERTIES_MISSING",
                    "path": str(resource_root.relative_to(project_root)),
                    "message": (
                        f"{project_name} datasource pool properties are incomplete: "
                        + ", ".join(missing_properties)
                    ),
                })
    return violations


def audit_frontend_identity_write_governance(
        project_root: Path) -> list[dict[str, str]]:
    """Reject tenant and operator identity fields in application write forms and payloads."""
    violations: list[dict[str, str]] = []
    governed_files = sorted((project_root / "apps").glob(
        "*/backend/src/main/resources/static/**/*.js"
    ))
    generator_template = project_root / APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE
    if generator_template.is_file():
        governed_files.append(generator_template)
    forbidden_patterns = (
        re.compile(r"\bname\s*:\s*[\"'](?:tenantId|lastOperateUserId)[\"']"),
        re.compile(r"\b(?:tenantId|lastOperateUserId)\s*:"),
    )
    for source_path in governed_files:
        source_text = source_path.read_text(encoding="utf-8")
        if any(pattern.search(source_text) for pattern in forbidden_patterns):
            violations.append({
                "code": "FRONTEND_IDENTITY_WRITE_FIELD_FORBIDDEN",
                "path": str(source_path.relative_to(project_root)),
                "message": (
                    "tenantId and lastOperateUserId belong to BaseServiceImpl; "
                    "application forms and write payloads must not submit them"
                ),
            })
    return violations


def audit_service_direct_jdbc_governance(project_root: Path) -> list[dict[str, str]]:
    """Reject direct JdbcTemplate access from application business and capability Services."""
    violations: list[dict[str, str]] = []
    service_files = sorted((project_root / "apps").glob(
        "*/backend/src/main/java/**/service/**/*.java"
    ))
    for service_file in service_files:
        source_text = service_file.read_text(encoding="utf-8")
        if "org.springframework.jdbc.core.JdbcTemplate" not in source_text:
            continue
        violations.append({
            "code": "APPLICATION_SERVICE_DIRECT_JDBC_FORBIDDEN",
            "path": str(service_file.relative_to(project_root)),
            "message": (
                "application Service must query through its table business Service/BaseDao; "
                "direct JdbcTemplate belongs only to persistence or migration infrastructure"
            ),
        })
    return violations


def normalized_identifier(value: str) -> str:
    """Normalize table, project, and package names for stable ownership comparison."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def sql_statements(sql_text: str) -> list[str]:
    """Return executable SQL statements without splitting semicolons inside quoted values."""
    without_comments = re.sub(r"(?m)--[^\r\n]*$", "", sql_text)
    statements: list[str] = []
    current: list[str] = []
    in_single_quote = False
    index = 0
    while index < len(without_comments):
        character = without_comments[index]
        current.append(character)
        if character == "'":
            if in_single_quote and index + 1 < len(without_comments) \
                    and without_comments[index + 1] == "'":
                current.append(without_comments[index + 1])
                index += 1
            else:
                in_single_quote = not in_single_quote
        elif character == ";" and not in_single_quote:
            statement = "".join(current[:-1]).strip()
            if statement:
                statements.append(statement)
            current = []
        index += 1
    trailing_statement = "".join(current).strip()
    if trailing_statement:
        statements.append(trailing_statement)
    return statements


def table_business_candidates(table_name: str, project_name: str) -> set[str]:
    """Return allowed business directory names for one real schema table."""
    normalized_table = normalized_identifier(table_name)
    normalized_project = normalized_identifier(project_name)
    candidates = {normalized_table}
    if normalized_table.startswith(normalized_project):
        candidates.add(normalized_table[len(normalized_project):])
    return {candidate for candidate in candidates if candidate}


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
    # 公共控件登记、源码所有权、依赖顺序和应用私造控件 → 在其他工程扫描前统一阻断。
    violations.extend(audit_sel_ui_component_governance(project_root))
    # 公共组件与应用文字必须消费七级语义角色，旧 primary/secondary 令牌不能重新进入源码。
    violations.extend(audit_sel_ui_typography_governance(project_root))
    central_registrations, registry_violations = load_managed_database_registry(
        project_root, stable_user_id
    )
    violations.extend(registry_violations)
    # 中央登记中的永久业务库 → 必须通过可关闭的具名 Hikari 池访问，禁止再次退回逐次建连。
    violations.extend(audit_managed_datasource_pool_governance(
        project_root, central_registrations
    ))
    # 表业务与 capability Service 只能编排业务 Service/BaseDao，禁止重新手写 JdbcTemplate 查询。
    violations.extend(audit_service_direct_jdbc_governance(project_root))
    # 租户与操作员只由 BaseServiceImpl 写入；应用页面和生成页面不得重新提交同名身份字段。
    violations.extend(audit_frontend_identity_write_governance(project_root))
    generator_template = project_root / APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE
    if generator_template.is_file():
        template_text = generator_template.read_text(encoding="utf-8")
        schema_start = template_text.find("private static String tableSchema()")
        schema_end = template_text.find("private static String daoJava()", schema_start)
        schema_template = (
            template_text[schema_start:schema_end]
            if schema_start >= 0 and schema_end > schema_start
            else ""
        )
        missing_default_fields = [
            field_name
            for field_name in GENERATED_BUSINESS_DEFAULT_FIELDS
            if not re.search(rf"(?m)^\s*{re.escape(field_name)}\s+", schema_template)
        ]
        if missing_default_fields or re.search(r"(?m)^\s*name\s+", schema_template):
            violations.append({
                "code": "APPLICATION_SCAFFOLD_DEFAULT_BUSINESS_FIELDS_INVALID",
                "path": str(APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE),
                "message": (
                    "generated business tables require tenantId, lastOperateUserId, sortnum, "
                    "labelZh, labelJa, labelEn, status, createdAt, and updatedAt; "
                    f"missing={missing_default_fields} and legacy name is forbidden"
                ),
            })
    root_gitignore = project_root / ".gitignore"
    root_gitignore_lines = {
        line.strip()
        for line in root_gitignore.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    } if root_gitignore.is_file() else set()
    required_h2_ignore_rules = {
        "*.trace.db",
        "*.lock.db",
        "*.temp.db",
        "*.before-*.db",
    }
    forbidden_mvdb_ignore_rules = {
        "*.mv.db",
        "**/*.mv.db",
        "apps/*/db/*.mv.db",
    }
    if not required_h2_ignore_rules.issubset(root_gitignore_lines) \
            or forbidden_mvdb_ignore_rules.intersection(root_gitignore_lines):
        violations.append({
            "code": "ROOT_H2_GITIGNORE_POLICY_INVALID",
            "path": ".gitignore",
            "message": (
                "root .gitignore must not hide mv.db files and must exclude H2 trace, lock, temp, and before-backup files"
            ),
        })
    checked_language_roots = 0

    for area_name in ("apps", "shared"):
        area_root = project_root / area_name
        if not area_root.exists():
            continue
        for nested_gitignore in sorted(area_root.rglob(".gitignore")):
            violations.append({
                "code": "NESTED_GITIGNORE_FORBIDDEN",
                "path": str(nested_gitignore.relative_to(project_root)),
                "message": "all repository ignore rules belong only in the SELPLAT root .gitignore",
            })

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
        for registered_project in sorted(central_registrations):
            if not (apps_root / registered_project).is_dir():
                violations.append({
                    "code": "MANAGED_DATABASE_REGISTERED_PROJECT_MISSING",
                    "path": str(managed_database_registry_path(
                        project_root, stable_user_id).relative_to(project_root)),
                    "message": f"centrally registered application apps/{registered_project} is missing",
                })
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
            if "domain" in relative_source.parts:
                violations.append({
                    "code": "APPLICATION_UNUSED_TABLE_DOMAIN_TYPE",
                    "path": str(relative_source),
                    "message": (
                        "application CRUD must use CommonParam, maps, and database metadata; "
                        "do not generate an unreferenced table-mirror domain type"
                    ),
                })

        for project_root_path in sorted(path for path in apps_root.iterdir() if path.is_dir()):
            legacy_local_registration = (
                project_root_path / ".selplat-managed-database-application.json"
            )
            if legacy_local_registration.is_file():
                violations.append({
                    "code": "MANAGED_DATABASE_APPLICATION_LOCAL_REGISTRY_FORBIDDEN",
                    "path": str(legacy_local_registration.relative_to(project_root)),
                    "message": "managed database application facts belong only in the central registry",
                })
            if not is_managed_database_application(project_root_path, central_registrations):
                continue
            service_contracts: dict[str, list[Path]] = {}
            service_implementations: dict[str, list[Path]] = {}
            registration = central_registrations.get(project_root_path.name, {})
            registered_database = project_root_path.name in central_registrations
            if not registered_database:
                violations.append({
                    "code": "MANAGED_DATABASE_APPLICATION_CENTRAL_REGISTRATION_MISSING",
                    "path": str(project_root_path.relative_to(project_root)),
                    "message": (
                        "every generated application or application with db/sql must be registered "
                        "centrally before the uniform architecture gate can pass"
                    ),
                })
            if registered_database:
                for root_entry in sorted(project_root_path.iterdir()):
                    if root_entry.name not in MANAGED_APPLICATION_ROOT_ALLOWLIST:
                        violations.append({
                            "code": "MANAGED_DATABASE_APPLICATION_ROOT_CONTENT_FORBIDDEN",
                            "path": str(root_entry.relative_to(project_root)),
                            "message": (
                                "managed database applications may contain only their real "
                                "backend, frontend, db, doc, README, root build, and generator ownership"
                            ),
                        })
            backend_java_root = project_root_path / "backend/src/main/java"
            application_package_roots = sorted(
                path for path in (backend_java_root / "com/sp/selplat").glob("*")
                if path.is_dir()
            )
            business_directories: list[Path] = []
            capability_directories: list[Path] = []
            for application_package_root in application_package_roots:
                business_directories.extend(sorted(
                    path for path in application_package_root.iterdir()
                    if path.is_dir() and path.name not in {"common", "capability"}
                ))
                capability_root = application_package_root / "capability"
                if capability_root.is_dir():
                    capability_directories.extend(sorted(
                        path for path in capability_root.iterdir() if path.is_dir()
                    ))
            schema_tables = {
                schema_file.stem.removeprefix("schema-")
                for schema_file in (project_root_path / "db/sql").glob("schema-*.sql")
            }
            if registered_database:
                contract_root = project_root_path / "contract"
                if contract_root.is_dir():
                    contract_package = normalized_identifier(project_root_path.name)
                    external_contract_import = f"com.sp.selplat.{contract_package}.contract."
                    external_contract_callers = [
                        java_file
                        for java_file in sorted(apps_root.rglob("*.java"))
                        if not java_file.is_relative_to(project_root_path)
                        and external_contract_import in java_file.read_text(encoding="utf-8")
                    ]
                    if not external_contract_callers:
                        violations.append({
                            "code": "MANAGED_APPLICATION_UNUSED_CONTRACT_MODULE",
                            "path": str(contract_root.relative_to(project_root)),
                            "message": (
                                "application contract modules require a real external production Java caller; "
                                "internal response shapes must use shared CommonResult and Map/List"
                            ),
                        })
                manifest_root = project_root_path / "manifest"
                if manifest_root.is_dir():
                    manifest_consumer = registration.get("manifestConsumer")
                    consumer_file = (
                        project_root / manifest_consumer
                        if isinstance(manifest_consumer, str) and manifest_consumer.strip()
                        else None
                    )
                    consumer_is_valid = (
                        consumer_file is not None
                        and consumer_file.resolve().is_relative_to(project_root)
                        and consumer_file.is_file()
                        and "src/main" in consumer_file.as_posix()
                        and "manifest/module.json" in consumer_file.read_text(encoding="utf-8")
                    )
                    if not consumer_is_valid:
                        violations.append({
                            "code": "MANAGED_APPLICATION_UNUSED_MANIFEST_DIRECTORY",
                            "path": str(manifest_root.relative_to(project_root)),
                            "message": (
                                "application manifest requires a root-relative manifestConsumer "
                                "that is a real src/main reader of manifest/module.json"
                            ),
                        })
                expected_database_file = f"db/{project_root_path.name}.mv.db"
                registry_path = managed_database_registry_path(project_root, stable_user_id)
                if registration.get("databaseFile") != expected_database_file:
                    violations.append({
                        "code": "MANAGED_APPLICATION_DATABASE_FILE_REGISTRATION_INVALID",
                        "path": str(registry_path.relative_to(project_root)),
                        "message": f"databaseFile must be {expected_database_file}",
                    })
                datasource_prefix = registration.get("datasourcePrefix")
                if not isinstance(datasource_prefix, str) or not re.fullmatch(
                        r"[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+", datasource_prefix):
                    violations.append({
                        "code": "MANAGED_APPLICATION_DATASOURCE_PREFIX_INVALID",
                        "path": str(registry_path.relative_to(project_root)),
                        "message": "strict database applications must declare a safe datasourcePrefix",
                    })
                else:
                    resource_root = project_root_path / "backend/src/main/resources"
                    property_text = "\n".join(
                        properties_file.read_text(encoding="utf-8")
                        for properties_file in sorted(resource_root.glob("*.properties"))
                    ) if resource_root.is_dir() else ""
                    expected_credentials = {
                        f"{datasource_prefix}.username": "sa",
                        f"{datasource_prefix}.password": "123456",
                    }
                    for property_name, expected_value in expected_credentials.items():
                        property_matches = re.findall(
                            rf"(?m)^{re.escape(property_name)}\s*=\s*([^\r\n]*)$",
                            property_text,
                        )
                        if property_matches != [expected_value]:
                            violations.append({
                                "code": "MANAGED_APPLICATION_DEFAULT_DATABASE_CREDENTIAL_INVALID",
                                "path": str(resource_root.relative_to(project_root)),
                                "message": f"{property_name} must be declared exactly once as {expected_value}",
                            })
                for database_file in sorted((project_root_path / "db").rglob("*.mv.db")):
                    if database_file.parent != project_root_path / "db" \
                            or database_file.name != f"{project_root_path.name}.mv.db":
                        violations.append({
                            "code": "MANAGED_APPLICATION_DATABASE_FILE_LOCATION_INVALID",
                            "path": str(database_file.relative_to(project_root)),
                            "message": "the permanent H2 file must be db/<application-name>.mv.db",
                        })
                common_sequence_schema = project_root_path / "db/sql/schema-CommonSequenceSegment.sql"
                common_sequence_data = project_root_path / "db/sql/data-CommonSequenceSegment.sql"
                if not common_sequence_schema.is_file() or not common_sequence_data.is_file():
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_SEQUENCE_SQL_MISSING",
                        "path": str((project_root_path / "db/sql").relative_to(project_root)),
                        "message": "strict database applications require CommonSequenceSegment schema and data SQL",
                    })
                else:
                    sequence_data_text = common_sequence_data.read_text(encoding="utf-8")
                    sequence_insert_heads = [
                        statement.split("WHERE NOT EXISTS", 1)[0]
                        for statement in sequence_data_text.split(";")
                        if re.search(r"INSERT\s+INTO\s+CommonSequenceSegment", statement, re.IGNORECASE)
                    ]
                    # 普通应用保持一表一号段；共享全局 code 命名空间的聚合应用只允许登记一个显式聚合号段。
                    if sequence_insert_heads:
                        if registration.get("primaryKeyStrategy") == "aggregate-global-code-sequence":
                            sequence_code = str(registration.get("aggregateSequenceCode", ""))
                            declaration_count = sum(1 for insert_head in sequence_insert_heads
                                if re.search(rf"['\"]{re.escape(sequence_code)}['\"]", insert_head))
                            if declaration_count != 1 or len(sequence_insert_heads) != 1:
                                violations.append({
                                    "code": "MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID",
                                    "path": str(common_sequence_data.relative_to(project_root)),
                                    "message": f"aggregate code namespace must declare exactly one {sequence_code} row",
                                })
                        else:
                            for table_name in sorted(schema_tables):
                                if table_name.startswith("Common"):
                                    continue
                                sequence_code = f"{table_name}Id"
                                declaration_count = sum(1 for insert_head in sequence_insert_heads
                                    if re.search(rf"['\"]{re.escape(sequence_code)}['\"]", insert_head))
                                if declaration_count != 1:
                                    violations.append({
                                        "code": "MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID",
                                        "path": str(common_sequence_data.relative_to(project_root)),
                                        "message": f"configured sequence data must map {table_name} to exactly one {sequence_code} row",
                                    })
                for table_name in sorted(schema_tables):
                    schema_file = project_root_path / "db/sql" / f"schema-{table_name}.sql"
                    schema_text = schema_file.read_text(encoding="utf-8")
                    if not table_name.startswith("Common") and re.search(
                            r"\bid\s+BIGINT\s+GENERATED\b", schema_text, re.IGNORECASE):
                        violations.append({
                            "code": "MANAGED_APPLICATION_BUSINESS_IDENTITY_FORBIDDEN",
                            "path": str(schema_file.relative_to(project_root)),
                            "message": "business table ids must use the registered SequenceGenerator strategy, not database identity",
                        })
                    for statement in sql_statements(schema_text):
                        normalized_statement = re.sub(r"\s+", " ", statement).upper()
                        if normalized_statement.startswith("CREATE TABLE ") \
                                and not normalized_statement.startswith("CREATE TABLE IF NOT EXISTS "):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_CREATE_NOT_IDEMPOTENT",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "schema CREATE TABLE must use IF NOT EXISTS",
                            })
                        if normalized_statement.startswith("CREATE INDEX ") \
                                and not normalized_statement.startswith("CREATE INDEX IF NOT EXISTS "):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_INDEX_NOT_IDEMPOTENT",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "schema CREATE INDEX must use IF NOT EXISTS",
                            })
                        if re.match(
                                r"^(DROP\s+(TABLE|SCHEMA|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM)",
                                normalized_statement):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_DESTRUCTIVE_REFRESH_FORBIDDEN",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "startup schema SQL must not clear or drop existing database content",
                            })
                        if normalized_statement.startswith("ALTER TABLE ") \
                                and " IF EXISTS" not in normalized_statement \
                                and " IF NOT EXISTS" not in normalized_statement:
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_ALTER_NOT_IDEMPOTENT",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "startup ALTER TABLE must include IF EXISTS or IF NOT EXISTS",
                            })
                for data_file in sorted((project_root_path / "db/sql").glob("data-*.sql")):
                    for statement in sql_statements(data_file.read_text(encoding="utf-8")):
                        normalized_statement = re.sub(r"\s+", " ", statement).upper()
                        # 显式 id 种子只能占用最多六位的应用初始区，阻断历史 900000004003 一类超长固定编号。
                        seed_id_match = re.search(
                            r"INSERT\s+INTO\s+\w+\s*\(\s*id\b[^)]*\)\s*SELECT\s+(\d+)\b",
                            statement,
                            re.IGNORECASE | re.DOTALL,
                        )
                        if seed_id_match and int(seed_id_match.group(1)) > 999999:
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_ID_TOO_LONG",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "fixed startup seed ids must not exceed the six-digit initial range",
                            })
                        if normalized_statement.startswith("MERGE INTO "):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_MERGE_OVERWRITE_FORBIDDEN",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "startup seed SQL must not MERGE over existing rows",
                            })
                        if normalized_statement.startswith("INSERT INTO ") \
                                and "NOT EXISTS" not in normalized_statement:
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_INSERT_NOT_IDEMPOTENT",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "seed INSERT must add only a missing stable business coordinate",
                            })
                        if re.match(
                                r"^(UPDATE|DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+|ALTER\s+|CREATE\s+)",
                                normalized_statement):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_EXISTING_DATA_WRITE_FORBIDDEN",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "startup data SQL may only insert missing rows or execute read-only no-op SQL",
                            })
            table_candidates = {
                table_name: table_business_candidates(table_name, project_root_path.name)
                for table_name in schema_tables
            }
            business_names = {
                normalized_identifier(directory.name): directory
                for directory in business_directories
            }
            for business_name, business_directory in business_names.items():
                if not any(business_name in candidates for candidates in table_candidates.values()):
                    violations.append({
                        "code": "MANAGED_APPLICATION_BUSINESS_WITHOUT_TABLE",
                        "path": str(business_directory.relative_to(project_root)),
                        "message": "common-external business directories must map to one real schema table",
                    })
                actual_roles = {
                    path.name for path in business_directory.iterdir() if path.is_dir()
                }
                if actual_roles != MANAGED_TABLE_BUSINESS_ROLES:
                    violations.append({
                        "code": "MANAGED_APPLICATION_TABLE_BUSINESS_ROLE_SET_INVALID",
                        "path": str(business_directory.relative_to(project_root)),
                        "message": (
                            "each table business must contain exactly controller, service, and dao; "
                            "service/impl remains the only nested implementation role"
                        ),
                    })
            for capability_directory in capability_directories:
                actual_roles = {
                    path.name for path in capability_directory.iterdir() if path.is_dir()
                }
                if actual_roles != MANAGED_CAPABILITY_ROLES:
                    violations.append({
                        "code": "MANAGED_APPLICATION_CAPABILITY_ROLE_SET_INVALID",
                        "path": str(capability_directory.relative_to(project_root)),
                        "message": (
                            "each non-persistent capability must contain exactly controller and "
                            "service; reusable implementation helpers belong below common/util"
                        ),
                    })
            for table_name, candidates in table_candidates.items():
                if table_name.startswith("Common"):
                    continue
                if not candidates.intersection(business_names):
                    violations.append({
                        "code": "MANAGED_APPLICATION_TABLE_WITHOUT_BUSINESS",
                        "path": str((project_root_path / "db/sql" / f"schema-{table_name}.sql")
                                    .relative_to(project_root)),
                        "message": "each business schema table must have one common-external business directory",
                    })
            for java_file in sorted(backend_java_root.rglob("*.java")):
                relative_source = java_file.relative_to(project_root)
                parts = relative_source.parts
                try:
                    java_index = parts.index("java")
                except ValueError:
                    continue
                package_tail = parts[java_index + 5:]
                source_text = java_file.read_text(encoding="utf-8")
                type_declaration = re.search(
                    r"\b(?:public\s+)?(?:class|interface|record|enum)\s+", source_text
                )
                declaration_header = (
                    source_text[:type_declaration.start()] if type_declaration else source_text
                )
                if (len(package_tail) >= 3
                        and package_tail[0] in BUSINESS_TECHNICAL_LAYER_NAMES):
                    violations.append({
                        "code": "MANAGED_APPLICATION_TECHNICAL_FIRST_PACKAGE",
                        "path": str(relative_source),
                        "message": (
                            "managed database applications must use <business>/"
                            "controller|service|dao|verified-extension, while reusable infrastructure "
                            "belongs below common"
                        ),
                    })
                if (len(package_tail) >= 3
                        and package_tail[0] == "common"
                        and package_tail[1] not in MANAGED_COMMON_ROLE_NAMES):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_ROLE_OUTSIDE_ALLOWLIST",
                        "path": str(relative_source),
                        "message": (
                            "managed application common packages are limited to config, "
                            "persistence, and util/<actual-capability>"
                        ),
                    })
                if (len(package_tail) == 3
                        and package_tail[0] == "common"
                        and package_tail[1] == "persistence"
                        and not java_file.stem.endswith(MANAGED_COMMON_PERSISTENCE_SUFFIXES)):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_PERSISTENCE_ROLE_INVALID",
                        "path": str(relative_source),
                        "message": (
                            "managed application common/persistence is limited to the project "
                            "BaseDao and PersistenceConfiguration; inject qualified infrastructure "
                            "beans instead of creating database context wrapper classes"
                        ),
                    })
                if (len(package_tail) >= 3
                        and package_tail[0] == "common"
                        and package_tail[1] == "util"
                        and (java_file.stem.endswith(("Controller", "Service", "Dao"))
                             or re.search(
                                 r"@(RestController|Service|Repository)\b", declaration_header
                             ))):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_UTIL_BUSINESS_ROLE",
                        "path": str(relative_source),
                            "message": "common/util is limited to stateless methods called by services",
                    })
                if package_tail and package_tail[0] == "capability":
                    valid_capability_source = (
                        len(package_tail) == 4
                        and package_tail[2] in MANAGED_CAPABILITY_ROLES
                    ) or (
                        len(package_tail) == 5
                        and package_tail[2] == "service"
                        and package_tail[3] == "impl"
                    )
                    if not valid_capability_source:
                        violations.append({
                            "code": "MANAGED_APPLICATION_CAPABILITY_SOURCE_ROLE_INVALID",
                            "path": str(relative_source),
                            "message": (
                                "capability source belongs only in <capability>/controller, "
                                "<capability>/service, or <capability>/service/impl"
                            ),
                        })
                if (len(package_tail) >= 3
                        and package_tail[0] not in {"common", "capability"}):
                    current_business = package_tail[0]
                    current_role = package_tail[1]
                    application_package = parts[java_index + 4]
                    imported_roles = re.findall(
                        r"import\s+com\.sp\.selplat\.[^.]+\.([^.]+)\.(dao|service)\.",
                        source_text,
                    )
                    if (current_role == "controller"
                            and any(role == "service" and business != current_business
                                    for business, role in imported_roles)):
                        violations.append({
                            "code": "MANAGED_APPLICATION_CONTROLLER_FOREIGN_SERVICE",
                            "path": str(relative_source),
                            "message": "table controllers may call only their own table service",
                        })
                    if (current_role == "service"
                            and any(role == "dao" and business != current_business
                                    for business, role in imported_roles)):
                        violations.append({
                            "code": "MANAGED_APPLICATION_CROSS_TABLE_DAO_ACCESS",
                            "path": str(relative_source),
                            "message": "cross-table workflows must call the other table service, not its dao",
                        })
                    application_util_package = f"com.sp.selplat.{application_package}.common.util."
                    if application_util_package in source_text and current_role != "service":
                        violations.append({
                            "code": "MANAGED_APPLICATION_COMMON_UTIL_CALLED_OUTSIDE_SERVICE",
                            "path": str(relative_source),
                            "message": "application common utilities are provided to table services only",
                        })
                if (len(package_tail) >= 3 and package_tail[0] == "capability"):
                    application_package = parts[java_index + 4]
                    application_util_package = f"com.sp.selplat.{application_package}.common.util."
                    if application_util_package in source_text and package_tail[2] != "service":
                        violations.append({
                            "code": "MANAGED_APPLICATION_COMMON_UTIL_CALLED_OUTSIDE_SERVICE",
                            "path": str(relative_source),
                            "message": "application common utilities are provided to capability services only",
                        })
                if (len(package_tail) == 3
                        and package_tail[0] not in {"common", "capability"}
                        and package_tail[1] == "service"
                        and java_file.stem.endswith("Service")):
                    service_contracts.setdefault(package_tail[0], []).append(java_file)
                if (len(package_tail) == 4
                        and package_tail[0] != "common"
                        and package_tail[1] == "service"
                        and package_tail[2] == "impl"
                        and java_file.stem.endswith("ServiceImpl")):
                    service_implementations.setdefault(package_tail[0], []).append(java_file)
                if (len(package_tail) == 4
                        and package_tail[0] == "capability"
                        and package_tail[2] == "service"
                        and java_file.stem.endswith("Service")):
                    service_contracts.setdefault(
                        f"capability/{package_tail[1]}", []
                    ).append(java_file)
                if (len(package_tail) == 5
                        and package_tail[0] == "capability"
                        and package_tail[2] == "service"
                        and package_tail[3] == "impl"
                        and java_file.stem.endswith("ServiceImpl")):
                    service_implementations.setdefault(
                        f"capability/{package_tail[1]}", []
                    ).append(java_file)
                if "controller" in package_tail:
                    representations = {
                        name for name, path_suffix in QUERY_REPRESENTATION_PATHS.items()
                        if path_suffix in source_text
                    }
                    uses_polymorphic_node_model = (
                        registration.get("queryRepresentationModel") == "type-plus-tree-node"
                    )
                    if len(representations) > 1 and not uses_polymorphic_node_model:
                        violations.append({
                            "code": "MANAGED_APPLICATION_QUERY_REPRESENTATIONS_MIXED_CONTROLLER",
                            "path": str(relative_source),
                            "message": (
                                "mixed tree, options, and context-menu HTTP representations require "
                                "an explicit type-plus-tree-node central registration"
                            ),
                        })

            for business in sorted(service_contracts.keys() | service_implementations.keys()):
                contracts = service_contracts.get(business, [])
                implementations = service_implementations.get(business, [])
                if len(contracts) == 1 and len(implementations) == 1:
                    continue
                violations.append({
                    "code": "MANAGED_APPLICATION_BUSINESS_SERVICE_CARDINALITY",
                    "path": str(project_root_path.relative_to(project_root) / business / "service"),
                    "message": (
                        "each managed business must have exactly one Service contract and "
                        "one service/impl implementation"
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
