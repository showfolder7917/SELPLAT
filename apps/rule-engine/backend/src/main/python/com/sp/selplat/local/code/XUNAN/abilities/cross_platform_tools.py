#!/usr/bin/env python3
"""跨工程 Git 推送和目录权限修复能力。"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import stat
import subprocess


def git_push(repository: Path, remote: str = "origin", branch: str | None = None) -> dict[str, object]:
    """在明确仓库内执行非交互推送，不创建提交也不改变工作区内容。"""

    root = repository.resolve()
    if not (root / ".git").exists():
        raise ValueError(f"不是 Git 仓库：{root}")
    target_branch = branch or subprocess.run(
        ["git", "branch", "--show-current"], cwd=root, check=True, capture_output=True, text=True
    ).stdout.strip()
    if not target_branch:
        raise ValueError("当前处于 detached HEAD，必须显式指定 branch。")
    completed = subprocess.run(
        ["git", "push", remote, target_branch], cwd=root, text=True, capture_output=True
    )
    return {
        "status": "completed" if completed.returncode == 0 else "failed",
        "exit_code": completed.returncode,
        "branch": target_branch,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def repair_directory_permissions(root: Path, *, executable_scripts: bool = True) -> dict[str, int]:
    """只在明确目录内恢复所有者读写权限，并为脚本保留执行位。"""

    target = root.resolve()
    if not target.is_dir() or target == Path(target.anchor):
        raise ValueError(f"拒绝处理不存在或过宽目录：{target}")
    directory_count = 0
    file_count = 0
    for current_root, directories, files in os.walk(target):
        current = Path(current_root)
        current.chmod(current.stat().st_mode | stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
        directory_count += 1
        for name in directories:
            path = current / name
            path.chmod(path.stat().st_mode | stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
        for name in files:
            path = current / name
            mode = path.stat().st_mode | stat.S_IRUSR | stat.S_IWUSR
            if executable_scripts and path.suffix.lower() in {".sh", ".command", ".py"}:
                mode |= stat.S_IXUSR
            path.chmod(mode)
            file_count += 1
    return {"directories": directory_count, "files": file_count}


def main() -> int:
    """提供 git-push 与 repair-permissions 两个显式子命令。"""

    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="action", required=True)
    push_parser = subparsers.add_parser("git-push")
    push_parser.add_argument("repository", type=Path)
    push_parser.add_argument("--remote", default="origin")
    push_parser.add_argument("--branch")
    permission_parser = subparsers.add_parser("repair-permissions")
    permission_parser.add_argument("root", type=Path)
    arguments = parser.parse_args()
    if arguments.action == "git-push":
        result = git_push(arguments.repository, arguments.remote, arguments.branch)
    else:
        result = {"status": "completed", **repair_directory_permissions(arguments.root)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return int(result.get("exit_code", 0))


if __name__ == "__main__":
    raise SystemExit(main())
