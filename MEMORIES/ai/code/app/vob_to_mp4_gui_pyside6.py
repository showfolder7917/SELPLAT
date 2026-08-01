from __future__ import annotations

"""多格式媒体转换 PySide6 图形界面工具。

功能：
提供支持拖拽文件与文件夹的批量媒体转换图形界面，并显示预计总时长、剩余时长与实时日志。

作用：
作为 Python 技能库中的图形应用入口，让能力层可以通过统一界面完成批量转换与进度观察。

适用场景：
- 手动拖入多个媒体文件执行批量转换
- 拖入文件夹后递归扫描匹配文件并保持目录层级输出
- 在转换前先看到预计总时长
- 在转换时实时查看当前文件状态、总体进度与日志
"""

# 导入 dataclass，用于定义界面中的任务项结构。
from dataclasses import dataclass
# 导入 json，用于解析外部传入的上下文。
import json
# 导入 copy，用于复制模式配置。
from copy import deepcopy
# 导入线程池工具，用于并行执行多个转换任务。
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
# 导入 subprocess，用于打开目录。
import subprocess
# 导入 sys，用于接收脚本参数。
import sys
# 导入 threading，用于暂停与并发状态控制。
import threading
# 导入 datetime，用于写入实时日志时间。
from datetime import datetime
# 导入 traceback，用于记录异常详情。
import traceback
# 导入 importlib 工具，用于动态加载 skill。
import importlib.util

# 导入 Path，用于规范处理路径。
from pathlib import Path

# 导入 Qt 核心对象与信号。
from PySide6.QtCore import QObject, QThread, Qt, QTimer, Signal
# 导入 Qt 绘图工具。
from PySide6.QtGui import QColor, QPainter, QPen
# 导入 Qt 小部件。
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QProgressDialog,
    QPushButton,
    QProgressBar,
    QPlainTextEdit,
    QScrollArea,
    QSizePolicy,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)


# 定义 code 根目录，统一从当前代码树反推工作区根。
CODE_ROOT = Path(__file__).resolve().parents[1]
# 定义工作区根目录，确保执行使用项目内 MEMORIES 这套代码树。
WORKSPACE_ROOT = CODE_ROOT.parents[2]
# 定义默认输出目录。
DEFAULT_OUTPUT_DIR = WORKSPACE_ROOT / "OPTION"
# 定义默认日志目录。
DEFAULT_LOG_DIR = WORKSPACE_ROOT / "OPTION" / "log"
# 定义默认输入文件路径。
DEFAULT_INPUT_FILE = WORKSPACE_ROOT / "OPTION" / "VIDEO_TS.VOB"
# 定义默认输出文件路径。
DEFAULT_OUTPUT_FILE = WORKSPACE_ROOT / "OPTION" / "VIDEO_TS_gui.mp4"
# 定义默认日志文件路径。
DEFAULT_LOG_FILE = WORKSPACE_ROOT / "OPTION" / "log" / "VIDEO_TS_gui.log"
# 定义默认时长探测 skill 文件路径。
DURATION_SKILL_FILE = (
    WORKSPACE_ROOT
    / "MEMORIES"
    / "ai"
    / "code"
    / "skill"
    / "ffmpeg_vob_to_mp4.py"
)

# 定义转换模式配置。
CONVERSION_MODES = {
    "vob_to_mp4": {
        "title": "VOB -> MP4",
        "input_suffixes": [".vob"],
        "output_suffix": ".mp4",
        "skill_file": WORKSPACE_ROOT / "MEMORIES" / "ai" / "code" / "skill" / "ffmpeg_vob_to_mp4.py",
        "log_file_name": "VOB批量转换.log",
    },
    "vob_to_mp3": {
        "title": "VOB -> MP3",
        "input_suffixes": [".vob"],
        "output_suffix": ".mp3",
        "skill_file": WORKSPACE_ROOT / "MEMORIES" / "ai" / "code" / "skill" / "ffmpeg_vob_to_mp3.py",
        "log_file_name": "VOB转MP3批量转换.log",
    },
    "mp4_to_wav": {
        "title": "MP4 -> WAV",
        "input_suffixes": [".mp4"],
        "output_suffix": ".wav",
        "skill_file": WORKSPACE_ROOT / "MEMORIES" / "ai" / "code" / "skill" / "ffmpeg_mp4_to_wav.py",
        "log_file_name": "MP4转WAV批量转换.log",
    },
}


# 定义任务项数据结构。
@dataclass
class ConversionItem:
    """批量转换中的单个任务项。"""

    # 记录源文件路径。
    source_path: Path
    # 记录输出文件路径。
    output_path: Path
    # 记录输出相对路径。
    relative_output_path: Path
    # 记录播放时长秒数。
    duration_seconds: float
    # 记录预计转换耗时秒数。
    estimated_conversion_seconds: float
    # 记录文件大小字节数。
    file_size_bytes: int
    # 记录来源根路径。
    source_root: Path
    # 记录当前转换模式。
    mode_id: str
    # 记录当前状态文本。
    status_text: str = "待转换"


# 定义读取模式配置的函数。
def get_mode_config(mode_id: str) -> dict:
    # 如果模式不存在，则回退到默认模式。
    if mode_id not in CONVERSION_MODES:
        mode_id = "vob_to_mp4"
    # 返回模式配置副本，避免在运行时被误改。
    return deepcopy(CONVERSION_MODES[mode_id])


# 定义加载 skill 模块的函数。
def load_skill_module(skill_file: Path, module_name: str):
    # 根据 skill 文件路径创建模块规格。
    spec = importlib.util.spec_from_file_location(module_name, skill_file)
    # 检查规格和加载器是否存在。
    if spec is None or spec.loader is None:
        # 如果加载失败，则抛出异常。
        raise RuntimeError(f"无法加载 skill：{skill_file}")
    # 基于规格创建模块对象。
    module = importlib.util.module_from_spec(spec)
    # 执行模块加载。
    spec.loader.exec_module(module)
    # 返回已加载模块。
    return module


# 定义加载时长探测模块的函数。
def load_duration_skill_module():
    # 返回固定的媒体时长探测模块。
    return load_skill_module(DURATION_SKILL_FILE, "ffmpeg_vob_to_mp4_duration")


# 定义秒数字符串格式化函数。
def format_seconds(seconds: float) -> str:
    # 如果秒数无效，则返回占位文本。
    if seconds <= 0:
        return "--"
    # 将秒数转为整数。
    total_seconds = int(seconds)
    # 计算小时数。
    hours = total_seconds // 3600
    # 计算分钟数。
    minutes = (total_seconds % 3600) // 60
    # 计算剩余秒数。
    remain_seconds = total_seconds % 60
    # 如果存在小时，则返回时分秒格式。
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{remain_seconds:02d}"
    # 返回分秒格式。
    return f"{minutes:02d}:{remain_seconds:02d}"


# 定义查找目录中全部目标类型文件的函数。
def discover_media_files(target_path: Path, allowed_suffixes: list[str]) -> list[Path]:
    # 如果目标路径不存在，则返回空列表。
    if not target_path.exists():
        return []
    # 统一后缀格式，便于大小写无关匹配。
    normalized_suffixes = {suffix.lower() for suffix in allowed_suffixes}
    # 如果目标路径是文件，则只在扩展名命中时返回。
    if target_path.is_file():
        return [target_path] if target_path.suffix.lower() in normalized_suffixes else []
    # 初始化结果列表。
    result_files: list[Path] = []
    # 递归遍历目录中的全部文件。
    for file_path in sorted(target_path.rglob("*")):
        # 仅收集允许的媒体文件。
        if file_path.is_file() and file_path.suffix.lower() in normalized_suffixes:
            result_files.append(file_path)
    # 返回收集结果。
    return result_files


# 定义估算转换耗时的函数。
def estimate_conversion_seconds(playback_duration_seconds: float) -> float:
    # 如果播放时长无效，则返回 0。
    if playback_duration_seconds <= 0:
        return 0.0
    # 使用经验系数估算当前机器的转换耗时。
    estimated_seconds = playback_duration_seconds * 1.35 + 8.0
    # 返回估算结果。
    return estimated_seconds


# 定义文件大小格式化函数。
def format_file_size(file_size_bytes: int) -> str:
    # 如果字节数无效，则返回占位文本。
    if file_size_bytes <= 0:
        return "--"
    # 初始化大小单位。
    units = ["B", "KB", "MB", "GB", "TB"]
    # 转为浮点数便于除法。
    size_value = float(file_size_bytes)
    # 初始化单位索引。
    unit_index = 0
    # 逐级换算到合适单位。
    while size_value >= 1024 and unit_index < len(units) - 1:
        size_value /= 1024
        unit_index += 1
    # 返回格式化结果。
    return f"{size_value:.2f} {units[unit_index]}"


# 定义拖入路径转任务项的函数。
def build_items_from_paths(
    raw_paths: list[Path],
    output_dir: Path,
    mode_id: str,
    explicit_output_file: Path | None = None,
) -> list[ConversionItem]:
    # 读取当前模式配置。
    mode_config = get_mode_config(mode_id)
    # 加载时长探测模块，复用其中的媒体时长检测函数。
    skill_module = load_duration_skill_module()
    # 初始化任务列表。
    items: list[ConversionItem] = []
    # 初始化去重集合。
    seen_sources: set[Path] = set()

    # 逐个处理拖入路径。
    for raw_path in raw_paths:
        # 解析绝对路径。
        source_target = raw_path.resolve()
        # 如果路径不存在，则跳过。
        if not source_target.exists():
            continue
        # 发现当前拖入路径下的全部目标文件。
        discovered_files = discover_media_files(source_target, mode_config["input_suffixes"])
        # 如果当前路径没有识别到可转换文件，则跳过。
        if not discovered_files:
            continue

        # 如果当前拖入的是目录，则目录本身作为结构保持根。
        if source_target.is_dir():
            source_root = source_target.parent
        # 如果当前拖入的是文件，则文件父目录作为来源根。
        else:
            source_root = source_target.parent

            # 逐个处理识别出的媒体文件。
        for source_file in discovered_files:
            # 如果该文件已加入任务，则跳过重复项。
            if source_file in seen_sources:
                continue
            # 将当前源文件加入去重集合。
            seen_sources.add(source_file)

            # 如果只传入一个文件且显式指定了输出文件，则优先使用显式输出文件。
            if explicit_output_file is not None and len(raw_paths) == 1 and source_target.is_file():
                output_path = explicit_output_file
                # 如果显式输出文件位于输出目录下，则保留相对路径。
                if explicit_output_file.is_relative_to(output_dir):
                    relative_output_path = explicit_output_file.relative_to(output_dir)
                # 否则退回为文件名级别显示。
                else:
                    relative_output_path = Path(explicit_output_file.name)
            else:
                # 基于来源根生成相对结构路径。
                relative_source = source_file.relative_to(source_root)
                # 生成输出相对路径，并替换扩展名为当前模式输出后缀。
                relative_output_path = relative_source.with_suffix(mode_config["output_suffix"])
                # 仅对 VOB 输入保留原有 VIDEO_TS 目录折叠逻辑。
                parent_parts = list(relative_output_path.parts[:-1])
                if ".vob" in [suffix.lower() for suffix in mode_config["input_suffixes"]]:
                    parent_parts = [part for part in parent_parts if part.upper() != "VIDEO_TS"]
                # 重建清理后的相对输出路径。
                if parent_parts:
                    relative_output_path = Path(*parent_parts) / relative_output_path.name
                else:
                    relative_output_path = Path(relative_output_path.name)
                # 拼出最终输出路径。
                output_path = output_dir / relative_output_path

            # 读取当前文件播放时长。
            duration_seconds = skill_module.get_duration_seconds(source_file)
            # 估算当前文件转换耗时。
            estimated_conversion_seconds = estimate_conversion_seconds(duration_seconds)
            # 构建任务项并加入列表。
            items.append(
                ConversionItem(
                    source_path=source_file,
                    output_path=output_path,
                    relative_output_path=relative_output_path,
                    duration_seconds=duration_seconds,
                    estimated_conversion_seconds=estimated_conversion_seconds,
                    file_size_bytes=source_file.stat().st_size,
                    source_root=source_root,
                    mode_id=mode_id,
                )
            )

    # 返回最终任务列表。
    return items


# 定义后台加载任务列表的工作对象。
class LoadItemsWorker(QObject):
    """后台扫描目录并构建媒体转换任务项。"""

    # 定义进度说明信号。
    progress_signal = Signal(str)
    # 定义完成信号。
    done_signal = Signal(list, list)
    # 定义错误信号。
    error_signal = Signal(str)

    # 定义初始化函数。
    def __init__(
        self,
        raw_paths: list[Path],
        output_dir: Path,
        mode_id: str,
        explicit_output_file: Path | None = None,
    ) -> None:
        # 调用父类初始化。
        super().__init__()
        # 保存来源路径。
        self.raw_paths = raw_paths
        # 保存输出目录。
        self.output_dir = output_dir
        # 保存当前转换模式。
        self.mode_id = mode_id
        # 保存显式输出文件。
        self.explicit_output_file = explicit_output_file

    # 定义后台执行函数。
    def run(self) -> None:
        try:
            # 推送开始扫描提示。
            self.progress_signal.emit("正在扫描目录并识别可转换文件...")
            # 构建任务列表。
            items = build_items_from_paths(
                raw_paths=self.raw_paths,
                output_dir=self.output_dir,
                mode_id=self.mode_id,
                explicit_output_file=self.explicit_output_file,
            )
            # 推送完成提示。
            self.progress_signal.emit(f"已完成加载，共识别到 {len(items)} 个可转换文件。")
            # 发送结果。
            self.done_signal.emit(self.raw_paths, items)
        except Exception:
            # 发送异常信息。
            self.error_signal.emit(traceback.format_exc())


# 定义拖拽投放区域。
class DropArea(QFrame):
    """支持拖拽文件和文件夹的投放区域。"""

    # 定义投放信号。
    paths_dropped = Signal(list)

    # 定义初始化函数。
    def __init__(self) -> None:
        # 调用父类初始化。
        super().__init__()
        # 允许拖放。
        self.setAcceptDrops(True)
        # 设置对象名称，便于样式区分。
        self.setObjectName("dropArea")
        # 创建垂直布局。
        layout = QVBoxLayout(self)
        # 设置布局边距。
        layout.setContentsMargins(20, 24, 20, 24)
        # 设置布局间距。
        layout.setSpacing(8)

        # 创建图标文本。
        icon_label = QLabel("📂")
        # 设置图标居中。
        icon_label.setAlignment(Qt.AlignCenter)
        # 设置图标样式。
        icon_label.setStyleSheet("font-size: 36px;")
        # 放入图标。
        layout.addWidget(icon_label)

        # 创建标题文本。
        title_label = QLabel("拖拽待转换文件或文件夹到这里")
        # 设置标题居中。
        title_label.setAlignment(Qt.AlignCenter)
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 20px; font-weight: 700; color: #1f2a1f;")
        # 放入标题。
        layout.addWidget(title_label)

        # 创建说明文本。
        desc_label = QLabel(
            "支持单文件、多文件、整目录批量导入。"
            "拖入文件夹时会按当前模式递归扫描匹配文件，并保持目录层级输出到目标目录。"
        )
        # 设置说明居中。
        desc_label.setAlignment(Qt.AlignCenter)
        # 开启自动换行。
        desc_label.setWordWrap(True)
        # 设置说明样式。
        desc_label.setStyleSheet("font-size: 14px; color: #667166; line-height: 1.6;")
        # 放入说明。
        layout.addWidget(desc_label)

    # 定义拖入进入事件。
    def dragEnterEvent(self, event) -> None:
        # 如果拖入数据包含 URL，则接受。
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            return
        # 否则忽略事件。
        event.ignore()

    # 定义拖拽放下事件。
    def dropEvent(self, event) -> None:
        # 初始化路径列表。
        dropped_paths: list[str] = []
        # 逐个读取拖入 URL。
        for url in event.mimeData().urls():
            # 仅处理本地文件路径。
            if url.isLocalFile():
                dropped_paths.append(url.toLocalFile())
        # 如果存在拖入路径，则发送信号。
        if dropped_paths:
            self.paths_dropped.emit(dropped_paths)
            event.acceptProposedAction()
            return
        # 如果无有效路径，则忽略事件。
        event.ignore()


# 定义切换开关控件。
class ToggleSwitch(QCheckBox):
    """绘制为滑块样式的开关控件。"""

    # 定义初始化函数。
    def __init__(self, parent=None) -> None:
        # 调用父类初始化。
        super().__init__(parent)
        # 固定控件尺寸。
        self.setFixedSize(56, 32)
        # 设置鼠标手型。
        self.setCursor(Qt.PointingHandCursor)
        # 清空文本，仅保留图形。
        self.setText("")
        # 状态变化时主动重绘，确保开关颜色立即刷新。
        self.toggled.connect(self.repaint)

    # 定义建议尺寸函数。
    def sizeHint(self):
        # 返回固定尺寸。
        return self.size()

    # 定义命中区域函数。
    def hitButton(self, pos) -> bool:
        # 允许点击整个控件区域来切换开关。
        return self.rect().contains(pos)

    # 定义重绘函数。
    def paintEvent(self, event) -> None:
        # 创建画笔对象。
        painter = QPainter(self)
        # 开启抗锯齿。
        painter.setRenderHint(QPainter.Antialiasing, True)

        # 计算轨道区域。
        track_rect = self.rect().adjusted(1, 1, -1, -1)
        # 如果已选中，则使用绿色轨道。
        if self.isChecked():
            track_color = QColor("#59b276")
            border_color = QColor("#4ea36a")
            knob_x = track_rect.right() - 26
        else:
            # 未选中时使用浅灰轨道。
            track_color = QColor("#cfd7cf")
            border_color = QColor("#b8c3b8")
            knob_x = track_rect.left() + 2

        # 设置边框画笔。
        painter.setPen(QPen(border_color, 1))
        # 设置背景颜色。
        painter.setBrush(track_color)
        # 绘制圆角轨道。
        painter.drawRoundedRect(track_rect, 15, 15)

        # 计算圆点区域。
        knob_rect = track_rect.adjusted(0, 2, 0, -2)
        knob_rect.setLeft(knob_x)
        knob_rect.setWidth(24)
        # 设置圆点边框。
        painter.setPen(QPen(QColor("#ffffff"), 1))
        # 设置圆点颜色。
        painter.setBrush(QColor("#ffffff"))
        # 绘制圆点。
        painter.drawEllipse(knob_rect)


# 定义批量转换后台工作对象。
class BatchConvertWorker(QObject):
    """后台批量转换工作对象。"""

    # 定义日志信号。
    log_signal = Signal(str)
    # 定义当前文件状态信号。
    current_status_signal = Signal(str)
    # 定义当前文件进度信号。
    current_progress_signal = Signal(int, float, float)
    # 定义总体进度信号。
    overall_progress_signal = Signal(int, float)
    # 定义单行状态更新信号。
    row_status_signal = Signal(int, str)
    # 定义完成信号。
    done_signal = Signal(dict)
    # 定义错误信号。
    error_signal = Signal(str)

    # 定义初始化函数。
    def __init__(
        self,
        items: list[ConversionItem],
        log_file: str,
        mode_id: str,
        max_workers: int = 3,
    ) -> None:
        # 调用父类初始化。
        super().__init__()
        # 保存任务列表。
        self.items = items
        # 保存日志文件路径。
        self.log_file = log_file
        # 保存当前转换模式。
        self.mode_id = mode_id
        # 保存最大并发线程数。
        self.max_workers = max_workers
        # 创建停止事件。
        self.stop_requested = threading.Event()

    # 定义外部停止入口。
    def request_stop(self) -> None:
        # 标记当前 worker 需要停止。
        self.stop_requested.set()

    # 定义后台执行函数。
    def run(self) -> None:
        try:
            # 读取当前模式配置。
            mode_config = get_mode_config(self.mode_id)
            # 加载当前模式对应的 skill 模块。
            module = load_skill_module(mode_config["skill_file"], f"conversion_{self.mode_id}")
            # 收集本轮需要处理的索引和任务项。
            pending_items = [
                (index, item)
                for index, item in enumerate(self.items)
                if item.status_text != "完成"
            ]
            # 如果没有可处理任务，则直接返回完成结果。
            if not pending_items:
                self.done_signal.emit(
                    {
                        "items": 0,
                        "results": [],
                        "log_file": self.log_file,
                        "total_duration_seconds": 0.0,
                        "run_state": "completed",
                    }
                )
                return
            # 初始化已完成预计转换耗时。
            completed_duration = 0.0
            # 计算本轮总预计转换耗时。
            total_duration = sum(item.estimated_conversion_seconds for _, item in pending_items)
            # 初始化结果集合。
            completed_results: list[dict] = []
            # 初始化进度字典。
            progress_seconds_map = {index: 0.0 for index, _ in pending_items}
            # 初始化互斥锁。
            progress_lock = threading.Lock()
            # 初始化错误文本。
            first_error_text: str | None = None

            # 定义总体进度推送函数。
            def emit_overall_progress() -> None:
                # 加锁读取共享进度。
                with progress_lock:
                    # 计算总体已处理时长。
                    processed_seconds = completed_duration + sum(progress_seconds_map.values())
                # 计算总体百分比。
                if total_duration > 0:
                    overall_percent = min(int(processed_seconds / total_duration * 100), 100)
                else:
                    overall_percent = 100
                # 计算剩余时长。
                remaining_seconds = max(total_duration - processed_seconds, 0.0)
                # 推送总体进度。
                self.overall_progress_signal.emit(overall_percent, remaining_seconds)

            # 定义单任务执行函数。
            def process_item(index: int, item: ConversionItem) -> tuple[int, ConversionItem, dict]:
                # 如果已收到停止请求，则直接返回暂停结果。
                if self.stop_requested.is_set():
                    return index, item, {"success": False, "returncode": 130, "video_check": {"issues": ["任务已暂停"]}}
                # 更新当前行状态为转换中。
                self.row_status_signal.emit(index, "转换中")
                # 更新当前文件状态说明。
                self.current_status_signal.emit(f"正在转换：{item.source_path.name}")
                # 写入日志。
                self.log_signal.emit(f"开始转换：{item.source_path}")
                # 确保输出目录存在。
                item.output_path.parent.mkdir(parents=True, exist_ok=True)

                # 定义当前文件消息处理函数。
                def on_message(message: str, file_name: str = item.source_path.name) -> None:
                    # 将当前文件消息写入日志。
                    self.log_signal.emit(f"[{file_name}] {message}")

                # 定义当前文件进度处理函数。
                def on_progress(
                    percent: int,
                    current_seconds: float,
                    duration_seconds: float,
                ) -> None:
                    # 根据播放进度折算预计转换耗时进度。
                    estimated_progress_seconds = 0.0
                    if duration_seconds > 0:
                        estimated_progress_seconds = min(
                            current_seconds / duration_seconds,
                            1.0,
                        ) * item.estimated_conversion_seconds
                    # 写入当前任务进度。
                    with progress_lock:
                        progress_seconds_map[index] = estimated_progress_seconds
                    # 推送当前文件进度。
                    self.current_progress_signal.emit(
                        percent,
                        current_seconds,
                        duration_seconds,
                    )
                    # 推送总体进度。
                    emit_overall_progress()

                # 执行当前单文件转码。
                result = module.run(
                    input_file=str(item.source_path),
                    output_file=str(item.output_path),
                    message_handler=on_message,
                    progress_handler=on_progress,
                    stop_handler=self.stop_requested.is_set,
                )
                # 返回执行结果。
                return index, item, result

            # 使用线程池并行执行未完成任务。
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # 初始化 future 映射。
                future_to_index = {
                    executor.submit(process_item, index, item): index
                    for index, item in pending_items
                }
                # 持续等待任务完成。
                while future_to_index:
                    # 等待至少一个任务返回。
                    done_futures, _ = wait(
                        future_to_index.keys(),
                        timeout=0.2,
                        return_when=FIRST_COMPLETED,
                    )

                    # 如果收到停止请求，则优先取消未开始任务。
                    if self.stop_requested.is_set():
                        for future, future_index in list(future_to_index.items()):
                            if future.cancel():
                                # 标记取消任务为已暂停。
                                self.row_status_signal.emit(future_index, "已暂停")
                                self.items[future_index].status_text = "已暂停"
                                # 移除已取消 future。
                                future_to_index.pop(future, None)

                    # 处理已完成 future。
                    for future in done_futures:
                        # 读取对应索引。
                        index = future_to_index.pop(future, None)
                        # 如果 future 已被提前移除，则跳过。
                        if index is None:
                            continue
                        # 如果 future 已取消，则跳过。
                        if future.cancelled():
                            continue
                        # 读取执行结果。
                        item_index, item, result = future.result()
                        # 将当前任务进度清零，避免重复累计。
                        with progress_lock:
                            progress_seconds_map[item_index] = 0.0
                        # 读取当前转码是否成功。
                        result_success = result.get("success", False)
                        # 读取当前检查问题列表。
                        video_issues = result.get("video_check", {}).get("issues", [])
                        # 读取当前退出码。
                        returncode = result.get("returncode")

                        # 如果是暂停退出，则标记已暂停并继续处理其他任务。
                        if returncode == 130 or self.stop_requested.is_set():
                            # 将当前结果加入结果集合。
                            completed_results.append(result)
                            # 推送当前行状态为已暂停。
                            self.row_status_signal.emit(item_index, "已暂停")
                            # 更新当前文件状态说明。
                            self.current_status_signal.emit(f"已暂停：{item.source_path.name}")
                            # 推送总体进度。
                            emit_overall_progress()
                            # 继续处理剩余 future。
                            continue

                        # 如果当前文件未成功，则标记失败并触发整体停止。
                        if not result_success:
                            # 将当前结果加入结果集合。
                            completed_results.append(result)
                            # 推送当前行状态为失败。
                            self.row_status_signal.emit(item_index, "失败")
                            # 更新当前文件状态说明。
                            self.current_status_signal.emit(f"转换失败：{item.source_path.name}")
                            # 组织失败信息。
                            first_error_text = (
                                f"文件转换失败：{item.source_path.name}\n"
                                f"ffmpeg 退出码：{returncode}\n"
                                f"检查问题：{video_issues or ['未知问题']}"
                            )
                            # 标记整体停止。
                            self.stop_requested.set()
                            # 推送总体进度。
                            emit_overall_progress()
                            continue

                        # 将当前结果加入结果集合。
                        completed_results.append(result)
                        # 累加已完成源时长。
                        with progress_lock:
                            completed_duration += item.estimated_conversion_seconds
                        # 推送当前文件完成状态。
                        self.row_status_signal.emit(item_index, "完成")
                        # 更新当前文件状态。
                        self.current_status_signal.emit(f"已完成：{item.source_path.name}")
                        # 推送总体进度。
                        emit_overall_progress()

                    # 如果已经出现失败，则继续取消未开始任务并等待运行中的任务收尾。
                    if first_error_text is not None:
                        for future, future_index in list(future_to_index.items()):
                            if future.cancel():
                                self.row_status_signal.emit(future_index, "已暂停")
                                self.items[future_index].status_text = "已暂停"
                                future_to_index.pop(future, None)

            # 如果本轮是暂停结束，则发送暂停结果。
            if self.stop_requested.is_set() and first_error_text is None:
                self.done_signal.emit(
                    {
                        "items": len(pending_items),
                        "results": completed_results,
                        "log_file": self.log_file,
                        "total_duration_seconds": total_duration,
                        "run_state": "paused",
                    }
                )
                return

            # 如果本轮存在错误，则发送错误。
            if first_error_text is not None:
                self.error_signal.emit(first_error_text)
                return

            # 全部完成后发送完成信号。
            self.done_signal.emit(
                {
                    "items": len(pending_items),
                    "results": completed_results,
                    "log_file": self.log_file,
                    "total_duration_seconds": total_duration,
                    "run_state": "completed",
                }
            )
        except Exception:
            # 捕获异常并发送错误。
            self.error_signal.emit(traceback.format_exc())


# 定义主窗口类。
class VideoConvertWindow(QMainWindow):
    """多格式媒体批量转换主窗口。"""

    # 定义初始化函数。
    def __init__(
        self,
        input_file: str | None = None,
        output_file: str | None = None,
        log_file: str | None = None,
        conversion_mode: str = "vob_to_mp4",
        always_on_top: bool = False,
        automation_plan: dict | None = None,
    ) -> None:
        # 调用父类初始化。
        super().__init__()
        # 初始化当前转换模式。
        self.mode_id = conversion_mode if conversion_mode in CONVERSION_MODES else "vob_to_mp4"
        # 设置窗口标题。
        self.setWindowTitle("多格式媒体转换器")
        # 设置窗口大小。
        self.resize(1800, 1200)
        # 初始化线程对象。
        self.worker_thread: QThread | None = None
        # 初始化工作对象。
        self.worker: BatchConvertWorker | None = None
        # 初始化加载线程对象。
        self.load_thread: QThread | None = None
        # 初始化加载工作对象。
        self.load_worker: LoadItemsWorker | None = None
        # 初始化最近一次结果。
        self.last_result: dict | None = None
        # 记录当前是否正在请求暂停。
        self.pause_requested = False
        # 记录当前是否处于已暂停可继续状态。
        self.is_paused_state = False
        # 记录暂停中提示框对象。
        self.pause_progress_dialog: QProgressDialog | None = None
        self.loading_progress_dialog: QProgressDialog | None = None
        # 记录加载中提示框对象。
        # 保存置顶状态。
        self.always_on_top = always_on_top
        # 保存防休眠进程对象。
        self.caffeinate_process: subprocess.Popen | None = None
        # 保存显式输入文件。
        self.explicit_input_file = Path(input_file).resolve() if input_file else None
        # 保存显式输出文件。
        self.explicit_output_file = Path(output_file).resolve() if output_file else None
        # 保存显式日志文件。
        self.explicit_log_file = Path(log_file).resolve() if log_file else None
        # 保存自动化计划。
        self.automation_plan = automation_plan or {}
        # 记录自动化计划是否已启动，避免重复执行。
        self.automation_started = False
        # 记录自动化流程是否在等待异步加载完成。
        self.pending_automation_step_index: int | None = None
        # 记录自动化动作的默认可见延迟。
        self.automation_visible_delay_ms = 900
        # 初始化任务列表。
        self.items: list[ConversionItem] = []
        # 初始化最近一次来源路径列表。
        self.source_targets: list[Path] = []

        # 创建顶部统计标签。
        self.dragged_count_value = QLabel("0")
        self.vob_count_value = QLabel("0")
        self.estimate_value = QLabel("--")
        self.remaining_value = QLabel("--")

        # 创建输出目录输入框。
        self.output_dir_edit = QLineEdit(str(DEFAULT_OUTPUT_DIR))
        # 创建模式选择框。
        self.mode_combo = QComboBox()
        # 加入全部可选模式。
        for mode_key, mode_config in CONVERSION_MODES.items():
            self.mode_combo.addItem(mode_config["title"], mode_key)
        # 同步当前模式到下拉框。
        self.mode_combo.setCurrentIndex(self.mode_combo.findData(self.mode_id))
        # 创建日志目录输入框。
        self.log_dir_edit = QLineEdit(str(self.resolve_initial_log_dir()))
        # 创建当前文件状态标签。
        self.current_file_status_label = QLabel("等待开始")
        # 创建当前文件名标签。
        self.current_file_name_value = QLabel("--")
        # 创建当前原路径标签。
        self.current_source_value = QLabel("--")
        # 创建当前输出路径标签。
        self.current_output_value = QLabel("--")
        # 创建当前时长标签。
        self.current_duration_value = QLabel("--")
        # 创建置顶勾选框。
        self.always_on_top_checkbox = ToggleSwitch()
        # 默认勾选置顶。
        self.always_on_top_checkbox.setChecked(self.always_on_top)
        # 创建拖放区域。
        self.drop_area = DropArea()
        # 创建文件列表表格。
        self.file_table = QTableWidget()
        # 创建当前文件进度条。
        self.current_progress_bar = QProgressBar()
        # 创建当前文件进度文本。
        self.current_progress_label = QLabel("0%")
        # 创建总体进度条。
        self.total_progress_bar = QProgressBar()
        # 创建总体进度文本。
        self.total_progress_label = QLabel("0%")
        # 创建目录映射文本框。
        self.mapping_text = QPlainTextEdit()
        # 创建目录映射来源值标签。
        self.mapping_source_value = QLabel("--")
        # 创建目录映射输出值标签。
        self.mapping_output_value = QLabel("--")
        # 创建目录映射层级保持值标签。
        self.mapping_keep_value = QLabel("是")
        # 创建日志文本框。
        self.log_text = QPlainTextEdit()
        # 创建实时日志说明标签。
        self.log_desc_label = QLabel("这里会持续显示扫描、预估时长、开始转换、实时进度和完成检查信息。")
        # 创建模式相关文案标签。
        self.hero_title_label = QLabel()
        self.hero_intro_label = QLabel()
        self.file_desc_label = QLabel()
        self.mode_hint_label = QLabel()
        # 创建自动化执行状态标签。
        self.log_status_label = QLabel("")
        # 初始化界面日志缓冲队列。
        self.log_message_queue: list[str] = []
        # 初始化界面日志刷新定时器。
        self.log_flush_timer = QTimer(self)
        # 绑定日志逐行刷新函数。
        self.log_flush_timer.timeout.connect(self.flush_next_log_message)
        # 初始化执行状态动画定时器。
        self.log_status_timer = QTimer(self)
        # 绑定执行状态动画刷新。
        self.log_status_timer.timeout.connect(self.advance_log_status_indicator)
        # 初始化执行状态基础文本。
        self.log_status_base_text = "正在执行,请耐心等待..."
        # 初始化执行状态动画索引。
        self.log_status_index = 0
        # 创建开始按钮。
        self.start_button = QPushButton("开始批量转换")
        # 设置主按钮对象名称。
        self.start_button.setObjectName("primaryButton")
        # 创建暂停按钮。
        self.pause_button = QPushButton("暂停转换")
        # 设置次按钮对象名称。
        self.pause_button.setObjectName("secondaryButton")
        # 初始禁用暂停按钮。
        self.pause_button.setEnabled(False)
        # 创建清空按钮。
        self.clear_button = QPushButton("清空列表")
        # 设置次按钮对象名称。
        self.clear_button.setObjectName("secondaryButton")
        # 创建导入路径按钮。
        self.import_button = QPushButton("导入路径")
        # 设置次按钮对象名称。
        self.import_button.setObjectName("secondaryButton")
        # 创建打开输出目录按钮。
        self.open_output_button = QPushButton("打开输出目录")
        # 设置次按钮对象名称。
        self.open_output_button.setObjectName("secondaryButton")

        # 组装界面。
        self.build_ui()
        # 绑定事件。
        self.bind_events()
        # 写入初始日志。
        self.append_log("准备就绪。")
        # 刷新模式相关文案。
        self.apply_mode_ui_text()
        # 同步开始按钮文案。
        self.update_start_button_text()
        # 如果传入了自动化计划，则在界面显示后自动执行。
        if self.automation_plan.get("steps"):
            QTimer.singleShot(450, self.start_automation_plan)

    # 定义解析初始日志目录的函数。
    def resolve_initial_log_dir(self) -> Path:
        # 如果显式日志文件存在，则使用其父目录。
        if self.explicit_log_file is not None:
            return self.explicit_log_file.parent
        # 返回默认日志目录。
        return DEFAULT_LOG_DIR

    # 定义组装界面的函数。
    def build_ui(self) -> None:
        # 创建中心容器。
        central_widget = QWidget()
        # 绑定中心容器。
        self.setCentralWidget(central_widget)
        # 创建主垂直布局。
        main_layout = QVBoxLayout(central_widget)
        # 设置边距。
        main_layout.setContentsMargins(18, 18, 18, 18)
        # 设置间距。
        main_layout.setSpacing(16)

        # 创建标题区布局。
        hero_layout = QHBoxLayout()
        # 创建标题容器。
        title_layout = QVBoxLayout()
        # 创建标题。
        title_label = self.hero_title_label
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 32px; font-weight: 700; color: #1f2a1f;")
        # 创建说明。
        intro_label = self.hero_intro_label
        # 设置说明样式。
        intro_label.setStyleSheet("font-size: 14px; color: #667166;")
        # 自动换行。
        intro_label.setWordWrap(True)
        # 放入标题。
        title_layout.addWidget(title_label)
        # 放入说明。
        title_layout.addWidget(intro_label)
        # 放入标题区。
        hero_layout.addLayout(title_layout, 1)
        # 创建标签。
        tag_label = QLabel("支持多格式批量转换")
        # 设置标签样式。
        tag_label.setStyleSheet(
            "background: #e8f5ea; border: 1px solid #c8e5cf; border-radius: 14px; "
            "padding: 9px 14px; color: #2f8d52; font-size: 13px; font-weight: 700;"
        )
        # 放入标签。
        hero_layout.addWidget(tag_label)
        # 放入标题区。
        main_layout.addLayout(hero_layout)

        # 创建左右主体布局。
        body_layout = QHBoxLayout()
        # 设置主体间距。
        body_layout.setSpacing(16)
        # 放入主体布局。
        main_layout.addLayout(body_layout, 1)

        # 创建左侧面板。
        left_panel = self.create_panel("左侧：任务区", "拖拽导入、查看批量文件列表、跟踪当前文件状态。")
        # 创建左侧内部布局。
        left_inner = left_panel.layout().itemAt(1).widget().widget().layout()
        # 放入拖放区。
        left_inner.addWidget(self.drop_area)
        # 放入顶部统计区。
        left_inner.addLayout(self.build_summary_cards())
        # 放入当前文件状态区。
        left_inner.addWidget(self.build_current_file_card())
        # 放入置顶选项区。
        left_inner.addWidget(self.build_always_on_top_card())
        # 放入文件列表区标题。
        file_title = QLabel("文件拖入列表")
        # 设置标题样式。
        file_title.setStyleSheet("font-size: 16px; font-weight: 600;")
        # 放入标题。
        left_inner.addWidget(file_title)
        # 创建文件列表说明。
        file_desc = self.file_desc_label
        # 设置说明样式。
        file_desc.setStyleSheet("font-size: 13px; color: #667166;")
        # 允许换行。
        file_desc.setWordWrap(True)
        # 放入说明。
        left_inner.addWidget(file_desc)
        # 配置文件列表表格。
        self.configure_table()
        # 放入表格。
        left_inner.addWidget(self.file_table, 1)
        # 放入按钮区。
        left_inner.addLayout(self.build_action_row())
        # 左侧面板占比较大。
        body_layout.addWidget(left_panel, 3)

        # 创建右侧面板。
        right_panel = self.create_panel("右侧：状态区", "这里显示输出与日志目录、目录映射、进度和实时日志。")
        # 创建右侧内部布局。
        right_inner = right_panel.layout().itemAt(1).widget().widget().layout()
        # 放入输出与日志配置区。
        right_inner.addWidget(self.build_output_config_card())
        # 放入目录映射区。
        right_inner.addWidget(self.build_mapping_card())
        # 放入日志区。
        right_inner.addWidget(self.build_log_card(), 1)
        # 右侧面板占比较小。
        body_layout.addWidget(right_panel, 2)

        # 应用整体样式。
        self.apply_styles()

    # 定义创建面板的函数。
    def create_panel(self, title_text: str, desc_text: str) -> QWidget:
        # 创建面板容器。
        panel = QWidget()
        # 设置对象名称。
        panel.setObjectName("panel")
        # 创建垂直布局。
        layout = QVBoxLayout(panel)
        # 设置边距。
        layout.setContentsMargins(18, 18, 18, 18)
        # 设置间距。
        layout.setSpacing(14)

        # 创建标题行。
        header_row = QHBoxLayout()
        # 创建标题区。
        title_wrap = QVBoxLayout()
        # 创建标题。
        title_label = QLabel(title_text)
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 20px; font-weight: 700;")
        # 创建说明。
        desc_label = QLabel(desc_text)
        # 设置说明样式。
        desc_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 放入标题和说明。
        title_wrap.addWidget(title_label)
        title_wrap.addWidget(desc_label)
        # 放入标题区。
        header_row.addLayout(title_wrap, 1)
        # 放入标题行。
        layout.addLayout(header_row)

        # 创建内部布局。
        inner_widget = QWidget()
        # 创建内部布局。
        inner_layout = QVBoxLayout(inner_widget)
        # 设置间距。
        inner_layout.setSpacing(14)
        # 创建滚动区域。
        scroll_area = QScrollArea()
        # 设置对象名称。
        scroll_area.setObjectName("panelScroll")
        # 允许自适应宽度。
        scroll_area.setWidgetResizable(True)
        # 关闭横向滚动条。
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        # 放入内容部件。
        scroll_area.setWidget(inner_widget)
        # 放入滚动区域。
        layout.addWidget(scroll_area, 1)
        # 返回面板。
        return panel

    # 定义顶部统计区函数。
    def build_summary_cards(self) -> QGridLayout:
        # 创建网格布局。
        grid = QGridLayout()
        # 设置间距。
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(12)
        # 放入四个统计卡片。
        grid.addWidget(self.create_metric_card("拖入文件数", self.dragged_count_value), 0, 0)
        grid.addWidget(self.create_metric_card("识别到的文件", self.vob_count_value), 0, 1)
        grid.addWidget(self.create_metric_card("预计转换总时长", self.estimate_value), 0, 2)
        grid.addWidget(self.create_metric_card("剩余转换总时长", self.remaining_value), 0, 3)
        # 返回网格布局。
        return grid

    # 定义创建统计卡片函数。
    def create_metric_card(self, title_text: str, value_label: QLabel) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("metricCard")
        # 创建垂直布局。
        layout = QVBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(14, 14, 14, 14)
        # 设置间距。
        layout.setSpacing(6)
        # 创建标题。
        title_label = QLabel(title_text)
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 设置值样式。
        value_label.setStyleSheet("font-size: 26px; font-weight: 700; color: #1f2a1f;")
        # 放入标题和值。
        layout.addWidget(title_label)
        layout.addWidget(value_label)
        # 返回卡片。
        return card

    # 定义当前文件状态卡片函数。
    def build_current_file_card(self) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("sectionCard")
        # 创建垂直布局。
        layout = QVBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(16, 16, 16, 16)
        # 设置间距。
        layout.setSpacing(8)
        # 创建标题。
        title_label = QLabel("当前文件状态")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 18px; font-weight: 700; color: #1f2a1f; padding-bottom: 4px;")
        # 设置状态标签允许换行。
        self.current_file_status_label.setWordWrap(True)
        # 设置状态标签样式。
        self.current_file_status_label.setStyleSheet(
            "font-size: 15px; color: #2f3b2f; line-height: 1.6; padding-top: 2px; padding-bottom: 6px;"
        )
        # 创建头部布局。
        top_row = QHBoxLayout()
        # 设置间距。
        top_row.setSpacing(12)
        # 创建状态提示卡片。
        status_message_card = QWidget()
        # 设置对象名称。
        status_message_card.setObjectName("infoMiniCard")
        # 创建状态提示布局。
        status_message_layout = QVBoxLayout(status_message_card)
        # 设置边距。
        status_message_layout.setContentsMargins(16, 14, 16, 14)
        # 放入状态说明。
        status_message_layout.addWidget(self.current_file_status_label)
        # 放入状态说明卡片。
        top_row.addWidget(status_message_card, 3)
        # 创建当前文件卡片。
        current_file_card = self.build_inline_info_card("当前文件", self.current_file_name_value)
        # 创建当前时长卡片。
        current_duration_card = self.build_inline_info_card("当前时长", self.current_duration_value)
        # 放入两个卡片，依赖同一层布局间距保证空白一致。
        top_row.addWidget(current_file_card, 3)
        top_row.addWidget(current_duration_card, 3)
        # 放入头部布局。
        layout.addLayout(top_row)

        # 设置进度范围。
        self.current_progress_bar.setRange(0, 100)
        self.total_progress_bar.setRange(0, 100)
        # 放入总进度标题。
        layout.addWidget(self.build_progress_title("总进度", self.total_progress_label))
        # 放入总进度条。
        layout.addWidget(self.total_progress_bar)
        # 放入当前文件进度标题。
        layout.addWidget(self.build_progress_title("当前文件进度", self.current_progress_label))
        # 放入当前文件进度条。
        layout.addWidget(self.current_progress_bar)
        # 放入标题。
        layout.insertWidget(0, title_label)
        # 返回卡片。
        return card

    # 定义信息键标签构造函数。
    def build_info_key(self, title_text: str) -> QLabel:
        # 创建标签。
        label = QLabel(f"{title_text}：")
        # 设置样式。
        label.setStyleSheet("font-size: 13px; color: #667166;")
        # 返回标签。
        return label

    # 定义信息值标签构造函数。
    def build_info_value(self, label: QLabel) -> QLabel:
        # 允许换行。
        label.setWordWrap(True)
        # 设置样式。
        label.setStyleSheet("font-size: 13px; font-weight: 600; color: #1f2a1f;")
        # 返回标签。
        return label

    # 定义行内信息卡片构造函数。
    def build_inline_info_card(self, title_text: str, value_label: QLabel) -> QWidget:
        # 创建卡片容器。
        card_widget = QWidget()
        # 设置对象名称。
        card_widget.setObjectName("infoMiniCard")
        # 创建垂直布局。
        card_layout = QVBoxLayout(card_widget)
        # 设置边距。
        card_layout.setContentsMargins(16, 14, 16, 14)
        # 设置间距。
        card_layout.setSpacing(8)
        # 创建标题。
        title_label = QLabel(f"{title_text}：")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 14px; color: #667166; font-weight: 600;")
        # 设置数值标签样式。
        value_label.setWordWrap(True)
        value_label.setStyleSheet("font-size: 15px; font-weight: 700; color: #1f2a1f;")
        # 放入标题和值。
        card_layout.addWidget(title_label)
        card_layout.addWidget(value_label)
        # 放大卡片最小宽度，避免显得过小。
        card_widget.setMinimumWidth(180)
        # 返回卡片。
        return card_widget

    # 定义进度标题行构造函数。
    def build_progress_title(self, title_text: str, value_label: QLabel) -> QWidget:
        # 创建容器。
        row_widget = QWidget()
        # 创建水平布局。
        row_layout = QHBoxLayout(row_widget)
        # 设置边距。
        row_layout.setContentsMargins(0, 4, 0, 0)
        # 创建标题。
        title_label = QLabel(title_text)
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 14px; color: #667166;")
        # 设置数值样式。
        value_label.setStyleSheet("font-size: 14px; color: #667166;")
        # 放入布局。
        row_layout.addWidget(title_label)
        row_layout.addStretch(1)
        row_layout.addWidget(value_label)
        # 返回容器。
        return row_widget

    # 定义置顶区卡片函数。
    def build_always_on_top_card(self) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("sectionCard")
        # 创建水平布局。
        layout = QHBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(16, 12, 16, 12)
        # 创建说明区。
        text_layout = QVBoxLayout()
        # 设置间距。
        text_layout.setSpacing(2)
        # 创建标题。
        title_label = QLabel("始终置顶")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 15px; font-weight: 600;")
        # 创建说明。
        desc_label = QLabel("转换期间窗口保持最前，默认开启。")
        # 设置说明样式。
        desc_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 放入说明区。
        text_layout.addWidget(title_label)
        text_layout.addWidget(desc_label)
        # 放入布局。
        layout.addLayout(text_layout, 1)
        layout.addWidget(self.always_on_top_checkbox)
        # 返回卡片。
        return card

    # 定义按钮行函数。
    def build_action_row(self) -> QHBoxLayout:
        # 创建按钮布局。
        row = QHBoxLayout()
        # 放入开始按钮。
        row.addWidget(self.start_button)
        # 放入暂停按钮。
        row.addWidget(self.pause_button)
        # 放入清空按钮。
        row.addWidget(self.clear_button)
        # 放入导入路径按钮。
        row.addWidget(self.import_button)
        # 放入打开输出目录按钮。
        row.addWidget(self.open_output_button)
        # 添加剩余空白。
        row.addStretch(1)
        # 返回布局。
        return row

    # 定义输出配置卡片函数。
    def build_output_config_card(self) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("sectionCard")
        # 创建垂直布局。
        layout = QVBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(16, 16, 16, 16)
        # 设置间距。
        layout.setSpacing(12)
        # 创建标题。
        title_label = QLabel("输出与日志")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 16px; font-weight: 600;")
        # 放入标题。
        layout.addWidget(title_label)
        # 放入模式选择行。
        layout.addLayout(self.build_mode_row())
        # 放入输出目录行。
        layout.addLayout(self.build_pick_row("输出目录", self.output_dir_edit, self.choose_output_dir))
        # 放入日志目录行。
        layout.addLayout(self.build_pick_row("日志目录", self.log_dir_edit, self.choose_log_dir))
        # 创建提示。
        hint_label = QLabel("输出目录可以自定义。日志目录如果不存在，会在开始转换时自动创建。")
        # 设置提示样式。
        hint_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 自动换行。
        hint_label.setWordWrap(True)
        # 放入提示。
        layout.addWidget(hint_label)
        # 设置模式说明样式。
        self.mode_hint_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 允许自动换行。
        self.mode_hint_label.setWordWrap(True)
        # 放入模式说明。
        layout.addWidget(self.mode_hint_label)
        # 返回卡片。
        return card

    # 定义模式选择行函数。
    def build_mode_row(self) -> QVBoxLayout:
        # 创建垂直布局。
        wrapper = QVBoxLayout()
        # 设置间距。
        wrapper.setSpacing(6)
        # 创建标题。
        label = QLabel("转换模式")
        # 设置标题样式。
        label.setStyleSheet("font-size: 13px; color: #667166;")
        # 设置下拉框高度。
        self.mode_combo.setMinimumHeight(40)
        # 放入标题和下拉框。
        wrapper.addWidget(label)
        wrapper.addWidget(self.mode_combo)
        # 返回布局。
        return wrapper

    # 定义输出选择行函数。
    def build_pick_row(self, title_text: str, edit: QLineEdit, choose_callback) -> QVBoxLayout:
        # 创建垂直布局。
        wrapper = QVBoxLayout()
        # 设置间距。
        wrapper.setSpacing(6)
        # 创建标签。
        label = QLabel(title_text)
        # 设置标签样式。
        label.setStyleSheet("font-size: 13px; color: #667166;")
        # 创建水平布局。
        row = QHBoxLayout()
        # 创建选择按钮。
        button = QPushButton("选择目录")
        # 绑定按钮事件。
        button.clicked.connect(choose_callback)
        # 放入输入框和按钮。
        row.addWidget(edit, 1)
        row.addWidget(button)
        # 放入整体布局。
        wrapper.addWidget(label)
        wrapper.addLayout(row)
        # 返回整体布局。
        return wrapper

    # 定义目录映射卡片函数。
    def build_mapping_card(self) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("sectionCard")
        # 创建垂直布局。
        layout = QVBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(16, 16, 16, 16)
        # 设置间距。
        layout.setSpacing(10)
        # 创建标题。
        title_label = QLabel("目录映射")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 18px; font-weight: 700; color: #1f2a1f;")
        # 创建映射网格。
        mapping_grid = QGridLayout()
        # 设置横向间距。
        mapping_grid.setHorizontalSpacing(2)
        # 设置纵向间距。
        mapping_grid.setVerticalSpacing(8)
        # 让左列只占最小宽度，右列吃掉剩余空间。
        mapping_grid.setColumnStretch(0, 0)
        mapping_grid.setColumnStretch(1, 1)
        # 放入三行映射信息。
        mapping_grid.addWidget(self.build_info_key("来源目录"), 0, 0)
        mapping_grid.addWidget(self.build_mapping_value(self.mapping_source_value), 0, 1)
        mapping_grid.addWidget(self.build_info_key("输出目录"), 1, 0)
        mapping_grid.addWidget(self.build_mapping_value(self.mapping_output_value), 1, 1)
        mapping_grid.addWidget(self.build_info_key("层级保持"), 2, 0)
        mapping_grid.addWidget(self.build_mapping_value(self.mapping_keep_value), 2, 1)
        # 放入控件。
        layout.addWidget(title_label)
        layout.addLayout(mapping_grid)
        # 返回卡片。
        return card

    # 定义目录映射值标签构造函数。
    def build_mapping_value(self, label: QLabel) -> QLabel:
        # 允许自动换行。
        label.setWordWrap(True)
        # 设置样式。
        label.setStyleSheet("font-size: 14px; font-weight: 400; color: #1f2a1f;")
        # 返回标签。
        return label

    # 定义进度卡片函数。
    def build_progress_card(self) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("sectionCard")
        # 创建垂直布局。
        layout = QVBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(16, 16, 16, 16)
        # 设置间距。
        layout.setSpacing(10)
        # 创建标题。
        title_label = QLabel("转换进度")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 16px; font-weight: 600;")
        # 设置进度范围。
        self.current_progress_bar.setRange(0, 100)
        self.total_progress_bar.setRange(0, 100)
        # 放入当前文件进度。
        layout.addWidget(title_label)
        # 创建说明。
        desc_label = QLabel("上方显示当前文件进度，下方显示整个批量任务的总进度。")
        # 设置说明样式。
        desc_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 开启换行。
        desc_label.setWordWrap(True)
        # 放入说明。
        layout.addWidget(desc_label)
        layout.addWidget(QLabel("当前文件"))
        layout.addWidget(self.current_progress_bar)
        layout.addWidget(self.current_progress_label)
        # 放入总体进度。
        layout.addWidget(QLabel("总体进度"))
        layout.addWidget(self.total_progress_bar)
        layout.addWidget(self.total_progress_label)
        # 返回卡片。
        return card

    # 定义日志卡片函数。
    def build_log_card(self) -> QWidget:
        # 创建卡片容器。
        card = QWidget()
        # 设置对象名称。
        card.setObjectName("sectionCard")
        # 创建垂直布局。
        layout = QVBoxLayout(card)
        # 设置边距。
        layout.setContentsMargins(16, 16, 16, 16)
        # 设置间距。
        layout.setSpacing(10)
        # 创建标题。
        title_label = QLabel("实时日志")
        # 设置标题样式。
        title_label.setStyleSheet("font-size: 20px; font-weight: 700; color: #1f2a1f;")
        # 设置说明样式。
        self.log_desc_label.setStyleSheet("font-size: 13px; color: #667166;")
        # 允许换行。
        self.log_desc_label.setWordWrap(True)
        # 设置执行状态样式。
        self.log_status_label.setStyleSheet(
            "font-size: 13px; font-weight: 700; color: #8a6f00; "
            "background: #fff6d8; border: 1px solid #ead79a; border-radius: 8px; padding: 8px 12px;"
        )
        # 默认隐藏执行状态。
        self.log_status_label.hide()
        # 设置日志框只读。
        self.log_text.setReadOnly(True)
        # 设置日志框对象名称。
        self.log_text.setObjectName("logText")
        # 放入标题与日志。
        layout.addWidget(title_label)
        layout.addWidget(self.log_desc_label)
        layout.addWidget(self.log_text, 1)
        layout.addWidget(self.log_status_label)
        # 返回卡片。
        return card

    # 定义配置表格函数。
    def configure_table(self) -> None:
        # 设置列数。
        self.file_table.setColumnCount(7)
        # 设置表头。
        self.file_table.setHorizontalHeaderLabels(
            ["状态", "文件名", "预计转换时长", "播放时长", "文件大小", "源路径(双击打开)", "输出路径(双击打开)"]
        )
        # 关闭编辑。
        self.file_table.setEditTriggers(QTableWidget.NoEditTriggers)
        # 选择整行。
        self.file_table.setSelectionBehavior(QTableWidget.SelectRows)
        # 开启斑马纹。
        self.file_table.setAlternatingRowColors(True)
        # 隐藏垂直表头。
        self.file_table.verticalHeader().setVisible(False)
        # 设置最后一列自动拉伸。
        self.file_table.horizontalHeader().setStretchLastSection(True)
        # 设置列宽。
        self.file_table.setColumnWidth(0, 100)
        self.file_table.setColumnWidth(1, 170)
        self.file_table.setColumnWidth(2, 100)
        self.file_table.setColumnWidth(3, 100)
        self.file_table.setColumnWidth(4, 110)
        self.file_table.setColumnWidth(5, 330)
        self.file_table.setColumnWidth(6, 360)
        # 设置滚动策略。
        self.file_table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        # 设置最小可见高度，避免表格被压得只剩表头。
        self.file_table.setMinimumHeight(240)
        # 开启垂直滚动条。
        self.file_table.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)

    # 定义整体样式函数。
    def apply_styles(self) -> None:
        # 设置整窗样式。
        self.setStyleSheet(
            """
            QMainWindow {
                background: #f5f7f2;
            }
            QWidget#panel {
                background: #ffffff;
                border: 1px solid #d8e0d2;
                border-radius: 22px;
            }
            QScrollArea#panelScroll {
                border: none;
                background: transparent;
            }
            QScrollArea#panelScroll > QWidget > QWidget {
                background: transparent;
            }
            QWidget#metricCard {
                background: #eef7ef;
                border: 1px solid #d7e9d8;
                border-radius: 18px;
            }
            QWidget#sectionCard {
                background: #fbfdf9;
                border: 1px solid #d8e0d2;
                border-radius: 18px;
            }
            QWidget#infoMiniCard {
                background: #f6faf4;
                border: 1px solid #d8e0d2;
                border-radius: 14px;
            }
            QFrame#dropArea {
                border: 2px dashed #c8d7c8;
                border-radius: 20px;
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #fcfefd,
                    stop: 1 #f3f8f1
                );
            }
            QLineEdit, QPlainTextEdit, QTableWidget {
                background: #ffffff;
                border: 1px solid #d7e2d3;
                border-radius: 12px;
                padding: 8px;
                color: #1f2a1f;
            }
            QComboBox {
                background: #ffffff;
                border: 1px solid #d7e2d3;
                border-radius: 12px;
                padding: 8px 12px;
                color: #1f2a1f;
                min-height: 40px;
            }
            QLineEdit[automationPulse="true"] {
                border: 2px solid #59b276;
                background: #f4fbf5;
            }
            QLineEdit {
                min-height: 40px;
                selection-background-color: #b7dabc;
            }
            QTableWidget {
                gridline-color: #e9eee4;
                alternate-background-color: #fbfdf9;
            }
            QHeaderView::section {
                background: #f4f8f2;
                color: #667166;
                border: none;
                border-bottom: 1px solid #e9eee4;
                padding: 10px 8px;
                font-size: 13px;
                font-weight: 600;
            }
            QPushButton {
                background: #eef6ed;
                border: 1px solid #cfe0ce;
                border-radius: 12px;
                padding: 8px 14px;
                color: #376644;
                font-weight: 600;
            }
            QPushButton[automationPulse="true"] {
                border: 2px solid #59b276;
                background: #eef9f0;
            }
            QPushButton:hover {
                background: #e4f1e2;
            }
            QPushButton#primaryButton {
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #59b276,
                    stop: 1 #409c5e
                );
                color: #ffffff;
                border: 1px solid #3f995d;
                padding: 10px 18px;
            }
            QPushButton#primaryButton:hover {
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 0, y2: 1,
                    stop: 0 #64b97e,
                    stop: 1 #46a365
                );
            }
            QPushButton#primaryButton:disabled {
                background: #dfe6de;
                color: #93a193;
                border: 1px solid #c7d1c7;
            }
            QPushButton#secondaryButton:disabled {
                background: #f0f3ee;
                color: #8ea18f;
                border: 1px solid #d7dfd5;
            }
            QPushButton:disabled {
                color: #8ea18f;
                background: #f0f3ee;
            }
            QProgressBar {
                border: 1px solid #d5e2d1;
                border-radius: 10px;
                text-align: center;
                background: #f6faf4;
                min-height: 20px;
            }
            QProgressBar::chunk {
                background: #4da56a;
                border-radius: 9px;
            }
            QPlainTextEdit {
                line-height: 1.6;
            }
            QPlainTextEdit#logText {
                background: #101711;
                color: #d8f5df;
                border: none;
                border-radius: 18px;
                padding: 14px;
                font-family: "SF Mono", "Menlo", "Consolas";
                font-size: 13px;
            }
            QTableWidget {
                font-size: 13px;
            }
            """
        )

    # 定义绑定事件函数。
    def bind_events(self) -> None:
        # 绑定拖拽完成事件。
        self.drop_area.paths_dropped.connect(self.on_paths_dropped)
        # 绑定开始按钮。
        self.start_button.clicked.connect(self.start_conversion)
        # 绑定暂停按钮。
        self.pause_button.clicked.connect(self.pause_conversion)
        # 绑定清空按钮。
        self.clear_button.clicked.connect(self.clear_items)
        # 绑定导入路径按钮。
        self.import_button.clicked.connect(self.choose_import_paths)
        # 绑定模式切换。
        self.mode_combo.currentIndexChanged.connect(self.on_mode_changed)
        # 绑定打开输出目录按钮。
        self.open_output_button.clicked.connect(self.open_output_folder)
        # 绑定表格双击事件。
        self.file_table.cellDoubleClicked.connect(self.on_file_table_double_clicked)
        # 绑定置顶切换。
        self.always_on_top_checkbox.toggled.connect(self.apply_window_pin)
        # 应用初始置顶状态。
        self.apply_window_pin(self.always_on_top_checkbox.isChecked())

    # 定义刷新模式文案函数。
    def apply_mode_ui_text(self) -> None:
        # 读取当前模式配置。
        mode_config = get_mode_config(self.mode_id)
        # 刷新标题。
        self.hero_title_label.setText(mode_config["title"])
        # 刷新副标题。
        self.hero_intro_label.setText(
            "支持拖入文件或文件夹，转换前会先统计预计转换总时长。"
            "左侧负责拖拽、文件列表与当前文件状态，右侧负责转换模式、输出目录、目录映射与实时日志。"
        )
        # 刷新文件说明。
        self.file_desc_label.setText(
            f"默认会展示当前来源中符合 {mode_config['title']} 模式的文件。拖入新文件或文件夹后，列表会直接刷新到这里。"
        )
        # 刷新模式提示。
        input_suffix_text = " / ".join(suffix.upper() for suffix in mode_config["input_suffixes"])
        self.mode_hint_label.setText(
            f"当前模式会扫描 {input_suffix_text} 文件，并默认输出 {mode_config['output_suffix'].upper()} 文件。"
        )

    # 定义模式切换槽函数。
    def on_mode_changed(self) -> None:
        # 如果转换正在执行，则不允许切换模式。
        if self.worker_thread is not None:
            QMessageBox.information(self, "提示", "转换进行中，暂时不能切换转换模式。")
            self.mode_combo.blockSignals(True)
            self.mode_combo.setCurrentIndex(self.mode_combo.findData(self.mode_id))
            self.mode_combo.blockSignals(False)
            return
        # 读取选中模式。
        selected_mode = self.mode_combo.currentData()
        # 如果读取失败或模式未变化，则直接返回。
        if not selected_mode or selected_mode == self.mode_id:
            return
        # 切换当前模式。
        self.mode_id = selected_mode
        # 模式切换后清除显式输出文件，避免扩展名不一致。
        self.explicit_output_file = None
        # 刷新模式文案。
        self.apply_mode_ui_text()
        # 刷新开始按钮文案。
        self.update_start_button_text()
        # 如已有来源路径，则按新模式重建任务列表。
        if self.source_targets:
            self.set_items_from_paths(self.source_targets)

    # 定义初始加载函数。
    def load_initial_items(self) -> None:
        # 如果存在显式输入文件，则优先加载显式输入文件。
        if self.explicit_input_file is not None and self.explicit_input_file.exists():
            self.set_items_from_paths([self.explicit_input_file])
            return

    # 定义拖拽路径处理函数。
    def on_paths_dropped(self, path_strings: list[str]) -> None:
        # 将字符串路径转换为 Path 列表。
        dropped_paths = [Path(path_string) for path_string in path_strings]
        # 根据拖入路径重建任务列表。
        self.set_items_from_paths(dropped_paths)
        # 写入日志。
        self.append_log(f"已拖入 {len(path_strings)} 个路径，已刷新任务列表。")

    # 定义是否存在可继续任务的函数。
    def has_resumable_items(self) -> bool:
        # 只要存在未完成项，就视为可继续。
        return any(item.status_text != "完成" for item in self.items) and any(
            item.status_text in {"已暂停", "待转换", "失败", "转换中"}
            for item in self.items
        )

    # 定义开始按钮文案同步函数。
    def update_start_button_text(self) -> None:
        # 如果正在请求暂停，则显示暂停中。
        if self.pause_requested:
            self.start_button.setText("暂停中...")
            return
        # 如果存在可继续任务，则显示继续。
        if self.has_resumable_items() and any(item.status_text != "待转换" for item in self.items):
            self.start_button.setText("继续转换")
            return
        # 默认显示开始。
        self.start_button.setText("开始转换")

    # 定义显示暂停中提示框函数。
    def show_pause_progress_dialog(self) -> None:
        # 如果提示框已经存在，则只更新显示状态。
        if self.pause_progress_dialog is not None:
            self.pause_progress_dialog.show()
            return
        # 创建暂停中提示框。
        dialog = QProgressDialog("正在暂停转换，请等待当前任务停止。", None, 0, 0, self)
        # 取消关闭按钮，避免用户中断状态提示。
        dialog.setCancelButton(None)
        # 设置为窗口级模态，保证提示清晰。
        dialog.setWindowModality(Qt.WindowModal)
        # 设置标题。
        dialog.setWindowTitle("暂停中")
        # 保持最小化尺寸。
        dialog.setMinimumDuration(0)
        # 记录提示框对象。
        self.pause_progress_dialog = dialog
        # 显示提示框。
        dialog.show()

    # 定义关闭暂停中提示框函数。
    def hide_pause_progress_dialog(self) -> None:
        # 如果提示框不存在，则直接返回。
        if self.pause_progress_dialog is None:
            return
        # 关闭提示框。
        self.pause_progress_dialog.close()
        # 删除提示框对象。
        self.pause_progress_dialog.deleteLater()
        # 清空引用。
        self.pause_progress_dialog = None

    # 定义显示加载中进度框函数。
    def show_loading_progress_dialog(self, message: str) -> None:
        # 如果提示框已存在，则只更新文案。
        if self.loading_progress_dialog is not None:
            self.loading_progress_dialog.setLabelText(message)
            self.loading_progress_dialog.show()
            return
        # 创建加载进度框。
        dialog = QProgressDialog(message, None, 0, 0, self)
        # 取消关闭按钮，避免要求手动确认。
        dialog.setCancelButton(None)
        # 设置窗口级模态。
        dialog.setWindowModality(Qt.WindowModal)
        # 设置标题。
        dialog.setWindowTitle("正在加载")
        # 立即显示。
        dialog.setMinimumDuration(0)
        # 记录对象。
        self.loading_progress_dialog = dialog
        # 显示提示框。
        dialog.show()

    # 定义关闭加载中进度框函数。
    def hide_loading_progress_dialog(self) -> None:
        # 如果不存在，则直接返回。
        if self.loading_progress_dialog is None:
            return
        # 关闭提示框。
        self.loading_progress_dialog.close()
        # 删除提示框对象。
        self.loading_progress_dialog.deleteLater()
        # 清空引用。
        self.loading_progress_dialog = None

    # 定义按钮状态同步函数。
    def sync_action_buttons(self, state: str) -> None:
        # 运行中：开始按钮灰掉，暂停按钮可点。
        if state == "running":
            self.start_button.setEnabled(False)
            self.pause_button.setEnabled(True)
            self.update_start_button_text()
            return
        # 暂停中：两个按钮都灰掉。
        if state == "pausing":
            self.start_button.setEnabled(False)
            self.pause_button.setEnabled(False)
            self.update_start_button_text()
            self.show_pause_progress_dialog()
            return
        # 已暂停：继续转换按钮恢复绿色可点，暂停按钮保持灰色。
        if state == "paused":
            self.start_button.setEnabled(True)
            self.pause_button.setEnabled(False)
            self.hide_pause_progress_dialog()
            self.update_start_button_text()
            return
        # 默认空闲/完成态：开始按钮可点，暂停按钮灰色。
        self.start_button.setEnabled(True)
        self.pause_button.setEnabled(False)
        self.hide_pause_progress_dialog()
        self.update_start_button_text()

    # 定义根据路径重建任务列表函数。
    def set_items_from_paths(self, raw_paths: list[Path]) -> None:
        # 如果转换正在执行，则不允许直接重建任务列表。
        if self.worker_thread is not None:
            QMessageBox.information(self, "提示", "转换进行中，暂时不能重建任务列表。")
            return
        # 如果当前正在加载，则不重复发起。
        if self.load_thread is not None:
            self.append_log("正在加载目录，请等待当前扫描完成。")
            return
        # 记录本次来源路径，后续切换输出目录时继续沿用。
        self.source_targets = [path.resolve() for path in raw_paths]
        # 解析输出目录。
        output_dir = Path(self.output_dir_edit.text()).expanduser().resolve()
        # 清空旧表格，避免误以为卡死。
        self.items = []
        self.refresh_table()
        self.refresh_summary()
        self.refresh_mapping_text()
        # 显示加载进度框。
        self.show_loading_progress_dialog("正在扫描目录并识别可转换文件，请等待当前扫描完成。")
        # 创建加载线程。
        self.load_thread = QThread(self)
        # 创建加载 worker。
        self.load_worker = LoadItemsWorker(
            raw_paths=self.source_targets,
            output_dir=output_dir,
            mode_id=self.mode_id,
            explicit_output_file=self.explicit_output_file,
        )
        # 挂到后台线程。
        self.load_worker.moveToThread(self.load_thread)
        # 线程启动后执行加载。
        self.load_thread.started.connect(self.load_worker.run)
        # 绑定加载信号。
        self.load_worker.progress_signal.connect(self.on_load_progress)
        self.load_worker.done_signal.connect(self.on_load_done)
        self.load_worker.error_signal.connect(self.on_load_error)
        # 启动后台加载。
        self.load_thread.start()

    # 定义刷新表格函数。
    def refresh_table(self) -> None:
        # 设置表格行数。
        self.file_table.setRowCount(len(self.items))
        # 逐行写入任务项。
        for row_index, item in enumerate(self.items):
            # 创建状态单元格。
            status_item = QTableWidgetItem(item.status_text)
            # 为状态补充提示。
            status_item.setToolTip(item.status_text)
            # 写入状态单元格。
            self.file_table.setItem(row_index, 0, status_item)
            # 创建文件名单元格。
            file_name_item = QTableWidgetItem(item.source_path.name)
            # 为文件名单元格补充提示。
            file_name_item.setToolTip(item.source_path.name)
            # 写入文件名单元格。
            self.file_table.setItem(row_index, 1, file_name_item)
            # 创建原路径单元格。
            source_item = QTableWidgetItem(str(item.source_path))
            # 为原路径补充完整路径提示。
            source_item.setToolTip(str(item.source_path))
            # 创建预计转换时长单元格。
            duration_item = QTableWidgetItem(format_seconds(item.estimated_conversion_seconds))
            # 为预计转换时长补充提示。
            duration_item.setToolTip(format_seconds(item.estimated_conversion_seconds))
            # 写入预计转换时长单元格。
            self.file_table.setItem(row_index, 2, duration_item)
            # 创建播放时长单元格。
            playback_item = QTableWidgetItem(format_seconds(item.duration_seconds))
            # 为播放时长补充提示。
            playback_item.setToolTip(format_seconds(item.duration_seconds))
            # 写入播放时长单元格。
            self.file_table.setItem(row_index, 3, playback_item)
            # 创建文件大小单元格。
            file_size_item = QTableWidgetItem(format_file_size(item.file_size_bytes))
            # 为文件大小补充提示。
            file_size_item.setToolTip(f"{item.file_size_bytes} bytes")
            # 写入文件大小单元格。
            self.file_table.setItem(row_index, 4, file_size_item)
            # 写入原路径单元格。
            self.file_table.setItem(row_index, 5, source_item)
            # 创建输出路径单元格。
            output_item = QTableWidgetItem(str(item.output_path))
            # 为输出路径补充完整路径提示。
            output_item.setToolTip(str(item.output_path))
            # 写入输出路径单元格。
            self.file_table.setItem(row_index, 6, output_item)

    # 定义刷新统计区函数。
    def refresh_summary(self) -> None:
        # 计算预计转换总时长。
        total_duration = sum(
            item.estimated_conversion_seconds
            for item in self.items
            if item.status_text != "完成"
        )
        # 更新拖入文件数。
        self.dragged_count_value.setText(str(len(self.items)))
        # 更新识别到的源文件数。
        self.vob_count_value.setText(str(len(self.items)))
        # 更新预计转换总时长。
        self.estimate_value.setText(format_seconds(total_duration))
        # 更新剩余转换总时长。
        self.remaining_value.setText(format_seconds(total_duration))
        # 如果存在任务项，则更新当前状态。
        if self.items:
            self.update_current_item_display(self.items[0], "待开始，首个文件已准备。")
        else:
            self.current_file_status_label.setText("未识别到可转换文件")
            self.current_file_name_value.setText("--")
            self.current_source_value.setText("--")
            self.current_output_value.setText("--")
            self.current_duration_value.setText("--")
        # 同步开始按钮文案。
        self.update_start_button_text()

    # 定义刷新目录映射区函数。
    def refresh_mapping_text(self) -> None:
        # 如果当前没有任务，则显示占位说明。
        if not self.items:
            self.mapping_source_value.setText("未识别到来源目录")
            self.mapping_output_value.setText("未生成输出目录映射")
            self.mapping_keep_value.setText("--")
            return
        # 读取第一个任务项，作为当前映射展示。
        first_item = self.items[0]
        # 读取输出目录。
        output_dir = Path(self.output_dir_edit.text()).expanduser()
        # 更新来源目录显示。
        self.mapping_source_value.setText(str(first_item.source_path.parent))
        # 更新输出目录显示。
        self.mapping_output_value.setText(str(first_item.output_path.parent))
        # 固定显示层级保持。
        self.mapping_keep_value.setText("是")

    # 定义加载进度槽函数。
    def on_load_progress(self, message: str) -> None:
        # 更新加载进度框文案。
        self.show_loading_progress_dialog(message)
        # 同步写入日志，便于观察加载过程。
        self.append_log(message)

    # 定义加载完成槽函数。
    def on_load_done(self, source_targets: list[Path], items: list[ConversionItem]) -> None:
        # 关闭加载进度框。
        self.hide_loading_progress_dialog()
        # 落地来源路径和任务列表。
        self.source_targets = [path.resolve() for path in source_targets]
        self.items = items
        # 刷新界面显示。
        self.refresh_table()
        self.refresh_summary()
        self.refresh_mapping_text()
        # 清理加载线程。
        self.cleanup_load_worker()
        # 如果自动化流程在等待目录加载完成，则继续下一步。
        if self.pending_automation_step_index is not None:
            next_step_index = self.pending_automation_step_index
            self.pending_automation_step_index = None
            self.show_automation_status("我已经完成文件识别，接下来继续执行下一步操作。")
            QTimer.singleShot(self.automation_visible_delay_ms, lambda: self.run_automation_step(next_step_index))

    # 定义加载失败槽函数。
    def on_load_error(self, error_text: str) -> None:
        # 关闭加载进度框。
        self.hide_loading_progress_dialog()
        # 清理加载线程。
        self.cleanup_load_worker()
        # 清空等待中的自动化步骤。
        self.pending_automation_step_index = None
        # 记录日志。
        self.append_log(error_text)
        # 弹出错误提示。
        QMessageBox.critical(self, "错误", "目录加载失败，详细信息已写入日志。")

    # 定义加载线程清理函数。
    def cleanup_load_worker(self) -> None:
        # 清理加载 worker。
        if self.load_worker is not None:
            self.load_worker.deleteLater()
            self.load_worker = None
        # 清理加载线程。
        if self.load_thread is not None:
            self.load_thread.quit()
            self.load_thread.wait()
            self.load_thread.deleteLater()
            self.load_thread = None

    # 定义追加日志函数。
    def append_log(self, message: str) -> None:
        # 将日志加入界面缓冲队列。
        self.log_message_queue.append(message)
        # 如果当前未在刷新，则启动逐行刷新。
        if not self.log_flush_timer.isActive():
            self.log_flush_timer.start(120)
        # 如果存在显式日志文件，则同步追加实时日志，便于外部检查自动化步骤。
        if self.explicit_log_file is not None:
            # 确保日志目录存在。
            self.explicit_log_file.parent.mkdir(parents=True, exist_ok=True)
            # 生成时间前缀。
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            # 以追加模式写入实时日志。
            with self.explicit_log_file.open("a", encoding="utf-8") as log_handle:
                # 写入一行日志。
                log_handle.write(f"[{timestamp}] {message}\n")

    # 定义逐行刷新下一条日志函数。
    def flush_next_log_message(self) -> None:
        # 如果队列为空，则停止刷新。
        if not self.log_message_queue:
            self.log_flush_timer.stop()
            return
        # 取出第一条日志。
        message = self.log_message_queue.pop(0)
        # 向日志框追加消息。
        self.log_text.appendPlainText(message)
        # 滚动到底部。
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
        # 如果已经没有剩余日志，则停止刷新。
        if not self.log_message_queue:
            self.log_flush_timer.stop()

    # 定义文件列表双击处理函数。
    def on_file_table_double_clicked(self, row_index: int, column_index: int) -> None:
        # 如果行索引越界，则直接返回。
        if row_index >= len(self.items):
            return
        # 读取当前任务项。
        item = self.items[row_index]
        # 如果双击的是原路径列，则打开源文件所在目录。
        if column_index == 5:
            subprocess.Popen(["open", str(item.source_path.parent)])
            return
        # 如果双击的是输出路径列，则打开输出文件所在目录。
        if column_index == 6:
            subprocess.Popen(["open", str(item.output_path.parent)])

    # 定义当前任务项显示更新函数。
    def update_current_item_display(self, item: ConversionItem, status_text: str) -> None:
        # 更新状态文本。
        self.current_file_status_label.setText(status_text)
        # 更新当前文件名。
        self.current_file_name_value.setText(item.source_path.name)
        # 更新当前原路径。
        self.current_source_value.setText(str(item.source_path.parent))
        # 更新当前输出路径。
        self.current_output_value.setText(str(item.output_path))
        # 更新当前时长。
        self.current_duration_value.setText(format_seconds(item.duration_seconds))

    # 定义输出目录选择函数。
    def choose_output_dir(self) -> None:
        # 弹出目录选择框。
        directory = QFileDialog.getExistingDirectory(
            self,
            "选择输出目录",
            self.output_dir_edit.text(),
        )
        # 如果用户选择了目录，则更新路径并重建输出映射。
        if directory:
            self.output_dir_edit.setText(directory)
            # 用户主动修改输出目录后，取消初始单文件固定输出路径。
            self.explicit_output_file = None
            if self.source_targets:
                self.set_items_from_paths(self.source_targets)

    # 定义导入路径函数。
    def choose_import_paths(self) -> None:
        # 弹出目录选择框。
        directory = QFileDialog.getExistingDirectory(
            self,
            "选择导入目录",
            str(DEFAULT_OUTPUT_DIR),
        )
        # 如果用户选择了目录，则按目录导入。
        if directory:
            self.set_items_from_paths([Path(directory)])
            self.append_log(f"已导入目录：{directory}")

    # 定义日志目录选择函数。
    def choose_log_dir(self) -> None:
        # 弹出目录选择框。
        directory = QFileDialog.getExistingDirectory(
            self,
            "选择日志目录",
            self.log_dir_edit.text(),
        )
        # 如果用户选择了目录，则更新路径。
        if directory:
            self.log_dir_edit.setText(directory)
            self.refresh_mapping_text()

    # 定义自动化计划启动函数。
    def start_automation_plan(self) -> None:
        # 如果自动化计划已经启动过，则直接返回。
        if self.automation_started:
            return
        # 如果没有自动化步骤，则直接返回。
        if not self.automation_plan.get("steps"):
            return
        # 标记自动化计划已经启动。
        self.automation_started = True
        # 打开执行中提示。
        self.set_automation_running_indicator(True)
        # 写入自动化开始标题头。
        self.append_log("=== 我正在操作 ===")
        # 写入自动化开始日志。
        self.append_log("[我] 我已经开始自动操作界面，接下来会按步骤完成设置、导入和启动转换。")
        # 执行第一个自动化步骤。
        self.run_automation_step(0)

    # 定义自动化步骤状态显示函数。
    def show_automation_status(self, message: str) -> None:
        # 仅在实时日志中记录自动化操作旁白，不打扰人工操作区域。
        self.append_log(f"[我] {message}")

    # 定义自动化执行状态显示函数。
    def set_automation_running_indicator(self, is_running: bool) -> None:
        # 如果正在执行，则显示执行中提示。
        if is_running:
            self.log_status_index = 0
            self.log_status_label.setText(self.build_log_status_html())
            self.log_status_label.show()
            if not self.log_status_timer.isActive():
                self.log_status_timer.start(240)
            return
        # 否则清空提示。
        self.log_status_label.setText("")
        self.log_status_label.hide()
        self.log_status_timer.stop()

    # 定义执行状态文本构造函数。
    def build_log_status_html(self) -> str:
        # 读取基础文案。
        text = self.log_status_base_text
        # 如果文案为空，则直接返回空字符串。
        if not text:
            return ""
        # 限制高亮索引范围。
        highlight_index = self.log_status_index % len(text)
        # 初始化字符片段列表。
        parts: list[str] = []
        # 逐字符拼装高亮 HTML。
        for index, character in enumerate(text):
            if index == highlight_index:
                parts.append(f'<span style="color:#f59e0b;font-weight:600;">{character}</span>')
            else:
                parts.append(f'<span style="color:#8a6f00;font-weight:600;">{character}</span>')
        # 根据当前索引切换灯泡明暗效果。
        bulb_symbol = "💡" if (self.log_status_index % 2 == 0) else "🔆"
        bulb_color = "#f59e0b" if (self.log_status_index % 2 == 0) else "#fde68a"
        # 返回完整 HTML。
        return (
            f'<span style="color:{bulb_color};font-size:14px;font-weight:800;">{bulb_symbol}</span> '
            + "".join(parts)
        )

    # 定义执行状态动画推进函数。
    def advance_log_status_indicator(self) -> None:
        # 如果当前未显示，则不刷新。
        if not self.log_status_label.isVisible():
            return
        # 推进动画帧索引。
        self.log_status_index = (self.log_status_index + 1) % len(self.log_status_base_text)
        # 更新标签文案。
        self.log_status_label.setText(self.build_log_status_html())

    # 定义界面控件高亮脉冲函数。
    def pulse_widget(self, widget: QWidget, duration_ms: int = 700) -> None:
        # 给控件打上自动化高亮标记。
        widget.setProperty("automationPulse", True)
        # 重新抛光样式，让高亮立即生效。
        widget.style().unpolish(widget)
        widget.style().polish(widget)
        widget.update()

        # 定义高亮结束函数。
        def clear_pulse() -> None:
            # 清理高亮标记。
            widget.setProperty("automationPulse", False)
            # 恢复正常样式。
            widget.style().unpolish(widget)
            widget.style().polish(widget)
            widget.update()

        # 定时结束高亮。
        QTimer.singleShot(duration_ms, clear_pulse)

    # 定义按钮闪动函数。
    def flash_button(self, button: QPushButton, callback=None) -> None:
        # 先做一轮高亮，增强用户可见反馈。
        self.pulse_widget(button, 700)
        # 先让按钮进入按下状态。
        button.setDown(True)
        # 短暂延迟后恢复，并在需要时继续回调。
        def finish_flash() -> None:
            button.setDown(False)
            if callback is not None:
                callback()
        QTimer.singleShot(140, finish_flash)

    # 定义输入框可视化输入函数。
    def animate_line_edit_input(self, edit: QLineEdit, value: str, callback=None) -> None:
        # 给输入框做一轮高亮，提示正在操作该控件。
        self.pulse_widget(edit, 900)
        # 聚焦输入框，便于用户看到当前正在操作哪个控件。
        edit.setFocus()
        # 全选旧内容。
        edit.selectAll()
        # 先清空内容，形成可见变化。
        edit.clear()
        # 初始化当前输入位置。
        current_index = 0

        # 定义逐步写入函数。
        def write_next_chunk() -> None:
            nonlocal current_index
            # 如果已经全部写入，则继续回调。
            if current_index >= len(value):
                if callback is not None:
                    callback()
                return
            # 每次写入一小段，便于用户看到界面同步变化。
            next_index = min(current_index + 6, len(value))
            edit.setText(value[:next_index])
            current_index = next_index
            # 继续下一段写入。
            QTimer.singleShot(45, write_next_chunk)

        # 启动逐步写入。
        QTimer.singleShot(60, write_next_chunk)

    # 定义自动化单步执行函数。
    def run_automation_step(self, step_index: int) -> None:
        # 读取自动化步骤列表。
        steps = self.automation_plan.get("steps", [])
        # 如果步骤索引已越界，则记录完成日志并返回。
        if step_index >= len(steps):
            self.append_log("[我] 我已经完成界面操作，接下来开始批量转换。")
            return

        # 读取当前步骤。
        step = steps[step_index]
        # 读取动作名称。
        action = step.get("action", "")
        # 读取步骤延迟。
        delay_ms = int(step.get("delay_ms", 300))

        try:
            # 如果动作是设置输出目录，则更新输出目录输入框。
            if action == "set_output_dir":
                # 读取目标目录。
                output_dir = str(step.get("value", "")).strip()
                # 显示自动化状态。
                self.show_automation_status(f"我正在设置输出目录，接下来会继续设置日志目录：{output_dir}")
                # 定义输入完成后的回调。
                def finish_set_output_dir() -> None:
                    # 人类方式走目录选择逻辑，因此取消显式输出文件锁定。
                    self.explicit_output_file = None
                    # 如果已有来源路径，则按新输出目录重建任务列表，并等待加载完成再继续。
                    if self.source_targets:
                        self.pending_automation_step_index = step_index + 1
                        self.set_items_from_paths(self.source_targets)
                        return
                    QTimer.singleShot(delay_ms, lambda: self.run_automation_step(step_index + 1))
                # 以可视化方式输入路径。
                self.animate_line_edit_input(self.output_dir_edit, output_dir, finish_set_output_dir)
                return
            # 如果动作是设置日志目录，则更新日志目录输入框。
            elif action == "set_log_dir":
                # 读取目标目录。
                log_dir = str(step.get("value", "")).strip()
                # 显示自动化状态。
                self.show_automation_status(f"我已经设置好输出目录，接下来设置日志目录：{log_dir}")
                # 可视化输入路径后继续下一步。
                self.animate_line_edit_input(
                    self.log_dir_edit,
                    log_dir,
                    lambda: QTimer.singleShot(delay_ms, lambda: self.run_automation_step(step_index + 1)),
                )
                return
            # 如果动作是设置窗口置顶状态，则切换开关。
            elif action == "set_always_on_top":
                # 读取目标开关状态。
                is_enabled = bool(step.get("value", True))
                # 显示自动化状态。
                self.show_automation_status(f"我正在设置始终置顶，接下来继续执行后续操作：{is_enabled}")
                # 让开关切换到目标状态。
                self.always_on_top_checkbox.setChecked(is_enabled)
                QTimer.singleShot(delay_ms, lambda: self.run_automation_step(step_index + 1))
                return
            # 如果动作是导入路径，则按路径重建任务列表。
            elif action == "import_paths":
                # 读取目标路径列表。
                path_values = step.get("value", [])
                # 转成 Path 对象列表。
                target_paths = [Path(path_value) for path_value in path_values]
                # 显示自动化状态。
                self.show_automation_status(
                    f"我已经设置好目录，接下来导入素材路径：{', '.join(str(path) for path in target_paths)}"
                )
                # 先做按钮按下反馈，再开始后台加载。
                def finish_import() -> None:
                    self.pending_automation_step_index = step_index + 1
                    self.set_items_from_paths(target_paths)
                self.flash_button(self.import_button, finish_import)
                return
            # 如果动作是点击开始转换，则模拟按钮点击。
            elif action == "click_start_conversion":
                # 显示自动化状态。
                self.show_automation_status("我已经完成前面步骤，接下来开始完成界面操作。")
                # 通过动画点击触发按钮逻辑，保持界面可见反馈。
                self.start_button.animateClick()
                QTimer.singleShot(delay_ms, lambda: self.run_automation_step(step_index + 1))
                return
            # 如果动作未知，则写入提示日志。
            else:
                # 写入未知动作日志。
                self.append_log(f"[我] 自动化跳过未知动作：{action}")
        except Exception as error:
            self.set_automation_running_indicator(False)
            # 写入自动化步骤错误日志。
            self.append_log(f"[我] 自动化步骤失败：{action} -> {error}")

        # 计划下一步自动化执行。
        QTimer.singleShot(delay_ms, lambda: self.run_automation_step(step_index + 1))

    # 定义应用窗口置顶状态函数。
    def apply_window_pin(self, is_enabled: bool) -> None:
        # 保存置顶状态。
        self.always_on_top = is_enabled
        # 应用置顶标记。
        self.setWindowFlag(Qt.WindowStaysOnTopHint, is_enabled)
        # 重新显示窗口以生效。
        self.show()
        # 激活窗口。
        self.activateWindow()
        # 请求前台。
        self.raise_()
        # 如果窗口取消置顶，则同步释放防休眠。
        if not is_enabled:
            self.stop_caffeinate()

    # 定义启动防休眠函数。
    def start_caffeinate(self) -> None:
        # 如果当前未开启置顶，则不启动防休眠。
        if not self.always_on_top:
            return
        # 如果已经存在防休眠进程，则不重复启动。
        if self.caffeinate_process is not None and self.caffeinate_process.poll() is None:
            return
        try:
            # 启动 macOS 防休眠与防锁屏进程。
            self.caffeinate_process = subprocess.Popen(["caffeinate", "-dimsu"])
            # 写入提示日志。
            self.append_log("已启用防休眠与防锁屏，任务执行期间窗口保持置顶。")
        except Exception as error:
            # 记录启动失败，但不阻断主流程。
            self.append_log(f"启动防休眠失败：{error}")

    # 定义停止防休眠函数。
    def stop_caffeinate(self) -> None:
        # 如果不存在进程，则直接返回。
        if self.caffeinate_process is None:
            return
        # 如果进程仍在运行，则终止。
        if self.caffeinate_process.poll() is None:
            try:
                self.caffeinate_process.terminate()
                self.caffeinate_process.wait(timeout=2)
            except Exception:
                try:
                    self.caffeinate_process.kill()
                except Exception:
                    pass
        # 清空引用。
        self.caffeinate_process = None

    # 定义打开输出目录函数。
    def open_output_folder(self) -> None:
        # 读取输出目录。
        output_dir = Path(self.output_dir_edit.text()).expanduser()
        # 如果目录不存在，则提示。
        if not output_dir.exists():
            QMessageBox.information(self, "提示", "输出目录当前不存在。")
            return
        # 打开目录。
        subprocess.Popen(["open", str(output_dir)])

    # 定义清空列表函数。
    def clear_items(self) -> None:
        # 如果后台任务正在执行，则不允许清空。
        if self.worker_thread is not None:
            QMessageBox.information(self, "提示", "转换进行中，暂时不能清空列表。")
            return
        # 清空任务列表。
        self.items = []
        # 清空来源路径记录。
        self.source_targets = []
        # 刷新界面。
        self.refresh_table()
        self.refresh_summary()
        self.refresh_mapping_text()
        # 清空进度显示。
        self.current_progress_bar.setValue(0)
        self.total_progress_bar.setValue(0)
        self.current_progress_label.setText("0%")
        self.total_progress_label.setText("0%")
        self.pause_button.setEnabled(False)
        self.update_start_button_text()

    # 定义日志文件路径生成函数。
    def build_log_file_path(self) -> Path:
        # 如果存在显式日志文件且只有一个任务，则优先使用显式日志文件。
        if self.explicit_log_file is not None and len(self.items) <= 1:
            return self.explicit_log_file
        # 读取日志目录。
        log_dir = Path(self.log_dir_edit.text()).expanduser()
        # 确保日志目录存在。
        log_dir.mkdir(parents=True, exist_ok=True)
        # 返回批量日志文件路径。
        return log_dir / get_mode_config(self.mode_id)["log_file_name"]

    # 定义启动转换函数。
    def start_conversion(self) -> None:
        # 如果已有后台任务，则直接返回。
        if self.worker_thread is not None:
            return
        # 如果当前正在暂停收尾，则提示稍候。
        if self.pause_requested:
            QMessageBox.information(self, "提示", "正在暂停当前任务，请等待状态切换为“已暂停，可继续转换”。")
            return
        # 如果没有任务，则提示。
        if not self.items:
            QMessageBox.information(self, "提示", "当前没有可转换文件。")
            return
        # 收集本轮需要继续执行的任务。
        pending_items = [item for item in self.items if item.status_text != "完成"]
        # 如果没有未完成任务，则提示。
        if not pending_items:
            QMessageBox.information(self, "提示", "当前任务都已完成，可导入新文件后重新开始。")
            self.update_start_button_text()
            return

        # 读取输出目录与日志目录。
        output_dir = Path(self.output_dir_edit.text()).expanduser()
        log_dir = Path(self.log_dir_edit.text()).expanduser()
        # 确保目录存在。
        output_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)

        # 生成批量日志文件路径。
        log_file = self.build_log_file_path()
        # 重置进度显示。
        self.current_progress_bar.setValue(0)
        self.total_progress_bar.setValue(0)
        self.current_progress_label.setText("0%")
        self.total_progress_label.setText("0%")
        self.remaining_value.setText(
            format_seconds(sum(item.estimated_conversion_seconds for item in pending_items))
        )
        # 记录本轮是否属于继续执行。
        is_resume_run = any(item.status_text in {"已暂停", "失败", "转换中"} for item in pending_items)
        # 预先更新当前任务卡片到首个文件。
        if pending_items:
            if is_resume_run:
                self.update_current_item_display(pending_items[0], "继续执行未完成任务。")
            else:
                self.update_current_item_display(pending_items[0], "准备开始转换。")
        # 如果本轮是重新开始全新任务，则保留前面的事实日志，只补一条分隔线。
        if all(item.status_text == "待转换" for item in self.items):
            existing_log = self.log_text.toPlainText().strip()
            if existing_log:
                self.append_log("")
                self.append_log("----- 开始新的批量转换任务 -----")
        # 写入启动日志。
        if is_resume_run:
            self.append_log(f"继续转换未完成任务，共 {len(pending_items)} 个文件。")
        else:
            self.append_log(f"开始创建批量转换任务，共 {len(pending_items)} 个文件。")
        self.append_log(f"日志文件：{log_file}")
        # 清除暂停态标记。
        self.pause_requested = False
        self.is_paused_state = False
        # 进入运行中按钮状态。
        self.sync_action_buttons("running")
        # 只要批量转换还在执行，就持续显示等待提示。
        self.set_automation_running_indicator(True)
        # 如果置顶开启，则在任务执行中保持防休眠与防锁屏。
        self.start_caffeinate()
        # 禁用清空按钮。
        self.clear_button.setEnabled(False)

        # 创建线程对象。
        self.worker_thread = QThread(self)
        # 创建工作对象。
        self.worker = BatchConvertWorker(self.items, str(log_file), self.mode_id, max_workers=3)
        # 将工作对象移动到线程。
        self.worker.moveToThread(self.worker_thread)
        # 线程启动时执行工作函数。
        self.worker_thread.started.connect(self.worker.run)
        # 绑定信号。
        self.worker.log_signal.connect(self.on_log_message)
        self.worker.current_status_signal.connect(self.on_current_status)
        self.worker.current_progress_signal.connect(self.on_current_progress)
        self.worker.overall_progress_signal.connect(self.on_overall_progress)
        self.worker.row_status_signal.connect(self.on_row_status)
        self.worker.done_signal.connect(self.on_done)
        self.worker.error_signal.connect(self.on_error)
        # 启动线程。
        self.worker_thread.start()

    # 定义暂停转换函数。
    def pause_conversion(self) -> None:
        # 如果当前没有运行中的 worker，则直接返回。
        if self.worker is None or self.worker_thread is None:
            return
        # 如果已经在暂停中，则不重复处理。
        if self.pause_requested:
            return
        # 标记进入暂停流程。
        self.pause_requested = True
        # 写入暂停日志。
        self.append_log("收到暂停请求，正在停止当前转换任务。")
        # 更新状态文本。
        self.current_file_status_label.setText("正在暂停，请等待当前任务收尾。")
        # 切换到暂停中状态，两个按钮都灰掉并显示提示框。
        self.sync_action_buttons("pausing")
        # 请求 worker 停止。
        self.worker.request_stop()

    # 定义日志槽函数。
    def on_log_message(self, message: str) -> None:
        # 追加日志。
        self.append_log(message)

    # 定义当前文件状态槽函数。
    def on_current_status(self, message: str) -> None:
        # 更新状态显示。
        self.current_file_status_label.setText(message)

    # 定义当前文件进度槽函数。
    def on_current_progress(
        self,
        percent: int,
        current_seconds: float,
        duration_seconds: float,
    ) -> None:
        # 更新当前进度条。
        self.current_progress_bar.setValue(percent)
        # 更新当前进度文本。
        self.current_progress_label.setText(
            f"{percent}% ({current_seconds:.2f}s / {duration_seconds:.2f}s)"
        )

    # 定义总体进度槽函数。
    def on_overall_progress(self, percent: int, remaining_seconds: float) -> None:
        # 更新总进度条。
        self.total_progress_bar.setValue(percent)
        # 更新总进度文本。
        self.total_progress_label.setText(f"{percent}%")
        # 更新剩余时长。
        self.remaining_value.setText(format_seconds(remaining_seconds))

    # 定义行状态更新槽函数。
    def on_row_status(self, row_index: int, status_text: str) -> None:
        # 如果索引越界，则直接返回。
        if row_index >= len(self.items):
            return
        # 更新内存中的状态。
        self.items[row_index].status_text = status_text
        # 更新当前任务详情卡片。
        self.update_current_item_display(self.items[row_index], status_text)
        # 更新表格状态单元格。
        self.file_table.setItem(row_index, 0, QTableWidgetItem(status_text))

    # 定义完成槽函数。
    def on_done(self, result: dict) -> None:
        # 保存最近一次结果。
        self.last_result = result
        # 写入日志文件。
        self.write_log_file(result)
        # 读取本轮运行状态。
        run_state = result.get("run_state", "completed")
        # 清理后台线程。
        self.cleanup_worker()
        # 如果是暂停结束，则更新为可继续状态。
        if run_state == "paused":
            # 将所有未完成任务统一标记为已暂停，确保继续时状态清晰。
            for item in self.items:
                if item.status_text != "完成":
                    item.status_text = "已暂停"
            # 记录当前已进入暂停可继续状态。
            self.pause_requested = False
            self.is_paused_state = True
            self.current_file_status_label.setText("已暂停，可点击继续转换。")
            self.append_log("批量转换已暂停。")
            self.refresh_table()
            self.refresh_summary()
            self.sync_action_buttons("paused")
            self.set_automation_running_indicator(False)
            self.stop_caffeinate()
            return
        # 更新完成状态。
        self.current_progress_bar.setValue(100)
        self.total_progress_bar.setValue(100)
        self.current_progress_label.setText("100%")
        self.total_progress_label.setText("100%")
        self.remaining_value.setText("00:00")
        self.current_file_status_label.setText("全部转换完成")
        self.append_log("全部转换完成。")
        # 完成后退出暂停态。
        self.pause_requested = False
        self.is_paused_state = False
        # 刷新统计和按钮状态。
        self.refresh_table()
        self.refresh_summary()
        self.sync_action_buttons("idle")
        self.set_automation_running_indicator(False)
        self.stop_caffeinate()
        # 弹出完成提示。
        QMessageBox.information(
            self,
            "完成",
            "批量转换完成。\n\n"
            f"日志文件：\n{self.build_log_file_path()}\n\n"
            "把这个日志路径发给我，我就可以继续帮你检查结果。",
        )

    # 定义错误槽函数。
    def on_error(self, error_text: str) -> None:
        # 记录错误日志。
        self.append_log(error_text)
        # 更新状态。
        self.current_file_status_label.setText("转换失败")
        # 错误后退出暂停态。
        self.pause_requested = False
        self.is_paused_state = False
        # 清理线程。
        self.cleanup_worker()
        # 刷新界面状态。
        self.refresh_table()
        self.refresh_summary()
        self.sync_action_buttons("idle")
        self.set_automation_running_indicator(False)
        self.stop_caffeinate()
        # 弹出错误提示。
        QMessageBox.critical(self, "错误", "批量转换失败，详细信息已写入日志。")

    # 定义线程清理函数。
    def cleanup_worker(self) -> None:
        # 恢复清空按钮状态。
        self.clear_button.setEnabled(True)
        # 如果当前不在暂停流程，则默认切回空闲按钮状态。
        if not self.pause_requested:
            self.sync_action_buttons("idle")
        # 清理工作对象。
        if self.worker is not None:
            self.worker.deleteLater()
            self.worker = None
        # 清理线程。
        if self.worker_thread is not None:
            self.worker_thread.quit()
            self.worker_thread.wait()
            self.worker_thread.deleteLater()
            self.worker_thread = None
        # 如果当前处于暂停流程，清理线程后立刻进入已暂停可继续状态。
        if self.pause_requested:
            self.sync_action_buttons("paused")

    # 定义日志文件写入函数。
    def write_log_file(self, result: dict) -> None:
        # 生成日志路径。
        log_path = self.build_log_file_path()
        # 确保目录存在。
        log_path.parent.mkdir(parents=True, exist_ok=True)
        # 组织摘要内容。
        summary_lines = [
            "=== 批量转换结果摘要 ===",
            f"任务数量：{len(self.items)}",
            f"输出目录：{self.output_dir_edit.text()}",
            f"日志目录：{self.log_dir_edit.text()}",
            f"总预计转换时长：{format_seconds(result.get('total_duration_seconds', 0.0))}",
            "",
            "=== 过程日志 ===",
            self.log_text.toPlainText().strip(),
        ]
        # 写入日志文件。
        log_path.write_text("\n".join(summary_lines), encoding="utf-8")


# 定义程序主入口函数。
def main(
    input_file: str | None = None,
    output_file: str | None = None,
    log_file: str | None = None,
    conversion_mode: str = "vob_to_mp4",
    always_on_top: bool = False,
    automation_plan: dict | None = None,
) -> None:
    # 创建应用实例。
    app = QApplication(sys.argv)
    # 创建窗口对象。
    window = VideoConvertWindow(
        input_file=input_file,
        output_file=output_file,
        log_file=log_file,
        conversion_mode=conversion_mode,
        always_on_top=always_on_top,
        automation_plan=automation_plan,
    )
    # 显示窗口。
    window.show()
    # 读取窗口所在屏幕。
    screen = window.screen()
    # 如果存在可用屏幕，则将窗口移动到屏幕中央。
    if screen is not None:
        # 读取可用显示区域。
        available_geometry = screen.availableGeometry()
        # 计算窗口左上角坐标，使窗口居中显示。
        target_x = available_geometry.x() + (available_geometry.width() - window.width()) // 2
        target_y = available_geometry.y() + (available_geometry.height() - window.height()) // 2
        # 移动窗口到目标位置。
        window.move(target_x, target_y)
    # 激活窗口。
    window.activateWindow()
    # 进入事件循环。
    raise SystemExit(app.exec())


# 定义应用启动入口。
def launch(
    input_file: str | None = None,
    output_file: str | None = None,
    log_file: str | None = None,
    conversion_mode: str = "vob_to_mp4",
    always_on_top: bool = False,
    automation_plan: dict | None = None,
) -> dict:
    # 调用主函数启动图形界面。
    main(
        input_file=input_file,
        output_file=output_file,
        log_file=log_file,
        conversion_mode=conversion_mode,
        always_on_top=always_on_top,
        automation_plan=automation_plan,
    )
    # 返回启动结果。
    return {
        "status": "launched_app",
        "app": "vob_to_mp4_gui_pyside6",
        "input_file": input_file,
        "output_file": output_file,
        "log_file": log_file,
        "conversion_mode": conversion_mode,
        "always_on_top": always_on_top,
        "automation_plan": automation_plan,
    }


# 如果当前文件作为脚本运行，则处理命令行上下文。
if __name__ == "__main__":
    # 初始化上下文字典。
    context = {}
    # 如果带了 JSON 参数，则解析上下文。
    if len(sys.argv) >= 2:
        context = json.loads(sys.argv[1])
    # 启动主界面。
    main(
        input_file=context.get("input_file"),
        output_file=context.get("output_file"),
        log_file=context.get("log_file"),
        conversion_mode=context.get("conversion_mode", "vob_to_mp4"),
        always_on_top=context.get("always_on_top", False),
        automation_plan=context.get("automation_plan"),
    )
