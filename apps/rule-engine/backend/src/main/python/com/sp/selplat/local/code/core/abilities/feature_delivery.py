"""功能交付能力。

功能：
用于组合文件读取、写入、修复和测试相关技能。

作用：
为上层流程提供 Python 功能修改与基础验证的综合能力。

适用场景：
- 新增小功能
- 修改已有功能
- 调整逻辑后执行基础验证
"""

# 能力唯一标识，用于在注册表中定位当前能力。
ABILITY_ID = "feature_delivery"
# 能力名称，便于人类和 AI 理解用途。
ABILITY_NAME = "功能交付"
# 能力说明，描述当前能力负责的任务范围。
ABILITY_DESC = "完成 Python 功能修改并进行基础验证。"

# 记录当前能力依赖的单技能列表。
REQUIRED_SKILLS = ["read_file", "write_file", "fix_small_bug", "run_pytest"]


# 定义能力入口，接收上下文并返回依赖技能信息。
def run(context: dict) -> dict:
    # 组织当前能力结果，供调用方确认匹配结果。
    result = {
        # 返回能力唯一标识，说明当前选择了哪个能力。
        "ability": ABILITY_ID,
        # 返回该能力依赖的技能列表，供调用方按顺序调度。
        "required_skills": REQUIRED_SKILLS,
        # 原样返回上下文，便于上层继续传递任务信息。
        "context": context,
    }
    # 返回能力结果字典。
    return result
