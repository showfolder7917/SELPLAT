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
     * 验证作答轮次和逐次记录使用两张独立表，并允许同一轮同一题保存多次选择。
     * 真实传参示例：依次执行题目、轮次、明细三个 schema SQL。
     * 真实返回示例：明细表包含 userId、roundId、questionId、selectedOption 和 correctFlag。
     * 异常或副作用示例：外键顺序或字段契约错误时测试失败；数据库只存在于内存连接。
     *
     * @throws Exception SQL 执行或元数据读取失败时终止测试
     */
    @Test
    void shouldCreateIndependentAnswerRoundAndRecordSchemas() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:japanese_answer_schema;MODE=MySQL;DATABASE_TO_UPPER=false", "sa", "")) {
            for (String resource : java.util.List.of(
                    "/db/japanese/sql/schema-JapaneseN2BlueBookQuestion.sql",
                    "/db/japanese/sql/schema-JapaneseN2QuestionAnswerRound.sql",
                    "/db/japanese/sql/schema-JapaneseN2QuestionAnswerRecord.sql")) {
                RunScript.execute(connection, new InputStreamReader(
                        Objects.requireNonNull(getClass().getResourceAsStream(resource)),
                        StandardCharsets.UTF_8));
            }
            try (var columns = connection.getMetaData().getColumns(
                    null, null, "JapaneseN2QuestionAnswerRecord", null)) {
                java.util.Set<String> names = new java.util.LinkedHashSet<>();
                while (columns.next()) names.add(columns.getString("COLUMN_NAME"));
                assertThat(names).contains(
                        "userId", "roundId", "questionId", "selectedOption", "correctFlag", "answeredAt");
            }
            try (var foreignKeys = connection.getMetaData().getImportedKeys(
                    null, null, "JapaneseN2QuestionAnswerRecord")) {
                java.util.Set<String> parentTables = new java.util.LinkedHashSet<>();
                while (foreignKeys.next()) parentTables.add(foreignKeys.getString("PKTABLE_NAME"));
                assertThat(parentTables).contains(
                        "JapaneseN2QuestionAnswerRound", "JapaneseN2BlueBookQuestion");
            }
            try (var indexes = connection.getMetaData().getIndexInfo(
                    null, null, "JapaneseN2QuestionAnswerRecord", true, false)) {
                java.util.Set<String> names = new java.util.LinkedHashSet<>();
                while (indexes.next()) names.add(indexes.getString("INDEX_NAME"));
                assertThat(names).doesNotContain("UK_JapaneseN2QuestionAnswerRecord_RoundQuestion");
            }
        }
    }

    /**
     * 验证每张独立业务表的号段都从六位数 100000 开始，而不是按表分配 2、3 开头区间。
     * 真实传参示例：执行 Japanese 的 CommonSequenceSegment schema 与 data SQL。
     * 真实返回示例：Question、AnswerRound、AnswerRecord 三个 seqCode 的 nextStartId 均为 100000。
     * 异常或副作用示例：初始化值偏离通用门禁时测试失败；数据库仅存在于当前内存连接。
     *
     * @throws Exception SQL 执行或号段查询失败时终止测试
     */
    @Test
    void shouldStartEveryIndependentTableSequenceAtOneHundredThousand() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:japanese_sequence_schema;MODE=MySQL;DATABASE_TO_UPPER=false", "sa", "")) {
            for (String resource : java.util.List.of(
                    "/db/japanese/sql/schema-CommonSequenceSegment.sql",
                    "/db/japanese/sql/data-CommonSequenceSegment.sql")) {
                RunScript.execute(connection, new InputStreamReader(
                        Objects.requireNonNull(getClass().getResourceAsStream(resource)),
                        StandardCharsets.UTF_8));
            }
            try (var statement = connection.createStatement();
                    var rows = statement.executeQuery(
                            "SELECT seqCode, nextStartId FROM CommonSequenceSegment ORDER BY seqCode")) {
                java.util.Map<String, Long> sequences = new java.util.LinkedHashMap<>();
                while (rows.next()) sequences.put(rows.getString("seqCode"), rows.getLong("nextStartId"));
                assertThat(sequences).containsEntry("JapaneseN2BlueBookQuestionId", 100000L)
                        .containsEntry("JapaneseN2QuestionAnswerRoundId", 100000L)
                        .containsEntry("JapaneseN2QuestionAnswerRecordId", 100000L);
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
                .contains("/sel/components/personalization/selPersonalization.js?v=20260817-toolbar-editable-2")
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
                .contains("play-audio.htm")
                .contains("function japanesePlayAudioOnce(player)")
                .contains("window.setTimeout(resolve, 500)")
                .contains("japaneseLearningApi")
                .contains("answer.htm")
                .contains("explanation.htm")
                .contains("next-round.htm")
                .contains("normalized.renderer = \"choice\"")
                .contains("normalized.selectedField = \"displaySelectedOption\"")
                .contains("normalized.selectedTone = (record) => record.answerCorrect === false ? \"danger\" : \"success\"")
                .contains("normalized.lockAfterSelection = false")
                .contains("Number(record.correctCount) > Number(record.wrongCount)")
                .contains("Number(record.wrongCount) >= Number(record.correctCount)")
                .contains("normalized.cellIconTone = \"success\"")
                .contains("normalized.cellIconTone = \"danger\"")
                .contains("japaneseState.gridController.updateRecord(record.id, answerChanges)")
                .contains("japaneseState.gridController.updateRecord(record.id, { audioBusy: true })")
                .contains("japaneseState.gridController.updateRecord(record.id, { audioBusy: false })")
                .contains("String(item.id) === String(record.id) ? { ...item, ...answerChanges } : item")
                .contains("answerSelections: new Map()")
                .contains("component: \"toolbarAction\", command: \"nextRound\"")
                .contains("japaneseUpdateRoundToolbar")
                .contains("const confirmed = await japaneseState.nextRoundController.open({")
                .contains("if (!confirmed) return;")
                .contains("`${japaneseLearningApi}next-round.htm`")
                .contains("title: japaneseText(\"pageEditor.nextRoundAction\")")
                .contains("key: \"japaneseToolbarControls\"")
                .contains("follow: definition === definitions.at(-1)")
                .contains("correctCount", "wrongCount")
                .contains("selBase.toast")
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
                .contains("function japaneseAppendGeneratedExplanation(")
                .contains("`${current}\\n\\n${generated}`")
                .contains("japaneseAppendGeneratedExplanation(currentValues.explanation, result.data.explanation)")
                .contains("function japanesePersistGeneratedExplanation(nextValues)")
                .contains("const payload = japaneseBuildQuestionSavePayload(nextValues)")
                .contains("`${japaneseQuestionApi}update.htm`")
                .contains("japaneseText(\"generation.explanationAppendedAndSaved\"")
                .contains("japaneseText(\"generation.runningButton\"")
                .contains("button.setAttribute(\"aria-busy\", \"true\")")
                .contains("japaneseText(\"generation.explanationAppended\"")
                .doesNotContain("explanation: result.data.explanation")
                .contains("`${prefix}StorageProvider`")
                .contains("`${prefix}Url`")
                .contains("PRONUNCIATION", "KANJI", "GRAMMAR");
        String audioPlayback = script.substring(
                script.indexOf("async function japanesePlayAudio(record)"),
                script.indexOf("/** 提交当前轮次的一项单选答案"));
        assertThat(audioPlayback)
                .doesNotContain("setLocale", "japaneseRefresh")
                .contains("updateRecord(record.id, { audioBusy: true })")
                .contains("await japanesePlayAudioOnce(player)");
        assertThat(resource("/META-INF/resources/sel/components/grid/selGrid.js"))
                .contains("selGridColumn.lockAfterSelection !== false")
                .contains("selGridColumn.selectedTone")
                .contains("selgrid-record-choice-${selGridChoiceTone}")
                .contains("selGridAppendConfiguredCellIcon(")
                .contains("selGridRecord, selGridBadge")
                .contains("function selGridUpdateRecord(")
                .contains("updateRecord: selGridUpdateRecord")
                .contains("selGridColumn.cellIconTone")
                .contains("selgrid-record-cell-icon-${selGridIconTone}")
                .contains("selGridView.tableScroller.scrollLeft = selGridPreviousScrollLeft")
                .contains("?.focus({ preventScroll: true })");
        assertThat(resource("/META-INF/resources/sel/components/grid/selGrid.css"))
                .contains(".selgrid-record-cell-icon-success")
                .contains(".selgrid-record-cell-icon-danger")
                .contains(".selgrid-record-choice-danger")
                .contains("var(--sel-theme-semantic-success)")
                .contains("var(--sel-theme-semantic-error)");
        assertThat(resource("/static/japanese/japanese.css"))
                .contains("button.is-running i")
                .contains("background: var(--sel-theme-semantic-progress)")
                .contains("japanese-generation-pulse");
        assertThat(script)
                .contains("const buttons = new Set(japaneseState.generationView?.querySelectorAll")
                .contains("if (activeButton) buttons.add(activeButton)")
                .contains("else if (!busy)")
                .contains("button.removeAttribute(\"aria-busy\")")
                .contains("delete button.dataset.idleLabel");
        assertThat(resource("/static/japanese/japanese.html"))
                .contains("japanese.js?v=20260817-deep-translator-1");
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
                .contains("\"fieldName\":\"nextRound\"")
                .contains("\"fieldName\":\"optionA\"")
                .contains("\"fieldName\":\"optionB\"")
                .contains("\"fieldName\":\"optionC\"")
                .contains("\"fieldName\":\"optionD\"")
                .contains("\"fieldName\":\"correctOption\"")
                .contains("\"visible\":false")
                .contains("\"fieldName\":\"correctCount\"")
                .contains("\"fieldName\":\"wrongCount\"")
                .doesNotContain("\"fieldName\":\"imageState\"")
                .doesNotContain("\"fieldName\":\"keyword\"")
                .contains("\"triggerControlCode\":\"selWindowJapaneseN2BlueBookQuestionId\"")
                .contains("\"legacyNodeValue\":\"READING\"");
        assertThat(resource("/static/japanese/japanese.css"))
                .contains(".japanese-toolbar-save-host")
                .contains("display: inline-block");
        assertThat(resource("/META-INF/resources/sel/components/personalization/selPersonalization.js"))
                .contains("document.createElement(\"button\")")
                .contains("`调整${selPersonalizationPageControl.title}宽度`")
                .doesNotContain("selPersonalizationEditFrame.setAttribute(\"aria-hidden\"");
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
     * 真实返回示例：题库编排进入业务 Service，翻译、Codex、语音和媒体进入分类共通工具。
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
        assertThat(root.resolve(
                "n2questionanswerround/service/JapaneseN2QuestionAnswerRoundService.java"))
                .isRegularFile();
        assertThat(root.resolve(
                "n2questionanswerrecord/service/JapaneseN2QuestionAnswerRecordService.java"))
                .isRegularFile();
        assertThat(root.resolve(
                "n2questionanswerrecord/service/JapaneseN2QuestionAnswerRecordService.java"))
                .isRegularFile();
        assertThat(root.resolve("learningprogress")).doesNotExist();
        assertThat(root.resolve("n2bluebookquestion/reference")).doesNotExist();
        assertThat(root.resolve(
                "n2bluebookquestion/service/JapaneseQuestionContentService.java"))
                .doesNotExist();
        assertThat(root.resolve(
                "n2bluebookquestion/service/impl/JapaneseQuestionContentServiceImpl.java"))
                .doesNotExist();
        assertThat(root.resolve("common/util/codex/CodexCliUtil.java"))
                .isRegularFile();
        assertThat(root.resolve("common/util/translation/DeepTranslatorUtil.java"))
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
