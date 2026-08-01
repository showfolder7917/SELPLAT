"""修复小范围问题技能。

功能：
用于处理已有定位信息的小范围 Python 问题修复。

作用：
为上层能力提供单点问题修复基础能力。

适用场景：
- 已知报错修复
- 已知逻辑错误修复
- 小范围代码调整
"""

# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "fix_small_bug"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "修复小范围问题"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "处理已有定位信息的小范围 Python 逻辑修复。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["target_file", "bug_summary"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["status", "next_action"]


# 定义运行入口，接收目标文件和问题描述并返回占位结果。
def run(target_file: str, bug_summary: str) -> dict:
    # 组织当前技能的标准化占位信息，表示还需要具体改动动作。
    result = {
        # 返回当前状态，提示调用方仍需人工或上层流程介入。
        "status": "manual_fix_required",
        # 返回目标文件，便于上层继续定位处理对象。
        "target_file": target_file,
        # 返回问题摘要，便于后续修复流程复用描述。
        "bug_summary": bug_summary,
        # 返回下一步建议动作，提示需要应用定向代码修改。
        "next_action": "apply_targeted_code_change",
    }
    # 返回问题修复建议结果。
    return result
