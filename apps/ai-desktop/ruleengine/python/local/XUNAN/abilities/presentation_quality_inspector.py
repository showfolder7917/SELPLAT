#!/usr/bin/env python3
"""横版教学 PPT 通用质量检查能力。

复用口才课程的 PPTX 包结构检查，并补充页面尺寸、正文可编辑性和
必要业务形状检查；用于替代原 Node 横版教学 PPT 质量检测器。
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import sys


XUNAN_CODE_ROOT = Path(__file__).resolve().parents[1]


def _load_oral_tools():
    """按文件身份加载口才 PPT 能力，避免测试进程中的 abilities 同名包冲突。"""

    module_name = "selplat_xunan_oral_performance_ppt_tools"
    if module_name in sys.modules:
        return sys.modules[module_name]
    module_path = XUNAN_CODE_ROOT / "abilities/oral_performance_ppt_tools.py"
    specification = importlib.util.spec_from_file_location(module_name, module_path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"无法加载口才 PPT 能力：{module_path}")
    module = importlib.util.module_from_spec(specification)
    sys.modules[module_name] = module
    specification.loader.exec_module(module)
    return module


_ORAL_TOOLS = _load_oral_tools()
inspect_pptx = _ORAL_TOOLS.inspect_pptx
read_pptx_entries = _ORAL_TOOLS.read_pptx_entries


def inspect_horizontal_deck(
    source: Path,
    *,
    expected_slides: int = 0,
    required_shape_names: tuple[str, ...] = (),
) -> dict[str, object]:
    """检查横版尺寸、基础包结构和指定的可编辑业务形状。"""

    result = inspect_pptx(source, expected_slides=expected_slides)
    entries = read_pptx_entries(source)
    presentation_xml = entries.get("ppt/presentation.xml", b"").decode("utf-8", errors="replace")
    errors = list(result["errors"])
    if 'cx="12192000"' not in presentation_xml or 'cy="6858000"' not in presentation_xml:
        errors.append("页面尺寸不是 1280×720 对应的 16:9 横版尺寸。")
    combined_slides = "\n".join(
        payload.decode("utf-8", errors="replace")
        for name, payload in entries.items()
        if name.startswith("ppt/slides/slide") and name.endswith(".xml")
    )
    for shape_name in required_shape_names:
        if f'name="{shape_name}"' not in combined_slides:
            errors.append(f"缺少可编辑业务形状：{shape_name}")
    result["errors"] = errors
    result["status"] = "passed" if not errors else "failed"
    result["required_shape_names"] = list(required_shape_names)
    return result


def main() -> int:
    """提供单文件横版教学 PPT 检查入口。"""

    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--expected-slides", type=int, default=0)
    parser.add_argument("--required-shape", action="append", default=[])
    arguments = parser.parse_args()
    result = inspect_horizontal_deck(
        arguments.source,
        expected_slides=arguments.expected_slides,
        required_shape_names=tuple(arguments.required_shape),
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
