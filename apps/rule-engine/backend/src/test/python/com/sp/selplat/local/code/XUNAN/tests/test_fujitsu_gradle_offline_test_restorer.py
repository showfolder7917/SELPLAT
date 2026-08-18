"""当前用户 Fujitsu Gradle 离线依赖恢复能力测试。"""

from __future__ import annotations

import importlib.util
import io
import json
import os
from pathlib import Path
import re
# 从迁移后的测试包向上识别工程根，测试数据和输出必须继续归属当前工程。
PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
# 当前稳定用户只从 AGENTS.md 唯一声明解析，测试不得扫描目录猜测用户层。
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1 or not re.fullmatch(
    r"[A-Za-z][A-Za-z0-9_-]{0,63}", ACTIVE_USER_MATCHES[0].strip()
):
    raise RuntimeError("AGENTS.md 必须且只能声明一个安全的当前稳定用户 ID。")
# 测试路径由当前稳定用户变量代入，禁止固定具体用户名。
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
# 当前用户 Python 能力与测试 source set 分离，测试统一通过该路径加载真实能力。
MAIN_CODE_ROOT = (
    PROJECT_ROOT
    / "apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code"
    / ACTIVE_STABLE_USER_ID
)
from contextlib import redirect_stdout
import sys
import tempfile
import unittest


# 能力代码根从测试文件位置派生，避免机器绝对路径。
CODE_ROOT = MAIN_CODE_ROOT
# 测试生成数据必须归属本次调用工程；未显式传入时使用执行命令所在工程。
CURRENT_PROJECT_ROOT = Path(
    os.environ.get("CURRENT_PROJECT_ROOT") or Path.cwd()
).resolve()
# 测试临时目录统一进入当前工程 OPTION/temp，禁止写入能力代码所属工程。
TEST_TEMP_ROOT = (
    CURRENT_PROJECT_ROOT / "OPTION" / "temp" / "gradle-offline-restorer-tests"
)
# 真实用户能力文件用于验证迁移后的生产逻辑。
ABILITY_PATH = CODE_ROOT / "abilities" / "fujitsu_gradle_offline_test_restorer.py"


def load_ability():
    """从真实文件加载离线恢复能力。"""

    # 动态模块名与其他测试隔离。
    spec = importlib.util.spec_from_file_location(
        "fujitsu_gradle_offline_test_restorer_under_test",
        ABILITY_PATH,
    )
    # 能力路径缺失时立即失败。
    assert spec is not None
    assert spec.loader is not None
    # 创建并执行真实模块。
    module = importlib.util.module_from_spec(spec)
    # dataclass 在装饰阶段需要通过模块名读取真实命名空间，先登记动态模块。
    sys.modules[spec.name] = module
    # 执行登记后的生产模块，行为与统一 executor 加载契约一致。
    spec.loader.exec_module(module)
    # 返回生产能力供测试调用。
    return module


class GradleOfflineTestRestorerTests(unittest.TestCase):
    """验证本机构件发现、物化和无网络命令边界。"""

    @classmethod
    def setUpClass(cls) -> None:
        """创建统一测试临时根。"""

        # 所有 TemporaryDirectory 都显式使用工程 OPTION/temp。
        TEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # 能力模块只加载一次，减少重复解析。
        cls.ability = load_ability()

    def test_prepare_materializes_unique_dynamic_version(self) -> None:
        """唯一动态版本应物化到工程 cache 并生成 init script。"""

        # 每个 Case 使用独立工程目录，避免缓存相互污染。
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as temp_directory:
            # 测试根承载目标工程和本机构件来源。
            temp_root = Path(temp_directory)
            # 目标工程模拟 Fujitsu Groovy Gradle 声明。
            project_root = temp_root / "CPMATEST"
            # 创建工程根供能力校验。
            project_root.mkdir()
            # 动态版本用于验证明确版本恢复。
            (project_root / "build.gradle").write_text(
                "dependencies {\n"
                "  implementation 'jp.or.jasdec.sbf:APZZCommon:latest.integration'\n"
                "}\n",
                encoding="utf-8",
            )
            # 本地 Maven 来源保存唯一明确版本。
            source_version_root = (
                temp_root
                / "source-maven"
                / "jp"
                / "or"
                / "jasdec"
                / "sbf"
                / "APZZCommon"
                / "1.0.7"
            )
            # 创建 Maven 坐标目录。
            source_version_root.mkdir(parents=True)
            # 写入最小 JAR字节，能力只复制不解析归档。
            (source_version_root / "APZZCommon-1.0.7.jar").write_bytes(b"jar")
            # 写入真实来源 POM占位正文，验证 POM也被复制。
            (source_version_root / "APZZCommon-1.0.7.pom").write_text(
                "<project/>",
                encoding="utf-8",
            )
            # 使用规则资源真实模板生成恢复文件。
            result = self.ability.execute(
                {
                    "action": "prepare",
                    "project_root": str(project_root),
                    "source_roots": [str(temp_root / "source-maven")],
                },
                skills={},
                apps={},
            )
            # 唯一版本应成功完成准备。
            self.assertEqual(result["status"], "completed")
            # 构件必须进入当前工程 cache 而不是 OPTION/temp。
            target_jar = (
                project_root
                / "cache"
                / "gradle-offline"
                / "maven-repository"
                / "jp"
                / "or"
                / "jasdec"
                / "sbf"
                / "APZZCommon"
                / "1.0.7"
                / "APZZCommon-1.0.7.jar"
            )
            # 目标 JAR真实存在证明物化路径正确。
            self.assertTrue(target_jar.exists())
            # init script必须进入 OPTION/temp。
            init_script = Path(result["init_script"])
            # 生成脚本必须存在。
            self.assertTrue(init_script.exists())
            # 生成脚本包含明确版本且不包含远程 URL。
            init_text = init_script.read_text(encoding="utf-8")
            self.assertIn("'jp.or.jasdec.sbf:APZZCommon': '1.0.7'", init_text)
            self.assertNotIn("https://", init_text)
            # 恢复清单应明确声明未下载网络资源。
            manifest = json.loads(Path(result["manifest"]).read_text(encoding="utf-8"))
            self.assertFalse(manifest["network_download"])

    def test_prepare_blocks_ambiguous_dynamic_versions(self) -> None:
        """动态版本存在多个本机候选时必须要求显式 pin。"""

        # 独立临时工程验证多版本阻断。
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as temp_directory:
            # 测试根承载工程和两版本 Maven 来源。
            temp_root = Path(temp_directory)
            # 创建目标工程。
            project_root = temp_root / "CPMATEST"
            project_root.mkdir()
            # 声明动态版本。
            (project_root / "build.gradle").write_text(
                "dependencies {\n"
                "  implementation 'example:sample:latest.integration'\n"
                "}\n",
                encoding="utf-8",
            )
            # 两个版本都在本机时不能静默选择。
            for version in ("1.0.0", "2.0.0"):
                # 创建标准 Maven 版本目录。
                version_root = temp_root / "source-maven" / "example" / "sample" / version
                version_root.mkdir(parents=True)
                # 写入同坐标不同版本 JAR。
                (version_root / f"sample-{version}.jar").write_bytes(b"jar")
            # prepare 应返回未解析阻断。
            result = self.ability.execute(
                {
                    "action": "prepare",
                    "project_root": str(project_root),
                    "source_roots": [str(temp_root / "source-maven")],
                },
                skills={},
                apps={},
            )
            # 状态明确区分依赖歧义。
            self.assertEqual(result["status"], "blocked_unresolved_dependencies")
            # 返回两个候选版本供调用方提供兼容证据。
            self.assertEqual(
                result["unresolved"][0]["available_versions"],
                ["1.0.0", "2.0.0"],
            )

    def test_prepare_supports_pom_only_platform_and_group_pin(self) -> None:
        """BOM POM-only 构件和 group 通配 pin必须进入生成脚本。"""

        # 独立临时工程验证平台依赖。
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as temp_directory:
            # 测试根承载工程和 Maven 来源。
            temp_root = Path(temp_directory)
            # 创建目标工程。
            project_root = temp_root / "CPMATEST"
            project_root.mkdir()
            # BOM使用 platform包装且没有 JAR；Spring声明由 group pin改选本机版本。
            (project_root / "build.gradle").write_text(
                "dependencies {\n"
                "  testImplementation platform('org.junit:junit-bom:5.12.2')\n"
                "  implementation 'org.springframework.boot:spring-boot-starter:3.5.4'\n"
                "}\n",
                encoding="utf-8",
            )
            # 创建 POM-only Maven平台目录。
            bom_root = (
                temp_root
                / "source-maven"
                / "org"
                / "junit"
                / "junit-bom"
                / "5.12.2"
            )
            bom_root.mkdir(parents=True)
            # 平台依赖只有真实 POM。
            (bom_root / "junit-bom-5.12.2.pom").write_text(
                "<project/>",
                encoding="utf-8",
            )
            # 创建 Spring 本机兼容版本。
            spring_root = (
                temp_root
                / "source-maven"
                / "org"
                / "springframework"
                / "boot"
                / "spring-boot-starter"
                / "3.5.0"
            )
            spring_root.mkdir(parents=True)
            # 明确版本 JAR用于验证 group pin参与候选选择。
            (spring_root / "spring-boot-starter-3.5.0.jar").write_bytes(b"jar")
            # 生成恢复缓存并加入 Spring group通配 pin。
            result = self.ability.execute(
                {
                    "action": "prepare",
                    "project_root": str(project_root),
                    "source_roots": [str(temp_root / "source-maven")],
                    "version_pins": {"org.springframework.boot:*": "3.5.0"},
                    "materialize_all_candidates": True,
                },
                skills={},
                apps={},
            )
            # POM-only 平台应成功准备。
            self.assertEqual(result["status"], "completed")
            # 目标 Maven 仓库必须包含真实 BOM POM。
            target_pom = (
                project_root
                / "cache"
                / "gradle-offline"
                / "maven-repository"
                / "org"
                / "junit"
                / "junit-bom"
                / "5.12.2"
                / "junit-bom-5.12.2.pom"
            )
            self.assertTrue(target_pom.exists())
            # 生成脚本同时保存 group通配 pin和回退读取逻辑。
            init_text = Path(result["init_script"]).read_text(encoding="utf-8")
            self.assertIn("'org.springframework.boot:*': '3.5.0'", init_text)
            self.assertIn("details.requested.group + ':*'", init_text)

    def test_prepare_prefers_explicit_compatible_artifact_override(self) -> None:
        """非标准目录中的已确认兼容构件必须按显式坐标覆盖普通候选。"""

        # 独立临时工程模拟同版本普通缓存与兼容构件并存。
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as temp_directory:
            # 测试根承载工程、普通仓库和兼容产物。
            temp_root = Path(temp_directory)
            # 创建声明明确坐标的目标工程。
            project_root = temp_root / "CPMATEST"
            project_root.mkdir()
            # 业务工程声明需要明确版本的共享构件。
            (project_root / "build.gradle").write_text(
                "dependencies {\n"
                "  implementation 'example:business-common:1.0.1-SNAPSHOT'\n"
                "}\n",
                encoding="utf-8",
            )
            # 普通 Maven 缓存保存同坐标但契约不完整的旧构件内容。
            ordinary_root = (
                temp_root
                / "source-maven"
                / "example"
                / "business-common"
                / "1.0.1-SNAPSHOT"
            )
            ordinary_root.mkdir(parents=True)
            # 普通候选内容用于证明最终没有被错误选中。
            (ordinary_root / "business-common-1.0.1-SNAPSHOT.jar").write_bytes(
                b"ordinary"
            )
            # 已核对类契约的兼容构件位于非标准参考目录。
            compatible_jar = temp_root / "reference" / "business-common-compatible.jar"
            compatible_jar.parent.mkdir()
            # 兼容内容代表调用方已经完成类与方法证据核对。
            compatible_jar.write_bytes(b"compatible")
            # 显式坐标覆盖把兼容构件绑定到真实声明版本。
            result = self.ability.execute(
                {
                    "action": "prepare",
                    "project_root": str(project_root),
                    "source_roots": [str(temp_root / "source-maven")],
                    "artifact_overrides": {
                        "example:business-common:1.0.1-SNAPSHOT": str(
                            compatible_jar
                        )
                    },
                    "materialize_all_candidates": True,
                },
                skills={},
                apps={},
            )
            # 同版本显式兼容构件应成功覆盖普通来源。
            self.assertEqual(result["status"], "completed")
            # 物化目标仍保持标准 Maven 坐标结构。
            target_jar = (
                project_root
                / "cache"
                / "gradle-offline"
                / "maven-repository"
                / "example"
                / "business-common"
                / "1.0.1-SNAPSHOT"
                / "business-common-1.0.1-SNAPSHOT.jar"
            )
            # 目标字节必须来自兼容构件，证明覆盖优先级有效。
            self.assertEqual(target_jar.read_bytes(), b"compatible")

    def test_gradle_command_always_uses_offline_without_wrapper(self) -> None:
        """正常测试命令必须固定 offline 且不隐式调用 Wrapper。"""

        # 直接构建命令验证无须启动真实 Gradle。
        command = self.ability._build_gradle_command(
            "gradle",
            Path("offline-init.gradle"),
            ["test", "jacocoTestReport"],
            ["sample.Tester"],
            {"PersonalAccessToken": "offline-placeholder"},
        )
        # offline 与 no-daemon 是不可省略边界。
        self.assertIn("--offline", command)
        self.assertIn("--no-daemon", command)
        # 默认入口是本机 Gradle而非可能下载分发包的 gradlew。
        self.assertEqual(command[0], "gradle")
        # 测试过滤器仍通过标准 Gradle test参数进入正常任务。
        test_task_index = command.index("test")
        self.assertEqual(
            command[test_task_index : test_task_index + 3],
            ["test", "--tests", "sample.Tester"],
        )
        # JaCoCo任务位于 test过滤器之后，不会误解析 --tests。
        self.assertEqual(command[-1], "jacocoTestReport")
        # 日志命令隐藏占位属性值。
        redacted = self.ability._redact_command(command)
        self.assertIn("-PPersonalAccessToken=<redacted>", redacted)
        self.assertNotIn("-PPersonalAccessToken=offline-placeholder", redacted)

    def test_user_ability_runs_through_direct_entry(self) -> None:
        """当前用户单一能力必须通过文件直接入口执行，不依赖 core 注册表。"""

        # 独立临时工程验证直接入口的 plan 动作。
        with tempfile.TemporaryDirectory(dir=TEST_TEMP_ROOT) as temp_directory:
            # 计划动作只需要真实工程根和空 build.gradle。
            project_root = Path(temp_directory) / "CPMATEST"
            # 创建目标工程根。
            project_root.mkdir()
            # 空依赖构建文件使计划无需外部构件。
            (project_root / "build.gradle").write_text(
                "dependencies {\n}\n",
                encoding="utf-8",
            )
            # 直接入口只接收一个 JSON 对象参数。
            context_json = json.dumps(
                {
                    "action": "plan",
                    "project_root": str(project_root),
                    "source_roots": [str(project_root)],
                }
            )
            # 捕获结构化输出，避免测试日志混入业务 JSON。
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = self.ability.main([context_json])
            # 直接入口必须成功返回计划并声明迁移后的能力 ID。
            self.assertEqual(exit_code, 0)
            result = json.loads(output.getvalue())
            self.assertEqual(result["status"], "completed")
            self.assertEqual(result["ability"], "fujitsu_gradle_offline_test_restorer")


if __name__ == "__main__":
    # 保留文件独立执行入口，兼容现有无 package 的 unittest 结构。
    unittest.main()
