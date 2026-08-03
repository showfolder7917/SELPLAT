package com.sp.selplat.local.code.common.中文教学.拼音生成;

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
 * 将逐字拼音单元渲染成跨 WPS 和 Microsoft Word 稳定显示的 DOCX。
 */
public final class PinyinDocxRenderer {

    private final PinyinGenerationConfig config;

    /**
     * 创建 DOCX 渲染器。
     *
     * @param config 页面与字体配置
     */
    public PinyinDocxRenderer(PinyinGenerationConfig config) {
        // 业务上版式由外部配置注入，使生成内核可以复用于其它中文经典和普通文档。
        this.config = config;
    }

    /**
     * 将原文段落生成到新的 DOCX 文件。
     *
     * @param sourceParagraphs 按源文档顺序提取的非空段落
     * @param targetPath 目标 DOCX 路径
     * @param converter 拼音转换器
     * @param overwrite 是否允许覆盖目标
     * @return 生成结果统计
     * @throws IOException 文档读写失败
     * @throws IllegalArgumentException 源段落为空或目标路径不符合覆盖与目录约束
     */
    public GenerationResult render(
        List<String> sourceParagraphs,
        Path targetPath,
        PinyinTextConverter converter,
        boolean overwrite
    ) throws IOException {
        // 业务上首个非空段落作为文档标题，后续段落均按原顺序生成正文注音排。
        if (sourceParagraphs.isEmpty()) {
            throw new IllegalArgumentException("源文档没有可生成的非空段落");
        }
        // 业务上默认拒绝覆盖已有交付物，避免人工校对后的文档被无提示替换。
        if (Files.exists(targetPath) && !overwrite) {
            throw new IllegalArgumentException("目标文件已存在，未允许覆盖: " + targetPath);
        }
        // 业务上提前建立目标目录，使同一工具可直接服务任意用户指定的输出位置。
        Path targetDirectory = targetPath.toAbsolutePath().normalize().getParent();
        if (targetDirectory == null) {
            throw new IllegalArgumentException("目标文件缺少父目录: " + targetPath);
        }
        Files.createDirectories(targetDirectory);
        // 业务上先把所有段落转换完成并校验原文，防止写到一半才发现纠音或字符对齐错误。
        List<List<PinyinTextConverter.PinyinCell>> convertedParagraphs = new ArrayList<>();
        int hanziCount = 0;
        for (String paragraph : sourceParagraphs) {
            List<PinyinTextConverter.PinyinCell> cells = converter.convert(paragraph);
            validateOriginalText(paragraph, cells);
            convertedParagraphs.add(cells);
            hanziCount += (int) cells.stream()
                .filter(cell -> cell.type() == PinyinTextConverter.CellType.HANZI)
                .count();
        }
        // 业务上使用目标目录中的临时文件，校验成功后再移动，避免失败时留下可误用的半成品 DOCX。
        Path temporaryPath = Files.createTempFile(targetDirectory, ".pinyin-docx-", ".tmp");
        try {
            // 业务上在一个受控文档生命周期中完成页面、标题和正文表格构建。
            try (XWPFDocument document = new XWPFDocument()) {
                configurePage(document);
                document.getProperties().getCoreProperties().setTitle(sourceParagraphs.get(0));
                document.getProperties().getCoreProperties().setSubjectProperty("拼音注音版");
                addTitle(document, sourceParagraphs.get(0), convertedParagraphs.get(0));
                // 业务上每个源正文段落对应一个独立注音表格，保持原文的自然断句和阅读节奏。
                for (int index = 1; index < sourceParagraphs.size(); index++) {
                    addPinyinTable(document, convertedParagraphs.get(index));
                    addParagraphGap(document);
                }
                // 业务上写入临时文件后关闭文档，确保 ZIP 中央目录完整落盘。
                try (OutputStream outputStream = Files.newOutputStream(temporaryPath)) {
                    document.write(outputStream);
                }
            }
            // 业务上重新打开临时 DOCX 并检查表格数，提前捕获损坏包或结构丢失问题。
            validateWrittenDocument(temporaryPath, sourceParagraphs.size() - 1);
            moveCompletedFile(temporaryPath, targetPath, overwrite);
        } finally {
            // 业务上无论成功或失败都清理临时文件，不在输出目录遗留内部中间产物。
            Files.deleteIfExists(temporaryPath);
        }
        // 业务上返回可记录的统计数据，便于批量生成其它文档时形成统一审计结果。
        return new GenerationResult(sourceParagraphs.size(), hanziCount, targetPath.toAbsolutePath().normalize());
    }

    /**
     * 配置 A4 页面和统一页边距。
     *
     * @param document 目标 DOCX
     */
    private void configurePage(XWPFDocument document) {
        // 业务上确保文档存在节属性，再写入与参考版式一致的纸张和留白。
        CTSectPr sectionProperties = document.getDocument().getBody().isSetSectPr()
            ? document.getDocument().getBody().getSectPr()
            : document.getDocument().getBody().addNewSectPr();
        CTPageSz pageSize = sectionProperties.isSetPgSz() ? sectionProperties.getPgSz() : sectionProperties.addNewPgSz();
        pageSize.setW(BigInteger.valueOf(config.pageWidthTwips()));
        pageSize.setH(BigInteger.valueOf(config.pageHeightTwips()));
        CTPageMar pageMargin = sectionProperties.isSetPgMar() ? sectionProperties.getPgMar() : sectionProperties.addNewPgMar();
        pageMargin.setLeft(BigInteger.valueOf(config.horizontalMarginTwips()));
        pageMargin.setRight(BigInteger.valueOf(config.horizontalMarginTwips()));
        pageMargin.setTop(BigInteger.valueOf(config.verticalMarginTwips()));
        pageMargin.setBottom(BigInteger.valueOf(config.verticalMarginTwips()));
        // 业务上页眉页脚留白保持较小，避免无页眉文档无故压缩正文区域。
        pageMargin.setHeader(BigInteger.valueOf(360));
        pageMargin.setFooter(BigInteger.valueOf(360));
        pageMargin.setGutter(BigInteger.ZERO);
    }

    /**
     * 添加标题拼音和标题原文。
     *
     * @param document 目标 DOCX
     * @param title 原始标题
     * @param titleCells 标题逐码点注音
     */
    private void addTitle(
        XWPFDocument document,
        String title,
        List<PinyinTextConverter.PinyinCell> titleCells
    ) {
        // 业务上标题拼音单独居中显示，视觉上对应参考文档的标题注音层。
        XWPFParagraph pinyinParagraph = document.createParagraph();
        pinyinParagraph.setAlignment(ParagraphAlignment.CENTER);
        pinyinParagraph.setSpacingAfter(0);
        XWPFRun pinyinRun = pinyinParagraph.createRun();
        pinyinRun.setText(titleCells.stream()
            .filter(cell -> cell.type() == PinyinTextConverter.CellType.HANZI)
            .map(PinyinTextConverter.PinyinCell::pinyin)
            .reduce((left, right) -> left + "  " + right)
            .orElse(""));
        configureRun(pinyinRun, config.pinyinFontFamily(), config.titlePinyinFontPoints(), false);
        // 业务上标题汉字保持源文档原值，包括人工设置的空格，不擅自规范化正文内容。
        XWPFParagraph titleParagraph = document.createParagraph();
        titleParagraph.setAlignment(ParagraphAlignment.CENTER);
        titleParagraph.setSpacingAfter(420);
        titleParagraph.setKeepNext(true);
        XWPFRun titleRun = titleParagraph.createRun();
        titleRun.setText(title);
        configureRun(titleRun, config.hanziFontFamily(), config.titleHanziFontPoints(), true);
    }

    /**
     * 添加一排“拼音在上、原文在下”的无边框表格。
     *
     * @param document 目标 DOCX
     * @param cells 段落逐码点注音结果
     */
    private void addPinyinTable(XWPFDocument document, List<PinyinTextConverter.PinyinCell> cells) {
        // 业务上每个 Unicode 码点占一列，拼音和汉字放在同一个表格行内，防止两层被分页拆开。
        XWPFTable table = document.createTable(1, cells.size());
        table.setTableAlignment(TableRowAlign.LEFT);
        configureTableLayout(table, cells.size());
        XWPFTableRow contentRow = table.getRow(0);
        configureRow(contentRow, config.pinyinRowHeightTwips() + config.hanziRowHeightTwips());
        for (int index = 0; index < cells.size(); index++) {
            // 业务上单元格内部使用上下两个段落，让同一字的拼音和汉字始终作为一个整体移动。
            PinyinTextConverter.PinyinCell cell = cells.get(index);
            configureStackedCell(contentRow.getCell(index), cell);
        }
    }

    /**
     * 配置固定宽度表格并隐藏全部边框。
     *
     * @param table 目标表格
     * @param columnCount 当前段落列数
     */
    private void configureTableLayout(XWPFTable table, int columnCount) {
        // 业务上按标准列数确定单字宽度，短段落不会被拉伸成整页宽。
        CTTblPr tableProperties = table.getCTTbl().getTblPr();
        CTTblWidth tableWidth = tableProperties.isSetTblW() ? tableProperties.getTblW() : tableProperties.addNewTblW();
        tableWidth.setType(STTblWidth.DXA);
        int standardColumnWidth = Math.max(1, config.contentWidthTwips() / config.standardColumns());
        int actualTableWidth = standardColumnWidth * columnCount;
        tableWidth.setW(BigInteger.valueOf(actualTableWidth));
        CTTblLayoutType layout = tableProperties.isSetTblLayout()
            ? tableProperties.getTblLayout()
            : tableProperties.addNewTblLayout();
        layout.setType(STTblLayoutType.FIXED);
        // 业务上明确关闭六类边框，保证表格只承担对齐职责而不显示网格。
        table.setTopBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setBottomBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setLeftBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setRightBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setInsideHBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        table.setInsideVBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "FFFFFF");
        // 业务上所有段落使用同一个标准列宽，保持全文稳定字距和左侧阅读基线。
        int columnWidth = standardColumnWidth;
        for (XWPFTableRow row : table.getRows()) {
            for (XWPFTableCell cell : row.getTableCells()) {
                cell.setWidth(Integer.toString(columnWidth));
            }
        }
    }

    /**
     * 配置不可跨页拆分的注音行。
     *
     * @param row 表格行
     * @param heightTwips 行高
     */
    private void configureRow(XWPFTableRow row, int heightTwips) {
        // 业务上同一拼音行或汉字行不可被 Word 拆到两页，避免上下层分离。
        row.setHeight(heightTwips);
        CTRow ctRow = row.getCtRow();
        if (!ctRow.isSetTrPr()) {
            ctRow.addNewTrPr();
        }
        if (ctRow.getTrPr().sizeOfCantSplitArray() == 0) {
            ctRow.getTrPr().addNewCantSplit();
        }
    }

    /**
     * 配置单元格中的拼音段和汉字段。
     *
     * @param cell 目标单元格
     * @param pinyinCell 当前原文码点及拼音
     */
    private void configureStackedCell(XWPFTableCell cell, PinyinTextConverter.PinyinCell pinyinCell) {
        // 业务上垂直居中并清除默认单元格边距，缩短拼音与汉字之间的视觉距离。
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
        CTTcPr cellProperties = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTcMar cellMargin = cellProperties.isSetTcMar() ? cellProperties.getTcMar() : cellProperties.addNewTcMar();
        setCellMargin(cellMargin.isSetTop() ? cellMargin.getTop() : cellMargin.addNewTop());
        setCellMargin(cellMargin.isSetBottom() ? cellMargin.getBottom() : cellMargin.addNewBottom());
        setCellMargin(cellMargin.isSetLeft() ? cellMargin.getLeft() : cellMargin.addNewLeft());
        setCellMargin(cellMargin.isSetRight() ? cellMargin.getRight() : cellMargin.addNewRight());
        // 业务上复用默认段落作为拼音层，并要求它与紧随的汉字段保持同页。
        XWPFParagraph pinyinParagraph = cell.getParagraphs().get(0);
        configureCellParagraph(pinyinParagraph);
        pinyinParagraph.setKeepNext(true);
        XWPFRun pinyinRun = pinyinParagraph.createRun();
        pinyinRun.setText(pinyinCell.pinyin());
        configureRun(pinyinRun, config.pinyinFontFamily(), config.bodyPinyinFontPoints(), false);
        // 业务上新增第二段作为原文层，标点同样保留在对应列而不生成拼音。
        XWPFParagraph hanziParagraph = cell.addParagraph();
        configureCellParagraph(hanziParagraph);
        XWPFRun hanziRun = hanziParagraph.createRun();
        hanziRun.setText(pinyinCell.text());
        configureRun(hanziRun, config.hanziFontFamily(), config.bodyHanziFontPoints(), false);
    }

    /**
     * 配置单元格内部段落的统一对齐和间距。
     *
     * @param paragraph 拼音段或汉字段
     */
    private void configureCellParagraph(XWPFParagraph paragraph) {
        // 业务上上下两层共享居中和零段距，确保一个拼音只对应正下方的一个原文字符。
        paragraph.setAlignment(ParagraphAlignment.CENTER);
        paragraph.setVerticalAlignment(TextAlignment.CENTER);
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
    }

    /**
     * 把单元格某一方向的边距归零。
     *
     * @param marginWidth OOXML 单元格边距宽度
     */
    private void setCellMargin(CTTblWidth marginWidth) {
        // 业务上边距归零且使用 DXA 单位，避免 WPS 与 Word 对缺省百分比边距产生不同解释。
        marginWidth.setType(STTblWidth.DXA);
        marginWidth.setW(BigInteger.ZERO);
    }

    /**
     * 配置一个文本运行的中西文字体和字号。
     *
     * @param run 文本运行
     * @param fontFamily 字体
     * @param fontPoints 字号
     * @param bold 是否加粗
     */
    private void configureRun(XWPFRun run, String fontFamily, double fontPoints, boolean bold) {
        // 业务上同时设置字体、字号和粗体，减少不同 Office 默认样式导致的版式漂移。
        run.setFontFamily(fontFamily);
        run.setFontSize(fontPoints);
        run.setBold(bold);
    }

    /**
     * 在相邻注音排之间添加稳定的小段留白。
     *
     * @param document 目标 DOCX
     */
    private void addParagraphGap(XWPFDocument document) {
        // 业务上使用明确行距的空段落模拟参考文档的疏朗行距，不依赖表格后的 Office 缺省间距。
        XWPFParagraph gapParagraph = document.createParagraph();
        gapParagraph.setSpacingBefore(0);
        gapParagraph.setSpacingAfter(0);
        gapParagraph.setSpacingBetween(config.paragraphGapTwips() / 240.0);
        XWPFRun gapRun = gapParagraph.createRun();
        gapRun.setText(" ");
        gapRun.setFontSize(1.0);
    }

    /**
     * 校验转换结果没有改变原文码点顺序。
     *
     * @param original 原始段落
     * @param cells 转换结果
     * @throws IllegalStateException 重组的汉字和标点与原文不一致
     */
    private void validateOriginalText(String original, List<PinyinTextConverter.PinyinCell> cells) {
        // 业务上重新拼接每个渲染单元，确保纠音过程只增加拼音而没有改写汉字和标点。
        String reconstructed = cells.stream()
            .map(PinyinTextConverter.PinyinCell::text)
            .reduce("", String::concat);
        if (!original.equals(reconstructed)) {
            throw new IllegalStateException("拼音转换改变了原文: original=" + original + ", reconstructed=" + reconstructed);
        }
    }

    /**
     * 重新打开生成文件并验证正文表格数量。
     *
     * @param temporaryPath 临时 DOCX
     * @param expectedTableCount 预期正文段落数
     * @throws IOException DOCX 无法重新读取
     * @throws IllegalStateException 输出表格数或组合注音行结构不符合预期
     */
    private void validateWrittenDocument(Path temporaryPath, int expectedTableCount) throws IOException {
        // 业务上重新打开输出包，确认文件不是仅写入了一部分 ZIP 内容的损坏文档。
        try (InputStream inputStream = Files.newInputStream(temporaryPath);
             XWPFDocument document = new XWPFDocument(inputStream)) {
            if (document.getTables().size() != expectedTableCount) {
                throw new IllegalStateException(
                    "生成表格数量异常 expected=" + expectedTableCount + ", actual=" + document.getTables().size()
                );
            }
            // 业务上每个正文表格必须恰好包含一个不可拆分行，杜绝拼音层与原文层跨页分离。
            boolean malformedTable = document.getTables().stream().anyMatch(table -> table.getRows().size() != 1);
            if (malformedTable) {
                throw new IllegalStateException("生成文档存在非单行组合注音表格");
            }
        }
    }

    /**
     * 把校验完成的临时文件移动到最终目标。
     *
     * @param temporaryPath 临时文件
     * @param targetPath 最终文件
     * @param overwrite 是否允许覆盖
     * @throws IOException 文件移动失败
     */
    private void moveCompletedFile(Path temporaryPath, Path targetPath, boolean overwrite) throws IOException {
        // 业务上根据覆盖策略构造移动选项，默认不触碰已有人工成果。
        List<StandardCopyOption> options = new ArrayList<>();
        options.add(StandardCopyOption.ATOMIC_MOVE);
        if (overwrite) {
            options.add(StandardCopyOption.REPLACE_EXISTING);
        }
        try {
            Files.move(temporaryPath, targetPath, options.toArray(StandardCopyOption[]::new));
        } catch (AtomicMoveNotSupportedException exception) {
            // 业务上文件系统不支持原子移动时退化为同目录普通移动，但仍保持相同覆盖策略。
            if (overwrite) {
                Files.move(temporaryPath, targetPath, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Files.move(temporaryPath, targetPath);
            }
        }
    }

    /**
     * 文档生成统计。
     *
     * @param paragraphCount 包含标题的非空段落数
     * @param hanziCount 已注音汉字总数
     * @param targetPath 最终输出路径
     */
    public record GenerationResult(int paragraphCount, int hanziCount, Path targetPath) {
    }
}
