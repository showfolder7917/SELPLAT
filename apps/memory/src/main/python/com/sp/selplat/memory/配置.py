"""解析 memory 配置并强制所有生成物留在唯一运行根。"""

from pathlib import Path
import tomllib

from com.sp.selplat.core.文件读取器 import FileReader

from .model.接口模型 import MemoryConfig


def locate_project_root(start: Path | None = None) -> Path:
    """向上定位同时包含 settings.gradle 与 apps/memory 的 SELPLAT 根。"""
    current = (start or Path.cwd()).resolve()
    for candidate in (current, *current.parents):
        if (candidate / "settings.gradle").is_file() and (candidate / "apps/memory").is_dir():
            return candidate
    raise RuntimeError("无法定位 SELPLAT 工程根")


def load_config(path: Path | None = None) -> MemoryConfig:
    """读取 TOML；令牌不进入配置文件，只允许由调用请求临时传递。"""
    root = locate_project_root(path.parent if path else None)
    config_path = path or root / "apps/memory/config/memory.toml"
    # 配置属于受管文本，必须通过统一读取入口加载后再交给 TOML 解析器。
    document = tomllib.loads(FileReader((root,)).read_text(config_path))
    runtime = document["runtime"]
    runtime_root = (root / runtime["root"]).resolve()
    expected_root = (root / "OPTION/temp/ai-factory").resolve()
    if runtime_root != expected_root:
        raise ValueError("runtime.root 必须是 OPTION/temp/ai-factory")
    service = document["server"]
    client = document["client"]
    state = document["state"]
    sync = document["sync"]
    codex = document["codex"]
    sqlite_path = (root / str(state["sqlite_path"])).resolve()
    if expected_root not in sqlite_path.parents:
        raise ValueError("state.sqlite_path 必须属于 OPTION/temp/ai-factory")
    return MemoryConfig(
        project_root=root,
        runtime_root=runtime_root,
        sqlite_path=sqlite_path,
        base_url=str(service["base_url"]).rstrip("/"),
        api_version=str(service["api_version"]),
        client_id=str(client["client_id"]),
        request_timeout_seconds=int(sync["connect_timeout_seconds"]),
        poll_interval_seconds=float(runtime["poll_interval_seconds"]),
        max_connections=int(codex["max_connections"]),
        codex_command=str(codex["command"]),
    )
