"""工程完整文件读取能力。

功能：
用于执行工程目录文件的完整读取。

作用：
让上层流程在修改记忆库文件和关键工程文件时通过 ability 获取完整原文，而不是清洗后的内容。

适用场景：
- 编辑记忆库 Markdown 文件
- 编辑包含中文说明、注释和空行的记忆文件
- 写回前先读取完整原文
"""

# 能力唯一标识，用于在注册表中定位当前能力。
ABILITY_ID = "memory_file_full_reader"
# 能力名称，便于人类和 AI 理解用途。
ABILITY_NAME = "工程完整文件读取"
# 能力说明，描述当前能力负责的任务范围。
ABILITY_DESC = "读取工程目录文件，并返回完整原文。"

# 记录当前能力依赖的单技能列表。
REQUIRED_SKILLS = ["read_memory_file_full"]


# 定义能力执行入口，接收上下文并真正调用依赖技能。
def execute(context: dict, skills: dict, apps: dict) -> dict:
    # 读取传入的目标文件路径。
    file_path = context.get("file_path", "")
    # 校验必要参数是否存在。
    if not file_path:
        return {
            "status": "invalid_context",
            "ability": ABILITY_ID,
            "message": "context.file_path 不能为空。",
        }
    # 调用完整读取技能，保留原文。
    try:
        read_result = skills["read_memory_file_full"].run(file_path=file_path)
    # 读取器拒绝或读取失败时，返回结构化错误。
    except (FileNotFoundError, ValueError) as error:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": str(error),
        }
    # 组织能力层标准返回结果。
    result = {
        # 返回执行状态，说明能力已成功完成。
        "status": "completed",
        # 返回当前能力标识。
        "ability": ABILITY_ID,
        # 返回实际读取结果。
        "result": read_result,
    }
    # 返回能力结果字典。
    return result
