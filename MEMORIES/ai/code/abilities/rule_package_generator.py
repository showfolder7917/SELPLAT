"""规则主文件与同名资产目录生成能力。

功能：
按“主规则 Markdown 与同名资产目录并列”的结构规划或生成规则骨架，
并在调用方提供索引键时登记唯一规则入口。
"""

from __future__ import annotations

# 导入正则能力，校验规则名称和索引键只包含受控字符。
import re
# 导入 Path，统一处理规则资源根、范围目录和索引文件。
from pathlib import Path
# 导入 Any，为能力上下文和固定返回结构补充类型说明。
from typing import Any


# 当前能力的唯一调用标识。
ABILITY_ID = "rule_package_generator"
# 当前能力名称直接说明并列规则结构的生成职责。
ABILITY_NAME = "规则主文件与同名资产目录生成"
# 当前能力描述用于能力注册表和执行结果展示。
ABILITY_DESC = "规划或生成同级主规则文件、同名资产目录、README、可选资产目录和规则索引入口。"

# 当前能力不依赖外部 skill。
REQUIRED_SKILLS: list[str] = []
# 当前能力不依赖外部 app。
REQUIRED_APPS: list[str] = []

# 资产目录只允许使用生命周期治理规则已经确认的四种稳定分类。
ALLOWED_ASSET_DIRECTORIES = {"docs", "template", "examples", "project"}
# 规则名固定使用 RUL_ 前缀和“规则”后缀，避免生成无法被索引识别的散乱文件。
RULE_NAME_PATTERN = re.compile(r"^RUL_[^/\\\\]+规则$")
# 索引键只允许大写英文、数字和下划线，保持现有 RULE_INDEX DSL 风格。
INDEX_KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")


# 把列表或逗号分隔文本统一转换成稳定资产目录列表。
def _normalize_asset_directories(raw_value: Any) -> list[str]:
    # 列表输入逐项转换为去空格文本。
    if isinstance(raw_value, list):
        asset_directories = [str(item).strip() for item in raw_value if str(item).strip()]
    # 字符串输入按逗号拆分。
    elif isinstance(raw_value, str):
        asset_directories = [item.strip() for item in raw_value.split(",") if item.strip()]
    # 未提供资产目录时只创建 README，不创建多余空目录。
    else:
        asset_directories = []
    # 去重并排序，保证计划和生成结果稳定。
    return sorted(set(asset_directories))


# 解析显式规则资源根，禁止能力根据当前工作目录猜测目标。
def _resolve_resource_root(context: dict[str, Any]) -> Path:
    # 读取调用方明确提供的规则资源根。
    raw_root = str(context.get("resource_root") or "").strip()
    # 缺少资源根时立即阻断。
    if not raw_root:
        raise ValueError("缺少 resource_root。")
    # 转为规范化绝对路径供后续边界检查。
    return Path(raw_root).expanduser().resolve()


# 在规则资源根内解析所属范围目录，禁止路径逃逸。
def _resolve_scope_root(resource_root: Path, context: dict[str, Any]) -> tuple[Path, str]:
    # scope_path 使用相对于规则资源根的目录，例如 selplat/通用规则。
    scope_path = str(context.get("scope_path") or "").strip().strip("/")
    # 拼接并规范化最终范围目录。
    scope_root = (resource_root / scope_path).resolve()
    # 规范化结果必须仍位于规则资源根内。
    if scope_root != resource_root and resource_root not in scope_root.parents:
        raise ValueError("scope_path 越出规则资源根。")
    # 返回物理目录和稳定相对路径。
    return scope_root, scope_path


# 校验规则名、索引键和资产目录，形成生成前统一阻断边界。
def _validate_inputs(rule_name: str, index_key: str, asset_directories: list[str]) -> None:
    # 规则名必须符合统一命名约定。
    if not RULE_NAME_PATTERN.fullmatch(rule_name):
        raise ValueError("rule_name 必须使用 RUL_<主题>规则 格式。")
    # 提供索引键时必须符合 DSL 标识符格式。
    if index_key and not INDEX_KEY_PATTERN.fullmatch(index_key):
        raise ValueError("index_key 必须使用大写英文、数字和下划线。")
    # 任一非标准资产目录都必须阻断。
    invalid_directories = sorted(set(asset_directories) - ALLOWED_ASSET_DIRECTORIES)
    # 返回明确非法目录，方便调用方修正。
    if invalid_directories:
        raise ValueError("非标准资产目录: " + ", ".join(invalid_directories))


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


# 构造资产目录 README，只登记入口和资产清单，不复制主规则正文。
def _build_readme(rule_name: str, asset_directories: list[str]) -> str:
    # 将实际声明的标准子目录转换成人工可读清单。
    asset_lines = "\n".join(f"- `{directory}/`：当前规则的{directory}配套资产。" for directory in asset_directories)
    # 没有可选目录时明确只有 README，避免误以为生成遗漏。
    if not asset_lines:
        asset_lines = "- 当前没有额外 docs、template、examples 或 project 资产。"
    # 主入口使用上级相对路径，体现主规则与资产目录并列。
    return (
        f"# {rule_name.removeprefix('RUL_')}资产目录\n\n"
        "## 主入口\n\n"
        f"- `../{rule_name}.md`：当前主题唯一权威规则正文。\n\n"
        "## 配套资产\n\n"
        f"{asset_lines}\n"
    )


# 根据调用上下文构建不产生写入的完整生成计划。
def _build_plan(context: dict[str, Any]) -> dict[str, Any]:
    # 解析规则资源根。
    resource_root = _resolve_resource_root(context)
    # 解析规则所属范围目录。
    scope_root, scope_path = _resolve_scope_root(resource_root, context)
    # 读取不带 .md 的完整规则名。
    rule_name = str(context.get("rule_name") or "").strip().removesuffix(".md")
    # 读取可选唯一索引键。
    index_key = str(context.get("index_key") or "").strip()
    # 解析可选资产目录。
    asset_directories = _normalize_asset_directories(context.get("asset_directories"))
    # 在形成任何文件路径前完成输入校验。
    _validate_inputs(rule_name, index_key, asset_directories)
    # 主规则文件直接位于范围根。
    main_rule_path = scope_root / f"{rule_name}.md"
    # 同名资产目录与主规则文件并列。
    asset_root = scope_root / rule_name
    # 索引统一位于规则资源根。
    index_path = resource_root / "RULE_INDEX.md"
    # 索引值使用相对于规则资源根的 POSIX 路径。
    index_value = str(main_rule_path.relative_to(resource_root)).replace("\\", "/")
    # 返回可由 plan 和 generate 共用的完整事实。
    return {
        "resource_root": resource_root,
        "scope_root": scope_root,
        "scope_path": scope_path,
        "rule_name": rule_name,
        "index_key": index_key,
        "asset_directories": asset_directories,
        "main_rule_path": main_rule_path,
        "asset_root": asset_root,
        "readme_path": asset_root / "README.md",
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
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": str(exception),
        }
    # action 默认使用 plan，避免调用方遗漏动作时意外写入。
    action = str(context.get("action") or "plan").strip().lower()
    # 对外路径统一转成字符串。
    public_plan = {
        "main_rule_path": str(plan["main_rule_path"]),
        "asset_root": str(plan["asset_root"]),
        "readme_path": str(plan["readme_path"]),
        "asset_directories": [
            str(plan["asset_root"] / directory)
            for directory in plan["asset_directories"]
        ],
        "index_path": str(plan["index_path"]),
        "index_entry": (
            f'{plan["index_key"]} = {plan["index_value"]}'
            if plan["index_key"]
            else ""
        ),
    }
    # plan 只返回并列结构，不产生写入。
    if action == "plan":
        return {
            "status": "planned",
            "ability": ABILITY_ID,
            **public_plan,
        }
    # 仅允许 generate 执行真实生成。
    if action != "generate":
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": f"不支持的 action: {action}",
        }
    # 主规则或同名资产目录已存在时阻断覆盖。
    if plan["main_rule_path"].exists() or plan["asset_root"].exists():
        return {
            "status": "blocked_existing_rule",
            "ability": ABILITY_ID,
            **public_plan,
        }
    # 生成前要求范围目录和唯一索引已经存在。
    if not plan["scope_root"].is_dir() or not plan["index_path"].is_file():
        return {
            "status": "blocked_missing_rule_root_or_index",
            "ability": ABILITY_ID,
            **public_plan,
        }
    # 调用方可提供完整规则正文，否则使用明确待完善的安全骨架。
    rule_content = str(context.get("rule_content") or "").strip() or _default_rule_content(plan["rule_name"])
    # 创建主规则文件。
    plan["main_rule_path"].write_text(rule_content.rstrip() + "\n", encoding="utf-8")
    # 创建同级同名资产目录。
    plan["asset_root"].mkdir()
    # 创建调用方声明的标准资产子目录。
    for directory in plan["asset_directories"]:
        # 每个目录都位于当前同名资产根下。
        (plan["asset_root"] / directory).mkdir()
    # 创建只登记入口和资产清单的 README。
    plan["readme_path"].write_text(
        _build_readme(plan["rule_name"], plan["asset_directories"]),
        encoding="utf-8",
    )
    # 提供索引键时向唯一索引追加主规则入口。
    if plan["index_key"]:
        # 读取现有索引完整正文。
        index_text = plan["index_path"].read_text(encoding="utf-8")
        # 重复索引键必须阻断；生成前已确认新规则不存在，此处仍保护索引唯一性。
        if re.search(rf"(?m)^{re.escape(plan['index_key'])}\s*=", index_text):
            # 删除刚生成的空资产目录和文件，恢复生成前状态。
            plan["readme_path"].unlink()
            # 仅有声明目录且为空时逐个删除。
            for directory in reversed(plan["asset_directories"]):
                (plan["asset_root"] / directory).rmdir()
            # 删除同名资产根。
            plan["asset_root"].rmdir()
            # 删除主规则文件。
            plan["main_rule_path"].unlink()
            # 返回明确重复索引阻断。
            return {
                "status": "blocked_existing_index_key",
                "ability": ABILITY_ID,
                **public_plan,
            }
        # 在索引末尾追加一个稳定入口。
        index_entry = f'{plan["index_key"]} = {plan["index_value"]}'
        # 保留原索引正文并确保新入口独立成行。
        plan["index_path"].write_text(index_text.rstrip() + "\n\n" + index_entry + "\n", encoding="utf-8")
    # 返回实际生成的并列结构和索引入口。
    return {
        "status": "generated",
        "ability": ABILITY_ID,
        **public_plan,
    }
