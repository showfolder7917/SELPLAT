package com.sp.selplat.local.code.common.中文教学.教学图片与PPT生成;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 按正文元素顺序解析“标题表格、署名表格、正文表格、分页边界”结构的核定版拼音 DOCX。
 */
public final class PinyinPoetryDocxParser {

    // 业务上核定版署名统一使用方括号朝代，正则只拆字段，不改写其正文。
    private static final Pattern ATTRIBUTION_PATTERN = Pattern.compile("^【([^】]+)】(.+)$");

    /**
     * 工具类不创建实例，确保所有调用使用同一份结构校验规则。
     */
    private PinyinPoetryDocxParser() {
        // 业务入口统一通过 parse，避免绕过分页和表格数量校验。
    }

    /**
     * 解析一个核定版拼音 DOCX。
     *
     * @param sourcePath 只读源 DOCX
     * @return 按源文件顺序排列的作品
     * @throws IOException 文件读取失败
     * @throws IllegalArgumentException 文件不是支持的核定版表格结构
     */
    public static List<DocTopicPoem> parse(Path sourcePath) throws IOException {
        // 业务上只接受真实可读的 DOCX，旧 DOC 和不存在路径不能进入图片生成链路。
        if (!Files.isRegularFile(sourcePath) || !sourcePath.getFileName().toString().toLowerCase().endsWith(".docx")) {
            throw new IllegalArgumentException("源文件必须是可读 DOCX: " + sourcePath);
        }
        List<DocTopicPoem> poems = new ArrayList<>();
        List<DocTopicPoem.AnnotatedLine> currentTables = new ArrayList<>();
        // 业务上按 body element 顺序读取，才能保留表格与分页段落之间的真实边界。
        try (InputStream inputStream = Files.newInputStream(sourcePath);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            for (IBodyElement element : document.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph && isPageBoundary(paragraph)) {
                    // 业务上分页节点标识前一篇结束；连续空分页不会创建空作品。
                    finishPoem(currentTables, poems, sourcePath);
                    currentTables.clear();
                } else if (element instanceof XWPFTable table) {
                    // 业务上每个核定表格转换为一行逐字数据，段落留白不参与原文提取。
                    currentTables.add(parseTable(table, sourcePath));
                }
            }
        }
        // 业务上文件尾没有下一处分页，因此显式收取最后一篇作品。
        finishPoem(currentTables, poems, sourcePath);
        if (poems.isEmpty()) {
            throw new IllegalArgumentException("源 DOCX 未识别到核定版拼音作品: " + sourcePath);
        }
        // 业务上返回不可变作品列表，保证批处理顺序与源文档完全一致。
        return List.copyOf(poems);
    }

    /**
     * 判断段落是否是篇目分页边界。
     *
     * @param paragraph 主文档段落
     * @return 段前分页或运行内硬分页时为 true
     */
    private static boolean isPageBoundary(XWPFParagraph paragraph) {
        // 业务上兼容新版段前分页和旧版运行内分页，使历史核定版无需重新生成。
        if (paragraph.isPageBreak()) {
            return true;
        }
        // 业务上只识别 type=page 的换页符，普通换行不能切断一首诗。
        return paragraph.getRuns().stream().anyMatch(run -> {
            String xml = run.getCTR().xmlText();
            return xml.contains("<w:br") && xml.contains("type=\"page\"");
        });
    }

    /**
     * 把一篇已收集的表格转换为正式作品。
     *
     * @param tables 当前篇目的标题、署名和正文表格
     * @param poems 输出作品集合
     * @param sourcePath 源路径，用于错误定位
     */
    private static void finishPoem(
        List<DocTopicPoem.AnnotatedLine> tables,
        List<DocTopicPoem> poems,
        Path sourcePath
    ) {
        if (tables.isEmpty()) {
            // 业务上页首留白或连续分页不代表空作品，直接忽略。
            return;
        }
        if (tables.size() < 3) {
            // 业务上每篇至少需要标题、署名和一行正文，结构不足时拒绝错位生成。
            throw new IllegalArgumentException("作品表格不足三个 source=" + sourcePath + ", tableCount=" + tables.size());
        }
        // 业务上第一个表格固定为标题，拼接原字符后清除两端排版空白。
        String title = tables.get(0).text().strip();
        // 业务上第二个表格固定为朝代作者，使用核定文字拆字段。
        Attribution attribution = parseAttribution(tables.get(1).text().strip());
        // 业务上第三个及之后表格全部作为正文行，不重新分句或改标点。
        List<DocTopicPoem.AnnotatedLine> bodyLines = List.copyOf(tables.subList(2, tables.size()));
        poems.add(new DocTopicPoem(title, attribution.dynasty(), attribution.author(), bodyLines));
    }

    /**
     * 读取一个上下叠放的逐字注音表格。
     *
     * @param table 核定版表格
     * @param sourcePath 源路径
     * @return 一行逐字注音
     */
    private static DocTopicPoem.AnnotatedLine parseTable(XWPFTable table, Path sourcePath) {
        if (table.getRows().size() != 1 || table.getRow(0).getTableCells().isEmpty()) {
            // 业务上当前核定格式固定一行多列，复杂表格不能按猜测方式解析。
            throw new IllegalArgumentException("不支持的拼音表格结构: " + sourcePath);
        }
        List<DocTopicPoem.AnnotatedToken> tokens = new ArrayList<>();
        for (XWPFTableCell cell : table.getRow(0).getTableCells()) {
            if (cell.getParagraphs().size() < 2) {
                // 业务上第一段拼音、第二段原文缺一不可，防止整行错位。
                throw new IllegalArgumentException("拼音单元格缺少上下两层: " + sourcePath);
            }
            // 业务上直接读取核定拼音，不调用第三方拼音库重新生成。
            String pinyin = cell.getParagraphs().get(0).getText();
            // 业务上第二段是原汉字或标点，必须保留原字符。
            String text = cell.getParagraphs().get(1).getText();
            tokens.add(new DocTopicPoem.AnnotatedToken(pinyin, text));
        }
        return new DocTopicPoem.AnnotatedLine(tokens);
    }

    /**
     * 拆分核定署名。
     *
     * @param text 方括号朝代与作者
     * @return 朝代作者字段
     */
    private static Attribution parseAttribution(String text) {
        Matcher matcher = ATTRIBUTION_PATTERN.matcher(text);
        if (matcher.matches()) {
            // 业务上标准署名分别进入朝代和作者，不把括号带入图片正文。
            return new Attribution(matcher.group(1).strip(), matcher.group(2).strip());
        }
        // 业务上无标准括号的作品保留完整来源到作者栏，避免虚构朝代。
        return new Attribution("", text);
    }

    /**
     * 解析后的署名字段。
     *
     * @param dynasty 朝代
     * @param author 作者或来源
     */
    private record Attribution(String dynasty, String author) {
    }
}
