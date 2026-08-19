"""不依赖第三方库的 JSON HTTP 客户端。"""

from dataclasses import dataclass
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class HttpResult:
    status: int
    json_body: dict[str, Any]
    uncertain: bool = False


class HttpClient:
    def __init__(self, base_url: str, client_id: str, timeout_seconds: int) -> None:
        self.base_url = base_url
        self.client_id = client_id
        self.timeout_seconds = timeout_seconds

    def request(self, method: str, path: str, body: dict[str, Any] | None = None,
                headers: dict[str, str] | None = None) -> HttpResult:
        """发送 JSON 请求；网络失败作为不确定结果抛出，禁止调用方假定成功。"""
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        request_headers = {"Accept": "application/json", "Content-Type": "application/json",
                           "X-Client-Id": self.client_id}
        request_headers.update(headers or {})
        request = Request(self.base_url + path, data=data, headers=request_headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                payload = response.read().decode("utf-8")
                return HttpResult(response.status, json.loads(payload) if payload else {})
        except HTTPError as error:
            payload = error.read().decode("utf-8")
            return HttpResult(error.code, json.loads(payload) if payload else {}, error.code >= 500)
        except URLError as error:
            raise ConnectionError(f"ai-factory 不可达: {error.reason}") from error
