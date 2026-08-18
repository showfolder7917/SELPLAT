#!/usr/bin/env python3
"""规则引擎 Python HTTP 入口。

提供原 Java 启动类的健康检查、静态页面转发和后端代理能力。
"""

from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_PORT = 8080
DEFAULT_DESKTOP_UPSTREAM = "http://127.0.0.1:8765"


class RuleEngineHandler(BaseHTTPRequestHandler):
    """处理规则引擎健康检查并把桌面请求转发到真实上游。"""

    server_version = "SELPLATRuleEnginePython/1"

    def do_GET(self) -> None:  # noqa: N802 - HTTP 标准方法名
        if self.path in {"/health", "/actuator/health"}:
            self._json(200, {"status": "UP", "runtime": "python"})
            return
        self._proxy()

    def do_POST(self) -> None:  # noqa: N802 - HTTP 标准方法名
        self._proxy()

    def _proxy(self) -> None:
        """原样转发请求方法、正文和内容类型，避免代理改变业务数据。"""

        upstream = os.environ.get("RULE_ENGINE_DESKTOP_UPSTREAM", DEFAULT_DESKTOP_UPSTREAM).rstrip("/")
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length else None
        request = Request(
            f"{upstream}{self.path}",
            data=body,
            method=self.command,
            headers={
                key: value
                for key, value in self.headers.items()
                if key.lower() not in {"host", "content-length", "connection"}
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                payload = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/octet-stream"))
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except HTTPError as error:
            self._json(error.code, {"status": "upstream_error", "message": str(error)})
        except URLError as error:
            self._json(502, {"status": "upstream_unavailable", "message": str(error.reason)})

    def _json(self, status: int, value: dict[str, object]) -> None:
        """返回 UTF-8 JSON，并固定内容长度。"""

        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, message: str, *args: object) -> None:
        """保留标准访问日志但不输出请求正文。"""

        print(f"[rule-engine] {self.address_string()} {message % args}")


def main() -> int:
    """启动 Python HTTP 服务，`--verify` 只检查配置后退出。"""

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("RULE_ENGINE_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("RULE_ENGINE_PORT", DEFAULT_PORT)))
    parser.add_argument("--verify", action="store_true")
    arguments = parser.parse_args()
    if arguments.verify:
        print(json.dumps({"status": "completed", "runtime": "python", "port": arguments.port}))
        return 0
    server = ThreadingHTTPServer((arguments.host, arguments.port), RuleEngineHandler)
    print(f"规则引擎 Python 服务已启动：http://{arguments.host}:{arguments.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
