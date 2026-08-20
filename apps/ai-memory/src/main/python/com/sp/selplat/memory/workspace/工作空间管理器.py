"""建立 task_id 唯一工作目录，并拒绝路径逃逸。"""

from dataclasses import dataclass
from pathlib import Path
import re


TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
TASK_DIRECTORIES = (
    "当前任务/用户原始需求", "当前任务/需求文档", "当前任务/需求要件", "当前任务/架构要件",
    "当前任务/详细设计", "当前任务/实现记录", "当前任务/测试文档", "当前任务/发布材料",
    "智能体/角色快照", "智能体/Agent会话", "智能体/上下文", "智能体/连接状态", "智能体/心跳",
    "工作空间", "阶段线程", "产物", "门禁", "证据", "治理候选", "审计日志", "运行日志", "恢复点", "清单",
)


@dataclass(frozen=True)
class TaskWorkspace:
    task_id: str
    task_root: Path
    workspace: Path

    def resolve(self, relative_path: str) -> Path:
        """把逻辑相对路径约束到当前任务根。"""
        target = (self.task_root / relative_path).resolve()
        if target != self.task_root and self.task_root not in target.parents:
            raise ValueError(f"任务路径逃逸: {relative_path}")
        return target


class WorkspaceManager:
    def __init__(self, runtime_root: Path) -> None:
        self.runtime_root = runtime_root.resolve()

    def prepare_runtime(self) -> None:
        """创建跨任务状态目录；其中只保存索引、缓存与待上报队列。"""
        for relative in ("状态/待上报队列", "状态/快照", "状态/恢复点", "治理/已批准快照",
                         "治理/服务端登记缓存", "审计/跨任务索引", "审计/待上报队列",
                         "服务端开发数据/数据库", "服务端开发数据/日志", "服务端开发数据/备份", "任务"):
            (self.runtime_root / relative).mkdir(parents=True, exist_ok=True)

    def create(self, task_id: str) -> TaskWorkspace:
        """按 task_id 创建唯一任务根和全部标准子目录。"""
        if not TASK_ID_PATTERN.fullmatch(task_id):
            raise ValueError(f"非法 task_id: {task_id}")
        task_root = (self.runtime_root / "任务" / task_id).resolve()
        expected_parent = (self.runtime_root / "任务").resolve()
        if task_root.parent != expected_parent:
            raise ValueError("task_id 导致路径逃逸")
        for relative in TASK_DIRECTORIES:
            (task_root / relative).mkdir(parents=True, exist_ok=True)
        return TaskWorkspace(task_id, task_root, task_root / "工作空间")
