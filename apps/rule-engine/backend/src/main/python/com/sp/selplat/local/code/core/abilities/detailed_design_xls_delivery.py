"""详细设计 XLS 交付能力。

功能：
返回日本式详细设计 Excel 的正式模板、专项规则和交付约束。

作用：
把“按日本式详细设计标准继续做 Excel 详细设计”的入口固化为可检索能力。

适用场景：
- 参照既有日式详细设计 Excel 重建模板
- 按批处理入口、API 框架入口或页面调用链分别选择模板继续生成详细设计
- 查询详细设计工作簿应包含哪些骨架页、方法定义区和处理详细粒度约束
"""

from __future__ import annotations

from pathlib import Path


ABILITY_ID = "detailed_design_xls_delivery"
ABILITY_NAME = "详细设计 XLS 交付"
ABILITY_DESC = "返回日本式详细设计 Excel 模板路径、通用修复规则路径、生成器分流结构和处理详细写法。"

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
PROTOCOL_ROOT = CORE_RESOURCE_ROOT / "protocol"
TEMPLATE_DIR = RULE_ROOT / "template"
BATCH_TEMPLATE_PATH = TEMPLATE_DIR / "详细设计模板_批处理业务功能处理详细.xlsx"
PAGE_CALL_TEMPLATE_PATH = TEMPLATE_DIR / "详细设计模板_页面调用处理详细.xlsx"
RULE_PATH = RULE_ROOT / "common_rules" / "xls_detailed_design_rules.md"
AUTO_UPGRADE_AND_REPAIR_RULE_PATH = RULE_ROOT / "common_rules" / "auto_upgrade_and_repair_rules.md"
XLS_OUTPUT_TEST_RULE_PATH = RULE_ROOT / "common_rules" / "xls_output_test_rules.md"
GENERATOR_REPAIR_PROTOCOL_PATH = PROTOCOL_ROOT / "GENERATOR_REPAIR_PROTOCOL.md"


def run(context: dict) -> dict:
    # 当前交付能力默认不直接生成工作簿，而是向调用方暴露模板、规则和生成器分流口。
    _ = context
    return {
        "ability": ABILITY_ID,
        "template_dir": str(TEMPLATE_DIR),
        "template_path": str(PAGE_CALL_TEMPLATE_PATH),
        "batch_template_path": str(BATCH_TEMPLATE_PATH),
        "page_call_template_path": str(PAGE_CALL_TEMPLATE_PATH),
        "rule_path": str(RULE_PATH),
        "auto_upgrade_and_repair_rule_path": str(AUTO_UPGRADE_AND_REPAIR_RULE_PATH),
        "xls_output_test_rule_path": str(XLS_OUTPUT_TEST_RULE_PATH),
        "generator_repair_protocol_path": str(GENERATOR_REPAIR_PROTOCOL_PATH),
        "generator_abilities": {
            "api": {
                "ability_id": "api_detailed_design_xls_auto_generator",
                "status": "implemented",
            },
            "batch": {
                "ability_id": "batch_detailed_design_xls_auto_generator",
                "status": "reserved",
            },
            "page_call": {
                "ability_id": "page_call_detailed_design_xls_auto_generator",
                "status": "reserved",
            },
            "other": {
                "ability_id": "future_detailed_design_xls_auto_generator",
                "status": "extension_required",
            },
        },
        "required_header_fields": [
            "system_name",
            "subsystem_name",
            "function_name",
            "function_id",
            "class_name",
            "implementation_type",
            "version",
            "created_date",
            "created_by",
            "updated_date",
            "updated_by",
        ],
        "required_sheet_roles": [
            "功能构成_功能名",
            "IFxx_接口名_接口项目（接口字段契约）",
            "01_主处理（API 框架入口或批处理入口，必须写清类型）",
            "02_错误时处理（异常和响应/提示映射）",
            "Lxx_方法名（页面事件 / 前端API / Controller+Service / DAO / Domain）",
        ],
        "layer_suffix_rules": {
            "interface_item_spec": "IFxx_接口名_接口项目",
            "api_entry": "01_主处理",
            "error_process": "02_错误时处理",
            "internal_method": "Lxx_方法名（职责）",
            "batch_entry": "01_主处理 或 主处理_批处理入口",
        },
        "template_lookup_order": [
            str(PAGE_CALL_TEMPLATE_PATH),
            str(BATCH_TEMPLATE_PATH),
            str(TEMPLATE_DIR),
        ],
        "self_repair_sequence": [
            "先判定失败属于输入事实、规则路由、能力编排、模板骨架还是成品输出",
            "若是 API / BAT 模式选错，先修模式和规则路由，不在成品上盲改",
            "若是 merged ranges 或模板锚点问题，先修模板骨架和渲染逻辑",
            "修复后必须重跑结构检查、残留词检索和关键页预览验证",
            "若是能力不足或规则不足，先升级能力或补规则并同步 RULE_INDEX",
        ],
        "default_flow": [
            "先创建 功能构成_功能名 页，填写业务功能定义、输入输出与方法一览",
            "API / 页面调用场景先创建 IFxx_接口名_接口项目 页，逐字段定义请求/返回契约",
            "API / 页面调用场景可使用 01_主处理 作为 API 框架入口，并必须配套 02_错误时处理 与 Lxx_内部方法页",
            "薄的 Controller / Service / DAO / Domain 不要机械拆成空页，应在对应 Lxx 方法页用调用块、DAO 块和字段映射表体现分层",
            "批处理场景使用 主处理 或 01_主处理 作为批处理入口，再按内部方法、Service、DAO 拆页",
            "每个详细页都必须写完整的方法定义区与处理详细区，处理详细要能映射到代码实现顺序",
            "生成功能构成页时必须横向合并输入输出表和方法一览表，生成后所有 sheet 视图必须恢复 normal，清除旧分页预览、冻结窗格、pane、topLeftCell 和 selection，打开定位 A1",
        ],
        "design_principles": [
            "处理详细必须展开到步骤、分支、循环、内部方法、共通部品、DAO/SQL、参数和返回值这一层",
            "复杂逻辑必须继续按 Lxx 页面事件、前端 API、Controller/Service、DAO、Domain 方法拆 sheet，避免多个复杂方法混写",
            "详细设计应主动服务于低耦合设计：接口项目页隔离契约，Lxx 方法页用调用块和字段映射表表达页面、前端 API、Controller、Service、DAO、Domain 的职责边界",
            "方法页应尽量写满有效内容，不得保留大量无说明空白区",
        ],
        "color_module_rules": [
            "深蓝模块用于文档元数据页头",
            "浅蓝模块用于方法定义、字段映射、DAO/DB/SQL、Domain 和业务固有对象",
            "绿色模块用于业务共通部品和跨层业务调用",
            "黄色模块用于系统共通部品、框架、浏览器 API、日志、异常、URL/window/fetch 等平台能力",
        ],
        "table_generation_rules": [
            "表格必须按步骤语义动态生成，不得把空表当作固定装饰块保留下来",
            "内部方法、接口、Controller、Service、DAO/SQL、共通部品调用步骤应生成调用块",
            "对象组装、字段设值、状态回填、响应映射步骤应生成字段映射表",
            "只有说明性分支、结束、continue、break、return 且不存在结构化字段动作时，不生成表格",
            "同一步骤只有在同时存在调用动作和字段设值动作时，才允许连续生成多块表格",
        ],
        "process_detail_requirements": [
            "主步骤使用 1. / 2. 级编号，子步骤继续展开到 1.1 / 1.1.1 / (1) / ① 级别",
            "每个编号步骤必须在编号后直接写可见中文说明句，并使用横向合并或足够宽的可读区域，禁止只显示 1. / 2. / 3. 后面直接跟表格",
            "调用内部方法、共通部品、接口或 DB 后，必须紧跟调用块写类别、参数、返回值和必要备注",
            "页面事件页要写点击、状态更新、跳转地址、URL 参数桥接和异常兜底",
            "前端 API 页要写 request/fetch 封装、HTTP 方法、路径、body、返回解包和错误处理",
            "Controller 页要写路由、PathVariable/RequestBody、服务调用和 CommonResponse 封装",
            "Service 页要写校验、查询、组装、分支、事务和 DAO/内部函数调用顺序",
            "DAO 页要写 SQLID、SQL 条件、目标表、入参和返回映射",
            "Domain 页要写字段、类型、来源、数据库列和层间承载语义",
            "接口项目规格页要按字段写类型、长度、必填、来源/设置内容、请求/返回方向和备注",
            "功能构成页的方法一览必须能直接横向阅读页签名、方法名、层和说明，不能出现窄列竖排碎字",
        ],
    }
