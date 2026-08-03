"""H2 数据库查询台本地后端。

功能：
为 Vue 查询界面提供 H2 表结构浏览、SQL 执行和快速查询模板接口。

作用：
使用 Python 作为本地服务入口，并通过 Java JDBC 查询器把 H2 结果稳定转换为 JSON。

适用场景：
- 浏览 H2 本地数据库表结构
- 执行 select / update / insert / delete SQL
- 为 Vue 查询界面提供默认数据库连接与快速 SQL 模板
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from socket import SOL_SOCKET, SO_REUSEADDR, socket
from threading import Timer
from urllib.parse import parse_qs, urlparse
import json
import os
import subprocess
import sys
import webbrowser


APP_DIR = Path(__file__).resolve().parent
CODE_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
JAVA_RUNNER_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/java/com/sp/selplat/local/code/core/app/h2_query_workbench/H2QueryRunner.java"
)
DEFAULT_DATABASE_PATH = "/Users/showfolder/Documents/workSpace/SELFCOMMON/SELFSP/SELFSPH2.mv.db"
DEFAULT_MEMORY_JDBC_URL = "jdbc:h2:tcp://127.0.0.1:9092/mem:SELFSP"
DEFAULT_PORT = 8776


def build_error_payload(
    database_path: str,
    error_code: str,
    error_title: str,
    error_detail: str,
    suggestion: str,
    sql: str = "",
) -> dict:
    """构造统一错误载荷。"""

    payload = {
        "ok": False,
        "databasePath": database_path,
        "errorCode": error_code,
        "errorTitle": error_title,
        "errorDetail": error_detail,
        "suggestion": suggestion,
        "error": f"{error_title}：{error_detail}",
    }
    if sql:
        payload["sql"] = sql
    return payload


def classify_h2_error(database_path: str, raw_error: str, sql: str = "") -> dict:
    """把原始 H2 错误识别为结构化错误。"""

    normalized_error = str(raw_error or "").strip()
    lowered_error = normalized_error.lower()

    if "jdbcsqlsyntaxerrorexception" in lowered_error or "syntax error" in lowered_error:
        return build_error_payload(
            database_path=database_path,
            error_code="sql_syntax_error",
            error_title="SQL 语法错误",
            error_detail=normalized_error,
            suggestion="请检查 SQL 关键字、表名、字段名和括号/引号是否正确。",
            sql=sql,
        )

    if "table" in lowered_error and "not found" in lowered_error:
        return build_error_payload(
            database_path=database_path,
            error_code="table_not_found",
            error_title="数据表不存在",
            error_detail=normalized_error,
            suggestion="请确认左侧选中的表名与 SQL 中使用的表名一致。",
            sql=sql,
        )

    if "column" in lowered_error and "not found" in lowered_error:
        return build_error_payload(
            database_path=database_path,
            error_code="column_not_found",
            error_title="字段不存在",
            error_detail=normalized_error,
            suggestion="请核对当前表字段，避免使用不存在或大小写不匹配的列名。",
            sql=sql,
        )

    if "database may be already in use" in lowered_error or "the file is locked" in lowered_error:
        return build_error_payload(
            database_path=database_path,
            error_code="database_locked",
            error_title="数据库文件正被独占",
            error_detail=normalized_error,
            suggestion="请确认是否有其他进程以独占方式打开该 H2 文件；若主项目可正常访问，一般重试即可，若持续失败再检查占用进程。",
            sql=sql,
        )

    if "wrong user name or password" in lowered_error:
        return build_error_payload(
            database_path=database_path,
            error_code="authentication_failed",
            error_title="数据库认证失败",
            error_detail=normalized_error,
            suggestion="请检查当前 H2 用户名和密码配置是否与目标数据库一致。",
            sql=sql,
        )

    if "io exception" in lowered_error or "connection is broken" in lowered_error:
        return build_error_payload(
            database_path=database_path,
            error_code="connection_failed",
            error_title="数据库连接失败",
            error_detail=normalized_error,
            suggestion="请检查数据库文件路径是否正确；若当前是内存库，请确认 SELFSP 后端已启动且 H2 TCP 服务可用。",
            sql=sql,
        )

    return build_error_payload(
        database_path=database_path,
        error_code="query_failed",
        error_title="数据库执行失败",
        error_detail=normalized_error or "未知错误。",
        suggestion="请根据错误详情检查 SQL 或数据库状态。",
        sql=sql,
    )


def pick_port(start_port: int = DEFAULT_PORT, max_attempts: int = 20) -> int:
    """挑选可用端口。"""

    for port in range(start_port, start_port + max_attempts):
        with socket() as probe:
            probe.setsockopt(SOL_SOCKET, SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("未找到可用端口。")


def normalize_database_path(database_path: str) -> Path:
    """把数据库路径规范成 H2 file URL 需要的基路径。"""

    raw_path = str(database_path or DEFAULT_DATABASE_PATH).strip()
    if not raw_path:
        raw_path = DEFAULT_DATABASE_PATH
    path = Path(raw_path).expanduser().resolve()
    if path.name.endswith(".mv.db"):
        path = path.with_name(path.name[:-6])
    return path


def find_h2_jar() -> Path:
    """查找本机 H2 jar。"""

    candidates = sorted(Path.home().glob(".gradle/caches/modules-2/files-2.1/com.h2database/h2/*/*/h2-*.jar"))
    runtime_candidates = [candidate for candidate in candidates if "sources" not in candidate.name and "javadoc" not in candidate.name]
    if not runtime_candidates:
        raise FileNotFoundError("未找到 H2 runtime jar，请先确保 SELFSP 已下载 H2 依赖。")
    return runtime_candidates[-1]


def build_connection_settings(raw_value: str, source_type: str = "file") -> dict:
    """根据数据源类型构造连接设置。"""

    normalized_type = str(source_type or "file").strip().lower()
    raw_database_value = str(raw_value or "").strip()
    if normalized_type == "memory":
        jdbc_url = raw_database_value or DEFAULT_MEMORY_JDBC_URL
        return {
            "sourceType": "memory",
            "databasePath": jdbc_url,
            "databaseBasePath": jdbc_url,
            "jdbcUrl": jdbc_url,
        }
    normalized_path = normalize_database_path(raw_database_value or DEFAULT_DATABASE_PATH)
    database_base_path = str(normalized_path)
    return {
        "sourceType": "file",
        "databasePath": raw_database_value or DEFAULT_DATABASE_PATH,
        "databaseBasePath": database_base_path,
        "jdbcUrl": f"jdbc:h2:file:{database_base_path};AUTO_SERVER=TRUE",
    }


def run_h2_query(mode: str, database_path: str, sql: str = "", source_type: str = "file") -> dict:
    """调用 Java 查询器执行 schema 或 query。"""

    h2_jar = find_h2_jar()
    connection_settings = build_connection_settings(database_path, source_type)
    jdbc_url = str(connection_settings["jdbcUrl"])
    command = [
        "java",
        "-Dfile.encoding=UTF-8",
        "-Dsun.jnu.encoding=UTF-8",
        "--class-path",
        str(h2_jar),
        str(JAVA_RUNNER_PATH),
        mode,
        jdbc_url,
        "sa",
        "",
    ]
    if mode == "query":
        command.append(sql)
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        env={
            **os.environ,
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
            "PYTHONUTF8": "1",
        },
    )
    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    if stderr and not stdout:
        return classify_h2_error(str(connection_settings["databasePath"]), stderr, sql=sql)
    if not stdout:
        return classify_h2_error(str(connection_settings["databasePath"]), "查询器未返回任何输出。", sql=sql)
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return classify_h2_error(str(connection_settings["databasePath"]), stdout, sql=sql)
    if not payload.get("ok", False):
        raw_error = str(payload.get("error", "")).strip() or "查询失败。"
        return classify_h2_error(str(connection_settings["databasePath"]), raw_error, sql=sql)
    return payload


def detect_primary_column(columns: list[dict]) -> str:
    """推断表的主键候选列。"""

    if not columns:
        return ""
    for candidate in columns:
        column_name = str(candidate.get("name", "")).upper()
        if column_name == "ID" or column_name.endswith("_ID"):
            return str(candidate.get("name", ""))
    return str(columns[0].get("name", ""))


def build_sql_template(table_name: str, columns: list[dict], action: str) -> str:
    """根据表结构生成快捷 SQL。"""

    quoted_table = table_name
    column_names = [str(item.get("name", "")) for item in columns if str(item.get("name", "")).strip()]
    if not column_names:
        return f"SELECT *\nFROM {quoted_table};"
    primary_column = detect_primary_column(columns)
    padded_columns = ",\n  ".join(column_names)
    insert_columns = ", ".join(column_names)
    insert_values = ", ".join(["?" for _ in column_names])
    update_columns = [column for column in column_names if column != primary_column] or column_names
    update_setters = ",\n  ".join([f"{column} = ?" for column in update_columns])

    templates = {
        "select_all": f"SELECT *\nFROM {quoted_table};",
        "select_columns": f"SELECT\n  {padded_columns}\nFROM {quoted_table};",
        "select_limit_50": f"SELECT *\nFROM {quoted_table}\nLIMIT 50;",
        "count_all": f"SELECT COUNT(*) AS total_count\nFROM {quoted_table};",
        "insert_template": f"INSERT INTO {quoted_table} ({insert_columns})\nVALUES ({insert_values});",
        "update_template": f"UPDATE {quoted_table}\nSET\n  {update_setters}\nWHERE {primary_column or column_names[0]} = ?;",
        "delete_template": f"DELETE FROM {quoted_table}\nWHERE {primary_column or column_names[0]} = ?;",
    }
    return templates.get(action, templates["select_all"])


class H2QueryWorkbenchApp:
    """H2 查询台应用容器。"""

    def __init__(self, database_path: str, source_type: str = "file") -> None:
        self.source_type = str(source_type or "file").strip().lower() or "file"
        self.database_path = str(database_path or DEFAULT_DATABASE_PATH).strip() or DEFAULT_DATABASE_PATH

    def current_settings_payload(self) -> dict:
        """返回当前数据源设置。"""

        connection_settings = build_connection_settings(self.database_path, self.source_type)
        return {
            "ok": True,
            "sourceType": connection_settings["sourceType"],
            "databasePath": connection_settings["databasePath"],
            "databaseBasePath": connection_settings["databaseBasePath"],
            "memoryJdbcUrl": DEFAULT_MEMORY_JDBC_URL,
            "fileDatabasePath": DEFAULT_DATABASE_PATH,
        }

    def update_settings(self, source_type: str, database_path: str) -> dict:
        """更新当前数据源设置。"""

        next_settings = build_connection_settings(database_path, source_type)
        self.source_type = str(next_settings["sourceType"])
        self.database_path = str(next_settings["databasePath"])
        return self.current_settings_payload()

    def schema_payload(self) -> dict:
        """返回表结构载荷。"""

        connection_settings = build_connection_settings(self.database_path, self.source_type)
        schema_result = run_h2_query("schema", self.database_path, source_type=self.source_type)
        if not schema_result.get("ok", False):
            return schema_result

        tables = schema_result.get("tables", [])
        return {
            "ok": True,
            "sourceType": connection_settings["sourceType"],
            "databasePath": connection_settings["databasePath"],
            "databaseBasePath": connection_settings["databaseBasePath"],
            "memoryJdbcUrl": DEFAULT_MEMORY_JDBC_URL,
            "fileDatabasePath": DEFAULT_DATABASE_PATH,
            "tables": tables,
            "defaultTable": tables[0]["name"] if tables else "",
        }

    def query_payload(self, sql: str) -> dict:
        """返回 SQL 执行结果。"""

        connection_settings = build_connection_settings(self.database_path, self.source_type)
        result = run_h2_query("query", self.database_path, sql=sql, source_type=self.source_type)
        if not result.get("ok", False):
            return result
        result["sourceType"] = connection_settings["sourceType"]
        result["databasePath"] = connection_settings["databasePath"]
        return result

    def template_payload(self, table_name: str, action: str) -> dict:
        """返回快速 SQL 模板。"""

        schema = self.schema_payload()
        if not schema.get("ok", False):
            return schema
        for table in schema.get("tables", []):
            if str(table.get("name", "")).upper() != table_name.upper():
                continue
            sql = build_sql_template(str(table.get("name", "")), list(table.get("columns", [])), action)
            return {
                "ok": True,
                "table": table.get("name", ""),
                "action": action,
                "sql": sql,
            }
        return {
            "ok": False,
            "databasePath": self.database_path,
            "errorCode": "table_not_found",
            "errorTitle": "数据表不存在",
            "errorDetail": f"未找到数据表：{table_name}",
            "suggestion": "请先在左侧选择有效数据表，再生成快速查询模板。",
            "error": f"未找到数据表：{table_name}",
        }


def json_response(handler: BaseHTTPRequestHandler, status_code: int, payload: dict) -> None:
    """输出 JSON 响应。"""

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler: BaseHTTPRequestHandler) -> dict:
    """读取 JSON 请求体。"""

    content_length = int(handler.headers.get("Content-Length", "0") or "0")
    if content_length <= 0:
        return {}
    body = handler.rfile.read(content_length).decode("utf-8")
    return json.loads(body) if body.strip() else {}


def build_handler(app: H2QueryWorkbenchApp):
    """构造请求处理器。"""

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            if parsed.path == "/health":
                settings = app.current_settings_payload()
                json_response(self, 200, {"ok": True, "status": "ready", "databasePath": settings["databasePath"], "sourceType": settings["sourceType"]})
                return

            if parsed.path == "/api/settings":
                payload = app.current_settings_payload()
                json_response(self, 200, payload)
                return

            if parsed.path == "/api/schema":
                payload = app.schema_payload()
                json_response(self, 200 if payload.get("ok", False) else 500, payload)
                return

            if parsed.path == "/api/template":
                table_name = str(params.get("table", [""])[0])
                action = str(params.get("action", ["select_all"])[0])
                payload = app.template_payload(table_name, action)
                json_response(self, 200 if payload.get("ok", False) else 404, payload)
                return

            json_response(self, 404, {"ok": False, "error": "接口不存在。"})

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path != "/api/query":
                if parsed.path != "/api/settings":
                    json_response(self, 404, {"ok": False, "error": "接口不存在。"})
                    return
                payload = read_json_body(self)
                source_type = str(payload.get("sourceType", "file"))
                database_path = str(payload.get("databasePath", "")).strip()
                settings = app.update_settings(source_type, database_path)
                json_response(self, 200, settings)
                return
            payload = read_json_body(self)
            sql = str(payload.get("sql", "")).strip()
            if not sql:
                json_response(self, 400, {"ok": False, "error": "sql 不能为空。"})
                return
            result = app.query_payload(sql)
            json_response(self, 200 if result.get("ok", False) else 500, result)

        def log_message(self, format: str, *args) -> None:  # noqa: A003
            return

    return Handler


def run_server(config: dict) -> int:
    """启动本地 HTTP 服务。"""

    source_type = str(config.get("source_type", "file")).strip().lower() or "file"
    database_path = str(config.get("database_path", DEFAULT_DATABASE_PATH)).strip() or DEFAULT_DATABASE_PATH
    port = int(config.get("port", 0) or 0) or pick_port()
    app = H2QueryWorkbenchApp(database_path, source_type=source_type)
    server = ThreadingHTTPServer(("127.0.0.1", port), build_handler(app))
    address = f"http://127.0.0.1:{port}/"
    print(json.dumps({"status": "ready", "url": address, "databasePath": database_path, "sourceType": source_type}, ensure_ascii=False))
    if bool(config.get("open_browser", True)):
        Timer(0.6, lambda: webbrowser.open(address)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    """命令行入口。"""

    config: dict = {}
    if len(sys.argv) >= 2:
        config = json.loads(sys.argv[1])
    return run_server(config)


if __name__ == "__main__":
    raise SystemExit(main())
