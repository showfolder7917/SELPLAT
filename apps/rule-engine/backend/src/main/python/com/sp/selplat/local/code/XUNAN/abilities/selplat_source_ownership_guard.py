#!/usr/bin/env python3
"""Audit SELPLAT production source languages and ownership boundaries."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from typing import Any


PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
LANGUAGE_ROOT_NAMES = {"java", "python", "node", "swift", "kotlin", "go", "rust"}
RULE_ENGINE_MODULE = Path("apps/rule-engine/backend")
RULE_ENGINE_LANGUAGES = {"java", "python", "node"}
LANGUAGE_EXTENSIONS = {
    "java": {".java"},
    "python": {".py"},
    "node": {".js", ".mjs", ".cjs", ".ts"},
}
FORBIDDEN_APPLICATION_PROTOCOL_SUFFIXES = ("Request", "Response", "Result", "Page", "Param")
BUSINESS_TECHNICAL_LAYER_NAMES = {"controller", "service", "dao", "reference"}
MANAGED_COMMON_ROLE_NAMES = {"config", "persistence", "util"}
MANAGED_COMMON_PERSISTENCE_SUFFIXES = ("BaseDao", "PersistenceConfiguration")
MANAGED_TABLE_BUSINESS_ROLES = {"controller", "service", "dao"}
MANAGED_APPLICATION_ROOT_ALLOWLIST = {
    "backend",
    "frontend",
    "db",
    "doc",
    "README.md",
    "build.gradle",
    ".selplat-generated-project.json",
}
QUERY_REPRESENTATION_PATHS = {
    "tree": "/tree",
    "options": "/options",
    "context-menu": "/context-menu",
}
MDA_GENERATOR_TEMPLATE_RELATIVE = Path(
    "apps/mda/backend/src/main/java/com/sp/selplat/mda/projectgenerator/template/"
    "MdaProjectTemplateCatalog.java"
)
MDA_GENERATED_BUSINESS_DEFAULT_FIELDS = (
    "tenantId",
    "lastOperateUserId",
    "sortnum",
    "labelZh",
    "labelJa",
    "labelEn",
    "status",
    "createdAt",
    "updatedAt",
)
MANAGED_DATABASE_REGISTRY_RELATIVE = Path(
    "apps/rule-engine/backend/src/main/resources/local"
)


def managed_database_registry_path(project_root: Path, stable_user_id: str) -> Path:
    """Return the current user's one central managed-database application registry."""
    return (
        project_root / MANAGED_DATABASE_REGISTRY_RELATIVE / stable_user_id
        / "selplat/通用/registry/managed-database-applications.json"
    )


def is_managed_database_application(
        project_root: Path,
        central_registrations: dict[str, dict[str, Any]]) -> bool:
    """Identify generated or centrally registered database applications."""
    return (
        (project_root / ".selplat-generated-project.json").is_file()
        or project_root.name in central_registrations
    )


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
        expected_fixed_values = {
            "structure": "table-business-only",
            "schemaRoot": "db/sql",
            "primaryKeyStrategy": "one-table-one-sequence",
        }
        for field_name, expected_value in expected_fixed_values.items():
            if application.get(field_name) != expected_value:
                violations.append({
                    "code": "MANAGED_DATABASE_REGISTRY_POLICY_INVALID",
                    "path": relative_registry,
                    "message": f"{project_name}.{field_name} must be {expected_value}",
                })
    return registrations, violations


def normalized_identifier(value: str) -> str:
    """Normalize table, project, and package names for stable ownership comparison."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def sql_statements(sql_text: str) -> list[str]:
    """Return executable SQL statements after removing line comments."""
    without_comments = re.sub(r"(?m)--[^\r\n]*$", "", sql_text)
    return [statement.strip() for statement in without_comments.split(";") if statement.strip()]


def table_business_candidates(table_name: str, project_name: str) -> set[str]:
    """Return allowed business directory names for one real schema table."""
    normalized_table = normalized_identifier(table_name)
    normalized_project = normalized_identifier(project_name)
    candidates = {normalized_table}
    if normalized_table.startswith(normalized_project):
        candidates.add(normalized_table[len(normalized_project):])
    return {candidate for candidate in candidates if candidate}


def active_stable_user_id(project_root: Path) -> str:
    """Read the one stable user ID from the project authority file."""
    matches = re.findall(
        r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
        (project_root / "AGENTS.md").read_text(encoding="utf-8"),
    )
    if len(matches) != 1 or not re.fullmatch(
            r"[A-Za-z][A-Za-z0-9_-]{0,63}", matches[0].strip()):
        raise RuntimeError("AGENTS.md must declare exactly one safe stable user ID")
    return matches[0].strip()


def registered_languages(project_root: Path, module_root: Path) -> set[str]:
    """Return languages explicitly owned by one Gradle module."""
    relative_module = module_root.relative_to(project_root)
    if relative_module == RULE_ENGINE_MODULE:
        return set(RULE_ENGINE_LANGUAGES)
    if (module_root / "build.gradle").is_file() or (module_root / "build.gradle.kts").is_file():
        return {"java"}
    return set()


def audit_source_ownership(project_root: Path = PROJECT_ROOT) -> dict[str, Any]:
    """Report unregistered language roots, misplaced rule abilities, and source pollution."""
    project_root = project_root.resolve()
    stable_user_id = active_stable_user_id(project_root)
    violations: list[dict[str, str]] = []
    central_registrations, registry_violations = load_managed_database_registry(
        project_root, stable_user_id
    )
    violations.extend(registry_violations)
    generator_template = project_root / MDA_GENERATOR_TEMPLATE_RELATIVE
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
            for field_name in MDA_GENERATED_BUSINESS_DEFAULT_FIELDS
            if not re.search(rf"(?m)^\s*{re.escape(field_name)}\s+", schema_template)
        ]
        if missing_default_fields or re.search(r"(?m)^\s*name\s+", schema_template):
            violations.append({
                "code": "MDA_GENERATOR_DEFAULT_BUSINESS_FIELDS_INVALID",
                "path": str(MDA_GENERATOR_TEMPLATE_RELATIVE),
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
        "*.trace.db",
        "*.lock.db",
        "*.temp.db",
        "*.before-*.db",
    }
    forbidden_mvdb_ignore_rules = {
        "*.mv.db",
        "**/*.mv.db",
        "apps/*/db/*.mv.db",
    }
    if not required_h2_ignore_rules.issubset(root_gitignore_lines) \
            or forbidden_mvdb_ignore_rules.intersection(root_gitignore_lines):
        violations.append({
            "code": "ROOT_H2_GITIGNORE_POLICY_INVALID",
            "path": ".gitignore",
            "message": (
                "root .gitignore must not hide mv.db files and must exclude H2 trace, lock, temp, and before-backup files"
            ),
        })
    checked_language_roots = 0

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
                if module_root.relative_to(project_root) == RULE_ENGINE_MODULE:
                    owned_root = (
                        language_root / "com/sp/selplat/local/code"
                    )
                    allowed_layers = {"core", "common", stable_user_id}
                    for source_file in sorted(path for path in language_root.rglob("*") if path.is_file()):
                        relative_source = source_file.relative_to(project_root)
                        if not source_file.is_relative_to(owned_root):
                            violations.append({
                                "code": "RULE_ENGINE_SOURCE_OUTSIDE_LAYER_ROOT",
                                "path": str(relative_source),
                                "message": "rule-engine source must be below local/code/<layer>",
                            })
                            continue
                        layer_relative = source_file.relative_to(owned_root)
                        if not layer_relative.parts or layer_relative.parts[0] not in allowed_layers:
                            violations.append({
                                "code": "RULE_ENGINE_SOURCE_UNKNOWN_LAYER",
                                "path": str(relative_source),
                                "message": "layer must be core, common, or the active stable user",
                            })
                        allowed_extensions = LANGUAGE_EXTENSIONS.get(language, set())
                        if source_file.suffix not in allowed_extensions:
                            violations.append({
                                "code": "LANGUAGE_ROOT_FOREIGN_FILE",
                                "path": str(relative_source),
                                "message": f"unexpected file in {language} source root",
                            })

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
            if "src" not in pollution_path.parts:
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
            strict_table_business = project_root_path.name in central_registrations
            if strict_table_business:
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
            for application_package_root in application_package_roots:
                business_directories.extend(sorted(
                    path for path in application_package_root.iterdir()
                    if path.is_dir() and path.name != "common"
                ))
            schema_tables = {
                schema_file.stem.removeprefix("schema-")
                for schema_file in (project_root_path / "db/sql").glob("schema-*.sql")
            }
            if strict_table_business:
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
                    for table_name in sorted(schema_tables):
                        if table_name.startswith("Common"):
                            continue
                        sequence_code = f"{table_name}Id"
                        declaration_count = sum(
                            1 for insert_head in sequence_insert_heads
                            if re.search(rf"['\"]{re.escape(sequence_code)}['\"]", insert_head)
                        )
                        if declaration_count != 1:
                            violations.append({
                                "code": "MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID",
                                "path": str(common_sequence_data.relative_to(project_root)),
                                "message": f"{table_name} must map to exactly one {sequence_code} row",
                            })
                for table_name in sorted(schema_tables):
                    schema_file = project_root_path / "db/sql" / f"schema-{table_name}.sql"
                    schema_text = schema_file.read_text(encoding="utf-8")
                    if not table_name.startswith("Common") and re.search(
                            r"\bid\s+BIGINT\s+GENERATED\b", schema_text, re.IGNORECASE):
                        violations.append({
                            "code": "MANAGED_APPLICATION_BUSINESS_IDENTITY_FORBIDDEN",
                            "path": str(schema_file.relative_to(project_root)),
                            "message": "business table ids must use <TableName>Id sequence, not database identity",
                        })
                    data_file = project_root_path / "db/sql" / f"data-{table_name}.sql"
                    if not data_file.is_file():
                        violations.append({
                            "code": "MANAGED_APPLICATION_REBUILD_DATA_SQL_MISSING",
                            "path": str(schema_file.relative_to(project_root)),
                            "message": f"{table_name} requires a matching data-{table_name}.sql rebuild resource",
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
                if (strict_table_business
                        and len(package_tail) >= 3
                        and package_tail[0] == "common"
                        and package_tail[1] == "util"
                        and (java_file.stem.endswith(("Controller", "Service", "Dao"))
                             or re.search(r"@(RestController|Service|Repository)\b", source_text))):
                    violations.append({
                        "code": "MANAGED_APPLICATION_COMMON_UTIL_BUSINESS_ROLE",
                        "path": str(relative_source),
                        "message": "common/util is limited to stateless methods called by services",
                    })
                if (strict_table_business and len(package_tail) >= 3 and package_tail[0] != "common"):
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
                if (len(package_tail) == 3
                        and package_tail[0] != "common"
                        and package_tail[1] == "service"
                        and java_file.stem.endswith("Service")):
                    service_contracts.setdefault(package_tail[0], []).append(java_file)
                if (len(package_tail) == 4
                        and package_tail[0] != "common"
                        and package_tail[1] == "service"
                        and package_tail[2] == "impl"
                        and java_file.stem.endswith("ServiceImpl")):
                    service_implementations.setdefault(package_tail[0], []).append(java_file)
                if "controller" in package_tail:
                    representations = {
                        name for name, path_suffix in QUERY_REPRESENTATION_PATHS.items()
                        if path_suffix in source_text
                    }
                    if len(representations) > 1:
                        violations.append({
                            "code": "MANAGED_APPLICATION_QUERY_REPRESENTATIONS_MIXED_CONTROLLER",
                            "path": str(relative_source),
                            "message": (
                                "tree, options, and context-menu HTTP representations must remain "
                                "in separate table business controllers"
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

    return {
        "status": "completed" if not violations else "blocked",
        "checkedLanguageRoots": checked_language_roots,
        "violationCount": len(violations),
        "violations": violations,
    }


def main() -> int:
    """Print the audit result and return a blocking exit code on any violation."""
    result = audit_source_ownership()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["violationCount"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
