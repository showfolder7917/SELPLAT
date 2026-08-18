"""Python 核心能力唯一执行入口。

执行器只读取能力注册表、加载目标 ability 并返回标准结果。公共实现由 ability
自行调用 ``util``，执行器不再解析 skill 或 app 注册表，也不负责领域依赖注入。
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import sys
from types import ModuleType
from typing import Any


# 执行器加载任何工程能力前先识别当前工程根。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 工程 Python 字节码缓存统一位于 cache，不允许回写 main/test 源码目录。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
# 当前解释器的后续模块加载立即使用统一缓存根。
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
# 后续子进程继承同一缓存根。
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)

EXECUTOR_NAME = "python_ability_executor"
EXECUTOR_DESC = "仅按唯一能力注册表加载并执行 Python core ability。"


def get_library_root() -> Path:
    """返回包含 executor、abilities 和 util 的 Python core 根。"""

    return Path(__file__).resolve().parent


def get_registry_path() -> Path:
    """返回唯一能力注册表路径。"""

    return (
        PROJECT_ROOT
        / "apps/rule-engine/backend/src/main/resources/local/core/registry/abilities.json"
    )


def normalize_name(name: str) -> str:
    """把外部输入的名字压成统一形式，避免大小写和连接符差异影响匹配。"""

    normalized = name.strip()
    normalized = normalized.replace("-", "_")
    normalized = normalized.replace(" ", "_")
    return normalized.lower()


def load_ability_registry() -> dict[str, dict[str, Any]]:
    """读取并校验唯一能力注册表的顶层结构。"""

    registry = json.loads(get_registry_path().read_text(encoding="utf-8"))
    if not isinstance(registry, dict):
        raise ValueError("abilities.json 顶层必须是对象。")
    return registry


def build_lookup_table(registry: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """建立标准化名称索引，并阻断两个 ID 归一化后发生冲突。"""

    lookup: dict[str, dict[str, Any]] = {}
    for ability_id, definition in registry.items():
        normalized_id = normalize_name(ability_id)
        if normalized_id in lookup:
            raise ValueError(f"能力 ID 标准化后重复：{ability_id}")
        lookup[normalized_id] = {"id": ability_id, "definition": definition}
    return lookup


def load_python_module(module_path: Path, module_name: str) -> ModuleType:
    """按文件路径动态加载一个 Python 模块。"""

    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块：{module_path}")
    module = importlib.util.module_from_spec(spec)
    # dataclass 等标准库在类装饰阶段会按模块名回查 sys.modules，执行前必须先登记真实模块对象。
    sys.modules[module_name] = module
    try:
        # 执行登记能力源码，模块内类和类型注解可以通过统一模块名正确解析。
        spec.loader.exec_module(module)
    except Exception:
        # 加载失败时清理半初始化模块，防止下一次调用复用不完整状态。
        sys.modules.pop(module_name, None)
        # 保留原始异常和堆栈，让调用方获得真实迁移或能力错误。
        raise
    return module


def normalize_result_payload(result: object) -> dict[str, Any]:
    """把 ability 的返回值统一成字典，方便调用方稳定取值。"""

    if isinstance(result, dict):
        return dict(result)
    return {"result": result}


def resolve_ability(ability_name: str) -> dict[str, Any]:
    """解析一个能力的唯一入口，并阻断路径逃逸或失效注册。"""

    lookup = build_lookup_table(load_ability_registry())
    normalized_name = normalize_name(ability_name)
    if normalized_name not in lookup:
        return {
            "status": "missing_ability",
            "ability": ability_name,
            "message": "未找到对应 ability。",
        }
    item = lookup[normalized_name]
    definition = item["definition"]
    relative_path = str(definition.get("path") or "").removeprefix("./")
    library_root = get_library_root().resolve()
    ability_path = (library_root / relative_path).resolve()
    if library_root not in ability_path.parents:
        return {
            "status": "invalid_ability_path",
            "ability": item["id"],
            "message": "能力注册路径越出 Python core。",
        }
    if not ability_path.is_file():
        return {
            "status": "missing_ability_file",
            "ability": item["id"],
            "message": f"能力实现不存在：{ability_path}",
        }
    return {
        "status": "ready_ability",
        "ability": item["id"],
        "ability_path": ability_path,
    }


def execute_ability(ability_name: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """执行已登记 ability；空 skills/apps 仅保留一个迁移阶段的签名兼容。"""

    resolution = resolve_ability(ability_name)
    if resolution.get("status") != "ready_ability":
        return resolution

    ability_id = str(resolution["ability"])
    ability_module = load_python_module(
        Path(resolution["ability_path"]),
        f"ability_{ability_id}",
    )
    normalized_context = dict(context or {})
    if hasattr(ability_module, "execute"):
        result = ability_module.execute(
            context=normalized_context,
            skills={},
            apps={},
        )
        return normalize_result_payload(result)

    # 有些旧 ability 只有 run()，执行器继续兼容，但明确告诉调用方这是回退路径。
    if hasattr(ability_module, "run"):
        return {
            "status": "planned_ability",
            "ability": ability_id,
            "result": ability_module.run(normalized_context),
            "message": "ability 已找到，但未定义 execute()。",
        }

    # 两种入口都没有时，说明 ability 文件存在，但不具备可执行契约。
    return {
        "status": "invalid_ability",
        "ability": ability_id,
        "message": "ability 缺少可执行入口。",
    }


def main() -> int:
    """解析命令行能力名称和 JSON 上下文，并返回能力声明的退出码。"""

    if len(sys.argv) < 2:
        print("Usage: python3 executor.py <ability_name> [context_json]")
        return 1

    ability_name = sys.argv[1]
    context = {}
    if len(sys.argv) >= 3:
        context = json.loads(sys.argv[2])

    result = execute_ability(ability_name, context=context)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    # 能力可通过 exit_code 把业务阻断状态传给 Gradle 等外部门禁；未声明时保持既有成功退出行为。
    return int(result.get("exit_code") or 0)


if __name__ == "__main__":
    raise SystemExit(main())
