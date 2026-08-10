package com.sp.selplat.mda.projectgenerator.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.mda.projectgenerator.model.MdaProjectGenerationData;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;
import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.h2.tools.RunScript;

/**
 * 在真实隔离目录验证完整工程创建、追加表和无覆盖冲突保护。
 */
class MdaProjectGeneratorServiceImplTest {

    @TempDir
    private Path testRoot;

    private MdaProjectGeneratorServiceImpl service;

    /**
     * 建立包含真实 settings.gradle 和 Host 构建文件的最小 SELPLAT 根。
     *
     * <p>执行后无返回值；副作用只发生在 JUnit 隔离临时目录。
     *
     * @throws Exception 目录或文件准备失败时终止当前测试
     */
    @BeforeEach
    void setUp() throws Exception {
        Files.createDirectories(testRoot.resolve("apps/mda"));
        Files.createDirectories(testRoot.resolve("apps/host/backend"));
        Files.createDirectories(testRoot.resolve(
                "apps/host/backend/src/main/resources/static/desktop"));
        Files.createDirectories(testRoot.resolve(
                "apps/rule-engine/backend/src/main/resources/local/TESTUSER/"
                        + "selplat/通用/registry"));
        Files.writeString(
                testRoot.resolve("AGENTS.md"),
                "- 当前稳定用户 ID：`TESTUSER`\n");
        Files.writeString(
                testRoot.resolve(
                        "apps/rule-engine/backend/src/main/resources/local/TESTUSER/"
                                + "selplat/通用/registry/managed-database-applications.json"),
                """
                {
                  "version": 1,
                  "applications": []
                }
                """);
        Files.writeString(
                testRoot.resolve("settings.gradle"),
                "rootProject.name = 'test'\n");
        Files.writeString(
                testRoot.resolve("apps/host/backend/build.gradle"),
                """
                dependencies {
                    implementation project(':apps:mda:backend')
                }
                """);
        Files.writeString(
                testRoot.resolve(
                        "apps/host/backend/src/main/resources/static/desktop/applications.json"),
                """
                {
                  "version": 1,
                  "applications": [
                  ]
                }
                """);
        Files.writeString(
                testRoot.resolve(
                        "apps/host/backend/src/main/resources/static/desktop/desktop.js"),
                """
                const hostdesktopAllowedPaths = Object.freeze([
                    "/mda/",
                    // SELPLAT-GENERATED-APPLICATION-PATHS
                ]);
                """);
        service = new MdaProjectGeneratorServiceImpl(testRoot);
    }

    /**
     * 验证首次创建产生完整分层、默认字段、页面三件套和 Gradle 登记。
     * 真实传参示例：{@code projectName=japan, tableName=region}。
     * 真实返回示例：页面为 {@code /japan/japan.html}，真实表为 {@code JapanRegion}。
     * 异常或副作用示例：仅在隔离目录创建 apps/japan，不触碰真实工作区。
     *
     * @throws Exception 生成文件读取失败时终止测试
     */
    @Test
    void shouldCreateCompleteProjectFromTemplate() throws Exception {
        MdaProjectGenerationData result = service.generate(request("japan", "region"));

        assertThat(result.projectCreated()).isTrue();
        assertThat(result.actualTableName()).isEqualTo("JapanRegion");
        assertThat(result.pageUrl()).isEqualTo("/japan/japan.html");
        Path project = testRoot.resolve("apps/japan");
        assertThat(project.resolve(".selplat-generated-project.json")).isRegularFile();
        assertThat(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/controller"))
                .doesNotExist();
        assertThat(Files.readString(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/JapanBackendApplication.java")))
                .contains("\"com.sp.selplat.common.service\"")
                .doesNotContain("ReferenceDataController.class")
                .doesNotContain("ReferenceDataProviderRegistry.class")
                .doesNotContain("\"com.sp.selplat.common.db\"");
        assertThat(Files.readString(project.resolve("backend/build.gradle")))
                .doesNotContain("apps:reference-data:backend");
        assertThat(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/common/service"))
                .doesNotExist();
        assertThat(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/common/util"))
                .doesNotExist();
        assertThat(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/region/reference"))
                .doesNotExist();
        assertThat(project.resolve("manifest")).doesNotExist();
        assertThat(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/region/controller/"
                        + "JapanRegionController.java")).isRegularFile();
        Path serviceContract = project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/region/service/"
                        + "JapanRegionService.java");
        Path serviceImplementation = project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/region/service/impl/"
                        + "JapanRegionServiceImpl.java");
        assertThat(serviceContract).isRegularFile();
        assertThat(Files.readString(serviceContract)).contains("public interface JapanRegionService");
        assertThat(serviceImplementation).isRegularFile();
        assertThat(Files.readString(serviceImplementation))
                .contains("@Service")
                .contains("extends BaseServiceImpl<JapanRegionDao>")
                .contains("implements JapanRegionService")
                .contains("value.putParam(\"status\", 1)")
                .contains("putIfAbsent(saveIn, \"tenantId\", 1L)")
                .contains("saveIn.putParam(\"updatedAt\", LocalDateTime.now())");
        assertThat(Files.readString(project.resolve(
                "backend/src/main/java/com/sp/selplat/japan/region/controller/"
                        + "JapanRegionController.java")))
                .contains("import com.sp.selplat.japan.region.service.JapanRegionService;")
                .doesNotContain(".service.impl.");
        assertThat(project.resolve(
                "backend/src/main/resources/static/japan/japan.html")).isRegularFile();
        assertThat(project.resolve(
                "backend/src/main/resources/static/japan/japan.js")).isRegularFile();
        assertThat(project.resolve(
                "backend/src/main/resources/static/japan/japan.css")).isRegularFile();
        String generatedHtml = Files.readString(project.resolve(
                "backend/src/main/resources/static/japan/japan.html"));
        String generatedScript = Files.readString(project.resolve(
                "backend/src/main/resources/static/japan/japan.js"));
        String generatedStyle = Files.readString(project.resolve(
                "backend/src/main/resources/static/japan/japan.css"));
        assertThat(generatedHtml)
                .contains("/sel/theme/runtime/selThemeManager.js")
                .contains("/sel/components/panel/selPanel.js")
                .contains("/sel/components/tree/selTree.js")
                .contains("/sel/components/search/selSearch.js")
                .contains("/sel/components/grid/selGrid.js")
                .contains("/sel/components/window/selWindow.js")
                .contains("/sel/components/confirm-dialog/selConfirmDialog.js")
                .contains("/sel/components/personalization/selPersonalization.js");
        assertThat(generatedScript)
                .contains("window.selPanel.create")
                .contains("window.selTree.mount")
                .contains("window.selGrid.mount")
                .contains("window.selWindow.mount")
                .contains("window.selConfirmDialog.mount")
                .contains("id: \"region-root\"")
                .doesNotContain("/api/reference-data/")
                .doesNotContain("window.confirm");
        assertThat(generatedStyle)
                .contains("只分配 SEL 公共面板的页面舞台")
                .doesNotContain("table {")
                .doesNotContain("dialog {");
        assertThat(Files.readString(project.resolve(
                "db/sql/schema-JapanRegion.sql")))
                .contains("tenantId BIGINT NOT NULL")
                .contains("lastOperateUserId BIGINT NOT NULL")
                .contains("sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00")
                .contains("labelZh VARCHAR(200) NOT NULL")
                .contains("labelJa VARCHAR(200)")
                .contains("labelEn VARCHAR(200)")
                .doesNotContain("name VARCHAR(200)")
                .contains("createdAt TIMESTAMP NOT NULL");
        assertThat(generatedScript)
                .contains("field: \"labelZh\"")
                .contains("field: \"labelJa\"")
                .contains("field: \"labelEn\"")
                .contains("name: \"labelZh\"")
                .doesNotContain("field: \"name\"");
        assertThat(Files.readString(project.resolve(
                "db/sql/data-JapanRegion.sql")))
                .contains("默认不写业务数据")
                .contains("SELECT 1;");
        assertThat(Files.readString(testRoot.resolve("settings.gradle")))
                .contains("include('apps:japan:backend')")
                .contains("file('apps/japan/backend')");
        assertThat(Files.readString(
                testRoot.resolve("apps/host/backend/build.gradle")))
                .contains("implementation project(':apps:japan:backend')");
        Path desktopManifest = testRoot.resolve(
                "apps/host/backend/src/main/resources/static/desktop/applications.json");
        assertThat(Files.readString(desktopManifest))
                .contains("\"code\": \"japan\"")
                .contains("\"url\": \"/japan/japan.html\"")
                .contains("\"permissionCode\": \"japan:access\"");
        JsonNode applications = new ObjectMapper().readTree(desktopManifest.toFile())
                .path("applications");
        assertThat(applications.isArray()).isTrue();
        assertThat(applications.size()).isEqualTo(1);
        assertThat(applications.get(0).path("code").asText()).isEqualTo("japan");
        assertThat(Files.readString(testRoot.resolve(
                "apps/host/backend/src/main/resources/static/desktop/desktop.js")))
                .contains("\"/japan/\"");
        Path centralRegistry = testRoot.resolve(
                "apps/rule-engine/backend/src/main/resources/local/TESTUSER/"
                        + "selplat/通用/registry/managed-database-applications.json");
        JsonNode managedApplications = new ObjectMapper().readTree(centralRegistry.toFile())
                .path("applications");
        assertThat(managedApplications.size()).isEqualTo(1);
        assertThat(managedApplications.get(0).path("projectName").asText()).isEqualTo("japan");
        assertThat(managedApplications.get(0).path("databaseFile").asText())
                .isEqualTo("db/japan.mv.db");
        assertThat(managedApplications.get(0).path("datasourcePrefix").asText())
                .isEqualTo("japan.datasource");
        try (var generatedSources = Files.walk(project.resolve("backend/src/main/java"))) {
            assertThat(generatedSources
                    .filter(Files::isRegularFile)
                    .map(path -> path.getFileName().toString())
                    .filter(name -> name.matches(
                            ".*(Request|Response|Result|Page|Param)\\.java"))
                    .toList()).isEmpty();
        }
    }

    /**
     * 验证完整模板生成的全部 Java 源码可以使用当前工程真实依赖编译。
     * 真实传参示例：生成 {@code japan/region} 后编译其 backend/src/main/java。
     * 真实返回示例：JavaCompiler 返回 {@code true} 且输出目录产生 class 文件。
     * 异常或副作用示例：编译产物仅写入 JUnit 临时目录，不登记真实 Gradle 工程。
     *
     * @throws Exception 源文件遍历、编译器调用或输出准备失败时终止测试
     */
    @Test
    void shouldCompileAllGeneratedJavaSources() throws Exception {
        service.generate(request("japan", "region"));
        Path sourceRoot = testRoot.resolve("apps/japan/backend/src/main/java");
        Path output = testRoot.resolve("compiled-generated-project");
        Files.createDirectories(output);
        List<Path> sourceFiles;
        try (var paths = Files.walk(sourceRoot)) {
            sourceFiles = paths.filter(path -> path.toString().endsWith(".java"))
                    .toList();
        }
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        assertThat(compiler).isNotNull();
        try (StandardJavaFileManager fileManager =
                     compiler.getStandardFileManager(null, null, null)) {
            Iterable<? extends javax.tools.JavaFileObject> units =
                    fileManager.getJavaFileObjectsFromPaths(sourceFiles);
            boolean compiled = compiler.getTask(
                    null,
                    fileManager,
                    null,
                    List.of(
                            "-proc:none",
                            "-classpath", System.getProperty("java.class.path"),
                            "-d", output.toString()),
                    null,
                    units).call();
            assertThat(compiled).isTrue();
        }
        assertThat(output.resolve(
                "com/sp/selplat/japan/region/controller/"
                + "JapanRegionController.class")).isRegularFile();
    }

    /**
     * 验证生成的号段和业务表 SQL 能在真实隔离 H2 中按清单顺序执行。
     * 真实传参示例：执行 japan 工程生成的四个 SQL 文件。
     * 真实返回示例：号段存在 {@code JapanRegionId}，业务表记录数为零。
     * 异常或副作用示例：数据库只存在于当前测试内存，SQL 错误会直接终止测试。
     *
     * @throws Exception 数据库连接、SQL 读取或执行失败时终止测试
     */
    @Test
    void shouldExecuteGeneratedSqlAgainstRealH2Database() throws Exception {
        service.generate(request("japan", "region"));
        Path sqlRoot = testRoot.resolve("apps/japan/db/sql");
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:mda_generated_project;DB_CLOSE_DELAY=-1;"
                        + "MODE=MySQL;DATABASE_TO_UPPER=false",
                "sa",
                "")) {
            RunScript.execute(
                    connection,
                    Files.newBufferedReader(
                            sqlRoot.resolve("schema-CommonSequenceSegment.sql")));
            RunScript.execute(
                    connection,
                    Files.newBufferedReader(
                            sqlRoot.resolve("schema-JapanRegion.sql")));
            RunScript.execute(
                    connection,
                    Files.newBufferedReader(
                            sqlRoot.resolve("data-JapanRegion.sql")));
            RunScript.execute(
                    connection,
                    Files.newBufferedReader(
                            sqlRoot.resolve("data-CommonSequenceSegment.sql")));
            try (var statement = connection.createStatement();
                 var sequence = statement.executeQuery(
                         "SELECT seqCode FROM CommonSequenceSegment")) {
                assertThat(sequence.next()).isTrue();
                assertThat(sequence.getString(1)).isEqualTo("JapanRegionId");
            }
            try (var statement = connection.createStatement();
                 var count = statement.executeQuery(
                         "SELECT COUNT(*) FROM JapanRegion")) {
                assertThat(count.next()).isTrue();
                assertThat(count.getInt(1)).isZero();
            }
        }
    }

    /**
     * 验证同一生成工程追加表时只增加新表文件并同步顺序和号段登记。
     * 真实传参示例：先创建 {@code japan/region}，再创建 {@code japan/city}。
     * 真实返回示例：第二个页面为 {@code /japan/city.html}。
     * 异常或副作用示例：原 JapanRegion 文件内容保持不变。
     *
     * @throws Exception 生成文件读取失败时终止测试
     */
    @Test
    void shouldAppendNewTableWithoutOverwritingFirstTable() throws Exception {
        service.generate(request("japan", "region"));
        Path firstController = testRoot.resolve(
                "apps/japan/backend/src/main/java/com/sp/selplat/japan/region/controller/"
                        + "JapanRegionController.java");
        String firstContent = Files.readString(firstController);

        MdaProjectGenerationData result = service.generate(request("japan", "city"));

        assertThat(result.projectCreated()).isFalse();
        assertThat(result.pageUrl()).isEqualTo("/japan/city.html");
        assertThat(Files.readString(firstController)).isEqualTo(firstContent);
        assertThat(testRoot.resolve(
                "apps/japan/backend/src/main/java/com/sp/selplat/japan/city/controller/"
                        + "JapanCityController.java")).isRegularFile();
        assertThat(testRoot.resolve(
                "apps/japan/backend/src/main/java/com/sp/selplat/japan/controller/city"))
                .doesNotExist();
        String loadOrder = Files.readString(testRoot.resolve(
                "apps/japan/backend/src/main/resources/db/japan/sql/load-order.txt"));
        assertThat(loadOrder)
                .contains("schema-JapanRegion.sql")
                .contains("schema-JapanCity.sql")
                .contains("data-JapanCity.sql");
        assertThat(loadOrder.indexOf("schema-JapanCity.sql"))
                .isLessThan(loadOrder.indexOf("data-JapanRegion.sql"));
        assertThat(loadOrder.indexOf("data-JapanCity.sql"))
                .isLessThan(loadOrder.indexOf("data-CommonSequenceSegment.sql"));
        assertThat(Files.readString(testRoot.resolve(
                "apps/japan/db/sql/data-CommonSequenceSegment.sql")))
                .contains("JapanRegionId")
                .contains("JapanCityId");
    }

    /**
     * 验证重复表目标触发业务冲突且所有登记文件保持不变。
     * 真实传参示例：连续两次创建 {@code japan/region}。
     * 真实返回示例：第二次抛出 {@code MDA_PROJECT_FILE_EXISTS}。
     * 异常或副作用示例：settings.gradle 和号段数据没有重复行。
     *
     * @throws Exception 文件快照读取失败时终止测试
     */
    @Test
    void shouldRejectExistingTableWithoutChangingFiles() throws Exception {
        service.generate(request("japan", "region"));
        String settings = Files.readString(testRoot.resolve("settings.gradle"));
        Path sequence = testRoot.resolve(
                "apps/japan/db/sql/data-CommonSequenceSegment.sql");
        String sequenceText = Files.readString(sequence);

        assertThatThrownBy(() -> service.generate(request("japan", "region")))
                .isInstanceOf(CommonBusinessException.class)
                .hasMessageContaining("目标文件已存在");

        assertThat(Files.readString(testRoot.resolve("settings.gradle")))
                .isEqualTo(settings);
        assertThat(Files.readString(sequence)).isEqualTo(sequenceText);
    }

    /**
     * 验证路径型输入和手工同名目录均被拒绝。
     * 真实传参示例：工程名 {@code ../escape} 或既有 apps/manual。
     * 真实返回示例：返回可识别业务异常。
     * 异常或副作用示例：不会在隔离根外创建任何文件。
     *
     * @throws Exception 手工目录准备失败时终止测试
     */
    @Test
    void shouldRejectPathEscapeAndUnownedProject() throws Exception {
        assertThatThrownBy(() -> service.generate(request("../escape", "region")))
                .isInstanceOf(CommonBusinessException.class)
                .hasMessageContaining("工程名只能使用");

        Files.createDirectories(testRoot.resolve("apps/manual"));
        assertThatThrownBy(() -> service.generate(request("manual", "region")))
                .isInstanceOf(CommonBusinessException.class)
                .hasMessageContaining("不是由创建工程功能生成");
        assertThat(testRoot.getParent().resolve("escape")).doesNotExist();
    }

    /**
     * 使用 SELPLAT 公共单条参数构造 MDA 生成输入。
     * 真实传参示例：工程编码 {@code japan}，表编码 {@code region}。
     * 真实返回示例：{@code paramMap={projectName:japan,tableName:region}}。
     * 异常或副作用示例：空值保留给生成服务校验，本方法不写入文件。
     *
     * @param projectName 工程编码
     * @param tableName 表编码
     * @return SELPLAT 公共单条请求参数
     */
    private CommonParam request(String projectName, String tableName) {
        CommonParam request = new CommonParam();
        request.putParam("projectName", projectName);
        request.putParam("tableName", tableName);
        return request;
    }
}
