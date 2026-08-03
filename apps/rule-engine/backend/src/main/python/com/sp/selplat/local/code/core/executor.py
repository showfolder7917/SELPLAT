"""Python 能力执行器。

功能：
统一执行 code 目录中登记的 ability，并按依赖加载 skill 与 app。

作用：
把 ability 从“注册表里的声明”提升为“真正可执行的运行入口”，
让调用方只需要给出 ability 名称，就能拿到稳定的执行结果。

适用场景：
- 根据 ability 名称执行已登记能力
- 在执行前检查依赖 skill 与 app 是否完整
- 将依赖模块加载后交给 ability 自身编排
"""

# 导入 os，让能力启动的 Python 子进程继承工程字节码缓存根。
import os
import sys
from pathlib import Path


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

# 缓存策略生效后再导入动态加载和 JSON 能力。
import importlib.util
import json


# 这个常量是给外部文档和调试输出看的执行器名称。
EXECUTOR_NAME = "python_ability_executor"
# 这个常量用一句话说明执行器在系统里的职责。
EXECUTOR_DESC = "按 ability 调度 skill 与 app 的统一执行入口。"


def get_library_root() -> Path:
    """返回 Python core 目录本身，能力、技能和应用路径都从这里展开。"""

    return Path(__file__).resolve().parent


def get_project_root() -> Path:
    """返回包含 settings.gradle 的当前工程根，例如 `C:/opt/workspace/SELPLAT`。"""

    # 返回模块加载阶段已经核验的唯一工程根，避免不同能力重复推断。
    return PROJECT_ROOT


def get_registry_root() -> Path:
    """返回 core 注册表目录，例如 `apps/rule-engine/backend/src/main/resources/local/core/registry`。"""

    # 注册表属于不可变 core 资源，不与某一种执行语言重复存放。
    return (
        get_project_root()
        / "apps/rule-engine/backend/src/main/resources/local/core/registry"
    )


def load_json_file(file_path: Path) -> dict:
    """读取一份 UTF-8 JSON 文件，并返回解析后的字典结果。"""

    content = file_path.read_text(encoding="utf-8")
    return json.loads(content)


def normalize_name(name: str) -> str:
    """把外部输入的名字压成统一形式，避免大小写和连接符差异影响匹配。"""

    normalized = name.strip()
    normalized = normalized.replace("-", "_")
    normalized = normalized.replace(" ", "_")
    return normalized.lower()


def build_lookup_table(registry_data: dict) -> dict:
    """把注册表改造成按标准化名称检索的查询表，便于后续快速匹配。"""

    lookup_table = {}
    for item_id, item_data in registry_data.items():
        lookup_table[normalize_name(item_id)] = {
            "id": item_id,
            "data": item_data,
        }
    return lookup_table


def build_absolute_path(library_root: Path, relative_path: str) -> Path:
    """把注册表里的相对路径转换成真实文件路径。"""

    clean_path = relative_path.removeprefix("./")
    return library_root / clean_path


def load_python_module(module_path: Path, module_name: str):
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


def normalize_result_payload(result: object) -> dict:
    """把 ability 的返回值统一成字典，方便调用方稳定取值。"""

    if isinstance(result, dict):
        return dict(result)
    return {"result": result}


def load_registries(library_root: Path) -> tuple[dict, dict, dict]:
    """一次性读取 abilities、skills、apps 三份注册表。"""

    # library_root 继续用于解析注册条目的相对代码路径，注册表正文则统一从 core resources 读取。
    _ = library_root
    # 获取唯一 core 注册表根，避免迁移后在 Python 源目录复制机器索引。
    registry_root = get_registry_root()
    # 读取能力注册表，条目路径仍相对于 Python core 代码根。
    abilities_registry = load_json_file(registry_root / "abilities.json")
    # 读取技能注册表，供能力执行前校验内部依赖。
    skills_registry = load_json_file(registry_root / "skills.json")
    # 读取应用注册表，供能力组装语言原生应用入口。
    apps_registry = load_json_file(registry_root / "apps.json")
    return abilities_registry, skills_registry, apps_registry


def resolve_ability_dependencies(ability_name: str) -> dict:
    """解析某个 ability 的执行入口以及它依赖的 skill/app 路径。"""

    # 先拿到 code 运行时根目录。
    library_root = get_library_root()
    # 再把三份注册表读进来，后续所有判断都以注册表为准。
    abilities_registry, skills_registry, apps_registry = load_registries(library_root)
    # 注册表原始结构不适合频繁查找，这里先压成统一查询表。
    ability_lookup = build_lookup_table(abilities_registry)
    skill_lookup = build_lookup_table(skills_registry)
    app_lookup = build_lookup_table(apps_registry)
    # 调用方传进来的名字可能大小写或符号不一致，先标准化。
    normalized_ability_name = normalize_name(ability_name)

    # ability 不存在时，执行器就不应该继续往下走。
    if normalized_ability_name not in ability_lookup:
        return {
            "status": "missing_ability",
            "ability": ability_name,
            "message": "未找到对应 ability。",
        }

    # 命中 ability 后，先取出注册信息。
    ability_item = ability_lookup[normalized_ability_name]
    ability_id = ability_item["id"]
    ability_data = ability_item["data"]
    required_skills = ability_data.get("skills", [])
    required_apps = ability_data.get("apps", [])

    # 执行器只负责发现依赖是否缺失，不负责自动补齐依赖。
    missing_skills = []
    missing_apps = []

    for skill_id in required_skills:
        if normalize_name(skill_id) not in skill_lookup:
            missing_skills.append(skill_id)

    for app_id in required_apps:
        if normalize_name(app_id) not in app_lookup:
            missing_apps.append(app_id)

    if missing_skills or missing_apps:
        return {
            "status": "missing_dependency",
            "ability": ability_id,
            "missing_skills": missing_skills,
            "missing_apps": missing_apps,
        }

    # 依赖完整后，把 ability/skill/app 的物理路径全部展开出来。
    ability_path = build_absolute_path(library_root, ability_data["path"])
    skill_paths = {}
    app_paths = {}

    for skill_id in required_skills:
        skill_data = skill_lookup[normalize_name(skill_id)]["data"]
        skill_paths[skill_id] = build_absolute_path(library_root, skill_data["path"])

    for app_id in required_apps:
        app_data = app_lookup[normalize_name(app_id)]["data"]
        app_paths[app_id] = build_absolute_path(library_root, app_data["path"])

    # 返回的是“执行前准备结果”，真正执行动作还在 execute_ability 里。
    return {
        "status": "ready_ability",
        "ability": ability_id,
        "ability_path": ability_path,
        "required_skills": required_skills,
        "required_apps": required_apps,
        "skill_paths": skill_paths,
        "app_paths": app_paths,
    }


def build_app_configs(required_apps: list[str], app_paths: dict[str, Path]) -> dict:
    """把 app 注册信息整理成 ability 可以直接消费的运行配置。"""

    library_root = get_library_root()
    _, _, apps_registry = load_registries(library_root)
    app_configs = {}

    for app_id in required_apps:
        app_data = apps_registry[app_id]
        app_configs[app_id] = {
            "id": app_id,
            "path": app_paths[app_id],
            "python_candidates": app_data.get("python_candidates", ["python3"]),
            "runtime_check_module": app_data.get("runtime_check_module"),
        }

    return app_configs


def execute_ability(ability_name: str, context: dict | None = None) -> dict:
    """执行一个已登记的 ability。"""

    # 执行器对外允许 context 省略，这里统一兜成空字典。
    if context is None:
        context = {}
    # 做一份副本，避免 ability 在原对象上原地改写外部传入参数。
    normalized_context = dict(context)

    # 第一步先解析 ability 和依赖；这里失败就直接返回，不继续执行。
    resolution = resolve_ability_dependencies(ability_name)
    if resolution.get("status") != "ready_ability":
        return resolution

    # 第二步加载目标 ability 模块。
    ability_id = resolution["ability"]
    ability_module = load_python_module(
        resolution["ability_path"],
        f"ability_{ability_id}",
    )

    # 第三步把依赖 skill 模块全部提前准备好，交给 ability 自己编排。
    skill_modules = {}
    for skill_id in resolution["required_skills"]:
        skill_modules[skill_id] = load_python_module(
            resolution["skill_paths"][skill_id],
            f"skill_{skill_id}",
        )

    # 第四步把 app 依赖整理成运行配置，而不是在执行器里直接启动 app。
    app_configs = build_app_configs(
        resolution["required_apps"],
        resolution["app_paths"],
    )

    # ability 如果实现了 execute()，说明它已经准备好了完整执行入口。
    if hasattr(ability_module, "execute"):
        result = ability_module.execute(
            context=normalized_context,
            skills=skill_modules,
            apps=app_configs,
        )
        return normalize_result_payload(result)

    # 有些旧 ability 只有 run()，执行器继续兼容，但明确告诉调用方这是回退路径。
    if hasattr(ability_module, "run"):
        ability_result = ability_module.run(normalized_context)
        return {
            "status": "planned_ability",
            "ability": ability_id,
            "result": ability_result,
            "message": "ability 已找到，但未定义 execute()，当前只返回依赖计划。",
        }

    # 两种入口都没有时，说明 ability 文件存在，但不具备可执行契约。
    return {
        "status": "invalid_ability",
        "ability": ability_id,
        "message": "ability 缺少可执行入口。",
    }


def main() -> int:
    """命令行入口：根据 ability 名称和可选 context_json 直接执行能力。"""

    if len(sys.argv) < 2:
        print("Usage: python executor.py <ability_name> [context_json] or python3 executor.py <ability_name> [context_json]")
        return 1

    ability_name = sys.argv[1]
    context = {}
    if len(sys.argv) >= 3:
        context = json.loads(sys.argv[2])

    result = execute_ability(ability_name, context=context)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
