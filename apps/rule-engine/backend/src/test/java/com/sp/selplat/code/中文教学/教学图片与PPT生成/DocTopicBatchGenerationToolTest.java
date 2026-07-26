package com.sp.selplat.code.中文教学.教学图片与PPT生成;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 验证核定版表格解析、审校内容约束、分目录命名和 JPG 输出结构。
 */
class DocTopicBatchGenerationToolTest {

    @TempDir
    Path temporaryDirectory;

    /**
     * 验证一首核定版古诗能按源文件名建立目录并生成标准尺寸图片。
     *
     * @throws Exception DOCX、JSON 或图片读写失败
     */
    @Test
    void shouldParseFinalizedPoemAndGenerateImageInSourceDirectory() throws Exception {
        // 业务上构造与真实核定版一致的“标题、署名、正文表格”最小 DOCX。
        Path source = temporaryDirectory.resolve("小学古诗核定版.docx");
        createPoetryDocx(source);
        // 业务上故事内容通过外部 JSON 提供，测试不允许渲染器自行拼接占位文案。
        Path topicData = temporaryDirectory.resolve("topics.json");
        // 业务上创建与审校 JSON 同目录的主题插画，验证相对路径能跨平台稳定解析。
        createIllustration(temporaryDirectory.resolve("illustration.png"));
        Files.writeString(topicData, validTopicJson(), StandardCharsets.UTF_8);
        Path outputRoot = temporaryDirectory.resolve("output");
        DocTopicBatchGenerationTool.GenerationRequest request = new DocTopicBatchGenerationTool.GenerationRequest(
            source,
            null,
            outputRoot,
            topicData,
            0,
            false,
            DocTopicBatchGenerationTool.MissingContentPolicy.FAIL
        );
        // 业务上执行正式生成路径，覆盖解析、内容匹配、目录隔离和图片写出。
        DocTopicBatchGenerationTool.GenerationSummary summary = DocTopicBatchGenerationTool.generate(request);
        assertEquals(1, summary.sourceCount());
        assertEquals(1, summary.imageCount());
        Path target = outputRoot.resolve("小学古诗核定版/001_咏鹅.jpg");
        assertTrue(Files.isRegularFile(target));
        // 业务上重新解码交付图片，验证扩展名、编码和参考图尺寸真实一致。
        BufferedImage image = ImageIO.read(target.toFile());
        assertEquals(DocTopicImageRenderer.WIDTH, image.getWidth());
        assertEquals(DocTopicImageRenderer.HEIGHT, image.getHeight());
        // 业务上再次解析源文件，确认输出动作没有改变核定内容。
        List<DocTopicPoem> poems = PinyinPoetryDocxParser.parse(source);
        assertEquals("咏鹅", poems.get(0).title());
        assertEquals("唐", poems.get(0).dynasty());
        assertEquals("骆宾王", poems.get(0).author());
        assertEquals("鹅，鹅，鹅，", poems.get(0).lines().get(0).text());
    }

    /**
     * 验证缺少审校故事内容时默认失败，不能生成虚构栏目。
     *
     * @throws Exception 测试文件读写失败
     */
    @Test
    void shouldFailWhenReviewedTopicContentIsMissing() throws Exception {
        // 业务上源 DOCX 仍包含咏鹅，但 JSON 只提供其它篇名，稳定复现缺内容边界。
        Path source = temporaryDirectory.resolve("缺内容核定版.docx");
        createPoetryDocx(source);
        Path topicData = temporaryDirectory.resolve("missing-topics.json");
        Files.writeString(
            topicData,
            validTopicJson().replace("咏鹅", "江南"),
            StandardCharsets.UTF_8
        );
        DocTopicBatchGenerationTool.GenerationRequest request = new DocTopicBatchGenerationTool.GenerationRequest(
            source,
            null,
            temporaryDirectory.resolve("missing-output"),
            topicData,
            0,
            false,
            DocTopicBatchGenerationTool.MissingContentPolicy.FAIL
        );
        // 业务上断言错误直接包含缺失篇名，方便批量任务补充对应 JSON。
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> DocTopicBatchGenerationTool.generate(request)
        );
        assertTrue(exception.getMessage().contains("咏鹅"));
    }

    /**
     * 验证审校 JSON 指定的插画缺失时失败，不能退化成无配图成品。
     *
     * @throws Exception 测试文件读写失败
     */
    @Test
    void shouldFailWhenReviewedIllustrationIsMissing() throws Exception {
        // 业务上构造有效诗文和内容，但故意不创建 JSON 所指向的插画文件。
        Path source = temporaryDirectory.resolve("缺插画核定版.docx");
        createPoetryDocx(source);
        Path topicData = temporaryDirectory.resolve("missing-illustration.json");
        Files.writeString(topicData, validTopicJson(), StandardCharsets.UTF_8);
        DocTopicBatchGenerationTool.GenerationRequest request = new DocTopicBatchGenerationTool.GenerationRequest(
            source,
            null,
            temporaryDirectory.resolve("missing-illustration-output"),
            topicData,
            0,
            false,
            DocTopicBatchGenerationTool.MissingContentPolicy.FAIL
        );
        // 业务上异常应直接报告主题插画，方便批量素材准备阶段定位缺图篇目。
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> DocTopicBatchGenerationTool.generate(request)
        );
        assertTrue(exception.getMessage().contains("主题插画"));
    }

    /**
     * 验证跨平台目录和图片命名会替换非法字符并保留中文。
     */
    @Test
    void shouldSanitizeCrossPlatformFileName() {
        // 业务上冒号、斜杠和星号必须替换，避免 Windows 批处理写出失败。
        assertEquals("古诗_核定_版", DocTopicBatchGenerationTool.sanitizeFileName("古诗:核定/版"));
        assertEquals("教材.核定版", DocTopicBatchGenerationTool.baseName("教材.核定版.docx"));
    }

    /**
     * 验证跨平台输出使用随工程分发的中文文楷，而不是退化为默认对话框字体。
     */
    @Test
    void shouldLoadBundledChineseDisplayFont() {
        // 业务上字体族名称必须来自 LXGW 资源，确保 Windows 与 macOS 的标题和正文视觉一致。
        assertTrue(DocTopicImageRenderer.displayFontFamily().toLowerCase().contains("lxgw"));
    }

    /**
     * 创建最小核定版表格 DOCX。
     */
    private void createPoetryDocx(Path target) throws Exception {
        try (XWPFDocument document = new XWPFDocument()) {
            // 业务上标题和署名分别使用独立逐字表格，与真实生成器结构一致。
            addAnnotatedTable(document, new String[] {"yǒng", "é"}, new String[] {"咏", "鹅"});
            addAnnotatedTable(
                document,
                new String[] {"", "táng", "", "luò", "bīn", "wáng"},
                new String[] {"【", "唐", "】", "骆", "宾", "王"}
            );
            // 业务上四行正文覆盖汉字、带调拼音和无拼音标点。
            addAnnotatedTable(
                document,
                new String[] {"é", "", "é", "", "é", ""},
                new String[] {"鹅", "，", "鹅", "，", "鹅", "，"}
            );
            addAnnotatedTable(
                document,
                new String[] {"qū", "xiàng", "xiàng", "tiān", "gē", ""},
                new String[] {"曲", "项", "向", "天", "歌", "。"}
            );
            addAnnotatedTable(
                document,
                new String[] {"bái", "máo", "fú", "lǜ", "shuǐ", ""},
                new String[] {"白", "毛", "浮", "绿", "水", "，"}
            );
            addAnnotatedTable(
                document,
                new String[] {"hóng", "zhǎng", "bō", "qīng", "bō", ""},
                new String[] {"红", "掌", "拨", "清", "波", "。"}
            );
            try (var outputStream = Files.newOutputStream(target)) {
                // 业务上写成真实 OOXML 包，测试覆盖 POI 主文档表格读取路径。
                document.write(outputStream);
            }
        }
    }

    /**
     * 添加一个拼音在上、汉字在下的单行表格。
     */
    private void addAnnotatedTable(XWPFDocument document, String[] pinyin, String[] text) {
        // 业务上测试数据也执行逐字数量检查，防止无效 fixture 掩盖解析错误。
        assertEquals(pinyin.length, text.length);
        XWPFTable table = document.createTable(1, text.length);
        for (int index = 0; index < text.length; index++) {
            XWPFTableCell cell = table.getRow(0).getCell(index);
            // 业务上单元格第一段写拼音，第二段写原字，保持核定版正式约定。
            cell.getParagraphs().get(0).createRun().setText(pinyin[index]);
            cell.addParagraph().createRun().setText(text[index]);
        }
    }

    /**
     * 创建测试专用的可解码主题插画。
     */
    private void createIllustration(Path target) throws Exception {
        // 业务上使用真实 PNG 而非空文件，确保测试覆盖 ImageIO 解码和 Java2D 合成路径。
        BufferedImage illustration = new BufferedImage(320, 240, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < illustration.getHeight(); y++) {
            for (int x = 0; x < illustration.getWidth(); x++) {
                // 业务上使用稳定浅绿色像素模拟水墨底色，不依赖测试机器字体或外部资源。
                illustration.setRGB(x, y, 0xDDE8D5);
            }
        }
        ImageIO.write(illustration, "png", target.toFile());
    }

    /**
     * 返回完整且可审校的最小故事 JSON。
     */
    private String validTopicJson() {
        // 业务上所有正式栏目均提供非空内容，测试只关注结构而不依赖长篇文案。
        return """
            {
              "topics": {
                "咏鹅": {
                  "story": ["孩子在池塘边看见白鹅游水。"],
                  "interpretation": ["诗歌从声音、颜色和动作描写白鹅。"],
                  "coreIdeas": ["细心观察自然。"],
                  "lifeTips": ["写作时使用准确动词。"],
                  "footer": "在观察中发现诗意。",
                  "illustration": "illustration.png",
                  "studyIllustration": "illustration.png"
                }
              }
            }
            """;
    }
}
