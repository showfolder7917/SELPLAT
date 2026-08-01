"""读取文件技能。

功能：
用于读取 UTF-8 文本文件内容。

作用：
为上层能力提供文件内容读取基础能力。

适用场景：
- 读取 Python 源文件
- 读取配置文件
- 读取 Markdown 或文本说明文件
"""

# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "read_file"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "读取文件"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "读取 UTF-8 文本文件内容并返回文本。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["file_path"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["content"]


# 导入 pathlib.Path，用于按规范处理文件路径。
from pathlib import Path


# 定义运行入口，接收文件路径并返回字典结果。
def run(file_path: str) -> dict:
    # 将字符串路径转换为 Path 对象，统一路径处理方式。
    target_path = Path(file_path)
    # 读取目标文件的 UTF-8 文本内容。
    content = target_path.read_text(encoding="utf-8")
    # 返回标准化结果，供能力层或调用方继续使用。
    result = {"content": content}
    # 返回读取结果字典。
    return result
