package com.sp.selplat.local.code.common.fujitsu.app.design;

import java.awt.Color;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFShape;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFSimpleShape;
import org.apache.poi.xssf.usermodel.XSSFTextParagraph;
import org.apache.poi.xssf.usermodel.XSSFTextRun;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * JSON で指定された業務機能（API）概要を、指定された Excel テンプレートから生成する。
 * 業務固有データは Java に保持せず、レビュー対象を含む JSON を唯一の入力データとする。
 */
public final class SbmaaApiOverviewGenerator {

    // 无参数运行从工程内数据目录发现唯一API概要JSON → Java不固定任何业务文件名。
    private static final Path DEFAULT_SPEC_DIRECTORY = Path.of("OPTION", "561", "data");

    // JSON 映射拒绝未知字段 → 配置拼写错误不会被静默忽略并生成缺项设计书。
    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);

    // 生成入口只提供静态业务能力 → 禁止创建无状态实例造成不同调用行为。
    private SbmaaApiOverviewGenerator() {
    }

    /**
     * JSON データを読み込み、指定テンプレートから API 概要 Excel を生成する。
     *
     * @param args 生成データ JSON の工程内パス。入力例：
     *             {@code OPTION/561/data/SBMAA9xx_自動保存ファイルダウンロード.api-overview.json}。
     *             空配列の場合は既定 JSON を使用する。
     * 実行結果例：JSON の {@code output} が
     * {@code OPTION/561/create/業務機能（API）概要 SBMAA9xx_自動保存ファイルダウンロード.xlsx}
     * の場合、その Excel を生成し、テンプレートと JSON は変更しない。
     * @throws Exception JSON、テンプレートまたは出力先が不正な場合。例：
     *                   {@code IllegalArgumentException("テンプレートが存在しません: ...")}。
     */
    public static void main(String[] args) throws Exception {
        // 当前工作目录向上识别工程根 → 数据、模板和生成物均约束在当前工程内。
        Path projectRoot = locateProjectRoot();
        // 仅允许零个或一个参数 → 防止旧版“模板+输出”调用绕过JSON业务数据。
        Path specPath = resolveSpecPath(projectRoot, args);
        // UTF-8 JSON 映射为只读配置结构 → Java 不再保存业务文件名或设计内容。
        GenerationSpec spec = readAndValidateSpec(projectRoot, specPath);
        // JSON中的模板和输出均相对工程解析 → 生成器不会读写其他工程。
        Path template = resolveInsideProject(projectRoot, spec.template());
        Path output = resolveInsideProject(projectRoot, spec.output());
        // 模板缺失时在创建输出目录前失败 → 不留下误导性的空目录或半成品。
        requireReadableTemplate(template);
        // 明确创建JSON指定的生成目录 → 正式结果落在用户要求的create目录。
        Files.createDirectories(output.getParent());

        // 模板只读打开并在内存中生成副本 → 原始参考资料保持不变。
        try (InputStream input = Files.newInputStream(template);
                XSSFWorkbook workbook = new XSSFWorkbook(input)) {
            // 单一API概要必须使用单Sheet模板 → 模板结构变化时阻止错误套版。
            if (workbook.getNumberOfSheets() != 1) {
                throw new IllegalArgumentException(
                        "API概要テンプレートのシート数が1ではありません: " + workbook.getNumberOfSheets());
            }
            // 唯一业务Sheet承载流程、接口、文件和表定义 → 所有JSON动作在同一版式执行。
            XSSFSheet sheet = workbook.getSheetAt(0);
            // 先清除参考业务区，再写入普通单元格 → 防止参考业务文字残留。
            applyBaseCells(workbook, sheet, spec);
            // 根据JSON文件数量扩展清单 → 每个业务文件保持独立一行。
            applyRelatedFiles(sheet, spec.relatedFiles());
            // 写入移动后的表清单等坐标 → JSON明确使用最终版式坐标。
            applyCellWrites(sheet, spec.postShiftCells());
            // 图形只按JSON映射转换 → Java不依赖任何具体业务名称。
            applyDrawingReplacements(sheet, spec.drawingReplacements());
            // 打印区域随新增文件行扩展 → 文件清单与后续表均进入打印结果。
            updatePrintArea(workbook, sheet);
            // 待确认文字按JSON标识统一标红 → 客户评审范围在单元格和流程图中可见。
            markReviewContentRed(workbook, spec.reviewMarkers());
            // 完整写入临时文件后替换目标 → 生成异常不会破坏上次可用结果。
            writeAtomically(workbook, output);
        }
        // 输出真实生成位置 → 人工执行后可以直接定位交付物。
        System.out.println("generated: " + output);
    }

    // JSON根结构描述一次生成所需全部数据 → 模板选择、内容和评审标识均可独立审查。
    private record GenerationSpec(
            String template,
            String output,
            String sheetName,
            List<String> dateCells,
            List<ClearRange> clearRanges,
            List<CellWrite> cells,
            RelatedFiles relatedFiles,
            List<CellWrite> postShiftCells,
            List<DrawingReplacement> drawingReplacements,
            List<String> reviewMarkers) {
    }

    // 清理范围采用零起始行列 → 与POI坐标一致并避免大量空单元格地址配置。
    private record ClearRange(int firstRow, int lastRow, int firstColumn, int lastColumn) {
    }

    // 普通文本坐标与业务值成对保存 → 设计内容完全留在JSON数据层。
    private record CellWrite(String address, String value) {
    }

    // 文件清单同时声明模板结构和业务条目 → 模板换版时只需调整JSON。
    private record RelatedFiles(
            int startExcelRow,
            int templateExcelRow,
            int existingTemplateRows,
            List<FileEntry> entries) {
    }

    // 单个文件条目保持接口ID、名称、方向和备注 → 每行数据可以独立追溯和评审。
    private record FileEntry(String id, String name, String io, String note) {
    }

    // 图形替换区分整体替换与片段替换 → 文件框和流程标签采用各自安全策略。
    private record DrawingReplacement(String match, String replacement, boolean wholeShape) {
    }

    // 应用普通内容前先重命名并清理参考业务 → JSON写入后不会混入旧模板语义。
    private static void applyBaseCells(XSSFWorkbook workbook, XSSFSheet sheet, GenerationSpec spec) {
        // Sheet名称来自数据层 → 同一生成器可以复用到后续API。
        workbook.setSheetName(workbook.getSheetIndex(sheet), spec.sheetName());
        // 每个清理矩形仅清值保样式 → 参考模板的版式和边框继续使用。
        for (ClearRange range : spec.clearRanges()) {
            clearValues(sheet, range);
        }
        // 业务正文逐坐标写入 → JSON是可审查的唯一内容来源。
        applyCellWrites(sheet, spec.cells());
        // 制作日使用实际执行日 → 保留模板日期格式并避免JSON频繁维护日期。
        for (String address : spec.dateCells()) {
            setDate(sheet, address, LocalDate.now());
        }
    }

    // 将JSON普通单元格列表按顺序写入 → 后项可以有意覆盖前项但不影响模板其余区域。
    private static void applyCellWrites(XSSFSheet sheet, List<CellWrite> writes) {
        // 每项均包含最终Excel坐标和完整文本 → 不在Java内派生业务措辞。
        for (CellWrite write : writes) {
            setText(sheet, write.address(), write.value());
        }
    }

    // 扩展并写入相关文件清单，返回新增行数供打印区域同步调整。
    private static int applyRelatedFiles(XSSFSheet sheet, RelatedFiles files) {
        // 至少一行模板和一个业务条目是生成清单的前提 → 缺失时不输出伪完成表格。
        if (files.existingTemplateRows() < 1 || files.entries().isEmpty()) {
            throw new IllegalArgumentException("関連ファイル一覧のテンプレート行またはデータがありません。");
        }
        // JSON使用Excel一始坐标，POI使用零始坐标 → 此处集中完成转换。
        int templateRowIndex = files.templateExcelRow() - 1;
        int startRowIndex = files.startExcelRow() - 1;
        // 业务条目超出模板预留行时才插入 → 较小清单不会无故改变后续版式。
        int insertedRows = Math.max(0, files.entries().size() - files.existingTemplateRows());
        // 捕获单行合并定义后再移动后续区域 → 新增行可以复用原表格列组。
        List<CellRangeAddress> templateMerges = captureSingleRowMerges(sheet, templateRowIndex);
        // 插入点位于模板预留行之后 → 后续报告和表清单整体下移且不覆盖既有文件行。
        int shiftStartRow = startRowIndex + files.existingTemplateRows();
        if (insertedRows > 0) {
            sheet.shiftRows(shiftStartRow, sheet.getLastRowNum(), insertedRows, true, false);
            // 新增行逐行克隆模板样式与合并区域 → 15行保持同一视觉结构。
            for (int rowIndex = shiftStartRow; rowIndex < shiftStartRow + insertedRows; rowIndex++) {
                cloneRowStyle(sheet, templateRowIndex, rowIndex);
                addRowMerges(sheet, templateMerges, rowIndex);
            }
        }
        // 全部条目写入最终行 → 模板预留行和新增行共享相同字段映射。
        for (int index = 0; index < files.entries().size(); index++) {
            int excelRow = files.startExcelRow() + index;
            FileEntry entry = files.entries().get(index);
            setText(sheet, "A" + excelRow, entry.id());
            setText(sheet, "W" + excelRow, entry.name());
            setText(sheet, "BC" + excelRow, entry.io());
            setText(sheet, "BE" + excelRow, entry.note());
        }
        // 返回真实新增数量 → 打印范围按相同偏移计算。
        return insertedRows;
    }

    // 根据JSON更新模板中已有的简单图形文字 → 图形位置、箭头和尺寸保持原模板定义。
    private static void applyDrawingReplacements(
            XSSFSheet sheet,
            List<DrawingReplacement> replacements) {
        // 参考模板必须含流程图 → 缺图时停止，避免交付只有表格的概要书。
        XSSFDrawing drawing = sheet.getDrawingPatriarch();
        if (drawing == null) {
            throw new IllegalArgumentException("API概要テンプレートに機能概要図がありません。");
        }
        // 每个简单图形读取一次文本并执行有序替换 → JSON顺序决定重叠标签的处理结果。
        for (XSSFShape shape : drawing.getShapes()) {
            if (!(shape instanceof XSSFSimpleShape simpleShape)) {
                continue;
            }
            String current = simpleShape.getText();
            String updated = current;
            // 整体替换用于复合富文本文件框，片段替换用于普通流程标签。
            for (DrawingReplacement replacement : replacements) {
                if (!updated.contains(replacement.match())) {
                    continue;
                }
                updated = replacement.wholeShape()
                        ? replacement.replacement()
                        : updated.replace(replacement.match(), replacement.replacement());
                // 整体替换后不再套用其他旧文本规则 → 新标签不会被二次误改。
                if (replacement.wholeShape()) {
                    break;
                }
            }
            // 仅变化图形才重建文字 → 未命中的模板图标和标注保持原富文本。
            if (!updated.equals(current)) {
                simpleShape.setText(updated);
                // 模板文件框可能继承浅色主题字体 → 业务分组必须先设为黑色才能在白底图形中可见。
                setShapeFontColor(simpleShape, Color.BLACK);
            }
        }
    }

    // 将一个业务图形的全部文字段设为指定颜色 → 模板主题色不会造成已写内容视觉空白。
    private static void setShapeFontColor(XSSFSimpleShape simpleShape, Color color) {
        // 重建后的图形可能含多个段落和文字段 → 全量着色确保换行后的文件分组同样可见。
        for (XSSFTextParagraph paragraph : simpleShape.getTextParagraphs()) {
            for (XSSFTextRun run : paragraph.getTextRuns()) {
                run.setFontColor(color);
            }
        }
    }

    // 将包含JSON评审标识的单元格和图形统一设为红色 → 待确认范围不依赖硬编码坐标。
    private static void markReviewContentRed(XSSFWorkbook workbook, List<String> markers) {
        // 同一源样式复用一个红色副本 → 大量文件备注不会产生过多Excel样式。
        Map<Short, XSSFCellStyle> redStyleBySource = new LinkedHashMap<>();
        // 遍历全部Sheet实际单元格 → 空白模板区域不创建新对象。
        for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
            XSSFSheet sheet = workbook.getSheetAt(sheetIndex);
            for (Row row : sheet) {
                for (Cell cell : row) {
                    // 仅字符串中的待确认说明标红 → 日期、数值和公式样式不变。
                    if (cell.getCellType() == CellType.STRING
                            && requiresReview(cell.getStringCellValue(), markers)) {
                        XSSFCellStyle sourceStyle = (XSSFCellStyle) cell.getCellStyle();
                        XSSFCellStyle redStyle = redStyleBySource.computeIfAbsent(
                                sourceStyle.getIndex(),
                                ignored -> createRedStyle(workbook, sourceStyle));
                        cell.setCellStyle(redStyle);
                    }
                }
            }
            // 图形中的待确认内容同样标红 → 流程图和表格使用一致的评审语义。
            XSSFDrawing drawing = sheet.getDrawingPatriarch();
            if (drawing != null) {
                markDrawingReviewTextRed(drawing, markers);
            }
        }
    }

    // 将命中评审标识的整个图形文字设红 → 复合文字段不会遗漏局部颜色。
    private static void markDrawingReviewTextRed(XSSFDrawing drawing, List<String> markers) {
        // 仅简单文字图形参与处理 → 连接线和图片不受影响。
        for (XSSFShape shape : drawing.getShapes()) {
            if (shape instanceof XSSFSimpleShape simpleShape
                    && requiresReview(simpleShape.getText(), markers)) {
                // 整个待确认图形统一覆盖为红色 → 多个待确认文件框均能被继续遍历处理。
                setShapeFontColor(simpleShape, Color.RED);
            }
        }
    }

    // 任一非空评审标识命中即返回真 → JSON可扩充标识而无需修改生成器。
    private static boolean requiresReview(String text, List<String> markers) {
        // 空值不属于评审内容，空标识也不允许导致所有文本误标红。
        return text != null && markers.stream()
                .filter(marker -> marker != null && !marker.isBlank())
                .anyMatch(text::contains);
    }

    // 复制模板样式并只改变字体颜色 → 边框、填充、对齐和换行保持不变。
    private static XSSFCellStyle createRedStyle(XSSFWorkbook workbook, XSSFCellStyle sourceStyle) {
        // 克隆单元格样式作为评审专用版本 → 原模板样式不被全局污染。
        XSSFCellStyle redStyle = workbook.createCellStyle();
        redStyle.cloneStyleFrom(sourceStyle);
        // 复制字体业务显示属性 → 日文字体、字号和强调方式在标红后不变。
        XSSFFont sourceFont = sourceStyle.getFont();
        XSSFFont redFont = workbook.createFont();
        redFont.setFontName(sourceFont.getFontName());
        redFont.setFontHeight(sourceFont.getFontHeight());
        redFont.setBold(sourceFont.getBold());
        redFont.setItalic(sourceFont.getItalic());
        redFont.setUnderline(sourceFont.getUnderline());
        redFont.setStrikeout(sourceFont.getStrikeout());
        redFont.setTypeOffset(sourceFont.getTypeOffset());
        redFont.setCharSet(sourceFont.getCharSet());
        redFont.setFamily(sourceFont.getFamily());
        // Excel标准红色表示需要人工确认 → 与设计书评审标记一致。
        redFont.setColor(IndexedColors.RED.getIndex());
        redStyle.setFont(redFont);
        // 同源单元格共享此样式 → 控制工作簿样式总数。
        return redStyle;
    }

    // 捕获模板行内的单行合并区域 → 新增清单行复用相同列组。
    private static List<CellRangeAddress> captureSingleRowMerges(XSSFSheet sheet, int rowIndex) {
        // 独立列表保存副本 → 后续行移动不会改变捕获结果。
        List<CellRangeAddress> result = new ArrayList<>();
        for (CellRangeAddress merge : sheet.getMergedRegions()) {
            if (merge.getFirstRow() == rowIndex && merge.getLastRow() == rowIndex) {
                result.add(merge.copy());
            }
        }
        // 文件表格若无单行合并通常表示模板坐标已变化 → 在复制前明确失败。
        if (result.isEmpty()) {
            throw new IllegalArgumentException("関連ファイル一覧の結合セルがありません。");
        }
        return result;
    }

    // 为新行添加模板列组的合并区域 → 文件ID、名称、方向和备注保持原表格宽度。
    private static void addRowMerges(
            XSSFSheet sheet,
            List<CellRangeAddress> templateMerges,
            int targetRowIndex) {
        // 每个模板合并区只替换行号 → 列范围完全沿用模板。
        for (CellRangeAddress merge : templateMerges) {
            sheet.addMergedRegion(new CellRangeAddress(
                    targetRowIndex,
                    targetRowIndex,
                    merge.getFirstColumn(),
                    merge.getLastColumn()));
        }
    }

    // 复制模板行高度与已有单元格样式但不复制业务值 → 新行保持空白标准版式。
    private static void cloneRowStyle(XSSFSheet sheet, int sourceRowIndex, int targetRowIndex) {
        // 模板行是相关文件表格的样式来源 → 缺失时阻止无格式输出。
        Row source = sheet.getRow(sourceRowIndex);
        if (source == null) {
            throw new IllegalArgumentException("関連ファイル一覧のテンプレート行がありません。");
        }
        // shiftRows后目标应为空，若存在则复用 → 避免覆盖POI保留的结构对象。
        Row target = sheet.getRow(targetRowIndex);
        if (target == null) {
            target = sheet.createRow(targetRowIndex);
        }
        target.setHeight(source.getHeight());
        // 复制所有既有列样式 → 合并区域边框和填充完整保留。
        for (int column = 0; column < source.getLastCellNum(); column++) {
            Cell sourceCell = source.getCell(column);
            if (sourceCell != null) {
                Cell targetCell = target.getCell(column);
                if (targetCell == null) {
                    targetCell = target.createCell(column);
                }
                CellStyle style = sourceCell.getCellStyle();
                targetCell.setCellStyle(style);
                targetCell.setBlank();
            }
        }
    }

    // 清除JSON指定矩形内的旧值但保留版式 → 参考业务内容不会残留。
    private static void clearValues(XSSFSheet sheet, ClearRange range) {
        // 只遍历现有行和单元格 → 清理动作不扩大模板使用区域。
        for (int rowIndex = range.firstRow(); rowIndex <= range.lastRow(); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) {
                continue;
            }
            for (int column = range.firstColumn(); column <= range.lastColumn(); column++) {
                Cell cell = row.getCell(column);
                if (cell != null) {
                    cell.setBlank();
                }
            }
        }
    }

    // 将文本写入Excel地址并沿用既有样式 → JSON坐标直接对应客户模板。
    private static void setText(XSSFSheet sheet, String address, String value) {
        // 标准A1地址解析为POI行列 → 支持模板A到DH的宽度。
        CellReference reference = new CellReference(address);
        Row row = sheet.getRow(reference.getRow());
        if (row == null) {
            row = sheet.createRow(reference.getRow());
        }
        Cell cell = row.getCell(reference.getCol());
        if (cell == null) {
            cell = row.createCell(reference.getCol());
        }
        // 完整业务文本一次写入 → 不在代码层拼装或解释内容。
        cell.setCellValue(value);
    }

    // 写入实际生成日并保留模板日期样式 → 设计书反映本次制作日期。
    private static void setDate(XSSFSheet sheet, String address, LocalDate value) {
        // 日期格必须由模板预先定义 → 缺失表示模板已换版且需人工确认映射。
        CellReference reference = new CellReference(address);
        Row row = sheet.getRow(reference.getRow());
        Cell cell = row == null ? null : row.getCell(reference.getCol());
        if (cell == null) {
            throw new IllegalArgumentException("日付セルがありません: " + address);
        }
        cell.setCellValue(value);
    }

    // 按最终工作表末行收敛打印区域 → 避免POI自动扩展后再次叠加新增行数。
    private static void updatePrintArea(XSSFWorkbook workbook, XSSFSheet sheet) {
        // 读取模板已定义打印区域 → 禁止Java硬编码不同模板的列宽范围。
        int sheetIndex = workbook.getSheetIndex(sheet);
        String printArea = workbook.getPrintArea(sheetIndex);
        if (printArea == null) {
            throw new IllegalArgumentException("API概要テンプレートに印刷範囲がありません。");
        }
        // POI可解析带Sheet名的打印区域 → 使用首个连续区域作为客户版式基准。
        String rangeText = printArea.substring(printArea.indexOf('!') + 1).replace("$", "");
        CellRangeAddress range = CellRangeAddress.valueOf(rangeText);
        workbook.setPrintArea(
                sheetIndex,
                range.getFirstColumn(),
                range.getLastColumn(),
                range.getFirstRow(),
                sheet.getLastRowNum());
    }

    // 读取UTF-8 JSON并验证生成所需字段 → 数据缺失时在打开模板前失败。
    private static GenerationSpec readAndValidateSpec(Path projectRoot, Path specPath) throws Exception {
        // JSON必须是工程内可读普通文件 → 不接受目录或外部数据源。
        if (!Files.isRegularFile(specPath) || !Files.isReadable(specPath)) {
            throw new IllegalArgumentException("生成データJSONが存在しません: " + specPath);
        }
        GenerationSpec spec = JSON.readValue(specPath.toFile(), GenerationSpec.class);
        // 关键路径、Sheet和业务集合必须完整 → 不生成空概要书。
        if (isBlank(spec.template())
                || isBlank(spec.output())
                || isBlank(spec.sheetName())
                || spec.cells() == null
                || spec.clearRanges() == null
                || spec.relatedFiles() == null
                || spec.relatedFiles().entries() == null
                || spec.postShiftCells() == null
                || spec.drawingReplacements() == null
                || spec.reviewMarkers() == null
                || spec.dateCells() == null) {
            throw new IllegalArgumentException("生成データJSONに必須項目がありません: " + specPath);
        }
        // 提前解析路径以验证工程边界 → 后续生成不会因输出逃逸而中途失败。
        resolveInsideProject(projectRoot, spec.template());
        resolveInsideProject(projectRoot, spec.output());
        return spec;
    }

    // 空参数使用默认JSON，一个参数使用指定JSON，其他数量视为调用错误。
    private static Path resolveSpecPath(Path projectRoot, String[] args) {
        // 旧版双参数调用不再允许 → 强制模板和输出也由JSON数据统一管理。
        if (args.length > 1) {
            throw new IllegalArgumentException("引数は0個、または生成データJSONの1個で指定してください。");
        }
        return args.length == 0
                ? findOnlyDefaultSpec(projectRoot)
                : resolveInsideProject(projectRoot, args[0]);
    }

    // 从默认数据目录发现唯一API概要JSON → 无参数入口保持便利且不把业务文件名写进代码。
    private static Path findOnlyDefaultSpec(Path projectRoot) {
        // 默认目录仍限定在当前工程OPTION → 不跨工程搜索同名业务数据。
        Path directory = projectRoot.resolve(DEFAULT_SPEC_DIRECTORY).normalize();
        if (!Files.isDirectory(directory)) {
            throw new IllegalArgumentException("生成データJSONディレクトリが存在しません: " + directory);
        }
        // 仅接受约定扩展名且必须唯一 → 多份数据时要求调用者显式选择，避免生成错误对象。
        try (var paths = Files.list(directory)) {
            List<Path> candidates = paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".api-overview.json"))
                    .sorted()
                    .toList();
            if (candidates.size() != 1) {
                throw new IllegalArgumentException(
                        "生成データJSONは1件である必要があります: " + candidates.size());
            }
            return candidates.get(0);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("生成データJSONディレクトリを読み込めません: " + directory, exception);
        }
    }

    // 从当前目录向上识别Gradle工程根 → 支持工程根、backend或IDE目录启动。
    private static Path locateProjectRoot() {
        // 当前进程目录是唯一探测起点 → 不在代码内固定机器绝对路径。
        Path probe = Path.of("").toAbsolutePath().normalize();
        while (probe != null) {
            if (Files.isRegularFile(probe.resolve("settings.gradle"))) {
                return probe;
            }
            probe = probe.getParent();
        }
        throw new IllegalStateException("settings.gradle を含むプロジェクトルートが見つかりません。");
    }

    // 将JSON中的路径解析为当前工程内绝对路径 → 防止读写其他项目。
    private static Path resolveInsideProject(Path projectRoot, String rawPath) {
        // 相对路径以工程根为基准，绝对路径仍需通过边界校验。
        Path candidate = Path.of(rawPath);
        Path resolved = candidate.isAbsolute()
                ? candidate.toAbsolutePath().normalize()
                : projectRoot.resolve(candidate).normalize();
        if (!resolved.startsWith(projectRoot)) {
            throw new IllegalArgumentException("プロジェクト外のパスは使用できません: " + resolved);
        }
        return resolved;
    }

    // 验证模板可读 → 缺少参考版式时拒绝从零伪造客户设计书。
    private static void requireReadableTemplate(Path template) {
        if (!Files.isRegularFile(template) || !Files.isReadable(template)) {
            throw new IllegalArgumentException("テンプレートが存在しません: " + template);
        }
    }

    // 工作簿先写同目录临时文件再替换正式输出 → 中断时保留上次完整结果。
    private static void writeAtomically(XSSFWorkbook workbook, Path output) throws Exception {
        // 临时文件使用明确同级路径 → Windows移动不跨磁盘。
        Path temporary = output.resolveSibling(output.getFileName() + ".tmp");
        try (OutputStream stream = Files.newOutputStream(temporary)) {
            workbook.write(stream);
        }
        try {
            // 文件系统支持时原子替换 → 读者不会观察到半写入状态。
            Files.move(
                    temporary,
                    output,
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            // Windows卷不支持原子移动时退回同目录替换 → 仍确保写入已完整结束。
            Files.move(temporary, output, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    // 判断JSON关键字符串是否缺失 → 空白路径和名称不能进入生成流程。
    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
