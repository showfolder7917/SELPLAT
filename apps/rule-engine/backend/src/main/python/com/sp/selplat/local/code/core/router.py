"""Python 技能库路由器。

功能：
用于读取 Python 技能库注册表，并判断当前任务应调用哪个能力或技能。

作用：
为 AI 提供统一的技能库路由入口，避免在未登记能力、技能或应用时直接执行任务。

适用场景：
- 根据任务名匹配已登记能力
- 检查能力依赖的技能是否完整
- 检查能力依赖的应用是否完整
- 在缺少能力、技能或应用时生成提示结果
"""

# 导入 json，用于读取技能库注册表。
import json
# 导入 sys，用于支持命令行演示入口。
import sys

# 导入 Path，用于按规范处理文件路径。
from pathlib import Path


# 当前文件所在目录名称，用于对外标识当前路由器。
ROUTER_NAME = "python_skill_router"
# 路由器说明，用于描述当前文件职责。
ROUTER_DESC = "读取 registry 并匹配 ability，并检查 skill 与 app 依赖。"


# 定义获取技能库根目录的函数。
def get_library_root() -> Path:
    # 返回当前文件所在目录，作为 code 运行能力库根目录。
    return Path(__file__).resolve().parent


# 定义获取唯一 core 注册表目录的函数，保持机器索引与执行语言解耦。
def get_registry_root() -> Path:
    # 从当前深层包向上找到工程根，避免目录迁移再次破坏固定 parents 下标。
    project_root = next(
        candidate
        for candidate in Path(__file__).resolve().parents
        if (candidate / "settings.gradle").is_file()
    )
    # 返回 resources 中唯一注册表根，Python 代码目录不再保留重复副本。
    return project_root / "apps/rule-engine/backend/src/main/resources/local/core/registry"


# 定义读取 JSON 文件的函数。
def load_json_file(file_path: Path) -> dict:
    # 读取指定 JSON 文件的 UTF-8 文本内容。
    content = file_path.read_text(encoding="utf-8")
    # 将 JSON 文本解析为字典对象。
    data = json.loads(content)
    # 返回解析后的字典结果。
    return data


# 定义名称标准化函数，用于兼容不同输入写法。
def normalize_name(name: str) -> str:
    # 去掉首尾空白字符，避免输入误差影响匹配。
    normalized = name.strip()
    # 将短横线替换为下划线，统一命名形式。
    normalized = normalized.replace("-", "_")
    # 将空格替换为下划线，统一命名形式。
    normalized = normalized.replace(" ", "_")
    # 转换为小写，避免大小写差异影响匹配。
    normalized = normalized.lower()
    # 返回标准化后的名称。
    return normalized


# 定义构建绝对路径的函数。
def build_absolute_path(library_root: Path, relative_path: str) -> str:
    # 去掉相对路径前缀中的 ./，便于后续拼接。
    clean_path = relative_path.removeprefix("./")
    # 使用技能库根目录和相对路径构造绝对路径。
    absolute_path = library_root / clean_path
    # 返回绝对路径字符串，便于外部查看。
    return str(absolute_path)


# 定义按标准化名称构建索引的函数。
def build_lookup_table(registry_data: dict) -> dict:
    # 初始化空字典，用于存放标准化后的查询映射。
    lookup_table = {}
    # 遍历注册表中的每一项。
    for item_id, item_data in registry_data.items():
        # 将条目标识标准化，作为查询键。
        normalized_id = normalize_name(item_id)
        # 将原始条目数据存入查询映射。
        lookup_table[normalized_id] = {
            # 保存原始条目标识，便于返回真实 ID。
            "id": item_id,
            # 保存原始条目数据，便于后续读取路径和依赖。
            "data": item_data,
        }
    # 返回构建完成的查询映射。
    return lookup_table


# 定义主路由函数，根据任务名返回路由结果。
def route_task(task_name: str) -> dict:
    # 获取当前 code 运行能力库根目录。
    library_root = get_library_root()
    # 获取唯一 core 注册表根，执行代码路径仍由 library_root 解析。
    registry_root = get_registry_root()
    # 计算能力注册表文件路径。
    abilities_registry_path = registry_root / "abilities.json"
    # 计算技能注册表文件路径。
    skills_registry_path = registry_root / "skills.json"
    # 计算应用注册表文件路径。
    apps_registry_path = registry_root / "apps.json"
    # 读取能力注册表。
    abilities_registry = load_json_file(abilities_registry_path)
    # 读取技能注册表。
    skills_registry = load_json_file(skills_registry_path)
    # 读取应用注册表。
    apps_registry = load_json_file(apps_registry_path)
    # 构建能力查询映射。
    ability_lookup = build_lookup_table(abilities_registry)
    # 构建技能查询映射。
    skill_lookup = build_lookup_table(skills_registry)
    # 构建应用查询映射。
    app_lookup = build_lookup_table(apps_registry)
    # 标准化任务名称，便于统一匹配。
    normalized_task_name = normalize_name(task_name)

    # 如果任务名命中某个能力，则按能力处理。
    if normalized_task_name in ability_lookup:
        # 取得匹配到的能力条目。
        ability_item = ability_lookup[normalized_task_name]
        # 取得能力真实标识。
        ability_id = ability_item["id"]
        # 取得能力原始数据。
        ability_data = ability_item["data"]
        # 取得能力依赖的技能列表。
        required_skills = ability_data.get("skills", [])
        # 取得能力依赖的应用列表。
        required_apps = ability_data.get("apps", [])
        # 初始化缺失技能列表。
        missing_skills = []
        # 初始化缺失应用列表。
        missing_apps = []

        # 遍历能力依赖的每个技能。
        for skill_id in required_skills:
            # 如果某个依赖技能不存在，则记录到缺失列表。
            if normalize_name(skill_id) not in skill_lookup:
                # 追加缺失技能标识。
                missing_skills.append(skill_id)

        # 遍历能力依赖的每个应用。
        for app_id in required_apps:
            # 如果某个依赖应用不存在，则记录到缺失列表。
            if normalize_name(app_id) not in app_lookup:
                # 追加缺失应用标识。
                missing_apps.append(app_id)

        # 如果存在缺失技能，则返回需要询问新增技能的结果。
        if missing_skills:
            # 组织缺失技能场景下的路由结果。
            result = {
                # 返回当前状态，表示缺少基础技能。
                "status": "missing_skill",
                # 返回输入的任务名，便于外部追踪来源。
                "task_name": task_name,
                # 返回匹配到的能力标识。
                "ability": ability_id,
                # 返回能力文件绝对路径。
                "ability_path": build_absolute_path(
                    library_root,
                    ability_data["path"],
                ),
                # 返回缺失的技能列表。
                "missing_skills": missing_skills,
                # 返回建议动作，提示询问是否新增技能。
                "next_action": "ask_to_add_missing_skill",
            }
            # 返回缺失技能结果。
            return result

        # 如果存在缺失应用，则返回需要询问新增应用的结果。
        if missing_apps:
            # 组织缺失应用场景下的路由结果。
            result = {
                # 返回当前状态，表示缺少基础应用。
                "status": "missing_app",
                # 返回输入的任务名，便于外部追踪来源。
                "task_name": task_name,
                # 返回匹配到的能力标识。
                "ability": ability_id,
                # 返回能力文件绝对路径。
                "ability_path": build_absolute_path(
                    library_root,
                    ability_data["path"],
                ),
                # 返回缺失的应用列表。
                "missing_apps": missing_apps,
                # 返回建议动作，提示询问是否新增应用。
                "next_action": "ask_to_add_missing_app",
            }
            # 返回缺失应用结果。
            return result

        # 组织能力已匹配且依赖完整时的路由结果。
        result = {
            # 返回当前状态，表示能力已就绪。
            "status": "ready_ability",
            # 返回输入的任务名，便于外部追踪来源。
            "task_name": task_name,
            # 返回匹配到的能力标识。
            "ability": ability_id,
            # 返回能力文件绝对路径。
            "ability_path": build_absolute_path(
                library_root,
                ability_data["path"],
            ),
            # 返回依赖的技能列表。
            "required_skills": required_skills,
            # 返回依赖的应用列表。
            "required_apps": required_apps,
            # 返回建议动作，提示调用能力。
            "next_action": "call_ability",
        }
        # 返回能力已就绪结果。
        return result

    # 如果没有命中能力，但命中单技能，则提示需要补充对应能力。
    if normalized_task_name in skill_lookup:
        # 取得匹配到的技能条目。
        skill_item = skill_lookup[normalized_task_name]
        # 取得技能真实标识。
        skill_id = skill_item["id"]
        # 组织缺少能力的结果。
        result = {
            # 返回当前状态，表示技能存在但能力不存在。
            "status": "missing_ability",
            # 返回输入的任务名，便于外部追踪来源。
            "task_name": task_name,
            # 返回匹配到的技能标识，便于新增能力时复用。
            "skill": skill_id,
            # 返回建议动作，提示先新增 ability。
            "next_action": "ask_to_add_ability_for_existing_skill",
            # 返回说明，明确 AI 不能直接调用 skill。
            "message": "已找到 skill，但 AI 只允许调用 ability，请先新增对应 ability。",
        }
        # 返回结果。
        return result

    # 如果没有命中能力，但命中应用，则提示需要补充对应能力。
    if normalized_task_name in app_lookup:
        # 取得匹配到的应用条目。
        app_item = app_lookup[normalized_task_name]
        # 取得应用真实标识。
        app_id = app_item["id"]
        # 组织缺少能力的结果。
        result = {
            # 返回当前状态，表示应用存在但能力不存在。
            "status": "missing_ability",
            # 返回输入的任务名，便于外部追踪来源。
            "task_name": task_name,
            # 返回匹配到的应用标识，便于新增能力时复用。
            "app": app_id,
            # 返回建议动作，提示先新增 ability。
            "next_action": "ask_to_add_ability_for_existing_app",
            # 返回说明，明确 AI 不能直接调用 app。
            "message": "已找到 app，但 AI 只允许调用 ability，请先新增对应 ability。",
        }
        # 返回结果。
        return result

    # 组织缺少能力或依赖项时的路由结果。
    result = {
        # 返回当前状态，表示没有匹配项。
        "status": "missing_ability_or_dependency",
        # 返回输入的任务名，便于外部追踪来源。
        "task_name": task_name,
        # 返回建议动作，提示先询问是否新增能力或技能。
        "next_action": "ask_to_add_ability_or_skill",
        # 返回提示信息，说明当前技能库中没有匹配项。
        "message": "未找到匹配的 ability、skill 或 app，请先询问是否新增。",
    }
    # 返回缺少能力或技能结果。
    return result


# 定义命令行入口函数，便于本地快速测试路由结果。
def main() -> int:
    # 如果命令行参数不足，则打印用法说明。
    if len(sys.argv) < 2:
        # 输出命令行使用说明。
        print("Usage: python router.py <task_name>")
        # 返回非零退出码，表示参数不足。
        return 1

    # 读取命令行传入的任务名称。
    task_name = sys.argv[1]
    # 调用主路由函数获取结果。
    result = route_task(task_name)
    # 将路由结果格式化为 JSON 文本并输出。
    print(json.dumps(result, ensure_ascii=False, indent=2))
    # 返回零退出码，表示执行成功。
    return 0


# 如果当前文件作为脚本直接运行，则进入命令行入口。
if __name__ == "__main__":
    # 使用系统退出函数返回入口函数的退出码。
    raise SystemExit(main())
