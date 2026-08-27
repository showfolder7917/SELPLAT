"""SELPLAT 服务端唯一运行入口的静态架构回归。"""

from __future__ import annotations

from pathlib import Path
import re
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
APPS_ROOT = PROJECT_ROOT / "apps"
HOST_BUILD = APPS_ROOT / "host/backend/build.gradle"
HOST_APPLICATION = (
    APPS_ROOT
    / "host/backend/src/main/java/com/sp/selplat/host/PlatformRuntimeApplication.java"
)
PROJECT_BUILD_RULE = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/rules/local"
    / ACTIVE_STABLE_USER_ID
    / "selplat/通用/rule/RUL_SELPLAT工程构建规则.md"
)
GRADLE_PROJECT_DIR_PATTERN = re.compile(
    r"project\(['\"][^'\"]+['\"]\)\.projectDir\s*=\s*file\(['\"]([^'\"]+)['\"]\)"
)


def registered_gradle_module_roots(
        project_root: Path, settings_text: str | None = None) -> list[Path]:
    """返回 settings.gradle 显式登记的模块根，不扫描未登记参考目录。"""

    source_text = settings_text
    if source_text is None:
        source_text = (project_root / "settings.gradle").read_text(encoding="utf-8")
    return sorted({
        project_root / relative_path
        for relative_path in GRADLE_PROJECT_DIR_PATTERN.findall(source_text)
    })


class PlatformRuntimeEntryArchitectureTests(unittest.TestCase):
    """阻止非桌面服务端模块恢复第二套进程生命周期。"""

    def test_only_host_declares_gradle_application_runtime(self) -> None:
        """所有服务端 Gradle 项目中只有 Host 可以声明 application 和 mainClass。"""

        application_builds: list[Path] = []
        main_class_builds: list[Path] = []
        for module_root in registered_gradle_module_roots(PROJECT_ROOT):
            build_file = module_root / "build.gradle"
            if not build_file.is_file() or not build_file.is_relative_to(APPS_ROOT):
                continue
            content = build_file.read_text(encoding="utf-8")
            if re.search(r"\bid\s+['\"]application['\"]", content):
                application_builds.append(build_file)
            if re.search(r"\bmainClass\s*=", content):
                main_class_builds.append(build_file)

        self.assertEqual([HOST_BUILD], application_builds)
        self.assertEqual([HOST_BUILD], main_class_builds)

    def test_only_host_production_source_declares_java_main(self) -> None:
        """生产 Java 源码中只有 PlatformRuntimeApplication 可以启动进程。"""

        main_sources: list[Path] = []
        for module_root in registered_gradle_module_roots(PROJECT_ROOT):
            if not module_root.is_relative_to(APPS_ROOT):
                continue
            java_root = module_root / "src/main/java"
            if not java_root.is_dir():
                continue
            for source_file in java_root.rglob("*.java"):
                content = source_file.read_text(encoding="utf-8")
                if "static void main(" in content or "SpringApplication.run(" in content:
                    main_sources.append(source_file)

        self.assertEqual([HOST_APPLICATION], main_sources)

    def test_unregistered_application_directory_is_not_a_runtime_module(self) -> None:
        """未在 settings.gradle 登记的应用目录只作参考，不进入运行时门禁。"""

        fixture_root = Path("workspace")
        settings_text = """
                include('apps:host:backend')
                project(':apps:host:backend').projectDir = file('apps/host/backend')
                """
        module_roots = registered_gradle_module_roots(fixture_root, settings_text)

        self.assertEqual([fixture_root / "apps/host/backend"], module_roots)
        self.assertNotIn(fixture_root / "apps/reference-only/backend", module_roots)

    def test_reference_only_application_boundary_is_registered_as_a_rule(self) -> None:
        """参考目录隔离必须进入当前用户规则，不能只停留在测试实现。"""

        rule_text = PROJECT_BUILD_RULE.read_text(encoding="utf-8")
        self.assertIn(
            "selplat_formal_server_module_authority = settings_gradle_explicit_project_dir",
            rule_text,
        )
        self.assertIn(
            "selplat_unregistered_application_directory_policy = human_reference_only",
            rule_text,
        )
        self.assertIn(
            "selplat_unregistered_application_cross_module_reference_policy = forbidden",
            rule_text,
        )
        self.assertIn(
            "selplat_runtime_gate_scope_resolution = "
            "registered_module_set_without_reference_name_exception",
            rule_text,
        )

    def test_generator_and_ide_do_not_restore_module_runtime(self) -> None:
        """脚手架与 IDE 配置不得重新暴露业务模块运行入口。"""

        generator = (
            APPS_ROOT
            / "mda/backend/src/main/java/com/sp/selplat/mda/common/util/"
            / "projectgenerator/MdaProjectTemplateCatalog.java"
        ).read_text(encoding="utf-8")
        self.assertNotRegex(
            generator,
            r"public\s+(?:final\s+)?class\s+[A-Za-z0-9_]*BackendApplication",
        )
        self.assertNotRegex(generator, r"(?m)^\s*id\s+['\"]application['\"]")
        self.assertNotRegex(generator, r"(?m)^\s*mainClass\s*=")

        for relative_path in (".vscode/tasks.json", ".vscode/launch.json"):
            ide_file = PROJECT_ROOT / relative_path
            if ide_file.is_file():
                content = ide_file.read_text(encoding="utf-8")
                self.assertNotRegex(
                    content,
                    r"(Uniauth|Japanese|Mda|AiFactory)BackendApplication|"
                    r":apps:(uniauth|japanese|mda|ai-factiory):(?:backend:)?run",
                )

    def test_root_launchers_keep_host_and_port_ownership(self) -> None:
        """根启动入口必须继续指向 Host，并在启动前接管 8080。"""

        powershell_launcher = (PROJECT_ROOT / "启动SELPLAT.ps1").read_text(
            encoding="utf-8"
        )
        batch_launcher = (PROJECT_ROOT / "启动SELPLAT.bat").read_text(
            encoding="utf-8"
        )
        self.assertIn(":apps:host:backend:run", powershell_launcher)
        self.assertIn("8080", powershell_launcher)
        self.assertIn("启动SELPLAT.ps1", batch_launcher)


if __name__ == "__main__":
    unittest.main()
