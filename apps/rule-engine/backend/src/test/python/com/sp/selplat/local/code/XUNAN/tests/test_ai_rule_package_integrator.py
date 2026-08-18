"""当前稳定用户 AI 规则包智慧整合能力测试。"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 文件直接运行时必须在动态加载当前用户程序前切换字节码缓存根；
# 否则 importlib 会先在生产源码旁创建 __pycache__，程序自身再设置已经来不及。
PYTHON_PYCACHE_ROOT = PROJECT_ROOT / "cache/python-pycache"
sys.pycache_prefix = str(PYTHON_PYCACHE_ROOT)
os.environ["PYTHONPYCACHEPREFIX"] = str(PYTHON_PYCACHE_ROOT)
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1:
    raise RuntimeError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
PROGRAM_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code"
    / ACTIVE_STABLE_USER_ID
    / "abilities/ai_rule_package_integrator.py"
)
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def _load_program():
    """直接加载当前用户智慧整合程序，不经过注册表或二次执行器。"""

    spec = importlib.util.spec_from_file_location("active_user_integrator_test", PROGRAM_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class AiRulePackageIntegratorTests(unittest.TestCase):
    """覆盖只读审查、用户覆盖识别和 OPTION 安全输出。"""

    def setUp(self) -> None:
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        self.program = _load_program()

    def test_audit_returns_registered_rule_package_facts(self) -> None:
        result = self.program.execute({"action": "audit"}, {}, {})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["model"], "ai_rule_driven_execution_and_continuous_rule_package_growth")
        self.assertEqual(result["indexes"], 19)
        # 根索引递归统计只计算 core/common；当前用户规则通过独立用户索引统计。
        self.assertEqual(result["indexed_rules"], 66)
        self.assertEqual(result["active_user_id"], ACTIVE_STABLE_USER_ID)
        self.assertEqual(result["active_user_indexes"], 11)
        # 既有测试隔离规则与本次 UTF-8 门禁均进入当前用户层 → 覆盖与规则文件统计必须同步增长。
        self.assertEqual(result["active_user_overrides"], 19)
        self.assertEqual(result["active_user_rule_files"], 18)
        self.assertEqual(result["active_user_standard_asset_packages"], 1)
        # 数据源规则复用源码门禁能力后，具备真实程序引用的用户规则同步增加为 7 条。
        self.assertEqual(result["active_user_rules_with_program_references"], 7)
        self.assertEqual(result["decision_boundary"], "facts_only_ai_must_review_before_merge_or_delete")

    def test_write_report_is_limited_to_option(self) -> None:
        with tempfile.TemporaryDirectory(prefix="ai_rule_integrator_", dir=OPTION_TEMP_ROOT) as temp_dir:
            output_path = Path(temp_dir) / "audit.json"
            relative_output = output_path.relative_to(PROJECT_ROOT)
            result = self.program.execute(
                {"action": "write_report", "output_path": str(relative_output)},
                {},
                {},
            )

            self.assertEqual(result["status"], "completed")
            self.assertEqual(Path(result["report_path"]), output_path)
            self.assertTrue(output_path.is_file())

    def test_write_report_blocks_path_outside_option(self) -> None:
        result = self.program.execute(
            {"action": "write_report", "output_path": "outside-audit.json"},
            {},
            {},
        )

        self.assertEqual(result["status"], "blocked")
        self.assertIn("OPTION", result["message"])

    def test_active_user_rule_assignments_have_line_level_chinese_comments(self) -> None:
        user_root = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
        )
        rule_paths = sorted(user_root.rglob("RUL_*.md"))
        # 当前用户全部规则（含测试隔离与 UTF-8 写入门禁）必须逐项接受紧邻中文业务注释检查。
        self.assertEqual(len(rule_paths), 18)
        for rule_path in rule_paths:
            previous_nonempty = ""
            for line_number, raw_line in enumerate(
                    rule_path.read_text(encoding="utf-8").splitlines(), 1):
                line = raw_line.strip()
                if "=" in line and not line.startswith(("#", "<!--")):
                    self.assertTrue(
                        previous_nonempty.startswith("<!--") and previous_nonempty.endswith("-->"),
                        f"{rule_path}:{line_number} 的规则声明缺少上一行中文业务注释",
                    )
                    self.assertRegex(
                        previous_nonempty,
                        r"[\u4e00-\u9fff]",
                        f"{rule_path}:{line_number} 的规则注释必须包含中文业务说明",
                    )
                if line:
                    previous_nonempty = line

    def test_ai_rule_requires_memory_edit_and_lifecycle_preflight(self) -> None:
        rule_path = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "selplat/应用/rule-engine/rule/RUL_AI规则包智慧整合规则.md"
        )
        text = rule_path.read_text(encoding="utf-8")
        self.assertIn(
            "rule_edit_preflight_required_rules = MEMORY_FILE_EDIT_RULES,RULE_LIFECYCLE_GOVERNANCE_RULES",
            text,
        )

    def test_transient_operation_feedback_rule_is_registered(self) -> None:
        """非阻断操作提示必须从当前用户 SELPLAT 通用索引稳定命中。"""

        user_rule_root = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "selplat/通用"
        )
        # 叶子索引必须登记稳定逻辑 ID，禁止依赖扫描目录猜测规则入口。
        index_text = (user_rule_root / "RULE_INDEX.md").read_text(encoding="utf-8")
        self.assertIn(
            "SELPLAT_TRANSIENT_OPERATION_FEEDBACK_TOAST_RULES = "
            f"local/{ACTIVE_STABLE_USER_ID}/selplat/通用/rule/RUL_SELPLAT短时操作反馈规则.md",
            index_text,
        )
        # 规则正文必须同时固定短时生命周期和编辑器常驻状态栏的职责边界。
        rule_text = (
            user_rule_root / "rule/RUL_SELPLAT短时操作反馈规则.md"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "selplat_transient_toast_lifecycle = fixed_overlay_auto_remove_after_2_to_4_seconds",
            rule_text,
        )
        self.assertIn(
            "selplat_editor_status_bar_boundary = "
            "current_position_or_live_context_not_completed_action_message",
            rule_text,
        )

    def test_explicit_delegation_rule_is_registered_for_active_user(self) -> None:
        """用户明确委托规则必须通过稳定治理逻辑 ID 覆盖，而不是绕过索引。"""

        index_path = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/RULE_INDEX.md"
        )
        text = index_path.read_text(encoding="utf-8")
        self.assertIn(
            "USER_RULE_INDEX_PATTERN = local/<stable-user-id>/RULE_INDEX.md",
            text,
        )
        leaf_index = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "跨工程通用规则/RULE_INDEX.md"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES = "
            f"local/{ACTIVE_STABLE_USER_ID}/跨工程通用规则/RUL_用户明确委托AI修正规则.md",
            leaf_index,
        )

    def test_same_task_followup_after_standalone_one_remains_authorized(self) -> None:
        """独立 1 后的同任务补充必须延续授权，同时保留实质扩张的重新确认边界。"""

        # 读取核心 USER 协议 → 验证补充授权来自协议权威入口而不是用户层自行推断。
        protocol_text = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local/core/protocol/USER.PROTOCOL.md"
        ).read_text(encoding="utf-8")
        # 同任务补充 → 协议明确允许文件、材料、参数和同目标要求直接继续执行。
        self.assertIn(
            "followup_after_standalone_1_within_same_task_is_authorized_supplement = true",
            protocol_text,
        )
        # 实质范围扩张 → 协议仍要求重新取得用户确认，防止授权无限延伸。
        self.assertIn(
            "followup_requires_new_confirmation_when = overall_goal_changes,new_project_or_system,"
            "new_core_or_common_layer,destructive_scope_expands,independent_new_task",
            protocol_text,
        )

        # 读取当前用户委托规则 → 验证用户层托管窗口与核心协议保持同一补充语义。
        delegation_text = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "跨工程通用规则/RUL_用户明确委托AI修正规则.md"
        ).read_text(encoding="utf-8")
        # 用户补充同任务材料 → 现有托管窗口继续生效且无需重复确认。
        self.assertIn(
            "explicit_ai_managed_same_task_followup_policy = "
            "authorized_supplement_without_reconfirmation",
            delegation_text,
        )
        # 规则版本升级 → 授权语义变化具备可追踪的治理记录。
        self.assertIn("rule_version = 1.2.0", delegation_text)

        # 读取根索引 → 验证新增确认场景仍通过既有稳定逻辑 ID 命中用户规则。
        root_index_text = (
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/RULE_INDEX.md"
        ).read_text(encoding="utf-8")
        # 根索引选择器 → 同任务补充不会绕过分层规则加载链。
        self.assertIn(
            "load_rule_for_active_user_same_task_followup_after_standalone_1 = "
            "RULE_ENGINE_LOCAL_CORE_COMMON_USER_LAYER_GOVERNANCE_RULES",
            root_index_text,
        )

    def test_registry_and_secondary_executor_are_removed(self) -> None:
        """单一用户程序必须直接运行，不保留无用注册表和二次执行器。"""

        self.assertFalse((
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "registry"
        ).exists())
        self.assertFalse((
            PROJECT_ROOT
            / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code"
            / ACTIVE_STABLE_USER_ID
            / "executor.py"
        ).exists())
        self.assertTrue(callable(self.program.main))

    def test_gradle_gate_entries_are_portable_and_scope_aware(self) -> None:
        """三级门禁必须由根 Gradle 稳定暴露，并支持跨平台 Python 与变更范围选择。"""

        build_text = (PROJECT_ROOT / "build.gradle").read_text(encoding="utf-8")
        # 修改任务、待测登记、统一测试和两类文档归档均从同一个构建系统启动。
        for task_name in (
                "selplatTaskDocumentActiveGate", "selplatQuickGateCore", "selplatQuickGate", "selplatSpecialGate",
                "selplatTaskDocumentReadyGate", "selplatFullGate",
                "selplatTestDocumentPendingGate", "selplatTaskDocumentFinishGate",
                "selplatTestDocumentReadyGate", "selplatTestDocumentFinishGate", "check"):
            self.assertRegex(
                build_text,
                rf"tasks\.register\('{re.escape(task_name)}'(?:,\s*Exec)?\)",
            )
        # Python 启动器只接受工程参数或环境变量覆盖，禁止把开发者机器路径写进仓库。
        self.assertIn("providers.gradleProperty('selplatPython')", build_text)
        self.assertIn("providers.environmentVariable('SELPLAT_PYTHON')", build_text)
        self.assertNotIn("/Users/showfolder", build_text)
        # 开发快速门禁核验当前任务；修改任务关闭只要求步骤完成和待测项已登记。
        self.assertIn("dependsOn 'selplatTaskDocumentActiveGate', 'selplatQuickGateCore'", build_text)
        self.assertIn("selplatExecutionDocumentCommand('active')", build_text)
        self.assertIn("selplatExecutionDocumentCommand('ready')", build_text)
        self.assertIn("selplatExecutionDocumentCommand('finish')", build_text)
        self.assertIn("selplatTestDocumentCommand('pending')", build_text)
        self.assertIn("selplatTestDocumentCommand('ready')", build_text)
        self.assertIn("selplatTestDocumentCommand('finish')", build_text)
        self.assertIn("dependsOn 'selplatTaskDocumentReadyGate', 'selplatTestDocumentPendingGate'", build_text)
        self.assertIn("dependsOn 'selplatFullGate'", build_text)
        self.assertNotIn("dependsOn 'selplatTaskDocumentReadyGate', 'selplatFullGate'", build_text)
        # 专项范围既可由调用方直接声明，也可由工程相对变更文件推导。
        self.assertIn("providers.gradleProperty('selplatGateScope')", build_text)
        self.assertIn("providers.gradleProperty('selplatGateFiles')", build_text)
        self.assertIn("scopes.addAll(selplatKnownGateScopes)", build_text)
        # apps 范围必须从 Gradle 叶子项目动态取得，禁止再维护会遗漏未来项目的静态名称清单。
        self.assertIn("def selplatApplicationGateProjects = javaLeafProjects.findAll", build_text)
        self.assertIn("pathParts[0] == 'apps'", build_text)
        self.assertIn("pathParts[2] == 'backend'", build_text)
        self.assertIn("selplatApplicationGateProjects.collectEntries", build_text)
        self.assertIn('"${currentProject.path}:test"', build_text)
        self.assertNotIn(
            "'host', 'mda', 'reference-data', 'uniauth', 'japanese', 'rule-engine', 'shared'",
            build_text,
        )
        # shared 与 rule-engine 的额外职责保留显式附加，未知范围不能静默跳过。
        self.assertIn("selplatKnownGateScopes.add('shared')", build_text)
        self.assertIn("selplatSpecialGateTaskPaths.containsKey('rule-engine')", build_text)
        self.assertIn("throw new GradleException", build_text)



if __name__ == "__main__":
    unittest.main()
