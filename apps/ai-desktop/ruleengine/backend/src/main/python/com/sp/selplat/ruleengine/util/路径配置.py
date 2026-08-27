"""集中解析 rule-engine 使用的工程相对路径。"""

from __future__ import annotations

from functools import lru_cache
import os
from pathlib import Path
import tomllib


路径配置环境变量 = "SELPLAT_PATH_CONFIG"


class 路径配置:
    """保存经过工程边界校验的路径配置。"""

    def __init__(self, 工程根: Path, 配置文件: Path, 配置值: dict[str, Path]) -> None:
        """建立不可逃出工程根的路径映射。"""

        self.工程根 = 工程根
        self.配置文件 = 配置文件
        self._配置值 = dict(配置值)

    def 取得(self, 名称: str) -> Path:
        """按稳定配置键返回绝对 Path。"""

        if 名称 not in self._配置值:
            raise KeyError(f"未知路径配置：{名称}")
        return self._配置值[名称]


def _识别工程根(起点: Path) -> Path:
    """从当前源码或显式环境路径向上识别 SELPLAT 工程根。"""

    环境根 = os.environ.get("SELPLAT_ROOT", "").strip()
    候选根 = Path(环境根).expanduser().resolve() if 环境根 else None
    if 候选根 is not None:
        if not (候选根 / "settings.gradle").is_file():
            raise RuntimeError(f"SELPLAT_ROOT 不是有效工程根：{候选根}")
        return 候选根
    for 候选 in [起点.resolve(), *起点.resolve().parents]:
        if (候选 / "settings.gradle").is_file():
            return 候选
    raise RuntimeError("无法从当前环境识别 SELPLAT 工程根。")


def _默认配置文件(工程根: Path) -> Path:
    """返回唯一公共路径配置的标准启动位置。"""

    return (
        工程根
        / "apps/ai-desktop/ruleengine/backend/src/main/resources/ruleengine/config/路径配置.toml"
    )


@lru_cache(maxsize=4)
def 加载路径配置(显式配置文件: str = "") -> 路径配置:
    """加载相对路径配置并阻断绝对路径、路径逃逸和重复键。"""

    工程根 = _识别工程根(Path(__file__))
    环境配置文件 = os.environ.get(路径配置环境变量, "").strip()
    原始配置文件 = 显式配置文件.strip() or 环境配置文件
    配置文件 = (
        Path(原始配置文件).expanduser().resolve()
        if 原始配置文件
        else _默认配置文件(工程根).resolve()
    )
    if not 配置文件.is_relative_to(工程根):
        raise RuntimeError(f"路径配置文件越出工程根：{配置文件}")
    if not 配置文件.is_file():
        raise RuntimeError(f"路径配置文件不存在：{配置文件}")
    原始内容 = tomllib.loads(配置文件.read_text(encoding="utf-8"))
    路径表 = 原始内容.get("paths")
    if not isinstance(路径表, dict) or not 路径表:
        raise RuntimeError("路径配置必须包含非空的 [paths]。")
    配置值: dict[str, Path] = {}
    for 名称, 原始路径 in 路径表.items():
        if not isinstance(原始路径, str) or not 原始路径.strip():
            raise RuntimeError(f"路径配置值无效：{名称}")
        相对路径 = Path(原始路径.strip())
        if 相对路径.is_absolute():
            raise RuntimeError(f"路径配置禁止机器绝对路径：{名称}")
        解析路径 = (工程根 / 相对路径).resolve()
        if not 解析路径.is_relative_to(工程根):
            raise RuntimeError(f"路径配置越出工程根：{名称}")
        配置值[str(名称)] = 解析路径
    return 路径配置(工程根, 配置文件, 配置值)

