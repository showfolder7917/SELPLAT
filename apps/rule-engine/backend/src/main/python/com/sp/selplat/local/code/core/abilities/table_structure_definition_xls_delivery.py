"""表结构定义 XLS 交付能力。

功能：
返回通用表结构定义 Excel 中文模板、专项规则和后续填写所需字段约束。

作用：
把“以后按统一模板继续做表结构定义书”的入口固化为可检索能力。

适用场景：
- 参照既有表结构定义书提炼模板
- 按统一模板继续生成表结构定义书
- 查询表结构定义工作簿应包含哪些页签、元数据和默认模板目录
"""

from __future__ import annotations

from pathlib import Path


ABILITY_ID = "table_structure_definition_xls_delivery"
ABILITY_NAME = "表结构定义 XLS 交付"
ABILITY_DESC = "返回通用表结构定义 Excel 中文模板路径、规则路径和填写约束。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

CODE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
CORE_RESOURCE_ROOT = (
    PROJECT_ROOT / "apps/rule-engine/backend/src/main/resources/local/core"
)
RULE_ROOT = CORE_RESOURCE_ROOT / "rule"
TEMPLATE_DIR = RULE_ROOT / "template"
TEMPLATE_PATH = TEMPLATE_DIR / "表结构定义模板_通用.xlsx"
RULE_PATH = RULE_ROOT / "common_rules" / "table_structure_definition_xls_rules.md"


def run(context: dict) -> dict:
    _ = context
    return {
        "ability": ABILITY_ID,
        "template_dir": str(TEMPLATE_DIR),
        "template_path": str(TEMPLATE_PATH),
        "rule_path": str(RULE_PATH),
        "required_header_fields": [
            "system_name",
            "subsystem_name",
            "logical_table_name",
            "physical_table_name",
            "category",
            "author",
            "created_date",
            "updated_date",
            "remarks",
        ],
        "required_sheet_roles": [
            "表一览",
            "表定义_示例",
            "模板说明",
        ],
        "field_columns": [
            "No.",
            "逻辑名",
            "物理名",
            "数据类型",
            "Not Null",
            "默认值",
            "数据例",
            "说明",
        ],
        "template_lookup_order": [
            str(TEMPLATE_PATH),
            str(TEMPLATE_DIR),
        ],
    }
