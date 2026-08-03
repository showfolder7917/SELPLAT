"""工程完整文件读取技能。

功能：
用于读取工程目录下的文本文件，并保留完整原文。

作用：
为修改记忆库文件和关键工程文件提供统一读取入口，避免误用清洗读取器导致内容丢失。

适用场景：
- 迁移冻结前修改 `local/core` 下的 Markdown 或文本资源
- 读取当前工程内需要保留完整原文的文件
- 读取 `SELFVUE` 等工程目录下的关键文件做结构判断
- 在写回前先读取完整原文做精确编辑
"""

# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "read_memory_file_full"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "工程完整文件读取器"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "读取工程目录文件，并返回完整原文。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["file_path"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["source_path", "content", "line_count"]


# 导入 pathlib.Path，用于按规范处理文件路径。
from pathlib import Path


# 从迁移后的 Python 包向上识别工程根，禁止回退到旧 MEMORIES 目录。
WORKSPACE_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)


# 定义相对路径格式化函数，便于返回稳定路径。
def to_relative_memory_path(target_path: Path) -> str:
    # 所有工程文件统一返回相对于当前工程根的稳定路径。
    return target_path.relative_to(WORKSPACE_ROOT).as_posix()


# 定义路径校验函数，确保只读取工程目录内的文件。
def validate_memory_file_path(file_path: str) -> Path:
    # 将输入路径解析为绝对路径。
    target_path = Path(file_path).resolve()
    # 禁止读取目录，当前技能只处理单文件。
    if not target_path.is_file():
        raise FileNotFoundError(f"目标文件不存在或不是文件：{target_path}")
    # 禁止读取工程目录之外的文件。
    if target_path != WORKSPACE_ROOT and WORKSPACE_ROOT not in target_path.parents:
        raise ValueError("仅允许读取当前工程目录下的文件。")
    # 返回校验通过的目标文件路径。
    return target_path


# 定义运行入口，接收文件路径并返回完整内容。
def run(file_path: str) -> dict:
    # 校验并解析目标文件路径。
    target_path = validate_memory_file_path(file_path)
    # 读取目标文件的 UTF-8 文本原文，不做任何清洗。
    content = target_path.read_text(encoding="utf-8")
    # 组织标准化返回结果。
    result = {
        # 返回相对于记忆库根目录的稳定路径。
        "source_path": to_relative_memory_path(target_path),
        # 返回完整原文，供精确编辑使用。
        "content": content,
        # 返回原文行数，便于调用方判断体量。
        "line_count": len(content.splitlines()) if content else 0,
    }
    # 返回读取结果字典。
    return result
