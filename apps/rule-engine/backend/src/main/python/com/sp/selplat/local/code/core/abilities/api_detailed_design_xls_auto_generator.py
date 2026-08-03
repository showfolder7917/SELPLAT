"""API 详细设计 XLS 自动生成器能力。

功能：
返回 API 详细设计自动生成器的模式定义、输入事实模型、生成阶段、通用修复循环和扩展口。

作用：
把“API 详细设计如何自动生成、如何接入通用修复协议、如何给 BAT 与其他详细设计留口”固化为统一能力入口。

适用场景：
- 设计或升级 API 详细设计自动生成器
- 生成前查询 API 模式需要的事实字段、模板、规则和验证阶段
- 为 BAT / 页面调用 / 其他详细设计类型保留分流扩展口
"""

from __future__ import annotations

from pathlib import Path
from typing import Any


# 声明能力标识，方便规则和能力注册文件稳定引用这个生成器入口。
ABILITY_ID = "api_detailed_design_xls_auto_generator"
# 声明能力中文名，方便后续在能力目录或说明文档中识别用途。
ABILITY_NAME = "API 详细设计 XLS 自动生成器"
# 说明这个能力负责的不是成品文档，而是生成器编排、自我修复和扩展分流。
ABILITY_DESC = "返回 API 详细设计自动生成所需的模板、规则、自我修复阶段和 BAT/其他类型扩展口。"

# 当前能力只返回编排信息，不依赖外部 skill 或 app。
REQUIRED_SKILLS: list[str] = []
# 保持 app 依赖为空，避免调用方误以为这里会直接启动外部工具。
REQUIRED_APPS: list[str] = []

# 定位当前能力文件所在的 code 目录，后续据此拼规则和模板路径。
CODE_ROOT = Path(__file__).resolve().parents[1]
# 从迁移后的深层包向上识别工程根，统一引用 core 协议、规则和模板资产。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 记录不可变 core 资源目录，能力不再依赖旧 MEMORIES 路径。
CORE_RESOURCE_ROOT = (
    PROJECT_ROOT / "apps/rule-engine/backend/src/main/resources/local/core"
)
# 记录协议目录，供通用修复协议路径返回使用。
PROTOCOL_ROOT = CORE_RESOURCE_ROOT / "protocol"
# 记录规则目录，供详细设计规则和专项生成规则路径返回使用。
RULE_ROOT = CORE_RESOURCE_ROOT / "rule"
# 记录模板目录，供 API 模板和 BAT 模板分流使用。
TEMPLATE_DIR = RULE_ROOT / "template"

# API 模式默认使用页面调用详细模板，但语义上仍然是 API 框架入口。
API_TEMPLATE_PATH = TEMPLATE_DIR / "详细设计模板_页面调用处理详细.xlsx"
# BAT 模式保留独立模板路径，后续实现 BAT 生成器时可直接接入。
BATCH_TEMPLATE_PATH = TEMPLATE_DIR / "详细设计模板_批处理业务功能处理详细.xlsx"
# 详细设计通用结构规则路径，负责总体 sheet 结构和内容粒度约束。
DETAILED_DESIGN_RULE_PATH = RULE_ROOT / "common_rules" / "xls_detailed_design_rules.md"
# 通用自动升级和修复规则路径，负责能力不足、规则不足和规则收敛治理。
AUTO_UPGRADE_AND_REPAIR_RULE_PATH = RULE_ROOT / "common_rules" / "auto_upgrade_and_repair_rules.md"
# Excel 成品验证规则路径，负责结构检查、残留词检查和截图验收。
XLS_OUTPUT_TEST_RULE_PATH = RULE_ROOT / "common_rules" / "xls_output_test_rules.md"
# 通用修复协议路径，负责失败分层、升级顺序和规则收敛原则。
GENERATOR_REPAIR_PROTOCOL_PATH = PROTOCOL_ROOT / "GENERATOR_REPAIR_PROTOCOL.md"


def _normalize_mode(context: dict[str, Any]) -> str:
    """把调用方传入的模式统一折叠成稳定的小写值。"""

    # 优先读取 design_mode，兼容 mode 字段，默认按 api 模式解释当前能力。
    raw_mode = str(context.get("design_mode") or context.get("mode") or "api").strip().lower()
    # 把批处理常见别名折叠到 batch，避免调用方写 bat / batch 时分流不一致。
    if raw_mode in {"bat", "batch"}:
        return "batch"
    # 页面调用单独折叠为 page_call，方便后续独立扩展。
    if raw_mode in {"page", "page_call", "screen"}:
        return "page_call"
    # 其他类型统一回传 other，避免误判成 api。
    if raw_mode not in {"api", "batch", "page_call"}:
        return "other"
    # 对已知模式直接返回，供后续路由和扩展口使用。
    return raw_mode


def _build_rule_paths() -> dict[str, str]:
    """统一返回生成器会依赖的规则与协议路径。"""

    # 返回通用详细设计规则路径，让调用方知道 sheet 结构约束来自哪里。
    return {
        "detailed_design_rule_path": str(DETAILED_DESIGN_RULE_PATH),
        # 返回通用自动升级与修复规则路径，让调用方知道升级和修复约束来自哪里。
        "auto_upgrade_and_repair_rule_path": str(AUTO_UPGRADE_AND_REPAIR_RULE_PATH),
        # 返回 Excel 成品验收规则路径，让调用方把验证阶段接入生成流程。
        "xls_output_test_rule_path": str(XLS_OUTPUT_TEST_RULE_PATH),
        # 返回通用修复协议路径，让调用方在失败时按统一协议分层修复。
        "generator_repair_protocol_path": str(GENERATOR_REPAIR_PROTOCOL_PATH),
    }


def _build_generator_routes() -> dict[str, dict[str, Any]]:
    """定义 API、BAT 和其他详细设计类型的分流口。"""

    # API 路由直接指向当前能力和页面调用模板语义下的 API 模式。
    return {
        "api": {
            "status": "implemented",
            "ability_id": ABILITY_ID,
            "template_path": str(API_TEMPLATE_PATH),
            "entry_model": "api_framework_entry",
            "required_sheet_group": [
                "功能构成_功能名",
                "IFxx_接口名_接口项目",
                "01_主处理",
                "02_错误时处理",
                "Lxx_方法名（职责）",
            ],
        },
        # BAT 路由先声明预留能力标识和模板路径，后续实现时不需要再改调用协议。
        "batch": {
            "status": "reserved",
            "ability_id": "batch_detailed_design_xls_auto_generator",
            "template_path": str(BATCH_TEMPLATE_PATH),
            "entry_model": "batch_entry",
            "required_sheet_group": [
                "功能构成_功能名",
                "01_主处理 或 主处理_批处理入口",
                "02_错误时处理",
                "Lxx_方法名（职责）",
            ],
        },
        # 页面调用路由保留专属扩展口，防止未来直接混入 API 生成器。
        "page_call": {
            "status": "reserved",
            "ability_id": "page_call_detailed_design_xls_auto_generator",
            "template_path": str(API_TEMPLATE_PATH),
            "entry_model": "screen_event_chain",
            "required_sheet_group": [
                "功能构成_功能名",
                "调用链总览 或 IFxx_接口项目",
                "Lxx_页面事件/前端API/Controller/Service/DAO/Domain",
            ],
        },
        # 其他模式明确暴露为未实现，避免伪装成 API 成功生成。
        "other": {
            "status": "extension_required",
            "ability_id": "future_detailed_design_xls_auto_generator",
            "template_path": "",
            "entry_model": "unknown",
            "required_sheet_group": [],
        },
    }


def _build_fact_model() -> list[dict[str, Any]]:
    """定义 API 自动生成前必须抽取的标准事实模型。"""

    # 这份事实模型会驱动 IFxx、主处理、错误处理和 Lxx 方法页生成。
    return [
        {"field": "endpoint_name", "required": True, "source": "controller_or_markdown", "purpose": "生成 IFxx 页签名称"},
        {"field": "http_method", "required": True, "source": "controller_mapping", "purpose": "区分 GET/POST/PUT/DELETE 契约"},
        {"field": "route_path", "required": True, "source": "controller_mapping", "purpose": "生成接口项目和主处理入口描述"},
        {"field": "input_contract", "required": True, "source": "dto_request_or_path_query", "purpose": "生成 IFxx 请求字段契约"},
        {"field": "output_contract", "required": True, "source": "dto_response", "purpose": "生成 IFxx 返回字段契约"},
        {"field": "controller_method", "required": True, "source": "controller_code", "purpose": "生成 Controller / 主处理调用块"},
        {"field": "service_method_chain", "required": True, "source": "service_code", "purpose": "生成 Lxx 服务处理顺序"},
        {"field": "dao_sql_chain", "required": True, "source": "mapper_or_sql", "purpose": "生成 DAO/SQL 调用块和 SQLID"},
        {"field": "domain_objects", "required": True, "source": "domain_or_vo", "purpose": "生成字段映射表和对象承载语义"},
        {"field": "error_paths", "required": True, "source": "validation_and_exception", "purpose": "生成 02_错误时处理"},
    ]


def _build_generation_stages() -> list[dict[str, Any]]:
    """声明 API 生成器的正式生成阶段。"""

    # 第一阶段先抽取事实，避免直接写工作簿导致内容不可回放。
    return [
        {"stage": "extract_facts", "goal": "从 Controller/Service/DAO/SQL/DTO/Markdown 抽取标准事实模型"},
        {"stage": "build_design_model", "goal": "把事实模型归并为 overview / IFxx / main / error / Lxx 中间结构"},
        {"stage": "route_template", "goal": "按 api 模式绑定模板、规则和 sheet 结构"},
        {"stage": "render_workbook", "goal": "按模板锚点、merged ranges 和颜色语义渲染工作簿"},
        {"stage": "verify_output", "goal": "执行结构检查、残留词检查和关键页预览验证"},
    ]


def _build_self_repair_loop() -> list[dict[str, Any]]:
    """声明生成器在失败时接入的通用修复循环。"""

    # 先判定失败层级，确保修复动作落在最小正确边界。
    return [
        {"stage": "classify_failure", "goal": "识别失败属于输入事实、规则路由、能力编排、模板骨架或成品输出"},
        {"stage": "repair_input_or_route", "goal": "优先修事实抽取或模式/规则路由，不在成品上盲改业务内容"},
        {"stage": "repair_template_or_renderer", "goal": "若出现碎字、错位或空白主区，则修 merged ranges、锚点映射和渲染逻辑"},
        {"stage": "rerun_verification", "goal": "重跑结构检查、残留词检索和关键页截图验证"},
        {"stage": "promote_capability_upgrade", "goal": "若问题具有复发性，则把修复沉淀回通用规则、通用协议或能力代码"},
    ]


def run(context: dict[str, Any]) -> dict[str, Any]:
    """返回 API 详细设计自动生成器的统一编排结果。"""

    # 先标准化调用方模式，避免 API / BAT / page_call 混用分支。
    design_mode = _normalize_mode(context)
    # 预构建全部路由，让当前能力既能服务 API，也能对其他模式给出留口信息。
    routes = _build_generator_routes()

    # 若调用方传入非 API 模式，则明确返回应该切换的分流口，而不是伪成功。
    if design_mode != "api":
        return {
            "ability": ABILITY_ID,
            "status": "routed_to_extension_port",
            "requested_mode": design_mode,
            "recommended_route": routes.get(design_mode, routes["other"]),
            "rule_paths": _build_rule_paths(),
            "message": "当前能力只实现 API 详细设计自动生成；BAT、页面调用和其他类型已保留扩展口。",
        }

    # API 模式下返回生成器需要的模板、规则、事实模型、生成阶段和修复循环。
    return {
        "ability": ABILITY_ID,
        "status": "implemented",
        "design_mode": "api",
        "template_path": str(API_TEMPLATE_PATH),
        "template_dir": str(TEMPLATE_DIR),
        "rule_paths": _build_rule_paths(),
        "generator_routes": routes,
        "fact_model": _build_fact_model(),
        "generation_stages": _build_generation_stages(),
        "self_repair_loop": _build_self_repair_loop(),
        "shared_components": {
            "fact_extractor": "shared_future_component",
            "workbook_renderer": "shared_future_component",
            "output_verifier": "shared_future_component",
        },
        "upgrade_ports": {
            "batch_generator_ability_id": routes["batch"]["ability_id"],
            "page_call_generator_ability_id": routes["page_call"]["ability_id"],
            "other_design_generator_ability_id": routes["other"]["ability_id"],
        },
        "expected_outputs": [
            "功能构成_功能名",
            "IFxx_接口名_接口项目",
            "01_主处理",
            "02_错误时处理",
            "Lxx_方法名（职责）",
            "关键页预览证据",
        ],
    }
