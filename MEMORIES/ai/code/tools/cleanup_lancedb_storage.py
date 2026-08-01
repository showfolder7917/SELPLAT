"""Clean up the local LanceDB experience store safely.

Default mode is dry-run: it reports size, row count, version count, and the
number of versions older than the retention window. It only changes data when
--execute is passed. LanceDB internals are never deleted manually; cleanup uses
LanceDB table APIs.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import shutil
import subprocess
from configparser import ConfigParser
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[5]
DATABASE_CONFIG_PATH = PROJECT_ROOT / "SELFDB" / "database_paths.ini"
TABLE_NAME = "memory_records"
DEFAULT_REPORT_DIR = Path(__file__).resolve().parents[4] / "OPTION" / "temp" / "lancedb_cleanup_reports"


def _load_database_path_config() -> ConfigParser:
    parser = ConfigParser()
    if not DATABASE_CONFIG_PATH.is_file():
        raise FileNotFoundError(f"数据库配置文件不存在：{DATABASE_CONFIG_PATH}")
    parser.read(DATABASE_CONFIG_PATH, encoding="utf-8")
    return parser


def _resolve_database_path(section: str, option: str) -> Path:
    parser = _load_database_path_config()
    if not parser.has_section(section):
        raise KeyError(f"数据库配置缺少 section：{section}")
    if not parser.has_option(section, option):
        raise KeyError(f"数据库配置缺少 option：{section}.{option}")
    raw_value = parser.get(section, option).strip()
    if not raw_value:
        raise ValueError(f"数据库配置为空：{section}.{option}")
    return (DATABASE_CONFIG_PATH.parent / raw_value).resolve()


def _import_lancedb() -> Any:
    try:
        import lancedb  # type: ignore
    except Exception as error:  # pragma: no cover - depends on local env
        raise SystemExit(f"无法导入 lancedb，请先确认当前 Python 环境可用：{error}") from error
    return lancedb


def _human_size(byte_count: int) -> str:
    value = float(byte_count)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024 or unit == "TB":
            return f"{value:.1f}{unit}" if unit != "B" else f"{int(value)}B"
        value /= 1024
    return f"{byte_count}B"


def _directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                pass
    return total


def _file_count(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        return 1
    return sum(1 for item in path.rglob("*") if item.is_file())


def _dir_stats(path: Path) -> dict[str, Any]:
    byte_count = _directory_size(path)
    return {
        "path": str(path),
        "exists": path.exists(),
        "bytes": byte_count,
        "size": _human_size(byte_count),
        "file_count": _file_count(path),
    }


def _version_timestamp(version: dict[str, Any]) -> datetime | None:
    value = version.get("timestamp")
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def _stats_to_plain(value: Any) -> Any:
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    if isinstance(value, dict):
        return {str(k): _stats_to_plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_stats_to_plain(item) for item in value]
    if hasattr(value, "__dict__"):
        return {str(k): _stats_to_plain(v) for k, v in vars(value).items()}
    return str(value)


def _active_processes(path: Path) -> list[str]:
    lsof = shutil.which("lsof")
    if not lsof:
        return []
    try:
        result = subprocess.run(
            [lsof, "+D", str(path)],
            check=False,
            text=True,
            capture_output=True,
            timeout=8,
        )
    except Exception:
        return []
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    return lines[1:] if len(lines) > 1 else []


def _write_report(report: dict[str, Any], report_dir: Path) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"lancedb_cleanup_{timestamp}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report_path


def _copy_backup(database_dir: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    target = backup_dir / f"{database_dir.name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copytree(database_dir, target)
    return target


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safely clean SELFDB/SELFAIOP/experience_lancedb with LanceDB APIs.",
    )
    parser.add_argument(
        "--database-dir",
        default=str(_resolve_database_path("selaiop", "experience_db_dir")),
        help="LanceDB database directory. Default comes from SELFDB/database_paths.ini.",
    )
    parser.add_argument("--table", default=TABLE_NAME, help="LanceDB table name.")
    parser.add_argument(
        "--retention-hours",
        type=float,
        default=24.0,
        help="Keep versions newer than this many hours. Default: 24.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually run cleanup. Without this flag the script only reports.",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Also run compact_files after old-version cleanup. This can need temporary disk space.",
    )
    parser.add_argument(
        "--optimize",
        action="store_true",
        help="Run table.optimize instead of separate cleanup/compact calls.",
    )
    parser.add_argument(
        "--delete-unverified",
        action="store_true",
        help="Pass delete_unverified=True to LanceDB cleanup. Use only if you understand the risk.",
    )
    parser.add_argument(
        "--backup-dir",
        default="",
        help="Copy the whole database directory here before executing cleanup.",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="Allow --execute without creating a backup.",
    )
    parser.add_argument(
        "--allow-active-processes",
        action="store_true",
        help="Do not block when lsof finds processes using the database directory.",
    )
    parser.add_argument(
        "--report-dir",
        default=str(DEFAULT_REPORT_DIR),
        help="Directory for JSON cleanup reports.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    database_dir = Path(args.database_dir).expanduser().resolve()
    report_dir = Path(args.report_dir).expanduser().resolve()
    older_than = timedelta(hours=max(args.retention_hours, 0.0))

    if args.execute and not args.backup_dir and not args.skip_backup:
        raise SystemExit("执行清理前必须提供 --backup-dir，或显式传入 --skip-backup。")
    if args.optimize and args.compact:
        raise SystemExit("--optimize 已包含压缩流程，不要同时传入 --compact。")
    if not database_dir.exists():
        raise SystemExit(f"LanceDB 目录不存在：{database_dir}")

    active_processes = _active_processes(database_dir)
    if args.execute and active_processes and not args.allow_active_processes:
        report = {
            "status": "blocked_active_processes",
            "database_dir": str(database_dir),
            "active_processes": active_processes[:20],
            "message": "检测到进程正在使用数据库目录；停止相关服务后重试，或显式传入 --allow-active-processes。",
        }
        report_path = _write_report(report, report_dir)
        print(json.dumps({**report, "report_path": str(report_path)}, ensure_ascii=False, indent=2))
        return 2

    lancedb = _import_lancedb()
    db = lancedb.connect(str(database_dir))
    table_names_result = db.list_tables()
    table_names = getattr(table_names_result, "tables", table_names_result)
    table_names = [str(name) for name in table_names]
    if args.table not in table_names:
        raise SystemExit(f"表不存在：{args.table}；当前表：{table_names}")

    table = db.open_table(args.table)
    versions = table.list_versions()
    cutoff = datetime.now() - older_than
    old_versions = [
        version
        for version in versions
        if (_version_timestamp(version) is not None and _version_timestamp(version) < cutoff)
    ]
    lance_path = database_dir / f"{args.table}.lance"
    before = {
        "database": _dir_stats(database_dir),
        "table_dir": _dir_stats(lance_path),
        "subdirs": {
            name: _dir_stats(lance_path / name)
            for name in ["_versions", "_transactions", "data", "_deletions"]
        },
        "table_names": table_names,
        "current_version": getattr(table, "version", None),
        "row_count": table.count_rows(),
        "version_count": len(versions),
        "old_version_count": len(old_versions),
        "retention_hours": args.retention_hours,
        "cutoff": cutoff.isoformat(timespec="seconds"),
    }

    actions: list[dict[str, Any]] = []
    backup_path = ""
    if args.execute:
        if args.backup_dir:
            backup_path = str(_copy_backup(database_dir, Path(args.backup_dir).expanduser().resolve()))
        if args.optimize:
            result = table.optimize(
                cleanup_older_than=older_than,
                delete_unverified=args.delete_unverified,
            )
            actions.append({"action": "optimize", "result": _stats_to_plain(result)})
        else:
            result = table.cleanup_old_versions(
                older_than=older_than,
                delete_unverified=args.delete_unverified,
            )
            actions.append({"action": "cleanup_old_versions", "result": _stats_to_plain(result)})
            if args.compact:
                compact_result = table.compact_files()
                actions.append({"action": "compact_files", "result": _stats_to_plain(compact_result)})

    after = {
        "database": _dir_stats(database_dir),
        "table_dir": _dir_stats(lance_path),
        "subdirs": {
            name: _dir_stats(lance_path / name)
            for name in ["_versions", "_transactions", "data", "_deletions"]
        },
    }
    report = {
        "status": "executed" if args.execute else "dry_run",
        "database_dir": str(database_dir),
        "table": args.table,
        "backup_path": backup_path,
        "active_process_count": len(active_processes),
        "before": before,
        "after": after,
        "actions": actions,
        "notes": [
            "Do not manually delete LanceDB internal directories.",
            "If growth continues, reduce automatic governance/write frequency.",
            "Compaction/optimization can need temporary disk space.",
        ],
    }
    report_path = _write_report(report, report_dir)
    print(json.dumps({**report, "report_path": str(report_path)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
