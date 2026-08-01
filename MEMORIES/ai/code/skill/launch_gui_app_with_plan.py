"""启动带自动化计划的 GUI 应用技能。

功能：
根据已登记 app 配置选择可用 Python 解释器，并将标准化上下文传给目标 GUI 应用。

作用：
为上层能力提供统一的 GUI 启动入口，让不同软件都可以复用同一套“打开界面并按计划操作”的机制。

适用场景：
- 启动已登记的 PySide6 或其他 Python GUI 应用
- 将自动化计划传给目标应用并让应用自行执行可视化步骤
- 为能力层提供统一的 GUI 启动结果
"""

# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "launch_gui_app_with_plan"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "启动 GUI 应用并下发计划"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "启动已登记 GUI 应用，并传入自动化计划上下文。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["app_id", "app_config", "app_context"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = ["status", "app", "python_bin", "pid", "context"]


# 导入 json，用于序列化应用上下文。
import json
# 导入 os，用于将 GUI 子进程重定向到空设备。
import os
# 导入 subprocess，用于启动外部 GUI 进程。
import subprocess
# 导入 Path，用于规范处理应用文件路径。
from pathlib import Path


# 定义技能入口，接收应用配置与上下文并返回启动结果。
def run(app_id: str, app_config: dict, app_context: dict | None = None) -> dict:
    # 如果外部没有传入上下文，则默认使用空字典。
    if app_context is None:
        app_context = {}
    # 读取候选 Python 解释器列表。
    python_candidates = app_config.get("python_candidates", ["python3"])
    # 读取运行时检查模块。
    runtime_check_module = app_config.get("runtime_check_module")
    # 读取应用文件路径。
    app_path = Path(app_config["path"]).resolve()
    # 初始化可用解释器。
    available_python = None

    # 逐个测试候选解释器。
    for python_bin in python_candidates:
        # 如果未配置运行时检查模块，则直接接受当前解释器。
        if not runtime_check_module:
            available_python = python_bin
            break
        # 测试目标解释器是否能导入运行时模块。
        process_result = subprocess.run(
            [python_bin, "-c", f"import {runtime_check_module}"],
            capture_output=True,
            text=True,
            check=False,
        )
        # 如果返回成功，则记录当前解释器并停止继续测试。
        if process_result.returncode == 0:
            available_python = python_bin
            break

    # 如果没有找到可用解释器，则返回结构化错误。
    if available_python is None:
        # 组织错误结果。
        result = {
            # 返回错误状态。
            "status": "unavailable_app_runtime",
            # 返回应用标识。
            "app": app_id,
            # 返回错误信息。
            "message": "当前环境无法启动目标 GUI 应用。",
            # 返回运行时检查模块信息。
            "runtime_check_module": runtime_check_module,
        }
        # 返回错误结果。
        return result

    # 将上下文字典序列化为 JSON 文本。
    context_json = json.dumps(app_context, ensure_ascii=False)
    # 启动 GUI 子进程，并与当前终端会话脱离，避免父进程结束后窗口被回收。
    with open(os.devnull, "r", encoding="utf-8") as devnull_read:
        with open(os.devnull, "a", encoding="utf-8") as devnull_write:
            process = subprocess.Popen(
                [available_python, str(app_path), context_json],
                stdin=devnull_read,
                stdout=devnull_write,
                stderr=devnull_write,
                start_new_session=True,
                close_fds=True,
            )
    # 组织启动成功结果。
    result = {
        # 返回启动状态。
        "status": "launched_app",
        # 返回应用标识。
        "app": app_id,
        # 返回实际使用的解释器。
        "python_bin": available_python,
        # 返回子进程 PID。
        "pid": process.pid,
        # 返回传入上下文，便于上层追踪。
        "context": app_context,
    }
    # 返回启动结果。
    return result
