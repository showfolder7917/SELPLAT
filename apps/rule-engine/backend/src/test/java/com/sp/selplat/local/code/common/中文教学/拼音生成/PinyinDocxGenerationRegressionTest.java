package com.sp.selplat.local.code.common.中文教学.拼音生成;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
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
class PinyinDocxGenerationRegressionTest {

    @TempDir
    Path temporaryDirectory;

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
            assertFalse(document.getDocument().xmlText().contains("EQ \\* jc0"));
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
