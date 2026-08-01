"""修复并验证能力。

功能：
用于组合问题修复与测试验证相关技能。

作用：
为上层流程提供 Python 修复并验证的综合能力。

适用场景：
- 修复 Python 报错后执行验证
- 修改逻辑后执行回归检查
- 处理已知问题并快速确认结果
"""

# 能力唯一标识，用于在注册表中定位当前能力。
ABILITY_ID = "bugfix_and_verify"
# 能力名称，便于人类和 AI 理解用途。
ABILITY_NAME = "修复并验证"
# 能力说明，描述当前能力负责的任务范围。
ABILITY_DESC = "修复 Python 问题并执行验证。"

# 记录当前能力依赖的单技能列表。
REQUIRED_SKILLS = ["read_file", "fix_small_bug", "run_pytest"]


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
