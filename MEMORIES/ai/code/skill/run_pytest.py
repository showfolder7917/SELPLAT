"""运行 pytest 技能。

功能：
用于执行 pytest 并返回测试结果。

作用：
为上层能力提供 Python 测试验证能力。

适用场景：
- 回归测试
- 修复后验证
- 脚本或模块基础检查
"""

# 导入 subprocess，用于执行 pytest 命令。
import subprocess


# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "run_pytest"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "运行 pytest"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "执行 pytest 并返回退出码与输出摘要。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["target"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["returncode", "stdout", "stderr"]


# 定义运行入口，接收 pytest 目标并返回执行结果。
def run(target: str = ".") -> dict:
    # 调用 pytest 命令，并捕获标准输出与标准错误。
    process_result = subprocess.run(
        # 传入 pytest 和目标路径，构成实际执行命令。
        ["pytest", target],
        # 捕获标准输出，便于后续汇总结果。
        capture_output=True,
        # 使用文本模式返回结果，避免手动解码。
        text=True,
        # 即使测试失败也不抛异常，统一由返回值处理。
        check=False,
    )
    # 组织标准化测试结果，供能力层或调用方继续判断。
    result = {
        # 返回退出码，用于判断测试是否成功。
        "returncode": process_result.returncode,
        # 返回标准输出文本，便于查看测试详情。
        "stdout": process_result.stdout,
        # 返回标准错误文本，便于查看失败原因。
        "stderr": process_result.stderr,
    }
    # 返回测试结果字典。
    return result
