"""记账 HTTP 提交能力。

功能：
直接向统一正式记账 HTTP 入口提交 9 字段记账事实。

作用：
为 rule-engine Python core 提供唯一远端正式记账入口，避免继续依赖 natural-run。

适用场景：
- 执行完成后需要通过 HTTP 协议写入账本时
- 失败补记需要重放正式记账请求时
"""

from __future__ import annotations

from typing import Any
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ABILITY_ID = "ledger_http_submitter"
ABILITY_NAME = "记账 HTTP 提交能力"
ABILITY_DESC = "直接向 /api/ai-os/experience/ingest 提交正式记账请求。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

DEFAULT_LEDGER_HOST = "http://ai.selsp.com:8780"
DEFAULT_LEDGER_FALLBACK_HOST = "http://ai.selsp.com:8780"
EXPERIENCE_INGEST_PATH = "/api/ai-os/experience/ingest"

FACT_FIELDS = [
    "task_title",
    "task_text",
    "task_type",
    "tags",
    "summary",
    "changed_paths",
    "lessons",
    "repeated_fixes",
    "verification",
]


def _normalize_ledger_hosts(context: dict[str, Any]) -> list[str]:
    raw_hosts = context.get("ledger_hosts")
    if isinstance(raw_hosts, list):
        hosts = [str(item).strip().rstrip("/") for item in raw_hosts if str(item).strip()]
        if hosts:
            return hosts
    if isinstance(raw_hosts, str) and raw_hosts.strip():
        hosts = [item.strip().rstrip("/") for item in raw_hosts.split(",") if item.strip()]
        if hosts:
            return hosts
    single_host = str(context.get("ledger_host") or "").strip().rstrip("/")
    if single_host:
        return [single_host]
    return [DEFAULT_LEDGER_HOST, DEFAULT_LEDGER_FALLBACK_HOST]


def _extract_identity_context(context: dict[str, Any]) -> dict[str, str]:
    identity_context: dict[str, str] = {}
    for field_name in ["username", "tenant_id", "workspace_id", "access_token"]:
        field_value = str(context.get(field_name) or "").strip()
        if field_value:
            identity_context[field_name] = field_value
    return identity_context


def _missing_bootstrap_identity_fields(context: dict[str, Any]) -> list[str]:
    if str(context.get("access_token") or "").strip():
        return []
    missing_fields: list[str] = []
    for field_name in ["username", "tenant_id", "workspace_id"]:
        if not str(context.get(field_name) or "").strip():
            missing_fields.append(field_name)
    return missing_fields


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
    return {"_http_status_code": error.code, "_http_reason": str(error.reason)}


def _http_post_json(url: str, payload: dict[str, Any], *, urlopen_func=urlopen) -> dict[str, Any]:
    encoded_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        url=url,
        data=encoded_body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen_func(request) as response:
            return _read_json_response(response)
    except HTTPError as error:
        return _read_http_error_response(error)


def _submit_ledger_payload(hosts: list[str], submit_payload: dict[str, Any], *, urlopen_func=urlopen) -> dict[str, Any]:
    failures: list[dict[str, str]] = []
    for host in hosts:
        submit_url = f"{host}{EXPERIENCE_INGEST_PATH}"
        try:
            submit_response = _http_post_json(submit_url, submit_payload, urlopen_func=urlopen_func)
        except Exception as error:
            failures.append({"host": host, "phase": "submit", "reason": str(error)})
            continue
        return {
            "status": "completed",
            "ledger_host": host,
            "submit_url": submit_url,
            "submit_response": submit_response,
            "failures": failures,
        }
    return {
        "status": "failed",
        "ledger_host": "",
        "submit_url": "",
        "submit_response": None,
        "failures": failures,
    }


def _extract_run_id(submit_response: dict[str, Any]) -> str:
    data = submit_response.get("data")
    if isinstance(data, dict):
        run_id = str(data.get("run_id") or "").strip()
        if run_id:
            return run_id
    return str(submit_response.get("run_id") or "").strip()


def _extract_ledger_status(submit_response: dict[str, Any]) -> str:
    data = submit_response.get("data")
    if isinstance(data, dict):
        ledger_status = str(data.get("ledger_status") or data.get("status") or "").strip()
        if ledger_status:
            return ledger_status
    return str(submit_response.get("status") or submit_response.get("message") or "").strip()


def _extract_closeout_summary(submit_response: dict[str, Any]) -> str:
    data = submit_response.get("data")
    if isinstance(data, dict):
        closeout_summary = data.get("closeout_summary")
        if isinstance(closeout_summary, dict):
            summary_text = str(
                closeout_summary.get("summary")
                or closeout_summary.get("task_summary")
                or closeout_summary.get("task_text")
                or ""
            ).strip()
            if summary_text:
                return summary_text
        text_value = str(closeout_summary or data.get("summary") or "").strip()
        if text_value:
            return text_value
    return str(submit_response.get("closeout_summary") or "").strip()


def _normalize_list_field(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def _extract_ledger_tags(context: dict[str, Any], submit_response: dict[str, Any]) -> list[str]:
    tags = _normalize_list_field(context.get("tags"))
    if tags:
        return tags
    data = submit_response.get("data")
    if isinstance(data, dict):
        tags = _normalize_list_field(data.get("tags"))
        if tags:
            return tags
        closeout_summary = data.get("closeout_summary")
        if isinstance(closeout_summary, dict):
            tags = _normalize_list_field(closeout_summary.get("tags"))
            if tags:
                return tags
    return _normalize_list_field(submit_response.get("tags"))


def _extract_ledger_summary(context: dict[str, Any], submit_response: dict[str, Any], closeout_summary: str) -> str:
    data = submit_response.get("data")
    if isinstance(data, dict):
        closeout_payload = data.get("closeout_summary")
        if isinstance(closeout_payload, dict):
            summary_text = str(
                closeout_payload.get("summary")
                or closeout_payload.get("task_summary")
                or closeout_payload.get("task_text")
                or ""
            ).strip()
            if summary_text:
                return summary_text
        summary_text = str(data.get("summary") or "").strip()
        if summary_text:
            return summary_text
    summary_text = str(context.get("summary") or "").strip()
    if summary_text:
        return summary_text
    return closeout_summary


def _build_submit_payload(context: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    payload.update(_extract_identity_context(context))
    for field_name in FACT_FIELDS:
        if field_name in context:
            payload[field_name] = context.get(field_name)
    return payload


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    ledger_hosts = _normalize_ledger_hosts(context)
    urlopen_func = context.get("urlopen_func") or urlopen
    missing_bootstrap_fields = _missing_bootstrap_identity_fields(context)
    if missing_bootstrap_fields:
        return {
            "status": "missing_bootstrap_identity_fields",
            "ability": ABILITY_ID,
            "ledger_status": "failed",
            "ledger_type": "http_gateway",
            "run_id": "",
            "closeout_summary": "",
            "ledger_tags": _normalize_list_field(context.get("tags")),
            "ledger_summary": str(context.get("summary") or "").strip(),
            "failure_reason": "缺少 username/tenant_id/workspace_id。",
            "missing_fields": missing_bootstrap_fields,
        }
    submit_payload = _build_submit_payload(context)
    submit_result = _submit_ledger_payload(ledger_hosts, submit_payload, urlopen_func=urlopen_func)
    if submit_result.get("status") != "completed":
        return {
            "status": "ledger_submit_failed",
            "ability": ABILITY_ID,
            "ledger_status": "failed",
            "ledger_type": "http_gateway",
            "run_id": "",
            "closeout_summary": "",
            "ledger_tags": _normalize_list_field(context.get("tags")),
            "ledger_summary": str(context.get("summary") or "").strip(),
            "failure_reason": "所有候选记账主机的 experience/ingest 提交都失败了。",
            "ledger_hosts": ledger_hosts,
            "submit_failures": submit_result.get("failures", []),
        }
    submit_response = submit_result.get("submit_response") or {}
    run_id = _extract_run_id(submit_response)
    ledger_status = _extract_ledger_status(submit_response)
    closeout_summary = _extract_closeout_summary(submit_response)
    ledger_tags = _extract_ledger_tags(context, submit_response)
    ledger_summary = _extract_ledger_summary(context, submit_response, closeout_summary)
    response_code = submit_response.get("code")
    if response_code not in (None, 0, "0") and not run_id:
        return {
            "status": "ledger_submit_rejected",
            "ability": ABILITY_ID,
            "ledger_status": ledger_status or "failed",
            "ledger_type": "http_gateway",
            "run_id": "",
            "closeout_summary": closeout_summary,
            "ledger_tags": ledger_tags,
            "ledger_summary": ledger_summary,
            "failure_reason": str(submit_response.get("message") or "记账网关拒绝了当前提交。"),
            "ledger_host": str(submit_result.get("ledger_host") or ""),
            "ledger_hosts": ledger_hosts,
            "submit_failures": submit_result.get("failures", []),
            "submit_response": submit_response,
        }
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "ledger_status": ledger_status or "submitted",
        "ledger_type": "http_gateway",
        "run_id": run_id,
        "closeout_summary": closeout_summary,
        "ledger_tags": ledger_tags,
        "ledger_summary": ledger_summary,
        "ledger_host": str(submit_result.get("ledger_host") or ""),
        "ledger_hosts": ledger_hosts,
        "submit_failures": submit_result.get("failures", []),
        "submit_response": submit_response,
    }
