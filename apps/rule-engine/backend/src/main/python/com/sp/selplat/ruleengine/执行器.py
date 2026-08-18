"""通过唯一能力注册表加载并执行 rule-engine Python 能力。"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import sys
from types import ModuleType
from typing import Any


sys.dont_write_bytecode = True
PYTHON_SOURCE_ROOT = next(
    候选 for 候选 in Path(__file__).resolve().parents if 候选.name == "python"
)
if str(PYTHON_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_SOURCE_ROOT))

from com.sp.selplat.ruleengine.util.路径配置 import 加载路径配置


_路径 = 加载路径配置()
PROJECT_ROOT = _路径.工程根
PYTHON_PYCACHE_ROOT = _路径.取得("python_cache")
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)
sys.dont_write_bytecode = False

执行器名称 = "python_ability_executor"


def _规范名称(名称: str) -> str:
    """统一能力名称的大小写、空格和连接符。"""

    return 名称.strip().replace("-", "_").replace(" ", "_").lower()


def _读取注册表() -> dict[str, dict[str, Any]]:
    """读取并校验唯一能力注册表顶层结构。"""

    注册表 = json.loads(_路径.取得("ability_registry").read_text(encoding="utf-8"))
    if not isinstance(注册表, dict):
        raise ValueError("abilities.json 顶层必须是对象。")
    return 注册表


def _建立名称索引(注册表: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """建立标准化能力名称索引并阻断名称冲突。"""

    索引: dict[str, dict[str, Any]] = {}
    for 能力标识, 定义 in 注册表.items():
        标准名称 = _规范名称(能力标识)
        if 标准名称 in 索引:
            raise ValueError(f"能力 ID 标准化后重复：{能力标识}")
        索引[标准名称] = {"id": 能力标识, "definition": 定义}
    return 索引


def _加载模块(模块路径: Path, 模块名称: str) -> ModuleType:
    """按真实文件路径动态加载能力模块。"""

    规格 = importlib.util.spec_from_file_location(模块名称, 模块路径)
    if 规格 is None or 规格.loader is None:
        raise RuntimeError(f"无法加载模块：{模块路径}")
    模块 = importlib.util.module_from_spec(规格)
    sys.modules[模块名称] = 模块
    try:
        规格.loader.exec_module(模块)
    except Exception:
        sys.modules.pop(模块名称, None)
        raise
    return 模块


def _规范结果(结果: object) -> dict[str, Any]:
    """把能力返回值统一转换为字典。"""

    return dict(结果) if isinstance(结果, dict) else {"result": 结果}


def _解析能力(能力名称: str) -> dict[str, Any]:
    """从注册表和公共路径配置解析能力文件并阻断路径逃逸。"""

    索引 = _建立名称索引(_读取注册表())
    标准名称 = _规范名称(能力名称)
    if 标准名称 not in 索引:
        return {
            "status": "missing_ability",
            "ability": 能力名称,
            "message": "未找到对应 ability。",
        }
    项目 = 索引[标准名称]
    定义 = 项目["definition"]
    根键 = str(定义.get("root") or "legacy_core_python")
    能力根 = _路径.取得(根键).resolve()
    相对路径 = Path(str(定义.get("path") or "").removeprefix("./"))
    能力路径 = (能力根 / 相对路径).resolve()
    if 能力路径 == 能力根 or not 能力路径.is_relative_to(能力根):
        return {
            "status": "invalid_ability_path",
            "ability": 项目["id"],
            "message": "能力注册路径越出已配置源码根。",
        }
    if not 能力路径.is_file():
        return {
            "status": "missing_ability_file",
            "ability": 项目["id"],
            "message": f"能力实现不存在：{能力路径}",
        }
    return {
        "status": "ready_ability",
        "ability": 项目["id"],
        "ability_path": 能力路径,
    }


def execute(能力名称: str, 上下文: dict[str, Any] | None = None) -> dict[str, Any]:
    """加载已登记能力并通过统一 execute 入口执行。"""

    解析结果 = _解析能力(能力名称)
    if 解析结果.get("status") != "ready_ability":
        return 解析结果
    能力标识 = str(解析结果["ability"])
    模块 = _加载模块(Path(解析结果["ability_path"]), f"ability_{能力标识}")
    if not hasattr(模块, "execute"):
        return {
            "status": "invalid_ability",
            "exit_code": 1,
            "ability": 能力标识,
            "message": "ability 缺少统一 execute() 入口。",
        }
    return _规范结果(模块.execute(context=dict(上下文 or {}), skills={}, apps={}))


def _批量执行(请求列表: list[dict[str, Any]]) -> dict[str, Any]:
    """在同一 Python 进程内顺序执行多个能力请求。"""

    结果列表 = []
    for 请求 in 请求列表:
        能力名称 = str(请求.get("ability") or "")
        结果 = execute(能力名称, 请求.get("context") or {})
        结果列表.append(结果)
        if int(结果.get("exit_code") or 0) != 0:
            return {"status": "blocked_batch", "exit_code": 1, "results": 结果列表}
    return {"status": "completed", "results": 结果列表}


def main() -> int:
    """解析能力名称和 JSON 上下文并返回能力声明的退出码。"""

    if len(sys.argv) < 2:
        print("Usage: python3 执行器.py <ability_name> [context_json]")
        return 1
    能力名称 = sys.argv[1]
    上下文 = json.loads(sys.argv[2]) if len(sys.argv) >= 3 else {}
    结果 = _批量执行(上下文) if 能力名称 == "--batch" and isinstance(上下文, list) else execute(能力名称, 上下文)
    print(json.dumps(结果, ensure_ascii=False, indent=2))
    return int(结果.get("exit_code") or 0)


if __name__ == "__main__":
    raise SystemExit(main())
