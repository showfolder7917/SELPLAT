package com.sp.selplat.local.code.common.fujitsu.app.design;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * CP のインターフェース項目仕様テンプレートを、SBMAA9xx の要求・応答草案へ変換する。
 * 正式 IF 契約が未提供の項目は「未確定（要確認）」とし、推測した型や URI を記載しない。
 */
public final class SbmaaInterfaceSpecificationGenerator {

    // 无参数运行时读取用户提供的接口项目模板 → DVP业务内容仅作为版式来源。
    private static final Path DEFAULT_TEMPLATE = Path.of(
            "OPTION", "561", "資料", "template", "インタフェース項目仕様_CPMAA003_DVP決済管理.xlsx");

    // 生成结果进入统一运行数据目录 → 原模板与正式资料不被覆盖。
    private static final Path DEFAULT_OUTPUT = Path.of(
            "OPTION", "temp", "561", "インタフェース項目仕様_SBMAA9xx_自動保存ファイルダウンロード.xlsx");

    // 未提供正式接口事实时使用统一日语标记 → 草案不伪装为已确认规格。
    private static final String UNCONFIRMED = "未確定（要確認）";

    // 评审标识词统一决定红色范围 → 请求和响应Sheet不会漏标暂定接口项目。
    private static final List<String> REVIEW_MARKERS = List.of(
            UNCONFIRMED,
            "暫定",
            "要レビュー",
            "要件注記なし",
            "詳細設計で確認",
            "要確認");

    // 工具仅通过静态 main 对外执行 → 人工与AI使用同一稳定入口。
    private SbmaaInterfaceSpecificationGenerator() {
    }

    /**
     * テンプレートの旧 DVP 項目を除去し、日本語の要求・応答 Sheet を生成する。
     *
     * @param args コマンドライン引数。空配列は既定入出力、2 要素は
     *             `OPTION/561/資料/template/interface.xlsx OPTION/temp/561/output.xlsx` の順
     * 実行结果示例：请求Sheet包含“自動保存ファイルダウンロード要求”，响应Sheet包含
     * “ダウンロードデータ”，模板原文件不发生修改。
     * @throws Exception 模板不存在、工程外路径、Sheet数错误或工作簿写入失败时停止，例如
     *                   `IllegalArgumentException("IFテンプレートのシート数が2ではありません: 1")`
     */
    public static void main(String[] args) throws Exception {
        // 当前目录向上识别工程根 → 模板和输出统一归属当前SELPLAT工程。
        Path projectRoot = locateProjectRoot();
        // 空参数采用约定输入，双参数支持人工验证其他工程内模板副本。
        Path template = args.length == 0
                ? projectRoot.resolve(DEFAULT_TEMPLATE)
                : resolveInsideProject(projectRoot, args[0]);
        // 输出参数必须成对出现 → 禁止猜测单一参数代表输入还是输出。
        Path output = args.length == 0
                ? projectRoot.resolve(DEFAULT_OUTPUT)
                : requireTwoArgumentsAndResolveOutput(projectRoot, args);
        // 模板缺失时在创建输出目录前失败 → 不留下误导性空文件。
        requireReadableTemplate(template);
        // 输出父目录属于OPTION/temp → 可重复生成并统一清理。
        Files.createDirectories(output.getParent());

        // 内存中加载模板副本 → 原始DVP模板保持只读。
        try (InputStream input = Files.newInputStream(template);
                XSSFWorkbook workbook = new XSSFWorkbook(input)) {
            // 请求与响应各使用一个Sheet → 其他Sheet数量表示模板结构已变化。
            if (workbook.getNumberOfSheets() != 2) {
                throw new IllegalArgumentException(
                        "IFテンプレートのシート数が2ではありません: " + workbook.getNumberOfSheets());
            }
            // 第一Sheet固定为请求方向 → 对应管理终端发起下载。
            XSSFSheet requestSheet = workbook.getSheetAt(0);
            // 第二Sheet固定为响应方向 → 对应文件或错误结果返回。
            XSSFSheet responseSheet = workbook.getSheetAt(1);
            // 先清除旧DVP业务内容再填请求 → 模板字段不会混入新设计。
            populateRequestSheet(workbook, requestSheet);
            // 响应Sheet同样重建 → 多文件协议缺失处明确保留待确认标记。
            populateResponseSheet(workbook, responseSheet);
            // 请求和响应中的暂定、未确定及要确认项目统一标红 → 人工评审范围一眼可见。
            markReviewCellsRed(workbook);
            // 完整写入临时包后替换输出 → 生成中断不会损坏既有草案。
            writeAtomically(workbook, output);
        }
        // 输出生成物绝对路径 → 人工可直接检查结果。
        System.out.println("generated: " + output);
    }

    /** 将第一Sheet转换为自動保存ファイルダウンロード要求草案。 */
    private static void populateRequestSheet(XSSFWorkbook workbook, XSSFSheet sheet) {
        // Sheet名与接口名一致 → 打开工作簿即可识别IN方向。
        workbook.setSheetName(workbook.getSheetIndex(sheet), "自動保存ファイルダウンロード");
        // 共通页眉切换到SB管理功能 → CP DVP身份完全移除。
        populateCommonHeader(sheet, "自動保存ファイルダウンロード");
        // 正式接口ID尚未分配 → 显式待确认而不沿用CPTAI003。
        setText(sheet, "J4", UNCONFIRMED);
        setText(sheet, "AG4", "自動保存ファイルダウンロード要求");
        setText(sheet, "AZ4", "IN");
        setText(sheet, "BL4", "管理端末Web");
        setText(sheet, "CD4", "SBMAA9xx（暫定）");
        // 既存管理端末WebのファイルDL共通実装を反映 → API IDのみ暫定のまま明示する。
        setText(sheet, "J5", "SBMAA9xx/download（API IDは暫定）");
        setText(sheet, "AP5", "GET（ファイルDL方式）");
        // 第9行以后旧请求字段全部清空 → 更新时间等DVP字段不会残留。
        clearBusinessRows(sheet);

        // 共通GET処理が必ず付与する画面IDを要求項目として記載 → 呼出元SB0O400を識別する。
        setInterfaceRow(
                sheet,
                9,
                "1",
                "screenId",
                "画面ID",
                "1",
                "1",
                "string",
                "○",
                "管理端末WebのファイルDL共通処理がクエリパラメータへ設定する。",
                "SB0O400",
                "SB-GMS104501に基づき、画面SB0O400からの要求であることを識別する。");
        // 业务请求参数现有资料未定义 → 明确记录固定全量请求的候选与确认边界。
        setInterfaceRow(
                sheet,
                10,
                "2",
                UNCONFIRMED,
                "追加要求項目",
                "1",
                "1",
                "-",
                "-",
                "現行要件では15ファイル一括取得のため追加項目なしを想定するが、正式IF仕様で要確認。",
                UNCONFIRMED,
                "対象日やファイル選択を要求で受け取るかは" + UNCONFIRMED + "。");
    }

    /** 将第二Sheet转换为下载数据和错误信息的响应草案。 */
    private static void populateResponseSheet(XSSFWorkbook workbook, XSSFSheet sheet) {
        // 响应Sheet名称添加“応答” → 与请求Sheet形成一对清晰接口。
        workbook.setSheetName(workbook.getSheetIndex(sheet), "自動保存ファイルダウンロード応答");
        // 共通页眉与请求使用同一业务功能 → 两方向契约绑定SBMAA9xx。
        populateCommonHeader(sheet, "自動保存ファイルダウンロード");
        // 响应接口ID未分配 → 不从模板沿用CP汇入接口编号。
        setText(sheet, "J4", UNCONFIRMED);
        setText(sheet, "AG4", "自動保存ファイルダウンロード応答");
        setText(sheet, "AZ4", "OUT");
        setText(sheet, "BL4", "管理端末Web");
        setText(sheet, "CD4", "SBMAA9xx（暫定）");
        // 要求と同じGETダウンロード契約を応答側にも記載 → 正常Blobと異常JSONを同一操作で扱う。
        setText(sheet, "J5", "SBMAA9xx/download（API IDは暫定）");
        setText(sheet, "AP5", "GET（ファイルDL方式）");
        // 清理原DVP 17项输出 → 不保留决算编号、金额等无关字段。
        clearBusinessRows(sheet);

        // 正常応答の本文は既存共通実装がBlobとして扱う → 配信対象ファイルのバイナリを格納する。
        setInterfaceRow(
                sheet,
                9,
                "1",
                "blob",
                "ダウンロードデータ",
                "1",
                "1",
                "Blob",
                "○",
                "SB-GMS104501で定義された対象ファイル15種を正常時にバイナリデータとして返却する。",
                "Content-Typeがapplication/json以外であること。",
                "15ファイルのZIP等の集約形式は" + UNCONFIRMED + "。");
        // Content-Dispositionから取得するファイル名を別項目化 → Web側の保存名決定根拠を明確にする。
        setInterfaceRow(
                sheet,
                10,
                "2",
                "filename",
                "ダウンロードファイル名",
                "1",
                "1",
                "string",
                "○",
                "Content-Dispositionヘッダのfilenameから取得し、端末保存名に使用する。",
                "Content-Dispositionにfilenameが設定されていること。",
                "複数ファイル時の命名規則は" + UNCONFIRMED + "。");
        // 異常時の共通応答ルートを記載 → Blob正常応答との判定条件を設計書上で明確にする。
        setInterfaceRow(
                sheet,
                11,
                "3",
                "restResHeader",
                "応答ヘッダ",
                "1",
                "1",
                "object",
                "○",
                "Content-Typeがapplication/jsonの場合に管理端末共通応答を返す。",
                "resultCodeを必須とする。",
                "messageIdおよびmessageは任意項目とする。");
        // 共通応答の実項目を明示 → 画面側のメッセージ表示に必要な構造を追跡可能にする。
        setInterfaceRow(
                sheet,
                12,
                "4",
                "resultCode / messageId / message",
                "処理結果・メッセージ情報",
                "1",
                "1",
                "string",
                "○ / - / -",
                "異常時の処理結果、メッセージIDおよびメッセージ文言を通知する。",
                "resultCodeの値域および個別メッセージは" + UNCONFIRMED + "。",
                "権限不足、ファイル欠落、格納先参照不可または配信失敗を通知する。");
    }

    /** 两个Sheet共用的SB系统身份、草案版号和生成者信息。 */
    private static void populateCommonHeader(XSSFSheet sheet, String functionName) {
        // 系统名从CP改为一般债SB → 模板身份与项番561对象一致。
        setText(sheet, "Z2", "一般債振替システム（SB）");
        setText(sheet, "AM2", "管理");
        setText(sheet, "BD2", functionName);
        // 版号标记草案 → 缺失契约补齐前不可误作正式版。
        setText(sheet, "BT2", "0.1（ドラフト）");
        // 作成日和更新日均采用真实生成日 → 重跑时保留可追踪时间。
        setDate(sheet, "CD1", LocalDate.now());
        setDate(sheet, "CD2", LocalDate.now());
        // 生成者不沿用参考模板人员 → 明确机器生成后需要人工评审。
        setText(sheet, "CO1", "自動生成（要レビュー）");
        setText(sheet, "CO2", "自動生成（要レビュー）");
    }

    /** 将请求和响应Sheet中包含待确认标识的单元格字体设为红色。 */
    private static void markReviewCellsRed(XSSFWorkbook workbook) {
        // 同一模板样式只产生一个红色副本 → 多个接口行复用样式且不扩大工作簿样式数量。
        Map<Short, XSSFCellStyle> redStyleBySource = new LinkedHashMap<>();
        // 两个Sheet执行相同扫描 → 请求与响应使用一致的评审标识规则。
        for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
            XSSFSheet sheet = workbook.getSheetAt(sheetIndex);
            // 只遍历模板中实际存在的行和单元格 → 不改变未使用区域和打印范围。
            for (Row row : sheet) {
                for (Cell cell : row) {
                    // 字符串命中评审词时才标红 → 已确认的GET、screenId和Blob契约保持原色。
                    if (cell.getCellType() == CellType.STRING && requiresReview(cell.getStringCellValue())) {
                        XSSFCellStyle sourceStyle = (XSSFCellStyle) cell.getCellStyle();
                        // 克隆源样式后替换字体 → 保留模板边框、填充、对齐和自动换行。
                        XSSFCellStyle redStyle = redStyleBySource.computeIfAbsent(
                                sourceStyle.getIndex(),
                                ignored -> createRedStyle(workbook, sourceStyle));
                        cell.setCellStyle(redStyle);
                    }
                }
            }
        }
    }

    /** 判断接口文字是否属于需要客户或详细设计确认的范围。 */
    private static boolean requiresReview(String text) {
        // 任一待确认标识命中即标红整个单元格 → 带上下文的说明不会只突出半句而产生歧义。
        return text != null && REVIEW_MARKERS.stream().anyMatch(text::contains);
    }

    /** 创建保持模板格式且字体为红色的单元格样式。 */
    private static XSSFCellStyle createRedStyle(XSSFWorkbook workbook, XSSFCellStyle sourceStyle) {
        // 完整复制源样式 → 接口规格表的列边界和印刷版式不受颜色处理影响。
        XSSFCellStyle redStyle = workbook.createCellStyle();
        redStyle.cloneStyleFrom(sourceStyle);
        // 复制日文字体的主要属性 → 红色标记不改变字号、粗体或下划线语义。
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
        // Excel标准红色表示待确认 → 与API概要使用同一视觉约定。
        redFont.setColor(IndexedColors.RED.getIndex());
        redStyle.setFont(redFont);
        // 返回可复用的红色样式 → 同类型接口项目共享样式资源。
        return redStyle;
    }

    /** 按接口模板列定义写入一条日语项目规格草案。 */
    private static void setInterfaceRow(
            XSSFSheet sheet,
            int excelRow,
            String number,
            String itemId,
            String itemName,
            String hierarchy,
            String repeatCount,
            String attribute,
            String required,
            String description,
            String checkSpecification,
            String sourceDetail) {
        // 编号与字段身份写入模板固定列 → 请求和响应行可按同一结构比较。
        setText(sheet, "A" + excelRow, number);
        setText(sheet, "B" + excelRow, itemId);
        setText(sheet, "M" + excelRow, itemName);
        // 层级和重复数描述字段结构 → 未确认集合协议时仍保留事实边界。
        setText(sheet, "AC" + excelRow, hierarchy);
        setText(sheet, "AE" + excelRow, repeatCount);
        // 属性、长度和Byte数不能从业务名称推断 → 属性外的数值列统一待确认。
        setText(sheet, "AG" + excelRow, attribute);
        setText(sheet, "AL" + excelRow, UNCONFIRMED);
        setText(sheet, "AO" + excelRow, UNCONFIRMED);
        // 必填、说明、检查和来源形成一条完整评审线索。
        setText(sheet, "BM" + excelRow, required);
        setText(sheet, "BO" + excelRow, description);
        setText(sheet, "CN" + excelRow, checkSpecification);
        setText(sheet, "CQ" + excelRow, UNCONFIRMED);
        setText(sheet, "CW" + excelRow, "-");
        setText(sheet, "DC" + excelRow, sourceDetail);
    }

    /** 清除第9行后的旧业务字段，只保留模板样式、合并区域和打印设置。 */
    private static void clearBusinessRows(XSSFSheet sheet) {
        // 从业务项目首行遍历到模板末行 → DVP输入输出字段全部移除。
        for (int rowIndex = 8; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) {
                // 模板空行不创建 → 不扩大使用区域。
                continue;
            }
            // 逐单元格清空内容 → 样式、边框和合并结构继续复用。
            for (Cell cell : row) {
                // 旧公式和文字都不适用于新接口 → 统一清空业务值。
                cell.setBlank();
            }
        }
    }

    /** 将日语文本写入模板指定坐标并沿用既有样式。 */
    private static void setText(XSSFSheet sheet, String address, String value) {
        // 地址解析到真实行列 → 支持EG宽度的接口模板。
        CellReference reference = new CellReference(address);
        Row row = sheet.getRow(reference.getRow());
        if (row == null) {
            // 目标行不存在时创建 → 草案可补充模板未使用的响应行。
            row = sheet.createRow(reference.getRow());
        }
        Cell cell = row.getCell(reference.getCol());
        if (cell == null) {
            // 目标单元格不存在时创建 → 只改变指定业务位置。
            cell = row.createCell(reference.getCol());
        }
        // 写入日语值 → 原样式和合并定义继续控制显示。
        cell.setCellValue(value);
    }

    /** 将实际生成日写入模板日期格。 */
    private static void setDate(XSSFSheet sheet, String address, LocalDate value) {
        // 地址映射到模板日期单元格 → 现有日期格式得以保留。
        CellReference reference = new CellReference(address);
        Row row = sheet.getRow(reference.getRow());
        Cell cell = row.getCell(reference.getCol());
        // 模板日期格缺失表示版式不兼容 → 生成前明确阻断。
        if (cell == null) {
            throw new IllegalArgumentException("日付セルがありません: " + address);
        }
        // 写入本次实际日期 → 草案制作时间可追踪。
        cell.setCellValue(value);
    }

    /** 将工作簿完整写入临时文件后替换正式输出。 */
    private static void writeAtomically(XSSFWorkbook workbook, Path output) throws Exception {
        // 同目录临时文件避免跨卷移动 → Windows环境稳定覆盖可删除生成物。
        Path temporary = output.resolveSibling(output.getFileName() + ".tmp");
        // 完整写出OOXML包 → 中途失败不会改变上次可用结果。
        try (OutputStream stream = Files.newOutputStream(temporary)) {
            workbook.write(stream);
        }
        // 写入成功后替换输出 → 重跑生成器得到最新草案。
        Files.move(temporary, output, StandardCopyOption.REPLACE_EXISTING);
    }

    /** 从当前目录向上识别包含settings.gradle的工程根。 */
    private static Path locateProjectRoot() {
        // 当前运行目录作为识别起点 → 支持Gradle、IDE和命令行。
        Path probe = Path.of("").toAbsolutePath().normalize();
        // 逐级查找工程标记 → 不把SELPLAT绝对路径写死在程序中。
        while (probe != null) {
            if (Files.isRegularFile(probe.resolve("settings.gradle"))) {
                // 命中后返回工程根 → 所有输入输出从同一根派生。
                return probe;
            }
            // 未命中则上溯一级 → 文件系统根后终止。
            probe = probe.getParent();
        }
        // 找不到工程根时停止 → 防止写到错误OPTION目录。
        throw new IllegalStateException("settings.gradle を含むプロジェクトルートが見つかりません。");
    }

    /** 将输入参数路径限制在当前工程内。 */
    private static Path resolveInsideProject(Path projectRoot, String rawPath) {
        // 相对路径按工程根解析，绝对路径正规化 → 两种人工调用方式得到同一结果。
        Path candidate = Path.of(rawPath);
        Path resolved = candidate.isAbsolute()
                ? candidate.toAbsolutePath().normalize()
                : projectRoot.resolve(candidate).normalize();
        // 工程外路径立即拒绝 → 生成器不能修改其他工程资料。
        if (!resolved.startsWith(projectRoot)) {
            throw new IllegalArgumentException("プロジェクト外のパスは使用できません: " + resolved);
        }
        // 返回工程内正规路径 → 用于模板读取或结果写入。
        return resolved;
    }

    /** 校验双参数调用并解析输出路径。 */
    private static Path requireTwoArgumentsAndResolveOutput(Path projectRoot, String[] args) {
        // 非0非2参数表示调用方式不明确 → 不推断缺失参数。
        if (args.length != 2) {
            throw new IllegalArgumentException("引数は0個、または template output の2個で指定してください。");
        }
        // 第二参数是输出路径 → 继续执行工程边界检查。
        return resolveInsideProject(projectRoot, args[1]);
    }

    /** 验证模板存在且可读取。 */
    private static void requireReadableTemplate(Path template) {
        // 不可读模板无法证明生成依据 → 在任何输出写入前停止。
        if (!Files.isRegularFile(template) || !Files.isReadable(template)) {
            throw new IllegalArgumentException("テンプレートが存在しません: " + template);
        }
    }
}
