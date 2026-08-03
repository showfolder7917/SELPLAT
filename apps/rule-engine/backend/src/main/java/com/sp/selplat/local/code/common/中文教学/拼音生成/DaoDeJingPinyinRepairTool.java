/** 中文教学拼音工具归入中文教学模块，避免被误认为 Fujitsu 业务实现。 */
package com.sp.selplat.local.code.common.中文教学.拼音生成;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.poifs.filesystem.DirectoryEntry;
import org.apache.poi.poifs.filesystem.DocumentEntry;
import org.apache.poi.poifs.filesystem.DocumentInputStream;
import org.apache.poi.poifs.filesystem.Entry;
import org.apache.poi.poifs.filesystem.POIFSFileSystem;

/**
 * 道德经注音版旧版 DOC 定点修复工具。
 *
 * <p>业务上这个文档不是普通 ruby 注音，而是依赖 Word/WPS 的 EQ 域来叠加拼音。
 * 因此本工具直接在 OLE 的 WordDocument 主流里做 UTF-16LE 定点替换，避免通过 doc/docx 转换链破坏整篇域结构。
 */
public class DaoDeJingPinyinRepairTool {

    /** 业务上项目根目录作为默认基准路径，便于在仓库里直接运行 main。 */
    private static final Path PROJECT_ROOT = detectProjectRoot();

    /** 业务上原版文档固定作为恢复源，保证每次修复都从未损坏版本起步。 */
    private static final Path DEFAULT_ORIGINAL_DOC =
        PROJECT_ROOT.resolve("OPTION/原版/道德经（注音版）.doc").normalize();

    /** 业务上当前文档固定作为默认输出目标，方便工具直接覆盖用户正在使用的文件。 */
    private static final Path DEFAULT_TARGET_DOC =
        PROJECT_ROOT.resolve("OPTION/道德经（注音版）.doc").normalize();

    /** 业务上这个控制字符表示一个 Word 域开始，EQ 域片段必须原样保留。 */
    private static final String FIELD_BEGIN = "\u0013";

    /** 业务上这个控制字符表示一个 Word 域结束，EQ 域片段必须原样保留。 */
    private static final String FIELD_END = "\u0015";

    /** 业务上主文本与注音字段集中落在 WordDocument 主流，因此修复只改这个流。 */
    private static final String WORD_DOCUMENT_STREAM = "WordDocument";

    /** 业务上 docx 注音文本集中落在这个 XML 内，因此 docx 修复只改这一处正文载体。 */
    private static final String DOCX_DOCUMENT_XML = "word/document.xml";

    /** 业务上异常转换后的拼音公式仍保留完整文本，本表达式负责提取字号、拼音和对应汉字。 */
    private static final Pattern FLATTENED_EQ_PATTERN = Pattern.compile(
        Pattern.quote("EQ \\* jc0 \\* \"Font:Arial\" \\* hps")
            + "(\\d+)"
            + Pattern.quote(" \\o(\\s\\up 11(")
            + "([^)]*)"
            + Pattern.quote("),")
            + "([^)]*)"
            + Pattern.quote(")"));

    /** 业务上正文按段落独立重建，避免注音替换跨越段落边界并破坏分页布局。 */
    private static final Pattern DOCX_PARAGRAPH_PATTERN = Pattern.compile("<w:p(?: [^>]*)?>.*?</w:p>", Pattern.DOTALL);

    /** 业务上段落属性必须原样保留，继续沿用原文的居中、缩进与段前段后距离。 */
    private static final Pattern DOCX_PARAGRAPH_PROPERTIES_PATTERN = Pattern.compile("<w:pPr(?: [^>]*)?>.*?</w:pPr>", Pattern.DOTALL);

    /** 业务上异常公式被拆在多个文本运行中，因此重建前需要按文档顺序汇总每个文本节点。 */
    private static final Pattern DOCX_TEXT_PATTERN = Pattern.compile("<w:t(?: [^>]*)?>(.*?)</w:t>", Pattern.DOTALL);

    /** 业务上原文显式分页必须完整继承，确保八十一章仍按原来的页面边界展开。 */
    private static final Pattern DOCX_PAGE_BREAK_PATTERN = Pattern.compile("<w:br w:type=\"page\"/>");

    /** 业务上当前兼容版用这个标题标记识别已生成的注音表格，从而允许后续只重排不改字。 */
    private static final String PINYIN_TABLE_CAPTION = "<w:tblCaption w:val=\"拼音正文\"/>";

    /** 业务上每章之间使用统一分页段，纯排版重组按这个硬边界切分八十一章。 */
    private static final String PAGE_BREAK_PARAGRAPH = "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";

    /** 业务上 WPS 对表格后的 br 分页兼容不稳定，最终输出改用下一章段前强制分页。 */
    private static final String CHAPTER_PAGE_BREAK_PARAGRAPH =
        "<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:rPr><w:sz w:val=\"2\"/><w:sz-cs w:val=\"2\"/></w:rPr>"
            + "<w:t xml:space=\"preserve\"> </w:t></w:r></w:p>";

    /** 业务上已生成的表格需要先还原成拼音单元，才能按旧版宽行重新分组。 */
    private static final Pattern DOCX_TABLE_PATTERN = Pattern.compile("<w:tbl>.*?</w:tbl>", Pattern.DOTALL);

    /** 业务上每个注音表格固定两行，本表达式分别读取拼音行与汉字行。 */
    private static final Pattern DOCX_TABLE_ROW_PATTERN = Pattern.compile("<w:tr>.*?</w:tr>", Pattern.DOTALL);

    /** 业务上每列对应一个拼音与汉字单元，本表达式按列提取单元内容。 */
    private static final Pattern DOCX_TABLE_CELL_PATTERN = Pattern.compile("<w:tc>.*?</w:tc>", Pattern.DOTALL);

    /** 业务上拼音字号区分总标题、章名和正文，重排时据此恢复对应留白层级。 */
    private static final Pattern DOCX_PINYIN_SIZE_PATTERN = Pattern.compile("<w:noProof/><w:sz w:val=\"(\\d+)\"/>");

    /** 业务上汉字字号稳定保存标题层级，拼音缩小显示后仍可据此恢复原始排版角色。 */
    private static final Pattern DOCX_TEXT_SIZE_PATTERN = Pattern.compile("<w:sz w:val=\"(\\d+)\"/>");

    /** 业务上 docx 版本按已验证过的 8 条锚点正则替换，避免继续依赖不稳定的格式推导。 */
    private static final List<DocxTextRule> DOCX_TEXT_RULES = List.of(
        new DocxTextRule(
            "第二十六章-万乘",
            "<w:t xml:space=\"preserve\">wàn</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),万)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">chéng</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),乘)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">zhī</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),之)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">wáng</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),王)</w:t>",
            "<w:t xml:space=\"preserve\">wàn</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),万)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">shèng</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),乘)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">zhī</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),之)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">wáng</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),王)</w:t>"),
        new DocxTextRule(
            "第四十九章-歙歙",
            "<w:t xml:space=\"preserve\">shè</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),歙)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">shè</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),歙)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">yān</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),焉)</w:t>",
            "<w:t xml:space=\"preserve\">xì</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),歙)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">xì</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),歙)EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11(</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"18\"/><w:sz-cs w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">yān</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),焉)</w:t>"),
        new DocxTextRule(
            "第五十五章-螫",
            "<w:t xml:space=\"preserve\">shì</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),螫)</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"32\"/><w:sz-cs w:val=\"32\"/><w:color w:val=\"222222\"/></w:rPr><w:t xml:space=\"preserve\">，</w:t>",
            "<w:t xml:space=\"preserve\">zhē</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),螫)</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/><w:sz w:val=\"32\"/><w:sz-cs w:val=\"32\"/><w:color w:val=\"222222\"/></w:rPr><w:t xml:space=\"preserve\">，</w:t>")
    );

    /** 业务上剩余 docx 错音仍然适合靠上下文正则锚定，因此保留正则替换通道。 */
    private static final List<DocxRegexRule> DOCX_REGEX_RULES = List.of(
        new DocxRegexRule(
            "第九章-揣",
            Pattern.compile("(>)(chuāi)(</w:t></w:r><w:r><w:rPr>.*?</w:rPr><w:t xml:space=\"preserve\">\\),揣\\)EQ .*?<w:t xml:space=\"preserve\">ér)", Pattern.DOTALL),
            "$1chuǎi$3"),
        new DocxRegexRule(
            "第九章-遗",
            Pattern.compile("(>)(yí)(</w:t></w:r><w:r><w:rPr>.*?</w:rPr><w:t xml:space=\"preserve\">\\),遗\\)EQ .*?<w:t xml:space=\"preserve\">jiù)", Pattern.DOTALL),
            "$1wèi$3"),
        new DocxRegexRule(
            "第二十三章-朝",
            Pattern.compile("(>)(cháo)(</w:t></w:r><w:r><w:rPr>.*?</w:rPr><w:t xml:space=\"preserve\">\\),朝\\)</w:t></w:r><w:r><w:rPr>.*?</w:rPr><w:t xml:space=\"preserve\">，)", Pattern.DOTALL),
            "$1zhāo$3"),
        new DocxRegexRule(
            "第二十章-泊",
            Pattern.compile("(>)(pō)(</w:t></w:r><w:r><w:rPr>.*?</w:rPr><w:t xml:space=\"preserve\">\\),泊\\)EQ .*?<w:t xml:space=\"preserve\">yān)", Pattern.DOTALL),
            "$1bó$3"),
        new DocxRegexRule(
            "第五十五章-虺",
            Pattern.compile("(>)(huī)(</w:t></w:r><w:r><w:rPr>.*?</w:rPr><w:t xml:space=\"preserve\">\\),虺\\)EQ .*?<w:t xml:space=\"preserve\">shé)", Pattern.DOTALL),
            "$1huǐ$3")
    );

    /** 业务上所有定点修复规则都集中维护在这里，后续新增黄标项只需要追加规则。 */
    private static final List<RepairRule> REPAIR_RULES = List.of(
        new RepairRule(
            "第九章-揣",
            eq("chuāi", "揣") + FIELD_END + eq("ér", "而"),
            eq("chuǎi", "揣") + FIELD_END + eq("ér", "而")),
        new RepairRule(
            "第九章-遗",
            eq("zì", "自") + FIELD_END + eq("yí", "遗") + FIELD_END + eq("jiù", "咎"),
            eq("zì", "自") + FIELD_END + eq("wèi", "遗") + FIELD_END + eq("jiù", "咎")),
        new RepairRule(
            "第二十三章-朝",
            eq("zhōng", "终") + FIELD_END + eq("cháo", "朝") + FIELD_END + "，" + eq("bào", "暴"),
            eq("zhōng", "终") + FIELD_END + eq("zhāo", "朝") + FIELD_END + "，" + eq("bào", "暴")),
        new RepairRule(
            "第二十六章-万乘",
            eq("wàn", "万") + FIELD_END + eq("chéng", "乘") + FIELD_END + eq("zhī", "之"),
            eq("wàn", "万") + FIELD_END + eq("shèng", "乘") + FIELD_END + eq("zhī", "之")),
        new RepairRule(
            "第二十章-泊",
            eq("wǒ", "我") + FIELD_END + eq("pō", "泊") + FIELD_END + eq("yān", "焉"),
            eq("wǒ", "我") + FIELD_END + eq("bó", "泊") + FIELD_END + eq("yān", "焉")),
        new RepairRule(
            "第四十九章-歙歙",
            "，" + eq("shè", "歙") + FIELD_END + eq("shè", "歙") + FIELD_END + eq("yān", "焉") + FIELD_END + "，",
            "，" + eq("xì", "歙") + FIELD_END + eq("xì", "歙") + FIELD_END + eq("yān", "焉") + FIELD_END + "，"),
        new RepairRule(
            "第五十五章-虺",
            eq("chài", "虿") + FIELD_END + eq("huī", "虺") + FIELD_END + eq("shé", "蛇"),
            eq("chài", "虿") + FIELD_END + eq("huǐ", "虺") + FIELD_END + eq("shé", "蛇")),
        new RepairRule(
            "第五十五章-螫",
            eq("fú", "弗") + FIELD_END + eq("shì", "螫") + FIELD_END + "，" + eq("jué", "攫"),
            eq("fú", "弗") + FIELD_END + eq("zhē", "螫") + FIELD_END + "，" + eq("jué", "攫"))
    );

    /**
     * 主入口。
     *
     * <p>业务上默认流程是先把当前文档恢复为原版，再执行全部已确认错音的定点修复；
     * 如需改其它文件，可通过命令行覆盖 source/target。
     *
     * @param args 命令行参数。
     * @throws Exception 恢复、修复或校验失败时抛出。
     */
    public static void main(String[] args) throws Exception {
        // 业务上把命令行参数统一解析为键值表，后续扩展修复范围时不需要改 main 签名。
        Map<String, String> arguments = parseArgs(args);
        // 业务上默认恢复源取原版文档，避免继续在已损坏版本上滚动修补。
        Path sourceDoc = Paths.get(arguments.getOrDefault("source", DEFAULT_ORIGINAL_DOC.toString())).normalize();
        // 业务上默认输出目标取当前工作文档，保证用户直接看到修复结果。
        Path targetDoc = Paths.get(arguments.getOrDefault("target", DEFAULT_TARGET_DOC.toString())).normalize();
        // 业务上默认开启 restore，确保每次都是从原版起跑；显式传 false 时才跳过恢复。
        boolean restoreFirst = Boolean.parseBoolean(arguments.getOrDefault("restore", "true"));
        // 业务上默认直接覆盖目标文档，避免生成多个相似副本影响用户判断。
        boolean overwrite = Boolean.parseBoolean(arguments.getOrDefault("overwrite", "true"));
        // 业务上调试模式用于确认旧版 DOC 中真实流分布与编码形态，避免盲改结构。
        boolean debugStreams = Boolean.parseBoolean(arguments.getOrDefault("debugStreams", "false"));

        // 业务上修复前必须先确认原版存在，否则无法保证输出建立在正确基线之上。
        requireFile(sourceDoc, "恢复源文档不存在");
        // 业务上如果不允许覆盖但目标已存在，就立即阻断，防止误写用户文件。
        ensureWritableTarget(targetDoc, overwrite);
        // 业务上恢复开启时先复制原版到目标位置，把上次错误转换留下的损坏彻底清掉。
        if (restoreFirst) {
            copyDocument(sourceDoc, targetDoc);
        } else if (!Files.exists(targetDoc)) {
            // 业务上如果跳过恢复，则目标文件本身必须已经存在，否则没有可修的载体。
            throw new IllegalStateException("目标文档不存在，且本次未开启 restore: " + targetDoc);
        }
        // 业务上流级调试只做只读分析，不进入修复流程，方便先确认底层落点。
        if (debugStreams) {
            dumpStreamMatches(targetDoc);
            return;
        }

        // 业务上根据目标文件扩展名选择匹配的修复通道，保证同一个工具同时支持旧版 doc 和 docx。
        repairDocument(targetDoc);

        // 业务上控制台输出最终落点，方便用户直接确认本次真正写到哪个文件。
        System.out.println("DOC_PINGYIN_REPAIR_COMPLETED -> " + targetDoc);
    }

    /**
     * 按文件类型分派修复逻辑。
     *
     * <p>业务上用户现在既会拿旧版 doc，也会拿 docx，因此入口需要自动判断并走对应实现。
     *
     * @param docPath 待修复文档路径。
     * @throws IOException 读取、替换或写回失败时抛出。
     */
    private static void repairDocument(Path docPath) throws IOException {
        // 业务上统一按文件扩展名选择实现，避免用户每次还要记不同 main 类。
        String lowerCaseName = docPath.getFileName().toString().toLowerCase();
        if (lowerCaseName.endsWith(".docx")) {
            repairDocxPackage(docPath);
            return;
        }
        if (lowerCaseName.endsWith(".doc")) {
            repairWordDocumentStream(docPath);
            return;
        }
        throw new IllegalStateException("暂不支持的文档类型: " + docPath);
    }

    /**
     * 修复 WordDocument 主流。
     *
     * <p>业务上这份旧版 DOC 的 EQ 域拼音正文主要落在 WordDocument 流中，
     * 因此只要对该流做唯一锚点替换并通过 POIFS 回写，就能避开 doc/docx 转换损坏。
     *
     * @param docPath 待修复 DOC 路径。
     * @throws IOException 读取或写回失败时抛出。
     */
    private static void repairWordDocumentStream(Path docPath) throws IOException {
        // 业务上直接打开 OLE 文件系统，以便只改 WordDocument 主流而不改其它目录结构。
        try (POIFSFileSystem fileSystem = new POIFSFileSystem(Files.newInputStream(docPath))) {
            DirectoryEntry root = fileSystem.getRoot();
            // 业务上所有目标拼音片段都在 WordDocument 主流里，因此先把该流完整读入内存。
            DocumentEntry wordDocumentEntry = (DocumentEntry) root.getEntry(WORD_DOCUMENT_STREAM);
            byte[] originalBytes = readDocumentBytes(wordDocumentEntry);
            // 业务上替换前先校验所有旧片段唯一命中，防止误把同音但不同章句一起改掉。
            validateRulesBeforeReplace(originalBytes);
            // 业务上逐条替换目标片段，允许新旧长度不同，由内存字节数组自然扩缩。
            byte[] repairedBytes = applyRules(originalBytes);
            // 业务上替换后再次确认旧片段清零、新片段唯一命中，保证本轮修复闭环成立。
            validateRulesAfterReplace(repairedBytes);
            // 业务上回写前先删除旧流，再按同名新建主流，让 POIFS 自己处理流长度变化。
            wordDocumentEntry.delete();
            root.createDocument(WORD_DOCUMENT_STREAM, new ByteArrayInputStream(repairedBytes));
            // 业务上最终把整个 OLE 文件系统写回目标 DOC，保持其它子流原样不动。
            try (OutputStream outputStream = Files.newOutputStream(docPath)) {
                fileSystem.writeFilesystem(outputStream);
            }
        }
    }

    /**
     * 修复 docx 包内正文 XML。
     *
     * <p>业务上 docx 不再依赖 OLE 主流，而是把正文和 EQ 域文本保存在 zip 包内的 document.xml，
     * 因此这里改成对该 XML 做唯一锚点替换，再把整个包重新写出。
     *
     * @param docxPath 待修复 docx 路径。
     * @throws IOException 读取或写回失败时抛出。
     */
    private static void repairDocxPackage(Path docxPath) throws IOException {
        // 业务上先把原包全部读到内存映射里，后续只替换正文 XML，其它资源保持原样复制。
        Map<String, byte[]> zipEntries = readDocxEntries(docxPath);
        byte[] documentXmlBytes = zipEntries.get(DOCX_DOCUMENT_XML);
        if (documentXmlBytes == null) {
            throw new IllegalStateException("docx 缺少正文 XML: " + docxPath);
        }
        // 业务上 docx 正文 XML 使用 UTF-8 文本表示，因此这里切到字符串级锚点替换。
        String originalXml = new String(documentXmlBytes, StandardCharsets.UTF_8);
        // 业务上已生成可读表格的文档再次运行时只做排版优化，不重复执行错音替换或内容重建。
        if (originalXml.contains(PINYIN_TABLE_CAPTION) && !originalXml.contains("EQ \\* jc0")) {
            String restyledXml = restyleReadableTables(originalXml);
            validateRestyledDocx(originalXml, restyledXml);
            zipEntries.put(DOCX_DOCUMENT_XML, restyledXml.getBytes(StandardCharsets.UTF_8));
            writeDocxEntries(docxPath, zipEntries);
            return;
        }
        validateDocxRulesBeforeReplace(originalXml);
        String repairedXml = applyDocxRules(originalXml);
        validateDocxRulesAfterReplace(repairedXml);
        // 业务上八处错音修正完成后，把整篇扁平 EQ 文本重建为各 Office 软件都能直接显示的双行注音表格。
        String readableXml = rebuildFlattenedEqAsTables(repairedXml);
        // 业务上输出前同时校验异常代码清零与注音数量守恒，防止出现“能打开但缺字”的假修复。
        validateReadableDocx(repairedXml, readableXml);
        // 业务上只替换正文 XML，其它主题、关系和文档属性继续沿用原始包内容。
        zipEntries.put(DOCX_DOCUMENT_XML, readableXml.getBytes(StandardCharsets.UTF_8));
        writeDocxEntries(docxPath, zipEntries);
    }

    /**
     * 对已经可读的注音表格执行纯排版重组。
     *
     * <p>业务上该通道只重新切分行宽、补齐版心和调整留白，不重新识别或改写任何拼音与汉字。
     *
     * @param documentXml 当前可读 DOCX 正文 XML。
     * @return 参照旧版视觉密度重排后的正文 XML。
     */
    private static String restyleReadableTables(String documentXml) {
        // 业务上正文重组限定在 body 与 sectPr 之间，文档头、命名空间和页面设置保持原样。
        int bodyStart = documentXml.indexOf("<w:body>") + "<w:body>".length();
        int sectionStart = documentXml.indexOf("<w:sectPr", bodyStart);
        if (bodyStart < "<w:body>".length() || sectionStart < 0) {
            throw new IllegalStateException("docx 可读表格缺少 body 或 sectPr，无法安全重排");
        }
        // 业务上按 80 个分页段切成 81 个章节，重排时每章仍保持独立页面。
        String bodyContent = documentXml.substring(bodyStart, sectionStart);
        // 业务上兼容上一版 br 分页和新版 pageBreakBefore 分页，工具可对自身输出重复执行纯排版。
        String pageBreakDelimiter = bodyContent.contains(CHAPTER_PAGE_BREAK_PARAGRAPH)
            ? CHAPTER_PAGE_BREAK_PARAGRAPH
            : PAGE_BREAK_PARAGRAPH;
        String[] chapterBlocks = bodyContent.split(Pattern.quote(pageBreakDelimiter), -1);
        if (chapterBlocks.length != 81) {
            throw new IllegalStateException("docx 章节数量异常 expected=81, actual=" + chapterBlocks.length);
        }
        // 业务上逐章提取现有注音单元并按标题、章名、正文三个字号层级重新分行。
        StringBuilder restyledBody = new StringBuilder(bodyContent.length());
        for (int chapterIndex = 0; chapterIndex < chapterBlocks.length; chapterIndex++) {
            List<PinyinCell> chapterCells = collectReadableTableCells(chapterBlocks[chapterIndex]);
            if (chapterCells.isEmpty()) {
                throw new IllegalStateException("docx 第 " + (chapterIndex + 1) + " 章缺少可重排注音单元");
            }
            // 业务上同一字号层级连续合并后再按十六列分行，消除旧兼容版十列碎片化和阶梯边界。
            restyledBody.append(rebuildChapterCellGroups(chapterCells));
            // 业务上除最后一章外都写回一个硬分页，确保一章一页的业务边界不变。
            if (chapterIndex < chapterBlocks.length - 1) {
                restyledBody.append(CHAPTER_PAGE_BREAK_PARAGRAPH);
            }
        }
        // 业务上用重排后的章节块替换 body 内容，其余 XML 完整保留。
        return documentXml.substring(0, bodyStart) + restyledBody + documentXml.substring(sectionStart);
    }

    /**
     * 将一章单元按原字号层级重新组合。
     *
     * <p>业务上总标题、章名与正文必须分别保持居中和留白规则，不能混入同一行。
     *
     * @param chapterCells 一章内按阅读顺序排列的全部单元。
     * @return 一章重排后的表格与间距段落 XML。
     */
    private static String rebuildChapterCellGroups(List<PinyinCell> chapterCells) {
        // 业务上连续相同字号视为同一视觉层级，字号变化处就是标题、章名或正文的分界。
        StringBuilder chapterXml = new StringBuilder();
        List<PinyinCell> currentGroup = new ArrayList<>();
        int currentSize = -1;
        for (PinyinCell cell : chapterCells) {
            int cellSize = cell.pinyin().isEmpty() ? currentSize : cell.pinyinHalfPoints();
            if (currentSize < 0) {
                currentSize = cell.pinyinHalfPoints();
            }
            // 业务上真实拼音字号变化时先收口上一层级，标点继续跟随当前正文层级。
            if (!cell.pinyin().isEmpty() && cellSize != currentSize && !currentGroup.isEmpty()) {
                chapterXml.append(buildPinyinTables(currentGroup, 16));
                currentGroup = new ArrayList<>();
                currentSize = cellSize;
            }
            currentGroup.add(cell);
        }
        // 业务上追加本章最后一个正文层级，确保末句和句末标点完整输出。
        if (!currentGroup.isEmpty()) {
            chapterXml.append(buildPinyinTables(currentGroup, 16));
        }
        return chapterXml.toString();
    }

    /**
     * 从一个章节块的所有双行表格恢复逻辑注音单元。
     *
     * <p>业务上此方法是纯排版通道的数据桥梁，读取上行拼音与下行汉字但不改变其值。
     *
     * @param chapterXml 当前章节 XML。
     * @return 按原阅读顺序恢复的注音单元。
     */
    private static List<PinyinCell> collectReadableTableCells(String chapterXml) {
        // 业务上按表格在章节中的顺序依次恢复单元，维持原经文阅读次序。
        List<PinyinCell> chapterCells = new ArrayList<>();
        Matcher tableMatcher = DOCX_TABLE_PATTERN.matcher(chapterXml);
        while (tableMatcher.find()) {
            chapterCells.addAll(parseReadableTableCells(tableMatcher.group()));
        }
        return chapterCells;
    }

    /**
     * 从单个两行注音表格恢复拼音单元。
     *
     * <p>业务上第一行和第二行必须列数一致，任何结构偏差都应阻断而不是猜测配对关系。
     *
     * @param tableXml 单个注音表格 XML。
     * @return 当前表格内按列排列的注音单元。
     */
    private static List<PinyinCell> parseReadableTableCells(String tableXml) {
        // 业务上严格读取前两行作为拼音行和汉字行，兼容版表格不允许出现其它业务行。
        Matcher rowMatcher = DOCX_TABLE_ROW_PATTERN.matcher(tableXml);
        if (!rowMatcher.find()) {
            throw new IllegalStateException("docx 注音表格缺少拼音行");
        }
        String pinyinRow = rowMatcher.group();
        if (!rowMatcher.find()) {
            throw new IllegalStateException("docx 注音表格缺少汉字行");
        }
        String hanziRow = rowMatcher.group();
        // 业务上分别提取两行单元，再按相同列索引建立上下对应关系。
        List<String> pinyinCells = extractTableCellXml(pinyinRow);
        List<String> hanziCells = extractTableCellXml(hanziRow);
        if (pinyinCells.size() != hanziCells.size()) {
            throw new IllegalStateException(
                "docx 注音表格上下行列数不一致 pinyin=" + pinyinCells.size() + ", hanzi=" + hanziCells.size());
        }
        // 业务上补齐用的全空列不属于真实内容，恢复时直接丢弃以便重新按新行宽分组。
        List<PinyinCell> cells = new ArrayList<>();
        for (int index = 0; index < pinyinCells.size(); index++) {
            String pinyin = extractCellText(pinyinCells.get(index));
            String hanzi = extractCellText(hanziCells.get(index));
            if (pinyin.isEmpty() && hanzi.isEmpty()) {
                continue;
            }
            // 业务上真实拼音保留原字号；标点无拼音时沿用正文 18 半磅层级。
            int pinyinSize = extractPinyinSize(pinyinCells.get(index), hanziCells.get(index));
            cells.add(new PinyinCell(pinyin, hanzi, pinyinSize));
        }
        return cells;
    }

    /** 业务上提取一行表格中的全部单元 XML，供上下行按列配对。 */
    private static List<String> extractTableCellXml(String rowXml) {
        // 业务上按文档列顺序收集单元，禁止排序或去重。
        List<String> cells = new ArrayList<>();
        Matcher cellMatcher = DOCX_TABLE_CELL_PATTERN.matcher(rowXml);
        while (cellMatcher.find()) {
            cells.add(cellMatcher.group());
        }
        return cells;
    }

    /** 业务上读取单元中的可见文本，空拼音格返回空字符串。 */
    private static String extractCellText(String cellXml) {
        // 业务上兼容版每格只有一个文本节点；统一还原 XML 实体后参与无损重排。
        Matcher textMatcher = DOCX_TEXT_PATTERN.matcher(cellXml);
        return textMatcher.find() ? unescapeXml(textMatcher.group(1)) : "";
    }

    /** 业务上读取拼音单元的原字号，标点或空格默认按正文层级处理。 */
    private static int extractPinyinSize(String pinyinCellXml, String hanziCellXml) {
        // 业务上汉字字号始终比原排版层级大 4 半磅，优先据此恢复 18/20/24 三种业务层级。
        Matcher hanziSizeMatcher = DOCX_TEXT_SIZE_PATTERN.matcher(hanziCellXml);
        if (hanziSizeMatcher.find()) {
            return Math.max(18, Integer.parseInt(hanziSizeMatcher.group(1)) - 4);
        }
        // 业务上旧兼容版若缺少汉字字号，则退回 noProof 后的拼音字号维持向后兼容。
        Matcher pinyinSizeMatcher = DOCX_PINYIN_SIZE_PATTERN.matcher(pinyinCellXml);
        return pinyinSizeMatcher.find() ? Integer.parseInt(pinyinSizeMatcher.group(1)) : 18;
    }

    /**
     * 校验纯排版重组没有改变内容。
     *
     * <p>业务上重排前后逻辑单元、注音数量和章节分页必须完全一致，才能证明本轮只动排版。
     *
     * @param originalXml 重排前正文 XML。
     * @param restyledXml 重排后正文 XML。
     */
    private static void validateRestyledDocx(String originalXml, String restyledXml) {
        // 业务上按章节恢复全部拼音单元并直接比较记录序列，任何经文或拼音变化都会阻断输出。
        List<PinyinCell> originalCells = collectReadableTableCells(originalXml);
        List<PinyinCell> restyledCells = collectReadableTableCells(restyledXml);
        if (!originalCells.equals(restyledCells)) {
            throw new IllegalStateException("docx 纯排版校验失败：重排前后拼音或经文单元不一致");
        }
        // 业务上 6033 个真实拼音标记必须守恒，避免补白或分行过程制造遗漏。
        int originalPinyinCount = countOccurrences(originalXml, "<w:noProof/>");
        int restyledPinyinCount = countOccurrences(restyledXml, "<w:noProof/>");
        if (originalPinyinCount != restyledPinyinCount) {
            throw new IllegalStateException(
                "docx 纯排版注音数量不守恒 original=" + originalPinyinCount + ", restyled=" + restyledPinyinCount);
        }
        // 业务上 80 个硬分页必须保持不变，继续兑现一章一页。
        int originalPageBreakCount = countChapterPageBreaks(originalXml);
        int restyledPageBreakCount = countChapterPageBreaks(restyledXml);
        if (originalPageBreakCount != 80 || restyledPageBreakCount != 80) {
            throw new IllegalStateException(
                "docx 纯排版分页异常 original=" + originalPageBreakCount + ", restyled=" + restyledPageBreakCount);
        }
    }

    /** 业务上统一统计旧 br 与新段前分页两种章节边界，确保任何版本都维持八十处分章。 */
    private static int countChapterPageBreaks(String documentXml) {
        // 业务上两种分页结构不会在同一边界同时出现，因此直接相加即可得到真实章节边界数。
        return countOccurrences(documentXml, PAGE_BREAK_PARAGRAPH)
            + countOccurrences(documentXml, CHAPTER_PAGE_BREAK_PARAGRAPH);
    }

    /**
     * 把异常 EQ 公式重建为跨 Word、WPS 与 Pages 可见的双行无边框表格。
     *
     * <p>业务上部分 Office 版本不渲染 w:ruby，因此最终交付采用上行拼音、下行汉字的基础表格结构保证兼容性。
     *
     * @param documentXml 已完成八处错音修正的正文 XML。
     * @return 使用双行无边框表格承载注音的正文 XML。
     */
    private static String rebuildFlattenedEqAsTables(String documentXml) {
        // 业务上逐段重建并保留段落外的文档主体与节属性，章节顺序不会发生变化。
        Matcher paragraphMatcher = DOCX_PARAGRAPH_PATTERN.matcher(documentXml);
        StringBuffer rebuiltDocument = new StringBuffer(documentXml.length());
        while (paragraphMatcher.find()) {
            // 业务上普通段落不参与转换，只有含异常 EQ 公式的段落才替换为可读表格。
            String paragraphXml = paragraphMatcher.group();
            if (!paragraphXml.contains("EQ \\* jc0")) {
                paragraphMatcher.appendReplacement(rebuiltDocument, Matcher.quoteReplacement(paragraphXml));
                continue;
            }
            // 业务上先汇总被多个运行拆散的公式文本，再按原次序解析成拼音与汉字单元。
            List<PinyinCell> cells = parsePinyinCells(collectParagraphText(paragraphXml));
            // 业务上每行最多十个字，给较长拼音保留足够宽度并控制页面可读性。
            String tableBlocks = buildPinyinTables(cells, 16);
            // 业务上原段落的显式分页转换为独立分页段，继续维持章节边界。
            int pageBreakCount = countRegexMatches(paragraphXml, DOCX_PAGE_BREAK_PATTERN);
            String pageBreakParagraphs = "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>".repeat(pageBreakCount);
            // 业务上用完整表格块替换异常段落，避免任何不可见 ruby 或待计算字段残留。
            paragraphMatcher.appendReplacement(
                rebuiltDocument,
                Matcher.quoteReplacement(tableBlocks + pageBreakParagraphs));
        }
        // 业务上追加最后一个段落之后的节属性与文档闭合标签，保持包结构完整。
        paragraphMatcher.appendTail(rebuiltDocument);
        return rebuiltDocument.toString();
    }

    /**
     * 把单段公式文本解析成按阅读顺序排列的拼音单元。
     *
     * <p>业务上拼音公式生成带拼音单元，公式间标点生成无拼音单元，两者共同还原完整句子。
     *
     * @param flattenedText 合并后的段落文本。
     * @return 可用于生成双行表格的单元列表。
     */
    private static List<PinyinCell> parsePinyinCells(String flattenedText) {
        // 业务上按公式匹配游标依次吸收公式前标点、当前拼音和对应汉字。
        Matcher eqMatcher = FLATTENED_EQ_PATTERN.matcher(flattenedText);
        List<PinyinCell> cells = new ArrayList<>();
        int consumedIndex = 0;
        while (eqMatcher.find()) {
            // 业务上公式之间的每个可见标点独立占一格，使上下两行仍保持列对齐。
            appendPlainTextCells(cells, flattenedText.substring(consumedIndex, eqMatcher.start()));
            // 业务上公式字号用于区分标题、章名与正文，生成表格时继续沿用这一层级。
            int pinyinHalfPoints = Integer.parseInt(eqMatcher.group(1));
            // 业务上已修正后的拼音与原汉字形成同一个单元，确保两者上下对应。
            cells.add(new PinyinCell(eqMatcher.group(2), eqMatcher.group(3), pinyinHalfPoints));
            consumedIndex = eqMatcher.end();
        }
        // 业务上句末标点必须补入最后几个单元，避免重建后丢失断句符号。
        appendPlainTextCells(cells, flattenedText.substring(consumedIndex));
        return cells;
    }

    /**
     * 把公式之外的普通字符追加为无拼音单元。
     *
     * <p>业务上按 Unicode 码点拆分可避免生僻扩展汉字被拆成两个无效字符。
     *
     * @param cells 当前段落单元列表。
     * @param plainText 标点、空白或普通说明文字。
     */
    private static void appendPlainTextCells(List<PinyinCell> cells, String plainText) {
        // 业务上逐码点处理公式外正文，保证标点和可能的扩展字符都完整保留。
        plainText.codePoints().forEach(codePoint -> {
            // 业务上纯空白由表格自身间距承担，不额外占列以免产生空洞。
            if (!Character.isWhitespace(codePoint)) {
                cells.add(new PinyinCell("", new String(Character.toChars(codePoint)), 18));
            }
        });
    }

    /**
     * 按固定列数生成一个段落对应的若干双行表格。
     *
     * <p>业务上分块能让长段落在页面内自然换行，同时每块仍保持拼音与汉字严格列对齐。
     *
     * @param cells 当前段落全部单元。
     * @param columnsPerTable 每个表格块最大列数。
     * @return 一个或多个连续无边框表格 XML。
     */
    private static String buildPinyinTables(List<PinyinCell> cells, int columnsPerTable) {
        // 业务上空段落保留为空段，避免生成零列表格导致 Word 修复文档。
        if (cells.isEmpty()) {
            return "<w:p/>";
        }
        // 业务上依次切分为十列以内的表格块，维持原字符阅读顺序。
        StringBuilder tables = new StringBuilder();
        for (int fromIndex = 0; fromIndex < cells.size(); fromIndex += columnsPerTable) {
            int toIndex = Math.min(fromIndex + columnsPerTable, cells.size());
            // 业务上每个切片独立形成两行表格，页面不足时 Word/WPS 可以在块之间自然分页。
            // 业务上标题与章名在统一正文宽度内居中，正文则保持旧版从左到右的自然起排位置。
            List<PinyinCell> tableCells = cells.subList(fromIndex, toIndex);
            int dominantPinyinSize = dominantPinyinSize(tableCells);
            boolean centerContent = dominantPinyinSize >= 20;
            tables.append(buildPinyinTable(tableCells, columnsPerTable, centerContent));
            // 业务上每组注音行后增加克制留白，模拟旧版自然行距并避免连续网格堆叠感。
            int spacingAfter = dominantPinyinSize >= 24 ? 260 : dominantPinyinSize >= 20 ? 220 : 120;
            tables.append(buildSpacerParagraph(spacingAfter));
        }
        return tables.toString();
    }

    /**
     * 生成单个上拼音、下汉字的无边框表格。
     *
     * <p>业务上采用基础 WordprocessingML 表格，避免依赖不同 Office 版本对公式或 ruby 的兼容实现。
     *
     * @param cells 当前表格块的单元。
     * @return 单个表格 XML。
     */
    private static String buildPinyinTable(List<PinyinCell> cells, int totalColumns, boolean centerContent) {
        // 业务上每列固定 520 DXA，十六列总宽 8320 DXA，接近旧版正文每行十五至十八字的密度。
        int cellWidth = 520;
        int tableWidth = cellWidth * totalColumns;
        // 业务上标题与章名两侧对称补空列，正文尾行只在右侧补空列，统一内容区左边界。
        List<PinyinCell> paddedCells = padPinyinCells(cells, totalColumns, centerContent);
        // 业务上表格居中且隐藏全部边框，视觉上保持连续经文而不是数据网格。
        StringBuilder table = new StringBuilder("<w:tbl><w:tblPr><w:tblW w:w=\"")
            .append(tableWidth).append("\" w:type=\"dxa\"/><w:tblInd w:w=\"0\" w:type=\"dxa\"/><w:jc w:val=\"center\"/>")
            .append(PINYIN_TABLE_CAPTION).append("<w:tblBorders>")
            .append("<w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/>")
            .append("<w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/>")
            .append("</w:tblBorders><w:tblLayout w:type=\"fixed\"/></w:tblPr><w:tblGrid>");
        // 业务上网格列宽与单元宽度保持一致，防止 WPS 自动调整后拼音错位。
        for (int ignored = 0; ignored < totalColumns; ignored++) {
            table.append("<w:gridCol w:w=\"").append(cellWidth).append("\"/>");
        }
        table.append("</w:tblGrid>");
        // 业务上第一行只写拼音，第二行只写对应汉字或标点，实现稳定的上下对齐。
        table.append(buildPinyinTableRow(paddedCells, true, cellWidth));
        table.append(buildPinyinTableRow(paddedCells, false, cellWidth));
        return table.append("</w:tbl>").toString();
    }

    /**
     * 将不足整行的注音单元补齐到统一十六列宽度。
     *
     * <p>业务上统一列宽消除当前版本的阶梯状右边界，同时让标题可在与正文相同的版心内稳定居中。
     *
     * @param cells 当前行真实内容。
     * @param totalColumns 统一总列数。
     * @param centerContent 是否把真实内容居中放置。
     * @return 补齐空列后的完整一行单元。
     */
    private static List<PinyinCell> padPinyinCells(List<PinyinCell> cells, int totalColumns, boolean centerContent) {
        // 业务上空白单元不携带拼音标记，不影响 6033 个真实注音的守恒校验。
        List<PinyinCell> paddedCells = new ArrayList<>(totalColumns);
        int missingColumns = Math.max(0, totalColumns - cells.size());
        int leadingBlankColumns = centerContent ? missingColumns / 2 : 0;
        // 业务上标题和章名先补左侧空列，实现相对整页内容区居中。
        for (int index = 0; index < leadingBlankColumns; index++) {
            paddedCells.add(new PinyinCell("", "", 18));
        }
        // 业务上真实注音单元顺序不变，排版调整不得改动经文或拼音内容。
        paddedCells.addAll(cells);
        // 业务上其余空列补到右侧，使所有表格都保持完全相同的网格宽度。
        while (paddedCells.size() < totalColumns) {
            paddedCells.add(new PinyinCell("", "", 18));
        }
        return paddedCells;
    }

    /** 业务上读取当前行主要拼音字号，用于选择标题、章名或正文排版。 */
    private static int dominantPinyinSize(List<PinyinCell> cells) {
        // 业务上优先取第一个真实拼音单元，标点和补白不参与层级判断。
        for (PinyinCell cell : cells) {
            if (!cell.pinyin().isEmpty()) {
                return cell.pinyinHalfPoints();
            }
        }
        return 18;
    }

    /** 业务上生成不可见的小段落，为相邻注音行提供旧版风格的垂直呼吸空间。 */
    private static String buildSpacerParagraph(int spacingAfter) {
        // 业务上使用 1 磅精确行高并叠加段后距，避免默认空段落造成不可控的大间隙。
        return "<w:p><w:pPr><w:spacing w:line=\"20\" w:line-rule=\"exact\" w:after=\""
            + spacingAfter + "\"/></w:pPr><w:r><w:rPr><w:sz w:val=\"2\"/><w:sz-cs w:val=\"2\"/></w:rPr>"
            + "<w:t xml:space=\"preserve\"> </w:t></w:r></w:p>";
    }

    /**
     * 生成拼音表格的一行。
     *
     * <p>业务上拼音行使用原公式字号，汉字行按标题层级适度放大，两个软件均无需计算即可显示。
     *
     * @param cells 当前表格块单元。
     * @param pinyinRow 是否生成上方拼音行。
     * @param cellWidth 固定列宽。
     * @return 单行表格 XML。
     */
    private static String buildPinyinTableRow(List<PinyinCell> cells, boolean pinyinRow, int cellWidth) {
        // 业务上禁止行跨页拆分，确保拼音行与汉字行不会被分页分离。
        StringBuilder row = new StringBuilder("<w:tr><w:trPr><w:cantSplit/></w:trPr>");
        for (PinyinCell cell : cells) {
            // 业务上正文汉字 11 磅、章名 12 磅、总标题 14 磅，维持清晰层级。
            int textHalfPoints = pinyinRow
                // 业务上拼音比原公式字号缩小 2 磅，避免 zhàng 等长拼音换行，并贴近旧版小注音视觉。
                ? Math.max(14, cell.pinyinHalfPoints() - 4)
                : Math.max(22, cell.pinyinHalfPoints() + 4);
            // 业务上当前行按角色选择拼音或汉字，标点在拼音行保持空白。
            String text = pinyinRow ? cell.pinyin() : cell.hanzi();
            // 业务上每格固定宽度、垂直居中、段落居中，确保上下字符严格对齐。
            row.append("<w:tc><w:tcPr><w:tcW w:w=\"").append(cellWidth)
                .append("\" w:type=\"dxa\"/><w:vAlign w:val=\"center\"/><w:noWrap/>")
                .append("<w:tcBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/>")
                .append("<w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tcBorders>")
                .append("<w:tcMar><w:top w:w=\"20\" w:type=\"dxa\"/><w:left w:w=\"20\" w:type=\"dxa\"/>")
                .append("<w:bottom w:w=\"20\" w:type=\"dxa\"/><w:right w:w=\"20\" w:type=\"dxa\"/></w:tcMar>")
                .append("</w:tcPr><w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:before=\"0\" w:after=\"0\"/>")
                .append("</w:pPr><w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:eastAsia=\"Arial\"/>");
            // 业务上拼音运行加 noProof 标记，既避免拼写红线，也为输出数量守恒提供稳定计数点。
            if (pinyinRow && !text.isEmpty()) {
                row.append("<w:noProof/>");
            }
            row.append("<w:sz w:val=\"").append(textHalfPoints).append("\"/><w:sz-cs w:val=\"")
                .append(textHalfPoints).append("\"/></w:rPr><w:t xml:space=\"preserve\">")
                .append(escapeXml(text)).append("</w:t></w:r></w:p></w:tc>");
        }
        return row.append("</w:tr>").toString();
    }

    /**
     * 把异常转换后可见的 EQ 公式重建为原生 Word ruby 注音。
     *
     * <p>业务上每个段落都仍保存完整拼音与汉字，因此可以在不查询外部字典的情况下无损恢复可读正文。
     *
     * @param documentXml 已完成八处错音修正的正文 XML。
     * @return 使用原生 ruby 注音结构的正文 XML。
     */
    private static String rebuildFlattenedEqAsRuby(String documentXml) {
        // 业务上逐段替换并保留段落之外的文档主体、节属性和命名空间声明。
        Matcher paragraphMatcher = DOCX_PARAGRAPH_PATTERN.matcher(documentXml);
        StringBuffer rebuiltDocument = new StringBuffer(documentXml.length());
        while (paragraphMatcher.find()) {
            // 业务上当前段落独立解析，避免章标题和正文之间发生错误拼接。
            String paragraphXml = paragraphMatcher.group();
            // 业务上只重建含异常 EQ 公式的段落，普通段落保持字节级原样。
            if (!paragraphXml.contains("EQ \\* jc0")) {
                paragraphMatcher.appendReplacement(rebuiltDocument, Matcher.quoteReplacement(paragraphXml));
                continue;
            }
            // 业务上段落开标签可能携带属性，因此从原段落原样取出并继续使用。
            int openingTagEnd = paragraphXml.indexOf('>') + 1;
            String paragraphOpeningTag = paragraphXml.substring(0, openingTagEnd);
            // 业务上保留段落级排版属性，确保居中、间距和缩进不因正文重建而改变。
            Matcher propertiesMatcher = DOCX_PARAGRAPH_PROPERTIES_PATTERN.matcher(paragraphXml);
            String paragraphProperties = propertiesMatcher.find() ? propertiesMatcher.group() : "";
            // 业务上把被多个 run 拆散的可见文本重新连接，恢复完整 EQ 表达式供统一解析。
            String flattenedText = collectParagraphText(paragraphXml);
            // 业务上保留原段落内的显式分页数量，避免章节页边界丢失。
            int pageBreakCount = countRegexMatches(paragraphXml, DOCX_PAGE_BREAK_PATTERN);
            // 业务上按公式内容生成可直接显示的拼音与汉字组合，并保留公式之间的标点。
            String rebuiltContent = buildRubyParagraphContent(flattenedText);
            // 业务上分页符作为独立运行追加在段尾，与原文件的分页位置保持一致。
            String pageBreakRuns = "<w:r><w:br w:type=\"page\"/></w:r>".repeat(pageBreakCount);
            // 业务上段落边界保持不变，仅替换其内部已扁平化的文本运行。
            String rebuiltParagraph = paragraphOpeningTag + paragraphProperties + rebuiltContent + pageBreakRuns + "</w:p>";
            paragraphMatcher.appendReplacement(rebuiltDocument, Matcher.quoteReplacement(rebuiltParagraph));
        }
        // 业务上把最后一个段落之后的节属性与文档闭合标签原样追加。
        paragraphMatcher.appendTail(rebuiltDocument);
        return rebuiltDocument.toString();
    }

    /**
     * 汇总段落内所有文本节点。
     *
     * <p>业务上异常转换器把一个 EQ 公式拆成三段以上 run，只有按顺序连接文本后才能准确恢复字段边界。
     *
     * @param paragraphXml 单个段落 XML。
     * @return 解码 XML 实体后的连续可见文本。
     */
    private static String collectParagraphText(String paragraphXml) {
        // 业务上按文本节点在段落中的自然顺序累积内容，维持原文字符次序。
        Matcher textMatcher = DOCX_TEXT_PATTERN.matcher(paragraphXml);
        StringBuilder paragraphText = new StringBuilder();
        while (textMatcher.find()) {
            // 业务上先还原 XML 实体，避免标点或特殊字符在二次输出时被重复转义。
            paragraphText.append(unescapeXml(textMatcher.group(1)));
        }
        return paragraphText.toString();
    }

    /**
     * 生成单段原生注音正文。
     *
     * <p>业务上公式之间可能夹有逗号、句号和空格，因此匹配区间生成 ruby，非匹配区间生成普通文本运行。
     *
     * @param flattenedText 合并后的段落可见文本。
     * @return 可嵌入段落的 WordprocessingML 内容。
     */
    private static String buildRubyParagraphContent(String flattenedText) {
        // 业务上用匹配游标区分拼音公式和原文标点，保证两类内容都不遗漏。
        Matcher eqMatcher = FLATTENED_EQ_PATTERN.matcher(flattenedText);
        StringBuilder paragraphContent = new StringBuilder();
        int consumedIndex = 0;
        while (eqMatcher.find()) {
            // 业务上公式前的标点和空白按普通正文输出，继续承担原句断句作用。
            appendPlainTextRun(paragraphContent, flattenedText.substring(consumedIndex, eqMatcher.start()));
            // 业务上从原公式读取拼音字号，标题与正文可继续保持不同的注音大小。
            int pinyinHalfPoints = Integer.parseInt(eqMatcher.group(1));
            // 业务上第二组是已应用八处修音后的拼音，必须作为 ruby 上方文本输出。
            String pinyin = eqMatcher.group(2);
            // 业务上第三组是原公式对应汉字，必须作为 ruby 基准正文输出。
            String hanzi = eqMatcher.group(3);
            // 业务上每个公式对应一个独立 ruby，Word/WPS 可以直接排版且不会显示域代码。
            paragraphContent.append(buildRuby(pinyin, hanzi, pinyinHalfPoints));
            consumedIndex = eqMatcher.end();
        }
        // 业务上最后一个公式之后的句末标点和空白也必须写回，保证段落内容完整。
        appendPlainTextRun(paragraphContent, flattenedText.substring(consumedIndex));
        return paragraphContent.toString();
    }

    /**
     * 生成一个 Word 原生 ruby 注音节点。
     *
     * <p>业务上 ruby 自带可见拼音结果，不需要 Word/WPS 在打开文件时重新计算 EQ 域。
     *
     * @param pinyin 上方拼音。
     * @param hanzi 下方汉字。
     * @param pinyinHalfPoints 原公式记录的拼音半磅字号。
     * @return 单个 ruby XML。
     */
    private static String buildRuby(String pinyin, String hanzi, int pinyinHalfPoints) {
        // 业务上正文汉字沿用原文 11 磅基准，避免 6033 个字重建后发生明显横向膨胀。
        int baseHalfPoints = 22;
        // 业务上拼音抬升距离至少覆盖汉字高度，避免上下两层在 Word/WPS 中重叠。
        int raiseHalfPoints = Math.max(baseHalfPoints, pinyinHalfPoints + 4);
        // 业务上统一 XML 转义，保证特殊字符不会破坏正文结构。
        String escapedPinyin = escapeXml(pinyin);
        String escapedHanzi = escapeXml(hanzi);
        // 业务上明确写入 ruby、拼音和基准字的字号及字体，减少不同 Office 软件的默认值差异。
        return "<w:ruby><w:rubyPr><w:rubyAlign w:val=\"center\"/><w:hps w:val=\""
            + pinyinHalfPoints + "\"/><w:hpsRaise w:val=\"" + raiseHalfPoints
            + "\"/><w:hpsBaseText w:val=\"" + baseHalfPoints
            + "\"/><w:lid w:val=\"zh-CN\"/></w:rubyPr><w:rt><w:r><w:rPr>"
            + "<w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:eastAsia=\"Arial\"/>"
            + "<w:sz w:val=\"" + pinyinHalfPoints + "\"/><w:sz-cs w:val=\"" + pinyinHalfPoints
            + "\"/></w:rPr><w:t xml:space=\"preserve\">" + escapedPinyin
            + "</w:t></w:r></w:rt><w:rubyBase><w:r><w:rPr>"
            + "<w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:eastAsia=\"Arial\"/>"
            + "<w:sz w:val=\"" + baseHalfPoints + "\"/><w:sz-cs w:val=\"" + baseHalfPoints
            + "\"/></w:rPr><w:t xml:space=\"preserve\">" + escapedHanzi
            + "</w:t></w:r></w:rubyBase></w:ruby>";
    }

    /**
     * 追加公式之外的普通正文。
     *
     * <p>业务上逗号、句号、空格和说明文字不需要注音，但必须继续参与原段落排版。
     *
     * @param target 当前段落 XML 构建器。
     * @param plainText 待追加普通文本。
     */
    private static void appendPlainTextRun(StringBuilder target, String plainText) {
        // 业务上空区间不生成冗余运行，减少文档节点数量并避免无意义间距。
        if (plainText.isEmpty()) {
            return;
        }
        // 业务上普通标点沿用原正文 16 磅显示，以贴近源文档的直接格式。
        target.append("<w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:eastAsia=\"Arial\"/>"
            + "<w:sz w:val=\"32\"/><w:sz-cs w:val=\"32\"/><w:color w:val=\"222222\"/></w:rPr>"
            + "<w:t xml:space=\"preserve\">").append(escapeXml(plainText)).append("</w:t></w:r>");
    }

    /**
     * 校验可读 DOCX 重建结果。
     *
     * <p>业务上注音数量必须与重建前公式数量完全一致，同时不允许任何可见 EQ 代码残留。
     *
     * @param repairedXml 重建前且已修音的正文 XML。
     * @param readableXml 重建后的正文 XML。
     */
    private static void validateReadableDocx(String repairedXml, String readableXml) {
        // 业务上先统计重建前完整公式数量，作为 6033 个注音项的守恒基线。
        int flattenedEqCount = countFlattenedEqExpressions(repairedXml);
        // 业务上异常源文件必须确实含有公式，否则本工具不能在未知结构上盲目重写。
        if (flattenedEqCount == 0) {
            throw new IllegalStateException("docx 未发现可重建的 EQ 拼音表达式");
        }
        // 业务上所有异常 EQ 前缀都必须清零，保证打开文件时不再出现公式源码。
        if (readableXml.contains("EQ \\* jc0")) {
            throw new IllegalStateException("docx 重建后仍残留 EQ 拼音代码");
        }
        // 业务上每个原公式都必须对应一个带 noProof 标记的拼音单元，数量不一致意味着发生缺字或重复生成。
        int pinyinCellCount = countOccurrences(readableXml, "<w:noProof/>");
        if (pinyinCellCount != flattenedEqCount) {
            throw new IllegalStateException(
                "docx 注音数量不守恒 flattenedEqCount=" + flattenedEqCount + ", pinyinCellCount=" + pinyinCellCount);
        }
        // 业务上原文件含有 80 个章节分页，重建后必须全部保留。
        int originalPageBreakCount = countRegexMatches(repairedXml, DOCX_PAGE_BREAK_PATTERN);
        int rebuiltPageBreakCount = countRegexMatches(readableXml, DOCX_PAGE_BREAK_PATTERN);
        if (rebuiltPageBreakCount != originalPageBreakCount) {
            throw new IllegalStateException(
                "docx 分页数量不守恒 original=" + originalPageBreakCount + ", rebuilt=" + rebuiltPageBreakCount);
        }
    }

    /**
     * 统计正文 XML 中可重建的完整 EQ 公式数量。
     *
     * <p>业务上公式跨多个文本节点，因此按段落先合并可见文本再统计，口径与正式重建保持一致。
     *
     * @param documentXml 正文 XML。
     * @return 完整 EQ 拼音表达式数量。
     */
    private static int countFlattenedEqExpressions(String documentXml) {
        // 业务上逐段计数可以防止一个损坏公式跨段误匹配到下一章内容。
        Matcher paragraphMatcher = DOCX_PARAGRAPH_PATTERN.matcher(documentXml);
        int expressionCount = 0;
        while (paragraphMatcher.find()) {
            // 业务上每段使用与重建相同的文本汇总逻辑，确保校验口径一致。
            expressionCount += countRegexMatches(collectParagraphText(paragraphMatcher.group()), FLATTENED_EQ_PATTERN);
        }
        return expressionCount;
    }

    /** 业务上输出 XML 前统一转义保留字符，保证拼音和汉字始终形成合法节点。 */
    private static String escapeXml(String text) {
        // 业务上按 XML 实体规则编码五类保留字符，防止正文被解释成标签或属性。
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&apos;");
    }

    /** 业务上合并文本节点时还原常见 XML 实体，使公式解析面对真实正文字符。 */
    private static String unescapeXml(String text) {
        // 业务上先还原非 amp 实体、最后还原 amp，避免二次展开实体内容。
        return text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
            .replace("&apos;", "'").replace("&amp;", "&");
    }

    /**
     * 在替换前校验每条规则唯一命中。
     *
     * <p>业务上只有在唯一锚点命中时才允许自动修复，否则宁可失败也不冒误改风险。
     *
     * @param wordDocumentBytes WordDocument 主流字节。
     */
    private static void validateRulesBeforeReplace(byte[] wordDocumentBytes) {
        for (RepairRule repairRule : REPAIR_RULES) {
            // 业务上修复前必须确认旧片段只出现一次，才能证明锚点足够精确。
            int oldCount = countUtf16Occurrences(wordDocumentBytes, repairRule.oldFragment());
            if (oldCount != 1) {
                throw new IllegalStateException(
                    "修复前旧片段命中数量异常[" + repairRule.ruleName() + "] oldCount=" + oldCount);
            }
            // 业务上如果新片段预先已经存在，说明当前文档状态不符合“从原版开始修”的预期。
            int newCount = countUtf16Occurrences(wordDocumentBytes, repairRule.newFragment());
            if (newCount != 0) {
                throw new IllegalStateException(
                    "修复前新片段已存在[" + repairRule.ruleName() + "] newCount=" + newCount);
            }
        }
    }

    /**
     * 执行全部修复规则。
     *
     * <p>业务上这里直接在 WordDocument 主流字节上做受控替换，避免任何外部转换器参与。
     *
     * @param originalBytes 原始 WordDocument 流字节。
     * @return 修复后的 WordDocument 流字节。
     */
    private static byte[] applyRules(byte[] originalBytes) {
        // 业务上从原始流字节复制出一个可修改副本，避免前后校验共用同一引用造成混淆。
        byte[] currentBytes = Arrays.copyOf(originalBytes, originalBytes.length);
        for (RepairRule repairRule : REPAIR_RULES) {
            // 业务上每条规则都以完整锚点片段替换，确保只改指定章句的一个具体位置。
            currentBytes = replaceOnceUtf16(currentBytes, repairRule.oldFragment(), repairRule.newFragment(), repairRule.ruleName());
        }
        return currentBytes;
    }

    /**
     * 在替换后校验修复结果。
     *
     * <p>业务上替换执行成功不代表结果一定正确，因此这里再次确认旧片段清零、新片段唯一存在。
     *
     * @param wordDocumentBytes 替换后的 WordDocument 主流字节。
     */
    private static void validateRulesAfterReplace(byte[] wordDocumentBytes) {
        for (RepairRule repairRule : REPAIR_RULES) {
            // 业务上修复后旧片段必须完全消失，否则说明替换没有真正命中。
            int oldCount = countUtf16Occurrences(wordDocumentBytes, repairRule.oldFragment());
            if (oldCount != 0) {
                throw new IllegalStateException(
                    "修复后旧片段仍存在[" + repairRule.ruleName() + "] oldCount=" + oldCount);
            }
            // 业务上修复后新片段必须唯一存在，否则说明结果可能重复扩散或未落位。
            int newCount = countUtf16Occurrences(wordDocumentBytes, repairRule.newFragment());
            if (newCount != 1) {
                throw new IllegalStateException(
                    "修复后新片段命中数量异常[" + repairRule.ruleName() + "] newCount=" + newCount);
            }
        }
    }

    /**
     * 在替换前校验 docx 规则唯一命中。
     *
     * <p>业务上 docx 修复也必须坚持唯一锚点原则，否则同音字会被误改。
     *
     * @param documentXml docx 正文 XML。
     */
    private static void validateDocxRulesBeforeReplace(String documentXml) {
        for (DocxTextRule docxTextRule : DOCX_TEXT_RULES) {
            // 业务上精确文本规则也必须先唯一命中，才能证明这一段 XML 可以安全定点替换。
            int oldCount = countOccurrences(documentXml, docxTextRule.oldFragment());
            if (oldCount != 1) {
                throw new IllegalStateException(
                    "docx 文本修复前旧片段命中数量异常[" + docxTextRule.ruleName() + "] oldCount=" + oldCount);
            }
        }
        for (DocxRegexRule docxRegexRule : DOCX_REGEX_RULES) {
            // 业务上修复前正则锚点必须唯一命中，才能证明当前 docx 定位足够具体。
            int oldCount = countRegexMatches(documentXml, docxRegexRule.oldPattern());
            if (oldCount != 1) {
                throw new IllegalStateException(
                    "docx 修复前旧片段命中数量异常[" + docxRegexRule.ruleName() + "] oldCount=" + oldCount);
            }
        }
    }

    /**
     * 执行 docx 正文 XML 规则替换。
     *
     * <p>业务上 docx 的 EQ 域内容已经是展开后的普通 XML 文本，因此这里直接做字符串级定点替换。
     *
     * @param documentXml 原始正文 XML。
     * @return 替换后的正文 XML。
     */
    private static String applyDocxRules(String documentXml) {
        String currentXml = documentXml;
        for (DocxTextRule docxTextRule : DOCX_TEXT_RULES) {
            // 业务上结构完全稳定的片段优先走精确文本替换，避免 run 级正则再次误伤相邻内容。
            currentXml = replaceOnce(currentXml, docxTextRule.oldFragment(), docxTextRule.newFragment(), docxTextRule.ruleName());
        }
        for (DocxRegexRule docxRegexRule : DOCX_REGEX_RULES) {
            // 业务上每条规则都限定上下文，只改一个确认过的错音片段。
            currentXml = replaceRegexOnce(currentXml, docxRegexRule.oldPattern(), docxRegexRule.replacement(), docxRegexRule.ruleName());
        }
        return currentXml;
    }

    /**
     * 在替换后校验 docx 规则结果。
     *
     * <p>业务上字符串替换成功不等于结果可信，因此这里再次校验旧片段清零、新片段唯一命中。
     *
     * @param documentXml 替换后的正文 XML。
     */
    private static void validateDocxRulesAfterReplace(String documentXml) {
        for (DocxTextRule docxTextRule : DOCX_TEXT_RULES) {
            // 业务上文本级旧片段应完全消失，新片段应唯一存在，才能证明定点替换闭环成立。
            int oldCount = countOccurrences(documentXml, docxTextRule.oldFragment());
            if (oldCount != 0) {
                throw new IllegalStateException(
                    "docx 文本修复后旧片段仍存在[rule=" + docxTextRule.ruleName() + "] oldCount=" + oldCount);
            }
            int newCount = countOccurrences(documentXml, docxTextRule.newFragment());
            if (newCount != 1) {
                throw new IllegalStateException(
                    "docx 文本修复后新片段命中数量异常[rule=" + docxTextRule.ruleName() + "] newCount=" + newCount);
            }
        }
        for (int ruleIndex = 0; ruleIndex < DOCX_REGEX_RULES.size(); ruleIndex++) {
            DocxRegexRule docxRegexRule = DOCX_REGEX_RULES.get(ruleIndex);
            // 业务上旧片段应完全消失，否则说明替换没有真正生效。
            int oldCount = countRegexMatches(documentXml, docxRegexRule.oldPattern());
            if (oldCount != 0) {
                throw new IllegalStateException(
                    "docx 修复后旧片段仍存在[index=" + ruleIndex + ", rule=" + docxRegexRule.ruleName() + "] oldCount=" + oldCount);
            }
        }
        validateDocxExpectedPinyin(documentXml);
    }

    /**
     * 执行 UTF-16LE 片段替换。
     *
     * <p>业务上允许新旧片段长度不同，因此这里在字节数组层面重建新数组，而不是做固定长度原地覆盖。
     *
     * @param source 原始字节数组。
     * @param oldText 旧文本片段。
     * @param newText 新文本片段。
     * @param ruleName 规则名。
     * @return 替换后的新字节数组。
     */
    private static byte[] replaceOnceUtf16(byte[] source, String oldText, String newText, String ruleName) {
        // 业务上所有流级替换都统一按 UTF-16LE 构造字节片段，与文档正文编码保持一致。
        byte[] oldBytes = oldText.getBytes(StandardCharsets.UTF_16LE);
        byte[] newBytes = newText.getBytes(StandardCharsets.UTF_16LE);
        int hitIndex = indexOf(source, oldBytes, 0);
        if (hitIndex < 0) {
            throw new IllegalStateException("流级替换未命中[" + ruleName + "]");
        }
        // 业务上命中位置前半段保持原样，确保替换前的所有正文字节不被波及。
        byte[] replaced = new byte[source.length - oldBytes.length + newBytes.length];
        System.arraycopy(source, 0, replaced, 0, hitIndex);
        // 业务上中间段写入新的拼音片段，实现目标注音的真实修复。
        System.arraycopy(newBytes, 0, replaced, hitIndex, newBytes.length);
        // 业务上替换后尾段整体后移或前移，保证后续正文仍完整保留。
        System.arraycopy(
            source,
            hitIndex + oldBytes.length,
            replaced,
            hitIndex + newBytes.length,
            source.length - hitIndex - oldBytes.length);
        return replaced;
    }

    /**
     * 执行字符串级唯一替换。
     *
     * <p>业务上 docx XML 修复要求只命中一次，因此这里显式校验“恰好一处”的替换前提。
     *
     * @param source 原始字符串。
     * @param oldText 旧片段。
     * @param newText 新片段。
     * @param ruleName 规则名。
     * @return 替换后的字符串。
     */
    private static String replaceOnce(String source, String oldText, String newText, String ruleName) {
        int hitIndex = source.indexOf(oldText);
        if (hitIndex < 0) {
            throw new IllegalStateException("docx 替换未命中[" + ruleName + "]");
        }
        if (source.indexOf(oldText, hitIndex + oldText.length()) >= 0) {
            throw new IllegalStateException("docx 替换命中不唯一[" + ruleName + "]");
        }
        return source.substring(0, hitIndex) + newText + source.substring(hitIndex + oldText.length());
    }

    /**
     * 执行正则级唯一替换。
     *
     * <p>业务上 docx XML 的目标片段包含大量 run 结构，用正则锚点比纯字面串更稳，因此这里统一处理唯一正则替换。
     *
     * @param source 原始 XML。
     * @param oldPattern 旧片段正则。
     * @param replacement 新片段替换模板。
     * @param ruleName 规则名。
     * @return 替换后的 XML。
     */
    private static String replaceRegexOnce(String source, Pattern oldPattern, String replacement, String ruleName) {
        Matcher matcher = oldPattern.matcher(source);
        if (!matcher.find()) {
            throw new IllegalStateException("docx 正则替换未命中[" + ruleName + "]");
        }
        StringBuffer buffer = new StringBuffer();
        matcher.appendReplacement(buffer, replacement);
        if (matcher.find()) {
            throw new IllegalStateException("docx 正则替换命中不唯一[" + ruleName + "]");
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    /**
     * 生成单个 EQ 域文本。
     *
     * <p>业务上文档里的拼音与汉字是通过 EQ 域对齐展示的，因此规则必须按 EQ 域原始文本来写。
     *
     * @param pinyin 当前汉字的拼音。
     * @param hanzi 当前汉字。
     * @return 对应的 EQ 域片段。
     */
    private static String eq(String pinyin, String hanzi) {
        // 业务上字段头必须保留，否则替换出的文本不会再被 Word/WPS 当成 EQ 域内容识别。
        return FIELD_BEGIN + "EQ \\* jc0 \\* \"Font:Arial\" \\* hps18 \\o(\\s\\up 11("
            + pinyin
            + "),"
            + hanzi
            + ")";
    }

    /**
     * 生成 docx 中单个拼音 run 与汉字 run 的锚点片段。
     *
     * <p>业务上 docx 中 EQ 域已经被展开为多段 XML run，所以 docx 替换规则需要按这个展开形态构造。
     *
     * @param pinyin 当前汉字的拼音。
     * @param hanzi 当前汉字。
     * @return docx 中对应的 run 片段。
     */
    private static String docxEq(String pinyin, String hanzi) {
        return "xml:space=\"preserve\">" + pinyin
            + "</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii=\"Times\" w:hAnsi=\"Times\" w:cs=\"Times\"/><w:sz w:val=\"22\"/><w:sz-cs w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">),"
            + hanzi
            + ")";
    }

    /**
     * 复制文档。
     *
     * <p>业务上恢复步骤要完整覆盖当前文件，保证上一次错误写回留下的内容不会残留。
     *
     * @param sourceDoc 原版文档。
     * @param targetDoc 当前目标文档。
     * @throws IOException 复制失败时抛出。
     */
    private static void copyDocument(Path sourceDoc, Path targetDoc) throws IOException {
        // 业务上先创建目标目录，避免首次输出时因为父目录缺失导致恢复流程中断。
        if (targetDoc.getParent() != null) {
            Files.createDirectories(targetDoc.getParent());
        }
        // 业务上恢复必须用 REPLACE_EXISTING，确保目标文件被完整重建而不是保留旧内容。
        Files.copy(sourceDoc, targetDoc, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
    }

    /**
     * 读取 docx 包内全部条目。
     *
     * <p>业务上为了只改正文 XML 并保持其它资源不动，这里先完整缓存 zip 条目内容。
     *
     * @param docxPath docx 路径。
     * @return 条目名到字节数组的映射。
     * @throws IOException 读取失败时抛出。
     */
    private static Map<String, byte[]> readDocxEntries(Path docxPath) throws IOException {
        Map<String, byte[]> zipEntries = new HashMap<>();
        try (ZipFile zipFile = new ZipFile(docxPath.toFile())) {
            Iterator<? extends ZipEntry> iterator = zipFile.entries().asIterator();
            while (iterator.hasNext()) {
                ZipEntry zipEntry = iterator.next();
                if (zipEntry.isDirectory()) {
                    zipEntries.put(zipEntry.getName(), new byte[0]);
                    continue;
                }
                zipEntries.put(zipEntry.getName(), zipFile.getInputStream(zipEntry).readAllBytes());
            }
        }
        return zipEntries;
    }

    /**
     * 写回 docx 包内条目。
     *
     * <p>业务上重新打包时需要保留原有条目名和层级，只替换正文 XML 的内容。
     *
     * @param docxPath 输出 docx 路径。
     * @param zipEntries 条目内容映射。
     * @throws IOException 写回失败时抛出。
     */
    private static void writeDocxEntries(Path docxPath, Map<String, byte[]> zipEntries) throws IOException {
        try (ZipOutputStream zipOutputStream = new ZipOutputStream(Files.newOutputStream(docxPath))) {
            for (Map.Entry<String, byte[]> zipEntryItem : zipEntries.entrySet()) {
                ZipEntry zipEntry = new ZipEntry(zipEntryItem.getKey());
                zipOutputStream.putNextEntry(zipEntry);
                if (zipEntryItem.getValue().length > 0) {
                    zipOutputStream.write(zipEntryItem.getValue());
                }
                zipOutputStream.closeEntry();
            }
        }
    }

    /**
     * 校验恢复源文件存在。
     *
     * <p>业务上原版缺失时自动修复就失去可信基线，因此必须立即失败。
     *
     * @param filePath 文件路径。
     * @param message 失败消息。
     */
    private static void requireFile(Path filePath, String message) {
        // 业务上只有真实存在的文件才能作为 Word 修复的输入。
        if (!Files.isRegularFile(filePath)) {
            throw new IllegalStateException(message + ": " + filePath);
        }
    }

    /**
     * 校验目标文件写入策略。
     *
     * <p>业务上默认允许覆盖当前文档；如果用户关闭覆盖，则目标已存在时必须阻断。
     *
     * @param targetDoc 目标路径。
     * @param overwrite 是否允许覆盖。
     */
    private static void ensureWritableTarget(Path targetDoc, boolean overwrite) {
        // 业务上目标目录需要提前存在或可创建，否则后续恢复与写回都会失败。
        if (targetDoc.getParent() != null && !Files.exists(targetDoc.getParent())) {
            try {
                Files.createDirectories(targetDoc.getParent());
            } catch (IOException exception) {
                throw new IllegalStateException("无法创建目标目录: " + targetDoc.getParent(), exception);
            }
        }
        // 业务上显式关闭覆盖时，工具不得改写已有文件，避免误伤用户手工版本。
        if (!overwrite && Files.exists(targetDoc)) {
            throw new IllegalStateException("目标文档已存在且 overwrite=false: " + targetDoc);
        }
    }

    /**
     * 解析命令行参数。
     *
     * <p>业务上采用 `--key=value` 形式，便于在 IDE 运行配置和命令行之间直接复用。
     *
     * @param args 原始参数数组。
     * @return 参数键值表。
     */
    private static Map<String, String> parseArgs(String[] args) {
        // 业务上使用有序 Map 保存参数，便于调试时按传入顺序回看覆盖结果。
        Map<String, String> arguments = new LinkedHashMap<>();
        for (String arg : args) {
            // 业务上只接受标准 `--key=value` 参数，避免位置参数造成含义歧义。
            if (arg == null || !arg.startsWith("--") || !arg.contains("=")) {
                throw new IllegalArgumentException("非法参数，要求使用 --key=value: " + arg);
            }
            // 业务上先切掉前导 `--`，再按第一个等号拆分键值，保留路径里的后续等号。
            int separatorIndex = arg.indexOf('=');
            String key = arg.substring(2, separatorIndex).trim();
            String value = arg.substring(separatorIndex + 1).trim();
            // 业务上空键没有业务意义，必须视为参数错误。
            if (key.isEmpty()) {
                throw new IllegalArgumentException("参数 key 不能为空: " + arg);
            }
            arguments.put(key, value);
        }
        return arguments;
    }

    /**
     * 统计字符串片段出现次数。
     *
     * <p>业务上 docx XML 修复和校验都依赖唯一命中，因此这里提供字符串级计数方法复用。
     *
     * @param source 原始字符串。
     * @param target 目标片段。
     * @return 命中次数。
     */
    private static int countOccurrences(String source, String target) {
        if (source == null || source.isEmpty() || target == null || target.isEmpty()) {
            return 0;
        }
        int count = 0;
        int fromIndex = 0;
        while (true) {
            int hitIndex = source.indexOf(target, fromIndex);
            if (hitIndex < 0) {
                return count;
            }
            count++;
            fromIndex = hitIndex + target.length();
        }
    }

    /**
     * 统计正则命中次数。
     *
     * <p>业务上 docx 修复前后都要确认锚点命中数量，因此这里提供正则级计数方法供校验复用。
     *
     * @param source 原始 XML。
     * @param pattern 目标正则。
     * @return 命中次数。
     */
    private static int countRegexMatches(String source, Pattern pattern) {
        int count = 0;
        Matcher matcher = pattern.matcher(source);
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    /**
     * 校验 docx 修复后目标拼音已经出现。
     *
     * <p>业务上正则旧片段清零还不够，仍要再确认目标新拼音确实落到了正文 XML 里。
     *
     * @param documentXml 修复后的正文 XML。
     */
    private static void validateDocxExpectedPinyin(String documentXml) {
        LinkedHashSet<String> expectedPinyin = new LinkedHashSet<>(Arrays.asList(
            "chuǎi", "wèi", "zhāo", "shèng", "bó", "xì", "huǐ", "zhē"));
        for (String pinyin : expectedPinyin) {
            if (!documentXml.contains("xml:space=\"preserve\">" + pinyin + "</w:t>")) {
                throw new IllegalStateException("docx 修复后缺少目标拼音[" + pinyin + "]");
            }
        }
    }

    /**
     * 输出旧版 DOC 内各流的目标片段命中情况。
     *
     * <p>业务上调试时需要先确认目标拼音和汉字实际落在哪个流里，避免误把不相关流也纳入修复。
     *
     * @param docPath 待分析的文档路径。
     * @throws IOException 读取流失败时抛出。
     */
    private static void dumpStreamMatches(Path docPath) throws IOException {
        // 业务上调试时直接读取 OLE 文件系统，逐个检查每个子流里的 UTF-16LE 片段。
        try (POIFSFileSystem fileSystem = new POIFSFileSystem(Files.newInputStream(docPath))) {
            dumpDirectory(fileSystem.getRoot(), "");
        }
    }

    /**
     * 递归输出目录下各文档流的目标片段命中。
     *
     * <p>业务上 Word 旧版 DOC 可能把有效文本落在多个流里，因此需要整棵 OLE 目录树遍历。
     *
     * @param directoryEntry 当前目录。
     * @param prefix 目录前缀。
     * @throws IOException 读取流失败时抛出。
     */
    private static void dumpDirectory(DirectoryEntry directoryEntry, String prefix) throws IOException {
        // 业务上 POIFS 目录节点本身不存正文，因此这里只负责递归进入子目录或处理文档流。
        Iterator<Entry> iterator = directoryEntry.getEntries();
        while (iterator.hasNext()) {
            Entry entry = iterator.next();
            if (entry instanceof DirectoryEntry childDirectory) {
                dumpDirectory(childDirectory, prefix + "/" + childDirectory.getName());
                continue;
            }
            if (entry instanceof DocumentEntry documentEntry) {
                byte[] bytes = readDocumentBytes(documentEntry);
                for (String probe : Arrays.asList("chuāi", "yí", "cháo", "chéng", "pō", "shè", "huī", "shì", "揣", "遗", "朝", "乘", "泊", "歙", "虺", "螫")) {
                    int count = countUtf16Occurrences(bytes, probe);
                    if (count > 0) {
                        System.out.println("STREAM_MATCH " + prefix + "/" + documentEntry.getName() + " :: " + probe + " :: " + count);
                    }
                }
            }
        }
    }

    /**
     * 读取单个文档流的全部字节。
     *
     * <p>业务上后续修复与验证都直接围绕流字节展开，因此统一抽成基础方法。
     *
     * @param documentEntry 文档流节点。
     * @return 文档流字节数组。
     * @throws IOException 读取失败时抛出。
     */
    private static byte[] readDocumentBytes(DocumentEntry documentEntry) throws IOException {
        // 业务上文档流长度由 POIFS 目录项维护，因此先按目录项长度分配缓冲区。
        byte[] bytes = new byte[documentEntry.getSize()];
        try (DocumentInputStream documentInputStream = new DocumentInputStream(documentEntry)) {
            // 业务上一次性读满流字节，便于后续统一做片段计数与替换。
            documentInputStream.readFully(bytes);
        }
        return bytes;
    }

    /**
     * 统计 UTF-16LE 片段在文档流中的出现次数。
     *
     * <p>业务上拼音与汉字在这份 DOC 里是 UTF-16LE 文本，因此流级检查也沿用同一编码口径。
     *
     * @param bytes 文档流字节。
     * @param text 待查片段。
     * @return 命中次数。
     */
    private static int countUtf16Occurrences(byte[] bytes, String text) {
        // 业务上把文本探针统一编码为 UTF-16LE，和原文档中的拼音/汉字编码保持一致。
        byte[] probe = text.getBytes(StandardCharsets.UTF_16LE);
        int count = 0;
        int fromIndex = 0;
        while (true) {
            int foundIndex = indexOf(bytes, probe, fromIndex);
            if (foundIndex < 0) {
                return count;
            }
            count++;
            fromIndex = foundIndex + 2;
        }
    }

    /**
     * 在字节数组里查找子数组。
     *
     * <p>业务上流级修复依赖稳定的字节查找，因此这里提供一个不依赖额外工具的顺序匹配实现。
     *
     * @param source 源字节数组。
     * @param target 目标字节数组。
     * @param fromIndex 起始位置。
     * @return 命中索引，未命中返回 -1。
     */
    private static int indexOf(byte[] source, byte[] target, int fromIndex) {
        // 业务上空目标没有查找意义，直接按未命中处理。
        if (target.length == 0) {
            return -1;
        }
        for (int left = Math.max(0, fromIndex); left <= source.length - target.length; left++) {
            boolean matched = true;
            for (int right = 0; right < target.length; right++) {
                if (source[left + right] != target[right]) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                return left;
            }
        }
        return -1;
    }

    /**
     * 自动识别项目根目录。
     *
     * <p>业务上工具通常从模块目录或仓库根目录启动，因此这里通过 settings.gradle 向上回溯定位根目录。
     *
     * @return 项目根目录。
     */
    private static Path detectProjectRoot() {
        // 业务上从当前工作目录开始向上找，兼容 Gradle 和 IDE 的不同启动位置。
        Path current = Paths.get("").toAbsolutePath().normalize();
        List<Path> candidates = new ArrayList<>();
        candidates.add(current);
        // 业务上沿父目录逐级回溯，直到文件系统根目录为止。
        Path walker = current;
        while (walker != null) {
            candidates.add(walker);
            walker = walker.getParent();
        }
        for (Path candidate : candidates) {
            // 业务上以 settings.gradle 作为多模块仓库根目录的稳定识别标识。
            if (Files.exists(candidate.resolve("settings.gradle"))) {
                return candidate;
            }
        }
        // 业务上若自动识别失败，就退回当前目录，至少保证路径解析还有一个确定起点。
        return current;
    }

    /**
     * 单条修复规则。
     *
     * @param ruleName 规则名。
     * @param oldFragment 旧片段。
     * @param newFragment 新片段。
     */
    private record RepairRule(String ruleName, String oldFragment, String newFragment) {
    }

    /**
     * docx 文本修复规则。
     *
     * @param ruleName 规则名。
     * @param oldFragment 旧片段。
     * @param newFragment 新片段。
     */
    private record DocxTextRule(String ruleName, String oldFragment, String newFragment) {
    }

    /**
     * docx 正则修复规则。
     *
     * @param ruleName 规则名。
     * @param oldPattern 旧片段正则。
     * @param replacement 替换模板。
     */
    private record DocxRegexRule(String ruleName, Pattern oldPattern, String replacement) {
    }

    /**
     * 可读注音表格的单个业务单元。
     *
     * @param pinyin 上行拼音，标点单元为空。
     * @param hanzi 下行汉字或标点。
     * @param pinyinHalfPoints 原公式拼音字号，用于保留标题层级。
     */
    private record PinyinCell(String pinyin, String hanzi, int pinyinHalfPoints) {
    }
}
