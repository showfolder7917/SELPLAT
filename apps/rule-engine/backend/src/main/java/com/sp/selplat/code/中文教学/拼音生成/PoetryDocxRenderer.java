package com.sp.selplat.code.中文教学.拼音生成;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.TableRowAlign;
import org.apache.poi.xwpf.usermodel.TextAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageSz;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblLayoutType;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblWidth;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblLayoutType;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblWidth;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;

/**
 * 将结构化古诗文渲染为“每篇从新页开始、拼音在上、汉字在下”的稳定 DOCX。
 */
public final class PoetryDocxRenderer {

    // 业务上页面尺寸、边距、字体和标准列数由统一配置控制，避免诗页使用隐藏默认值。
    private final PinyinGenerationConfig config;

    /**
     * 创建诗词版式渲染器。
     *
     * @param config 页面和字体配置
     */
    public PoetryDocxRenderer(PinyinGenerationConfig config) {
        // 业务上复用通用版式配置，让普通段落模式和诗词模式保持同一纸张及字体基准。
        this.config = config;
    }

    /**
     * 生成一诗一页的拼音 DOCX。
     *
     * @param poems 已解析诗词
     * @param targetPath 输出路径
     * @param converter 拼音转换器
     * @param overwrite 是否允许覆盖
     * @return 生成统计
     * @throws IOException 文件读写失败
     * @throws IllegalArgumentException 诗词为空或目标路径不符合覆盖与目录约束
     */
    public GenerationResult render(
        List<PoetryDocumentParser.Poem> poems,
        Path targetPath,
        PinyinTextConverter converter,
        boolean overwrite
    ) throws IOException {
        // 业务上至少需要一首诗，空集合不能生成误导性的空白交付文件。
        if (poems.isEmpty()) {
            throw new IllegalArgumentException("没有可生成的诗词");
        }
        // 业务上默认保护已有人工校对结果，只有明确覆盖时才替换目标文件。
        if (Files.exists(targetPath) && !overwrite) {
            throw new IllegalArgumentException("目标文件已存在，未允许覆盖: " + targetPath);
        }
        Path targetDirectory = targetPath.toAbsolutePath().normalize().getParent();
        if (targetDirectory == null) {
            throw new IllegalArgumentException("目标文件缺少父目录: " + targetPath);
        }
        // 业务上输出目录由工具按需创建，方便同一命令用于后续其它诗词汇总文档。
        Files.createDirectories(targetDirectory);
        List<ConvertedPoem> convertedPoems = new ArrayList<>();
        int hanziCount = 0;
        int bodyLineCount = 0;
        for (PoetryDocumentParser.Poem poem : poems) {
            // 业务上先转换整首诗并校验原文映射，任何一行失败都不会产生半成品 DOCX。
            ConvertedPoem convertedPoem = convertPoem(poem, converter);
            convertedPoems.add(convertedPoem);
            hanziCount += convertedPoem.hanziCount();
            // 业务上结构校验按注音后实际显示行计数，长诗和长文拆行后每行都必须对应一个表格。
            bodyLineCount += (int) convertedPoem.lineCells().stream().filter(line -> !line.isEmpty()).count();
        }
        Path temporaryPath = Files.createTempFile(targetDirectory, ".poetry-pinyin-", ".tmp");
        try {
            // 业务上所有页面先写入同目录临时文件，通过结构校验后再替换正式输出。
            try (XWPFDocument document = new XWPFDocument()) {
                configurePage(document);
                document.getProperties().getCoreProperties().setTitle("小学古诗文拼音版");
                document.getProperties().getCoreProperties().setSubjectProperty("每篇从新页开始的拼音注音版");
                for (int index = 0; index < convertedPoems.size(); index++) {
                    // 业务上把分页绑定到下一篇首段，避免上一篇恰好占满页面时额外生成纯空白页。
                    addPoem(document, convertedPoems.get(index), index > 0);
                }
                try (OutputStream outputStream = Files.newOutputStream(temporaryPath)) {
                    // 业务上关闭文档前完成 ZIP 写入，确保 Word 和 WPS 都能读取完整包结构。
                    document.write(outputStream);
                }
            }
            // 业务上重新打开输出并校验分页和表格数量，提前发现结构性损坏或漏页。
            validateWrittenDocument(temporaryPath, poems.size(), bodyLineCount);
            moveCompletedFile(temporaryPath, targetPath, overwrite);
        } finally {
            // 业务上成功或失败都清除内部临时文件，不污染用户的交付目录。
            Files.deleteIfExists(temporaryPath);
        }
        return new GenerationResult(poems.size(), hanziCount, targetPath.toAbsolutePath().normalize());
    }

    /**
     * 转换一首诗的全部显示字段。
     *
     * @param poem 原始结构
     * @param converter 拼音转换器
     * @return 可直接渲染的结构
     */
    private ConvertedPoem convertPoem(PoetryDocumentParser.Poem poem, PinyinTextConverter converter) {
        // 业务上标题和朝代作者也必须带拼音，与正文采用同一纠音词典。
        List<PinyinTextConverter.PinyinCell> title = convertAndValidate(poem.title(), converter);
        List<PinyinTextConverter.PinyinCell> attribution = convertAndValidate(poem.attribution(), converter);
        List<List<PinyinTextConverter.PinyinCell>> lines = new ArrayList<>();
        int hanziCount = countHanzi(title) + countHanzi(attribution);
        for (String line : poem.lines()) {
            if (line.isBlank()) {
                // 业务上空字符串保留为分节留白，不创建没有字符的非法表格。
                lines.add(List.of());
            } else {
                List<PinyinTextConverter.PinyinCell> convertedLine = convertAndValidate(line, converter);
                // 业务上先完成整段注音和词典覆盖，再拆成页面显示行，避免跨行破坏上下文读音。
                lines.addAll(splitConvertedLine(convertedLine, config.standardColumns()));
                hanziCount += countHanzi(convertedLine);
            }
        }
        return new ConvertedPoem(poem, title, attribution, List.copyOf(lines), hanziCount);
    }

    /**
     * 将已完成语境注音的长行拆成页面显示行。
     *
     * @param cells 完整原文行的逐码点注音
     * @param maximumColumns 每个显示行最大码点数
     * @return 保持原文和拼音顺序的显示行
     */
    private List<List<PinyinTextConverter.PinyinCell>> splitConvertedLine(
        List<PinyinTextConverter.PinyinCell> cells,
        int maximumColumns
    ) {
        // 业务上短句保持原行，不制造无意义的二次分段。
        if (cells.size() <= maximumColumns) {
            return List.of(cells);
        }
        List<List<PinyinTextConverter.PinyinCell>> lines = new ArrayList<>();
        int start = 0;
        while (start < cells.size()) {
            // 业务上先建立不超过列宽的硬边界，再优先回退到后半行的原有标点。
            int hardEnd = Math.min(cells.size(), start + maximumColumns);
            int end = hardEnd;
            if (hardEnd < cells.size()) {
                int preferredMinimum = Math.min(hardEnd, start + Math.max(4, maximumColumns / 2));
                for (int index = hardEnd - 1; index >= preferredMinimum; index--) {
                    if (isBreakPunctuation(cells.get(index).text())) {
                        // 业务上标点保留在当前行末，下一行从后续原字符继续。
                        end = index + 1;
                        break;
                    }
                }
            }
            // 业务上复制当前区间为不可变显示行，不修改已裁决的拼音单元。
            lines.add(List.copyOf(cells.subList(start, end)));
            start = end;
        }
        return List.copyOf(lines);
    }

    /**
     * 判断原字符是否适合作为显示行停顿点。
     *
     * @param text 单个原文码点
     * @return 可在其后换行时为 true
     */
    private boolean isBreakPunctuation(String text) {
        // 业务上只使用源文档已有句读换行，不新增、删除或改写标点。
        return text.codePointCount(0, text.length()) == 1
            && "，。；！？：、”」』".contains(text);
    }

    /**
     * 转换文本并确认字符未被改写。
     *
     * @param original 原始文本
     * @param converter 拼音转换器
     * @return 注音单元
     * @throws IllegalStateException 重组的汉字和标点与原文不一致
     */
    private List<PinyinTextConverter.PinyinCell> convertAndValidate(
        String original,
        PinyinTextConverter converter
    ) {
        List<PinyinTextConverter.PinyinCell> cells = converter.convert(original);
        // 业务上重组全部码点后必须与原文完全一致，纠音只能改变拼音层。
        String reconstructed = cells.stream()
            .map(PinyinTextConverter.PinyinCell::text)
            .reduce("", String::concat);
        if (!original.equals(reconstructed)) {
            throw new IllegalStateException("拼音转换改变了原文: " + original);
        }
        return cells;
    }

    /**
     * 统计需要注音的汉字。
     *
     * @param cells 注音单元
     * @return 汉字数
     */
    private int countHanzi(List<PinyinTextConverter.PinyinCell> cells) {
        // 业务上统计只包含汉字，标点和括号不计入注音完成量。
        return (int) cells.stream()
            .filter(cell -> cell.type() == PinyinTextConverter.CellType.HANZI)
            .count();
    }

    /**
     * 添加一首完整诗页。
     *
     * @param document 目标文档
     * @param poem 已转换诗词
     * @param startOnNewPage 是否要求本篇从新页开始
     */
    private void addPoem(XWPFDocument document, ConvertedPoem poem, boolean startOnNewPage) {
        // 业务上统一使用 16 列阅读基线，当前教材最长诗句不超过该宽度。
        int standardColumns = Math.max(config.standardColumns(), poem.maximumColumnCount());
        // 业务上除首页外使用段前分页；即使前篇自然结束于页尾，也不会叠加出空白页。
        addTopSpace(document, startOnNewPage);
        addStackedTable(
            document,
            poem.titleCells(),
            standardColumns,
            config.titlePinyinFontPoints(),
            config.titleHanziFontPoints(),
            true
        );
        addGap(document, 180);
        // 业务上朝代与作者单独居中显示，字号小于标题但明显区别于正文。
        addStackedTable(document, poem.attributionCells(), standardColumns, 7.5, 14.0, false);
        addGap(document, 520);
        for (List<PinyinTextConverter.PinyinCell> line : poem.lineCells()) {
            if (line.isEmpty()) {
                // 业务上词牌上下阕的空段使用较大留白表达，不显示空表格或占位字符。
                addGap(document, 180);
            } else {
                addStackedTable(
                    document,
                    line,
                    standardColumns,
                    config.bodyPinyinFontPoints(),
                    config.bodyHanziFontPoints(),
                    false
                );
                addGap(document, config.paragraphGapTwips());
            }
        }
    }

    /**
     * 配置 A4 页面和疏朗页边距。
     *
     * @param document 目标文档
     */
    private void configurePage(XWPFDocument document) {
        CTSectPr section = document.getDocument().getBody().isSetSectPr()
            ? document.getDocument().getBody().getSectPr()
            : document.getDocument().getBody().addNewSectPr();
        // 业务上纸张尺寸固定为配置中的 A4 纵向值，避免 Office 自动采用本机默认纸型。
        CTPageSz pageSize = section.isSetPgSz() ? section.getPgSz() : section.addNewPgSz();
        pageSize.setW(BigInteger.valueOf(config.pageWidthTwips()));
        pageSize.setH(BigInteger.valueOf(config.pageHeightTwips()));
        CTPageMar margin = section.isSetPgMar() ? section.getPgMar() : section.addNewPgMar();
        // 业务上一诗一页使用更宽上下留白，使短诗不挤在页面顶部。
        margin.setLeft(BigInteger.valueOf(config.horizontalMarginTwips()));
        margin.setRight(BigInteger.valueOf(config.horizontalMarginTwips()));
        margin.setTop(BigInteger.valueOf(config.verticalMarginTwips()));
        margin.setBottom(BigInteger.valueOf(config.verticalMarginTwips()));
        margin.setHeader(BigInteger.valueOf(360));
        margin.setFooter(BigInteger.valueOf(360));
        margin.setGutter(BigInteger.ZERO);
    }

    /**
     * 添加页面顶部呼吸空间。
     *
     * @param document 目标文档
     * @param startOnNewPage 是否把本段作为新篇页首
     */
    private void addTopSpace(XWPFDocument document, boolean startOnNewPage) {
        XWPFParagraph paragraph = document.createParagraph();
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
        // 业务上使用段前分页而非运行内换页符，消除内容恰好满页时产生的额外空页。
        paragraph.setPageBreak(startOnNewPage);
        // 业务上固定顶部留白让标题落在页面上部视觉中心，而不是紧贴页边距。
        paragraph.setSpacingBetween(3.0);
        // 业务上最小占位字符让 Word 与 WPS 对顶部留白采用一致高度。
        XWPFRun run = paragraph.createRun();
        run.setText(" ");
        run.setFontSize(1.0);
    }

    /**
     * 添加逐字上下对齐的无边框表格。
     *
     * @param document 目标文档
     * @param cells 注音单元
     * @param standardColumns 当前诗页统一列数
     * @param pinyinFontPoints 拼音字号
     * @param hanziFontPoints 汉字字号
     * @param bold 汉字是否加粗
     */
    private void addStackedTable(
        XWPFDocument document,
        List<PinyinTextConverter.PinyinCell> cells,
        int standardColumns,
        double pinyinFontPoints,
        double hanziFontPoints,
        boolean bold
    ) {
        // 业务上每个原文码点独占一列，拼音与对应汉字位于同一不可拆表格行。
        XWPFTable table = document.createTable(1, cells.size());
        table.setTableAlignment(TableRowAlign.CENTER);
        configureTable(table, cells.size(), standardColumns);
        XWPFTableRow row = table.getRow(0);
        configureRow(row, config.pinyinRowHeightTwips() + config.hanziRowHeightTwips());
        for (int index = 0; index < cells.size(); index++) {
            // 业务上标题、署名和正文共享相同对齐内核，只通过字号和粗体形成层级。
            configureCell(row.getCell(index), cells.get(index), pinyinFontPoints, hanziFontPoints, bold);
        }
    }

    /**
     * 配置固定列宽和无边框表格。
     *
     * @param table 表格
     * @param columnCount 实际字符列数
     * @param standardColumns 页面统一列数
     */
    private void configureTable(XWPFTable table, int columnCount, int standardColumns) {
        CTTblPr properties = table.getCTTbl().getTblPr();
        int columnWidth = Math.max(1, config.contentWidthTwips() / standardColumns);
        // 业务上短句保持固定字距并整体居中，长句也不会超出页面正文宽度。
        CTTblWidth width = properties.isSetTblW() ? properties.getTblW() : properties.addNewTblW();
        width.setType(STTblWidth.DXA);
        width.setW(BigInteger.valueOf(columnWidth * columnCount));
        CTTblLayoutType layout = properties.isSetTblLayout() ? properties.getTblLayout() : properties.addNewTblLayout();
        layout.setType(STTblLayoutType.FIXED);
        // 业务上六类边框全部关闭，表格只承担稳定的上下字音对齐职责。
        table.setTopBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setBottomBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setLeftBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setRightBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setInsideHBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setInsideVBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        for (XWPFTableCell cell : table.getRow(0).getTableCells()) {
            // 业务上每格宽度显式使用 DXA 数值，避免 Word 与 WPS 对自动宽度做不同计算。
            cell.setWidth(Integer.toString(columnWidth));
        }
    }

    /**
     * 配置不可跨页拆分的表格行。
     *
     * @param row 目标行
     * @param heightTwips 行高
     */
    private void configureRow(XWPFTableRow row, int heightTwips) {
        row.setHeight(heightTwips);
        CTRow rowProperties = row.getCtRow();
        if (!rowProperties.isSetTrPr()) {
            // 业务上先确保行属性存在，再添加禁止跨页标记。
            rowProperties.addNewTrPr();
        }
        if (rowProperties.getTrPr().sizeOfCantSplitArray() == 0) {
            // 业务上拼音层和汉字层绝不能被分页拆开。
            rowProperties.getTrPr().addNewCantSplit();
        }
    }

    /**
     * 配置一个上下叠放的字音单元格。
     *
     * @param cell 单元格
     * @param value 注音单元
     * @param pinyinFontPoints 拼音字号
     * @param hanziFontPoints 汉字字号
     * @param bold 汉字是否加粗
     */
    private void configureCell(
        XWPFTableCell cell,
        PinyinTextConverter.PinyinCell value,
        double pinyinFontPoints,
        double hanziFontPoints,
        boolean bold
    ) {
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
        CTTcPr properties = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTcMar margin = properties.isSetTcMar() ? properties.getTcMar() : properties.addNewTcMar();
        // 业务上清空四向内边距，使拼音准确落在对应汉字正上方。
        zeroMargin(margin.isSetTop() ? margin.getTop() : margin.addNewTop());
        zeroMargin(margin.isSetBottom() ? margin.getBottom() : margin.addNewBottom());
        zeroMargin(margin.isSetLeft() ? margin.getLeft() : margin.addNewLeft());
        zeroMargin(margin.isSetRight() ? margin.getRight() : margin.addNewRight());
        XWPFParagraph pinyinParagraph = cell.getParagraphs().get(0);
        configureCellParagraph(pinyinParagraph);
        pinyinParagraph.setKeepNext(true);
        XWPFRun pinyinRun = pinyinParagraph.createRun();
        pinyinRun.setText(value.pinyin());
        configureRun(pinyinRun, config.pinyinFontFamily(), pinyinFontPoints, false);
        XWPFParagraph hanziParagraph = cell.addParagraph();
        configureCellParagraph(hanziParagraph);
        XWPFRun hanziRun = hanziParagraph.createRun();
        hanziRun.setText(value.text());
        configureRun(hanziRun, config.hanziFontFamily(), hanziFontPoints, bold);
    }

    /**
     * 配置单元格段落的零间距居中样式。
     *
     * @param paragraph 单元格段落
     */
    private void configureCellParagraph(XWPFParagraph paragraph) {
        // 业务上拼音和汉字使用相同的水平、垂直中心线，保持逐字对应关系。
        paragraph.setAlignment(ParagraphAlignment.CENTER);
        paragraph.setVerticalAlignment(TextAlignment.CENTER);
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
    }

    /**
     * 清空单元格边距。
     *
     * @param width 边距宽度节点
     */
    private void zeroMargin(CTTblWidth width) {
        // 业务上固定使用 DXA 零值，消除不同 Office 默认单元格边距差异。
        width.setType(STTblWidth.DXA);
        width.setW(BigInteger.ZERO);
    }

    /**
     * 配置文本字体。
     *
     * @param run 文本运行
     * @param fontFamily 字体名称
     * @param fontPoints 字号
     * @param bold 是否加粗
     */
    private void configureRun(XWPFRun run, String fontFamily, double fontPoints, boolean bold) {
        // 业务上显式设置中西文字体、字号和粗体，减少跨 Office 环境版式漂移。
        run.setFontFamily(fontFamily);
        run.setFontSize(fontPoints);
        run.setBold(bold);
    }

    /**
     * 添加稳定留白段落。
     *
     * @param document 目标文档
     * @param twips 留白高度
     */
    private void addGap(XWPFDocument document, int twips) {
        XWPFParagraph gap = document.createParagraph();
        gap.setSpacingBefore(0);
        gap.setSpacingAfter(0);
        // 业务上使用明确行距和最小占位字符，让 Word 与 WPS 对留白高度采用一致解释。
        gap.setSpacingBetween(Math.max(1, twips) / 240.0);
        XWPFRun run = gap.createRun();
        run.setText(" ");
        run.setFontSize(1.0);
    }

    /**
     * 校验临时 DOCX 的诗页结构。
     *
     * @param path 临时文件
     * @param poemCount 诗词数
     * @param bodyLineCount 非空正文行数
     * @throws IOException 文件无法重读
     * @throws IllegalStateException 表格、分页或 EQ 域结构不符合一诗一页约束
     */
    private void validateWrittenDocument(Path path, int poemCount, int bodyLineCount) throws IOException {
        try (InputStream inputStream = Files.newInputStream(path);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            // 业务上每首诗固定包含标题和署名两个表格，并为每条非空正文创建一个表格。
            int expectedTables = poemCount * 2 + bodyLineCount;
            if (document.getTables().size() != expectedTables) {
                throw new IllegalStateException(
                    "诗词表格数量异常 expected=" + expectedTables + ", actual=" + document.getTables().size()
                );
            }
            // 业务上段前分页数量应比篇目数少一，保证下一篇另起页且不制造纯空白页。
            long pageBreaks = document.getParagraphs().stream()
                .filter(XWPFParagraph::isPageBreak)
                .count();
            if (pageBreaks != poemCount - 1L) {
                throw new IllegalStateException("诗词分页数量异常 expected=" + (poemCount - 1) + ", actual=" + pageBreaks);
            }
            // 业务上禁止输出旧式 EQ 域代码，避免再次出现用户截图中的整页乱码。
            if (document.getDocument().xmlText().contains("EQ \\* jc0")) {
                throw new IllegalStateException("生成文档包含不兼容的 EQ 域代码");
            }
        }
    }

    /**
     * 原子移动已校验文件。
     *
     * @param temporaryPath 临时文件
     * @param targetPath 目标文件
     * @param overwrite 是否覆盖
     * @throws IOException 移动失败
     */
    private void moveCompletedFile(Path temporaryPath, Path targetPath, boolean overwrite) throws IOException {
        List<StandardCopyOption> options = new ArrayList<>();
        // 业务上优先原子替换，防止读者在生成瞬间打开不完整文件。
        options.add(StandardCopyOption.ATOMIC_MOVE);
        if (overwrite) {
            options.add(StandardCopyOption.REPLACE_EXISTING);
        }
        try {
            Files.move(temporaryPath, targetPath, options.toArray(StandardCopyOption[]::new));
        } catch (AtomicMoveNotSupportedException exception) {
            // 业务上不支持原子移动时保持相同覆盖策略退化为普通移动。
            if (overwrite) {
                Files.move(temporaryPath, targetPath, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Files.move(temporaryPath, targetPath);
            }
        }
    }

    /**
     * 一首诗的转换结果。
     *
     * @param source 源结构
     * @param titleCells 标题注音
     * @param attributionCells 朝代作者注音
     * @param lineCells 正文注音
     * @param hanziCount 汉字数
     */
    private record ConvertedPoem(
        PoetryDocumentParser.Poem source,
        List<PinyinTextConverter.PinyinCell> titleCells,
        List<PinyinTextConverter.PinyinCell> attributionCells,
        List<List<PinyinTextConverter.PinyinCell>> lineCells,
        int hanziCount
    ) {

        /**
         * 计算本诗标题、署名和正文需要的最大字符列数。
         *
         * @return 本诗页的最大字符列数
         */
        private int maximumColumnCount() {
            // 业务上以标题、署名和正文中的最长一行确定本诗页列宽，任何字段都不会横向溢出。
            int maximum = Math.max(titleCells.size(), attributionCells.size());
            for (List<PinyinTextConverter.PinyinCell> line : lineCells) {
                maximum = Math.max(maximum, line.size());
            }
            return maximum;
        }
    }

    /**
     * 诗词生成统计。
     *
     * @param poemCount 诗词数
     * @param hanziCount 已注音汉字数
     * @param targetPath 输出路径
     */
    public record GenerationResult(int poemCount, int hanziCount, Path targetPath) {
    }
}
