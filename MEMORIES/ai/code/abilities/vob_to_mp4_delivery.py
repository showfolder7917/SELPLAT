"""媒体转换交付能力。

功能：
用于将 VOB 或 MP4 媒体文件转换为目标输出格式。

作用：
为 AI 提供统一的媒体转换能力入口，并在内部组合转码技能与图形界面应用。

适用场景：
- 将 DVD 导出的 VOB 文件转为 MP4 或 MP3
- 将 MP4 文件提取为 WAV
- 使用 Python 技能库统一管理媒体转换调用入口
- 在默认输出目录 `./OPTION/` 生成目标格式文件
- 将转码日志统一写入 `./OPTION/log/*.log`
"""

# 能力唯一标识，用于在注册表中定位当前能力。
ABILITY_ID = "vob_to_mp4_delivery"
# 能力名称，便于人类和 AI 理解用途。
ABILITY_NAME = "媒体转换交付"
# 能力说明，描述当前能力负责的任务范围。
ABILITY_DESC = "完成 VOB/MP4 媒体文件到目标格式的转码或音频提取交付。"

# 记录当前能力依赖的技能列表。
REQUIRED_SKILLS = [
    "ffmpeg_vob_to_mp4",
    "ffmpeg_vob_to_mp3",
    "ffmpeg_mp4_to_wav",
    "launch_gui_app_with_plan",
]
# 记录当前能力依赖的应用列表。
REQUIRED_APPS = ["vob_to_mp4_gui_pyside6"]


# 导入 datetime，用于写入日志时间。
from datetime import datetime
# 导入 Path，用于统一处理日志文件路径。
from pathlib import Path
# 定义能力入口，接收上下文并返回依赖技能信息。
def run(context: dict) -> dict:
    # 组织当前能力结果，供调用方确认匹配结果。
    result = {
        # 返回能力唯一标识，说明当前选择了哪个能力。
        "ability": ABILITY_ID,
        # 返回该能力依赖的技能列表，供调用方按顺序调度。
        "required_skills": REQUIRED_SKILLS,
        # 返回该能力依赖的应用列表，供调用方按顺序调度。
        "required_apps": REQUIRED_APPS,
        # 原样返回上下文，便于上层继续传递任务信息。
        "context": context,
    }
    # 返回能力结果字典。
    return result


# 定义能力执行入口，统一调度 skill 和 app。
def execute(context: dict, skills: dict, apps: dict) -> dict:
    # 读取转换模式，默认仍为 VOB 转 MP4。
    conversion_mode = context.get("conversion_mode", "vob_to_mp4")
    # 读取是否使用图形界面，默认开启。
    use_gui = context.get("use_gui", True)
    # 读取是否始终置顶，默认开启。
    always_on_top = context.get("always_on_top", True)
    # 定义模式配置表。
    mode_configs = {
        "vob_to_mp4": {
            "default_output_file": "./OPTION/VIDEO_TS_ability.mp4",
            "default_log_file": "./OPTION/log/VIDEO_TS_ability.log",
            "skill_id": "ffmpeg_vob_to_mp4",
        },
        "vob_to_mp3": {
            "default_output_file": "./OPTION/VIDEO_TS_ability.mp3",
            "default_log_file": "./OPTION/log/VIDEO_TS_to_mp3_ability.log",
            "skill_id": "ffmpeg_vob_to_mp3",
        },
        "mp4_to_wav": {
            "default_output_file": "./OPTION/VIDEO_TS_ability.wav",
            "default_log_file": "./OPTION/log/MP4_to_WAV_ability.log",
            "skill_id": "ffmpeg_mp4_to_wav",
        },
    }
    # 读取当前模式配置，不存在则回退到默认模式。
    mode_config = mode_configs.get(conversion_mode, mode_configs["vob_to_mp4"])
    # 读取输入文件路径，若未传入则使用当前模式默认输入文件。
    default_input_file = "./OPTION/VIDEO_TS.VOB"
    if conversion_mode == "mp4_to_wav":
        default_input_file = "./OPTION/VIDEO_TS_gui.mp4"
    input_file = context.get("input_file", default_input_file)
    # 读取输出文件路径，若未传入则使用当前模式默认输出文件。
    output_file = context.get("output_file", mode_config["default_output_file"])
    # 读取日志文件路径，若未传入则使用当前模式默认日志文件。
    log_file = context.get("log_file", mode_config["default_log_file"])

    # 定义写入日志的内部函数。
    def append_log_line(message: str) -> None:
        # 生成日志文件对象。
        log_path = Path(log_file)
        # 确保日志目录存在。
        log_path.parent.mkdir(parents=True, exist_ok=True)
        # 生成日志时间前缀。
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # 以追加模式写入日志内容。
        with log_path.open("a", encoding="utf-8") as log_handle:
            # 写入一行日志。
            log_handle.write(f"[{timestamp}] {message}\n")

    # 记录能力启动日志。
    append_log_line(f"开始执行能力：{ABILITY_ID}")
    append_log_line(f"转换模式：{conversion_mode}")
    # 记录输入文件路径。
    append_log_line(f"输入文件：{input_file}")
    # 记录输出文件路径。
    append_log_line(f"输出文件：{output_file}")
    # 记录日志文件路径。
    append_log_line(f"日志文件：{log_file}")

    # 如果启用图形界面，则优先启动 app。
    if use_gui:
        # 读取图形界面应用配置。
        gui_app_id = REQUIRED_APPS[0]
        # 读取图形界面应用配置。
        gui_app = apps[gui_app_id]
        # 读取通用 GUI 启动技能。
        launch_skill = skills["launch_gui_app_with_plan"]
        # 读取输出目录路径。
        output_dir = str(Path(output_file).expanduser().resolve().parent)
        # 读取日志目录路径。
        log_dir = str(Path(log_file).expanduser().resolve().parent)
        # 组织自动化计划。
        automation_plan = {
            "steps": [
                {
                    "action": "set_always_on_top",
                    "value": always_on_top,
                    "delay_ms": 250,
                },
                {
                    "action": "set_output_dir",
                    "value": output_dir,
                    "delay_ms": 300,
                },
                {
                    "action": "set_log_dir",
                    "value": log_dir,
                    "delay_ms": 300,
                },
                {
                    "action": "import_paths",
                    "value": [input_file],
                    "delay_ms": 350,
                },
                {
                    "action": "click_start_conversion",
                    "delay_ms": 450,
                },
            ]
        }
        # 组织传给 GUI 的上下文。
        gui_context = {
            "input_file": input_file,
            "output_file": output_file,
            "log_file": log_file,
            "conversion_mode": conversion_mode,
            "always_on_top": always_on_top,
            "automation_mode": "human_like",
            "automation_plan": automation_plan,
        }
        # 通过通用技能启动 GUI。
        launch_result = launch_skill.run(
            app_id=gui_app_id,
            app_config=gui_app,
            app_context=gui_context,
        )
        # 返回启动结果。
        return {
            "status": launch_result.get("status", "unknown"),
            "ability": ABILITY_ID,
            "mode": "gui_human_like",
            "app": gui_app_id,
            "input_file": input_file,
            "output_file": output_file,
            "log_file": log_file,
            "always_on_top": always_on_top,
            "launch_result": launch_result,
        }

    # 如果未启用图形界面，则直接运行 skill。
    skill_module = skills[mode_config["skill_id"]]
    # 调用 skill 的 run 函数。
    skill_result = skill_module.run(
        input_file=input_file,
        output_file=output_file,
        message_handler=append_log_line,
    )
    # 记录能力执行完成日志。
    append_log_line("能力执行完成。")
    # 返回直接执行结果。
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "mode": "direct_skill",
        "log_file": log_file,
        "result": skill_result,
    }
