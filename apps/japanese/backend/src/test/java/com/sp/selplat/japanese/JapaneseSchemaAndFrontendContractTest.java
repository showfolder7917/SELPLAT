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
                .contains("/sel/core/selKernel.js")
                .contains("/sel/core/selLocaleRuntime.js")
                .contains("/sel/theme/runtime/selThemeManager.js")
                .contains("/sel/theme/packs/glass-admin/theme.css?v=20260817-toolbar-surface-2")
                .contains("/sel/components/panel/selPanel.js")
                .contains("/sel/components/tooltip/selTooltip.js")
                .contains("/sel/components/tree/selTree.js")
                .contains("/sel/components/search/selSearch.js")
                .contains("/sel/components/grid/selGrid.js")
                .contains("/sel/components/window/selWindow.js")
                .contains("/sel/components/table-editor/selTableEditor.js")
                .contains("/sel/components/confirm-dialog/selConfirmDialog.js")
                .contains("/sel/components/personalization/selPersonalization.js")
                .contains("data-sel-density=\"compact\"");
        assertThat(script)
                .contains("window.sel.require([")
                .contains("panel.create")
                .contains("tree.mount")
                .contains("grid.mount")
                .contains("selectionMode: \"SINGLE\"")
                .contains("windowComponent.mount")
                .contains("confirmDialog.mount")
                .contains("locale.runtime")
                .contains("/api/reference-data/projects/japanese/pages/")
                .contains("getGridColumn.htm?tableCode=")
                .contains("tableTitle:")
                .contains("tableCode:")
                .contains("tableEditor.mount")
                .contains("tableEditor.attachTrigger")
                .contains("reorder: japaneseReorderTableElements")
                .contains("confirmReorder: (records) => japaneseState.deleteController.open")
                .contains("tableEditor.confirmReorder")
                .contains("tableElements: records.map")
                .contains("baseVersion: japaneseState.pageVersion")
                .contains("playAudio")
                .contains("generate-audio.htm")
                .contains("audioStorageProvider")
                .doesNotContain("Object.assign(record")
                .contains("registerPageControl")
                .contains("moveGroup: definition.key === \"sourceQuestionNo\"")
                .contains("selGridJapaneseN2BlueBookQuestionId")
                .contains("selWindowJapaneseN2BlueBookQuestionId")
                .contains("mode: \"REMOTE\"")
                .contains("name: \"sourceQuestionNo\"")
                .contains("name: \"questionText\"")
                .contains("questionTextLike")
                .contains("detail.treeFilter?.questionType")
                .contains("addEventListener(\"dblclick\"")
                .contains("data-generate=\"explanation\"")
                .contains("data-generate=\"image\"")
                .contains("data-generate=\"audio\"")
                .contains("generate-${kind}.htm")
                .contains("`${prefix}StorageProvider`")
                .contains("`${prefix}Url`")
                .contains("PRONUNCIATION", "KANJI", "GRAMMAR");
        assertThat(resource("/static/japanese/i18n/zh-CN.json"))
                .contains("\"documentTitle\"", "\"PRONUNCIATION\"");
        assertThat(resource("/static/japanese/i18n/ja-JP.json"))
                .contains("N2 青本1000問", "\"submit\":\"検索\"");
        assertThat(resource("/static/japanese/i18n/en-US.json"))
                .contains("N2 Blue Book 1000 Questions", "\"submit\":\"Search\"");
        assertThat(resource("/META-INF/selplat-reference-data-defaults/n2-blue-book-question.json"))
                .contains("\"projectCode\": \"japanese\"")
                .contains("\"deprecatedControlFields\": [\"keyword\"]")
                .contains("\"legacyGeometry\":{\"width\":\"220px\",\"height\":\"42px\",\"x\":0,\"y\":23}")
                .contains("\"x\":17")
                .contains("\"sourceTableName\": \"JapaneseN2BlueBookQuestion\"")
                .contains("\"fieldName\":\"sourceQuestionNo\"")
                .contains("\"fieldName\":\"questionText\"")
                .contains("\"fieldName\":\"optionA\"")
                .contains("\"fieldName\":\"optionB\"")
                .contains("\"fieldName\":\"optionC\"")
                .contains("\"fieldName\":\"optionD\"")
                .doesNotContain("\"fieldName\":\"correctOption\"")
                .doesNotContain("\"fieldName\":\"imageState\"")
                .doesNotContain("\"fieldName\":\"keyword\"")
                .contains("\"triggerControlCode\":\"selWindowJapaneseN2BlueBookQuestionId\"")
                .contains("\"legacyNodeValue\":\"READING\"");
        assertThat(resource("/static/japanese/japanese.css"))
                .contains(".japanese-query-save-host")
                .contains("display: inline-block");
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
                "apps/japanese/backend/src/main/java/com/sp/selplat/japanese");
        String controller = java.nio.file.Files.readString(sourceRoot.resolve(
                "n2bluebookquestion/controller/JapaneseN2BlueBookQuestionController.java"));
        String service = java.nio.file.Files.readString(sourceRoot.resolve(
                "n2bluebookquestion/service/JapaneseN2BlueBookQuestionService.java"));
        assertThat(controller).contains("@RequestBody CommonParam request");
        assertThat(service).contains("CommonResult generateExplanation(CommonParam request)");
        assertThat(sourceRoot.resolve(
                "n2bluebookquestion/service/JapaneseQuestionGenerationRequest.java"))
                .doesNotExist();
        assertThat(sourceRoot.resolve("domain"))
                .doesNotExist();
    }

    /**
     * 验证 Japanese 主源码使用业务目录优先、业务内按职责分层的稳定结构。
     * 真实传参示例：读取 {@code n2bluebookquestion/service} 和 {@code common/util}。
     * 真实返回示例：题库编排进入业务 Service，Codex、语音、媒体和进程能力进入分类共通工具。
     * 异常或副作用示例：文件退回顶层技术目录或通用能力散落到业务包时断言失败；测试只读源码。
     *
     * @throws Exception 工程根定位或源码检查失败时终止测试
     */
    @Test
    void shouldUseBusinessFirstTechnicalPackages() throws Exception {
        java.nio.file.Path projectRoot = java.nio.file.Path.of(System.getProperty("user.dir"))
                .toAbsolutePath().normalize();
        while (projectRoot != null && !java.nio.file.Files.isRegularFile(
                projectRoot.resolve("settings.gradle"))) {
            projectRoot = projectRoot.getParent();
        }
        assertThat(projectRoot).isNotNull();
        java.nio.file.Path root = projectRoot.resolve(
                "apps/japanese/backend/src/main/java/com/sp/selplat/japanese");
        assertThat(root.resolve(
                "n2bluebookquestion/controller/JapaneseN2BlueBookQuestionController.java"))
                .isRegularFile();
        assertThat(root.resolve(
                "n2bluebookquestion/service/JapaneseN2BlueBookQuestionService.java"))
                .isRegularFile();
        assertThat(root.resolve(
                "n2bluebookquestion/dao/JapaneseN2BlueBookQuestionDao.java"))
                .isRegularFile();
        assertThat(root.resolve("n2bluebookquestion/reference")).doesNotExist();
        assertThat(root.resolve(
                "n2bluebookquestion/service/JapaneseQuestionContentService.java"))
                .doesNotExist();
        assertThat(root.resolve(
                "n2bluebookquestion/service/impl/JapaneseQuestionContentServiceImpl.java"))
                .doesNotExist();
        assertThat(root.resolve("common/util/codex/CodexCliUtil.java"))
                .isRegularFile();
        assertThat(root.resolve("common/util/speech/EdgeTtsSpeechUtil.java"))
                .isRegularFile();
        assertThat(root.resolve("common/util/media/JapaneseMediaStorage.java"))
                .isRegularFile();
        assertThat(root.resolve("common/util/process/JapaneseExternalProcessRunner.java"))
                .isRegularFile();
        assertThat(root.resolve("common/crud")).doesNotExist();
        assertThat(root.resolve("common/service")).doesNotExist();
        assertThat(root.resolve("common/generation")).doesNotExist();
        assertThat(root.resolve("common/media")).doesNotExist();
        assertThat(root.resolve("common/runtime")).doesNotExist();
        assertThat(root.resolve("controller")).doesNotExist();
        assertThat(root.resolve("service")).doesNotExist();
        assertThat(root.resolve("dao")).doesNotExist();
        assertThat(root.resolve("reference")).doesNotExist();
        assertThat(root.resolve("media")).doesNotExist();
        assertThat(root.resolve("runtime")).doesNotExist();
    }

    private String resource(String path) throws Exception {
        try (var input = Objects.requireNonNull(getClass().getResourceAsStream(path))) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
