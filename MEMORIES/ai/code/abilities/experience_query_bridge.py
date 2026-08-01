"""经验查询桥接能力。

功能：
通过本地 HTTP 网关执行经验查询，并返回查询条数与查询参数。

作用：
为项目内 MEMORIES 代码树提供统一的经验查询入口，便于在回答前先查经验。

适用场景：
- 人类提问后需要先查经验再回答
- 需要统一返回查询条数与查询参数时
"""

from __future__ import annotations

from typing import Any
import json
import re
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen


ABILITY_ID = "experience_query_bridge"
ABILITY_NAME = "经验查询桥接"
ABILITY_DESC = "通过本地 HTTP 网关查询经验，并返回查询条数、查询参数与原始结果。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

DEFAULT_QUERY_HOST = "http://ai.selsp.com:8780"
DEFAULT_QUERY_FALLBACK_HOST = "http://ai.selsp.com:8780"
EXPERIENCE_QUERY_PATH = "/api/ai-os/experience/query"
DEFAULT_QUERY_VIEW = "compact"

COMMON_QUERY_STOP_WORDS = {
    "请",
    "帮我",
    "一下",
    "帮忙",
    "怎么",
    "如何",
    "为什么",
    "什么",
    "是否",
    "可以",
    "帮",
    "我",
    "用",
    "查",
    "查了",
    "查询",
    "一下子",
    "了",
}


def _normalize_query_hosts(context: dict[str, Any]) -> list[str]:
    raw_hosts = context.get("query_hosts")
    if isinstance(raw_hosts, list):
        hosts = [str(item).strip().rstrip("/") for item in raw_hosts if str(item).strip()]
        if hosts:
            return hosts
    if isinstance(raw_hosts, str) and raw_hosts.strip():
        hosts = [item.strip().rstrip("/") for item in raw_hosts.split(",") if item.strip()]
        if hosts:
            return hosts
    single_host = str(context.get("query_host") or "").strip().rstrip("/")
    if single_host:
        return [single_host]
    return [DEFAULT_QUERY_HOST, DEFAULT_QUERY_FALLBACK_HOST]


def _extract_identity_context(context: dict[str, Any]) -> dict[str, str]:
    identity_context: dict[str, str] = {}
    for field_name in ["username", "tenant_id", "workspace_id", "access_token"]:
        field_value = str(context.get(field_name) or "").strip()
        if field_value:
            identity_context[field_name] = field_value
    return identity_context


def _extract_query_param(context: dict[str, Any]) -> str:
    for field_name in ["query_param", "query", "参数"]:
        value = str(context.get(field_name) or "").strip()
        if value:
            return value
    question_text = str(
        context.get("question_text")
        or context.get("question")
        or context.get("human_question")
        or context.get("user_question")
        or ""
    ).strip()
    if not question_text:
        return ""
    if "经验" in question_text:
        return "经验"
    normalized = question_text
    for marker in ["查一下", "查了", "查询", "查", "搜索", "用", "请", "帮我", "帮忙"]:
        normalized = normalized.replace(marker, " ")
    candidates = [
        item.strip()
        for item in re.split(r"[^0-9A-Za-z\u4e00-\u9fff._/-]+", normalized)
        if item.strip()
    ]
    filtered = [item for item in candidates if item not in COMMON_QUERY_STOP_WORDS and len(item) >= 2]
    if filtered:
        return filtered[0]
    return question_text[:12]


def _extract_query_view(context: dict[str, Any]) -> str:
    raw_view = str(context.get("view") or context.get("query_view") or "").strip().lower()
    if raw_view == "full":
        return "full"
    if raw_view == "compact":
        return "compact"
    return DEFAULT_QUERY_VIEW


def _read_json_response(response: Any) -> dict[str, Any]:
    raw_bytes = response.read()
    if not raw_bytes:
        return {}
    return json.loads(raw_bytes.decode("utf-8"))


def _read_http_error_response(error: HTTPError) -> dict[str, Any]:
    try:
        payload = _read_json_response(error)
    except Exception:
        payload = {}
    if isinstance(payload, dict):
        payload.setdefault("_http_status_code", error.code)
        payload.setdefault("_http_reason", str(error.reason))
        return payload
    return {
        "_http_status_code": error.code,
        "_http_reason": str(error.reason),
    }


def _http_get_json(url: str, *, urlopen_func=urlopen) -> dict[str, Any]:
    try:
        with urlopen_func(url) as response:
            return _read_json_response(response)
    except HTTPError as error:
        return _read_http_error_response(error)


def _extract_query_count(response: dict[str, Any]) -> int:
    data = response.get("data")
    if isinstance(data, dict):
        page = data.get("page")
        if isinstance(page, dict):
            try:
                return int(page.get("total", 0) or 0)
            except (TypeError, ValueError):
                return 0
        records = data.get("records")
        if isinstance(records, list):
            return len(records)
    return 0


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    urlopen_func = context.get("urlopen_func") or urlopen
    query_param = _extract_query_param(context)
    if not query_param:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": "缺少可用查询参数。",
            "查询条数": 0,
            "参数": "",
        }
    identity_context = _extract_identity_context(context)
    if not identity_context:
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": "缺少身份上下文，至少需要 access_token 或 username/tenant_id/workspace_id。",
            "查询条数": 0,
            "参数": query_param,
        }
    query_hosts = _normalize_query_hosts(context)
    query_view = _extract_query_view(context)
    query_payload = {"query": query_param, **identity_context}
    query_payload["view"] = query_view
    query_string = urlencode(query_payload)
    failures: list[dict[str, str]] = []
    for host in query_hosts:
        query_url = f"{host}{EXPERIENCE_QUERY_PATH}?{query_string}"
        try:
            response = _http_get_json(query_url, urlopen_func=urlopen_func)
        except Exception as error:
            failures.append({"host": host, "reason": str(error)})
            continue
        return {
            "status": "completed",
            "ability": ABILITY_ID,
            "参数": query_param,
            "查询条数": _extract_query_count(response),
            "view": query_view,
            "query_url": query_url,
            "query_host": host,
            "result": response,
            "failures": failures,
        }
    return {
        "status": "query_failed",
        "ability": ABILITY_ID,
        "参数": query_param,
        "查询条数": 0,
        "view": query_view,
        "query_hosts": query_hosts,
        "failures": failures,
        "message": "所有候选经验查询主机都失败了。",
    }
