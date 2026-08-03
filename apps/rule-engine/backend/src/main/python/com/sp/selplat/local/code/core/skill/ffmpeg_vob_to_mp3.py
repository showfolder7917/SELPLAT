"""VOB 转 MP3 技能。

功能：
用于调用 ffmpeg 将 VOB 视频中的音频提取为 MP3 文件。

作用：
为图形界面提供 VOB 到 MP3 的批量转换基础能力，并在转换时输出实时进度。
"""

import json
import subprocess
import tempfile
import time

from pathlib import Path
from typing import Callable


SKILL_ID = "ffmpeg_vob_to_mp3"
SKILL_NAME = "VOB 转 MP3"
SKILL_DESC = "调用 ffmpeg 将 VOB 中的音频提取并输出为 MP3。"

REQUIRED_INPUTS = ["input_file", "output_file"]
OUTPUTS = [
    "returncode",
    "stdout",
    "stderr",
    "output_file",
    "duration_seconds",
    "video_check",
]


MessageHandler = Callable[[str], None]
ProgressHandler = Callable[[int, float, float], None]
StopHandler = Callable[[], bool]

# 从迁移后的深层包向上识别工程根，进度缓存不得回退到系统临时目录。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# ffmpeg 短期进度文件统一归属当前工程 OPTION/temp，任务结束后仍由调用方删除。
FFMPEG_TEMP_ROOT = PROJECT_ROOT / "OPTION" / "temp" / "ffmpeg_progress"


def default_message_handler(message: str) -> None:
    print(f"[ffmpeg_vob_to_mp3] {message}", flush=True)


def emit_message(message_handler: MessageHandler | None, message: str) -> None:
    if message_handler is None:
        default_message_handler(message)
        return
    message_handler(message)


def safe_float(value: object) -> float:
    if value in {None, "", "N/A"}:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def get_duration_seconds(input_path: Path) -> float:
    if not input_path.exists():
        return 0.0
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(input_path),
    ]
    process_result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if process_result.returncode != 0:
        return 0.0
    metadata = json.loads(process_result.stdout or "{}")
    return safe_float(metadata.get("format", {}).get("duration"))


def run_ffmpeg_with_progress(
    input_path: Path,
    output_path: Path,
    duration_seconds: float,
    message_handler: MessageHandler | None = None,
    progress_handler: ProgressHandler | None = None,
    stop_handler: StopHandler | None = None,
) -> tuple[int, str, str]:
    emit_message(message_handler, "开始提取音频并输出 MP3。")
    # 首次执行时创建工程内可清理进度目录，不向源码或系统临时目录写数据。
    FFMPEG_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    # 进度文件显式绑定工程临时根，保证多工程任务不会共享系统级状态。
    with tempfile.NamedTemporaryFile(
        prefix="ffmpeg_progress_",
        suffix=".log",
        delete=False,
        dir=FFMPEG_TEMP_ROOT,
    ) as temp_file:
        progress_path = Path(temp_file.name)
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        "-progress",
        str(progress_path),
        "-nostats",
        str(output_path),
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    stdout_lines = []
    last_percent = -1

    while True:
        time.sleep(0.5)
        if progress_path.exists():
            progress_text = progress_path.read_text(encoding="utf-8", errors="ignore")
            lines = [line.strip() for line in progress_text.splitlines() if line.strip()]
            stdout_lines = lines
            current_seconds = 0.0
            reported_end = False
            for line in lines:
                if line.startswith("out_time_ms="):
                    out_time_ms_text = line.split("=", 1)[1]
                    if out_time_ms_text and out_time_ms_text != "N/A":
                        current_seconds = int(out_time_ms_text) / 1_000_000
                if line == "progress=end":
                    reported_end = True
            if duration_seconds > 0:
                percent = 100 if reported_end else min(int(current_seconds / duration_seconds * 100), 99)
                if percent != last_percent:
                    emit_message(
                        message_handler,
                        f"音频提取进度 {percent}% ({current_seconds:.2f}s / {duration_seconds:.2f}s)",
                    )
                    if progress_handler is not None:
                        progress_handler(percent, current_seconds, duration_seconds)
                    last_percent = percent

        if stop_handler is not None and stop_handler():
            emit_message(message_handler, "收到暂停请求，正在停止当前音频提取任务。")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            stderr_text = process.stderr.read() if process.stderr is not None else ""
            stdout_text = "\n".join(stdout_lines)
            return 130, stdout_text, stderr_text + "\npaused by user"

        returncode = process.poll()
        if returncode is not None:
            break

    stderr_text = process.stderr.read() if process.stderr is not None else ""
    stdout_text = "\n".join(stdout_lines)
    return returncode, stdout_text, stderr_text


def inspect_output_audio(
    output_path: Path,
    message_handler: MessageHandler | None = None,
) -> dict:
    emit_message(message_handler, "开始检查输出音频参数。")
    if not output_path.exists():
        return {
            "exists": False,
            "issues": ["输出文件不存在"],
        }
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name,sample_rate,channels",
        "-of",
        "json",
        str(output_path),
    ]
    process_result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if process_result.returncode != 0:
        return {
            "exists": True,
            "issues": ["输出音频参数检查失败"],
            "stderr": process_result.stderr,
        }
    metadata = json.loads(process_result.stdout or "{}")
    stream = metadata.get("streams", [{}])[0]
    issues = []
    if not stream.get("codec_name"):
        issues.append("未检测到输出音频流")
    return {
        "exists": True,
        "codec_name": stream.get("codec_name"),
        "sample_rate": stream.get("sample_rate"),
        "channels": stream.get("channels"),
        "issues": issues,
    }


def run(
    input_file: str,
    output_file: str,
    message_handler: MessageHandler | None = None,
    progress_handler: ProgressHandler | None = None,
    stop_handler: StopHandler | None = None,
) -> dict:
    input_path = Path(input_file)
    output_path = Path(output_file)
    emit_message(message_handler, f"收到音频提取任务：{input_path.name} -> {output_path.name}")
    duration_seconds = get_duration_seconds(input_path)
    emit_message(message_handler, f"输入媒体时长：{duration_seconds:.2f} 秒")
    returncode, stdout_text, stderr_text = run_ffmpeg_with_progress(
        input_path=input_path,
        output_path=output_path,
        duration_seconds=duration_seconds,
        message_handler=message_handler,
        progress_handler=progress_handler,
        stop_handler=stop_handler,
    )
    video_check = inspect_output_audio(
        output_path=output_path,
        message_handler=message_handler,
    )
    success = returncode == 0 and not video_check.get("issues")
    if success:
        emit_message(message_handler, "MP3 输出检查通过。")
    else:
        emit_message(message_handler, f"MP3 输出发现问题：{video_check.get('issues', ['未知问题'])}")
    return {
        "returncode": returncode,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "output_file": str(output_path),
        "duration_seconds": duration_seconds,
        "video_check": video_check,
        "success": success,
    }
