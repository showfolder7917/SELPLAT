"""AI 记忆文件读取技能。

功能：
用于读取 rule-engine `local/core` 文本资源和唯一根规则索引，并清洗为更稳定的 AI 可读文本。

作用：
为整理 core 协议和规则时提供统一读取入口，避免直接读取原文件。

适用场景：
- 读取 `local/core/protocol` 下的协议文件
- 读取 `local/core/rule` 下的规则文件
- 在整理 AI 记忆内容前先移除注释、标题、说明行和空行
"""

# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "read_ai_memory_file"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "AI记忆文件读取器"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "读取 rule-engine local/core 资源或唯一根规则索引，并输出仅保留机器可读行的稳定文本。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["file_path"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["source_path", "cleaned_content", "line_count"]


# 导入 re，用于移除 HTML 注释块并判断可保留行。
import re

# 导入 pathlib.Path，用于按规范处理文件路径。
from pathlib import Path


# 从迁移后的 Python 包向上识别工程根，避免依赖旧 MEMORIES 目录层级。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 定义不可变 core 资源根，当前技能仅允许读取协议、规则和 core 文档资源。
CORE_RESOURCE_ROOT = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/local/core"
)
# 唯一正式规则索引位于 resources 根；仅对这一份文件开放 core 读取器，避免再次维护协议内兼容副本。
ROOT_RULE_INDEX_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/RULE_INDEX.md"
)


# 定义相对路径格式化函数，便于返回稳定路径。
def to_relative_memory_path(target_path: Path) -> str:
    # 返回相对于 rule-engine resources 的稳定路径，便于索引和日志直接复用。
    resource_root = CORE_RESOURCE_ROOT.parents[1]
    return target_path.relative_to(resource_root).as_posix()


# 定义路径校验函数，确保只读取 AI 目录内的文件。
def validate_ai_memory_file_path(file_path: str) -> Path:
    # 将输入路径解析为绝对路径。
    target_path = Path(file_path).resolve()
    # 禁止读取目录，当前技能只处理单文件。
    if not target_path.is_file():
        raise FileNotFoundError(f"目标文件不存在或不是文件：{target_path}")
    # 仅允许读取 core 资源或唯一正式根索引，禁止借能力越界读取 common 或用户层正文。
    is_core_resource = target_path == CORE_RESOURCE_ROOT or CORE_RESOURCE_ROOT in target_path.parents
    if not is_core_resource and target_path != ROOT_RULE_INDEX_PATH:
        raise ValueError("该读取器仅允许读取 rule-engine local/core 资源文件或唯一根 RULE_INDEX.md。")
    # 返回校验通过的目标文件路径。
    return target_path


# 预编译 CJK 检测规则，用于过滤人类中文说明。
_CJK_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
# 预编译机器可读键名规则。
_MACHINE_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_.${}/:-]+$")


def is_machine_readable_line(line: str) -> bool:
    """判断单行是否属于机器可读内容。"""

    if not line:
        return False
    if line.startswith("#"):
        return False
    if line.startswith(("- ", "* ")):
        return False
    if "=" in line:
        left, _, right = line.partition("=")
        left = left.strip()
        right = right.strip()
        if not left or not right:
            return False
        # 规则值允许使用中文路径和业务枚举；只限制键名，避免把合法的当前用户规则索引误删。
        return bool(_MACHINE_KEY_PATTERN.fullmatch(left))
    # 没有赋值符的纯中文说明仍属于人类文本，不进入机器清洗结果。
    if _CJK_PATTERN.search(line):
        return False
    return bool(_MACHINE_KEY_PATTERN.fullmatch(line))


# 定义内容清洗函数，移除注释、标题、说明行和空行。
def clean_ai_memory_content(raw_content: str) -> str:
    # 先移除 HTML 注释，兼容 `<!-- -->` 与 `<! -- -->` 写法。
    without_comments = re.sub(
        r"<!\s*--.*?--\s*>",
        "",
        raw_content,
        flags=re.DOTALL,
    )
    # 初始化清洗后的行列表。
    cleaned_lines = []
    # 按行遍历内容。
    for line in without_comments.splitlines():
        # 去掉首尾空白，降低格式噪音。
        normalized_line = line.strip()
        # 空行直接跳过。
        if not normalized_line:
            continue
        # 仅保留机器可读行。
        if not is_machine_readable_line(normalized_line):
            continue
        # 保存清洗后的非空行。
        cleaned_lines.append(normalized_line)
    # 返回压缩后的稳定文本。
    return "\n".join(cleaned_lines)


# 定义运行入口，接收文件路径并返回清洗结果。
def run(file_path: str) -> dict:
    # 校验并解析目标文件路径。
    target_path = validate_ai_memory_file_path(file_path)
    # 读取目标文件的 UTF-8 文本内容。
    raw_content = target_path.read_text(encoding="utf-8")
    # 清洗文本内容，供 AI 稳定读取。
    cleaned_content = clean_ai_memory_content(raw_content)
    # 组织标准化返回结果。
    result = {
        # 返回相对于记忆库根目录的稳定路径。
        "source_path": to_relative_memory_path(target_path),
        # 返回清洗后的正文。
        "cleaned_content": cleaned_content,
        # 返回清洗后有效行数，便于调用方判断体量。
        "line_count": len(cleaned_content.splitlines()) if cleaned_content else 0,
    }
    # 返回读取结果字典。
    return result
