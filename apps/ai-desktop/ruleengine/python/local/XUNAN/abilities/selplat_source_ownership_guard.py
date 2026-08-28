#!/usr/bin/env python3
"""Audit SELPLAT production source languages and ownership boundaries."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 在导入当前用户领域模块前重定向字节码，防止源码树重新生成 __pycache__。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)
# Windows 非 UTF-8 控制台仍需稳定输出中文违规 JSON。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
ABILITY_ROOT = Path(__file__).resolve().parent
if str(ABILITY_ROOT) not in sys.path:
    sys.path.insert(0, str(ABILITY_ROOT))

from source_ownership.audit_runner import audit_source_ownership
from source_ownership.database_governance import (
    DATABASE_ENGINES, DATABASE_RUNTIME_TYPES, audit_managed_datasource_pool_governance,
    audit_registered_sqlite_database, audit_service_direct_jdbc_governance,
    is_managed_database_application, load_managed_database_registry,
    normalized_identifier, sql_statements, table_business_candidates,
)
from source_ownership.frontend_governance import (
    APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE, SEL_UI_COMPONENT_REGISTRY_NAME,
    SEL_UI_COMPONENT_ROOT_RELATIVE, SEL_UI_REQUIRED_GOVERNANCE_CHECKS,
    SEL_UI_SEMANTIC_FONT_ROLES, SEL_UI_SOURCE_ROOT_RELATIVE,
    SEL_UI_TYPOGRAPHY_CONTRACT_RELATIVE, SEL_UI_TYPOGRAPHY_TOKEN_RELATIVE,
    audit_frontend_identity_write_governance, audit_sel_ui_component_governance,
    audit_sel_ui_typography_governance, document_has_nested_sel_freeze,
    has_nested_sel_freeze,
)
from source_ownership.language_registry import registered_languages
from source_ownership.path_classifier import active_stable_user_id, managed_database_registry_path


def main() -> int:
    """Print the audit result and return a blocking exit code on any violation."""
    result = audit_source_ownership()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["violationCount"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
