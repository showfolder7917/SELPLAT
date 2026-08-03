"""写入文件技能。

功能：
用于将文本内容写入 UTF-8 文件。

作用：
为上层能力提供文件写入基础能力。

适用场景：
- 写入 Python 源文件
- 生成配置文件
- 输出 Markdown 或文本结果
"""

# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "write_file"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "写入文件"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "将文本内容写入 UTF-8 文件。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["file_path", "content"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["written"]


# 导入 pathlib.Path，用于按规范处理文件路径。
from pathlib import Path


# 定义运行入口，接收文件路径和文本内容并返回写入结果。
def run(file_path: str, content: str) -> dict:
    # 将字符串路径转换为 Path 对象，统一路径处理方式。
    target_path = Path(file_path)
    # 以 UTF-8 编码写入文本内容到目标文件。
    target_path.write_text(content, encoding="utf-8")
    # 组织标准化写入结果，供调用方判断是否成功。
    result = {"written": True}
    # 返回写入结果字典。
    return result
