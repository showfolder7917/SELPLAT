"""Fujitsu Gradle 离线依赖恢复与正常测试能力。

功能：
扫描调用方明确提供的本机构件目录，生成可审计的恢复计划，把选定构件物化到当前工程缓存，
生成只使用本地仓库的 Gradle init script，并按需执行工程原有的离线测试任务。

适用场景：
- 动态版本缺少离线元数据，但本机存在明确版本构件
- 私有 Maven 构件已存在于本机缓存或只读参考工程
- 构件缺少完整 POM，需要显式加入运行时 classpath
- 需要证明恢复后进入真实 Gradle test，而不是替代性静态验证
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from typing import Any


# 能力标识用于统一执行器注册和结果追踪。
ABILITY_ID = "gradle_offline_test_restorer"
# 能力名称向调用方说明这是 Gradle 正常测试恢复入口。
ABILITY_NAME = "Gradle 离线依赖恢复与正常测试能力"
# 能力说明限定只复用本机构件，不负责联网补包。
ABILITY_DESC = "用本机已有构件重建 Fujitsu Gradle 离线依赖闭包，并恢复正常 test 任务。"

# 当前能力只依赖 Python 标准库，避免恢复工具本身再次产生下载依赖。
REQUIRED_SKILLS: list[str] = []
# 当前能力不依赖外部 App，全部文件和进程都在目标工程范围内处理。
REQUIRED_APPS: list[str] = []

# 动态版本标识需要由本机候选和兼容证据解析为明确版本。
DYNAMIC_VERSION_MARKERS = {"latest.integration", "latest.release", "+", ""}
# 生产和测试常见 Gradle 配置用于识别 build.gradle 中的直接依赖。
DEPENDENCY_CONFIGURATIONS = (
    "api",
    "implementation",
    "compileOnly",
    "runtimeOnly",
    "annotationProcessor",
    "testImplementation",
    "testCompileOnly",
    "testRuntimeOnly",
)
# 只有验证类任务允许由该能力执行，防止离线恢复入口被扩展为任意 Gradle 变更入口。
ALLOWED_TASK_ROOTS = {
    "test",
    "jacocoTestReport",
    "check",
    "classes",
    "compileJava",
    "compileTestJava",
}
# 无 POM JAR只能加入明确 Gradle配置，防止一个目录同时污染生产和测试 classpath。
ALLOWED_RUNTIME_CONFIGURATIONS = set(DEPENDENCY_CONFIGURATIONS) | {"jacocoAnt"}
# sources 和 javadoc 不是运行构件，扫描时必须排除。
NON_RUNTIME_JAR_SUFFIXES = ("-sources.jar", "-javadoc.jar")
# Fujitsu 规则资源中的模板路径从能力包所在 SELPLAT 根稳定派生，不参与目标工程识别。
DEFAULT_TEMPLATE_PATH = (
    next(
        candidate
        for candidate in Path(__file__).resolve().parents
        if (candidate / "settings.gradle").is_file()
    )
    / "apps"
    / "rule-engine"
    / "backend"
    / "src"
    / "main"
    / "resources"
    / "local"
    / "common"
    / "fujitsu"
    / "通用"
    / "template"
    / "RUL_FujitsuGradle离线依赖闭包恢复规则"
    / "template"
    / "offline-test-init.gradle.template"
)


@dataclass(frozen=True)
class ArtifactCandidate:
    """记录一个从本机缓存识别出的 Maven 运行构件。"""

    # Maven group 决定目标仓库的上级目录结构。
    group: str
    # Maven artifact 决定目标仓库的模块目录。
    artifact: str
    # 明确版本用于替换动态版本并形成可复现结果。
    version: str
    # 真实 JAR 来源保留恢复证据；平台 BOM可以为空。
    jar_path: str
    # POM 可能不存在，空值表示需要作为显式运行时 JAR处理。
    pom_path: str = ""
    # 来源类型用于区分 Maven 布局与 Gradle files-2.1 缓存。
    source_kind: str = "maven"

    @property
    def coordinate(self) -> str:
        """返回不含版本的稳定 Maven 坐标。"""

        # group 与 artifact 组合后可直接匹配 Gradle 声明。
        return f"{self.group}:{self.artifact}"


def _normalize_directory(raw_path: Any, *, field_name: str) -> Path:
    """把调用方目录解析为存在的绝对路径。"""

    # 显式展开并解析路径，避免相对路径随执行器工作目录漂移。
    resolved_path = Path(str(raw_path or "")).expanduser().resolve()
    # 恢复只能读取真实目录，不存在的输入不能被静默忽略。
    if not resolved_path.exists() or not resolved_path.is_dir():
        raise ValueError(f"{field_name} 必须是已存在目录：{resolved_path}")
    # 返回已验证目录供后续扫描或工程归属使用。
    return resolved_path


def _resolve_project_root(context: dict[str, Any]) -> Path:
    """取得调用方明确指定的当前工程根。"""

    # 离线缓存和 OPTION 都会产生写入，因此禁止从 MEMORY_ROOT 猜测目标工程。
    raw_project_root = context.get("project_root") or context.get("current_project_root")
    # 缺少显式工程根时直接阻断，避免把恢复数据写入能力系统工程。
    if not str(raw_project_root or "").strip():
        raise ValueError("缺少 project_root，离线恢复不得从能力目录反推目标工程。")
    # 工程根经过统一目录校验后才能派生 cache、OPTION 和 build。
    return _normalize_directory(raw_project_root, field_name="project_root")


def _runtime_paths(project_root: Path) -> dict[str, Path]:
    """派生当前工程独占的缓存、临时输出和报告路径。"""

    # 可复用依赖统一进入工程 cache。
    cache_root = project_root / "cache" / "gradle-offline"
    # Maven 布局构件进入缓存下的本地仓库。
    maven_root = cache_root / "maven-repository"
    # 无完整 POM 的显式运行时 JAR进入独立目录。
    runtime_jar_root = cache_root / "runtime-jars"
    # Gradle 用户目录进入当前工程 cache，避免写系统级缓存。
    gradle_user_home = project_root / "cache" / "gradle-user-home"
    # 恢复清单、init script 和日志属于本次工具运行数据。
    temp_root = project_root / "OPTION" / "temp" / "gradle-offline"
    # 正式构建产物继续使用工程 build，不由恢复能力改写。
    build_root = project_root / "build"
    # 统一返回全部路径，后续动作不再自行拼接其他目录。
    return {
        "cache_root": cache_root,
        "maven_root": maven_root,
        "runtime_jar_root": runtime_jar_root,
        "gradle_user_home": gradle_user_home,
        "temp_root": temp_root,
        "build_root": build_root,
        "init_script": temp_root / "offline-test-init.gradle",
        "manifest": temp_root / "recovery-manifest.json",
        "stdout_log": temp_root / "gradle-test.stdout.log",
        "stderr_log": temp_root / "gradle-test.stderr.log",
    }


def _declared_dependencies(project_root: Path) -> list[dict[str, str]]:
    """从根 build.gradle 读取常见字符串形式的直接依赖。"""

    # 当前恢复器先处理 Fujitsu 工程普遍使用的 Groovy build.gradle。
    build_file = project_root / "build.gradle"
    # 没有根构建文件时返回空清单，由调用方在计划结果中报告。
    if not build_file.exists():
        return []
    # UTF-8 完整读取避免日文注释或依赖行被系统编码破坏。
    source = build_file.read_text(encoding="utf-8")
    # 配置名集合拼为正则，只提取 group:artifact:version 三段式声明。
    configuration_pattern = "|".join(re.escape(item) for item in DEPENDENCY_CONFIGURATIONS)
    # platform 包装与普通字符串声明统一识别，但不执行 Gradle 代码。
    dependency_pattern = re.compile(
        rf"(?m)^\s*(?P<configuration>{configuration_pattern})\s+"
        rf"(?P<platform>platform\s*\(\s*)?['\"]"
        rf"(?P<group>[^:'\"]+):(?P<artifact>[^:'\"]+):(?P<version>[^'\"]+)"
    )
    # 每个声明保存配置和坐标，供候选匹配与清单输出使用。
    dependencies: list[dict[str, str]] = []
    # 遍历所有直接依赖，保持构建文件顺序便于人工核对。
    for match in dependency_pattern.finditer(source):
        # 将正则命名组直接转换为稳定字典结构。
        dependencies.append(match.groupdict())
    # 返回只读分析结果，不修改正式构建文件。
    return dependencies


def _find_gradle_cache_coordinate(jar_path: Path) -> ArtifactCandidate | None:
    """从 Gradle files-2.1 缓存路径恢复 Maven 坐标。"""

    # 路径分段后定位 Gradle 模块缓存标记。
    path_parts = jar_path.parts
    # 非 Gradle 模块缓存路径由 Maven 布局识别器继续处理。
    if "files-2.1" not in path_parts:
        return None
    # 标记后的三段固定为 group、artifact 和 version。
    marker_index = path_parts.index("files-2.1")
    # 路径过短说明不是完整模块缓存，不能猜测坐标。
    if len(path_parts) <= marker_index + 4:
        return None
    # 读取 Gradle 缓存中明确保存的坐标三元组。
    group, artifact, version = path_parts[marker_index + 1 : marker_index + 4]
    # 同一版本目录下搜索 POM，保留真实传递元数据。
    version_root = Path(*path_parts[: marker_index + 4])
    # 优先选择与模块名版本一致的 POM。
    pom_candidates = sorted(version_root.rglob(f"{artifact}-{version}.pom"))
    # 没有 POM 时保留空值，后续不会伪造元数据。
    pom_path = str(pom_candidates[0]) if pom_candidates else ""
    # 返回 Gradle 来源候选供计划选择。
    return ArtifactCandidate(group, artifact, version, str(jar_path), pom_path, "gradle-cache")


def _find_maven_coordinate(jar_path: Path, source_root: Path) -> ArtifactCandidate | None:
    """从标准 Maven 仓库布局恢复构件坐标。"""

    # Maven 路径至少需要 group/artifact/version/file 四层。
    try:
        relative_parts = jar_path.relative_to(source_root).parts
    except ValueError:
        return None
    # 层级不足时不能形成合法 Maven 坐标。
    if len(relative_parts) < 4:
        return None
    # 文件的父两级分别是 version 和 artifact。
    version = relative_parts[-2]
    artifact = relative_parts[-3]
    # 更上层目录共同组成点分 group。
    group_parts = relative_parts[:-3]
    # 缺少 group 或文件名不符合 artifact-version 时拒绝误识别普通目录。
    if not group_parts or not jar_path.name.startswith(f"{artifact}-{version}"):
        return None
    # Maven group 使用点分形式与 Gradle 声明匹配。
    group = ".".join(group_parts)
    # 同目录标准 POM是最可靠的传递依赖元数据。
    pom_candidate = jar_path.with_name(f"{artifact}-{version}.pom")
    # 仅记录真实存在的 POM。
    pom_path = str(pom_candidate) if pom_candidate.exists() else ""
    # 返回 Maven 布局候选。
    return ArtifactCandidate(group, artifact, version, str(jar_path), pom_path, "maven")


def _find_maven_pom_coordinate(pom_path: Path, source_root: Path) -> ArtifactCandidate | None:
    """从标准 Maven 仓库布局恢复 POM-only 平台构件坐标。"""

    # POM 与 JAR使用相同 group/artifact/version 目录约定。
    try:
        relative_parts = pom_path.relative_to(source_root).parts
    except ValueError:
        return None
    # Maven 路径至少需要 group/artifact/version/file 四层。
    if len(relative_parts) < 4:
        return None
    # 父两级仍是明确版本与 artifact。
    version = relative_parts[-2]
    artifact = relative_parts[-3]
    # 更上层共同组成 Maven group。
    group_parts = relative_parts[:-3]
    # 非标准文件名可能是普通 XML，不作为候选。
    if not group_parts or pom_path.name != f"{artifact}-{version}.pom":
        return None
    # group 路径转换为 Gradle 使用的点分坐标。
    group = ".".join(group_parts)
    # POM-only 候选没有运行 JAR，主要服务 platform/BOM依赖。
    return ArtifactCandidate(group, artifact, version, "", str(pom_path), "maven-pom")


def _scan_candidates(source_roots: list[Path]) -> list[ArtifactCandidate]:
    """扫描明确来源目录中的运行构件候选。"""

    # 以完整五元组去重，避免同一文件被两个识别入口重复记录。
    candidates: dict[tuple[str, str, str, str, str], ArtifactCandidate] = {}
    # 每个来源都由调用方显式提供，能力不扫描无关磁盘。
    for source_root in source_roots:
        # 递归查找 JAR，兼容 Maven 仓库和 Gradle files-2.1。
        for jar_path in source_root.rglob("*.jar"):
            # sources 与 javadoc 不能加入生产或测试运行 classpath。
            if jar_path.name.endswith(NON_RUNTIME_JAR_SUFFIXES):
                continue
            # Gradle 缓存路径优先恢复坐标。
            candidate = _find_gradle_cache_coordinate(jar_path)
            # 非 Gradle 缓存再按调用根的 Maven 布局识别。
            if candidate is None:
                candidate = _find_maven_coordinate(jar_path, source_root)
            # 普通平铺 JAR没有可靠坐标，不混入 Maven 候选。
            if candidate is None:
                continue
            # 候选键包含来源路径，保留同版本不同来源供人工选择。
            candidate_key = (
                candidate.group,
                candidate.artifact,
                candidate.version,
                candidate.jar_path,
                candidate.pom_path,
            )
            # 保存真实候选供依赖选择。
            candidates[candidate_key] = candidate
        # BOM和父平台可能只有 POM，单独扫描以恢复 Gradle platform依赖。
        for pom_path in source_root.rglob("*.pom"):
            # 当前入口只识别标准 Maven 布局 POM。
            candidate = _find_maven_pom_coordinate(pom_path, source_root)
            # 非标准 POM不进入候选。
            if candidate is None:
                continue
            # 已有同坐标同版本 JAR候选时，真实 POM已随 JAR记录，无需重复。
            if any(
                item.group == candidate.group
                and item.artifact == candidate.artifact
                and item.version == candidate.version
                for item in candidates.values()
            ):
                continue
            # POM-only 候选按真实来源保留。
            candidate_key = (
                candidate.group,
                candidate.artifact,
                candidate.version,
                candidate.jar_path,
                candidate.pom_path,
            )
            # 保存平台候选供 platform声明选择。
            candidates[candidate_key] = candidate
    # 稳定排序使清单在相同机器上可重复比较。
    return sorted(
        candidates.values(),
        key=lambda item: (item.coordinate, item.version, item.jar_path),
    )


def _group_candidates(candidates: list[ArtifactCandidate]) -> dict[str, list[ArtifactCandidate]]:
    """按 group:artifact 聚合候选版本。"""

    # 每个直接依赖坐标对应一组本机候选。
    grouped: dict[str, list[ArtifactCandidate]] = {}
    # 遍历候选并追加到坐标桶。
    for candidate in candidates:
        # setdefault 保持首次发现顺序并避免预建空桶。
        grouped.setdefault(candidate.coordinate, []).append(candidate)
    # 返回聚合结构供明确版本选择。
    return grouped


def _explicit_override_candidates(
    raw_overrides: dict[str, Any],
) -> list[ArtifactCandidate]:
    """把调用方确认的特殊构件恢复为带坐标候选。"""

    # 显式覆盖只用于本机存在但不在标准 Maven布局中的兼容构件。
    override_candidates: list[ArtifactCandidate] = []
    # 每个键必须是 group:artifact:version，避免版本证据被拆散。
    for raw_coordinate, raw_paths in raw_overrides.items():
        # 三段坐标严格拆分。
        coordinate_parts = str(raw_coordinate).split(":")
        # 坐标不完整时阻断，不猜测 group 或版本。
        if len(coordinate_parts) != 3 or not all(coordinate_parts):
            raise ValueError(
                f"artifact_overrides 键必须是 group:artifact:version：{raw_coordinate}"
            )
        # 覆盖值允许直接给 JAR路径，也允许给 jar/pom对象。
        if isinstance(raw_paths, dict):
            # 对象形式读取真实 JAR和可选 POM。
            raw_jar_path = raw_paths.get("jar")
            raw_pom_path = raw_paths.get("pom")
        else:
            # 字符串形式只声明 JAR。
            raw_jar_path = raw_paths
            raw_pom_path = ""
        # JAR必须真实存在且是运行构件。
        jar_path = Path(str(raw_jar_path or "")).expanduser().resolve()
        if (
            not jar_path.exists()
            or not jar_path.is_file()
            or jar_path.suffix.lower() != ".jar"
            or jar_path.name.endswith(NON_RUNTIME_JAR_SUFFIXES)
        ):
            raise ValueError(f"artifact_overrides JAR无效：{jar_path}")
        # POM可省略；提供时必须真实存在。
        pom_path = ""
        if str(raw_pom_path or "").strip():
            # 解析显式 POM来源。
            resolved_pom_path = Path(str(raw_pom_path)).expanduser().resolve()
            # 不存在的 POM不能进入恢复清单。
            if (
                not resolved_pom_path.exists()
                or not resolved_pom_path.is_file()
                or resolved_pom_path.suffix.lower() != ".pom"
            ):
                raise ValueError(f"artifact_overrides POM无效：{resolved_pom_path}")
            # 保存真实 POM路径。
            pom_path = str(resolved_pom_path)
        # 构造显式覆盖候选，选择阶段优先于普通缓存。
        override_candidates.append(
            ArtifactCandidate(
                coordinate_parts[0],
                coordinate_parts[1],
                coordinate_parts[2],
                str(jar_path),
                pom_path,
                "explicit-override",
            )
        )
    # 返回所有带兼容证据的显式候选。
    return override_candidates


def _select_candidates(
    dependencies: list[dict[str, str]],
    candidates: list[ArtifactCandidate],
    version_pins: dict[str, str],
) -> tuple[list[ArtifactCandidate], list[dict[str, Any]]]:
    """按声明版本和显式 pin 选择本机候选。"""

    # 候选先按坐标聚合，减少逐依赖重复扫描。
    grouped = _group_candidates(candidates)
    # 选中构件用于物化缓存。
    selected: list[ArtifactCandidate] = []
    # 未解析项保留原因，禁止静默跳过缺口。
    unresolved: list[dict[str, Any]] = []
    # 每个直接依赖独立选择，便于指出具体缺失坐标。
    for dependency in dependencies:
        # Gradle 三段坐标转换为稳定匹配键。
        coordinate = f"{dependency['group']}:{dependency['artifact']}"
        # 坐标 pin优先，其次使用 group通配 pin，最后使用构建文件声明版本。
        requested_version = str(
            version_pins.get(coordinate)
            or version_pins.get(f"{dependency['group']}:*")
            or dependency["version"]
        ).strip()
        # 取得本机同坐标候选。
        coordinate_candidates = grouped.get(coordinate, [])
        # 动态版本没有 pin 时只允许唯一候选，避免多版本静默选择。
        if requested_version in DYNAMIC_VERSION_MARKERS:
            # 统计唯一版本而不是文件数，同版本多来源不构成版本歧义。
            available_versions = sorted({item.version for item in coordinate_candidates})
            # 唯一版本可以作为有明确本机事实的恢复选择。
            if len(available_versions) == 1:
                requested_version = available_versions[0]
            else:
                # 零个或多个版本都需要调用方提供兼容证据。
                unresolved.append(
                    {
                        "coordinate": coordinate,
                        "requested": dependency["version"],
                        "available_versions": available_versions,
                        "reason": "动态版本需要唯一候选或显式 version_pins",
                    }
                )
                continue
        # 过滤出选定明确版本的真实构件。
        matching_candidates = [
            item
            for item in coordinate_candidates
            if item.version == requested_version
            and (bool(item.jar_path) or bool(dependency.get("platform")))
        ]
        # 没有匹配构件时记录硬缺口。
        if not matching_candidates:
            unresolved.append(
                {
                    "coordinate": coordinate,
                    "requested": requested_version,
                    "available_versions": sorted(
                        {item.version for item in coordinate_candidates}
                    ),
                    "reason": "本机来源中没有请求的明确版本",
                }
            )
            continue
        # 同版本优先使用调用方确认的兼容覆盖，其次选择带真实 POM 的普通候选。
        matching_candidates.sort(
            key=lambda item: (
                item.source_kind != "explicit-override",
                not bool(item.pom_path),
                item.jar_path,
            )
        )
        # 保存最优真实候选，不修改其他来源文件。
        selected.append(matching_candidates[0])
    # 返回已选择和未解析两部分，prepare 可据此决定是否阻断。
    return selected, unresolved


def _materialize_candidate(candidate: ArtifactCandidate, maven_root: Path) -> dict[str, str]:
    """把单个 Maven 构件复制到当前工程离线仓库。"""

    # group 点分路径转换为 Maven 目录结构。
    coordinate_dir = (
        maven_root
        / Path(*candidate.group.split("."))
        / candidate.artifact
        / candidate.version
    )
    # 目标版本目录只位于当前工程 cache。
    coordinate_dir.mkdir(parents=True, exist_ok=True)
    # 平台 BOM可能没有 JAR，目标路径按实际构件决定。
    target_jar = ""
    if candidate.jar_path:
        # JAR使用标准 Maven 文件名，Gradle 可直接按坐标解析。
        target_jar_path = coordinate_dir / f"{candidate.artifact}-{candidate.version}.jar"
        # 复制真实构件并保留时间元数据，不改写来源缓存。
        shutil.copy2(candidate.jar_path, target_jar_path)
        # 清单保存真实物化 JAR路径。
        target_jar = str(target_jar_path)
    # POM仅在真实存在时复制，禁止生成未知传递依赖。
    target_pom = ""
    if candidate.pom_path:
        # POM使用标准 Maven 文件名。
        target_pom_path = coordinate_dir / f"{candidate.artifact}-{candidate.version}.pom"
        # 复制真实 POM供 Gradle解析。
        shutil.copy2(candidate.pom_path, target_pom_path)
        # 清单保存物化后的 POM路径。
        target_pom = str(target_pom_path)
    # 返回构件来源和目标证据。
    return {
        "coordinate": candidate.coordinate,
        "version": candidate.version,
        "source_jar": candidate.jar_path,
        "target_jar": target_jar,
        "target_pom": target_pom,
    }


def _copy_runtime_jars(
    raw_runtime_jars_by_configuration: dict[str, list[Any]],
    runtime_jar_root: Path,
) -> list[dict[str, str]]:
    """按 Gradle 配置复制调用方明确确认的无 POM 运行时 JAR。"""

    # 运行时目录只在确有输入时创建。
    copied_runtime_jars: list[dict[str, str]] = []
    # 每个配置独立目录，生成脚本不会把测试工具误加到生产实现。
    for configuration, raw_runtime_jars in raw_runtime_jars_by_configuration.items():
        # 未知配置可能触发发布或自定义外部动作，因此直接阻断。
        if configuration not in ALLOWED_RUNTIME_CONFIGURATIONS:
            raise ValueError(f"不允许的运行时 Gradle 配置：{configuration}")
        # 每个 JAR必须由调用方显式指定，能力不把所有平铺文件盲目加入 classpath。
        for index, raw_jar in enumerate(raw_runtime_jars):
            # 解析真实文件路径。
            source_jar = Path(str(raw_jar)).expanduser().resolve()
            # 不存在或非 JAR 时立即阻断，避免清单与实际 classpath 不一致。
            if (
                not source_jar.exists()
                or not source_jar.is_file()
                or source_jar.suffix.lower() != ".jar"
            ):
                raise ValueError(
                    f"runtime_jars_by_configuration[{configuration}][{index}] "
                    f"必须是已存在 JAR：{source_jar}"
                )
            # sources 与 javadoc 不允许作为显式运行时依赖。
            if source_jar.name.endswith(NON_RUNTIME_JAR_SUFFIXES):
                raise ValueError(
                    f"runtime_jars_by_configuration[{configuration}][{index}] "
                    f"不是运行构件：{source_jar}"
                )
            # 每个 Gradle配置使用独立缓存目录。
            configuration_root = runtime_jar_root / configuration
            # 创建当前工程缓存目录。
            configuration_root.mkdir(parents=True, exist_ok=True)
            # 平铺目标保留原文件名，方便日志核对。
            target_jar = configuration_root / source_jar.name
            # 复制现有 JAR，不修改来源。
            shutil.copy2(source_jar, target_jar)
            # 清单记录配置、来源和目标。
            copied_runtime_jars.append(
                {
                    "configuration": configuration,
                    "source_jar": str(source_jar),
                    "target_jar": str(target_jar),
                }
            )
    # 返回全部显式运行时构件证据。
    return copied_runtime_jars


def _groovy_quote(value: str) -> str:
    """把路径或版本安全转换为 Groovy 单引号字符串正文。"""

    # 反斜杠先转为正斜杠，避免 Windows 路径形成 Groovy 转义。
    normalized_value = value.replace("\\", "/")
    # 单引号使用 Groovy 反斜杠转义，保持模板结构完整。
    return normalized_value.replace("'", "\\'")


def _render_init_script(
    template_path: Path,
    init_script_path: Path,
    maven_roots: list[Path],
    runtime_configurations: list[str],
    runtime_jar_root: Path,
    version_pins: dict[str, str],
) -> None:
    """根据资源模板生成本次离线 Gradle init script。"""

    # 模板必须真实存在，避免生成不完整脚本后继续测试。
    if not template_path.exists() or not template_path.is_file():
        raise ValueError(f"Gradle init 模板不存在：{template_path}")
    # UTF-8 完整读取规则资源模板。
    template_text = template_path.read_text(encoding="utf-8")
    # settings 插件仓库和项目依赖仓库使用相同本地 Maven 根。
    plugin_repository_lines = "\n".join(
        "    settings.pluginManagement.repositories.maven { "
        f"url = new File('{_groovy_quote(str(root))}').toURI() }}"
        for root in maven_roots
    )
    # 项目仓库在 projectsEvaluated 阶段只保留本地路径。
    project_repository_lines = "\n".join(
        "    rootProject.repositories.maven { "
        f"url = rootProject.uri('{_groovy_quote(str(root))}'); "
        "metadataSources { mavenPom(); artifact() } }"
        for root in maven_roots
    )
    # 明确版本映射按坐标排序，保证脚本稳定可比较。
    version_pin_lines = "\n".join(
        f"                '{_groovy_quote(coordinate)}': "
        f"'{_groovy_quote(version)}',"
        for coordinate, version in sorted(version_pins.items())
    )
    # 每个显式运行时配置只挂载自己的缓存子目录。
    runtime_dependency_lines = "\n".join(
        "    rootProject.dependencies.add("
        f"'{_groovy_quote(configuration)}', "
        "rootProject.fileTree("
        f"dir: rootProject.file('{_groovy_quote(str(runtime_jar_root / configuration))}'), "
        "include: ['*.jar']))"
        for configuration in sorted(runtime_configurations)
    )
    # 替换仓库、版本和运行时配置占位符。
    rendered_text = template_text.replace(
        "@@PLUGIN_REPOSITORIES@@", plugin_repository_lines
    )
    rendered_text = rendered_text.replace(
        "@@PROJECT_REPOSITORIES@@", project_repository_lines
    )
    rendered_text = rendered_text.replace("@@VERSION_PINS@@", version_pin_lines)
    rendered_text = rendered_text.replace(
        "@@RUNTIME_DEPENDENCIES@@", runtime_dependency_lines
    )
    # 一次性脚本目录固定属于当前工程 OPTION/temp。
    init_script_path.parent.mkdir(parents=True, exist_ok=True)
    # UTF-8 写入生成脚本，禁止系统默认编码破坏路径。
    init_script_path.write_text(rendered_text, encoding="utf-8")


def _write_manifest(manifest_path: Path, payload: dict[str, Any]) -> None:
    """写入本次离线恢复证据清单。"""

    # 恢复清单目录固定属于当前工程 OPTION/temp。
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    # JSON使用 UTF-8 和可读缩进，供其他 AI 与人工复核。
    manifest_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _plan(context: dict[str, Any], project_root: Path) -> dict[str, Any]:
    """生成声明依赖、本机候选和版本选择计划。"""

    # 来源目录只能来自调用方显式清单或当前工程 cache。
    raw_source_roots = context.get("source_roots")
    # 未提供来源时只扫描当前工程 cache，禁止扩大到整块磁盘。
    if raw_source_roots is None:
        raw_source_roots = [project_root / "cache"]
    # 每个来源经过存在性校验。
    source_roots = [
        _normalize_directory(item, field_name=f"source_roots[{index}]")
        for index, item in enumerate(raw_source_roots)
    ]
    # 构建文件声明决定需要恢复的根依赖。
    dependencies = _declared_dependencies(project_root)
    # 扫描明确来源中的 Maven/Gradle 缓存候选。
    candidates = _scan_candidates(source_roots)
    # 显式坐标覆盖补充不在标准布局中的兼容构件。
    candidates.extend(
        _explicit_override_candidates(
            dict(context.get("artifact_overrides") or {})
        )
    )
    # 显式版本 pin 转换为纯字符串字典，防止标量类型进入 Gradle脚本。
    version_pins = {
        str(coordinate): str(version)
        for coordinate, version in dict(context.get("version_pins") or {}).items()
    }
    # 按明确版本选择构件，动态多版本保持阻断。
    selected, unresolved = _select_candidates(dependencies, candidates, version_pins)
    # 返回计划供 prepare 和调用方共同使用。
    return {
        "source_roots": [str(item) for item in source_roots],
        "dependencies": dependencies,
        "candidate_count": len(candidates),
        "candidates": [asdict(item) for item in candidates],
        "selected": [asdict(item) for item in selected],
        "unresolved": unresolved,
        "version_pins": version_pins,
    }


def _prepare(context: dict[str, Any], project_root: Path) -> dict[str, Any]:
    """物化选定依赖并生成离线 init script。"""

    # 先生成完整计划，确保物化动作有可审计依据。
    plan = _plan(context, project_root)
    # 默认要求全部直接依赖解析；调用方可显式允许只准备部分闭包用于迭代诊断。
    allow_partial = bool(context.get("allow_partial"))
    # 未解析依赖存在且未允许部分准备时停止写入构件。
    if plan["unresolved"] and not allow_partial:
        return {
            "status": "blocked_unresolved_dependencies",
            "ability": ABILITY_ID,
            "action": "prepare",
            "project_root": str(project_root),
            "unresolved": plan["unresolved"],
            "message": "存在未解析直接依赖；请提供兼容 version_pins 或真实本机构件。",
        }
    # 当前工程路径策略统一由辅助函数派生。
    paths = _runtime_paths(project_root)
    # 目标 Maven 仓库只在开始物化时创建。
    paths["maven_root"].mkdir(parents=True, exist_ok=True)
    # 调用方可要求把扫描到的完整 Maven闭包物化到项目 cache。
    materialize_all_candidates = bool(context.get("materialize_all_candidates"))
    # 完整闭包模式先按坐标版本去重，默认只复制已选择根依赖。
    if materialize_all_candidates:
        # 普通候选构成完整传递闭包基线。
        unique_candidate_payloads = {
            f"{item['group']}:{item['artifact']}:{item['version']}": item
            for item in plan["candidates"]
        }
        # 根依赖选择覆盖同坐标版本，保证显式兼容构件最终物化。
        for item in plan["selected"]:
            # 同一坐标版本只保留已选择来源。
            unique_candidate_payloads[
                f"{item['group']}:{item['artifact']}:{item['version']}"
            ] = item
        # 稳定坐标顺序用于可重复物化和清单。
        candidate_payloads = [
            unique_candidate_payloads[key]
            for key in sorted(unique_candidate_payloads)
        ]
    else:
        # 最小模式只复制已选择根依赖。
        candidate_payloads = plan["selected"]
    # 把计划中的稳定字典恢复为候选对象。
    selected_candidates = [ArtifactCandidate(**item) for item in candidate_payloads]
    # 逐构件复制并保留来源证据。
    materialized = [
        _materialize_candidate(candidate, paths["maven_root"])
        for candidate in selected_candidates
    ]
    # 新契约按 Gradle配置接收运行时 JAR；旧 runtime_jars兼容映射到 testRuntimeOnly。
    runtime_jars_by_configuration = {
        str(configuration): list(raw_jars)
        for configuration, raw_jars in dict(
            context.get("runtime_jars_by_configuration") or {}
        ).items()
    }
    # 旧调用清单仍可作为测试运行时补充，但不会进入生产 implementation。
    legacy_runtime_jars = list(context.get("runtime_jars") or [])
    if legacy_runtime_jars:
        # 追加旧清单，保留调用方明确顺序。
        runtime_jars_by_configuration.setdefault("testRuntimeOnly", []).extend(
            legacy_runtime_jars
        )
    # 显式运行时 JAR独立复制，不伪装成 Maven 构件。
    runtime_jars = _copy_runtime_jars(
        runtime_jars_by_configuration,
        paths["runtime_jar_root"],
    )
    # 已选择的动态或明确版本共同形成 init script pin。
    effective_pins = dict(plan["version_pins"])
    # 根依赖选择用于生成 pin，完整闭包中的传递候选不得覆盖版本决策。
    root_selected_candidates = [
        ArtifactCandidate(**item) for item in plan["selected"]
    ]
    # 每个选中根构件都以真实版本覆盖动态声明。
    for candidate in root_selected_candidates:
        # 同坐标只保存本次实际物化版本。
        effective_pins[candidate.coordinate] = candidate.version
    # 模板允许调用方显式覆盖，默认使用规则资源模板。
    template_path = Path(
        str(context.get("template_path") or DEFAULT_TEMPLATE_PATH)
    ).expanduser().resolve()
    # 本次 init script只挂载当前工程物化仓库。
    _render_init_script(
        template_path,
        paths["init_script"],
        [paths["maven_root"]],
        sorted(runtime_jars_by_configuration),
        paths["runtime_jar_root"],
        effective_pins,
    )
    # 清单汇总计划、物化结果和固定目录。
    manifest_payload = {
        "ability": ABILITY_ID,
        "project_root": str(project_root),
        "network_download": False,
        "plan": plan,
        "materialized": materialized,
        "runtime_jars": runtime_jars,
        "materialize_all_candidates": materialize_all_candidates,
        "effective_version_pins": effective_pins,
        "paths": {key: str(value) for key, value in paths.items()},
    }
    # 写入可回放恢复证据。
    _write_manifest(paths["manifest"], manifest_payload)
    # 返回准备完成位置，供 run 动作使用。
    return {
        "status": "completed",
        "ability": ABILITY_ID,
        "action": "prepare",
        "project_root": str(project_root),
        "materialized_count": len(materialized),
        "runtime_jar_count": len(runtime_jars),
        "unresolved": plan["unresolved"],
        "init_script": str(paths["init_script"]),
        "manifest": str(paths["manifest"]),
        "cache_root": str(paths["cache_root"]),
    }


def _validate_tasks(raw_tasks: list[Any]) -> list[str]:
    """限制能力只能执行构建和测试验证任务。"""

    # 空任务默认执行 test，保持正常测试目标明确。
    tasks = [str(item).strip() for item in raw_tasks if str(item).strip()] or ["test"]
    # 每个任务可能包含项目路径，最后一段才是任务根名。
    for task in tasks:
        # 命令选项不得伪装成任务进入 Gradle 参数。
        if task.startswith("-"):
            raise ValueError(f"tasks 中禁止命令选项：{task}")
        # 多项目任务取最后一个冒号后的任务名。
        task_root = task.rsplit(":", 1)[-1]
        # 仅允许不会发布、删除或修改外部状态的验证任务。
        if task_root not in ALLOWED_TASK_ROOTS:
            raise ValueError(f"不允许通过离线恢复能力执行任务：{task}")
    # 返回已验证任务顺序。
    return tasks


def _resolve_gradle_executable(context: dict[str, Any]) -> str:
    """选择不会自动下载 Wrapper 分发包的本机 Gradle。"""

    # 调用方可给出已验证的本机 Gradle 可执行文件或命令名。
    requested = str(context.get("gradle_executable") or "gradle").strip()
    # 路径形式必须真实存在。
    requested_path = Path(requested).expanduser()
    if requested_path.is_absolute() or requested_path.parent != Path("."):
        # 显式路径解析后用于 subprocess。
        resolved_path = requested_path.resolve()
        # 不存在的本机 Gradle不能回退 Wrapper下载。
        if not resolved_path.exists() or not resolved_path.is_file():
            raise ValueError(f"gradle_executable 不存在：{resolved_path}")
        # 返回真实本机入口。
        return str(resolved_path)
    # 命令名通过 PATH 查找本机安装。
    resolved_command = shutil.which(requested)
    # PATH中没有 Gradle时报告阻断，不调用 gradlew。
    if not resolved_command:
        raise ValueError(f"PATH 中未找到本机 Gradle：{requested}")
    # 返回解析后的本机可执行文件。
    return resolved_command


def _redact_command(command: list[str]) -> list[str]:
    """隐藏 Gradle 属性值，避免日志暴露凭据。"""

    # 返回新列表，真实 subprocess 参数保持不变。
    redacted: list[str] = []
    # 每个参数独立判断是否为 -Pname=value。
    for argument in command:
        # 属性值统一替换，属性名保留排错用途。
        if argument.startswith("-P") and "=" in argument:
            property_name = argument.split("=", 1)[0]
            redacted.append(f"{property_name}=<redacted>")
        else:
            # 非属性参数原样记录。
            redacted.append(argument)
    # 返回安全命令。
    return redacted


def _build_gradle_command(
    gradle_executable: str,
    init_script: Path,
    tasks: list[str],
    tests: list[str],
    properties: dict[str, str],
) -> list[str]:
    """构建固定离线边界的 Gradle 命令。"""

    # 本机 Gradle、offline、no-daemon 和 init script构成不可省略前缀。
    command = [
        gradle_executable,
        "--offline",
        "--no-daemon",
        "-I",
        str(init_script),
    ]
    # 无权限占位属性只进入当前进程参数。
    command.extend(
        f"-P{name}={value}" for name, value in sorted(properties.items())
    )
    # 已验证任务按调用顺序追加，test过滤器必须紧随 test任务。
    for task in tasks:
        # 先加入当前任务。
        command.append(task)
        # 只有 test任务接收 Gradle标准 --tests 参数。
        if task.rsplit(":", 1)[-1] == "test":
            # 每个类或方法过滤器作为独立参数，避免 shell 解释。
            for test_name in tests:
                # 过滤器紧邻 test，防止被后续 JaCoCo任务解析。
                command.extend(["--tests", test_name])
    # 返回供 subprocess 直接执行的列表，不使用 shell。
    return command


def _run(context: dict[str, Any], project_root: Path) -> dict[str, Any]:
    """使用已准备闭包执行真实 Gradle 离线测试。"""

    # 当前工程恢复路径必须已由 prepare 创建。
    paths = _runtime_paths(project_root)
    # 缺少 init script时不擅自使用正式远程仓库。
    if not paths["init_script"].exists():
        return {
            "status": "blocked_not_prepared",
            "ability": ABILITY_ID,
            "action": "run",
            "message": "缺少离线 init script，请先执行 prepare。",
            "init_script": str(paths["init_script"]),
        }
    # 任务清单必须属于允许的验证范围。
    tasks = _validate_tasks(list(context.get("tasks") or []))
    # 测试过滤器只做字符串传递，不经过 shell。
    tests = [
        str(item).strip()
        for item in list(context.get("tests") or [])
        if str(item).strip()
    ]
    # Gradle 属性转换为字符串，允许无权限占位值通过配置求值。
    properties = {
        str(name): str(value)
        for name, value in dict(context.get("properties") or {}).items()
    }
    # 只选择本机安装 Gradle，不自动回退 Wrapper。
    gradle_executable = _resolve_gradle_executable(context)
    # 构建固定包含 --offline 的真实测试命令。
    command = _build_gradle_command(
        gradle_executable,
        paths["init_script"],
        tasks,
        tests,
        properties,
    )
    # Gradle 用户缓存归属当前工程 cache。
    paths["gradle_user_home"].mkdir(parents=True, exist_ok=True)
    # 日志目录归属当前工程 OPTION/temp。
    paths["temp_root"].mkdir(parents=True, exist_ok=True)
    # 复制环境并只覆盖本次 Gradle 用户目录。
    process_environment = dict(os.environ)
    # Gradle 缓存不能落入用户主目录。
    process_environment["GRADLE_USER_HOME"] = str(paths["gradle_user_home"])
    # 超时限制防止测试无限占用会话。
    timeout_seconds = int(context.get("timeout_seconds") or 1200)
    # 标准输出和错误分别写入稳定 UTF-8 日志。
    with paths["stdout_log"].open("w", encoding="utf-8") as stdout_file:
        # 错误日志独立保存依赖或测试失败证据。
        with paths["stderr_log"].open("w", encoding="utf-8") as stderr_file:
            try:
                # 列表参数且 shell=False，禁止命令注入和额外 shell 下载逻辑。
                completed_process = subprocess.run(
                    command,
                    cwd=project_root,
                    env=process_environment,
                    stdout=stdout_file,
                    stderr=stderr_file,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=timeout_seconds,
                    check=False,
                    shell=False,
                )
                # 保存真实 Gradle 返回码。
                return_code = completed_process.returncode
                # 正常返回后没有超时。
                timed_out = False
            except subprocess.TimeoutExpired:
                # 超时属于未通过，不能声称测试完成。
                return_code = -1
                # 返回超时事实供交付说明。
                timed_out = True
    # 只有 Gradle返回零且未超时才视为正常测试完成。
    status = "completed" if return_code == 0 and not timed_out else "test_failed"
    # 返回命令时隐藏所有属性值。
    return {
        "status": status,
        "ability": ABILITY_ID,
        "action": "run",
        "project_root": str(project_root),
        "network_download": False,
        "command": _redact_command(command),
        "return_code": return_code,
        "timed_out": timed_out,
        "stdout_log": str(paths["stdout_log"]),
        "stderr_log": str(paths["stderr_log"]),
        "build_root": str(paths["build_root"]),
    }


def execute(context: dict, skills: dict, apps: dict) -> dict:
    """按 plan、prepare 或 run 分发离线恢复动作。"""

    # 当前能力不消费技能或 App，但保留统一执行器契约。
    _ = skills, apps
    try:
        # 所有动作先绑定调用方显式工程根。
        project_root = _resolve_project_root(context)
        # 动作名统一小写并兼容连字符。
        action = str(context.get("action") or "plan").strip().lower().replace("-", "_")
        # plan 只读扫描并返回候选，不写构件缓存。
        if action == "plan":
            plan = _plan(context, project_root)
            return {
                "status": "completed",
                "ability": ABILITY_ID,
                "action": "plan",
                "project_root": str(project_root),
                **plan,
            }
        # prepare 物化依赖并生成 init script与清单。
        if action == "prepare":
            return _prepare(context, project_root)
        # run 只执行已经准备好的正常测试。
        if action == "run":
            return _run(context, project_root)
        # 未知动作返回稳定错误，不做任何写入或进程启动。
        return {
            "status": "unknown_action",
            "ability": ABILITY_ID,
            "action": action,
            "message": "支持的 action：plan/prepare/run。",
        }
    except (OSError, ValueError, json.JSONDecodeError) as error:
        # 文件、路径或输入错误统一返回阻断结果，避免执行器直接崩溃。
        return {
            "status": "blocked",
            "ability": ABILITY_ID,
            "message": str(error),
        }
