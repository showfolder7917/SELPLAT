"""编排源码、语言、前端和数据库领域门禁并保持旧结果顺序。"""

from __future__ import annotations

from pathlib import Path
import re
from typing import Any

from .database_governance import (
    audit_managed_datasource_pool_governance, audit_registered_sqlite_database,
    audit_service_direct_jdbc_governance, is_managed_database_application,
    load_managed_database_registry, normalized_identifier, sql_statements,
    table_business_candidates,
)
from .frontend_governance import (
    APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE, audit_frontend_identity_write_governance,
    audit_sel_ui_component_governance, audit_sel_ui_typography_governance,
)
from .language_registry import LANGUAGE_ROOT_NAMES, RULE_ENGINE_MODULE, registered_languages
from .path_classifier import active_stable_user_id, managed_database_registry_path
from .violation_report import build_audit_result


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
FORBIDDEN_APPLICATION_PROTOCOL_SUFFIXES = ("Request", "Response", "Result", "Page", "Param")
BUSINESS_TECHNICAL_LAYER_NAMES = {"controller", "service", "dao", "reference"}
MANAGED_COMMON_ROLE_NAMES = {"config", "persistence", "util"}
MANAGED_COMMON_PERSISTENCE_SUFFIXES = ("BaseDao", "PersistenceConfiguration")
MANAGED_TABLE_BUSINESS_ROLES = {"controller", "service", "dao"}
MANAGED_CAPABILITY_ROLES = {"controller", "service"}
MANAGED_APPLICATION_ROOT_ALLOWLIST = {
    "backend", "frontend", "db", "doc", "README.md", "build.gradle",
    ".selplat-generated-project.json",
}
QUERY_REPRESENTATION_PATHS = {
    "tree": "/tree", "options": "/options", "context-menu": "/context-menu",
}
GENERATED_BUSINESS_DEFAULT_FIELDS = (
    "tenantId", "lastOperateUserId", "sortnum", "labelZh", "labelJa", "labelEn",
    "status", "createdAt", "updatedAt",
)


def audit_source_ownership(project_root: Path = PROJECT_ROOT) -> dict[str, Any]:
    """Report unregistered language roots, misplaced rule abilities, and source pollution."""
    project_root = project_root.resolve()
    stable_user_id = active_stable_user_id(project_root)
    violations: list[dict[str, str]] = []
    # 公共控件登记、源码所有权、依赖顺序和应用私造控件 → 在其他工程扫描前统一阻断。
    violations.extend(audit_sel_ui_component_governance(project_root))
    # 公共组件与应用文字必须消费七级语义角色，旧 primary/secondary 令牌不能重新进入源码。
    violations.extend(audit_sel_ui_typography_governance(project_root))
    central_registrations, registry_violations = load_managed_database_registry(
        project_root, stable_user_id
    )
    violations.extend(registry_violations)
    # 中央登记中的永久业务库 → 必须通过可关闭的具名 Hikari 池访问，禁止再次退回逐次建连。
    violations.extend(audit_managed_datasource_pool_governance(
        project_root, central_registrations
    ))
    # 表业务与 capability Service 只能编排业务 Service/BaseDao，禁止重新手写 JdbcTemplate 查询。
    violations.extend(audit_service_direct_jdbc_governance(project_root))
    # 租户与操作员只由 BaseServiceImpl 写入；应用页面和生成页面不得重新提交同名身份字段。
    violations.extend(audit_frontend_identity_write_governance(project_root))
    generator_template = project_root / APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE
    if generator_template.is_file():
        template_text = generator_template.read_text(encoding="utf-8")
        schema_start = template_text.find("private static String tableSchema()")
        schema_end = template_text.find("private static String daoJava()", schema_start)
        schema_template = (
            template_text[schema_start:schema_end]
            if schema_start >= 0 and schema_end > schema_start
            else ""
        )
        missing_default_fields = [
            field_name
            for field_name in GENERATED_BUSINESS_DEFAULT_FIELDS
            if not re.search(rf"(?m)^\s*{re.escape(field_name)}\s+", schema_template)
        ]
        if missing_default_fields or re.search(r"(?m)^\s*name\s+", schema_template):
            violations.append({
                "code": "APPLICATION_SCAFFOLD_DEFAULT_BUSINESS_FIELDS_INVALID",
                "path": str(APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE),
                "message": (
                    "generated business tables require tenantId, lastOperateUserId, sortnum, "
                    "labelZh, labelJa, labelEn, status, createdAt, and updatedAt; "
                    f"missing={missing_default_fields} and legacy name is forbidden"
                ),
            })
    root_gitignore = project_root / ".gitignore"
    root_gitignore_lines = {
        line.strip()
        for line in root_gitignore.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    } if root_gitignore.is_file() else set()
    required_h2_ignore_rules = {
        "apps/*/db/*.mv.db",
        "*.trace.db",
        "*.lock.db",
        "*.temp.db",
        "*.before-*.db",
    }
    # 只允许精确忽略应用db根中的活跃运行库，避免宽泛规则隐藏测试材料或其他数据库快照。
    overly_broad_mvdb_ignore_rules = {
        "*.mv.db",
        "**/*.mv.db",
    }
    if not required_h2_ignore_rules.issubset(root_gitignore_lines) \
            or overly_broad_mvdb_ignore_rules.intersection(root_gitignore_lines):
        violations.append({
            "code": "ROOT_H2_GITIGNORE_POLICY_INVALID",
            "path": ".gitignore",
            "message": (
                "root .gitignore must ignore apps/*/db/*.mv.db exactly and must also exclude "
                "H2 trace, lock, temp, and before-backup files without broad mv.db patterns"
            ),
        })
    checked_language_roots = 0

    # ruleengine 不是后端模块，直接检查扁平 Python 根和允许的分层，避免通用 src/main 扫描漏检。
    ruleengine_root = project_root / RULE_ENGINE_MODULE
    ruleengine_python_root = ruleengine_root / "python"
    forbidden_ruleengine_roots = [
        ruleengine_root / "backend",
        ruleengine_root / "src",
        ruleengine_root / "docs",
        ruleengine_python_root / "com",
    ]
    for forbidden_root in forbidden_ruleengine_roots:
        if forbidden_root.exists():
            violations.append({
                "code": "RULE_ENGINE_LEGACY_LAYOUT_FORBIDDEN",
                "path": str(forbidden_root.relative_to(project_root)),
                "message": "ruleengine must use python, rules, tests without backend/src/docs or Java package nesting",
            })
    if ruleengine_python_root.is_dir():
        checked_language_roots += 1
        allowed_python_roots = [
            ruleengine_python_root / "ruleengine",
            ruleengine_python_root / "local/core",
            ruleengine_python_root / "local/common",
            ruleengine_python_root / "local" / stable_user_id,
        ]
        for source_file in sorted(path for path in ruleengine_python_root.rglob("*") if path.is_file()):
            relative_source = source_file.relative_to(project_root)
            if not any(source_file.is_relative_to(root) for root in allowed_python_roots):
                violations.append({
                    "code": "RULE_ENGINE_SOURCE_OUTSIDE_FLAT_ROOT",
                    "path": str(relative_source),
                    "message": "ruleengine Python source must be below ruleengine or local/<layer>",
                })
                continue
            if source_file.suffix != ".py":
                violations.append({
                    "code": "LANGUAGE_ROOT_FOREIGN_FILE",
                    "path": str(relative_source),
                    "message": "unexpected non-Python file in ruleengine Python root",
                })

    for area_name in ("apps", "shared"):
        area_root = project_root / area_name
        if not area_root.exists():
            continue
        for nested_gitignore in sorted(area_root.rglob(".gitignore")):
            violations.append({
                "code": "NESTED_GITIGNORE_FORBIDDEN",
                "path": str(nested_gitignore.relative_to(project_root)),
                "message": "all repository ignore rules belong only in the SELPLAT root .gitignore",
            })

    for area_name in ("apps", "shared"):
        area_root = project_root / area_name
        if not area_root.exists():
            continue
        for source_main in sorted(path for path in area_root.rglob("src/main") if path.is_dir()):
            module_root = source_main.parent.parent
            allowed = registered_languages(project_root, module_root)
            for language_root in sorted(path for path in source_main.iterdir() if path.is_dir()):
                language = language_root.name
                if language not in LANGUAGE_ROOT_NAMES:
                    continue
                checked_language_roots += 1
                relative_language_root = language_root.relative_to(project_root)
                if language not in allowed:
                    violations.append({
                        "code": "UNREGISTERED_LANGUAGE_ROOT",
                        "path": str(relative_language_root),
                        "message": f"{module_root.relative_to(project_root)} does not register {language}",
                    })
                    continue

    for area_name in ("apps", "shared"):
        area_root = project_root / area_name
        if not area_root.exists():
            continue
        pollution_paths = sorted({
            *area_root.rglob("__pycache__"),
            *area_root.rglob("*.pyc"),
            *area_root.rglob(".DS_Store"),
        })
        for pollution_path in pollution_paths:
            # 普通模块检查 src，扁平 ruleengine 则检查整个模块，确保迁移后源码缓存仍被阻断。
            if "src" not in pollution_path.parts and not pollution_path.is_relative_to(ruleengine_root):
                continue
            violations.append({
                "code": "SOURCE_TREE_GENERATED_OR_OS_FILE",
                "path": str(pollution_path.relative_to(project_root)),
                "message": "generated cache or OS metadata is forbidden in source trees",
            })

    apps_root = project_root / "apps"
    if apps_root.exists():
        for registered_project in sorted(central_registrations):
            if not (apps_root / registered_project).is_dir():
                violations.append({
                    "code": "MANAGED_DATABASE_REGISTERED_PROJECT_MISSING",
                    "path": str(managed_database_registry_path(
                        project_root, stable_user_id).relative_to(project_root)),
                    "message": f"centrally registered application apps/{registered_project} is missing",
                })
        for java_file in sorted(apps_root.rglob("*.java")):
            relative_source = java_file.relative_to(project_root)
            if "src" not in relative_source.parts or "main" not in relative_source.parts:
                continue
            if java_file.stem.endswith(FORBIDDEN_APPLICATION_PROTOCOL_SUFFIXES):
                violations.append({
                    "code": "APPLICATION_PRIVATE_COMMON_PROTOCOL_TYPE",
                    "path": str(relative_source),
                    "message": (
                        "application HTTP input/output must reuse shared CommonParam, "
                        "CommonBatchParam, CommonPageParam, CommonResult, or common page results"
                    ),
                })
            if "domain" in relative_source.parts:
                violations.append({
                    "code": "APPLICATION_UNUSED_TABLE_DOMAIN_TYPE",
                    "path": str(relative_source),
                    "message": (
                        "application CRUD must use CommonParam, maps, and database metadata; "
                        "do not generate an unreferenced table-mirror domain type"
                    ),
                })

        for project_root_path in sorted(path for path in apps_root.iterdir() if path.is_dir()):
            legacy_local_registration = (
                project_root_path / ".selplat-managed-database-application.json"
            )
            if legacy_local_registration.is_file():
                violations.append({
                    "code": "MANAGED_DATABASE_APPLICATION_LOCAL_REGISTRY_FORBIDDEN",
                    "path": str(legacy_local_registration.relative_to(project_root)),
                    "message": "managed database application facts belong only in the central registry",
                })
            if not is_managed_database_application(project_root_path, central_registrations):
                continue
            service_contracts: dict[str, list[Path]] = {}
            service_implementations: dict[str, list[Path]] = {}
            registration = central_registrations.get(project_root_path.name, {})
            registered_database = project_root_path.name in central_registrations
            if not registered_database:
                violations.append({
                    "code": "MANAGED_DATABASE_APPLICATION_CENTRAL_REGISTRATION_MISSING",
                    "path": str(project_root_path.relative_to(project_root)),
                    "message": (
                        "every generated application or application with db/sql must be registered "
                        "centrally before the uniform architecture gate can pass"
                    ),
                })
            if registered_database and registration.get("databaseEngine") == "sqlite":
                violations.extend(audit_registered_sqlite_database(
                    project_root,
                    project_root_path,
                    registration,
                    managed_database_registry_path(project_root, stable_user_id),
                ))
                continue
            if registered_database:
                for root_entry in sorted(project_root_path.iterdir()):
                    if root_entry.name not in MANAGED_APPLICATION_ROOT_ALLOWLIST:
                        violations.append({
                            "code": "MANAGED_DATABASE_APPLICATION_ROOT_CONTENT_FORBIDDEN",
                            "path": str(root_entry.relative_to(project_root)),
                            "message": (
                                "managed database applications may contain only their real "
                                "backend, frontend, db, doc, README, root build, and generator ownership"
                            ),
                        })
            backend_java_root = project_root_path / "backend/src/main/java"
            application_package_roots = sorted(
                path for path in (backend_java_root / "com/sp/selplat").glob("*")
                if path.is_dir()
            )
            business_directories: list[Path] = []
            capability_directories: list[Path] = []
            for application_package_root in application_package_roots:
                business_directories.extend(sorted(
                    path for path in application_package_root.iterdir()
                    if path.is_dir() and path.name not in {"common", "capability"}
                ))
                capability_root = application_package_root / "capability"
                if capability_root.is_dir():
                    capability_directories.extend(sorted(
                        path for path in capability_root.iterdir() if path.is_dir()
                    ))
            schema_tables = {
                schema_file.stem.removeprefix("schema-")
                for schema_file in (project_root_path / "db/sql").glob("schema-*.sql")
            }
            if registered_database:
                contract_root = project_root_path / "contract"
                if contract_root.is_dir():
                    contract_package = normalized_identifier(project_root_path.name)
                    external_contract_import = f"com.sp.selplat.{contract_package}.contract."
                    external_contract_callers = [
                        java_file
                        for java_file in sorted(apps_root.rglob("*.java"))
                        if not java_file.is_relative_to(project_root_path)
                        and external_contract_import in java_file.read_text(encoding="utf-8")
                    ]
                    if not external_contract_callers:
                        violations.append({
                            "code": "MANAGED_APPLICATION_UNUSED_CONTRACT_MODULE",
                            "path": str(contract_root.relative_to(project_root)),
                            "message": (
                                "application contract modules require a real external production Java caller; "
                                "internal response shapes must use shared CommonResult and Map/List"
                            ),
                        })
                manifest_root = project_root_path / "manifest"
                if manifest_root.is_dir():
                    manifest_consumer = registration.get("manifestConsumer")
                    consumer_file = (
                        project_root / manifest_consumer
                        if isinstance(manifest_consumer, str) and manifest_consumer.strip()
                        else None
                    )
                    consumer_is_valid = (
                        consumer_file is not None
                        and consumer_file.resolve().is_relative_to(project_root)
                        and consumer_file.is_file()
                        and "src/main" in consumer_file.as_posix()
                        and "manifest/module.json" in consumer_file.read_text(encoding="utf-8")
                    )
                    if not consumer_is_valid:
                        violations.append({
                            "code": "MANAGED_APPLICATION_UNUSED_MANIFEST_DIRECTORY",
                            "path": str(manifest_root.relative_to(project_root)),
                            "message": (
                                "application manifest requires a root-relative manifestConsumer "
                                "that is a real src/main reader of manifest/module.json"
                            ),
                        })
                expected_database_file = f"db/{project_root_path.name}.mv.db"
                registry_path = managed_database_registry_path(project_root, stable_user_id)
                if registration.get("databaseFile") != expected_database_file:
                    violations.append({
                        "code": "MANAGED_APPLICATION_DATABASE_FILE_REGISTRATION_INVALID",
                        "path": str(registry_path.relative_to(project_root)),
                        "message": f"databaseFile must be {expected_database_file}",
                    })
                datasource_prefix = registration.get("datasourcePrefix")
                if not isinstance(datasource_prefix, str) or not re.fullmatch(
                        r"[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+", datasource_prefix):
                    violations.append({
                        "code": "MANAGED_APPLICATION_DATASOURCE_PREFIX_INVALID",
                        "path": str(registry_path.relative_to(project_root)),
                        "message": "strict database applications must declare a safe datasourcePrefix",
                    })
                else:
                    resource_root = project_root_path / "backend/src/main/resources"
                    property_text = "\n".join(
                        properties_file.read_text(encoding="utf-8")
                        for properties_file in sorted(resource_root.glob("*.properties"))
                    ) if resource_root.is_dir() else ""
                    expected_credentials = {
                        f"{datasource_prefix}.username": "sa",
                        f"{datasource_prefix}.password": "123456",
                    }
                    for property_name, expected_value in expected_credentials.items():
                        property_matches = re.findall(
                            rf"(?m)^{re.escape(property_name)}\s*=\s*([^\r\n]*)$",
                            property_text,
                        )
                        if property_matches != [expected_value]:
                            violations.append({
                                "code": "MANAGED_APPLICATION_DEFAULT_DATABASE_CREDENTIAL_INVALID",
                                "path": str(resource_root.relative_to(project_root)),
                                "message": f"{property_name} must be declared exactly once as {expected_value}",
                            })
                for database_file in sorted((project_root_path / "db").rglob("*.mv.db")):
                    if database_file.parent != project_root_path / "db" \
                            or database_file.name != f"{project_root_path.name}.mv.db":
                        violations.append({
                            "code": "MANAGED_APPLICATION_DATABASE_FILE_LOCATION_INVALID",
                            "path": str(database_file.relative_to(project_root)),
                            "message": "the permanent H2 file must be db/<application-name>.mv.db",
                        })
                common_sequence_schema = project_root_path / "db/sql/schema-CommonSequenceSegment.sql"
                common_sequence_data = project_root_path / "db/sql/data-CommonSequenceSegment.sql"
                if not common_sequence_schema.is_file() or not common_sequence_data.is_file():
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_SEQUENCE_SQL_MISSING",
                        "path": str((project_root_path / "db/sql").relative_to(project_root)),
                        "message": "strict database applications require CommonSequenceSegment schema and data SQL",
                    })
                else:
                    sequence_data_text = common_sequence_data.read_text(encoding="utf-8")
                    sequence_insert_heads = [
                        statement.split("WHERE NOT EXISTS", 1)[0]
                        for statement in sequence_data_text.split(";")
                        if re.search(r"INSERT\s+INTO\s+CommonSequenceSegment", statement, re.IGNORECASE)
                    ]
                    # 普通应用保持一表一号段；共享全局 code 命名空间的聚合应用只允许登记一个显式聚合号段。
                    if sequence_insert_heads:
                        if registration.get("primaryKeyStrategy") == "aggregate-global-code-sequence":
                            sequence_code = str(registration.get("aggregateSequenceCode", ""))
                            declaration_count = sum(1 for insert_head in sequence_insert_heads
                                if re.search(rf"['\"]{re.escape(sequence_code)}['\"]", insert_head))
                            if declaration_count != 1 or len(sequence_insert_heads) != 1:
                                violations.append({
                                    "code": "MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID",
                                    "path": str(common_sequence_data.relative_to(project_root)),
                                    "message": f"aggregate code namespace must declare exactly one {sequence_code} row",
                                })
                        else:
                            for table_name in sorted(schema_tables):
                                if table_name.startswith("Common"):
                                    continue
                                sequence_code = f"{table_name}Id"
                                declaration_count = sum(1 for insert_head in sequence_insert_heads
                                    if re.search(rf"['\"]{re.escape(sequence_code)}['\"]", insert_head))
                                if declaration_count != 1:
                                    violations.append({
                                        "code": "MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID",
                                        "path": str(common_sequence_data.relative_to(project_root)),
                                        "message": f"configured sequence data must map {table_name} to exactly one {sequence_code} row",
                                    })
                recovery_tables = registration.get("startupRecoveryTables", [])
                if not isinstance(recovery_tables, list) or any(
                        not isinstance(table_name, str)
                        or not re.fullmatch(r"[A-Z][A-Za-z0-9]*", table_name)
                        for table_name in recovery_tables):
                    violations.append({
                        "code": "MANAGED_APPLICATION_RECOVERY_TABLE_REGISTRATION_INVALID",
                        "path": str(registry_path.relative_to(project_root)),
                        "message": "startupRecoveryTables must be a list of safe physical table names",
                    })
                    recovery_tables = []
                production_java_text = "\n".join(
                    java_file.read_text(encoding="utf-8")
                    for java_file in sorted(backend_java_root.rglob("*.java"))
                ) if backend_java_root.is_dir() else ""
                for table_name in recovery_tables:
                    recovery_data_file = project_root_path / "db/sql" / f"data-{table_name}.sql"
                    if not recovery_data_file.is_file():
                        violations.append({
                            "code": "MANAGED_APPLICATION_RECOVERY_DATA_SQL_MISSING",
                            "path": str((project_root_path / "db/sql").relative_to(project_root)),
                            "message": f"recovery table {table_name} requires data-{table_name}.sql",
                        })
                        continue
                    expected_resource = f"db/{project_root_path.name}/sql/data-{table_name}.sql"
                    if expected_resource not in production_java_text:
                        violations.append({
                            "code": "MANAGED_APPLICATION_RECOVERY_DATA_SQL_NOT_LOADED",
                            "path": str(recovery_data_file.relative_to(project_root)),
                            "message": f"production initializer must explicitly load {expected_resource}",
                        })
                for table_name in sorted(schema_tables):
                    schema_file = project_root_path / "db/sql" / f"schema-{table_name}.sql"
                    schema_text = schema_file.read_text(encoding="utf-8")
                    if not table_name.startswith("Common") and re.search(
                            r"\bid\s+BIGINT\s+GENERATED\b", schema_text, re.IGNORECASE):
                        violations.append({
                            "code": "MANAGED_APPLICATION_BUSINESS_IDENTITY_FORBIDDEN",
                            "path": str(schema_file.relative_to(project_root)),
                            "message": "business table ids must use the registered SequenceGenerator strategy, not database identity",
                        })
                    for statement in sql_statements(schema_text):
                        normalized_statement = re.sub(r"\s+", " ", statement).upper()
                        if normalized_statement.startswith("CREATE TABLE ") \
                                and not normalized_statement.startswith("CREATE TABLE IF NOT EXISTS "):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_CREATE_NOT_IDEMPOTENT",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "schema CREATE TABLE must use IF NOT EXISTS",
                            })
                        if normalized_statement.startswith("CREATE INDEX ") \
                                and not normalized_statement.startswith("CREATE INDEX IF NOT EXISTS "):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_INDEX_NOT_IDEMPOTENT",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "schema CREATE INDEX must use IF NOT EXISTS",
                            })
                        if re.match(
                                r"^(DROP\s+(TABLE|SCHEMA|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM)",
                                normalized_statement):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_DESTRUCTIVE_REFRESH_FORBIDDEN",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "startup schema SQL must not clear or drop existing database content",
                            })
                        if normalized_statement.startswith("ALTER TABLE ") \
                                and " IF EXISTS" not in normalized_statement \
                                and " IF NOT EXISTS" not in normalized_statement:
                            violations.append({
                                "code": "MANAGED_APPLICATION_SCHEMA_ALTER_NOT_IDEMPOTENT",
                                "path": str(schema_file.relative_to(project_root)),
                                "message": "startup ALTER TABLE must include IF EXISTS or IF NOT EXISTS",
                            })
                for data_file in sorted((project_root_path / "db/sql").glob("data-*.sql")):
                    for statement in sql_statements(data_file.read_text(encoding="utf-8")):
                        normalized_statement = re.sub(r"\s+", " ", statement).upper()
                        # 显式 id 种子只能占用最多六位的应用初始区，阻断历史 900000004003 一类超长固定编号。
                        seed_id_match = re.search(
                            r"INSERT\s+INTO\s+\w+\s*\(\s*id\b[^)]*\)\s*SELECT\s+(\d+)\b",
                            statement,
                            re.IGNORECASE | re.DOTALL,
                        )
                        if seed_id_match and int(seed_id_match.group(1)) > 999999:
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_ID_TOO_LONG",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "fixed startup seed ids must not exceed the six-digit initial range",
                            })
                        if normalized_statement.startswith("MERGE INTO "):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_MERGE_OVERWRITE_FORBIDDEN",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "startup seed SQL must not MERGE over existing rows",
                            })
                        if normalized_statement.startswith("INSERT INTO ") \
                                and "NOT EXISTS" not in normalized_statement:
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_INSERT_NOT_IDEMPOTENT",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "seed INSERT must add only a missing stable business coordinate",
                            })
                        if re.match(
                                r"^(UPDATE|DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+|ALTER\s+|CREATE\s+)",
                                normalized_statement):
                            violations.append({
                                "code": "MANAGED_APPLICATION_SEED_EXISTING_DATA_WRITE_FORBIDDEN",
                                "path": str(data_file.relative_to(project_root)),
                                "message": "startup data SQL may only insert missing rows or execute read-only no-op SQL",
                            })
            table_candidates = {
                table_name: table_business_candidates(table_name, project_root_path.name)
                for table_name in schema_tables
            }
            business_names = {
                normalized_identifier(directory.name): directory
                for directory in business_directories
            }
            for business_name, business_directory in business_names.items():
                if not any(business_name in candidates for candidates in table_candidates.values()):
                    violations.append({
                        "code": "MANAGED_APPLICATION_BUSINESS_WITHOUT_TABLE",
                        "path": str(business_directory.relative_to(project_root)),
                        "message": "common-external business directories must map to one real schema table",
                    })
                actual_roles = {
                    path.name for path in business_directory.iterdir() if path.is_dir()
                }
                if actual_roles != MANAGED_TABLE_BUSINESS_ROLES:
                    violations.append({
                        "code": "MANAGED_APPLICATION_TABLE_BUSINESS_ROLE_SET_INVALID",
                        "path": str(business_directory.relative_to(project_root)),
                        "message": (
                            "each table business must contain exactly controller, service, and dao; "
                            "service/impl remains the only nested implementation role"
                        ),
                    })
            for capability_directory in capability_directories:
                actual_roles = {
                    path.name for path in capability_directory.iterdir() if path.is_dir()
                }
                if actual_roles != MANAGED_CAPABILITY_ROLES:
                    violations.append({
                        "code": "MANAGED_APPLICATION_CAPABILITY_ROLE_SET_INVALID",
                        "path": str(capability_directory.relative_to(project_root)),
                        "message": (
                            "each non-persistent capability must contain exactly controller and "
                            "service; reusable implementation helpers belong below common/util"
                        ),
                    })
            for table_name, candidates in table_candidates.items():
                if table_name.startswith("Common"):
                    continue
                if not candidates.intersection(business_names):
                    violations.append({
                        "code": "MANAGED_APPLICATION_TABLE_WITHOUT_BUSINESS",
                        "path": str((project_root_path / "db/sql" / f"schema-{table_name}.sql")
                                    .relative_to(project_root)),
                        "message": "each business schema table must have one common-external business directory",
                    })
            for java_file in sorted(backend_java_root.rglob("*.java")):
                relative_source = java_file.relative_to(project_root)
                parts = relative_source.parts
                try:
                    java_index = parts.index("java")
                except ValueError:
                    continue
                package_tail = parts[java_index + 5:]
                source_text = java_file.read_text(encoding="utf-8")
                type_declaration = re.search(
                    r"\b(?:public\s+)?(?:class|interface|record|enum)\s+", source_text
                )
                declaration_header = (
                    source_text[:type_declaration.start()] if type_declaration else source_text
                )
                if (len(package_tail) >= 3
                        and package_tail[0] in BUSINESS_TECHNICAL_LAYER_NAMES):
                    violations.append({
                        "code": "MANAGED_APPLICATION_TECHNICAL_FIRST_PACKAGE",
                        "path": str(relative_source),
                        "message": (
                            "managed database applications must use <business>/"
                            "controller|service|dao|verified-extension, while reusable infrastructure "
                            "belongs below common"
                        ),
                    })
                if (len(package_tail) >= 3
                        and package_tail[0] == "common"
                        and package_tail[1] not in MANAGED_COMMON_ROLE_NAMES):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_ROLE_OUTSIDE_ALLOWLIST",
                        "path": str(relative_source),
                        "message": (
                            "managed application common packages are limited to config, "
                            "persistence, and util/<actual-capability>"
                        ),
                    })
                if (len(package_tail) == 3
                        and package_tail[0] == "common"
                        and package_tail[1] == "persistence"
                        and not java_file.stem.endswith(MANAGED_COMMON_PERSISTENCE_SUFFIXES)):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_PERSISTENCE_ROLE_INVALID",
                        "path": str(relative_source),
                        "message": (
                            "managed application common/persistence is limited to the project "
                            "BaseDao and PersistenceConfiguration; inject qualified infrastructure "
                            "beans instead of creating database context wrapper classes"
                        ),
                    })
                if (len(package_tail) >= 3
                        and package_tail[0] == "common"
                        and package_tail[1] == "util"
                        and (java_file.stem.endswith(("Controller", "Service", "Dao"))
                             or re.search(
                                 r"@(RestController|Service|Repository)\b", declaration_header
                             ))):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_UTIL_BUSINESS_ROLE",
                        "path": str(relative_source),
                            "message": "common/util is limited to stateless methods called by services",
                    })
                if package_tail and package_tail[0] == "capability":
                    valid_capability_source = (
                        len(package_tail) == 4
                        and package_tail[2] in MANAGED_CAPABILITY_ROLES
                    ) or (
                        len(package_tail) == 5
                        and package_tail[2] == "service"
                        and package_tail[3] == "impl"
                    )
                    if not valid_capability_source:
                        violations.append({
                            "code": "MANAGED_APPLICATION_CAPABILITY_SOURCE_ROLE_INVALID",
                            "path": str(relative_source),
                            "message": (
                                "capability source belongs only in <capability>/controller, "
                                "<capability>/service, or <capability>/service/impl"
                            ),
                        })
                if (len(package_tail) >= 3
                        and package_tail[0] not in {"common", "capability"}):
                    current_business = package_tail[0]
                    current_role = package_tail[1]
                    application_package = parts[java_index + 4]
                    imported_roles = re.findall(
                        r"import\s+com\.sp\.selplat\.[^.]+\.([^.]+)\.(dao|service)\.",
                        source_text,
                    )
                    if (current_role == "controller"
                            and any(role == "service" and business != current_business
                                    for business, role in imported_roles)):
                        violations.append({
                            "code": "MANAGED_APPLICATION_CONTROLLER_FOREIGN_SERVICE",
                            "path": str(relative_source),
                            "message": "table controllers may call only their own table service",
                        })
                    if (current_role == "service"
                            and any(role == "dao" and business != current_business
                                    for business, role in imported_roles)):
                        violations.append({
                            "code": "MANAGED_APPLICATION_CROSS_TABLE_DAO_ACCESS",
                            "path": str(relative_source),
                            "message": "cross-table workflows must call the other table service, not its dao",
                        })
                    application_util_package = f"com.sp.selplat.{application_package}.common.util."
                    if application_util_package in source_text and current_role != "service":
                        violations.append({
                            "code": "MANAGED_APPLICATION_COMMON_UTIL_CALLED_OUTSIDE_SERVICE",
                            "path": str(relative_source),
                            "message": "application common utilities are provided to table services only",
                        })
                if (len(package_tail) >= 3 and package_tail[0] == "capability"):
                    application_package = parts[java_index + 4]
                    application_util_package = f"com.sp.selplat.{application_package}.common.util."
                    if application_util_package in source_text and package_tail[2] != "service":
                        violations.append({
                            "code": "MANAGED_APPLICATION_COMMON_UTIL_CALLED_OUTSIDE_SERVICE",
                            "path": str(relative_source),
                            "message": "application common utilities are provided to capability services only",
                        })
                if (len(package_tail) == 3
                        and package_tail[0] not in {"common", "capability"}
                        and package_tail[1] == "service"
                        and java_file.stem.endswith("Service")):
                    service_contracts.setdefault(package_tail[0], []).append(java_file)
                if (len(package_tail) == 4
                        and package_tail[0] != "common"
                        and package_tail[1] == "service"
                        and package_tail[2] == "impl"
                        and java_file.stem.endswith("ServiceImpl")):
                    service_implementations.setdefault(package_tail[0], []).append(java_file)
                if (len(package_tail) == 4
                        and package_tail[0] == "capability"
                        and package_tail[2] == "service"
                        and java_file.stem.endswith("Service")):
                    service_contracts.setdefault(
                        f"capability/{package_tail[1]}", []
                    ).append(java_file)
                if (len(package_tail) == 5
                        and package_tail[0] == "capability"
                        and package_tail[2] == "service"
                        and package_tail[3] == "impl"
                        and java_file.stem.endswith("ServiceImpl")):
                    service_implementations.setdefault(
                        f"capability/{package_tail[1]}", []
                    ).append(java_file)
                if "controller" in package_tail:
                    representations = {
                        name for name, path_suffix in QUERY_REPRESENTATION_PATHS.items()
                        if path_suffix in source_text
                    }
                    uses_polymorphic_node_model = (
                        registration.get("queryRepresentationModel") == "type-plus-tree-node"
                    )
                    if len(representations) > 1 and not uses_polymorphic_node_model:
                        violations.append({
                            "code": "MANAGED_APPLICATION_QUERY_REPRESENTATIONS_MIXED_CONTROLLER",
                            "path": str(relative_source),
                            "message": (
                                "mixed tree, options, and context-menu HTTP representations require "
                                "an explicit type-plus-tree-node central registration"
                            ),
                        })

            for business in sorted(service_contracts.keys() | service_implementations.keys()):
                contracts = service_contracts.get(business, [])
                implementations = service_implementations.get(business, [])
                if len(contracts) == 1 and len(implementations) == 1:
                    continue
                violations.append({
                    "code": "MANAGED_APPLICATION_BUSINESS_SERVICE_CARDINALITY",
                    "path": str(project_root_path.relative_to(project_root) / business / "service"),
                    "message": (
                        "each managed business must have exactly one Service contract and "
                        "one service/impl implementation"
                    ),
                })

    return build_audit_result(violations, checked_language_roots)
