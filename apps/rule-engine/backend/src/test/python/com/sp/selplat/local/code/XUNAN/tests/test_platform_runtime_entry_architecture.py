"""SELPLAT 服务端唯一运行入口的静态架构回归。"""

from __future__ import annotations

from pathlib import Path
import re
import unittest


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
APPS_ROOT = PROJECT_ROOT / "apps"
HOST_BUILD = APPS_ROOT / "host/backend/build.gradle"
HOST_APPLICATION = (
    APPS_ROOT
    / "host/backend/src/main/java/com/sp/selplat/host/PlatformRuntimeApplication.java"
)


class PlatformRuntimeEntryArchitectureTests(unittest.TestCase):
    """阻止非桌面服务端模块恢复第二套进程生命周期。"""

    def test_only_host_declares_gradle_application_runtime(self) -> None:
        """所有服务端 Gradle 项目中只有 Host 可以声明 application 和 mainClass。"""

        application_builds: list[Path] = []
        main_class_builds: list[Path] = []
        for build_file in APPS_ROOT.rglob("build.gradle"):
            # Electron 桌面应用不属于服务端统一启动范围。
            if "ai-desktop" in build_file.parts:
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
        for source_file in APPS_ROOT.rglob("src/main/java/**/*.java"):
            content = source_file.read_text(encoding="utf-8")
            if "static void main(" in content or "SpringApplication.run(" in content:
                main_sources.append(source_file)

        self.assertEqual([HOST_APPLICATION], main_sources)

    def test_generator_and_ide_do_not_restore_module_runtime(self) -> None:
        """脚手架与 IDE 配置不得重新暴露业务模块运行入口。"""

        generator = (
            APPS_ROOT
            / "mda/backend/src/main/java/com/sp/selplat/mda/common/util/"
            / "projectgenerator/MdaProjectTemplateCatalog.java"
        ).read_text(encoding="utf-8")
        self.assertNotIn("BackendApplication", generator)
        self.assertNotIn("id 'application'", generator)
        self.assertNotIn("mainClass", generator)

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
