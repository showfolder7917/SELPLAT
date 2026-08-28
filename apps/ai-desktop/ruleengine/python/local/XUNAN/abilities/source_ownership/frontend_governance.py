"""审查 SEL UI、前端身份字段和浏览器资源治理。"""

from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any


APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE = Path(
    "apps/mda/backend/src/main/java/com/sp/selplat/mda/common/util/projectgenerator/"
    "MdaProjectTemplateCatalog.java"
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
    "source-boundary", "namespaced-public-api", "kernel-first", "theme-contract",
    "dependency-order", "application-private-control",
}


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
