"""按用户明确命令，把外部 Codex 可见会话手动保存到 SELPLAT 文档目录。"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ABILITY_ID = "external_codex_conversation_archiver"
ARCHIVE_TYPE = "selplat-external-codex-manual-conversation"
CORPUS_MARKER_PATTERN = re.compile(r"\n?<!--\s*SELPLAT_CORPUS_META\s+(\{.*?\})\s*-->\s*$", re.DOTALL)
SAFE_THREAD_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
PLATFORM_CONTEXT_PREFIXES = (
    "<recommended_plugins>",
    "<environment_context>",
    "<app-context>",
    "<permissions instructions>",
    "<skills_instructions>",
    "<collaboration_mode>",
    "<multi_agent_role>",
    "# AGENTS.md instructions",
)


class ConversationArchiveError(RuntimeError):
    """表示手动会话存档不能安全继续。"""


def archive_conversation(
    project_root: Path,
    thread_id: str,
    codex_home: Path | None = None,
) -> dict[str, Any]:
    """读取指定外部 Codex thread，并将当前可见快照写入工程会话存档。"""

    # 调用方必须明确指定会话 ID，禁止扫描后猜测“最近会话”而保存错人的内容。
    normalized_thread_id = thread_id.strip()
    if not normalized_thread_id:
        raise ConversationArchiveError("缺少 thread_id，禁止猜测要保存的外部 Codex 会话。")

    # 工程根必须真实存在，目标目录永远由工程根拼接而不是写死某台机器路径。
    resolved_project_root = project_root.resolve()
    if not (resolved_project_root / "apps/ai-desktop/ruleengine/AGENTS.md").is_file():
        raise ConversationArchiveError(f"不是有效 SELPLAT 工程根：{resolved_project_root}")

    # CODEX_HOME 未显式传入时遵循外部 Codex 标准环境变量和用户目录回退顺序。
    resolved_codex_home = (codex_home or Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))).resolve()
    rollout_path = _find_rollout(resolved_codex_home, normalized_thread_id)
    parsed = _parse_rollout(rollout_path, normalized_thread_id)

    # 人工存档保留已经写入 rollout 的完整可见消息；尚未 task_complete 的末轮明确标记 incomplete。
    turns = parsed["turns"]
    if not turns:
        raise ConversationArchiveError("指定会话没有可见的用户或 Codex 最终消息，未生成空存档。")

    # 内容哈希只基于未来导入所需的稳定会话事实，运行路径和保存时间不参与幂等判断。
    content_hash = hashlib.sha256(
        json.dumps(turns, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    archive_root = (resolved_project_root / "docs" / "会话存档").resolve()
    archive_root.mkdir(parents=True, exist_ok=True)
    archive_name = f"会话_{_safe_identifier(normalized_thread_id)}.json"
    archive_path = (archive_root / archive_name).resolve()
    if archive_path.parent != archive_root:
        raise ConversationArchiveError("会话存档目标逃逸 docs/会话存档，已阻断写入。")

    existing = _read_existing_archive(archive_path)
    if existing and existing.get("contentHash") == content_hash:
        return {
            "status": "completed",
            "changed": False,
            "threadId": normalized_thread_id,
            "archivePath": str(archive_path),
            "turnCount": len(turns),
            "messageCount": sum(len(turn["messages"]) for turn in turns),
        }

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    # 新消息出现后重新置为 pending；数据库导入只能由以后新的明确人工命令执行。
    archive_document = {
        "schemaVersion": 1,
        "archiveType": ARCHIVE_TYPE,
        "archiveMode": "manual-only",
        "conversationId": normalized_thread_id,
        "source": {
            "kind": "external-codex-rollout",
            "threadSource": parsed["threadSource"],
            "originator": parsed["originator"],
            "rolloutKey": rollout_path.relative_to(resolved_codex_home).as_posix(),
        },
        "contentHash": content_hash,
        "createdAt": existing.get("createdAt", now) if existing else now,
        "updatedAt": now,
        "migration": {
            "status": "pending",
            "target": "ai-desktop-unified-conversation-training-library",
            "importedAt": None,
            "policy": "manual-command-only",
        },
        "turns": turns,
    }

    # 同目录临时文件写完整后再替换正式文件，避免中途退出留下半份 JSON。
    temporary_path = archive_path.with_suffix(f"{archive_path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(archive_document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    os.replace(temporary_path, archive_path)
    return {
        "status": "completed",
        "changed": True,
        "threadId": normalized_thread_id,
        "archivePath": str(archive_path),
        "turnCount": len(turns),
        "messageCount": sum(len(turn["messages"]) for turn in turns),
    }


def _find_rollout(codex_home: Path, thread_id: str) -> Path:
    """只按明确 threadId 查找 active 或 archived rollout，并选择最新真实文件。"""

    candidates: list[Path] = []
    for directory_name in ("sessions", "archived_sessions"):
        root = codex_home / directory_name
        if not root.is_dir():
            continue
        # 标准 Codex 文件名包含 threadId；先按文件名过滤可避免读取整个会话仓库。
        candidates.extend(path for path in root.rglob(f"*{thread_id}*.jsonl") if path.is_file())
    if not candidates:
        raise ConversationArchiveError(f"在 {codex_home} 中找不到 threadId={thread_id} 的 rollout。")
    # 同一会话可能从 active 移到 archived；最后修改的文件是当前权威快照。
    return max(candidates, key=lambda path: path.stat().st_mtime_ns)


def _parse_rollout(rollout_path: Path, expected_thread_id: str) -> dict[str, Any]:
    """流式解析 rollout，只收集用户消息和 assistant final_answer。"""

    thread_source = ""
    originator = ""
    actual_thread_id = ""
    turns: list[dict[str, Any]] = []
    current_turn: dict[str, Any] | None = None

    with rollout_path.open("r", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            # 巨型工具输出不含这些可见记录特征，先跳过可显著降低手动保存的内存和解析成本。
            envelope = line[:4096]
            relevant = (
                '"session_meta"' in envelope
                or ('"event_msg"' in envelope and '"task_complete"' in envelope)
                or ('"response_item"' in envelope and '"message"' in envelope)
            )
            if not relevant:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ConversationArchiveError(f"rollout 第 {line_number} 行无法解析：{error}") from error

            if record.get("type") == "session_meta":
                payload = _as_dict(record.get("payload"))
                actual_thread_id = _text(payload.get("session_id")) or _text(payload.get("id"))
                thread_source = _text(payload.get("thread_source"))
                originator = _text(payload.get("originator"))
                continue

            payload = _as_dict(record.get("payload"))
            if record.get("type") == "event_msg" and payload.get("type") == "task_complete":
                if current_turn:
                    current_turn["status"] = "completed"
                    current_turn = None
                continue
            if record.get("type") != "response_item" or payload.get("type") != "message":
                continue

            role = _text(payload.get("role"))
            if role not in {"user", "assistant"}:
                continue
            if role == "assistant" and _text(payload.get("phase")) != "final_answer":
                continue
            content = _message_text(payload)
            if not content or (role == "user" and _is_platform_context(content)):
                continue
            if role == "user":
                content = _strip_workspace_context(content)
                if not content:
                    continue

            message_id = _message_id(record, payload, line_number, expected_thread_id)
            if current_turn is None:
                current_turn = {
                    "turnId": message_id,
                    "status": "incomplete",
                    "corpusMeta": None,
                    "messages": [],
                }
                turns.append(current_turn)

            corpus_meta = None
            if role == "assistant":
                content, corpus_meta = _extract_corpus_meta(content)
                if corpus_meta:
                    current_turn["corpusMeta"] = corpus_meta
            current_turn["messages"].append(
                {
                    "messageId": message_id,
                    "role": role,
                    "content": content,
                    "createdAt": _text(record.get("timestamp")),
                }
            )

    if actual_thread_id != expected_thread_id:
        raise ConversationArchiveError(
            f"文件中的 session_id={actual_thread_id!r} 与请求 threadId={expected_thread_id!r} 不一致。"
        )
    return {
        "threadSource": thread_source,
        "originator": originator,
        "turns": turns,
    }


def _message_text(payload: dict[str, Any]) -> str:
    """按原出现顺序合并消息文本块，不读取工具输出或其他内部字段。"""

    content = payload.get("content")
    if not isinstance(content, list):
        return ""
    return "".join(_text(_as_dict(item).get("text")) for item in content).strip()


def _message_id(
    record: dict[str, Any],
    payload: dict[str, Any],
    line_number: int,
    thread_id: str,
) -> str:
    """优先使用 Codex 原消息 ID，否则以 ordinal 或行号生成稳定回退 ID。"""

    source_id = _text(payload.get("id"))
    if source_id:
        return source_id
    ordinal = record.get("ordinal")
    stable_suffix = str(ordinal) if isinstance(ordinal, int) else str(line_number)
    return f"codex-{thread_id}-{stable_suffix}"


def _extract_corpus_meta(content: str) -> tuple[str, dict[str, Any] | None]:
    """把最终回答正文和训练元数据分开保存，供未来人工导入时直接复用。"""

    match = CORPUS_MARKER_PATTERN.search(content)
    if not match:
        return content, None
    try:
        metadata = json.loads(match.group(1))
    except json.JSONDecodeError:
        return content, None
    if not isinstance(metadata, dict):
        return content, None
    return content[: match.start()].rstrip(), metadata


def _strip_workspace_context(content: str) -> str:
    """移除平台自动追加的工作区根清单，只保留用户真实输入。"""

    return re.sub(r"\n\nRegistered workspace roots:\n(?:- .*\n?)+$", "", content).strip()


def _is_platform_context(content: str) -> bool:
    """阻止环境、权限、技能和工程协议消息伪装成用户训练原话。"""

    return content.startswith(PLATFORM_CONTEXT_PREFIXES)


def _safe_identifier(thread_id: str) -> str:
    """把异常 threadId 转为稳定哈希，阻止文件名路径穿越。"""

    if SAFE_THREAD_ID_PATTERN.fullmatch(thread_id):
        return thread_id
    return hashlib.sha256(thread_id.encode("utf-8")).hexdigest()


def _read_existing_archive(archive_path: Path) -> dict[str, Any] | None:
    """读取现有存档；损坏文件必须原样保留并阻止覆盖。"""

    if not archive_path.exists():
        return None
    try:
        value = json.loads(archive_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConversationArchiveError(f"现有会话存档损坏，已保留原文件：{archive_path}：{error}") from error
    if not isinstance(value, dict) or value.get("archiveType") != ARCHIVE_TYPE:
        raise ConversationArchiveError(f"现有文件不是外部 Codex 手动会话存档，禁止覆盖：{archive_path}")
    return value


def _as_dict(value: Any) -> dict[str, Any]:
    """只接受 JSON 对象，避免列表或标量进入字段读取逻辑。"""

    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str:
    """只接受真实字符串，禁止把对象隐式格式化后写入会话。"""

    return value if isinstance(value, str) else ""


def execute(context: dict[str, Any], skills: dict[str, Any], apps: dict[str, Any]) -> dict[str, Any]:
    """供 rule-engine 执行器在用户明确提出手动保存时调用。"""

    _ = skills, apps
    try:
        return archive_conversation(
            project_root=Path(_text(context.get("project_root"))),
            thread_id=_text(context.get("thread_id")),
            codex_home=Path(_text(context.get("codex_home"))) if _text(context.get("codex_home")) else None,
        )
    except (OSError, ValueError, ConversationArchiveError) as error:
        return {"status": "blocked", "ability": ABILITY_ID, "message": str(error)}


def main() -> int:
    """提供无第三方依赖的命令行入口，外部 Codex 可以在授权回合直接执行。"""

    parser = argparse.ArgumentParser(description="手动保存指定外部 Codex 会话到 SELPLAT docs/会话存档。")
    parser.add_argument("--project-root", required=True, help="当前 SELPLAT 工程根。")
    parser.add_argument("--thread-id", required=True, help="必须明确指定的外部 Codex threadId。")
    parser.add_argument("--codex-home", help="可选 Codex 数据根；默认使用 CODEX_HOME 或 ~/.codex。")
    arguments = parser.parse_args()
    try:
        result = archive_conversation(
            project_root=Path(arguments.project_root),
            thread_id=arguments.thread_id,
            codex_home=Path(arguments.codex_home) if arguments.codex_home else None,
        )
    except (OSError, ValueError, ConversationArchiveError) as error:
        print(json.dumps({"status": "blocked", "ability": ABILITY_ID, "message": str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
