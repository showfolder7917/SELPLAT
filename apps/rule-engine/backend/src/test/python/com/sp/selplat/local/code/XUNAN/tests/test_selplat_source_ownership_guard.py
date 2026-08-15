"""SELPLAT 全部程序的源码语言与归属门禁测试。"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
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
    / "abilities/selplat_source_ownership_guard.py"
)
RULE_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/local"
    / ACTIVE_STABLE_USER_ID
    / "selplat/通用/rule/RUL_SELPLAT程序源码语言与归属门禁规则.md"
)
PUBLIC_COMPONENT_RULE_PATH = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/resources/local"
    / ACTIVE_STABLE_USER_ID
    / "selplat/通用/rule/RUL_SELPLAT公共控件治理门禁规则.md"
)
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def load_guard_module():
    """直接加载生产门禁，不复制扫描逻辑。"""
    spec = importlib.util.spec_from_file_location("selplat_source_ownership_guard_test", PROGRAM_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SelplatSourceOwnershipGuardTests(unittest.TestCase):
    """覆盖普通应用、rule-engine 分层和源码污染。"""

    @classmethod
    def setUpClass(cls) -> None:
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        cls.guard = load_guard_module()

    def test_rule_requires_windows_and_macos_path_component_comparison(self) -> None:
        """路径治理必须固定 Windows/macOS 目标，并禁止分隔符字符串断言。"""
        # 读取当前用户层规则正本 → 防止跨平台约束只修测试而没有进入后续任务加载链。
        rule_text = RULE_PATH.read_text(encoding="utf-8")
        self.assertIn(
            "selplat_supported_desktop_path_platforms = windows,macos",
            rule_text,
        )
        self.assertIn(
            "selplat_cross_platform_path_comparison = "
            "java.nio.file.Path,python.pathlib.Path,component_or_relative_suffix,"
            "no_fixed_separator_string_assertion",
            rule_text,
        )

    def create_fixture(self, temp_root: Path) -> Path:
        """创建最小 SELPLAT 工程事实，仅用于隔离扫描。"""
        (temp_root / "settings.gradle").write_text("rootProject.name = 'fixture'\n", encoding="utf-8")
        (temp_root / "AGENTS.md").write_text(
            f"- 当前稳定用户 ID：`{ACTIVE_STABLE_USER_ID}`\n",
            encoding="utf-8",
        )
        (temp_root / ".gitignore").write_text(
            "*.trace.db\n*.lock.db\n*.temp.db\n*.before-*.db\n",
            encoding="utf-8",
        )
        registry = (
            temp_root / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "selplat/通用/registry/managed-database-applications.json"
        )
        registry.parent.mkdir(parents=True, exist_ok=True)
        registry.write_text(
            '{"version":1,"applications":[]}\n',
            encoding="utf-8",
        )
        return temp_root

    def register_managed_database_application(
            self,
            fixture: Path,
            project_name: str,
            **registration_values: str) -> None:
        """在隔离工程的当前用户中央登记中注册一个数据库应用。"""
        registry = (
            fixture / "apps/rule-engine/backend/src/main/resources/local"
            / ACTIVE_STABLE_USER_ID
            / "selplat/通用/registry/managed-database-applications.json"
        )
        registry.parent.mkdir(parents=True, exist_ok=True)
        registration = {
            "projectName": project_name,
            "schemaRoot": "db/sql",
            "primaryKeyStrategy": "one-table-one-sequence",
            **registration_values,
        }
        registry.write_text(
            json.dumps({"version": 1, "applications": [registration]}, ensure_ascii=False),
            encoding="utf-8",
        )

    def write_component_registry(self, fixture: Path, components: list[dict]) -> Path:
        """写入隔离控件登记，所有门禁测试共用同一正式策略。"""
        component_root = fixture / self.guard.SEL_UI_COMPONENT_ROOT_RELATIVE
        component_root.mkdir(parents=True, exist_ok=True)
        registry_path = component_root / self.guard.SEL_UI_COMPONENT_REGISTRY_NAME
        registry_path.write_text(
            json.dumps({
                "version": 2,
                "kernel": {
                    "script": "core/selKernel.js",
                    "publicApi": "sel",
                    "loadOrder": "first",
                },
                "policy": {
                    "creationMode": "register-before-implementation",
                    "legacyCompatibility": "forbidden",
                    "applicationPrivateReusableControl": "forbidden",
                    "requiredChecks": sorted(self.guard.SEL_UI_REQUIRED_GOVERNANCE_CHECKS),
                },
                "components": components,
            }),
            encoding="utf-8",
        )
        return component_root

    def test_managed_database_application_rejects_unpooled_datasource(self) -> None:
        """受管业务库改回 DriverManagerDataSource 时必须在快速门禁阶段阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/example.mv.db",
                datasourcePrefix="example.datasource",
            )
            persistence_file = (
                fixture
                / "apps/example/backend/src/main/java/com/sp/selplat/example/common/persistence"
                / "ExamplePersistenceConfiguration.java"
            )
            persistence_file.parent.mkdir(parents=True)
            persistence_file.write_text(
                "import org.springframework.jdbc.datasource.DriverManagerDataSource;\n"
                "class ExamplePersistenceConfiguration {\n"
                "  DriverManagerDataSource dataSource() { return new DriverManagerDataSource(); }\n"
                "}\n",
                encoding="utf-8",
            )

            registrations, _ = self.guard.load_managed_database_registry(
                fixture, ACTIVE_STABLE_USER_ID
            )
            violations = self.guard.audit_managed_datasource_pool_governance(
                fixture, registrations
            )
            codes = {violation["code"] for violation in violations}

            self.assertIn("MANAGED_APPLICATION_UNPOOLED_DATASOURCE_FORBIDDEN", codes)
            self.assertIn("MANAGED_APPLICATION_HIKARI_POOL_CONFIGURATION_MISSING", codes)

    def test_managed_database_application_accepts_qualified_hikari_pool(self) -> None:
        """具名 HikariConfig、可关闭数据源和完整基础池参数应通过连接池门禁。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/example.mv.db",
                datasourcePrefix="example.datasource",
            )
            persistence_file = (
                fixture
                / "apps/example/backend/src/main/java/com/sp/selplat/example/common/persistence"
                / "ExamplePersistenceConfiguration.java"
            )
            persistence_file.parent.mkdir(parents=True)
            persistence_file.write_text(
                "import com.zaxxer.hikari.HikariConfig;\n"
                "import com.zaxxer.hikari.HikariDataSource;\n"
                "import org.springframework.boot.context.properties.ConfigurationProperties;\n"
                "class ExamplePersistenceConfiguration {\n"
                "  @ConfigurationProperties(prefix = \"example.datasource\")\n"
                "  HikariConfig config() { return new HikariConfig(); }\n"
                "  @Bean(name = \"exampleDataSource\", destroyMethod = \"close\")\n"
                "  HikariDataSource dataSource(HikariConfig config) {\n"
                "    return new HikariDataSource(config);\n"
                "  }\n"
                "}\n",
                encoding="utf-8",
            )
            resource_file = fixture / "apps/example/backend/src/main/resources/example.properties"
            resource_file.parent.mkdir(parents=True)
            resource_file.write_text(
                "example.datasource.jdbc-url=\n"
                "example.datasource.pool-name=ExamplePool\n"
                "example.datasource.driver-class-name=org.h2.Driver\n"
                "example.datasource.minimum-idle=1\n"
                "example.datasource.maximum-pool-size=4\n",
                encoding="utf-8",
            )

            registrations, _ = self.guard.load_managed_database_registry(
                fixture, ACTIVE_STABLE_USER_ID
            )
            violations = self.guard.audit_managed_datasource_pool_governance(
                fixture, registrations
            )

            self.assertEqual([], violations)

    def test_frontend_identity_write_fields_block_delivery(self) -> None:
        """页面重新提供租户或操作员编辑提交时必须由快速门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            application_script = (
                fixture / "apps/example/backend/src/main/resources/static/example/example.js"
            )
            application_script.parent.mkdir(parents=True)
            application_script.write_text(
                'const rows = [{name: "tenantId", type: "number"}];\n'
                'const payload = {lastOperateUserId: 9};\n',
                encoding="utf-8",
            )

            violations = self.guard.audit_frontend_identity_write_governance(fixture)

            self.assertEqual(
                ["FRONTEND_IDENTITY_WRITE_FIELD_FORBIDDEN"],
                [violation["code"] for violation in violations],
            )

    def test_unregistered_component_directory_blocks_delivery(self) -> None:
        """新增控件目录不能绕过中央登记直接进入公共源码。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            component_root = self.write_component_registry(fixture, [])
            (component_root / "private-widget").mkdir()

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_COMPONENT_DIRECTORY_UNREGISTERED",
                {violation["code"] for violation in violations},
            )

    def test_application_private_body_portal_blocks_delivery(self) -> None:
        """业务应用自行把交互门户挂到 body 时必须先抽取公共控件。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example.js"
            application_js.parent.mkdir(parents=True)
            application_js.write_text(
                "const menu = document.createElement('div'); document.body.appendChild(menu);\n",
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_APPLICATION_PRIVATE_BODY_PORTAL",
                {violation["code"] for violation in violations},
            )

    def test_application_legacy_flat_api_and_native_freeze_block_delivery(self) -> None:
        """应用回流 window.selGrid 或直接 Object.freeze 时必须由统一 API 门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example.js"
            application_js.parent.mkdir(parents=True)
            application_js.write_text(
                "const grid = window.selGrid;\nconst view = Object.freeze({items: []});\n",
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)
            codes = {violation["code"] for violation in violations}

            self.assertIn("SEL_UI_LEGACY_FLAT_API_FORBIDDEN", codes)
            self.assertIn("SEL_UI_NATIVE_FREEZE_OUTSIDE_KERNEL", codes)

    def test_application_native_dom_creation_blocks_but_public_element_passes(self) -> None:
        """业务应用必须通过 sel.core.element 创建节点，公共组件内部原生实现不受此应用边界影响。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example.js"
            application_js.parent.mkdir(parents=True)
            # 直接创建原生节点 → 快速门禁给出稳定违规码，阻止业务页面复制安全属性边界。
            application_js.write_text(
                "const node = document.createElement('section');\n",
                encoding="utf-8",
            )
            violations = self.guard.audit_sel_ui_component_governance(fixture)
            self.assertIn(
                "SEL_UI_APPLICATION_NATIVE_DOM_CREATION_FORBIDDEN",
                {violation["code"] for violation in violations},
            )

            # 使用公共 element → 同一业务结构通过，不要求应用了解原生节点创建细节。
            application_js.write_text(
                "const { element } = window.sel.core;\nconst node = element('section');\n",
                encoding="utf-8",
            )
            violations = self.guard.audit_sel_ui_component_governance(fixture)
            self.assertNotIn(
                "SEL_UI_APPLICATION_NATIVE_DOM_CREATION_FORBIDDEN",
                {violation["code"] for violation in violations},
            )

        # 规则正本必须同时声明消费入口和快速门禁，避免只改程序而后续任务无法加载约束。
        rule_text = PUBLIC_COMPONENT_RULE_PATH.read_text(encoding="utf-8")
        self.assertIn("selplat_application_dom_creation_entry = sel.core.element", rule_text)
        self.assertIn("selplat_application_dom_creation_gate =", rule_text)
        self.assertIn("nontrivial_function_chinese_contract", rule_text)
        self.assertIn("complex_statement_group_business_intent_comment", rule_text)
        self.assertIn("selplat_application_javascript_uniform_structure_gate =", rule_text)

    def test_application_javascript_uniform_structure_gate(self) -> None:
        """全部应用入口统一使用 app、SEL 公共短名和具名函数中文契约。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example/example.js"
            application_js.parent.mkdir(parents=True)
            application_js.write_text(
                "/* SEL UI 应用装配说明。 */\n"
                "(function exampleInitializeApplication() {\n"
                "window.sel.require([\"core.query\", \"net.ajax\"]);\n"
                "const base = window.sel.core;\n"
                "const { ajax } = window.sel.net;\n"
                "function loadData() { return ajax.json({ url: '/api/example' }); }\n"
                "loadData();\n"
                "}());\n",
                encoding="utf-8",
            )
            violations = self.guard.audit_sel_ui_component_governance(fixture)
            codes = {violation["code"] for violation in violations}
            self.assertIn("SEL_UI_APPLICATION_ENTRY_NAMING_INVALID", codes)
            self.assertIn("SEL_UI_APPLICATION_BASE_ALIAS_MISSING", codes)
            self.assertIn("SEL_UI_APPLICATION_AJAX_ALIAS_MISSING", codes)
            self.assertIn("SEL_UI_APPLICATION_FUNCTION_COMMENT_MISSING", codes)

            application_js.write_text(
                "/* SEL UI 应用装配说明。 */\n"
                "(function app() {\n"
                "window.sel.require([\"core.query\", \"net.ajax\"]);\n"
                "const selBase = window.sel.core;\n"
                "const { ajax: selAjax } = window.sel.net;\n"
                "/** 读取示例业务数据。 */\n"
                "function exampleLoadData() { return selAjax.json({ url: '/api/example' }); }\n"
                "exampleLoadData();\n"
                "}());\n",
                encoding="utf-8",
            )
            violations = self.guard.audit_sel_ui_component_governance(fixture)
            codes = {violation["code"] for violation in violations}
            self.assertNotIn("SEL_UI_APPLICATION_ENTRY_NAMING_INVALID", codes)
            self.assertNotIn("SEL_UI_APPLICATION_BASE_ALIAS_MISSING", codes)
            self.assertNotIn("SEL_UI_APPLICATION_AJAX_ALIAS_MISSING", codes)
            self.assertNotIn("SEL_UI_APPLICATION_FUNCTION_COMMENT_MISSING", codes)

    def test_nested_sel_freeze_blocks_delivery_but_single_boundary_passes(self) -> None:
        """完整只读边界只能冻结一次，内部对象不得再次逐层冻结。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example.js"
            application_js.parent.mkdir(parents=True)
            application_js.write_text(
                "const view = selFreeze({ grid: selFreeze({ pageSize: 20 }) });\n",
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)
            self.assertIn(
                "SEL_UI_NESTED_FREEZE_FORBIDDEN",
                {violation["code"] for violation in violations},
            )

            application_js.write_text(
                "const view = selFreeze({ grid: { pageSize: 20 } });\n",
                encoding="utf-8",
            )
            violations = self.guard.audit_sel_ui_component_governance(fixture)
            self.assertNotIn(
                "SEL_UI_NESTED_FREEZE_FORBIDDEN",
                {violation["code"] for violation in violations},
            )

    def test_application_page_requires_kernel_before_other_sel_scripts(self) -> None:
        """应用页面缺少 selKernel 或晚于组件加载时必须阻断交付。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_html = fixture / "apps/example/backend/src/main/resources/static/example.html"
            application_html.parent.mkdir(parents=True)
            application_html.write_text(
                '<script src="/sel/core/selBaseRuntime.js"></script>\n'
                '<script src="/sel/core/selKernel.js"></script>\n',
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_KERNEL_LOAD_ORDER_INVALID",
                {violation["code"] for violation in violations},
            )

    def test_delete_confirmation_using_full_window_blocks_delivery(self) -> None:
        """删除动作使用完整 selWindow 模拟确认框时必须由公共控件门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example.js"
            application_js.parent.mkdir(parents=True)
            application_js.write_text(
                "state.deleteWindowController = window.selWindow.mount(host, {\n"
                "  id: \"selWindowExampleDeleteId\", title: \"删除记录\"\n"
                "});\n",
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_DESTRUCTIVE_CONFIRMATION_WINDOW_FORBIDDEN",
                {violation["code"] for violation in violations},
            )

    def test_delete_confirmation_with_unimplemented_database_claim_blocks_delivery(self) -> None:
        """删除提示虚构数据库关联阻断能力时必须由公共控件门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.write_component_registry(fixture, [])
            application_js = fixture / "apps/example/backend/src/main/resources/static/example.js"
            application_js.parent.mkdir(parents=True)
            application_js.write_text(
                'const message = "存在关联数据时由数据库阻止不安全操作";\n',
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_DESTRUCTIVE_CONFIRMATION_MISLEADING_COPY",
                {violation["code"] for violation in violations},
            )

    def test_component_dependency_resources_are_mandatory_and_ordered(self) -> None:
        """页面使用依赖型控件时必须先加载登记中的公共依赖资源。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            components = [
                {
                    "id": "selContextMenu",
                    "directory": "context-menu",
                    "type": "interactive",
                    "scripts": ["selContextMenu.js"],
                    "styles": ["selContextMenu.css"],
                    "publicApi": "sel.components.contextMenu",
                    "dependencies": [],
                    "themeAware": True,
                    "ownedAriaRoles": ["menu"],
                },
                {
                    "id": "selTree",
                    "directory": "tree",
                    "type": "interactive",
                    "scripts": ["selTree.js"],
                    "styles": ["selTree.css"],
                    "publicApi": "sel.components.tree",
                    "dependencies": ["selContextMenu"],
                    "themeAware": True,
                },
            ]
            component_root = self.write_component_registry(fixture, components)
            for component in components:
                source_root = component_root / component["directory"]
                source_root.mkdir()
                component_api_name = component["id"][3:4].lower() + component["id"][4:]
                (source_root / component["scripts"][0]).write_text(
                    f'window.sel.register("components.{component_api_name}", {{}}); '
                    "window.sel.components.contextMenu;\n",
                    encoding="utf-8",
                )
                (source_root / component["styles"][0]).write_text(
                    ".control { color: var(--sel-theme-text-body); }\n",
                    encoding="utf-8",
                )
            application_html = fixture / "apps/example/backend/src/main/resources/static/example.html"
            application_html.parent.mkdir(parents=True)
            application_html.write_text(
                '<link rel="stylesheet" href="/sel/components/tree/selTree.css">\n'
                '<script src="/sel/components/tree/selTree.js"></script>\n',
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_COMPONENT_DEPENDENCY_RESOURCE_INVALID",
                {violation["code"] for violation in violations},
            )

    def test_tree_uses_only_registered_context_menu(self) -> None:
        """树只组合动作语义，不保留旧私有菜单 DOM 与 CSS。"""
        tree_root = PROJECT_ROOT / "shared/frontend/sel-ui/src/components/tree"
        tree_script = (tree_root / "selTree.js").read_text(encoding="utf-8")
        tree_style = (tree_root / "selTree.css").read_text(encoding="utf-8")

        self.assertIn("window.sel.components.contextMenu.mount", tree_script)
        self.assertNotIn("seltree-context-menu", tree_script)
        self.assertNotIn("seltree-context-menu", tree_style)

    def test_tree_leaf_alignment_placeholder_is_not_an_unnamed_button(self) -> None:
        """叶子节点对齐占位必须是非交互元素，不能进入按钮可访问树。"""
        tree_script = (PROJECT_ROOT / "shared/frontend/sel-ui/src/components/tree/selTree.js") \
            .read_text(encoding="utf-8")

        self.assertIn('document.createElement(hasChildren ? "button" : "span")', tree_script)
        self.assertIn('toggle.setAttribute("aria-hidden", "true")', tree_script)

    def test_grid_icon_action_without_unified_tooltip_blocks_delivery(self) -> None:
        """Grid 纯图标记录操作缺少 always Tip 或可访问名称时必须阻断交付。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            components = [
                {
                    "id": "selTooltip",
                    "directory": "tooltip",
                    "type": "interactive",
                    "scripts": ["selTooltip.js"],
                    "styles": ["selTooltip.css"],
                    "publicApi": "sel.components.tooltip",
                    "dependencies": [],
                    "themeAware": True,
                    "ownedAriaRoles": ["tooltip"],
                },
                {
                    "id": "selGrid",
                    "directory": "grid",
                    "type": "interactive",
                    "scripts": ["selGrid.js"],
                    "styles": ["selGrid.css"],
                    "publicApi": "sel.components.grid",
                    "dependencies": ["selTooltip"],
                    "themeAware": True,
                },
            ]
            component_root = self.write_component_registry(fixture, components)
            tooltip_root = component_root / "tooltip"
            tooltip_root.mkdir()
            (tooltip_root / "selTooltip.js").write_text(
                'window.sel.register("components.tooltip", {}); data-sel-tooltip selTooltipIsTruncated pointerover '
                'focusin aria-describedby role", "tooltip if (selTooltipAriaElement &&\n',
                encoding="utf-8",
            )
            (tooltip_root / "selTooltip.css").write_text(
                ".tooltip { color: var(--sel-theme-text-body); }\n",
                encoding="utf-8",
            )
            grid_root = component_root / "grid"
            grid_root.mkdir()
            (grid_root / "selGrid.js").write_text(
                'window.sel.register("components.grid", {}); window.sel.components.tooltip.attach(); '
                "button.dataset.selTooltip = label;\n",
                encoding="utf-8",
            )
            (grid_root / "selGrid.css").write_text(
                ".grid { color: var(--sel-theme-text-body); }\n",
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_component_governance(fixture)

            self.assertIn(
                "SEL_UI_GRID_ACTION_TOOLTIP_CONTRACT_MISSING",
                {violation["code"] for violation in violations},
            )

    def test_real_sel_ui_uses_complete_semantic_typography(self) -> None:
        """真实公共控件必须具有七级文字角色且不再引用旧两档字号。"""
        violations = self.guard.audit_sel_ui_typography_governance(PROJECT_ROOT)

        self.assertEqual([], violations)

    def test_real_sel_ui_has_complete_page_editor_contract(self) -> None:
        """真实个性化与 Grid 必须同时提供页面编辑会话和列宽状态适配器。"""
        violations = self.guard.audit_sel_ui_component_governance(PROJECT_ROOT)

        self.assertNotIn(
            "SEL_UI_PAGE_EDITOR_CONTRACT_MISSING",
            {violation["code"] for violation in violations},
        )
        self.assertNotIn(
            "SEL_UI_GRID_PAGE_EDITOR_ADAPTER_MISSING",
            {violation["code"] for violation in violations},
        )

    def test_real_grid_header_separator_covers_first_column_only_until_last(self) -> None:
        """表头竖线必须从第一列开始，并只排除没有后续列的最后一列。"""
        grid_style = (PROJECT_ROOT / "shared/frontend/sel-ui/src/components/grid/selGrid.css") \
            .read_text(encoding="utf-8")

        self.assertIn(".selgrid-table th:not(:last-child)::after", grid_style)
        self.assertNotIn(".selgrid-table th:not(:first-child)::after", grid_style)

    def test_panel_respects_hidden_and_compacts_actions_before_title_overlap(self) -> None:
        """隐藏面板不得占位，常见窄屏宽度必须先收起动作文字再允许标题相撞。"""
        panel_style = (PROJECT_ROOT / "shared/frontend/sel-ui/src/components/panel/selPanel.css") \
            .read_text(encoding="utf-8")

        self.assertIn(".selpanel-shell[hidden]", panel_style)
        self.assertIn("@media (max-width: 1380px)", panel_style)
        self.assertIn(".selpanel-header-actions span", panel_style)

    def test_legacy_typography_token_blocks_delivery(self) -> None:
        """新增样式重新引用 primary 或 secondary 时必须由统一门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            source_root = fixture / self.guard.SEL_UI_SOURCE_ROOT_RELATIVE
            token_path = source_root / self.guard.SEL_UI_TYPOGRAPHY_TOKEN_RELATIVE
            contract_path = source_root / self.guard.SEL_UI_TYPOGRAPHY_CONTRACT_RELATIVE
            token_path.parent.mkdir(parents=True, exist_ok=True)
            token_path.write_text(
                "\n".join(
                    f"--sel-theme-font-size-{role}: 12px;"
                    for role in self.guard.SEL_UI_SEMANTIC_FONT_ROLES
                )
                + "\n--sel-theme-font-weight-regular: 400;"
                + "\n--sel-theme-font-weight-medium: 500;"
                + "\n--sel-theme-font-weight-semibold: 600;"
                + "\n--sel-theme-font-weight-bold: 700;"
                + "\n--sel-theme-line-height-body: 1.5;\n",
                encoding="utf-8",
            )
            contract_path.write_text(
                "\n".join(
                    f".seltree-node-text-{role} .seltree-node-label {{}}"
                    for role in ("heading", "body", "label", "caption")
                ),
                encoding="utf-8",
            )
            component_style = source_root / "components/example/selExample.css"
            component_style.parent.mkdir(parents=True)
            component_style.write_text(
                ".example { font-size: var(--sel-theme-font-size-primary); }\n",
                encoding="utf-8",
            )

            violations = self.guard.audit_sel_ui_typography_governance(fixture)

            self.assertIn(
                "SEL_UI_LEGACY_TYPOGRAPHY_TOKEN",
                {violation["code"] for violation in violations},
            )

    def test_missing_central_registry_blocks_delivery(self) -> None:
        """删除中央登记本身不能把全部严格数据库应用降级为未受管。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            registry = self.guard.managed_database_registry_path(
                fixture, ACTIVE_STABLE_USER_ID
            )
            registry.unlink()

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_DATABASE_REGISTRY_MISSING",
                {violation["code"] for violation in result["violations"]},
            )

    def test_application_local_managed_registry_is_forbidden(self) -> None:
        """旧式应用内受管隐藏文件不能重新成为第二事实来源。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            project.mkdir(parents=True)
            (project / ".selplat-managed-database-application.json").write_text(
                "{}\n", encoding="utf-8"
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_DATABASE_APPLICATION_LOCAL_REGISTRY_FORBIDDEN",
                {violation["code"] for violation in result["violations"]},
            )

    def test_project_specific_structure_is_forbidden_for_every_application(self) -> None:
        """任何项目都不能通过中央登记选择专属架构或绕过通用结构门禁。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            project.mkdir(parents=True)
            registry = self.guard.managed_database_registry_path(fixture, ACTIVE_STABLE_USER_ID)
            registry.write_text(
                json.dumps({
                    "version": 1,
                    "applications": [{
                        "projectName": "example",
                        "structure": "control-table-and-dynamic-target-runtime",
                        "schemaRoot": "db/sql",
                        "databaseFile": "db/example.mv.db",
                        "primaryKeyStrategy": "one-table-one-sequence",
                        "datasourcePrefix": "example.datasource",
                    }],
                }),
                encoding="utf-8",
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_DATABASE_REGISTRY_SPECIAL_STRUCTURE_FORBIDDEN",
                {violation["code"] for violation in result["violations"]},
            )

    def test_uniform_capability_rejects_dao_and_custom_role_for_every_project(self) -> None:
        """不落库能力只能使用通用 controller、service 和 service/impl 结构。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            capability = (
                project / "backend/src/main/java/com/sp/selplat/example/capability/export"
            )
            for role in ("controller", "service/impl", "dao"):
                (capability / role).mkdir(parents=True)
            (capability / "dao/ExportDao.java").write_text(
                "package com.sp.selplat.example.capability.export.dao; class ExportDao {}\n",
                encoding="utf-8",
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertIn("MANAGED_APPLICATION_CAPABILITY_ROLE_SET_INVALID", codes)
            self.assertIn("MANAGED_APPLICATION_CAPABILITY_SOURCE_ROLE_INVALID", codes)

    def test_managed_application_gate_contains_no_project_name_bypass(self) -> None:
        """生产门禁不得重新按 mda 或其他项目名编写结构放行分支。"""
        source_text = PROGRAM_PATH.read_text(encoding="utf-8")

        self.assertNotRegex(source_text, r"project_root_path\.name\s*==")
        self.assertNotIn("control-table-and-dynamic-target-runtime", source_text)

    def test_sql_statement_parser_preserves_semicolon_inside_seed_value(self) -> None:
        """JDBC 参数值中的分号不能把一条幂等 INSERT 错拆成多条语句。"""
        statements = self.guard.sql_statements(
            "INSERT INTO Demo(value) SELECT 'MODE=MySQL;AUTO_SERVER=TRUE' "
            "WHERE NOT EXISTS (SELECT 1 FROM Demo);"
        )

        self.assertEqual(1, len(statements))
        self.assertIn("WHERE NOT EXISTS", statements[0])

    def test_mda_generator_rejects_missing_multilingual_default_fields(self) -> None:
        """新业务表模板缺少任一平台默认字段时必须在快速门禁阶段阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            template = fixture / self.guard.APPLICATION_SCAFFOLD_TEMPLATE_RELATIVE
            template.parent.mkdir(parents=True)
            template.write_text(
                "private static String tableSchema() {\n"
                "  return \"CREATE TABLE Demo (tenantId BIGINT, name VARCHAR(20));\";\n"
                "}\n"
                "private static String daoJava() { return \"\"; }\n",
                encoding="utf-8",
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "APPLICATION_SCAFFOLD_DEFAULT_BUSINESS_FIELDS_INVALID",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_database_application_rejects_extra_root_directory(self) -> None:
        """数据库应用根只保存真实工程组成，不允许增加预留或登记目录。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            (project / "backend").mkdir(parents=True)
            (project / "future-placeholder").mkdir()
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/example.mv.db",
                datasourcePrefix="example.datasource",
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_DATABASE_APPLICATION_ROOT_CONTENT_FORBIDDEN",
                {violation["code"] for violation in result["violations"]},
            )

    def test_every_application_rejects_nested_gitignore(self) -> None:
        """全部应用和共享模块不得在子目录散落仓库忽略规则。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            database_root = project / "db"
            database_root.mkdir(parents=True)
            (database_root / ".gitignore").write_text("*.mv.db\n", encoding="utf-8")
            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "NESTED_GITIGNORE_FORBIDDEN",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_database_application_rejects_non_idempotent_rebuild_sql(self) -> None:
        """启动 SQL 不能重建已有表、覆盖种子数据或删除已有内容。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            sql_root = project / "db/sql"
            sql_root.mkdir(parents=True)
            (sql_root / "schema-ExampleCatalog.sql").write_text(
                "CREATE TABLE ExampleCatalog (id BIGINT PRIMARY KEY);\n"
                "DROP TABLE IF EXISTS ExampleLegacy;\n",
                encoding="utf-8",
            )
            (sql_root / "data-ExampleCatalog.sql").write_text(
                "MERGE INTO ExampleCatalog (id) KEY(id) VALUES (1);\n",
                encoding="utf-8",
            )
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/example.mv.db",
                datasourcePrefix="example.datasource",
            )

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertIn("MANAGED_APPLICATION_SCHEMA_CREATE_NOT_IDEMPOTENT", codes)
            self.assertIn("MANAGED_APPLICATION_SCHEMA_DESTRUCTIVE_REFRESH_FORBIDDEN", codes)
            self.assertIn("MANAGED_APPLICATION_SEED_MERGE_OVERWRITE_FORBIDDEN", codes)

    def test_root_gitignore_must_not_hide_database_files(self) -> None:
        """根规则不得用通配符隐藏 mv.db，H2 运行副产物仍必须排除。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            (fixture / ".gitignore").write_text(
                "*.mv.db\n*.trace.db\n*.lock.db\n*.temp.db\n*.before-*.db\n",
                encoding="utf-8",
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "ROOT_H2_GITIGNORE_POLICY_INVALID",
                {violation["code"] for violation in result["violations"]},
            )

    def test_current_selplat_source_tree_has_zero_violations(self) -> None:
        """真实工程交付前必须保持零违规。"""
        result = self.guard.audit_source_ownership(PROJECT_ROOT)
        self.assertEqual(result["violations"], [])
        self.assertEqual(result["status"], "completed")

    def test_standard_gradle_backend_rejects_unregistered_python(self) -> None:
        """普通 Gradle 后端只登记 Java，误建 Python 根必须阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            module = fixture / "apps/example/backend"
            (module / "src/main/java/com/example").mkdir(parents=True)
            (module / "src/main/java/com/example/Example.java").write_text(
                "final class Example {}\n", encoding="utf-8"
            )
            (module / "src/main/python/com/example").mkdir(parents=True)
            (module / "src/main/python/com/example/tool.py").write_text("pass\n", encoding="utf-8")
            (module / "build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "UNREGISTERED_LANGUAGE_ROOT",
                {violation["code"] for violation in result["violations"]},
            )

    def test_rule_engine_accepts_active_user_ability_and_rejects_pollution(self) -> None:
        """正确用户能力可进入 rule-engine，但生成缓存不得进入源码树。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            ability_root = (
                fixture / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code"
                / ACTIVE_STABLE_USER_ID / "abilities"
            )
            ability_root.mkdir(parents=True)
            (ability_root / "example.py").write_text("pass\n", encoding="utf-8")
            cache_root = ability_root / "__pycache__"
            cache_root.mkdir()
            (cache_root / "example.pyc").write_bytes(b"cache")

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertNotIn("RULE_ENGINE_SOURCE_UNKNOWN_LAYER", codes)
            self.assertIn("SOURCE_TREE_GENERATED_OR_OS_FILE", codes)

    def test_application_rejects_private_request_and_result_protocol_types(self) -> None:
        """业务应用自建 Request 或 Result 时必须阻断交付。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            java_root = fixture / "apps/example/backend/src/main/java/com/example"
            java_root.mkdir(parents=True)
            (java_root / "ExampleRequest.java").write_text(
                "public record ExampleRequest(String value) {}\n", encoding="utf-8"
            )
            (java_root / "ExampleResult.java").write_text(
                "public record ExampleResult(String value) {}\n", encoding="utf-8"
            )
            (fixture / "apps/example/backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )

            result = self.guard.audit_source_ownership(fixture)
            violations = [
                violation for violation in result["violations"]
                if violation["code"] == "APPLICATION_PRIVATE_COMMON_PROTOCOL_TYPE"
            ]

            self.assertEqual(len(violations), 2)
            self.assertEqual(
                {Path(violation["path"]).name for violation in violations},
                {"ExampleRequest.java", "ExampleResult.java"},
            )

    def test_application_rejects_generated_table_domain_type(self) -> None:
        """公共 CRUD 已按元数据运行时，应用再生成表 Domain 必须阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            domain_root = fixture / "apps/example/backend/src/main/java/com/example/item/domain"
            domain_root.mkdir(parents=True)
            (domain_root / "ExampleItem.java").write_text(
                "public class ExampleItem {}\n", encoding="utf-8"
            )
            (fixture / "apps/example/backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "APPLICATION_UNUSED_TABLE_DOMAIN_TYPE",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_application_rejects_technical_first_and_common_service(self) -> None:
        """受管数据库工程必须按业务聚合，common 也不能建立 Service 根目录。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            old_root = project / "backend/src/main/java/com/sp/selplat/example/controller/catalog"
            old_root.mkdir(parents=True)
            (old_root / "CatalogController.java").write_text(
                "public class CatalogController {}\n", encoding="utf-8"
            )
            common_service_root = (
                project / "backend/src/main/java/com/sp/selplat/example/common/service"
            )
            common_service_root.mkdir(parents=True)
            (common_service_root / "ExampleBaseService.java").write_text(
                "public class ExampleBaseService {}\n", encoding="utf-8"
            )
            persistence_root = (
                project / "backend/src/main/java/com/sp/selplat/example/common/persistence"
            )
            persistence_root.mkdir(parents=True)
            (persistence_root / "ExampleDatabase.java").write_text(
                "public class ExampleDatabase {}\n", encoding="utf-8"
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            (project / ".selplat-generated-project.json").write_text("{}\n", encoding="utf-8")

            result = self.guard.audit_source_ownership(fixture)

            structure_violations = [
                violation for violation in result["violations"]
                if violation["code"] == "MANAGED_APPLICATION_TECHNICAL_FIRST_PACKAGE"
            ]
            self.assertEqual(len(structure_violations), 1)
            self.assertTrue(structure_violations[0]["path"].endswith("CatalogController.java"))
            self.assertIn(
                "MANAGED_APPLICATION_COMMON_ROLE_OUTSIDE_ALLOWLIST",
                {violation["code"] for violation in result["violations"]},
            )
            self.assertIn(
                "MANAGED_APPLICATION_COMMON_PERSISTENCE_ROLE_INVALID",
                {violation["code"] for violation in result["violations"]},
            )

    def test_registered_database_application_without_generator_marker_passes_structure_gate(self) -> None:
        """非生成工程登记为数据库应用后，也不能逃过业务聚合门禁。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            old_root = project / "backend/src/main/java/com/sp/selplat/example/controller/catalog"
            old_root.mkdir(parents=True)
            (old_root / "CatalogController.java").write_text(
                "public class CatalogController {}\n", encoding="utf-8"
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_APPLICATION_TECHNICAL_FIRST_PACKAGE",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_application_rejects_mixed_query_representation_controller(self) -> None:
        """树、下拉和右键菜单必须由已登记的数据模型及其业务 Controller 提供。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            controller_root = (
                project / "backend/src/main/java/com/sp/selplat/example/catalog/controller"
            )
            controller_root.mkdir(parents=True)
            (controller_root / "CatalogQueryController.java").write_text(
                'class CatalogQueryController { String tree = "/catalog/tree"; '
                'String options = "/catalog/options"; }\n',
                encoding="utf-8",
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_APPLICATION_QUERY_REPRESENTATIONS_MIXED_CONTROLLER",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_application_allows_registered_type_plus_tree_node_representations(self) -> None:
        """显式登记类型化节点模型后，同一 TreeNode 业务可以输出树、选项和菜单。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            controller_root = (
                project / "backend/src/main/java/com/sp/selplat/example/catalog/controller"
            )
            controller_root.mkdir(parents=True)
            (controller_root / "CatalogQueryController.java").write_text(
                'class CatalogQueryController { String tree = "/catalog/tree"; '
                'String options = "/catalog/options"; '
                'String menu = "/catalog/context-menu"; }\n',
                encoding="utf-8",
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            self.register_managed_database_application(
                fixture,
                "example",
                queryRepresentationModel="type-plus-tree-node",
            )

            result = self.guard.audit_source_ownership(fixture)

            self.assertNotIn(
                "MANAGED_APPLICATION_QUERY_REPRESENTATIONS_MIXED_CONTROLLER",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_application_rejects_multiple_services_for_one_business(self) -> None:
        """同一受管业务只能拥有一个 Service 接口和一个 impl 实现。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            service_root = (
                project / "backend/src/main/java/com/sp/selplat/example/catalog/service"
            )
            implementation_root = service_root / "impl"
            implementation_root.mkdir(parents=True)
            for name in ("CatalogService", "CatalogContentService"):
                (service_root / f"{name}.java").write_text(
                    f"public interface {name} {{}}\n", encoding="utf-8"
                )
                (implementation_root / f"{name}Impl.java").write_text(
                    f"public class {name}Impl {{}}\n", encoding="utf-8"
                )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            (project / ".selplat-generated-project.json").write_text("{}\n", encoding="utf-8")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_APPLICATION_BUSINESS_SERVICE_CARDINALITY",
                {violation["code"] for violation in result["violations"]},
            )

    def test_managed_application_rejects_table_directory_mapping_gaps(self) -> None:
        """真实表与 common 外业务目录必须双向对应，且表业务只能有三种职责。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            package_root = project / "backend/src/main/java/com/sp/selplat/example"
            orphan_business = package_root / "orphanquery"
            (orphan_business / "controller").mkdir(parents=True)
            (orphan_business / "service/impl").mkdir(parents=True)
            (orphan_business / "dao").mkdir(parents=True)
            schema_root = project / "db/sql"
            schema_root.mkdir(parents=True)
            (schema_root / "schema-ExampleCatalog.sql").write_text(
                "CREATE TABLE ExampleCatalog (id BIGINT PRIMARY KEY);\n", encoding="utf-8"
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertIn("MANAGED_APPLICATION_BUSINESS_WITHOUT_TABLE", codes)
            self.assertIn("MANAGED_APPLICATION_TABLE_WITHOUT_BUSINESS", codes)

    def test_managed_application_rejects_cross_table_dao_and_stateful_util(self) -> None:
        """Controller、Service、DAO 与 common/util 的调用边界必须由源码门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            package_root = project / "backend/src/main/java/com/sp/selplat/example"
            service_root = package_root / "catalog/service/impl"
            service_root.mkdir(parents=True)
            (package_root / "catalog/controller").mkdir(parents=True)
            (package_root / "catalog/dao").mkdir(parents=True)
            (service_root / "CatalogServiceImpl.java").write_text(
                "import com.sp.selplat.example.inventory.dao.InventoryDao; class CatalogServiceImpl {}\n",
                encoding="utf-8",
            )
            util_root = package_root / "common/util/catalog"
            util_root.mkdir(parents=True)
            (util_root / "CatalogService.java").write_text(
                "@Service class CatalogService {}\n", encoding="utf-8"
            )
            schema_root = project / "db/sql"
            schema_root.mkdir(parents=True)
            (schema_root / "schema-ExampleCatalog.sql").write_text(
                "CREATE TABLE ExampleCatalog (id BIGINT PRIMARY KEY);\n", encoding="utf-8"
            )
            (project / "backend/build.gradle").write_text(
                "plugins { id 'java' }\n", encoding="utf-8"
            )
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertIn("MANAGED_APPLICATION_CROSS_TABLE_DAO_ACCESS", codes)
            self.assertIn("MANAGED_APPLICATION_COMMON_UTIL_BUSINESS_ROLE", codes)

    def test_strict_database_application_rejects_nested_database_identity_and_missing_sequence(self) -> None:
        """严格数据库应用必须固定数据库位置并为每张业务表登记唯一号段。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            package_root = project / "backend/src/main/java/com/sp/selplat/example/examplecatalog"
            for role in ("controller", "service/impl", "dao"):
                (package_root / role).mkdir(parents=True)
            schema_root = project / "db/sql"
            schema_root.mkdir(parents=True)
            (schema_root / "schema-ExampleCatalog.sql").write_text(
                "CREATE TABLE ExampleCatalog (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY);\n",
                encoding="utf-8",
            )
            nested_database = project / "db/data/example.mv.db"
            nested_database.parent.mkdir(parents=True)
            nested_database.write_bytes(b"fixture")
            (project / "backend/build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/data/example.mv.db",
                datasourcePrefix="example.datasource",
            )
            resource_root = project / "backend/src/main/resources"
            resource_root.mkdir(parents=True)
            (resource_root / "example-module.properties").write_text(
                "example.datasource.username=sa\nexample.datasource.password=\n",
                encoding="utf-8",
            )

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertIn("MANAGED_APPLICATION_DATABASE_FILE_REGISTRATION_INVALID", codes)
            self.assertIn("MANAGED_APPLICATION_DATABASE_FILE_LOCATION_INVALID", codes)
            self.assertIn("MANAGED_APPLICATION_COMMON_SEQUENCE_SQL_MISSING", codes)
            self.assertIn("MANAGED_APPLICATION_BUSINESS_IDENTITY_FORBIDDEN", codes)
            self.assertIn("MANAGED_APPLICATION_DEFAULT_DATABASE_CREDENTIAL_INVALID", codes)

    def test_strict_database_application_allows_fully_empty_sequence_data(self) -> None:
        """管理员逐条建立号段时，CommonSequenceSegment 数据脚本允许整体为空。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            for role in ("controller", "service/impl", "dao"):
                (project / "backend/src/main/java/com/sp/selplat/example/examplecatalog" / role).mkdir(
                    parents=True,
                )
            sql_root = project / "db/sql"
            sql_root.mkdir(parents=True)
            (sql_root / "schema-ExampleCatalog.sql").write_text(
                "CREATE TABLE IF NOT EXISTS ExampleCatalog (id BIGINT PRIMARY KEY);\n",
                encoding="utf-8",
            )
            (sql_root / "data-ExampleCatalog.sql").write_text("SELECT 1;\n", encoding="utf-8")
            (sql_root / "schema-CommonSequenceSegment.sql").write_text(
                "CREATE TABLE IF NOT EXISTS CommonSequenceSegment "
                "(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, seqCode VARCHAR(100));\n",
                encoding="utf-8",
            )
            (sql_root / "data-CommonSequenceSegment.sql").write_text("SELECT 1;\n", encoding="utf-8")
            (project / "backend/build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)

            self.assertNotIn(
                "MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID",
                {violation["code"] for violation in result["violations"]},
            )

    def test_global_code_namespace_allows_one_aggregate_sequence_and_no_seed_files(self) -> None:
        """全局 code 命名空间使用一个聚合号段时，空业务表不需要伪造 data 文件。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            sql_root = project / "db/sql"
            sql_root.mkdir(parents=True)
            for table_name in ("ExampleCatalog", "ExampleItem"):
                package_name = table_name.lower()
                for role in ("controller", "service/impl", "dao"):
                    (project / "backend/src/main/java/com/sp/selplat/example" / package_name / role).mkdir(
                        parents=True,
                    )
                (sql_root / f"schema-{table_name}.sql").write_text(
                    f"CREATE TABLE IF NOT EXISTS {table_name} (id BIGINT PRIMARY KEY);\n",
                    encoding="utf-8",
                )
            (sql_root / "schema-CommonSequenceSegment.sql").write_text(
                "CREATE TABLE IF NOT EXISTS CommonSequenceSegment "
                "(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, seqCode VARCHAR(100));\n",
                encoding="utf-8",
            )
            (sql_root / "data-CommonSequenceSegment.sql").write_text(
                "INSERT INTO CommonSequenceSegment (seqCode) SELECT 'ExampleObjectId' "
                "WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment "
                "WHERE seqCode = 'ExampleObjectId');\n",
                encoding="utf-8",
            )
            (project / "backend/build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/example.mv.db",
                datasourcePrefix="example.datasource",
                primaryKeyStrategy="aggregate-global-code-sequence",
                aggregateSequenceCode="ExampleObjectId",
                globalCodeNamespace=True,
                codePrefixStrategy="object-kind-plus-global-id",
            )

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertNotIn("MANAGED_APPLICATION_TABLE_SEQUENCE_CARDINALITY_INVALID", codes)
            self.assertNotIn("MANAGED_APPLICATION_REBUILD_DATA_SQL_MISSING", codes)

    def test_aggregate_code_namespace_requires_readable_object_prefix_strategy(self) -> None:
        """聚合全局编号应用缺少对象类型前缀登记时必须被门禁阻断。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            self.register_managed_database_application(
                fixture,
                "example",
                databaseFile="db/example.mv.db",
                datasourcePrefix="example.datasource",
                primaryKeyStrategy="aggregate-global-code-sequence",
                aggregateSequenceCode="ExampleObjectId",
                globalCodeNamespace=True,
            )

            result = self.guard.audit_source_ownership(fixture)
            codes = {violation["code"] for violation in result["violations"]}

            self.assertIn("MANAGED_DATABASE_CODE_PREFIX_STRATEGY_INVALID", codes)

    def test_strict_database_application_rejects_seed_id_longer_than_six_digits(self) -> None:
        """初始化 SQL 不得重新写入 900000004003 一类超长固定业务主键。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            for role in ("controller", "service/impl", "dao"):
                (project / "backend/src/main/java/com/sp/selplat/example/examplecatalog" / role).mkdir(
                    parents=True,
                )
            sql_root = project / "db/sql"
            sql_root.mkdir(parents=True)
            (sql_root / "schema-ExampleCatalog.sql").write_text(
                "CREATE TABLE IF NOT EXISTS ExampleCatalog (id BIGINT PRIMARY KEY);\n",
                encoding="utf-8",
            )
            (sql_root / "data-ExampleCatalog.sql").write_text(
                "INSERT INTO ExampleCatalog (id) SELECT 900000004003 "
                "WHERE NOT EXISTS (SELECT 1 FROM ExampleCatalog WHERE id = 900000004003);\n",
                encoding="utf-8",
            )
            (sql_root / "schema-CommonSequenceSegment.sql").write_text(
                "CREATE TABLE IF NOT EXISTS CommonSequenceSegment "
                "(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, seqCode VARCHAR(100));\n",
                encoding="utf-8",
            )
            (sql_root / "data-CommonSequenceSegment.sql").write_text(
                "INSERT INTO CommonSequenceSegment (seqCode) SELECT 'ExampleCatalogId' "
                "WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment "
                "WHERE seqCode = 'ExampleCatalogId');\n",
                encoding="utf-8",
            )
            (project / "backend/build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_APPLICATION_SEED_ID_TOO_LONG",
                {violation["code"] for violation in result["violations"]},
            )

    def test_strict_database_application_rejects_contract_without_external_caller(self) -> None:
        """严格数据库应用不得为未来可能调用预留无外部生产调用方的 contract。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            (project / "contract/src/main/java/com/sp/selplat/example/contract/model").mkdir(parents=True)
            (project / "contract/src/main/java/com/sp/selplat/example/contract/model/ExampleView.java").write_text(
                "package com.sp.selplat.example.contract.model; public record ExampleView(String value) {}\n",
                encoding="utf-8",
            )
            (project / "backend/src/main/java/com/sp/selplat/example/common/config").mkdir(parents=True)
            (project / "backend/build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_APPLICATION_UNUSED_CONTRACT_MODULE",
                {violation["code"] for violation in result["violations"]},
            )

    def test_strict_database_application_rejects_manifest_without_real_reader(self) -> None:
        """严格数据库应用不得保留没有生产读取程序的 manifest 目录。"""
        with tempfile.TemporaryDirectory(prefix="source_guard_", dir=OPTION_TEMP_ROOT) as directory:
            fixture = self.create_fixture(Path(directory))
            project = fixture / "apps/example"
            manifest_root = project / "manifest"
            manifest_root.mkdir(parents=True)
            (manifest_root / "module.json").write_text('{"code":"example"}\n', encoding="utf-8")
            (project / "backend/src/main/java/com/sp/selplat/example/common/config").mkdir(parents=True)
            (project / "backend/build.gradle").write_text("plugins { id 'java' }\n", encoding="utf-8")
            self.register_managed_database_application(fixture, "example")

            result = self.guard.audit_source_ownership(fixture)

            self.assertIn(
                "MANAGED_APPLICATION_UNUSED_MANIFEST_DIRECTORY",
                {violation["code"] for violation in result["violations"]},
            )


if __name__ == "__main__":
    unittest.main()
