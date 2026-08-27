"""规则引擎 Python 分层加载能力。

当前按 core、空预留 common、当前用户的顺序加载规则；未来 common 经审查
恢复实体后，仍兼容跨工程 common 与单一 common 作用域。该模块同时提供
依赖闭包、加载回执和分级索引完整性校验，是无需启动 JVM 的唯一生产实现。
"""

from __future__ import annotations

# 导入 json，为 ability 执行入口提供稳定的可序列化结果。
import json
# 导入 os，让直接执行入口可以读取当前线程与 UTF-8 运行环境。
import os
# 导入 re，校验用户、作用域、逻辑 ID 和 DSL 键。
import re
# 导入 sys，统一直接执行时的退出码。
import sys
# 导入 dataclass，表达不可变的规则加载结果。
from dataclasses import asdict, dataclass
# 导入 lru_cache，复用未变化的 UTF-8 资源读取结果，减少同任务重复磁盘访问。
from functools import lru_cache
# 导入 Path 与 PurePosixPath，分别处理本机路径和资源标准路径。
from pathlib import Path, PurePosixPath
# 导入 Callable，声明测试资源读取器和规则栈提供器契约。
from typing import Any, Callable


# 从当前代码位置向上识别工程根，禁止提交机器绝对路径。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 规则资源统一从 rule-engine 的标准 resources source set 读取。
RESOURCE_ROOT = PROJECT_ROOT / "apps/ai-desktop/ruleengine/rules"
# 根索引是 core 规则、common 汇总和用户入口模式的唯一全局入口。
ROOT_INDEX = "RULE_INDEX.md"
# 根索引必须通过稳定键进入 common 汇总索引。
COMMON_INDEX_KEY = "COMMON_RULE_INDEX"
# common 汇总索引必须通过稳定键进入跨工程规则基线。
CROSS_PROJECT_INDEX_KEY = "CROSS_PROJECT_COMMON_RULE_INDEX"
# common 汇总索引使用状态键声明是否只有预留入口。
COMMON_INDEX_STATUS_KEY = "common_index_status"
# common 实体全部迁回当前用户后，reserved_empty 表示跳过公共子树。
RESERVED_EMPTY_COMMON_STATUS = "reserved_empty"
# 根索引只允许登记一个动态用户索引模式。
USER_INDEX_PATTERN_KEY = "USER_RULE_INDEX_PATTERN"
# 当前用户只能替换索引模式中的这个稳定占位符。
USER_ID_PLACEHOLDER = "<stable-user-id>"
# 分级索引最多递归 16 层，避免异常结构耗尽调用栈。
MAX_INDEX_DEPTH = 16
# ability 注册标识供 core executor 统一调用。
ABILITY_ID = "layered_rule_loader"

# 用户标识只允许路径安全的 ASCII 稳定字符。
USER_ID_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}")
# 工程根 AGENTS.md 是当前稳定用户的唯一事实源。
ACTIVE_USER_DECLARATION = re.compile(r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$")
# common 一级作用域允许中英文、数字、下划线和连字符。
SCOPE_PATTERN = re.compile(r"[^\W_][\w-]{0,63}", re.UNICODE)
# 规则逻辑 ID 和索引汇总键统一使用稳定大写格式。
LOGICAL_ID_PATTERN = re.compile(r"[A-Z][A-Z0-9_]{1,127}")
# 规则 DSL 键只接受稳定标识字符，避免误读 Markdown 示例。
RULE_VALUE_KEY_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_.-]{0,127}")


class RuleLoadingError(OSError):
    """表示索引、身份、依赖或规则资源违反闭锁加载约束。"""


@dataclass(frozen=True)
class LoadedRule:
    """表示一个逻辑 ID 在真实物理层命中的完整 UTF-8 规则。"""

    logical_id: str
    layer: str
    resource_path: str
    content: str


@dataclass(frozen=True)
class RuleStack:
    """表示同一逻辑 ID 的全部已读层和最终有效结果。"""

    logical_id: str
    layers: tuple[LoadedRule, ...]
    effective_values: dict[str, str]
    override_mode: str
    effective_rule: LoadedRule


@dataclass(frozen=True)
class LoadedRuleBundle:
    """表示依赖在前、请求规则在后的任务规则闭包。"""

    rules: dict[str, RuleStack]
    receipt: tuple[str, ...]


@dataclass(frozen=True)
class IndexValidation:
    """表示完整分级索引验证得到的索引和规则计数。"""

    index_count: int
    rule_count: int


@dataclass(frozen=True)
class RuleRegistration:
    """保存逻辑 ID 的权威叶子索引和规则资源路径。"""

    index_path: str
    resource_path: str


ResourceProvider = Callable[[str], str]
RuleStackProvider = Callable[[str], RuleStack | None]


def current_stable_user_id() -> str:
    """从工程根 AGENTS.md 读取并校验唯一当前稳定用户。"""

    # 身份只读取唯一工程根文件，禁止扫描 local 目录猜测用户。
    agents_text = (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    matches = ACTIVE_USER_DECLARATION.findall(agents_text)
    # 缺失或重复声明都无法建立唯一用户层，必须闭锁失败。
    if len(matches) != 1:
        raise RuleLoadingError(
            "Current stable user id must be declared exactly once in AGENTS.md."
        )
    active_user = matches[0].strip()
    # 身份进入索引路径前执行统一安全校验。
    _validate_active_user(active_user)
    return active_user


def load_for_current_user(logical_id: str, active_scope: str | None) -> LoadedRule:
    """使用 AGENTS.md 当前稳定用户加载一个逻辑 ID。"""

    return load(logical_id, active_scope, current_stable_user_id())


def load_bundle_for_current_user(
    logical_ids: list[str] | tuple[str, ...],
    active_scope: str | None,
) -> LoadedRuleBundle:
    """使用当前稳定用户加载任务规则及其显式依赖闭包。"""

    return load_bundle(logical_ids, active_scope, current_stable_user_id())


def load(
    logical_id: str,
    active_scope: str | None = None,
    active_user: str | None = None,
) -> LoadedRule:
    """加载并合并一个逻辑 ID，返回最高优先级层承载的有效规则。"""

    return load_rule_stack(logical_id, active_scope, active_user).effective_rule


def load_rule_stack(
    logical_id: str,
    active_scope: str | None = None,
    active_user: str | None = None,
) -> RuleStack:
    """按低到高优先级加载一个逻辑 ID 的全部相关分层。"""

    # 所有调用参数先校验，禁止把任意路径伪装成规则入口。
    _validate_logical_id(logical_id)
    _validate_active_user(active_user)
    _validate_active_scope(active_scope)
    # 启用用户层时必须与 AGENTS.md 唯一事实源完全一致。
    if active_user and current_stable_user_id() != active_user:
        raise RuleLoadingError(f"Active user does not match AGENTS.md: {active_user}")

    # 根索引同时提供 core 直登规则、common 汇总入口和用户索引模式。
    root_entries = _parse_index(ROOT_INDEX, _read_resource(ROOT_INDEX))
    layers: list[LoadedRule] = []
    # core 是最低冻结基线；未登记时允许 common 独立规则继续参与。
    _add_if_present(layers, _load_registered(root_entries, logical_id, logical_id, "core"))

    # common 只能从根索引登记的汇总入口进入。
    common_index_path = _required_index_reference(
        ROOT_INDEX, root_entries, COMMON_INDEX_KEY
    )
    common_entries = _parse_index(
        common_index_path, _read_resource(common_index_path)
    )
    # common 迁空后仍保留稳定根入口；加载器跳过公共子树并继续进入当前用户层。
    common_is_reserved_empty = _is_reserved_empty_common(common_entries)
    if common_is_reserved_empty:
        _validate_reserved_empty_common_index(common_index_path, common_entries)
    # 显式作用域只递归命中的一棵非空 common 工程树。
    scope_rule: LoadedRule | None = None
    if active_scope and not common_is_reserved_empty:
        scope_index_path = _find_scope_index(
            common_index_path, common_entries, active_scope
        )
        scope_rule = _load_from_index_tree(scope_index_path, logical_id, "common")

    # 非空 common 才加载跨工程基线；预留空层不得制造失效子索引。
    cross_project_rule: LoadedRule | None = None
    if not common_is_reserved_empty:
        cross_project_index_path = _required_index_reference(
            common_index_path, common_entries, CROSS_PROJECT_INDEX_KEY
        )
        cross_project_rule = _load_from_index_tree(
            cross_project_index_path, logical_id, "common"
        )
    # 兼容迁移期根索引的 `<ID>@common`，但不再新增这种登记。
    legacy_common_rule = _load_registered(
        root_entries, f"{logical_id}@common", logical_id, "common"
    )
    _add_if_present(layers, legacy_common_rule)
    _add_if_present(layers, cross_project_rule)
    _add_if_present(layers, scope_rule)

    # 当前用户最后叠加，同时保留低层已读证据。
    if active_user:
        user_index_path = _optional_user_index_reference(root_entries, active_user)
        _add_if_present(
            layers,
            _load_from_index_tree(user_index_path, logical_id, active_user),
        )
    # 未命中任何已选层时禁止猜测同名文件。
    if not layers:
        raise RuleLoadingError(
            f"Rule logical id is not registered for active scope: {logical_id}"
        )
    return merge_rule_stack(logical_id, layers)


def load_bundle(
    logical_ids: list[str] | tuple[str, ...],
    active_scope: str | None = None,
    active_user: str | None = None,
) -> LoadedRuleBundle:
    """加载任务规则，并使用相同作用域和用户补全依赖闭包。"""

    return assemble_bundle(
        logical_ids,
        lambda logical_id: load_rule_stack(logical_id, active_scope, active_user),
    )


def assemble_bundle(
    logical_ids: list[str] | tuple[str, ...],
    rule_stack_provider: RuleStackProvider,
) -> LoadedRuleBundle:
    """从可替换 provider 组装依赖闭包，供生产和内存测试共同使用。"""

    if not logical_ids:
        raise ValueError("At least one rule logical id is required.")
    # dict 保持依赖拓扑顺序，同一依赖只加载一次。
    resolved_rules: dict[str, RuleStack] = {}
    dependency_stack: list[str] = []
    for logical_id in logical_ids:
        _load_rule_with_dependencies(
            logical_id, resolved_rules, dependency_stack, rule_stack_provider
        )
    # 回执显式记录每个 ID 的真实物理层、路径和覆盖模式。
    receipt = tuple(_build_receipt_line(stack) for stack in resolved_rules.values())
    return LoadedRuleBundle(dict(resolved_rules), receipt)


def _load_rule_with_dependencies(
    logical_id: str,
    resolved_rules: dict[str, RuleStack],
    dependency_stack: list[str],
    rule_stack_provider: RuleStackProvider,
) -> None:
    """深度优先加载显式依赖，并阻断依赖循环。"""

    if logical_id in resolved_rules:
        return
    _validate_logical_id(logical_id)
    if logical_id in dependency_stack:
        cycle = " -> ".join([*dependency_stack, logical_id])
        raise RuleLoadingError(f"Rule dependency cycle detected: {cycle}")
    dependency_stack.append(logical_id)
    try:
        rule_stack = rule_stack_provider(logical_id)
        if rule_stack is None:
            raise RuleLoadingError(
                f"Rule stack provider returned no rule: {logical_id}"
            )
        for dependency_id in _parse_required_rule_ids(rule_stack.effective_values):
            _load_rule_with_dependencies(
                dependency_id,
                resolved_rules,
                dependency_stack,
                rule_stack_provider,
            )
        resolved_rules[logical_id] = rule_stack
    finally:
        dependency_stack.pop()


def _parse_required_rule_ids(effective_values: dict[str, str]) -> tuple[str, ...]:
    """解析、校验并去重单事实拆分后的 requires_rule_ids。"""

    required_values = [
        value.strip()
        for key, value in effective_values.items()
        if key == "requires_rule_ids" or key.startswith("requires_rule_ids.")
    ]
    if not required_values:
        return ()
    ordered_ids: list[str] = []
    for required_ids in required_values:
        for logical_id in re.split(r"[,\s]+", required_ids):
            if not logical_id:
                continue
            _validate_logical_id(logical_id)
            if logical_id not in ordered_ids:
                ordered_ids.append(logical_id)
    return tuple(ordered_ids)


def _build_receipt_line(rule_stack: RuleStack) -> str:
    """构造包含真实层和资源路径的稳定加载回执。"""

    sources = " -> ".join(
        f"[{layer.layer}] {layer.resource_path}" for layer in rule_stack.layers
    ) or "[none]"
    return (
        f"{rule_stack.logical_id} | {sources} "
        f"| override_mode={rule_stack.override_mode}"
    )


def merge_rule_stack(logical_id: str, input_layers: list[LoadedRule]) -> RuleStack:
    """按低到高优先级合并规则层，支持默认 extend 和显式 replace。"""

    _validate_logical_id(logical_id)
    if not input_layers:
        raise ValueError(f"At least one loaded layer is required: {logical_id}")
    layers = tuple(input_layers)
    effective_values: dict[str, str] = {}
    effective_content_layers: list[LoadedRule] = []
    replace_applied = False
    for layer in layers:
        layer_values = _parse_rule_values(layer.content)
        replace_layer = layer_values.get("override_mode", "").lower() == "replace"
        if replace_layer:
            # replace 清空低层有效结果，但 layers 继续保留完整已读证据。
            effective_values.clear()
            effective_content_layers.clear()
            replace_applied = True
        effective_values.update(layer_values)
        effective_content_layers.append(layer)
    override_mode = "replace" if replace_applied else "extend"
    effective_values["override_mode"] = override_mode
    effective_content = _build_effective_content(
        logical_id, effective_values, effective_content_layers
    )
    highest_layer = layers[-1]
    effective_rule = LoadedRule(
        logical_id,
        highest_layer.layer,
        highest_layer.resource_path,
        effective_content,
    )
    return RuleStack(
        logical_id,
        layers,
        dict(effective_values),
        override_mode,
        effective_rule,
    )


def _parse_rule_values(content: str) -> dict[str, str]:
    """从规则 Markdown 提取单行 key=value DSL。"""

    values: dict[str, str] = {}
    for line in str(content).splitlines():
        trimmed_line = line.strip()
        if (
            not trimmed_line
            or trimmed_line.startswith("#")
            or trimmed_line.startswith("<!--")
            or "=" not in trimmed_line
        ):
            continue
        key, value = (part.strip() for part in trimmed_line.split("=", 1))
        if RULE_VALUE_KEY_PATTERN.fullmatch(key) and value:
            values[key] = value
    return values


def _build_effective_content(
    logical_id: str,
    effective_values: dict[str, str],
    effective_content_layers: list[LoadedRule],
) -> str:
    """生成机器有效 DSL 在前、来源原文在后的合并正文。"""

    lines = [
        f"# Effective layered rule: {logical_id}",
        "",
        "## Effective DSL values",
        "",
        *(f"{key} = {value}" for key, value in effective_values.items()),
    ]
    for layer in effective_content_layers:
        lines.extend(
            [
                "",
                f"## Loaded source [{layer.layer}] {layer.resource_path}",
                "",
                layer.content.strip(),
            ]
        )
    return "\n".join(lines) + "\n"


def validate_index_tree(
    root_index_path: str = ROOT_INDEX,
    resource_provider: ResourceProvider | None = None,
) -> IndexValidation:
    """验证根索引和全部 common 作用域树，不读取规则正文。"""

    provider = resource_provider or _read_resource
    root_entries = _parse_index(root_index_path, provider(root_index_path))
    root_rules = _direct_rule_entries(root_index_path, root_entries)
    common_index_path = _required_index_reference(
        root_index_path, root_entries, COMMON_INDEX_KEY
    )
    common_entries = _parse_index(common_index_path, provider(common_index_path))
    if _direct_rule_entries(common_index_path, common_entries):
        raise RuleLoadingError(
            f"Common aggregate index must contain child indexes only: {common_index_path}"
        )
    all_index_paths = {root_index_path, common_index_path}
    rule_count = len(root_rules)
    scope_index_paths = _child_index_references(common_index_path, common_entries)
    # common 只剩预留入口时，不要求虚构作用域索引；根和预留索引本身仍接受完整校验。
    if _is_reserved_empty_common(common_entries):
        _validate_reserved_empty_common_index(common_index_path, common_entries)
        return IndexValidation(len(all_index_paths), rule_count)
    if not scope_index_paths:
        raise RuleLoadingError(
            f"Common aggregate index has no child scope indexes: {common_index_path}"
        )
    for scope_index_path in scope_index_paths:
        scope_rules = _collect_rule_entries(
            scope_index_path,
            0,
            set(),
            set(),
            all_index_paths,
            provider,
        )
        rule_count += len(scope_rules)
    return IndexValidation(len(all_index_paths), rule_count)


def validate_user_index_tree(active_user: str) -> IndexValidation:
    """验证 AGENTS.md 当前用户的完整递归索引树。"""

    _validate_active_user(active_user)
    if not active_user:
        raise ValueError("Active user is required for user index validation.")
    if current_stable_user_id() != active_user:
        raise RuleLoadingError(f"Active user does not match AGENTS.md: {active_user}")
    root_entries = _parse_index(ROOT_INDEX, _read_resource(ROOT_INDEX))
    user_index_path = _optional_user_index_reference(root_entries, active_user)
    user_index_paths: set[str] = set()
    user_rules = _collect_rule_entries(
        user_index_path,
        0,
        set(),
        set(),
        user_index_paths,
        _read_resource,
    )
    return IndexValidation(len(user_index_paths), len(user_rules))


def validate_current_user_index_tree() -> IndexValidation:
    """验证工程根声明的当前稳定用户索引树。"""

    return validate_user_index_tree(current_stable_user_id())


def _load_from_index_tree(
    index_path: str,
    logical_id: str,
    expected_layer: str,
) -> LoadedRule | None:
    """从一棵已选索引树加载逻辑 ID，未命中时返回 None。"""

    rules = _collect_rule_entries(
        index_path, 0, set(), set(), set(), _read_resource
    )
    registration = rules.get(logical_id)
    if registration is None:
        return None
    return _load_rule(logical_id, registration.resource_path, expected_layer)


def _collect_rule_entries(
    index_path: str,
    depth: int,
    recursion_stack: set[str],
    visited_indexes: set[str],
    all_index_paths: set[str],
    resource_provider: ResourceProvider,
) -> dict[str, RuleRegistration]:
    """递归收集一棵索引树，并闭锁循环、重复、越界、缺失和过深结构。"""

    if depth > MAX_INDEX_DEPTH:
        raise RuleLoadingError(
            f"Rule index depth exceeds {MAX_INDEX_DEPTH}: {index_path}"
        )
    _validate_index_resource_path(index_path)
    if index_path in recursion_stack:
        raise RuleLoadingError(f"Rule index cycle detected: {index_path}")
    if index_path in visited_indexes:
        raise RuleLoadingError(f"Rule index referenced more than once: {index_path}")
    recursion_stack.add(index_path)
    visited_indexes.add(index_path)
    all_index_paths.add(index_path)
    try:
        entries = _parse_index(index_path, resource_provider(index_path))
        rules = _direct_rule_entries(index_path, entries)
        for child_index_path in _child_index_references(index_path, entries):
            child_rules = _collect_rule_entries(
                child_index_path,
                depth + 1,
                recursion_stack,
                visited_indexes,
                all_index_paths,
                resource_provider,
            )
            _merge_rules(rules, child_rules)
        return rules
    finally:
        recursion_stack.remove(index_path)


def _direct_rule_entries(
    index_path: str, entries: dict[str, str]
) -> dict[str, RuleRegistration]:
    """提取当前索引直接拥有的规则登记。"""

    rules: dict[str, RuleRegistration] = {}
    for key, value in entries.items():
        if not LOGICAL_ID_PATTERN.fullmatch(key):
            continue
        if _is_index_reference(value) or not value.endswith(".md"):
            continue
        _validate_rule_resource_path(value)
        rules[key] = RuleRegistration(index_path, value)
    return rules


def _child_index_references(
    index_path: str, entries: dict[str, str]
) -> list[str]:
    """提取当前索引显式登记的下一级索引路径。"""

    _ = index_path
    child_indexes: list[str] = []
    for key, value in entries.items():
        if LOGICAL_ID_PATTERN.fullmatch(key) and _is_index_reference(value):
            _validate_index_resource_path(value)
            child_indexes.append(value)
    return child_indexes


def _merge_rules(
    target: dict[str, RuleRegistration],
    additions: dict[str, RuleRegistration],
) -> None:
    """合并同一作用域树登记，重复逻辑 ID 立即失败。"""

    for logical_id, registration in additions.items():
        existing = target.get(logical_id)
        if existing is not None:
            raise RuleLoadingError(
                "Duplicate rule logical id in one scope tree: "
                f"{logical_id}, first={existing.index_path}, "
                f"second={registration.index_path}"
            )
        target[logical_id] = registration


def _find_scope_index(
    common_index_path: str,
    common_entries: dict[str, str],
    active_scope: str,
) -> str:
    """只从 common 汇总索引精确匹配当前一级作用域。"""

    expected_path = f"local/common/{active_scope}/RULE_INDEX.md"
    for key, value in common_entries.items():
        if (
            LOGICAL_ID_PATTERN.fullmatch(key)
            and _is_index_reference(value)
            and value == expected_path
        ):
            return value
    raise RuleLoadingError(
        f"Active common scope is not registered in {common_index_path}: {active_scope}"
    )


def _required_index_reference(
    owner_index_path: str,
    entries: dict[str, str],
    index_key: str,
) -> str:
    """读取并校验一个必须存在的稳定子索引入口。"""

    index_path = entries.get(index_key)
    if index_path is None:
        raise RuleLoadingError(
            "Required child index is not registered: "
            f"owner={owner_index_path}, key={index_key}"
        )
    _validate_index_resource_path(index_path)
    return index_path


def _is_reserved_empty_common(entries: dict[str, str]) -> bool:
    """判断 common 是否已迁空并只保留未来提升入口。"""

    return entries.get(COMMON_INDEX_STATUS_KEY) == RESERVED_EMPTY_COMMON_STATUS


def _validate_reserved_empty_common_index(
    index_path: str, entries: dict[str, str]
) -> None:
    """阻断预留空 common 继续登记任何规则或子索引。"""

    if _direct_rule_entries(index_path, entries):
        raise RuleLoadingError(
            f"Reserved empty common index must not register rules: {index_path}"
        )
    child_indexes = _child_index_references(index_path, entries)
    if child_indexes:
        raise RuleLoadingError(
            "Reserved empty common index must not register child indexes: "
            f"{index_path}, children={child_indexes}"
        )


def _optional_user_index_reference(
    root_entries: dict[str, str], active_user: str
) -> str:
    """使用根索引模式解析唯一当前用户入口，不扫描用户目录。"""

    index_pattern = root_entries.get(USER_INDEX_PATTERN_KEY)
    if index_pattern is None or USER_ID_PLACEHOLDER not in index_pattern:
        raise RuleLoadingError("User index pattern is missing or invalid in root index.")
    index_path = index_pattern.replace(USER_ID_PLACEHOLDER, active_user)
    expected_path = f"local/{active_user}/RULE_INDEX.md"
    if index_path != expected_path:
        raise RuleLoadingError(
            f"Active user index path mismatch: user={active_user}, path={index_path}"
        )
    _validate_index_resource_path(index_path)
    return index_path


def _load_registered(
    index: dict[str, str],
    index_key: str,
    logical_id: str,
    expected_layer: str,
) -> LoadedRule | None:
    """按索引稳定键加载单条规则，键不存在时允许优先级回落。"""

    resource_path = index.get(index_key)
    if resource_path is None:
        return None
    return _load_rule(logical_id, resource_path, expected_layer)


def _load_rule(
    logical_id: str,
    resource_path: str,
    expected_layer: str,
) -> LoadedRule:
    """校验规则物理层并读取完整 UTF-8 正文。"""

    _validate_rule_resource_path(resource_path)
    path_parts = resource_path.split("/", 2)
    if len(path_parts) < 3:
        raise RuleLoadingError(f"Invalid layered rule path: {resource_path}")
    # active-user 是由根索引解析出的当前稳定用户映射层，资源路径本身不重复写死用户 ID。
    actual_layer = expected_layer if path_parts[0] == "active-user" else path_parts[1]
    if expected_layer and actual_layer != expected_layer:
        raise RuleLoadingError(
            f"Rule layer mismatch: expected={expected_layer}, path={resource_path}"
        )
    return LoadedRule(
        logical_id, actual_layer, resource_path, _read_resource(resource_path)
    )


def _parse_index(index_path: str, content: str) -> dict[str, str]:
    """解析 Markdown 索引中的 key=value DSL，并阻断重复键。"""

    values: dict[str, str] = {}
    for line in content.splitlines():
        trimmed_line = line.strip()
        if (
            not trimmed_line
            or trimmed_line.startswith("#")
            or trimmed_line.startswith("<!--")
            or "=" not in trimmed_line
        ):
            continue
        key, value = (part.strip() for part in trimmed_line.split("=", 1))
        if not key or not value:
            raise RuleLoadingError(
                f"Empty index key or value in {index_path}: {line}"
            )
        if key in values:
            raise RuleLoadingError(f"Duplicate index key in {index_path}: {key}")
        values[key] = value
    return values


def _validate_logical_id(logical_id: str) -> None:
    """校验规则逻辑 ID 的稳定机器格式。"""

    if not isinstance(logical_id, str) or not LOGICAL_ID_PATTERN.fullmatch(logical_id):
        raise ValueError(f"Invalid rule logical id: {logical_id}")


def _validate_active_user(active_user: str | None) -> None:
    """校验当前用户；空值表示不启用用户覆盖层。"""

    if active_user and not USER_ID_PATTERN.fullmatch(active_user):
        raise ValueError(f"Invalid active user id: {active_user}")


def _validate_active_scope(active_scope: str | None) -> None:
    """校验当前 common 一级作用域，禁止路径分隔符和跳转。"""

    if active_scope and not SCOPE_PATTERN.fullmatch(active_scope):
        raise ValueError(f"Invalid active common scope: {active_scope}")


def _is_index_reference(resource_path: str | None) -> bool:
    """判断资源值是否为标准子索引引用。"""

    return bool(resource_path and resource_path.endswith("/RULE_INDEX.md"))


def _validate_index_resource_path(resource_path: str) -> None:
    """校验索引严格位于 local 下并使用标准文件名。"""

    if not _is_safe_local_resource_path(resource_path) or not _is_index_reference(
        resource_path
    ):
        raise RuleLoadingError(
            f"Invalid or escaping child rule index path: {resource_path}"
        )


def _validate_rule_resource_path(resource_path: str) -> None:
    """校验规则正文位于旧分层或新 ruleengine 规则根且不是索引。"""

    if (
        not (
            _is_safe_local_resource_path(resource_path)
            or _is_safe_ruleengine_rule_path(resource_path)
        )
        or not resource_path.endswith(".md")
        or _is_index_reference(resource_path)
    ):
        raise RuleLoadingError(
            f"Invalid or escaping layered rule path: {resource_path}"
        )


def _is_safe_ruleengine_rule_path(resource_path: str | None) -> bool:
    """允许新规则根中的相对 Markdown 路径并阻断路径逃逸。"""

    if (
        not resource_path
        or not resource_path.startswith("active-user/rules/")
        or resource_path.startswith("/")
        or "\\" in resource_path
    ):
        return False
    segments = resource_path.split("/")
    return all(segment and segment not in {".", ".."} for segment in segments)


def _is_safe_local_resource_path(resource_path: str | None) -> bool:
    """阻断绝对路径、反斜杠、空段和点路径逃逸。"""

    if (
        not resource_path
        or not resource_path.startswith("local/")
        or resource_path.startswith("/")
        or "\\" in resource_path
    ):
        return False
    # 使用原始分段校验，避免 PurePosixPath 规范化后隐藏 `.` 或 `..`。
    segments = resource_path.split("/")
    return all(segment not in {"", ".", ".."} for segment in segments)


def _add_if_present(
    layers: list[LoadedRule], loaded_rule: LoadedRule | None
) -> None:
    """只把真实命中的规则加入分层证据。"""

    if loaded_rule is not None:
        layers.append(loaded_rule)


@lru_cache(maxsize=256)
def _read_resource_snapshot(
    resource_path: str,
    modified_ns: int,
    size: int,
) -> str:
    """按路径、修改时间和大小缓存稳定 UTF-8 资源快照。"""

    _ = modified_ns, size
    return (RESOURCE_ROOT / PurePosixPath(resource_path)).read_text(encoding="utf-8")


def _read_resource(resource_path: str) -> str:
    """从标准 resources 根读取 UTF-8 资源，并复用未变化快照。"""

    if resource_path != ROOT_INDEX:
        # 根索引是唯一允许位于 local 外的读取入口，其他资源必须先过路径门禁。
        if resource_path.endswith("RULE_INDEX.md"):
            _validate_index_resource_path(resource_path)
        else:
            _validate_rule_resource_path(resource_path)
    resource_file = RESOURCE_ROOT / PurePosixPath(resource_path)
    try:
        stat = resource_file.stat()
        return _read_resource_snapshot(resource_path, stat.st_mtime_ns, stat.st_size)
    except FileNotFoundError as error:
        raise RuleLoadingError(f"Rule resource not found: {resource_path}") from error


def _serialize_rule_stack(rule_stack: RuleStack) -> dict[str, Any]:
    """把不可变规则栈转换为 executor 可返回的普通字典。"""

    return asdict(rule_stack)


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """通过 core executor 执行加载、依赖闭包或索引验证。"""

    _ = skills, apps
    action = str(context.get("action") or "load").strip().replace("-", "_")
    try:
        if action == "load":
            rule = load(
                str(context.get("logical_id") or ""),
                context.get("active_scope"),
                context.get("active_user"),
            )
            return {
                "status": "completed",
                "ability": ABILITY_ID,
                "action": action,
                "result": asdict(rule),
            }
        if action == "load_bundle":
            logical_ids = context.get("logical_ids") or []
            bundle = load_bundle(
                list(logical_ids),
                context.get("active_scope"),
                context.get("active_user"),
            )
            return {
                "status": "completed",
                "ability": ABILITY_ID,
                "action": action,
                "result": {
                    "rules": {
                        key: _serialize_rule_stack(value)
                        for key, value in bundle.rules.items()
                    },
                    "receipt": list(bundle.receipt),
                },
            }
        if action == "validate_index":
            return {
                "status": "completed",
                "ability": ABILITY_ID,
                "action": action,
                "result": asdict(validate_index_tree()),
            }
        if action == "validate_user_index":
            active_user = context.get("active_user") or current_stable_user_id()
            return {
                "status": "completed",
                "ability": ABILITY_ID,
                "action": action,
                "result": asdict(validate_user_index_tree(str(active_user))),
            }
        raise ValueError(f"Unsupported layered rule loader action: {action}")
    except (OSError, ValueError) as error:
        return {
            "status": "blocked",
            "exit_code": 1,
            "ability": ABILITY_ID,
            "action": action,
            "message": str(error),
        }


def main(arguments: list[str] | None = None) -> int:
    """接受一个 UTF-8 JSON 上下文并输出结构化加载结果。"""

    raw_context = (arguments or sys.argv[1:] or ["{}"])[0]
    try:
        context = json.loads(raw_context)
    except json.JSONDecodeError as error:
        print(json.dumps({"status": "blocked", "message": str(error)}, ensure_ascii=False))
        return 1
    result = execute(context, {}, {})
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("status") == "completed" else 1


if __name__ == "__main__":
    # Windows 下调用方按工程规则设置 UTF-8 环境，本入口只返回标准进程状态。
    os.environ.setdefault("PYTHONUTF8", "1")
    raise SystemExit(main())
