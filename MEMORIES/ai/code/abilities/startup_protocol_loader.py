"""启动协议链加载能力。

功能：
按 STARTER_PROTOCOL.md 中的声明顺序装载启动协议链，并装载协议后置规则入口。

作用：
把 STARTER_PROTOCOL.md 里的链式声明转成真实执行结果，避免只写协议但不触发后续装载。

适用场景：
- 启动阶段读取完整协议链
- 校验 USER/CODE/COMMAND 协议是否按顺序装载
- 在 COMMAND 协议后装载 RULE_INDEX.md 作为规则入口索引
- 明确排除规则文件，不把规则装载混入启动主链
"""

# 导入 importlib.util，用于直接运行脚本时加载默认读取技能。
import importlib.util
# 导入 sys，用于直接运行脚本时返回退出码。
import sys
# 导入 Path，用于基于当前代码树反推协议目录。
from pathlib import Path

# 能力唯一标识，用于在注册表中定位当前能力。
ABILITY_ID = "startup_protocol_loader"
# 能力名称，便于人类和 AI 理解用途。
ABILITY_NAME = "启动协议链加载"
# 能力说明，描述当前能力负责的任务范围。
ABILITY_DESC = "按 STARTER_PROTOCOL.md 声明顺序装载 STARTER/USER/CODE/COMMAND 协议，并装载 RULE_INDEX 后置入口。"

# 记录当前能力依赖的单技能列表。
REQUIRED_SKILLS = ["read_ai_memory_file"]

# 定义 code 根目录，统一基于当前代码树反推协议位置。
CODE_ROOT = Path(__file__).resolve().parents[1]
# 定义 AI 根目录，避免协议目录丢失 ai 层级。
AI_ROOT = CODE_ROOT.parent
# 定义协议目录绝对路径，确保装载始终落到项目内 MEMORIES 代码树。
PROTOCOL_DIR = AI_ROOT / "protocol"
# 定义默认启动协议路径，便于外部省略上下文时直接复用。
DEFAULT_STARTER_PATH = str(PROTOCOL_DIR / "STARTER_PROTOCOL.md")
# 定义默认 AI 记忆读取技能路径，供脚本直接运行时自举使用。
DEFAULT_READER_SKILL_PATH = CODE_ROOT / "skill" / "read_ai_memory_file.py"


# 定义键值配置解析函数，把清洗后的文本还原为简单配置字典。
def parse_key_values(cleaned_content: str) -> dict:
    # 初始化解析结果。
    config = {}
    # 逐行解析键值。
    for line in cleaned_content.splitlines():
        # 跳过非法行，避免异常中断整个装载流程。
        if "=" not in line:
            continue
        # 仅按第一个等号分割，保留右侧原始值。
        key, value = line.split("=", 1)
        # 保存去空格后的键值。
        config[key.strip()] = value.strip()
    # 返回配置字典。
    return config


# 定义协议链解析函数，把 `A -> B -> C` 解析为文件名列表。
def parse_protocol_chain(chain_value: str) -> list[str]:
    # 按箭头拆分并去除空白。
    chain_items = [item.strip() for item in chain_value.split("->")]
    # 过滤空项，避免格式问题导致后续拼接出错。
    protocol_files = [item for item in chain_items if item]
    # 返回协议文件列表。
    return protocol_files


# 定义协议文件路径构造函数，统一把协议文件名拼成可读取路径。
def build_protocol_path(protocol_file_name: str) -> str:
    # 返回协议目录下的标准绝对路径，避免误读其他代码树。
    return str(PROTOCOL_DIR / protocol_file_name)


def resolve_protocol_reference(protocol_reference: str) -> str:
    # 支持协议中的 ${PRT} 引用，同时保持普通文件名可用。
    normalized_reference = protocol_reference.strip()
    if normalized_reference.startswith("${PRT}"):
        protocol_file_name = normalized_reference.removeprefix("${PRT}").strip()
        return build_protocol_path(protocol_file_name)
    return build_protocol_path(normalized_reference)


# 定义布尔文本判断函数，统一处理 true/false 配置。
def is_true_flag(value: str) -> bool:
    # 统一大小写和空白，兼容协议文本的常见写法。
    normalized = value.strip().lower()
    # 仅在明确为 true 时返回真。
    return normalized == "true"


def load_default_reader_skill():
    """加载默认 AI 记忆读取技能，供 CLI 核验入口使用。"""

    spec = importlib.util.spec_from_file_location(
        "startup_protocol_loader_read_ai_memory_file",
        DEFAULT_READER_SKILL_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载读取技能：{DEFAULT_READER_SKILL_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_verification_checklist(execute_result: dict) -> list[str]:
    """把能力执行结果格式化为可人工核验的清单。"""

    lines = [
        "启动协议链核验清单",
        f"状态: {execute_result.get('status', '')}",
        f"能力: {execute_result.get('ability', '')}",
    ]
    if execute_result.get("status") != "completed":
        lines.append(f"阻断原因: {execute_result.get('message', '')}")
        return lines

    result = execute_result.get("result", {})
    declared_chain = result.get("startup_protocol_chain_order", [])
    lines.append("声明顺序:")
    for index, protocol_file_name in enumerate(declared_chain, start=1):
        lines.append(f"  {index}. {protocol_file_name}")

    lines.append("已装载协议:")
    for index, protocol_entry in enumerate(result.get("loaded_protocols", []), start=1):
        file_name = protocol_entry.get("file", "")
        path = protocol_entry.get("path", "")
        read_result = protocol_entry.get("result", {})
        line_count = read_result.get("line_count", 0)
        source_path = read_result.get("source_path", "")
        lines.append(
            f"  {index}. {file_name} | lines={line_count} | source={source_path} | path={path}"
        )

    lines.append("协议后置入口:")
    post_chain_entries = result.get("post_chain_loaded_entries", [])
    if post_chain_entries:
        for index, post_chain_entry in enumerate(post_chain_entries, start=1):
            file_name = post_chain_entry.get("file", "")
            entry_type = post_chain_entry.get("entry_type", "")
            path = post_chain_entry.get("path", "")
            read_result = post_chain_entry.get("result", {})
            line_count = read_result.get("line_count", 0)
            source_path = read_result.get("source_path", "")
            lines.append(
                f"  {index}. {file_name} | type={entry_type} | lines={line_count} | "
                f"source={source_path} | path={path}"
            )
    else:
        lines.append("  未装载")

    lines.extend(
        [
            "关键约束:",
            "  rule_index_loaded_as_post_protocol_entry="
            f"{result.get('rule_index_loaded_as_post_protocol_entry')}",
            "  rule_index_is_post_protocol_entry_not_startup_rule_bulk_loading="
            f"{result.get('rule_index_is_post_protocol_entry_not_startup_rule_bulk_loading')}",
            "  startup_chain_does_not_load_rule_files="
            f"{result.get('startup_chain_does_not_load_rule_files')}",
            "  rule_files_are_not_part_of_startup_protocol_chain="
            f"{result.get('rule_files_are_not_part_of_startup_protocol_chain')}",
        ]
    )
    return lines


# 定义能力执行入口，接收上下文并真正调用依赖技能。
def execute(context: dict, skills: dict, apps: dict) -> dict:
    # 读取传入的启动协议路径，未提供时使用默认值。
    starter_path = context.get("starter_path", DEFAULT_STARTER_PATH)

    # 先读取 STARTER_PROTOCOL.md，自身也属于启动链一部分。
    try:
        starter_result = skills["read_ai_memory_file"].run(file_path=starter_path)
    # 启动协议读取失败时，直接阻断后续流程。
    except (FileNotFoundError, ValueError) as error:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": str(error),
        }

    # 解析启动协议中的机器配置。
    starter_config = parse_key_values(starter_result["cleaned_content"])
    # 读取链配置文本。
    chain_value = starter_config.get("startup_protocol_chain_order", "")
    # 缺失链配置时直接报错，避免误判为无需继续装载。
    if not chain_value:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": "STARTER_PROTOCOL.md 缺少 startup_protocol_chain_order 配置。",
        }

    # 把链配置解析成文件名列表。
    declared_chain = parse_protocol_chain(chain_value)
    # 校验链首项必须是 STARTER_PROTOCOL.md，避免错误链定义。
    if not declared_chain or declared_chain[0] != "STARTER_PROTOCOL.md":
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": "startup_protocol_chain_order 必须以 STARTER_PROTOCOL.md 开头。",
        }

    # RULE_INDEX 是 COMMAND 后置入口，不作为普通协议主链项装载。
    post_chain_rule_index_requested = "RULE_INDEX.md" in declared_chain[1:]
    protocol_chain = [item for item in declared_chain if item != "RULE_INDEX.md"]

    # 校验规则文件不应出现在启动链中，和协议声明保持一致。
    for protocol_file_name in protocol_chain:
        # 任何包含 rule 语义的文件都视为非法链项。
        if "rule" in protocol_file_name.lower():
            return {
                "status": "blocked",
                "ability": ABILITY_ID,
                "message": "启动协议链中禁止包含 rule 文件。",
            }

    # 初始化装载结果列表，并先记录 starter 读取结果。
    loaded_protocols = [
        {
            # 返回协议文件名，便于外部按链展示。
            "file": "STARTER_PROTOCOL.md",
            # 返回真实读取路径。
            "path": starter_path,
            # 返回清洗结果。
            "result": starter_result,
        }
    ]

    # 从第二项开始继续装载 USER/CODE/COMMAND 协议。
    for protocol_file_name in protocol_chain[1:]:
        # 构造当前协议标准路径。
        protocol_path = build_protocol_path(protocol_file_name)
        # 调用 AI 记忆读取技能继续装载下一个协议。
        try:
            protocol_result = skills["read_ai_memory_file"].run(file_path=protocol_path)
        # 任何一个后续协议失败，都应整体阻断。
        except (FileNotFoundError, ValueError) as error:
            return {
                "status": "blocked",
                "ability": ABILITY_ID,
                "message": f"协议装载失败：{protocol_path}，原因：{error}",
            }
        # 记录当前协议装载结果。
        loaded_protocols.append(
            {
                # 返回协议文件名。
                "file": protocol_file_name,
                # 返回协议读取路径。
                "path": protocol_path,
                # 返回清洗后的读取结果。
                "result": protocol_result,
            }
        )

    # COMMAND 后的 RULE_INDEX 是协议后置入口，不属于启动主链规则批量加载。
    post_chain_loaded_entries = []
    command_protocol_entry = next(
        (
            protocol_entry
            for protocol_entry in loaded_protocols
            if protocol_entry["file"] == "COMMAND.PROTOCOL.md"
        ),
        None,
    )
    if command_protocol_entry is not None:
        command_config = parse_key_values(command_protocol_entry["result"]["cleaned_content"])
        rule_index_reference = command_config.get("after_command_rule_index", "")
        if not rule_index_reference and post_chain_rule_index_requested:
            rule_index_reference = "${PRT}RULE_INDEX.md"
        if rule_index_reference:
            rule_index_path = resolve_protocol_reference(rule_index_reference)
            try:
                rule_index_result = skills["read_ai_memory_file"].run(file_path=rule_index_path)
            except (FileNotFoundError, ValueError) as error:
                return {
                    "status": "blocked",
                    "ability": ABILITY_ID,
                    "message": f"RULE_INDEX 后置入口装载失败：{rule_index_path}，原因：{error}",
                }
            post_chain_loaded_entries.append(
                {
                    "file": Path(rule_index_path).name,
                    "path": rule_index_path,
                    "entry_type": "post_protocol_rule_index",
                    "result": rule_index_result,
                }
            )

    # 读取规则相关开关，作为结果状态显式返回。
    rule_chain_disabled = is_true_flag(
        starter_config.get("rule_files_are_not_part_of_startup_protocol_chain", "false")
    )
    # 读取启动链是否禁止装载规则文件配置。
    startup_chain_does_not_load_rule_files = is_true_flag(
        starter_config.get("startup_chain_does_not_load_rule_files", "false")
    )

    # 组织能力层标准返回结果。
    result = {
        # 返回执行状态，说明能力已成功完成。
        "status": "completed",
        # 返回当前能力标识。
        "ability": ABILITY_ID,
        # 返回协议装载结果。
        "result": {
            # 返回原始链声明，便于比对协议配置。
            "startup_protocol_chain_order": declared_chain,
            # 返回实际已装载协议列表。
            "loaded_protocols": loaded_protocols,
            # 返回协议后置入口，避免和启动主链混在一起。
            "post_chain_loaded_entries": post_chain_loaded_entries,
            # 显式说明 RULE_INDEX 是后置入口，不是规则批量加载。
            "rule_index_loaded_as_post_protocol_entry": bool(post_chain_loaded_entries),
            "rule_index_is_post_protocol_entry_not_startup_rule_bulk_loading": True,
            # 显式返回规则文件未参与启动链状态。
            "startup_chain_does_not_load_rule_files": startup_chain_does_not_load_rule_files,
            # 显式返回规则文件不属于启动链状态。
            "rule_files_are_not_part_of_startup_protocol_chain": rule_chain_disabled,
        },
    }
    # 返回能力结果字典。
    return result


def main() -> int:
    """直接运行时打印启动协议链核验清单。"""

    reader_skill = load_default_reader_skill()
    execute_result = execute({}, {"read_ai_memory_file": reader_skill}, {})
    print("\n".join(build_verification_checklist(execute_result)))
    if execute_result.get("status") == "completed":
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
