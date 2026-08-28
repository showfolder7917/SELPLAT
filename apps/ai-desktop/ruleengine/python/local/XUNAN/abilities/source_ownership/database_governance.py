"""审查中央数据库登记、连接池、SQLite、SQL 与业务表辅助事实。"""

from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any

from .path_classifier import managed_database_registry_path


DATABASE_RUNTIME_TYPES = {"java-gradle", "electron"}
DATABASE_ENGINES = {"h2", "sqlite"}


def load_managed_database_registry(
        project_root: Path,
        stable_user_id: str) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    """Load and validate the central registry without inferring applications from directories."""
    registry_path = managed_database_registry_path(project_root, stable_user_id)
    if not registry_path.is_file():
        return {}, [{
            "code": "MANAGED_DATABASE_REGISTRY_MISSING",
            "path": str(registry_path.relative_to(project_root)),
            "message": "the active user's central managed-database registry is required",
        }]
    relative_registry = str(registry_path.relative_to(project_root))
    try:
        document = json.loads(registry_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exception:
        return {}, [{
            "code": "MANAGED_DATABASE_REGISTRY_INVALID",
            "path": relative_registry,
            "message": f"central managed-database registry is unreadable: {exception}",
        }]
    applications = document.get("applications") if isinstance(document, dict) else None
    if not isinstance(document, dict) or document.get("version") != 1 \
            or not isinstance(applications, list):
        return {}, [{
            "code": "MANAGED_DATABASE_REGISTRY_INVALID",
            "path": relative_registry,
            "message": "central managed-database registry requires version 1 and an applications array",
        }]
    registrations: dict[str, dict[str, Any]] = {}
    violations: list[dict[str, str]] = []
    for application in applications:
        project_name = application.get("projectName") if isinstance(application, dict) else None
        if not isinstance(project_name, str) or not re.fullmatch(
                r"[a-z][a-z0-9-]{0,31}", project_name):
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_PROJECT_INVALID",
                "path": relative_registry,
                "message": "every central registration requires a safe lowercase projectName",
            })
            continue
        if project_name in registrations:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_PROJECT_DUPLICATE",
                "path": relative_registry,
                "message": f"projectName {project_name} must be registered exactly once",
            })
            continue
        registrations[project_name] = application
        runtime_type = application.get("runtimeType")
        database_engine = application.get("databaseEngine")
        if runtime_type not in DATABASE_RUNTIME_TYPES or database_engine not in DATABASE_ENGINES:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_RUNTIME_INVALID",
                "path": relative_registry,
                "message": (
                    f"{project_name} requires runtimeType in {sorted(DATABASE_RUNTIME_TYPES)} "
                    f"and databaseEngine in {sorted(DATABASE_ENGINES)}"
                ),
            })
            continue
        expected_runtime_type = "java-gradle" if database_engine == "h2" else "electron"
        if runtime_type != expected_runtime_type:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_RUNTIME_ENGINE_MISMATCH",
                "path": relative_registry,
                "message": (
                    f"{project_name}.{database_engine} requires runtimeType={expected_runtime_type}"
                ),
            })
        if "structure" in application:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_SPECIAL_STRUCTURE_FORBIDDEN",
                "path": relative_registry,
                "message": (
                    f"{project_name}.structure is forbidden; every managed application "
                    "must use the same table-business, capability, and common architecture"
                ),
            })
        expected_fixed_values = {"schemaRoot": "db/sql"}
        for field_name, expected_value in expected_fixed_values.items():
            if application.get(field_name) != expected_value:
                violations.append({
                    "code": "MANAGED_DATABASE_REGISTRY_POLICY_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name}.{field_name} must be {expected_value}",
                })
        if database_engine == "sqlite":
            database_file = application.get("databaseFile")
            path_config = application.get("pathConfig")
            if not isinstance(database_file, str) or not re.fullmatch(
                    r"db/[a-z][a-z0-9._-]*\.sqlite3", database_file):
                violations.append({
                    "code": "MANAGED_DATABASE_SQLITE_FILE_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name}.databaseFile must be a safe db/*.sqlite3 path",
                })
            if not isinstance(path_config, str) or not re.fullmatch(
                    r"db/[a-z][a-z0-9._-]*\.json", path_config):
                violations.append({
                    "code": "MANAGED_DATABASE_SQLITE_PATH_CONFIG_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name}.pathConfig must be a safe db/*.json path",
                })
            for forbidden_field in ("datasourcePrefix", "primaryKeyStrategy"):
                if forbidden_field in application:
                    violations.append({
                        "code": "MANAGED_DATABASE_SQLITE_H2_FIELD_FORBIDDEN",
                        "path": relative_registry,
                        "message": f"{project_name}.{forbidden_field} belongs only to H2 governance",
                    })
            continue
        primary_key_strategy = application.get("primaryKeyStrategy")
        if primary_key_strategy not in {
                "one-table-one-sequence", "aggregate-global-code-sequence"}:
            violations.append({
                "code": "MANAGED_DATABASE_REGISTRY_POLICY_INVALID",
                "path": relative_registry,
                "message": (
                    f"{project_name}.primaryKeyStrategy must be one-table-one-sequence "
                    "or aggregate-global-code-sequence"
                ),
            })
        if primary_key_strategy == "aggregate-global-code-sequence":
            aggregate_sequence_code = application.get("aggregateSequenceCode")
            if not isinstance(aggregate_sequence_code, str) or not re.fullmatch(
                    r"[A-Z][A-Za-z0-9]{1,99}Id", aggregate_sequence_code):
                violations.append({
                    "code": "MANAGED_DATABASE_AGGREGATE_SEQUENCE_REGISTRATION_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name} aggregate strategy requires a safe aggregateSequenceCode",
                })
            if application.get("globalCodeNamespace") is not True:
                violations.append({
                    "code": "MANAGED_DATABASE_AGGREGATE_SEQUENCE_REGISTRATION_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name} aggregate strategy requires globalCodeNamespace=true",
                })
            if application.get("codePrefixStrategy") != "object-kind-plus-global-id":
                violations.append({
                    "code": "MANAGED_DATABASE_CODE_PREFIX_STRATEGY_INVALID",
                    "path": relative_registry,
                    "message": (
                        f"{project_name} aggregate code namespace must use "
                        "codePrefixStrategy=object-kind-plus-global-id"
                    ),
                })
        query_representation_model = application.get("queryRepresentationModel")
        if query_representation_model not in {None, "type-plus-tree-node"}:
            violations.append({
                "code": "MANAGED_DATABASE_QUERY_REPRESENTATION_MODEL_INVALID",
                "path": relative_registry,
                "message": (
                    f"{project_name}.queryRepresentationModel must be type-plus-tree-node "
                    "when an explicit polymorphic node model is used"
                ),
            })
    return registrations, violations


def audit_managed_datasource_pool_governance(
        project_root: Path,
        registrations: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    """Require every centrally managed database application to own one qualified Hikari pool."""
    violations: list[dict[str, str]] = []
    forbidden_source_patterns = {
        "DriverManagerDataSource": "Spring DriverManagerDataSource",
        "SimpleDriverDataSource": "Spring SimpleDriverDataSource",
        "DriverManager.getConnection": "direct DriverManager connection",
        "DataSourceBuilder.create": "untyped DataSourceBuilder creation",
    }
    for project_name, registration in sorted(registrations.items()):
        # Hikari 是 Java/H2 合同；Electron/SQLite 使用主进程单连接，不进入 Java 连接池门禁。
        if registration.get("databaseEngine") != "h2":
            continue
        application_root = project_root / "apps" / project_name
        java_root = application_root / "backend/src/main/java"
        if not java_root.is_dir():
            continue
        java_files = sorted(java_root.rglob("*.java"))
        for java_file in java_files:
            source_text = java_file.read_text(encoding="utf-8")
            for forbidden_pattern, forbidden_name in forbidden_source_patterns.items():
                if forbidden_pattern in source_text:
                    violations.append({
                        "code": "MANAGED_APPLICATION_UNPOOLED_DATASOURCE_FORBIDDEN",
                        "path": str(java_file.relative_to(project_root)),
                        "message": (
                            f"{project_name} uses {forbidden_name}; managed private databases "
                            "must use a qualified HikariDataSource"
                        ),
                    })

        persistence_files = sorted(java_root.rglob("*PersistenceConfiguration.java"))
        datasource_prefix = registration.get("datasourcePrefix")
        hikari_contract_markers = (
            "com.zaxxer.hikari.HikariConfig",
            "com.zaxxer.hikari.HikariDataSource",
            "@ConfigurationProperties",
            "destroyMethod = \"close\"",
            "new HikariDataSource(",
        )
        matching_pool_configuration = None
        for persistence_file in persistence_files:
            source_text = persistence_file.read_text(encoding="utf-8")
            if all(marker in source_text for marker in hikari_contract_markers) \
                    and isinstance(datasource_prefix, str) \
                    and re.search(
                        rf"@ConfigurationProperties\(prefix\s*=\s*\"{re.escape(datasource_prefix)}\"\)",
                        source_text,
                    ):
                matching_pool_configuration = persistence_file
                break
        if matching_pool_configuration is None:
            violations.append({
                "code": "MANAGED_APPLICATION_HIKARI_POOL_CONFIGURATION_MISSING",
                "path": str((application_root / "backend/src/main/java").relative_to(project_root)),
                "message": (
                    f"{project_name} requires one PersistenceConfiguration with qualified "
                    "HikariConfig, HikariDataSource, ConfigurationProperties, and destroyMethod=close"
                ),
            })

        resource_root = application_root / "backend/src/main/resources"
        property_text = "\n".join(
            properties_file.read_text(encoding="utf-8")
            for properties_file in sorted(resource_root.glob("*.properties"))
        ) if resource_root.is_dir() else ""
        required_pool_properties = (
            "jdbc-url",
            "pool-name",
            "driver-class-name",
            "minimum-idle",
            "maximum-pool-size",
        )
        if isinstance(datasource_prefix, str):
            missing_properties = [
                property_name
                for property_name in required_pool_properties
                if not re.search(
                    rf"(?m)^{re.escape(datasource_prefix)}\.{re.escape(property_name)}\s*=",
                    property_text,
                )
            ]
            if missing_properties:
                violations.append({
                    "code": "MANAGED_APPLICATION_HIKARI_POOL_PROPERTIES_MISSING",
                    "path": str(resource_root.relative_to(project_root)),
                    "message": (
                        f"{project_name} datasource pool properties are incomplete: "
                        + ", ".join(missing_properties)
                    ),
                })
    return violations


def audit_registered_sqlite_database(
        project_root: Path,
        application_root: Path,
        registration: dict[str, Any],
        registry_path: Path) -> list[dict[str, str]]:
    """验证一个已中央登记的 Electron/SQLite 路径与迁移合同。"""

    violations: list[dict[str, str]] = []
    project_name = application_root.name
    schema_root = application_root / str(registration.get("schemaRoot", ""))
    path_config = application_root / str(registration.get("pathConfig", ""))
    if not schema_root.is_dir():
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_SCHEMA_ROOT_MISSING",
            "path": str(registry_path.relative_to(project_root)),
            "message": f"{project_name} registered SQLite schemaRoot is missing",
        })
    if not path_config.is_file():
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_PATH_CONFIG_MISSING",
            "path": str(registry_path.relative_to(project_root)),
            "message": f"{project_name} registered SQLite pathConfig is missing",
        })
        return violations
    try:
        path_document = json.loads(path_config.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exception:
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_PATH_CONFIG_UNREADABLE",
            "path": str(path_config.relative_to(project_root)),
            "message": f"SQLite pathConfig is unreadable: {exception}",
        })
        return violations
    if path_document.get("schemaVersion") != 2:
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_PATH_CONFIG_VERSION_INVALID",
            "path": str(path_config.relative_to(project_root)),
            "message": "SQLite pathConfig requires schemaVersion=2",
        })
    configured_database_file = path_document.get("databaseFile")
    registered_database_file = Path(str(registration.get("databaseFile", "")))
    if "databaseRoot" in path_document:
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_MACHINE_ROOT_FORBIDDEN",
            "path": str(path_config.relative_to(project_root)),
            "message": "SQLite pathConfig must derive its db root from the registered application and must not store databaseRoot",
        })
    if configured_database_file != registered_database_file.name:
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_FILE_MISMATCH",
            "path": str(path_config.relative_to(project_root)),
            "message": "SQLite pathConfig databaseFile must match the central registration",
        })
    load_order = schema_root / "load-order.txt"
    if not load_order.is_file():
        violations.append({
            "code": "MANAGED_DATABASE_SQLITE_LOAD_ORDER_MISSING",
            "path": str(schema_root.relative_to(project_root)),
            "message": "registered SQLite schemaRoot requires load-order.txt",
        })
    else:
        manifest_entries = [
            line.strip()
            for line in load_order.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        for manifest_entry in manifest_entries:
            fields = [field.strip() for field in manifest_entry.split("|")]
            version_code = fields[0] if len(fields) == 3 else ""
            migration_file = fields[1] if len(fields) == 3 else ""
            description = fields[2] if len(fields) == 3 else ""
            if not re.fullmatch(r"\d{4}", version_code) \
                    or not description \
                    or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]*\.sql", migration_file) \
                    or not (schema_root / migration_file).is_file():
                violations.append({
                    "code": "MANAGED_DATABASE_SQLITE_LOAD_ORDER_ENTRY_INVALID",
                    "path": str(load_order.relative_to(project_root)),
                    "message": f"SQLite load-order entry is unsafe or missing: {manifest_entry}",
                })
    return violations


def audit_service_direct_jdbc_governance(project_root: Path) -> list[dict[str, str]]:
    """Reject direct JdbcTemplate access from application business and capability Services."""
    violations: list[dict[str, str]] = []
    service_files = sorted((project_root / "apps").glob(
        "*/backend/src/main/java/**/service/**/*.java"
    ))
    for service_file in service_files:
        source_text = service_file.read_text(encoding="utf-8")
        if "org.springframework.jdbc.core.JdbcTemplate" not in source_text:
            continue
        violations.append({
            "code": "APPLICATION_SERVICE_DIRECT_JDBC_FORBIDDEN",
            "path": str(service_file.relative_to(project_root)),
            "message": (
                "application Service must query through its table business Service/BaseDao; "
                "direct JdbcTemplate belongs only to persistence or migration infrastructure"
            ),
        })
    return violations


def normalized_identifier(value: str) -> str:
    """Normalize table, project, and package names for stable ownership comparison."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def sql_statements(sql_text: str) -> list[str]:
    """Return executable SQL statements without splitting semicolons inside quoted values."""
    without_comments = re.sub(r"(?m)--[^\r\n]*$", "", sql_text)
    statements: list[str] = []
    current: list[str] = []
    in_single_quote = False
    index = 0
    while index < len(without_comments):
        character = without_comments[index]
        current.append(character)
        if character == "'":
            if in_single_quote and index + 1 < len(without_comments) \
                    and without_comments[index + 1] == "'":
                current.append(without_comments[index + 1])
                index += 1
            else:
                in_single_quote = not in_single_quote
        elif character == ";" and not in_single_quote:
            statement = "".join(current[:-1]).strip()
            if statement:
                statements.append(statement)
            current = []
        index += 1
    trailing_statement = "".join(current).strip()
    if trailing_statement:
        statements.append(trailing_statement)
    return statements


def table_business_candidates(table_name: str, project_name: str) -> set[str]:
    """Return allowed business directory names for one real schema table."""
    normalized_table = normalized_identifier(table_name)
    normalized_project = normalized_identifier(project_name)
    candidates = {normalized_table}
    if normalized_table.startswith(normalized_project):
        candidates.add(normalized_table[len(normalized_project):])
    return {candidate for candidate in candidates if candidate}


def is_managed_database_application(
        project_root: Path,
        central_registrations: dict[str, dict[str, Any]]) -> bool:
    """Identify every application that owns database SQL or generated database structure."""
    return (
        (project_root / ".selplat-generated-project.json").is_file()
        or (project_root / "db/sql").is_dir()
        or project_root.name in central_registrations
    )
