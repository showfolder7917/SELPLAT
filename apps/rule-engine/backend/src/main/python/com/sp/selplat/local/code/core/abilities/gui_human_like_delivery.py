"""通用 GUI 人类式操作能力。

功能：
用于按统一协议打开已登记 GUI 应用，并让应用按可视化步骤执行自动化计划。

作用：
为后续新增软件提供复用型 GUI 操作能力入口，让 AI 仍然只调用 ability，不直接碰 app。

适用场景：
- 需要打开软件界面再执行自动化操作
- 需要把“设置路径、导入内容、点击开始”这类 GUI 步骤标准化
- 需要让未来新增软件复用同一套 GUI 自动化协议
"""

# 能力唯一标识，用于在注册表中定位当前能力。
ABILITY_ID = "gui_human_like_delivery"
# 能力名称，便于人类和 AI 理解用途。
ABILITY_NAME = "通用 GUI 人类式操作"
# 能力说明，描述当前能力负责的任务范围。
ABILITY_DESC = "打开已登记 GUI 应用，并按标准化自动化计划执行可视化操作。"

# 记录当前能力依赖的技能列表。
REQUIRED_SKILLS = ["launch_gui_app_with_plan"]
# 记录当前能力依赖的应用列表。
REQUIRED_APPS = []


# 导入 json，用于读取注册表。
import json
# 导入 Path，用于统一处理注册表路径。
from pathlib import Path


# 定义能力入口，接收上下文并返回依赖技能信息。
def run(context: dict) -> dict:
    # 组织当前能力结果，供调用方确认匹配结果。
    result = {
        # 返回能力唯一标识，说明当前选择了哪个能力。
        "ability": ABILITY_ID,
        # 返回该能力依赖的技能列表，供调用方按顺序调度。
        "required_skills": REQUIRED_SKILLS,
        # 返回该能力依赖的应用列表。
        "required_apps": REQUIRED_APPS,
        # 原样返回上下文，便于上层继续传递任务信息。
        "context": context,
    }
    # 返回能力结果字典。
    return result


# 定义读取应用注册表的函数。
def load_apps_registry() -> dict:
    # 计算技能库根目录。
    library_root = Path(__file__).resolve().parents[1]
    # 从迁移后的深层包向上识别工程根，定位 resources 中唯一应用注册表。
    project_root = next(
        candidate
        for candidate in Path(__file__).resolve().parents
        if (candidate / "settings.gradle").is_file()
    )
    # 计算应用注册表路径，禁止在 Python 源目录维护重复机器索引。
    registry_path = (
        project_root
        / "apps/rule-engine/backend/src/main/resources/local/core/registry/apps.json"
    )
    # 读取注册表文本。
    content = registry_path.read_text(encoding="utf-8")
    # 解析 JSON 数据。
    data = json.loads(content)
    # 遍历全部应用配置。
    for app_id, app_data in data.items():
        # 读取相对路径。
        relative_path = app_data["path"].removeprefix("./")
        # 补成绝对路径，便于技能直接调用。
        app_data["path"] = str(library_root / relative_path)
    # 返回应用注册表。
    return data


# 定义能力执行入口，统一调度 GUI 应用启动。
def execute(context: dict, skills: dict, apps: dict) -> dict:
    # 读取目标应用标识。
    app_id = context.get("app_id", "").strip()
    # 如果没有提供目标应用标识，则返回错误。
    if not app_id:
        return {
            "status": "missing_app_id",
            "ability": ABILITY_ID,
            "message": "缺少 app_id，无法确定要操作哪个 GUI 应用。",
        }

    # 读取全部应用注册表。
    apps_registry = load_apps_registry()
    # 如果目标应用不存在，则返回错误。
    if app_id not in apps_registry:
        return {
            "status": "missing_app",
            "ability": ABILITY_ID,
            "app": app_id,
            "message": "目标 GUI 应用未登记到 apps.json。",
        }

    # 读取目标应用配置。
    app_config = apps_registry[app_id]
    # 读取应用上下文。
    app_context = dict(context.get("app_context", {}))
    # 写入自动化模式标识。
    app_context["automation_mode"] = "human_like"

    # 如果存在自动化计划，则补入应用上下文。
    if "automation_plan" in context:
        app_context["automation_plan"] = context["automation_plan"]
    # 如果存在置顶配置，则补入应用上下文。
    if "always_on_top" in context:
        app_context["always_on_top"] = context["always_on_top"]

    # 读取通用 GUI 启动技能。
    launch_skill = skills["launch_gui_app_with_plan"]
    # 执行 GUI 启动技能。
    launch_result = launch_skill.run(
        app_id=app_id,
        app_config=app_config,
        app_context=app_context,
    )
    # 组织最终结果。
    result = {
        # 返回能力状态。
        "status": launch_result.get("status", "unknown"),
        # 返回能力标识。
        "ability": ABILITY_ID,
        # 返回目标应用标识。
        "app": app_id,
        # 返回自动化模式。
        "mode": "human_like",
        # 返回启动结果。
        "launch_result": launch_result,
    }
    # 返回能力执行结果。
    return result
