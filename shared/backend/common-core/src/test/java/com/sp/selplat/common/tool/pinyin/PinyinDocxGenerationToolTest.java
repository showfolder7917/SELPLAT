package com.sp.selplat.common.tool.pinyin;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 验证通用拼音生成器的原文保护、纠音优先级和 DOCX 结构。
 */
class PinyinDocxGenerationToolTest {

    @TempDir
    Path temporaryDirectory;

    /**
     * 验证长词纠音优先于单字规则，且原文和标点不变。
     */
    @Test
    void shouldApplyLongestPhraseOverrideWithoutChangingOriginalText() {
        // 业务上同时配置单字和更长词组，验证古文上下文规则优先于通用短规则。
        PinyinTextConverter converter = new PinyinTextConverter(Map.of(
            "长", List.of("cháng"),
            "长幼", List.of("zhǎng", "yòu")
        ));
        // 业务上转换包含标点的完整短句，确保纠音不会删除或移动原文符号。
        List<PinyinTextConverter.PinyinCell> cells = converter.convert("长幼序。");
        assertEquals("zhǎng", cells.get(0).pinyin());
        assertEquals("yòu", cells.get(1).pinyin());
        assertEquals("", cells.get(3).pinyin());
        // 业务上重新拼接全部单元，验证生成前的文字映射严格保持原文。
        String reconstructed = cells.stream()
            .map(PinyinTextConverter.PinyinCell::text)
            .reduce("", String::concat);
        assertEquals("长幼序。", reconstructed);
    }

    /**
     * 验证朗读教学模式应用“一、不”变调，并允许词典覆盖序数等例外。
     */
    @Test
    void shouldApplyReadingSandhiBeforeDocumentOverrides() {
        // 业务上覆盖“第一”保持序数本调，同时让普通“一日、不复”按后字声调标写。
        PinyinTextConverter converter = new PinyinTextConverter(Map.of(
            "第一", List.of("dì", "yī")
        ));
        List<PinyinTextConverter.PinyinCell> cells = converter.convert("第一，一日不复。");
        // 业务上序数“一”必须保留 yī，不能被通用变调误改。
        assertEquals("yī", cells.get(1).pinyin());
        // 业务上“一日”后接四声，朗读版写作 yí rì。
        assertEquals("yí", cells.get(3).pinyin());
        // 业务上“不复”后接四声，朗读版写作 bú fù。
        assertEquals("bú", cells.get(5).pinyin());
    }

    /**
     * 验证词组与音节数不一致时拒绝加载纠音词典。
     *
     * @throws Exception 测试词典写入失败
     */
    @Test
    void shouldRejectDictionaryWithMismatchedSyllableCount() throws Exception {
        // 业务上构造音节不足的词条，验证错误纠音不会进入正式文档生成流程。
        Path dictionary = temporaryDirectory.resolve("invalid.tsv");
        Files.writeString(dictionary, "长幼\tzhǎng\n", StandardCharsets.UTF_8);
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> PinyinTextConverter.loadOverrides(dictionary)
        );
        assertTrue(exception.getMessage().contains("音节数不匹配"));
    }

    /**
     * 验证普通文档使用单行组合表格渲染，并保留原文标点。
     *
     * @throws Exception DOCX 测试文件读写失败
     */
    @Test
    void shouldRenderSingleRowStackedTablesAndKeepPunctuation() throws Exception {
        // 业务上用最小标题和正文生成实际 DOCX，覆盖标题、汉字、标点和不可拆分页的组合结构。
        Path target = temporaryDirectory.resolve("generated.docx");
        PinyinTextConverter converter = new PinyinTextConverter(Map.of(
            "三字经", List.of("sān", "zì", "jīng"),
            "人之初", List.of("rén", "zhī", "chū")
        ));
        PinyinDocxRenderer renderer = new PinyinDocxRenderer(PinyinGenerationConfig.daodejingStyle());
        PinyinDocxRenderer.GenerationResult result = renderer.render(
            List.of("三 字 经", "人之初，"),
            target,
            converter,
            false
        );
        assertTrue(Files.isRegularFile(target));
        assertEquals(2, result.paragraphCount());
        // 业务上重新打开输出，确认每个正文段落对应且仅对应一个组合行表格。
        try (InputStream inputStream = Files.newInputStream(target);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            assertEquals(1, document.getTables().size());
            assertEquals(1, document.getTables().get(0).getRows().size());
            assertEquals("人之初，", document.getTables().get(0).getRow(0).getTableCells().stream()
                .map(cell -> cell.getParagraphs().get(1).getText())
                .reduce("", String::concat));
            // 业务上生成 XML 不得包含旧 EQ 域指令，防止 WPS 或 Word 显示域代码乱码。
            assertFalse(document.getDocument().xmlText().contains("EQ \\* jc0"));
        }
    }

    /**
     * 验证即使允许覆盖，生成器也不得把目标指向源文档。
     *
     * @throws Exception 测试源 DOCX 写入失败
     */
    @Test
    void shouldRejectSourceAndTargetUsingSamePath() throws Exception {
        // 业务上创建真实 DOCX 源文件，验证覆盖参数也不能绕过原版保护。
        Path source = temporaryDirectory.resolve("source.docx");
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("三字经");
            try (var outputStream = Files.newOutputStream(source)) {
                document.write(outputStream);
            }
        }
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> PinyinDocxGenerationTool.generate(source, source, null, true, false)
        );
        assertTrue(exception.getMessage().contains("不能与源文件相同"));
    }

    /**
     * 验证诗词解析可过滤目录，并规范化朝代、作者与教材标签。
     *
     * @throws Exception 测试诗词 DOCX 读写失败
     */
    @Test
    void shouldParsePoetryBodyAndNormalizeDynastyAuthor() throws Exception {
        // 业务上构造包含目录、分册、常规署名和特殊署名的最小教材文档，覆盖真实源文件的边界差异。
        Path source = temporaryDirectory.resolve("poetry-source.docx");
        try (XWPFDocument document = new XWPFDocument()) {
            addParagraph(document, "一年级上册目录");
            addParagraph(document, "咏鹅");
            addParagraph(document, "1");
            addParagraph(document, "一年级上册：");
            addParagraph(document, "咏 鹅");
            addParagraph(document, "【唐】骆 宾 王★课标必背");
            addParagraph(document, "鹅，鹅，鹅，");
            addParagraph(document, "曲项向天歌。");
            addParagraph(document, "");
            addParagraph(document, "江南");
            addParagraph(document, "汉乐府★课标必背");
            addParagraph(document, "江南可采莲，");
            addParagraph(document, "悯农（其一）★课标必背");
            addParagraph(document, "【唐】李绅");
            addParagraph(document, "春种一粒粟。");
            try (var outputStream = Files.newOutputStream(source)) {
                // 业务上写成真实 DOCX，确保测试覆盖 POI 主文档段落读取路径。
                document.write(outputStream);
            }
        }
        List<PoetryDocumentParser.Poem> poems = PoetryDocumentParser.parse(source);
        assertEquals(3, poems.size());
        assertEquals("咏鹅", poems.get(0).title());
        assertEquals("唐", poems.get(0).dynasty());
        assertEquals("骆宾王", poems.get(0).author());
        assertEquals(List.of("鹅，鹅，鹅，", "曲项向天歌。"), poems.get(0).lines());
        assertEquals("【汉】乐府", poems.get(1).attribution());
        assertEquals(List.of("江南可采莲，"), poems.get(1).lines());
        assertEquals("悯农（其一）", poems.get(2).title());
    }

    /**
     * 验证初中古诗词可识别七至九年级、反向署名、标签隔开的署名和同段标题署名。
     *
     * @throws Exception 测试 DOCX 读写失败
     */
    @Test
    void shouldParseJuniorPoetryMetadataVariants() throws Exception {
        Path source = temporaryDirectory.resolve("junior-poetry-source.docx");
        try (XWPFDocument document = new XWPFDocument()) {
            // 业务上目录项不应进入正文，正文从七年级分册标题开始。
            addParagraph(document, "七年级上册目录");
            addParagraph(document, "七年级上册：");
            addParagraph(document, "梅岭三章");
            addParagraph(document, "陈毅【近现代】");
            addParagraph(document, "断头今日意如何？创业艰难百战多。");
            addParagraph(document, "登幽州台歌");
            addParagraph(document, "★课标必背+★课后必背");
            addParagraph(document, "【唐】陈子昂");
            addParagraph(document, "前不见古人，后不见来者。");
            addParagraph(document, "破阵子·为陈同甫赋壮词以寄之 【宋】辛弃疾");
            addParagraph(document, "醉里挑灯看剑，梦回吹角连营。");
            addParagraph(document, "月夜");
            addParagraph(document, "更深月色半人家，北斗阑干南斗斜。");
            try (var outputStream = Files.newOutputStream(source)) {
                // 业务上真实写出 DOCX，覆盖 POI 读取和边界状态机。
                document.write(outputStream);
            }
        }
        List<PoetryDocumentParser.Poem> poems = PoetryDocumentParser.parse(source);
        assertEquals(4, poems.size());
        assertEquals("【近现代】陈毅", poems.get(0).attribution());
        assertEquals("【唐】陈子昂", poems.get(1).attribution());
        assertEquals("破阵子·为陈同甫赋壮词以寄之", poems.get(2).title());
        assertEquals("【宋】辛弃疾", poems.get(2).attribution());
        assertEquals("【唐】刘方平", poems.get(3).attribution());
    }

    /**
     * 验证诗词渲染保留朝代作者，并为每首诗建立独立页结构。
     *
     * @throws Exception 诗词 DOCX 生成或重读失败
     */
    @Test
    void shouldRenderOnePoemPerPageWithDynastyVisible() throws Exception {
        // 业务上使用两首最小诗词验证标题、朝代作者、正文和硬分页均进入稳定表格结构。
        Path target = temporaryDirectory.resolve("poetry-generated.docx");
        List<PoetryDocumentParser.Poem> poems = List.of(
            new PoetryDocumentParser.Poem("静夜思", "唐", "李白", List.of("床前明月光。")),
            new PoetryDocumentParser.Poem("梅花", "宋", "王安石", List.of("墙角数枝梅。"))
        );
        PoetryDocxRenderer renderer = new PoetryDocxRenderer(PinyinGenerationConfig.daodejingStyle());
        PoetryDocxRenderer.GenerationResult result = renderer.render(
            poems,
            target,
            new PinyinTextConverter(Map.of()),
            false
        );
        assertEquals(2, result.poemCount());
        try (InputStream inputStream = Files.newInputStream(target);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            // 业务上每首诗包含标题、朝代作者和一行正文，共应生成六个无边框注音表格。
            assertEquals(6, document.getTables().size());
            String allText = document.getTables().stream()
                .flatMap(table -> table.getRows().stream())
                .flatMap(row -> row.getTableCells().stream())
                .map(cell -> cell.getParagraphs().get(1).getText())
                .reduce("", String::concat);
            assertTrue(allText.contains("【唐】李白"));
            assertTrue(allText.contains("【宋】王安石"));
            // 业务上第二首诗使用段前分页，避免前一首自然满页时叠加出纯空白页。
            assertEquals(1, document.getParagraphs().stream().filter(XWPFParagraph::isPageBreak).count());
            // 业务上不再生成运行内换页符，分页边界只由下一篇首段承担。
            assertFalse(document.getDocument().xmlText().contains("w:type=\"page\""));
            assertFalse(document.getDocument().xmlText().contains("EQ \\* jc0"));
        }
    }

    /**
     * 验证文言文解析可处理目录、无署名节选、篇尾来源和长段拆行。
     *
     * @throws Exception 测试 DOCX 读写失败
     */
    @Test
    void shouldParseClassicalChineseAndWrapLongParagraphs() throws Exception {
        Path source = temporaryDirectory.resolve("classical-source.docx");
        try (XWPFDocument document = new XWPFDocument()) {
            // 业务上构造与真实汇总文档一致的目录和分册边界，验证目录不会进入文章。
            addParagraph(document, "一年级下册目录");
            addParagraph(document, "一年级下册：");
            addParagraph(document, "《弟子规·谨》（节选）");
            addParagraph(document, "冠必正，纽必结。袜与履，俱紧切。置冠服，有定位。");
            addParagraph(document, "五年级上册：");
            addParagraph(document, "古人谈读书（一）★课后必背");
            addParagraph(document, "知之为知之，不知为不知，是知也。敏而好学，不耻下问。");
            addParagraph(document, "——《论语》");
            try (var outputStream = Files.newOutputStream(source)) {
                // 业务上写成真实 DOCX，覆盖 POI 主文档解析链而不是只测字符串工具。
                document.write(outputStream);
            }
        }
        List<ClassicalChineseDocumentParser.Article> articles = ClassicalChineseDocumentParser.parse(source);
        assertEquals(2, articles.size());
        assertEquals("清", articles.get(0).dynasty());
        assertEquals("李毓秀", articles.get(0).author());
        assertEquals("先秦", articles.get(1).dynasty());
        assertEquals("《论语》", articles.get(1).author());
        // 业务上长文显示行不超过 16 个码点，篇内字符顺序与原文完全一致。
        List<String> lines = articles.get(1).displayLines(16);
        assertTrue(lines.stream().allMatch(line -> line.codePointCount(0, line.length()) <= 16));
        assertEquals(articles.get(1).paragraphs().get(0), String.join("", lines));
        // 业务上显示拆行不能把“一、不”留在行末，否则下一行后字无法参与朗读变调。
        ClassicalChineseDocumentParser.Article boundaryArticle = new ClassicalChineseDocumentParser.Article(
            "边界",
            "先秦",
            "佚名",
            List.of("甲乙丙丁戊己庚辛壬癸子丑寅卯无不陷也。")
        );
        assertTrue(boundaryArticle.displayLines(16).stream().noneMatch(line -> line.endsWith("不")));
    }

    /**
     * 验证初中文言文可过滤篇目容器并识别典籍、作者和同段标题作者。
     *
     * @throws Exception 测试 DOCX 读写失败
     */
    @Test
    void shouldParseJuniorClassicalChineseStructures() throws Exception {
        Path source = temporaryDirectory.resolve("junior-classical-source.docx");
        try (XWPFDocument document = new XWPFDocument()) {
            addParagraph(document, "七年级上册：");
            addParagraph(document, "《世说新语·咏雪》");
            addParagraph(document, "谢太傅寒雪日内集，与儿女讲论文义。");
            addParagraph(document, "八年级上册：");
            addParagraph(document, "《孟子》三章");
            addParagraph(document, "得道多助，失道寡助");
            addParagraph(document, "天时不如地利，地利不如人和。");
            addParagraph(document, "马说 韩愈");
            addParagraph(document, "世有伯乐，然后有千里马。");
            try (var outputStream = Files.newOutputStream(source)) {
                // 业务上真实写出多分册 DOCX，验证容器标题不会形成空文章。
                document.write(outputStream);
            }
        }
        List<ClassicalChineseDocumentParser.Article> articles = ClassicalChineseDocumentParser.parse(source);
        assertEquals(3, articles.size());
        assertEquals("【南朝宋】刘义庆", articles.get(0).toRenderableWork().attribution());
        assertEquals("【先秦】《孟子》", articles.get(1).toRenderableWork().attribution());
        assertEquals("马说", articles.get(2).title());
        assertEquals("唐", articles.get(2).dynasty());
        assertEquals("韩愈", articles.get(2).author());
    }

    /**
     * 验证长文先完成整段纠音再拆行，跨 16 字边界的词条仍能生效。
     *
     * @throws Exception DOCX 生成和读取失败
     */
    @Test
    void shouldApplyOverrideBeforeWrappingLongClassicalLine() throws Exception {
        Path target = temporaryDirectory.resolve("wrapped-classical.docx");
        String longLine = "甲乙丙丁戊己庚辛壬癸子丑寅卯无不陷也。";
        PoetryDocxRenderer renderer = new PoetryDocxRenderer(PinyinGenerationConfig.daodejingStyle());
        renderer.render(
            List.of(new PoetryDocumentParser.Poem("边界", "先秦", "佚名", List.of(longLine))),
            target,
            new PinyinTextConverter(Map.of("无不陷", List.of("wú", "bú", "xiàn"))),
            false
        );
        try (InputStream inputStream = Files.newInputStream(target);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            // 业务上长正文应拆成至少两行，但“不”的最终拼音仍来自跨边界完整词条。
            assertTrue(document.getTables().size() >= 4);
            String pinyin = document.getTables().stream()
                .flatMap(table -> table.getRows().stream())
                .flatMap(row -> row.getTableCells().stream())
                .map(cell -> cell.getParagraphs().get(0).getText())
                .reduce("", (left, right) -> left + " " + right);
            assertTrue(pinyin.contains("bú"));
        }
    }

    /**
     * 向测试 DOCX 追加一个正文段落。
     *
     * @param document 测试文档
     * @param text 段落文本
     */
    private static void addParagraph(XWPFDocument document, String text) {
        // 业务上使用与教材正文相同的普通段落结构，测试不依赖特定样式名。
        document.createParagraph().createRun().setText(text);
    }
}
