"""工程文本统一替换能力。

功能：
在目标工程目录内扫描文本文件，并把指定旧文本统一替换为新文本。

作用：
把跨代码、脚本、文档、样式和预览文件的批量替换沉淀为正式能力，
避免后续继续依赖一次次手工 replace 导致遗漏。

适用场景：
- 工程更名后需要统一替换旧标识
- 前端主题前缀、脚本名、文案前缀需要批量收敛
- 需要在替换后确认是否仍有残留旧文本
"""

from __future__ import annotations

# 导入 mimetypes，用于在扫描时辅助判断文件是否更可能是文本。
import mimetypes
# 导入 Path，统一用 pathlib 处理工程路径。
from pathlib import Path
# 导入 Any，给能力上下文和返回结构补类型标注。
from typing import Any


# 定义能力唯一标识，供注册表和外部调用定位当前能力。
ABILITY_ID = "project_text_replace_unifier"
# 定义能力名称，便于阅读返回结果时快速识别用途。
ABILITY_NAME = "工程文本统一替换"
# 定义能力描述，说明当前能力专门处理工程目录下的统一文本替换。
ABILITY_DESC = "扫描目标工程目录中的文本文件，执行统一文本替换并返回残留扫描结果。"

# 当前能力不依赖额外技能。
REQUIRED_SKILLS: list[str] = []
# 当前能力不依赖外部应用。
REQUIRED_APPS: list[str] = []

# 记录当前代码树根目录，便于需要时回推相对路径。
CODE_ROOT = Path(__file__).resolve().parents[1]

# 定义默认忽略目录，避免扫描依赖目录、版本目录和构建产物。
DEFAULT_IGNORE_DIRS = {
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    ".gradle",
    ".next",
    "__pycache__",
}

# 定义二进制后缀白名单外的常见排除集合，避免误改图片、压缩包和文档二进制。
DEFAULT_BINARY_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".jar",
    ".class",
    ".pyc",
    ".pptx",
    ".xlsx",
    ".docx",
    ".mp4",
    ".mp3",
    ".wav",
}


# 读取字符串集合配置，把上下文里的列表或逗号分隔文本统一转成集合。
def _read_string_set(raw_value: Any) -> set[str]:
    # 若调用方直接传列表，则逐项转成去空格后的字符串集合。
    if isinstance(raw_value, list):
        return {str(item).strip() for item in raw_value if str(item).strip()}
    # 若调用方传单个字符串，则按逗号拆分后再收敛为集合。
    if isinstance(raw_value, str) and raw_value.strip():
        return {item.strip() for item in raw_value.split(",") if item.strip()}
    # 其他情况返回空集合，交给默认配置兜底。
    return set()


# 根据上下文解析目标根目录，确保替换动作始终落在显式指定目录内。
def _resolve_target_root(context: dict[str, Any]) -> Path:
    # 优先读取 target_root，兼容 root_path 和 project_root 两种别名。
    raw_root = (
        str(context.get("target_root") or "").strip()
        or str(context.get("root_path") or "").strip()
        or str(context.get("project_root") or "").strip()
    )
    # 若缺少目标根目录，直接抛错阻断，避免误扫整个工作区。
    if not raw_root:
        raise ValueError("缺少 target_root。")
    # 返回规范化后的绝对路径。
    return Path(raw_root).expanduser().resolve()


# 判断目录名是否需要跳过，避免递归进入依赖和构建目录。
def _should_skip_dir(dir_name: str, ignore_dirs: set[str]) -> bool:
    # 目录命中忽略集合时直接跳过。
    return dir_name in ignore_dirs


# 判断文件是否更可能是文本文件，减少对二进制内容的误读和误写。
def _is_probably_text_file(path: Path, binary_suffixes: set[str]) -> bool:
    # 后缀命中已知二进制集合时直接返回否。
    if path.suffix.lower() in binary_suffixes:
        return False
    # 先用 mimetypes 猜测 MIME 类型，若明显是文本则直接通过。
    guessed_type, _ = mimetypes.guess_type(path.name)
    if guessed_type and guessed_type.startswith("text/"):
        return True
    # 对常见代码、配置和样式后缀直接视为文本。
    if path.suffix.lower() in {
        ".md",
        ".txt",
        ".json",
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".vue",
        ".css",
        ".scss",
        ".html",
        ".htm",
        ".py",
        ".java",
        ".xml",
        ".yml",
        ".yaml",
        ".properties",
        ".command",
        ".sh",
        ".mjs",
        ".cjs",
    }:
        return True
    # 其他文件尝试按 UTF-8 读取，能读通就认为是文本。
    try:
        path.read_text(encoding="utf-8")
        return True
    # 读取失败说明更可能是二进制或未知编码文件，此处不纳入统一替换。
    except Exception:
        return False


# 遍历目标目录中的文本文件，为后续替换提供稳定输入。
def _iter_text_files(target_root: Path, ignore_dirs: set[str], binary_suffixes: set[str]):
    # 若目标根目录不存在，则直接抛错终止。
    if not target_root.exists():
        raise FileNotFoundError(f"目标目录不存在：{target_root}")
    # 递归遍历所有子路径。
    for path in target_root.rglob("*"):
        # 目录本身不参与替换，同时命中忽略目录时跳过其后续内容。
        if path.is_dir():
            if _should_skip_dir(path.name, ignore_dirs):
                # 通过 continue 避免把目录本身纳入文件处理。
                continue
            continue
        # 若任一父级目录命中忽略目录，则跳过当前文件。
        if any(_should_skip_dir(part, ignore_dirs) for part in path.relative_to(target_root).parts[:-1]):
            continue
        # 仅在文件被判定为文本时才向外产出。
        if _is_probably_text_file(path, binary_suffixes):
            yield path


# 扫描文本文件中的旧文本匹配，为替换前后验证提供统一结果。
def _scan_matches(target_root: Path, old_text: str, ignore_dirs: set[str], binary_suffixes: set[str]) -> list[str]:
    # 初始化命中文件列表，后续统一返回相对路径。
    matched_files: list[str] = []
    # 逐个扫描文本文件。
    for path in _iter_text_files(target_root, ignore_dirs, binary_suffixes):
        # 读取完整文本，用于判断是否包含旧文本。
        content = path.read_text(encoding="utf-8")
        # 命中旧文本时记录相对路径，便于人类复核。
        if old_text in content:
            matched_files.append(str(path.relative_to(target_root)))
    # 返回排序后的稳定结果，避免每次顺序飘动。
    return sorted(matched_files)


# 对扫描结果中的文本文件执行真实替换，并返回实际改动文件。
def _replace_matches(target_root: Path, old_text: str, new_text: str, ignore_dirs: set[str], binary_suffixes: set[str]) -> list[str]:
    # 初始化实际改动文件列表。
    changed_files: list[str] = []
    # 逐个处理文本文件，确保每个文件都是显式改写。
    for path in _iter_text_files(target_root, ignore_dirs, binary_suffixes):
        # 读取原始文本，后续用来判断本文件是否真的需要改动。
        original_text = path.read_text(encoding="utf-8")
        # 若当前文件根本不含旧文本，则无需写回。
        if old_text not in original_text:
            continue
        # 生成替换后的新文本内容。
        updated_text = original_text.replace(old_text, new_text)
        # 仅在内容发生变化时才写回磁盘，避免无意义触碰文件。
        if updated_text != original_text:
            path.write_text(updated_text, encoding="utf-8")
            # 记录相对路径，便于外部汇报和验证。
            changed_files.append(str(path.relative_to(target_root)))
    # 返回排序后的稳定结果。
    return sorted(changed_files)


# 当前能力统一入口，根据 action 执行扫描或替换。
def execute(context: dict[str, Any], skills: dict[str, Any], apps: dict[str, Any]) -> dict[str, Any]:
    # 当前能力不依赖 skills 和 apps，这里显式丢弃避免未使用告警。
    _ = skills, apps
    # 解析动作类型，默认执行 replace，因为本能力主要用于统一替换。
    action = str(context.get("action") or "replace").strip().replace("-", "_")
    # 解析目标根目录，统一作为后续扫描和替换边界。
    target_root = _resolve_target_root(context)
    # 读取旧文本和新文本，二者至少需要提供旧文本。
    old_text = str(context.get("old_text") or context.get("from_text") or "").strip()
    new_text = str(context.get("new_text") or context.get("to_text") or "")
    # 若缺少旧文本，则无法构成有效替换任务。
    if not old_text:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "action": action,
            "message": "缺少 old_text/from_text。",
        }
    # 合并默认忽略目录与调用方扩展忽略目录，避免误扫无关目录。
    ignore_dirs = DEFAULT_IGNORE_DIRS | _read_string_set(context.get("ignore_dirs"))
    # 合并默认二进制后缀与调用方扩展排除后缀，减少误处理风险。
    binary_suffixes = DEFAULT_BINARY_SUFFIXES | _read_string_set(context.get("binary_suffixes"))
    # 先做预扫描，确保返回结果里能区分替换前命中范围。
    matched_before = _scan_matches(target_root, old_text, ignore_dirs, binary_suffixes)
    # scan 动作只返回当前命中范围，不执行任何写回。
    if action == "scan":
        return {
            "status": "completed",
            "ability": ABILITY_ID,
            "action": action,
            "target_root": str(target_root),
            "matched_file_count": len(matched_before),
            "matched_files": matched_before,
        }
    # replace 动作需要提供新文本，否则无法完成统一替换。
    if action != "replace" or new_text == "":
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "action": action,
            "message": "replace 动作必须提供 new_text/to_text。",
        }
    # 执行真实替换，并拿到实际改动文件列表。
    changed_files = _replace_matches(target_root, old_text, new_text, ignore_dirs, binary_suffixes)
    # 替换后再次扫描残留旧文本，验证是否仍有漏网文件。
    matched_after = _scan_matches(target_root, old_text, ignore_dirs, binary_suffixes)
    # 返回结构化结果，便于外部继续判断是否需要人工处理残留。
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": action,
        "target_root": str(target_root),
        "old_text": old_text,
        "new_text": new_text,
        "matched_file_count_before": len(matched_before),
        "matched_files_before": matched_before,
        "changed_file_count": len(changed_files),
        "changed_files": changed_files,
        "matched_file_count_after": len(matched_after),
        "matched_files_after": matched_after,
        "all_replaced": len(matched_after) == 0,
    }
