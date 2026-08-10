"""SELPLAT 全部程序的源码语言与归属门禁测试。"""

from __future__ import annotations

import importlib.util
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

    def create_fixture(self, temp_root: Path) -> Path:
        """创建最小 SELPLAT 工程事实，仅用于隔离扫描。"""
        (temp_root / "settings.gradle").write_text("rootProject.name = 'fixture'\n", encoding="utf-8")
        (temp_root / "AGENTS.md").write_text(
            f"- 当前稳定用户 ID：`{ACTIVE_STABLE_USER_ID}`\n",
            encoding="utf-8",
        )
        return temp_root

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


if __name__ == "__main__":
    unittest.main()
