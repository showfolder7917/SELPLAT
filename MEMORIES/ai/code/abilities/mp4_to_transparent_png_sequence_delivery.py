"""MP4 转透明 PNG 序列交付能力。

功能：
将白底 MP4 视频拆解为 PNG 序列，并尽量把白色背景转为透明。

作用：
为角色动作素材生产提供统一入口，避免每次手写 ffmpeg 命令。

适用场景：
- 将角色动作 MP4 拆帧为 PNG 序列
- 对白底或近白底背景做透明抠图
- 产出可直接接入前端动作系统的序列帧素材
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
import re


ABILITY_ID = "mp4_to_transparent_png_sequence_delivery"
ABILITY_NAME = "MP4 转透明 PNG 序列交付"
ABILITY_DESC = "将白底 MP4 转为透明 PNG 序列。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []


def run(context: dict) -> dict:
    """返回能力基础信息。"""
    return {
        "ability": ABILITY_ID,
        "required_skills": REQUIRED_SKILLS,
        "required_apps": REQUIRED_APPS,
        "context": context,
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """执行 MP4 拆帧和白底透明化。"""
    del skills
    del apps

    input_file = Path(context.get("input_file", "./OPTION/input.mp4")).expanduser().resolve()
    output_dir = Path(context.get("output_dir", "./OPTION/png_sequence")).expanduser().resolve()
    prefix = str(context.get("prefix", "frame"))
    fps = int(context.get("fps", 12))
    bg_hex = str(context.get("bg_hex", "0xFFFFFF"))
    similarity = float(context.get("similarity", 0.18))
    blend = float(context.get("blend", 0.08))
    clean_output = bool(context.get("clean_output", False))
    auto_crop_and_center = bool(context.get("auto_crop_and_center", False))
    canvas_width = int(context.get("canvas_width", 0))
    canvas_height = int(context.get("canvas_height", 0))
    crop_w = int(context.get("crop_w", 0))
    crop_h = int(context.get("crop_h", 0))
    crop_x = int(context.get("crop_x", 0))
    crop_y = int(context.get("crop_y", 0))
    cleanup_bottom_white = bool(context.get("cleanup_bottom_white", False))
    cleanup_bottom_ratio = float(context.get("cleanup_bottom_ratio", 0.22))
    cleanup_similarity = float(context.get("cleanup_similarity", 0.10))
    cleanup_blend = float(context.get("cleanup_blend", 0.03))

    if not input_file.is_file():
      return {
          "status": "missing_input",
          "ability": ABILITY_ID,
          "message": f"输入文件不存在：{input_file}",
      }

    if shutil.which("ffmpeg") is None:
        return {
            "status": "missing_ffmpeg",
            "ability": ABILITY_ID,
            "message": "未找到 ffmpeg，无法执行拆帧。",
        }

    output_dir.mkdir(parents=True, exist_ok=True)

    if clean_output:
        for existing_file in output_dir.glob(f"{prefix}-*.png"):
            existing_file.unlink()

    output_pattern = output_dir / f"{prefix}-%03d.png"
    filter_parts = [f"fps={fps}", f"colorkey={bg_hex}:{similarity}:{blend}", "format=rgba"]

    crop_info: dict[str, int] | None = None
    if crop_w > 0 and crop_h > 0:
        crop_info = {
            "w": crop_w,
            "h": crop_h,
            "x": crop_x,
            "y": crop_y,
            "max_side": max(crop_w, crop_h),
            "mode": "fixed",
        }
        filter_parts.append(
            f"crop={crop_info['w']}:{crop_info['h']}:{crop_info['x']}:{crop_info['y']}"
        )
        target_width = canvas_width if canvas_width > 0 else crop_info["max_side"]
        target_height = canvas_height if canvas_height > 0 else crop_info["max_side"]
        filter_parts.append(
            f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
        )
    elif auto_crop_and_center:
        crop_info = detect_alpha_crop(
            input_file=input_file,
            fps=fps,
            bg_hex=bg_hex,
            similarity=similarity,
            blend=blend,
        )
        if crop_info:
            crop_info["mode"] = "auto"
            filter_parts.append(
                f"crop={crop_info['w']}:{crop_info['h']}:{crop_info['x']}:{crop_info['y']}"
            )
            target_width = canvas_width if canvas_width > 0 else crop_info["max_side"]
            target_height = canvas_height if canvas_height > 0 else crop_info["max_side"]
            filter_parts.append(
                f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
            )

    if cleanup_bottom_white:
        target_height = canvas_height if canvas_height > 0 else (crop_info["max_side"] if crop_info else 0)
        if target_height > 0:
            cleanup_start_y = max(0, int(target_height * (1 - cleanup_bottom_ratio)))
            cleanup_height = target_height - cleanup_start_y
            overlay_filter = (
                f"split=2[base][work];"
                f"[work]crop=iw:{cleanup_height}:0:{cleanup_start_y},"
                f"colorkey={bg_hex}:{cleanup_similarity}:{cleanup_blend},format=rgba[clean];"
                f"[base][clean]overlay=0:{cleanup_start_y}"
            )
            filter_parts.append(overlay_filter)

    video_filter = ",".join(filter_parts)
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-vf",
        video_filter,
        str(output_pattern),
    ]

    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )

    generated_files = sorted(output_dir.glob(f"{prefix}-*.png"))
    if completed.returncode != 0:
        return {
            "status": "ffmpeg_failed",
            "ability": ABILITY_ID,
            "command": command,
            "stderr": completed.stderr[-4000:],
            "stdout": completed.stdout[-4000:],
        }

    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "input_file": str(input_file),
        "output_dir": str(output_dir),
        "prefix": prefix,
        "fps": fps,
        "bg_hex": bg_hex,
        "similarity": similarity,
        "blend": blend,
        "auto_crop_and_center": auto_crop_and_center,
        "cleanup_bottom_white": cleanup_bottom_white,
        "crop_info": crop_info,
        "generated_count": len(generated_files),
        "first_frame": str(generated_files[0]) if generated_files else "",
        "last_frame": str(generated_files[-1]) if generated_files else "",
        "command": command,
    }


def detect_alpha_crop(input_file: Path, fps: int, bg_hex: str, similarity: float, blend: float) -> dict[str, int] | None:
    """基于抠白后的 alpha 区域自动估算裁边参数。"""
    detect_filter = (
        f"fps={fps},colorkey={bg_hex}:{similarity}:{blend},format=rgba,"
        "alphaextract,cropdetect=limit=0.01:round=2:reset=0"
    )
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-vf",
        detect_filter,
        "-f",
        "null",
        "-",
    ]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return None

    matches = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", completed.stderr)
    if not matches:
        return None

    width, height, offset_x, offset_y = map(int, matches[-1])
    return {
        "w": width,
        "h": height,
        "x": offset_x,
        "y": offset_y,
        "max_side": max(width, height),
    }
