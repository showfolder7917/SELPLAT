# Gradle 离线依赖恢复与正常测试执行说明

## 目的

当 Fujitsu Gradle 工程禁止下载依赖，但本机已经存在所需 JAR、POM 或相邻工程产物时，本流程把这些资源恢复为 Gradle 可解析的本地依赖闭包，并继续执行工程原有的正常测试任务。

本流程不修改正式 `build.gradle`，不创建空构件，不伪造未知传递依赖，也不使用静态检查或手工 JUnit 启动器冒充测试成功。

## 文件归属

- 可复用 Maven 构件：`<CURRENT_PROJECT_ROOT>/cache/gradle-offline/maven-repository`
- 无完整 POM 的显式运行时 JAR：`<CURRENT_PROJECT_ROOT>/cache/gradle-offline/runtime-jars`
- Gradle 用户缓存：`<CURRENT_PROJECT_ROOT>/cache/gradle-user-home`
- 恢复清单、init script 和日志：`<CURRENT_PROJECT_ROOT>/OPTION/temp/gradle-offline`
- 正式编译、测试与覆盖率产物：`<CURRENT_PROJECT_ROOT>/build`；既有工程任务另有报告目录时，先按规则治理修正任务配置，恢复能力本身不改写正式 `build.gradle`

## 标准处理顺序

1. 使用工程 Wrapper 和 `--offline` 执行目标任务；Wrapper 缺少本地分发包时停止该入口，改用本机相同版本 Gradle。
2. 将失败分类为 Gradle 分发、声明构件、动态版本元数据、插件元数据、传递运行时构件或工具运行时构件。
3. 只扫描当前工程缓存、调用方明确提供的本机 Gradle/Maven 缓存和已加载项目规则允许的只读参考工程。
4. 排除 `sources` 与 `javadoc` JAR；动态版本解析为本机真实存在且有兼容证据的明确版本。
5. 把选定构件物化到当前工程 `cache/gradle-offline`，并生成包含来源和版本选择的恢复清单。
6. 从同名规则包的 `template/offline-test-init.gradle.template` 读取源模板，生成名为 `offline-test-init.gradle` 的一次性 init script，清除远程仓库，只挂载本地仓库并应用明确版本。源模板的 `.template` 后缀用于避免 VS Code 对占位符进行 Gradle 语法检查，生成文件仍是 Gradle 可执行脚本。
7. 使用 `gradle --offline -I <init-script> test` 回到工程原有测试链路。
8. 核对 JUnit、Spring 上下文、业务入口、Mapper、测试数据库、数据库期待值和 JaCoCo 结果。

## 统一能力入口

通过 `${MEMORY_CODE_ROOT}/executor.py` 调用：

```powershell
python3 "${MEMORY_CODE_ROOT}/executor.py" gradle_offline_test_restorer '<context_json>'
```

Windows PowerShell 调用时可由程序构造 JSON 参数，避免命令行引号被 PowerShell 改写。

### 生成恢复计划

```json
{
  "action": "plan",
  "project_root": "<CURRENT_PROJECT_ROOT>",
  "source_roots": [
    "<LOCAL_MAVEN_OR_GRADLE_CACHE>"
  ],
  "version_pins": {
    "group:artifact": "verified-version"
  }
}
```

### 物化缓存并生成 init script

```json
{
  "action": "prepare",
  "project_root": "<CURRENT_PROJECT_ROOT>",
  "source_roots": [
    "<LOCAL_MAVEN_OR_GRADLE_CACHE>"
  ],
  "version_pins": {
    "group:artifact": "verified-version",
    "group:*": "verified-group-version"
  },
  "artifact_overrides": {
    "group:artifact:verified-version": {
      "jar": "<EXPLICIT_EXISTING_JAR>",
      "pom": "<OPTIONAL_EXISTING_POM>"
    }
  },
  "runtime_jars_by_configuration": {
    "implementation": [
      "<EXPLICIT_PRODUCTION_JAR>"
    ],
    "testImplementation": [
      "<EXPLICIT_TEST_API_JAR>"
    ],
    "testRuntimeOnly": [
      "<EXPLICIT_TEST_RUNTIME_JAR>"
    ],
    "jacocoAnt": [
      "<EXPLICIT_JACOCO_TOOL_JAR>"
    ]
  },
  "materialize_all_candidates": true
}
```

`prepare` 只复制本机实际存在的构件。`artifact_overrides` 用于构件存在于非标准目录、但坐标与兼容版本已有明确证据的情况；它不是伪造构件入口。`runtime_jars_by_configuration` 必须按真实业务用途分类，禁止把全部 JAR 无差别塞入生产 classpath。`materialize_all_candidates` 用于把已扫描的本机传递闭包一并物化到当前工程缓存。多个版本并存而未提供明确版本时，能力返回阻断，不会静默选择最高版本。

### 执行正常测试

```json
{
  "action": "run",
  "project_root": "<CURRENT_PROJECT_ROOT>",
  "gradle_executable": "gradle",
  "tasks": ["test", "jacocoTestReport"],
  "tests": ["fully.qualified.Tester"],
  "properties": {
    "PersonalAccessToken": "offline-placeholder"
  },
  "timeout_seconds": 1200
}
```

能力固定加入 `--offline` 和 `--no-daemon`，清除远程项目仓库，并把 `GRADLE_USER_HOME` 定向到当前工程 `cache`。返回结果中的命令会隐藏属性值。

## CPMAB081 验证基线

本能力落地时使用 CPMAB081 的既有本机构件执行了正常测试链。动态依赖必须固定到实际包含当前工程所需 Bean、Mapper 与 Converter 的兼容构件；仅版本号接近但类契约不完整的 JAR 不能作为恢复依据。

验证命令实际进入 `compileJava → compileTestJava → test → jacocoTestReport`，14 个测试全部通过，Gradle 返回码为 0。该基线证明“禁止下载”不等于“跳过测试”：依赖闭包恢复完成后仍应回到工程原有 Gradle 测试入口。

## 不能继续的情况

- 本机没有真实构件。
- 多版本并存但没有兼容版本证据。
- Gradle 插件仅存在远程声明而本机没有插件实现。
- 缺失 POM 且无法确认需要加入哪个 classpath。
- 正常测试需要的数据库或外部服务没有可用本机测试环境。

这些情况必须报告硬阻塞及剩余风险，不得生成空 JAR、修改正式依赖版本或宣称测试已经通过。
