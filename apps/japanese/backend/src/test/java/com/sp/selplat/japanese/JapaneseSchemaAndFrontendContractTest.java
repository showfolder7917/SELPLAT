package com.sp.selplat.japanese;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.Objects;
import org.h2.tools.RunScript;
import org.junit.jupiter.api.Test;

/** 验证 N2 题表真实 SQL 与页面 SEL 控件、双击编辑、AI 媒体动作保持同步。 */
class JapaneseSchemaAndFrontendContractTest {

    /**
     * 验证题表在真实隔离 H2 中包含三种题型、答案和云存储预留字段。
     * 真实传参示例：执行 classpath 下 {@code schema-JapaneseN2BlueBookQuestion.sql}。
     * 真实返回示例：QUESTIONTYPE、IMAGESTORAGEKEY、AUDIOURL 等字段可由元数据读取。
     * 异常或副作用示例：SQL 不兼容时测试失败；数据库仅存在于当前内存连接。
     *
     * @throws Exception SQL 执行或元数据读取失败时终止测试
     */
    @Test
    void shouldCreateN2QuestionSchemaWithAiAndCloudStorageFields() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:japanese_question_schema;MODE=MySQL;DATABASE_TO_UPPER=false", "sa", "")) {
            RunScript.execute(connection, new InputStreamReader(
                    Objects.requireNonNull(getClass().getResourceAsStream(
                            "/db/japanese/sql/schema-JapaneseN2BlueBookQuestion.sql")),
                    StandardCharsets.UTF_8));
            try (var columns = connection.getMetaData().getColumns(
                    null, null, "JapaneseN2BlueBookQuestion", null)) {
                java.util.Set<String> names = new java.util.LinkedHashSet<>();
                while (columns.next()) names.add(columns.getString("COLUMN_NAME"));
                assertThat(names).contains(
                        "questionType", "questionText", "optionA", "optionD", "correctOption",
                        "explanation", "imageStorageProvider", "imageStorageKey", "imageUrl",
                        "audioStorageProvider", "audioStorageKey", "audioUrl");
            }
        }
    }

    /**
     * 验证页面由 SEL 公共控件装配，同时保留双击编辑和三个直接生成入口。
     * 真实传参示例：读取最终 japanese.html 与 japanese.js。
     * 真实返回示例：存在 selPanel/selTree/selGrid/selWindow、三个生成动作和 dblclick 绑定。
     * 异常或副作用示例：页面契约遗漏时断言失败；测试只读资源文件。
     *
     * @throws Exception 静态资源读取失败时终止测试
     */
    @Test
    void shouldUseSelControlsAndExposeDoubleClickEditorWithThreeGenerationActions() throws Exception {
        String html = resource("/static/japanese/japanese.html");
        String script = resource("/static/japanese/japanese.js");
        assertThat(html)
                .contains("/sel/theme/runtime/selThemeManager.js")
                .contains("/sel/components/panel/selPanel.js")
                .contains("/sel/components/tree/selTree.js")
                .contains("/sel/components/search/selSearch.js")
                .contains("/sel/components/grid/selGrid.js")
                .contains("/sel/components/window/selWindow.js")
                .contains("/sel/components/confirm-dialog/selConfirmDialog.js")
                .contains("/sel/components/personalization/selPersonalization.js")
                .contains("data-sel-density=\"compact\"");
        assertThat(script)
                .contains("window.selPanel.create")
                .contains("window.selTree.mount")
                .contains("window.selGrid.mount")
                .contains("window.selWindow.mount")
                .contains("window.selConfirmDialog.mount")
                .contains("addEventListener(\"dblclick\"")
                .contains("data-generate=\"explanation\"")
                .contains("data-generate=\"image\"")
                .contains("data-generate=\"audio\"")
                .contains("generate-${kind}.htm")
                .contains("`${prefix}StorageProvider`")
                .contains("`${prefix}Url`")
                .contains("PRONUNCIATION", "KANJI", "GRAMMAR");
    }

    /**
     * 验证 Japanese 业务生成接口只复用 SELPLAT 公共请求与输出协议。
     * 真实传参示例：读取题库 Controller 和 Service 源码。
     * 真实返回示例：Controller 接收 {@code CommonParam}，Service 返回 {@code CommonResult}。
     * 异常或副作用示例：重新创建 Japanese 专用 Request 时断言失败；测试只读源码。
     *
     * @throws Exception 源码文件读取失败时终止测试
     */
    @Test
    void shouldReuseSharedCommonRequestAndResultContracts() throws Exception {
        java.nio.file.Path projectRoot = java.nio.file.Path.of(System.getProperty("user.dir"))
                .toAbsolutePath().normalize();
        while (projectRoot != null && !java.nio.file.Files.isRegularFile(
                projectRoot.resolve("settings.gradle"))) {
            projectRoot = projectRoot.getParent();
        }
        assertThat(projectRoot).isNotNull();
        java.nio.file.Path sourceRoot = projectRoot.resolve(
                "apps/japanese/backend/src/main/java/com/sp/selplat/japanese/n2bluebookquestion");
        String controller = java.nio.file.Files.readString(sourceRoot.resolve(
                "controller/JapaneseN2BlueBookQuestionController.java"));
        String service = java.nio.file.Files.readString(sourceRoot.resolve(
                "service/JapaneseQuestionContentService.java"));
        assertThat(controller).contains("@RequestBody CommonParam request");
        assertThat(service).contains("CommonResult generateExplanation(CommonParam request)");
        assertThat(sourceRoot.resolve("model/JapaneseQuestionGenerationRequest.java"))
                .doesNotExist();
    }

    private String resource(String path) throws Exception {
        try (var input = Objects.requireNonNull(getClass().getResourceAsStream(path))) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
