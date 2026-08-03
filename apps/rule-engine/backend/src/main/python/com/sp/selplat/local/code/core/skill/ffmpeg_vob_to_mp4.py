"""VOB 转 MP4 技能。

功能：
用于调用 ffmpeg 将 VOB 视频文件转换为更适合播放的 MP4 文件。

作用：
为 Python 技能库提供视频转码基础能力，并在转码时输出清晰的控制台提示与实时进度。

适用场景：
- 将 DVD 导出的 VOB 文件转为 MP4
- 自动检测并裁切上下黑边
- 在转码前后输出阶段提示、实时进度与结果检查信息
"""

# 导入 json，用于解析 ffprobe 返回的元数据。
import json
# 导入 re，用于从 cropdetect 日志中提取裁切参数。
import re
# 导入 subprocess，用于执行 ffmpeg 与 ffprobe 命令。
import subprocess
# 导入 tempfile，用于创建 ffmpeg 进度文件。
import tempfile
# 导入 time，用于轮询进度与超时控制。
import time

# 导入 Path，用于按规范处理文件路径。
from pathlib import Path
# 导入类型工具，用于描述回调参数。
from typing import Callable


# 技能唯一标识，用于在注册表中定位当前技能。
SKILL_ID = "ffmpeg_vob_to_mp4"
# 技能名称，便于人类和 AI 理解用途。
SKILL_NAME = "VOB 转 MP4"
# 技能说明，描述当前技能负责的动作。
SKILL_DESC = "调用 ffmpeg 对 VOB 执行去隔行、裁黑边、高质量缩放并输出 MP4。"

# 技能必需输入，表示调用前必须提供的参数。
REQUIRED_INPUTS = ["input_file", "output_file"]
# 技能输出字段，表示调用完成后返回的数据键。
OUTPUTS = [
    "returncode",
    "stdout",
    "stderr",
    "output_file",
    "duration_seconds",
    "crop_filter",
    "video_check",
]


# 定义消息回调类型，便于控制台和 GUI 共享输出逻辑。
MessageHandler = Callable[[str], None]
# 定义进度回调类型，便于将百分比推送给 GUI。
ProgressHandler = Callable[[int, float, float], None]
# 定义停止检查回调类型，用于支持暂停当前 ffmpeg 任务。
StopHandler = Callable[[], bool]

# 从迁移后的深层包向上识别工程根，进度缓存不得回退到系统临时目录。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# ffmpeg 短期进度文件统一归属当前工程 OPTION/temp，任务结束后仍由调用方删除。
FFMPEG_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp" / "ffmpeg_progress"


# 定义默认消息处理函数。
def default_message_handler(message: str) -> None:
    # 输出带前缀的阶段提示，便于在控制台快速识别当前步骤。
    print(f"[ffmpeg_vob_to_mp4] {message}", flush=True)


# 定义统一消息发送函数。
def emit_message(message_handler: MessageHandler | None, message: str) -> None:
    # 如果外部没有传入消息处理函数，则使用默认控制台输出。
    if message_handler is None:
        # 调用默认控制台输出函数。
        default_message_handler(message)
        # 结束当前函数。
        return
    # 如果有自定义消息处理函数，则交给外部处理。
    message_handler(message)


# 定义读取 ffprobe JSON 元数据的函数。
def probe_media_metadata(input_path: Path) -> dict:
    # 组织 ffprobe 命令，读取容器和音视频码率、时长信息。
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration,bit_rate:stream=codec_type,bit_rate,duration",
        "-of",
        "json",
        str(input_path),
    ]
    # 执行探测命令。
    process_result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    # 如果探测失败，则返回空字典。
    if process_result.returncode != 0:
        return {}
    # 解析 JSON 并返回。
    return json.loads(process_result.stdout or "{}")


# 定义安全浮点解析函数。
def safe_float(value: object) -> float:
    # 如果值为空，则返回 0。
    if value in {None, "", "N/A"}:
        return 0.0
    # 尝试转为浮点数。
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# 定义逐帧统计视频时长的函数。
def get_frame_based_duration_seconds(input_path: Path) -> float:
    # 组织逐帧统计命令。
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-count_frames",
        "-show_entries",
        "stream=nb_read_frames,r_frame_rate",
        "-of",
        "default=noprint_wrappers=1",
        str(input_path),
    ]
    # 执行命令。
    process_result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    # 如果命令失败，则返回 0。
    if process_result.returncode != 0:
        return 0.0
    # 初始化帧数。
    frame_count = 0
    # 初始化帧率分子分母。
    fps_numerator = 0
    fps_denominator = 1
    # 逐行解析输出。
    for line in process_result.stdout.splitlines():
        # 解析帧数。
        if line.startswith("nb_read_frames="):
            frame_count = int(line.split("=", 1)[1] or "0")
        # 解析帧率。
        if line.startswith("r_frame_rate="):
            rate_text = line.split("=", 1)[1]
            if "/" in rate_text:
                numerator_text, denominator_text = rate_text.split("/", 1)
                fps_numerator = int(numerator_text or "0")
                fps_denominator = int(denominator_text or "1")
    # 如果数据不完整，则返回 0。
    if frame_count <= 0 or fps_numerator <= 0 or fps_denominator <= 0:
        return 0.0
    # 返回逐帧估算时长。
    return frame_count * fps_denominator / fps_numerator


# 定义获取视频总时长的函数。
def get_duration_seconds(input_path: Path) -> float:
    # 如果文件不存在，则直接返回 0。
    if not input_path.exists():
        return 0.0
    # 读取 ffprobe 元数据。
    metadata = probe_media_metadata(input_path)
    # 读取容器级信息。
    format_info = metadata.get("format", {})
    # 读取流信息列表。
    stream_list = metadata.get("streams", [])
    # 读取容器时长。
    container_duration_seconds = safe_float(format_info.get("duration"))
    # 读取容器码率。
    format_bit_rate = safe_float(format_info.get("bit_rate"))
    # 初始化媒体流总码率。
    stream_bit_rate_sum = 0.0
    # 初始化媒体流时长候选。
    stream_duration_candidates: list[float] = []
    # 逐个读取音视频流。
    for stream in stream_list:
        # 只统计音视频流。
        if stream.get("codec_type") not in {"video", "audio"}:
            continue
        # 累加媒体流码率。
        stream_bit_rate_sum += safe_float(stream.get("bit_rate"))
        # 记录媒体流时长候选。
        stream_duration_value = safe_float(stream.get("duration"))
        if stream_duration_value > 0:
            stream_duration_candidates.append(stream_duration_value)
    # 如果流级别能读到时长，则取最大值作为候选。
    stream_duration_seconds = max(stream_duration_candidates, default=0.0)
    # 优先使用媒体流总码率，没有则退回容器码率。
    effective_bit_rate = stream_bit_rate_sum or format_bit_rate
    # 初始化按体积反推的时长。
    file_size_duration_seconds = 0.0
    # 如果码率有效，则按体积和码率估算时长。
    if effective_bit_rate > 0:
        file_size_duration_seconds = input_path.stat().st_size * 8 / effective_bit_rate
    # 初始化候选时长列表。
    candidate_durations = [
        value
        for value in [container_duration_seconds, stream_duration_seconds, file_size_duration_seconds]
        if value > 0
    ]
    # 如果没有任何候选，则返回 0。
    if not candidate_durations:
        return 0.0
    # 默认先使用容器时长。
    estimated_duration_seconds = container_duration_seconds or max(candidate_durations)
    # 如果容器时长离谱偏大，则优先采用更可信的流级/体积估算。
    if file_size_duration_seconds > 0 and (
        estimated_duration_seconds > file_size_duration_seconds * 3
        or estimated_duration_seconds > 6 * 3600
    ):
        estimated_duration_seconds = file_size_duration_seconds
    # 如果流级时长明显比容器时长更可信，则优先采用流级时长。
    if stream_duration_seconds > 0 and (
        estimated_duration_seconds <= 0
        or stream_duration_seconds < estimated_duration_seconds * 0.75
        or stream_duration_seconds > estimated_duration_seconds * 1.25
    ):
        # 在流级和体积估算都存在时，取两者更接近的一项。
        if file_size_duration_seconds > 0:
            if abs(stream_duration_seconds - file_size_duration_seconds) < abs(estimated_duration_seconds - file_size_duration_seconds):
                estimated_duration_seconds = stream_duration_seconds
        else:
            estimated_duration_seconds = stream_duration_seconds
    # 如果体积估算仍然比当前结果更可信，则再收敛一次。
    if file_size_duration_seconds > 0 and (
        estimated_duration_seconds <= 0
        or estimated_duration_seconds > file_size_duration_seconds * 1.8
    ):
        estimated_duration_seconds = file_size_duration_seconds
    # 如果快估算结果与体积估算差异明显，则进一步做逐帧校正。
    if (
        file_size_duration_seconds > 0
        and estimated_duration_seconds > 0
        and (
            file_size_duration_seconds > estimated_duration_seconds * 2.2
            or estimated_duration_seconds > file_size_duration_seconds * 2.2
        )
    ):
        frame_based_duration_seconds = get_frame_based_duration_seconds(input_path)
        # 如果逐帧统计成功，则优先采用逐帧结果。
        if frame_based_duration_seconds > 0:
            estimated_duration_seconds = frame_based_duration_seconds
    # 返回估算结果。
    return estimated_duration_seconds


# 定义自动检测裁切参数的函数。
def detect_crop_filter(
    input_path: Path,
    message_handler: MessageHandler | None = None,
) -> str:
    # 输出开始检测黑边的提示。
    emit_message(message_handler, "开始检测黑边并分析是否需要裁切。")
    # 组织 cropdetect 命令，使用前 120 帧估算稳定裁切参数。
    command = [
        "ffmpeg",
        "-hide_banner",
        "-i",
        str(input_path),
        "-vf",
        "cropdetect=24:16:0",
        "-frames:v",
        "120",
        "-an",
        "-f",
        "null",
        "-",
    ]
    # 执行命令并读取 stderr 日志。
    process_result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    # 如果检测命令失败，则返回空字符串，表示不裁切。
    if process_result.returncode != 0:
        # 输出检测失败提示。
        emit_message(message_handler, "黑边检测失败，回退为不裁切模式。")
        # 返回空字符串。
        return ""
    # 在日志中查找所有 crop=... 结果。
    matches = re.findall(r"crop=\d+:\d+:\d+:\d+", process_result.stderr)
    # 如果没有检测到裁切结果，则返回空字符串。
    if not matches:
        # 输出未检测到裁切结果的提示。
        emit_message(message_handler, "未检测到稳定黑边，保持原始画面尺寸。")
        # 返回空字符串。
        return ""
    # 取最后一个稳定检测结果作为裁切参数。
    crop_filter = matches[-1]
    # 输出最终采用的裁切参数。
    emit_message(message_handler, f"检测到裁切参数：{crop_filter}")
    # 返回裁切参数。
    return crop_filter


# 定义构造视频滤镜链的函数。
def build_video_filter(crop_filter: str) -> str:
    # 初始化滤镜列表，先做去隔行。
    filters = ["yadif"]
    # 如果存在裁切参数，则追加裁切滤镜。
    if crop_filter:
        # 将 crop=... 转换为 ffmpeg 滤镜语法。
        filters.append(crop_filter)
    # 追加高质量缩放滤镜，输出 1280x720。
    filters.append("scale=1280:720:flags=lanczos")
    # 追加轻度锐化滤镜，改善转码后发糊的问题。
    filters.append("unsharp=5:5:0.8:3:3:0.4")
    # 将滤镜列表拼接成 ffmpeg 可用的滤镜链。
    return ",".join(filters)


# 定义实时打印转码进度的函数。
def run_ffmpeg_with_progress(
    input_path: Path,
    output_path: Path,
    duration_seconds: float,
    video_filter: str,
    message_handler: MessageHandler | None = None,
    progress_handler: ProgressHandler | None = None,
    stop_handler: StopHandler | None = None,
) -> tuple[int, str, str]:
    # 输出开始转码的提示。
    emit_message(message_handler, "开始执行转码，控制台将持续输出实时进度。")
    # 创建临时进度文件，避免直接读管道时卡住。
    # 首次执行时创建工程内可清理进度目录，不向源码或系统临时目录写数据。
    FFMPEG_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    # 进度文件显式绑定工程临时根，保证多工程任务不会共享系统级状态。
    with tempfile.NamedTemporaryFile(
        prefix="ffmpeg_progress_",
        suffix=".log",
        delete=False,
        dir=FFMPEG_TEMP_ROOT,
    ) as temp_file:
        # 记录临时进度文件路径。
        progress_path = Path(temp_file.name)
    # 组织 ffmpeg 转码命令。
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
    ]
    # 继续拼接剩余转码参数。
    command.extend(
        [
        "-dn",
        "-vf",
        video_filter,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        # 本地播放场景不需要 faststart，避免在收尾阶段额外重排 MP4 头导致长时间假性卡住。
        "-progress",
        str(progress_path),
        "-nostats",
        str(output_path),
        ]
    )
    # 启动 ffmpeg 进程。
    process = subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    # 初始化进度日志缓冲列表。
    stdout_lines = []
    # 初始化最近一次显示的百分比，避免刷屏过密。
    last_percent = -1
    # 记录是否已经进入收尾阶段。
    entered_finalize_stage = False
    # 初始化最近一次处理秒数。
    last_current_seconds = 0.0
    # 初始化上次进度变化时间。
    last_progress_change_time = time.time()
    # 定义收尾超时时间，避免卡在 100% 附近无限等待。
    finalize_timeout_seconds = 90

    # 循环轮询 ffmpeg 进度，直到进程真正退出。
    while True:
        # 短暂等待，避免轮询过密。
        time.sleep(0.5)
        # 如果进度文件存在，则读取当前内容。
        if progress_path.exists():
            # 读取全部进度文本。
            progress_text = progress_path.read_text(encoding="utf-8", errors="ignore")
            # 按行拆分文本。
            lines = [line.strip() for line in progress_text.splitlines() if line.strip()]
            # 更新进度日志缓冲。
            stdout_lines = lines
            # 初始化当前已处理秒数。
            current_seconds = last_current_seconds
            # 初始化是否报告结束。
            reported_end = False

            # 遍历当前全部进度行。
            for line in lines:
                # 如果命中时间行，则解析处理秒数。
                if line.startswith("out_time_ms="):
                    # 读取毫秒文本。
                    out_time_ms_text = line.split("=", 1)[1]
                    # 如果当前值可用，则解析秒数。
                    if out_time_ms_text and out_time_ms_text != "N/A":
                        current_seconds = int(out_time_ms_text) / 1_000_000
                # 如果命中结束行，则记录结束状态。
                if line == "progress=end":
                    reported_end = True

            # 如果进度有前进，则更新时间戳。
            if current_seconds > last_current_seconds:
                # 记录最近进度变化时间。
                last_progress_change_time = time.time()
                # 更新最近一次处理秒数。
                last_current_seconds = current_seconds

            # 如果总时长有效，则计算百分比。
            if duration_seconds > 0:
                # 如果已经报告结束，则允许显示到 100。
                if reported_end:
                    percent = 100
                else:
                    # 在真正结束前最多显示到 99。
                    percent = min(int(current_seconds / duration_seconds * 100), 99)
                # 如果百分比有变化，则输出一次进度。
                if percent != last_percent:
                    # 如果当前已进入结束阶段，则输出收尾提示。
                    if reported_end and not entered_finalize_stage:
                        emit_message(message_handler, "编码已到 100%，正在进行封装收尾，请等待完成提示。")
                        entered_finalize_stage = True
                    # 输出当前百分比和时间进度。
                    emit_message(
                        message_handler,
                        f"转码进度 {percent}% "
                        f"({current_seconds:.2f}s / {duration_seconds:.2f}s)",
                    )
                    # 如果外部传入了进度回调，则同步推送进度。
                    if progress_handler is not None:
                        progress_handler(percent, current_seconds, duration_seconds)
                    # 记录最近一次输出的百分比。
                    last_percent = percent

        # 检查进程是否已经退出。
        returncode = process.poll()
        # 如果进程已退出，则结束轮询。
        if returncode is not None:
            break

        # 如果外部请求停止，则主动终止当前 ffmpeg 进程。
        if stop_handler is not None and stop_handler():
            # 输出停止提示。
            emit_message(message_handler, "收到暂停请求，正在停止当前转码任务。")
            # 先尝试优雅终止 ffmpeg。
            process.terminate()
            # 等待进程退出。
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # 如果超时未退出，则强制杀掉。
                process.kill()
                process.wait()
            # 读取剩余错误输出。
            stderr_text = ""
            if process.stderr is not None:
                stderr_text = process.stderr.read()
            # 拼接进度文本。
            stdout_text = "\n".join(stdout_lines)
            # 返回中断退出码。
            return 130, stdout_text, stderr_text + "\npaused by user"

        # 如果已经进入 99% 或更高，并且长时间没有任何进展，则主动终止并报错。
        if last_percent >= 99 and time.time() - last_progress_change_time > finalize_timeout_seconds:
            # 输出超时提示。
            emit_message(message_handler, "转码在收尾阶段超时，正在终止进程并返回错误。")
            # 终止 ffmpeg。
            process.terminate()
            # 再等待一小段时间。
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # 如果还没退出，则强制杀掉。
                process.kill()
                process.wait()
            # 读取错误输出。
            stderr_text = ""
            if process.stderr is not None:
                stderr_text = process.stderr.read()
            # 拼接进度文本。
            stdout_text = "\n".join(stdout_lines)
            # 返回超时错误。
            return 124, stdout_text, stderr_text + "\nfinalize timeout"

    # 读取进程剩余错误输出。
    stderr_text = ""
    if process.stderr is not None:
        stderr_text = process.stderr.read()
    # 拼接进度文本。
    stdout_text = "\n".join(stdout_lines)
    # 返回退出码、stdout、stderr。
    return returncode, stdout_text, stderr_text


# 定义检查输出视频信息的函数。
def inspect_output_video(
    output_path: Path,
    message_handler: MessageHandler | None = None,
) -> dict:
    # 输出开始检查成品文件的提示。
    emit_message(message_handler, "开始检查输出视频参数。")
    # 如果输出文件不存在，则直接返回异常结果。
    if not output_path.exists():
        # 返回文件缺失结果。
        return {
            "exists": False,
            "issues": ["输出文件不存在"],
        }
    # 组织 ffprobe 命令，用于读取输出视频参数。
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,display_aspect_ratio,sample_aspect_ratio,field_order",
        "-of",
        "json",
        str(output_path),
    ]
    # 执行命令并捕获结果。
    process_result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    # 如果 ffprobe 失败，则返回检测失败结果。
    if process_result.returncode != 0:
        # 返回检测失败说明。
        return {
            "exists": True,
            "issues": ["输出视频参数检查失败"],
            "stderr": process_result.stderr,
        }
    # 解析 JSON 结果。
    metadata = json.loads(process_result.stdout)
    # 读取第一路视频流。
    stream = metadata.get("streams", [{}])[0]
    # 初始化问题列表。
    issues = []
    # 如果输出不是预期的 1280x720，则记录问题。
    if stream.get("width") != 1280 or stream.get("height") != 720:
        # 追加尺寸不匹配问题。
        issues.append("输出尺寸不是 1280x720")
    # 如果仍然带有隔行场序，则记录问题。
    if stream.get("field_order") not in {"progressive", "unknown"}:
        # 追加隔行未处理问题。
        issues.append("输出视频可能仍然保留隔行场序")
    # 返回检查结果。
    return {
        "exists": True,
        "width": stream.get("width"),
        "height": stream.get("height"),
        "display_aspect_ratio": stream.get("display_aspect_ratio"),
        "sample_aspect_ratio": stream.get("sample_aspect_ratio"),
        "field_order": stream.get("field_order"),
        "issues": issues,
    }


# 定义运行入口，接收输入文件和输出文件并返回转码结果。
def run(
    input_file: str,
    output_file: str,
    message_handler: MessageHandler | None = None,
    progress_handler: ProgressHandler | None = None,
    stop_handler: StopHandler | None = None,
) -> dict:
    # 将输入文件路径转换为 Path 对象。
    input_path = Path(input_file)
    # 将输出文件路径转换为 Path 对象。
    output_path = Path(output_file)
    # 输出技能启动提示。
    emit_message(
        message_handler,
        f"收到转码任务：{input_path.name} -> {output_path.name}",
    )
    # 读取输入视频总时长。
    duration_seconds = get_duration_seconds(input_path)
    # 输出时长信息。
    emit_message(message_handler, f"输入视频时长：{duration_seconds:.2f} 秒")
    # 自动检测黑边裁切参数。
    crop_filter = detect_crop_filter(input_path, message_handler=message_handler)
    # 构造最终视频滤镜链。
    video_filter = build_video_filter(crop_filter)
    # 输出最终使用的滤镜链。
    emit_message(message_handler, f"采用滤镜链：{video_filter}")
    # 执行带实时进度的 ffmpeg 转码。
    returncode, stdout_text, stderr_text = run_ffmpeg_with_progress(
        input_path,
        output_path,
        duration_seconds,
        video_filter,
        message_handler=message_handler,
        progress_handler=progress_handler,
        stop_handler=stop_handler,
    )
    # 输出转码结束提示。
    emit_message(message_handler, "转码过程结束，开始检查成品。")
    # 检查输出视频参数。
    video_check = inspect_output_video(
        output_path,
        message_handler=message_handler,
    )
    # 计算当前任务是否真正成功。
    success = returncode == 0 and not video_check.get("issues")
    # 如果 ffmpeg 退出码不为 0，则先输出失败原因。
    if returncode != 0:
        # 输出失败提示。
        emit_message(
            message_handler,
            f"ffmpeg 退出异常，退出码：{returncode}",
        )
    # 如果没有检查问题，则输出成功提示。
    if success:
        # 输出检查通过信息。
        emit_message(
            message_handler,
            "输出视频检查通过，未发现明显尺寸或隔行问题。",
        )
    else:
        # 输出检查发现的问题。
        emit_message(
            message_handler,
            f"输出视频发现问题：{video_check['issues']}",
        )
    # 仅在真正成功时输出完成提示。
    if success:
        # 输出技能完成提示。
        emit_message(
            message_handler,
            "任务完成，如仍有黑边或清晰度问题，可继续调整滤镜链。",
        )
    # 如果未成功，则输出失败总结。
    else:
        # 输出失败提示。
        emit_message(
            message_handler,
            "任务未成功完成，请检查日志、输出文件和 ffmpeg 收尾阶段。",
        )
    # 组织标准化转码结果。
    result = {
        # 返回 ffmpeg 退出码。
        "returncode": returncode,
        # 返回标准输出文本。
        "stdout": stdout_text,
        # 返回标准错误文本。
        "stderr": stderr_text,
        # 返回输出文件路径。
        "output_file": str(output_path),
        # 返回输入视频总时长。
        "duration_seconds": duration_seconds,
        # 返回本次采用的裁切参数。
        "crop_filter": crop_filter,
        # 返回输出视频检查结果。
        "video_check": video_check,
        # 返回是否成功完成。
        "success": success,
    }
    # 返回转码结果字典。
    return result
