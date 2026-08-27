"""规则主文件与叶子索引生成能力。

功能：
按“项目或子项目/rule/主规则”的结构规划或生成规则骨架，
并在调用方提供索引键时登记当前作用域的叶子索引。
模板材料必须来自已核验的真实资料，因此本能力不自动创建 template、README 或样例。
"""

from __future__ import annotations

# 导入正则能力，校验规则名称和索引键只包含受控字符。
import re
# 导入 Path，统一处理规则资源根、所属作用域和叶子索引。
from pathlib import Path
# 导入 Any，为能力上下文和固定返回结构补充类型说明。
from typing import Any


# 当前能力的唯一调用标识。
ABILITY_ID = "rule_package_generator"
# 当前能力名称直接说明规则正文与叶子索引的生成职责。
ABILITY_NAME = "规则主文件与叶子索引生成"
# 当前能力描述用于能力注册表和执行结果展示。
ABILITY_DESC = "在项目或子项目的 rule 目录生成主规则并更新叶子索引，不自动创建模板材料。"

# 当前能力不依赖外部 skill。
REQUIRED_SKILLS: list[str] = []
# 当前能力不依赖外部 app。
REQUIRED_APPS: list[str] = []

# 规则名固定使用 RUL_ 前缀和“规则”后缀，避免生成无法被索引识别的散乱文件。
RULE_NAME_PATTERN = re.compile(r"^RUL_[^/\\\\]+规则$")
# 索引键只允许大写英文、数字和下划线，保持现有 RULE_INDEX DSL 风格。
INDEX_KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")


# 解析显式规则资源根，禁止能力根据当前工作目录猜测目标。
def _resolve_resource_root(context: dict[str, Any]) -> Path:
    # 读取调用方明确提供的规则资源根。
    raw_root = str(context.get("resource_root") or "").strip()
    # 缺少资源根时立即阻断。
    if not raw_root:
        raise ValueError("缺少 resource_root。")
    # 转为规范化绝对路径供后续边界检查。
    return Path(raw_root).expanduser().resolve()


# 在规则资源根内解析项目或子项目根目录，禁止路径逃逸。
def _resolve_scope_root(resource_root: Path, context: dict[str, Any]) -> tuple[Path, str]:
    # scope_path 使用相对于规则资源根的项目路径，例如 selplat/通用。
    scope_path = str(context.get("scope_path") or "").strip().strip("/")
    # 缺少所属作用域时禁止把规则写入资源根。
    if not scope_path:
        raise ValueError("缺少 scope_path。")
    # 拼接并规范化最终作用域目录。
    scope_root = (resource_root / scope_path).resolve()
    # 规范化结果必须仍位于规则资源根内。
    if resource_root not in scope_root.parents:
        raise ValueError("scope_path 越出规则资源根。")
    # 返回物理目录和稳定相对路径。
    return scope_root, scope_path


# 解析规则所属叶子索引，禁止新规则继续写入全局根索引。
def _resolve_index_path(
    resource_root: Path,
    scope_root: Path,
    context: dict[str, Any],
) -> Path:
    # 调用方可显式指定相对于资源根的 RULE_INDEX.md。
    raw_index_path = str(context.get("index_path") or "").strip()
    # 显式索引存在时优先使用，避免复杂项目结构依赖目录推断。
    if raw_index_path:
        # 绝对路径和相对路径统一规范化，再执行资源根边界检查。
        requested_path = Path(raw_index_path).expanduser()
        index_path = requested_path.resolve() if requested_path.is_absolute() else (
            resource_root / requested_path
        ).resolve()
        # 索引必须位于当前规则资源根内。
        if index_path != resource_root and resource_root not in index_path.parents:
            raise ValueError("index_path 越出规则资源根。")
        # 只有标准 RULE_INDEX.md 可以成为规则登记入口。
        if index_path.name != "RULE_INDEX.md":
            raise ValueError("index_path 必须指向 RULE_INDEX.md。")
        # 规则必须登记在当前作用域自己的叶子索引，禁止写入祖先汇总索引。
        if index_path.parent != scope_root:
            raise ValueError("index_path 必须是当前 scope_path 的叶子 RULE_INDEX.md。")
        # 返回经过边界和归属校验的显式索引。
        return index_path
    # 默认索引就是项目或子项目根下的叶子索引。
    return scope_root / "RULE_INDEX.md"


# 校验规则名、索引键和废弃参数，形成生成前统一阻断边界。
def _validate_inputs(context: dict[str, Any], rule_name: str, index_key: str) -> None:
    # 规则名必须符合统一命名约定。
    if not RULE_NAME_PATTERN.fullmatch(rule_name):
        raise ValueError("rule_name 必须使用 RUL_<主题>规则 格式。")
    # 提供索引键时必须符合 DSL 标识符格式。
    if index_key and not INDEX_KEY_PATTERN.fullmatch(index_key):
        raise ValueError("index_key 必须使用大写英文、数字和下划线。")
    # 旧 asset_directories 会重新制造空模板，必须明确阻断调用方升级。
    if context.get("asset_directories") not in (None, "", []):
        raise ValueError("asset_directories 已废弃；模板只能人工收集已核验的真实材料。")


# 构造默认主规则正文，避免生成没有问题、场景和业务含义的空规则。
def _default_rule_content(rule_name: str) -> str:
    # 标题去掉 RUL_ 前缀，保持 Markdown 可读。
    title = rule_name.removeprefix("RUL_")
    # 默认骨架保留待填写 DSL，但不伪造具体业务约束。
    return (
        f"# {title}\n\n"
        "<!-- 问题：待补充当前规则解决的重复性问题。 -->\n"
        "<!-- 场景：待补充当前规则适用的代码、文档或业务范围。 -->\n"
        "<!-- 业务含义：待补充执行该规则后获得的稳定业务结果。 -->\n\n"
        "rule_definition_must_be_completed_before_use = true\n"
    )


# 根据调用上下文构建不产生写入的完整生成计划。
def _build_plan(context: dict[str, Any]) -> dict[str, Any]:
    # 解析规则资源根。
    resource_root = _resolve_resource_root(context)
    # 解析规则所属项目或子项目根。
    scope_root, scope_path = _resolve_scope_root(resource_root, context)
    # 读取不带 .md 的完整规则名。
    rule_name = str(context.get("rule_name") or "").strip().removesuffix(".md")
    # 读取可选唯一索引键。
    index_key = str(context.get("index_key") or "").strip()
    # 在形成任何文件路径前完成输入校验。
    _validate_inputs(context, rule_name, index_key)
    # 主规则固定写入当前作用域的 rule 目录。
    main_rule_path = scope_root / "rule" / f"{rule_name}.md"
    # template 只提供约定位置供人工收集真实材料，本能力不创建它。
    template_root = scope_root / "template" / rule_name
    # 索引固定使用当前项目或子项目的叶子入口。
    index_path = _resolve_index_path(resource_root, scope_root, context)
    # 索引值使用相对于规则资源根的 POSIX 路径。
    index_value = str(main_rule_path.relative_to(resource_root)).replace("\\", "/")
    # 返回可由 plan 和 generate 共用的完整事实。
    return {
        "resource_root": resource_root,
        "scope_root": scope_root,
        "scope_path": scope_path,
        "rule_name": rule_name,
        "index_key": index_key,
        "main_rule_path": main_rule_path,
        "template_root": template_root,
        "index_path": index_path,
        "index_value": index_value,
    }


# 当前能力统一入口，支持只读计划和真实生成。
def execute(context: dict[str, Any], skills: dict[str, Any], apps: dict[str, Any]) -> dict[str, Any]:
    # 当前能力没有外部依赖，显式丢弃统一入口参数。
    _ = skills, apps
    try:
        # 先构建并校验完整计划。
        plan = _build_plan(context)
    except (ValueError, OSError) as exception:
        # 输入或路径不合法时返回阻断结果，不产生任何文件。
        return {"status": "blocked", "ability": ABILITY_ID, "message": str(exception)}
    # action 默认使用 plan，避免调用方遗漏动作时意外写入。
    action = str(context.get("action") or "plan").strip().lower()
    # 对外路径统一转成字符串，并明确模板目录不会自动创建。
    public_plan = {
        "main_rule_path": str(plan["main_rule_path"]),
        "template_root": str(plan["template_root"]),
        "template_creation": "manual_verified_materials_only",
        "index_path": str(plan["index_path"]),
        "index_entry": (
            f'{plan["index_key"]} = {plan["index_value"]}' if plan["index_key"] else ""
        ),
    }
    # plan 只返回规则与索引结构，不产生写入。
    if action == "plan":
        return {"status": "planned", "ability": ABILITY_ID, **public_plan}
    # 仅允许 generate 执行真实生成。
    if action != "generate":
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": f"不支持的 action: {action}",
        }
    # 主规则已存在时阻断覆盖。
    if plan["main_rule_path"].exists():
        return {"status": "blocked_existing_rule", "ability": ABILITY_ID, **public_plan}
    # 生成前要求作用域、rule 目录和叶子索引已经存在。
    if (
        not plan["scope_root"].is_dir()
        or not plan["main_rule_path"].parent.is_dir()
        or not plan["index_path"].is_file()
    ):
        return {
            "status": "blocked_missing_rule_root_or_index",
            "ability": ABILITY_ID,
            **public_plan,
        }
    # 调用方可提供完整规则正文，否则使用明确待完善的安全骨架。
    rule_content = str(context.get("rule_content") or "").strip() or _default_rule_content(
        plan["rule_name"]
    )
    # 创建主规则文件；模板材料不属于自动生成范围。
    plan["main_rule_path"].write_text(rule_content.rstrip() + "\n", encoding="utf-8")
    # 提供索引键时向当前叶子索引追加主规则入口。
    if plan["index_key"]:
        # 读取现有索引完整正文。
        index_text = plan["index_path"].read_text(encoding="utf-8")
        # 重复索引键必须阻断，并回滚刚生成的主规则。
        if re.search(rf"(?m)^{re.escape(plan['index_key'])}\s*=", index_text):
            plan["main_rule_path"].unlink()
            return {
                "status": "blocked_existing_index_key",
                "ability": ABILITY_ID,
                **public_plan,
            }
        # 在索引末尾追加一个稳定入口。
        index_entry = f'{plan["index_key"]} = {plan["index_value"]}'
        # 保留原索引正文并确保新入口独立成行。
        plan["index_path"].write_text(
            index_text.rstrip() + "\n\n" + index_entry + "\n",
            encoding="utf-8",
        )
    # 返回实际生成的主规则和索引入口。
    return {"status": "generated", "ability": ABILITY_ID, **public_plan}
