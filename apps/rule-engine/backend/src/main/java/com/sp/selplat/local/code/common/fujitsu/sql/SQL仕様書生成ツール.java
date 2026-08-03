package com.sp.selplat.local.code.common.fujitsu.sql;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import com.fasterxml.jackson.databind.ObjectMapper;

/** JSON に定義した SQL 群を既存 Excel 様式の SQL 仕様書へ変換する汎用オフラインツール。 */
public final class SQL仕様書生成ツール {

  /** 無引数実行時に同じ機能フォルダから読み込む新規作成用 JSON 名を保持する。 */
  private static final String DEFAULT_CONFIG_NAME = "SQL仕様書生成ツール新規.json";

  /** OOXML 清掃用一時ファイルを工程内の統一 OPTION/temp へ限定する。 */
  private static final Path PACKAGE_TEMP_DIR = Path.of("OPTION", "temp");

  /** 配置文件通过此标记引用当前工程根目录，避免把开发机绝对路径写入可共享模板。 */
  private static final String PROJECT_PATH_PREFIX = "@project/";

  /** 当前命令工作目录作为工程根目录，用于解析模板内的工程级输入、缓存与输出路径。 */
  private static final Path PROJECT_ROOT = Path.of("").toAbsolutePath().normalize();

  /** JSON の構造を厳格に読み取るため、共通の Jackson 入口を使用する。 */
  private static final ObjectMapper JSON = new ObjectMapper();

  /** Java 型欄への混入を禁止する代表的な DB 型名と抽象プレースホルダーを保持する。 */
  private static final Set<String> FORBIDDEN_NON_JAVA_TYPES = Set.of(
      "CHAR", "VARCHAR", "INT", "INTEGER", "BIGINT", "SMALLINT", "DECIMAL", "NUMERIC",
      "DATE", "TIMESTAMP", "CLOB", "BLOB", "LIST", "BEAN");

  /** 外部生成を禁止し、main 入口だけから一連の生成処理を実行させる。 */
  private SQL仕様書生成ツール() {
  }

  /** JSON 読取、入力照合、Mapper 抽出、Excel 生成を順番に実行する。 */
  public static void main(String[] args) throws Exception {
    // 引数指定時は任意設定を使い、無引数時は運用者が編集する標準 JSON を使う。
    Path configPath = args.length == 0 ? locateDefaultConfig() : Path.of(args[0]).toAbsolutePath().normalize();
    requireReadable(configPath, "設定 JSON");

    // UTF-8 JSON を業務構造へ変換し、不完全な設定は出力前に停止する。
    GenerationConfig config = JSON.readValue(Files.readString(configPath, StandardCharsets.UTF_8),
        GenerationConfig.class);
    validateConfig(config);
    Path configDirectory = configPath.getParent();
    Path template = resolvePath(configDirectory, config.templatePath());
    Path outputDirectory = resolvePath(configDirectory, config.outputDirectory());
    Path batchSource = resolveOptionalPath(configDirectory, config.batchSourcePath());
    requireReadable(template, "参照テンプレート");
    if (batchSource != null) {
      requireReadable(batchSource, "SQL 呼出元 Java");
    }

    // JSON に列挙された全 Mapper を読み、同じ SQL ID は後勝ちで統合する。
    Map<String, String> sqlBodies = new LinkedHashMap<>();
    for (MapperSource source : config.mapperSources()) {
      Path mapperPath = resolvePath(configDirectory, source.path());
      requireReadable(mapperPath, "Mapper 入力");
      if ("XML_FILE".equals(source.kind())) {
        sqlBodies.putAll(readMapperSql(Files.newInputStream(mapperPath)));
      } else if ("JAR_ENTRY".equals(source.kind())) {
        sqlBodies.putAll(readSqlFromJar(mapperPath, source.entry()));
      } else {
        throw new IllegalArgumentException("未対応の Mapper kind: " + source.kind());
      }
    }

    // Mapper に存在し Java から呼ばれる SQL と JSON の SQL 集合を完全一致で照合する。
    if (batchSource != null) {
      verifyUsedSqlIds(batchSource, config.sqlSpecifications(), sqlBodies.keySet());
    }

    // JSON の記載順で一条ずつ生成し、進捗と出力先を操作者へ明示する。
    Files.createDirectories(outputDirectory);
    int total = config.sqlSpecifications().size();
    for (int index = 0; index < total; index++) {
      SqlSpec spec = config.sqlSpecifications().get(index);
      System.out.printf("processing: %d/%d %s%n", index + 1, total, spec.id());
      String sqlBody = sqlBodies.get(spec.id());
      if (sqlBody == null || sqlBody.isBlank()) {
        throw new IllegalStateException("Mapper SQL が見つかりません: " + spec.id());
      }
      Path output = outputDirectory.resolve(config.fileNamePrefix() + spec.name() + ".xlsx");
      // 新規は共通テンプレート、修正は SQL ごとの既存仕様書を編集元として使う。
      Path sourceWorkbook = "CORRECT".equals(spec.operation())
          ? resolvePath(configDirectory, spec.baseWorkbookPath()) : template;
      requireReadable(sourceWorkbook, "生成元ワークブック");
      generateWorkbook(config, spec, sqlBody, sourceWorkbook, output);
      System.out.println("generated: " + output);
    }
    System.out.println("completed: " + total + " SQL specification workbooks");
  }

  /** クラス配置先から標準 JSON を特定し、VS Code と直接実行の双方を支える。 */
  private static Path locateDefaultConfig() {
    // 规则包内的配置资源作为权威默认值，消除对迁移前目录与运行时工作目录的依赖。
    return Path.of("apps", "rule-engine", "backend", "src", "main", "resources", "fujitsu",
        "template", "sql", "SQL仕様書生成ツール", DEFAULT_CONFIG_NAME);
  }

  /** JSON の必須項目、重複 SQL、Mapper 種別を出力前に検査する。 */
  private static void validateConfig(GenerationConfig config) {
    // 生成全体の必須設定が欠けた場合は、テンプレートを複製する前に理由を示して停止する。
    requireText(config.version(), "version");
    requireText(config.templatePath(), "templatePath");
    requireText(config.outputDirectory(), "outputDirectory");
    requireText(config.fileNamePrefix(), "fileNamePrefix");
    requireText(config.functionName(), "functionName");
    if (config.mapperSources() == null || config.mapperSources().isEmpty()) {
      throw new IllegalArgumentException("mapperSources は一件以上必要です。");
    }
    if (config.sqlSpecifications() == null || config.sqlSpecifications().isEmpty()) {
      throw new IllegalArgumentException("sqlSpecifications は一件以上必要です。");
    }

    // SQL ID と業務名を一意にし、同名ファイルの意図しない上書きを防止する。
    Set<String> ids = new LinkedHashSet<>();
    Set<String> names = new LinkedHashSet<>();
    for (SqlSpec spec : config.sqlSpecifications()) {
      requireText(spec.id(), "sqlSpecifications.id");
      requireText(spec.name(), "sqlSpecifications.name");
      requireText(spec.overview(), "sqlSpecifications.overview");
      requireText(spec.type(), "sqlSpecifications.type");
      requireText(spec.operation(), "sqlSpecifications.operation");
      if (!Set.of("NEW", "CORRECT").contains(spec.operation())) {
        throw new IllegalArgumentException("operation は NEW または CORRECT です: " + spec.id());
      }
      if ("CORRECT".equals(spec.operation())) {
        requireText(spec.baseWorkbookPath(), "sqlSpecifications.baseWorkbookPath");
      }
      if (!ids.add(spec.id())) {
        throw new IllegalArgumentException("SQL ID が重複しています: " + spec.id());
      }
      if (!names.add(spec.name())) {
        throw new IllegalArgumentException("SQL 名が重複しています: " + spec.name());
      }
      if (spec.tables() == null || spec.tables().isEmpty()) {
        throw new IllegalArgumentException("利用テーブルが空です: " + spec.id());
      }
      // パラメータと取得項目は DataBean 宣言と同じ Java 型だけを許可する。
      validateJavaTypes(safeList(spec.parameters()), spec.id(), "parameters");
      validateJavaTypes(safeList(spec.outputs()), spec.id(), "outputs");
    }

    // JAR_ENTRY では JAR 内 XML 位置を必須とし、実行時の曖昧な探索を行わない。
    for (MapperSource source : config.mapperSources()) {
      requireText(source.kind(), "mapperSources.kind");
      requireText(source.path(), "mapperSources.path");
      if ("JAR_ENTRY".equals(source.kind())) {
        requireText(source.entry(), "mapperSources.entry");
      }
    }
  }

  /** 項目型が DB 型や LIST/BEAN の仮表現ではなく具体的な Java 型であることを検査する。 */
  private static void validateJavaTypes(List<ItemSpec> items, String sqlId, String section) {
    for (ItemSpec item : items) {
      requireText(item.dataType(), "sqlSpecifications." + section + ".dataType");
      String dataType = item.dataType().strip();
      String baseType = dataType.replaceFirst("\\s*\\(.*$", "");
      // 全大文字の DB 型と抽象型だけを拒否し、String、Integer、List<T> 等は受理する。
      if (dataType.equals(dataType.toUpperCase()) && FORBIDDEN_NON_JAVA_TYPES.contains(baseType)) {
        throw new IllegalArgumentException(
            "dataType は具体的な Java 型で指定してください: " + sqlId + "/" + item.fieldName()
                + "=" + dataType);
      }
    }
  }

  /** 対象 Java が使用する SQL 集合と JSON の仕様集合を完全一致で確認する。 */
  private static void verifyUsedSqlIds(Path batchSource, List<SqlSpec> specs,
      Set<String> availableMapperIds) throws Exception {
    // Java は UTF-8 で全文を読み、全 Mapper ID ごとにメソッド呼出しの存在を確認する。
    String source = Files.readString(batchSource, StandardCharsets.UTF_8);
    Set<String> configured = new LinkedHashSet<>();
    Set<String> used = new LinkedHashSet<>();
    for (SqlSpec spec : specs) {
      configured.add(spec.id());
    }
    for (String mapperId : availableMapperIds) {
      Pattern call = Pattern.compile("\\." + Pattern.quote(mapperId) + "\\s*\\(");
      if (call.matcher(source).find()) {
        used.add(mapperId);
      }
    }
    if (!used.equals(configured)) {
      Set<String> missing = new LinkedHashSet<>(configured);
      missing.removeAll(used);
      Set<String> omitted = new LinkedHashSet<>(used);
      omitted.removeAll(configured);
      throw new IllegalStateException("Java・JSON SQL 集合が不一致です。Java 未使用=" + missing
          + ", JSON 記載漏れ=" + omitted);
    }
  }

  /** XML Mapper から対象 SQL の本文と MyBatis 動的タグを取得する。 */
  private static Map<String, String> readMapperSql(InputStream input) throws Exception {
    // MyBatis DOCTYPE は許可する一方、外部 DTD と外部 Entity の読取を禁止する。
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    Document document;
    try (InputStream closeable = input) {
      document = factory.newDocumentBuilder().parse(closeable);
    }

    // SELECT/INSERT/UPDATE/DELETE の各タグを同じ SQL ID マップへ統合する。
    Map<String, String> result = new LinkedHashMap<>();
    for (String tag : List.of("select", "insert", "update", "delete")) {
      NodeList nodes = document.getElementsByTagName(tag);
      for (int index = 0; index < nodes.getLength(); index++) {
        Element element = (Element) nodes.item(index);
        String id = element.getAttribute("id");
        if (!id.isBlank()) {
          result.put(id, serializeChildren(element));
        }
      }
    }
    return result;
  }

  /** オフライン JAR の指定 XML Entry から SQL 群を抽出する。 */
  private static Map<String, String> readSqlFromJar(Path jar, String entryName) throws Exception {
    // 設定された一意 Entry だけを読み、ネットワークやクラスパス探索を発生させない。
    try (ZipFile zip = new ZipFile(jar.toFile())) {
      ZipEntry entry = zip.getEntry(entryName);
      if (entry == null) {
        throw new IllegalStateException("JAR 内 Mapper が見つかりません: " + entryName);
      }
      return readMapperSql(zip.getInputStream(entry));
    }
  }

  /** SQL 要素の子 Node を直列化し、foreach 等を含む本文を保持する。 */
  private static String serializeChildren(Element element) throws Exception {
    Transformer transformer = TransformerFactory.newInstance().newTransformer();
    transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
    transformer.setOutputProperty(OutputKeys.INDENT, "no");
    StringBuilder text = new StringBuilder();
    for (Node node = element.getFirstChild(); node != null; node = node.getNextSibling()) {
      java.io.StringWriter writer = new java.io.StringWriter();
      transformer.transform(new DOMSource(node), new StreamResult(writer));
      text.append(writer);
    }
    return text.toString().replace("\r\n", "\n").replace('\r', '\n').strip();
  }

  /** 一件の SQL 仕様データを参照テンプレートへ反映して保存する。 */
  private static void generateWorkbook(GenerationConfig config, SqlSpec spec, String sqlBody,
      Path sourceWorkbook, Path output) throws Exception {
    // 新規テンプレートまたは修正元 XLSX を出力先へ複製し、入力原本を保護する。
    if (!sourceWorkbook.equals(output)) {
      Files.copy(sourceWorkbook, output, StandardCopyOption.REPLACE_EXISTING);
    }
    Workbook loadedWorkbook;
    // 入力 Stream を先に閉じ、修正元と出力先が同一でも Windows のファイルロックを残さない。
    try (InputStream input = Files.newInputStream(output)) {
      loadedWorkbook = WorkbookFactory.create(input);
    }
    try (Workbook workbook = loadedWorkbook) {
      Sheet sheet = workbook.getSheetAt(0);
      // ファイル名、Sheet 名、SQL ID、SQL 名を同一 JSON レコードから設定する。
      workbook.setSheetName(0, safeSheetName(spec.name()));
      // 表、取得項目、パラメータを一件一行で表示できるよう、各区画を先に拡張する。
      Layout layout = expandDynamicSections(sheet, spec);
      set(sheet, "F4", spec.id());
      set(sheet, "F5", spec.name());
      set(sheet, "AK2", config.functionName());
      set(sheet, "BC1", LocalDate.now().toString());
      set(sheet, "B8", spec.overview());
      set(sheet, address("G", layout.sqlTypeRow()), spec.type().toUpperCase());
      set(sheet, address("G", layout.multipleResultRow()),
          Boolean.toString("SELECT".equalsIgnoreCase(spec.type())));

      // JSON 配列を Excel 各業務区画へ展開し、空のテンプレート項目を残さない。
      fillTables(sheet, spec.tables(), layout);
      fillParameters(sheet, safeList(spec.parameters()), layout);
      fillOutputs(sheet, safeList(spec.outputs()), layout);
      fillStructure(sheet, spec.tables(), spec.overview(), layout);
      int lastRow = fillSqlDetails(sheet, sqlBody, layout.sqlDetailStartRow());
      // 可変行の直後へ SQL 詳細が来るため、手動改頁も SQL 見出し直前へ移動する。
      for (int rowBreak : sheet.getRowBreaks()) {
        sheet.removeRowBreak(rowBreak);
      }
      sheet.setRowBreak(layout.sqlDetailStartRow() - 4);
      workbook.setPrintArea(0, 0, 68, 0, lastRow);
      // 生成後に数式を残さないため、Excel へ再計算を要求しない。
      workbook.setForceFormulaRecalculation(false);
      try (OutputStream stream = Files.newOutputStream(output)) {
        workbook.write(stream);
      }
    }
    // POI 保存後に Demo 固有の計算鎖と注記 Drawing を OOXML パッケージから完全に除去する。
    sanitizeGeneratedPackage(output);
  }

  /** 可変件数に応じて各区画へ行を挿入し、後続見出しと SQL 詳細を一体で移動する。 */
  private static Layout expandDynamicSections(Sheet sheet, SqlSpec spec) {
    int tableCount = spec.tables().size();
    int outputCount = safeList(spec.outputs()).size();
    int parameterCount = safeList(spec.parameters()).size();
    int tableExtra = Math.max(0, tableCount - 1);

    // 利用表は Demo の一行を先頭として、不足行を直後へ追加する。
    if (tableExtra > 0) {
      insertStyledRows(sheet, 17, tableExtra, 16, RowKind.TABLE);
    }

    // 取得項目は Demo の終端行手前へ必要件数分を挿入し、一件一行の距離を維持する。
    int outputDataStart = 23 + tableExtra;
    int parameterTemplateRowAfterOutput = 28 + tableExtra + outputCount;
    if (outputCount > 0) {
      sheet.shiftRows(outputDataStart - 1, sheet.getLastRowNum(), outputCount, true, false);
      for (int index = 0; index < outputCount; index++) {
        prepareOutputRow(sheet, outputDataStart + index, parameterTemplateRowAfterOutput);
      }
    }

    // パラメータは既存一行を利用し、二件目以降だけを終端行手前へ追加する。
    int parameterDataStart = 28 + tableExtra + outputCount;
    int parameterExtra = Math.max(0, parameterCount - 1);
    if (parameterExtra > 0) {
      insertStyledRows(sheet, parameterDataStart + 1, parameterExtra, parameterDataStart,
          RowKind.PARAMETER);
    }

    // データ構造の利用表も一件一行にし、SQL 詳細見出しを表件数に応じて下へ送る。
    int shiftBeforeStructure = tableExtra + outputCount + parameterExtra;
    int structureDataStart = 36 + shiftBeforeStructure;
    int structureExtra = Math.max(0, tableCount - 1);
    if (structureExtra > 0) {
      insertStyledRows(sheet, structureDataStart + 1, structureExtra, structureDataStart,
          RowKind.STRUCTURE);
    }

    int totalShift = shiftBeforeStructure + structureExtra;
    return new Layout(18 + tableExtra, 20 + tableExtra, 16, outputDataStart,
        outputDataStart + outputCount, parameterDataStart,
        parameterDataStart + Math.max(1, parameterCount), 33 + shiftBeforeStructure,
        structureDataStart, 38 + shiftBeforeStructure + structureExtra,
        54 + totalShift);
  }

  /** 利用テーブルを和名、物理名、ロック、備考の対応を崩さず一件一行で記載する。 */
  private static void fillTables(Sheet sheet, List<TableSpec> tables, Layout layout) {
    for (int index = 0; index < tables.size(); index++) {
      TableSpec table = tables.get(index);
      int row = layout.tableDataStartRow() + index;
      set(sheet, address("C", row), Integer.toString(index + 1));
      set(sheet, address("E", row), table.logicalName());
      set(sheet, address("V", row), table.physicalName());
      set(sheet, address("AJ", row), defaultText(table.lock(), "なし"));
      set(sheet, address("AS", row), defaultText(table.note(), "-"));
      sheet.getRow(row - 1).setHeightInPoints(15);
    }
  }

  /** 入力パラメータを業務名、英名、型、備考の同一順序で一件一行に記載する。 */
  private static void fillParameters(Sheet sheet, List<ItemSpec> parameters, Layout layout) {
    if (parameters.isEmpty()) {
      int dataRow = layout.parameterDataStartRow();
      // 空の明細行は値を持たせず、次行の赤色終端枠へ E を配置する。
      clear(sheet, address("C", dataRow), address("E", dataRow), address("M", dataRow),
          address("Z", dataRow), address("AI", dataRow));
      set(sheet, address("C", layout.parameterEndRow()), "E");
      return;
    }
    for (int index = 0; index < parameters.size(); index++) {
      ItemSpec item = parameters.get(index);
      int row = layout.parameterDataStartRow() + index;
      set(sheet, address("C", row), Integer.toString(index + 1));
      set(sheet, address("E", row), item.logicalName());
      set(sheet, address("M", row), item.fieldName());
      set(sheet, address("Z", row), item.dataType());
      set(sheet, address("AI", row), defaultText(item.note(), "-"));
      sheet.getRow(row - 1).setHeightInPoints(15);
    }
    set(sheet, address("C", layout.parameterEndRow()), "E");
  }

  /** SELECT 取得項目を英名、型、業務名、備考へ対応づけて一件一行に記載する。 */
  private static void fillOutputs(Sheet sheet, List<ItemSpec> outputs, Layout layout) {
    if (outputs.isEmpty()) {
      set(sheet, address("C", layout.outputEndRow()), "E");
      return;
    }
    for (int index = 0; index < outputs.size(); index++) {
      ItemSpec item = outputs.get(index);
      int row = layout.outputDataStartRow() + index;
      set(sheet, address("C", row), Integer.toString(index + 1));
      set(sheet, address("E", row), item.fieldName());
      set(sheet, address("R", row), item.dataType());
      set(sheet, address("AA", row), item.logicalName());
      set(sheet, address("AI", row), defaultText(item.note(), "出力データBean"));
      sheet.getRow(row - 1).setHeightInPoints(15);
    }
    set(sheet, address("C", layout.outputEndRow()), "E");
  }

  /** データ構造欄に主利用表と抽出概要を反映する。 */
  private static void fillStructure(Sheet sheet, List<TableSpec> tables, String overview,
      Layout layout) {
    set(sheet, address("C", layout.structureTitleRow()), "(1)メイン構造");
    for (int index = 0; index < tables.size(); index++) {
      int row = layout.structureDataStartRow() + index;
      // Demo の空白行には罫線がないため、値設定前に列組単位の実線格子を構築する。
      ensureStructureGridRow(sheet, row);
      set(sheet, address("E", row), Integer.toString(index + 1));
      set(sheet, address("G", row), tables.get(index).logicalName());
      set(sheet, address("N", row), "-");
      set(sheet, address("T", row), "テーブル");
      set(sheet, address("AA", row), tables.size() > 1 ? "あり" : "-");
      set(sheet, address("AJ", row), tables.size() > 1 ? "SQL詳細参照" : "-");
      set(sheet, address("AU", row), tables.size() > 1 ? "SQL詳細参照" : "-");
      sheet.getRow(row - 1).setHeightInPoints(15);
    }
    set(sheet, address("E", layout.extractionConditionRow()), overview);
  }

  /** SQL 詳細を全置換し、SQL 末尾の罫線と赤色 E 終端行まで印刷対象に含める。 */
  private static int fillSqlDetails(Sheet sheet, String sqlBody, int detailStartRow) {
    // Mapper SQL を表示行へ分割し、各行の末尾空白だけを除去して字下げは維持する。
    List<String> lines = sqlBody.lines().map(String::stripTrailing).toList();
    // 動的 SQL 行へ流用する通常行書式と、SQL 終端へ移動する下罫線書式を退避する。
    List<CellStyle> sqlRowStyles = captureRowStyles(sheet, detailStartRow);
    List<CellStyle> footerRowStyles = captureRowStyles(sheet, sheet.getLastRowNum());
    CellStyle endMarkerStyle = sheet.getRow(sheet.getLastRowNum()).getCell(0).getCellStyle();
    CellStyle whiteStyle = sheet.getWorkbook().getCellStyleAt(0);
    int lastTemplateRow = sheet.getLastRowNum();
    int requiredLastRow = detailStartRow + lines.size() + 1;
    // テンプレート由来の SQL、途中の下罫線、赤色 E 行を対象区画から完全に除去する。
    for (int rowIndex = detailStartRow - 1;
        rowIndex <= Math.max(lastTemplateRow, requiredLastRow - 1); rowIndex++) {
      clearRow(sheet, rowIndex, whiteStyle);
    }
    // 全 SQL 行へ同一の白色本文書式を適用し、途中へ旧フッター罫線を残さない。
    int rowIndex = detailStartRow - 1;
    for (String line : lines) {
      Row row = getOrCreateRow(sheet, rowIndex);
      applyRowStyles(row, sqlRowStyles);
      Cell cell = getOrCreateCell(row, 2);
      cell.setCellValue(line);
      row.setHeightInPoints(15);
      rowIndex++;
    }
    // SQL 本文の直後へ全幅の下罫線を配置し、内容区画の終端を明確にする。
    Row footerRow = getOrCreateRow(sheet, rowIndex);
    applyRowStyles(footerRow, footerRowStyles);
    footerRow.setHeightInPoints(12.75f);
    // 下罫線の後ろへ Demo と同じ赤色 E 終端行を配置し、区画終了を機械判定可能にする。
    Row endMarkerRow = getOrCreateRow(sheet, rowIndex + 1);
    clearRow(sheet, rowIndex + 1, whiteStyle);
    Cell endMarkerCell = getOrCreateCell(endMarkerRow, 0);
    endMarkerCell.setCellStyle(endMarkerStyle);
    endMarkerCell.setCellValue("E");
    endMarkerRow.setHeightInPoints(12.75f);
    // SQL が短い場合も余分な旧テンプレート行を残さず、赤色 E 行を Sheet の最終行にする。
    for (int obsoleteRowIndex = sheet.getLastRowNum(); obsoleteRowIndex > rowIndex + 1;
        obsoleteRowIndex--) {
      Row obsoleteRow = sheet.getRow(obsoleteRowIndex);
      if (obsoleteRow != null) {
        sheet.removeRow(obsoleteRow);
      }
    }
    return rowIndex + 1;
  }

  /** テンプレート行の列別書式を退避し、動的行数へ安全に再配置できるようにする。 */
  private static List<CellStyle> captureRowStyles(Sheet sheet, int rowNumber) {
    Row source = sheet.getRow(rowNumber - 1);
    CellStyle defaultStyle = sheet.getWorkbook().getCellStyleAt(0);
    List<CellStyle> styles = new ArrayList<>();
    // SQL 仕様書の印刷範囲 A:BQ を列単位で保存し、左右枠も含めて再現する。
    for (int column = 0; column <= 68; column++) {
      Cell sourceCell = source == null ? null : source.getCell(column);
      styles.add(sourceCell == null ? defaultStyle : sourceCell.getCellStyle());
    }
    return styles;
  }

  /** 退避したテンプレート書式を対象行へ適用し、行内の罫線位置を統一する。 */
  private static void applyRowStyles(Row row, List<CellStyle> styles) {
    for (int column = 0; column < styles.size(); column++) {
      getOrCreateCell(row, column).setCellStyle(styles.get(column));
    }
  }

  /** 動的 SQL 区画の旧値と旧装飾を消去し、赤色残留のない白色行へ戻す。 */
  private static void clearRow(Sheet sheet, int rowIndex, CellStyle whiteStyle) {
    Row row = getOrCreateRow(sheet, rowIndex);
    for (int column = 0; column <= 68; column++) {
      Cell cell = getOrCreateCell(row, column);
      cell.setBlank();
      cell.setCellStyle(whiteStyle);
    }
  }

  /** 指定位置へ Demo 書式を複製した空行を挿入する。 */
  private static void insertStyledRows(Sheet sheet, int startRow, int count, int sourceRow,
      RowKind rowKind) {
    // 後続区画をまとめて下へ移動し、SQL 見出しと本文の相対位置を壊さない。
    sheet.shiftRows(startRow - 1, sheet.getLastRowNum(), count, true, false);
    for (int offset = 0; offset < count; offset++) {
      int targetRow = startRow + offset;
      copyRowStyles(sheet, sourceRow, targetRow);
      addRowMerges(sheet, targetRow, rowKind);
    }
  }

  /** 取得項目行へパラメータ行のデータ書式を対応列ごとに移植する。 */
  private static void prepareOutputRow(Sheet sheet, int targetRow, int parameterTemplateRow) {
    Row row = getOrCreateRow(sheet, targetRow - 1);
    row.setHeightInPoints(15);
    applyRegionStyle(sheet, parameterTemplateRow, "C", targetRow, "C", "D");
    applyRegionStyle(sheet, parameterTemplateRow, "M", targetRow, "E", "Q");
    applyRegionStyle(sheet, parameterTemplateRow, "Z", targetRow, "R", "Z");
    applyRegionStyle(sheet, parameterTemplateRow, "E", targetRow, "AA", "AH");
    applyRegionStyle(sheet, parameterTemplateRow, "AI", targetRow, "AI", "BO");
    addRowMerges(sheet, targetRow, RowKind.OUTPUT);
  }

  /** 一行分の CellStyle と高さだけを複製し、テンプレート値はコピーしない。 */
  private static void copyRowStyles(Sheet sheet, int sourceRowNumber, int targetRowNumber) {
    Row source = sheet.getRow(sourceRowNumber - 1);
    Row target = getOrCreateRow(sheet, targetRowNumber - 1);
    target.setHeight(source == null ? (short) 300 : source.getHeight());
    if (source == null) {
      return;
    }
    for (int column = 0; column <= 68; column++) {
      Cell sourceCell = source.getCell(column);
      if (sourceCell != null) {
        getOrCreateCell(target, column).setCellStyle(sourceCell.getCellStyle());
      }
    }
  }

  /** 参照セルの Style を対象列範囲へ設定する。 */
  private static void applyRegionStyle(Sheet sheet, int sourceRow, String sourceColumn,
      int targetRow, String startColumn, String endColumn) {
    Cell source = cell(sheet, sourceColumn, sourceRow);
    int start = org.apache.poi.ss.util.CellReference.convertColStringToIndex(startColumn);
    int end = org.apache.poi.ss.util.CellReference.convertColStringToIndex(endColumn);
    Row row = getOrCreateRow(sheet, targetRow - 1);
    for (int column = start; column <= end; column++) {
      getOrCreateCell(row, column).setCellStyle(source.getCellStyle());
    }
  }

  /** 挿入行へ区画固有の横方向マージを追加する。 */
  private static void addRowMerges(Sheet sheet, int rowNumber, RowKind rowKind) {
    List<String[]> columns = switch (rowKind) {
      case TABLE -> List.of(new String[] {"C", "D"}, new String[] {"E", "U"},
          new String[] {"V", "AI"}, new String[] {"AJ", "AR"}, new String[] {"AS", "BO"});
      case OUTPUT -> List.of(new String[] {"C", "D"}, new String[] {"E", "Q"},
          new String[] {"R", "Z"}, new String[] {"AA", "AH"}, new String[] {"AI", "BO"});
      case PARAMETER -> List.of(new String[] {"C", "D"}, new String[] {"E", "L"},
          new String[] {"M", "Y"}, new String[] {"Z", "AH"}, new String[] {"AI", "BO"});
      case STRUCTURE -> List.of(new String[] {"E", "F"}, new String[] {"G", "M"},
          new String[] {"N", "S"}, new String[] {"T", "Z"}, new String[] {"AA", "AI"},
          new String[] {"AJ", "AT"}, new String[] {"AU", "BG"});
    };
    for (String[] range : columns) {
      int firstColumn = org.apache.poi.ss.util.CellReference.convertColStringToIndex(range[0]);
      int lastColumn = org.apache.poi.ss.util.CellReference.convertColStringToIndex(range[1]);
      addMergedRegionIfMissing(sheet, new CellRangeAddress(rowNumber - 1, rowNumber - 1,
          firstColumn, lastColumn));
    }
  }

  /** データ構造明細の七列組へ薄い実線外枠を設定する。 */
  private static void ensureStructureGridRow(Sheet sheet, int rowNumber) {
    for (String[] range : List.of(new String[] {"E", "F"}, new String[] {"G", "M"},
        new String[] {"N", "S"}, new String[] {"T", "Z"}, new String[] {"AA", "AI"},
        new String[] {"AJ", "AT"}, new String[] {"AU", "BG"})) {
      int firstColumn = org.apache.poi.ss.util.CellReference.convertColStringToIndex(range[0]);
      int lastColumn = org.apache.poi.ss.util.CellReference.convertColStringToIndex(range[1]);
      applyThinOutline(sheet, rowNumber, firstColumn, lastColumn);
      addMergedRegionIfMissing(sheet, new CellRangeAddress(rowNumber - 1, rowNumber - 1,
          firstColumn, lastColumn));
    }
  }

  /** 一つの横方向セル群へ上・下・左端・右端の thin Border を設定する。 */
  private static void applyThinOutline(Sheet sheet, int rowNumber, int firstColumn,
      int lastColumn) {
    Row row = getOrCreateRow(sheet, rowNumber - 1);
    for (int column = firstColumn; column <= lastColumn; column++) {
      Cell cell = getOrCreateCell(row, column);
      CellStyle bordered = sheet.getWorkbook().createCellStyle();
      bordered.cloneStyleFrom(cell.getCellStyle());
      bordered.setBorderTop(BorderStyle.THIN);
      bordered.setBorderBottom(BorderStyle.THIN);
      if (column == firstColumn) {
        bordered.setBorderLeft(BorderStyle.THIN);
      }
      if (column == lastColumn) {
        bordered.setBorderRight(BorderStyle.THIN);
      }
      cell.setCellStyle(bordered);
    }
  }

  /** 同一 Merge が未登録の場合だけ追加し、動的行の二重登録を防止する。 */
  private static void addMergedRegionIfMissing(Sheet sheet, CellRangeAddress target) {
    for (CellRangeAddress existing : sheet.getMergedRegions()) {
      if (existing.equals(target)) {
        return;
      }
    }
    sheet.addMergedRegion(target);
  }

  /** 最終 XLSX から無効計算鎖と Demo 注記 Drawing を除去して再包装する。 */
  private static void sanitizeGeneratedPackage(Path output) throws Exception {
    // 工程 OPTION/temp に一時 ZIP を作り、完成時だけ正式出力へ原子的に近い形で置換する。
    Files.createDirectories(PACKAGE_TEMP_DIR);
    Path sanitized = Files.createTempFile(PACKAGE_TEMP_DIR, "sql-spec-sanitize-", ".xlsx");
    try (ZipInputStream input = new ZipInputStream(new BufferedInputStream(Files.newInputStream(output)));
        ZipOutputStream result = new ZipOutputStream(
            new BufferedOutputStream(Files.newOutputStream(sanitized)))) {
      ZipEntry entry;
      while ((entry = input.getNextEntry()) != null) {
        String name = entry.getName();
        byte[] content = input.readAllBytes();
        // 計算鎖本体と、禁止注記・破線図形を保持する Drawing 部品は出力しない。
        if ("xl/calcChain.xml".equals(name) || "xl/drawings/drawing1.xml".equals(name)
            || "xl/drawings/_rels/drawing1.xml.rels".equals(name)) {
          continue;
        }
        if ("[Content_Types].xml".equals(name)) {
          content = removePackageDeclarations(content, true, true);
        } else if ("xl/_rels/workbook.xml.rels".equals(name)) {
          content = removePackageDeclarations(content, true, false);
        } else if ("xl/worksheets/_rels/sheet1.xml.rels".equals(name)) {
          content = removePackageDeclarations(content, false, true);
        } else if ("xl/worksheets/sheet1.xml".equals(name)) {
          content = new String(content, StandardCharsets.UTF_8)
              .replaceAll("<drawing\\s+r:id=\"[^\"]+\"\\s*/>", "")
              .getBytes(StandardCharsets.UTF_8);
        }
        ZipEntry target = new ZipEntry(name);
        target.setTime(entry.getTime());
        result.putNextEntry(target);
        result.write(content);
        result.closeEntry();
      }
    }
    try {
      Files.move(sanitized, output, StandardCopyOption.REPLACE_EXISTING);
    } finally {
      Files.deleteIfExists(sanitized);
    }
  }

  /** ContentTypes または Relationship XML から対象部品宣言を削除する。 */
  private static byte[] removePackageDeclarations(byte[] content, boolean removeCalcChain,
      boolean removeDrawing) {
    String xml = new String(content, StandardCharsets.UTF_8);
    if (removeCalcChain) {
      xml = xml.replaceAll("<Override\\b(?=[^>]*PartName=\"/xl/calcChain.xml\")[^>]*/>", "");
      xml = xml.replaceAll("<Relationship\\b(?=[^>]*Type=\"[^\"]*/calcChain\")[^>]*/>", "");
    }
    if (removeDrawing) {
      xml = xml.replaceAll("<Override\\b(?=[^>]*PartName=\"/xl/drawings/drawing1.xml\")[^>]*/>", "");
      xml = xml.replaceAll("<Relationship\\b(?=[^>]*Type=\"[^\"]*/drawing\")[^>]*/>", "");
    }
    return xml.getBytes(StandardCharsets.UTF_8);
  }

  /** 列記号と一始まり行番号から Excel 座標を作る。 */
  private static String address(String column, int row) {
    return column + row;
  }

  /** 指定座標の Cell を取得し、存在しない場合は生成する。 */
  private static Cell cell(Sheet sheet, String column, int row) {
    int columnIndex = org.apache.poi.ss.util.CellReference.convertColStringToIndex(column);
    return getOrCreateCell(getOrCreateRow(sheet, row - 1), columnIndex);
  }

  /** 配置目录相对路径与工程根目录标记路径统一解析为可读的本地路径。 */
  private static Path resolvePath(Path base, String value) {
    // 工程级路径固定从当前工程根目录展开，保证配置随工程移动后仍指向同一类输入和输出目录。
    if (value.startsWith(PROJECT_PATH_PREFIX)) {
      return PROJECT_ROOT.resolve(value.substring(PROJECT_PATH_PREFIX.length())).normalize();
    }
    // 未使用工程标记的路径继续相对配置文件解析，保留模板引用同目录样例的既有语义。
    Path path = Path.of(value);
    return (path.isAbsolute() ? path : base.resolve(path)).toAbsolutePath().normalize();
  }

  /** 空の任意パスは未指定として扱い、指定時だけ通常解決する。 */
  private static Path resolveOptionalPath(Path base, String value) {
    return value == null || value.isBlank() ? null : resolvePath(base, value);
  }

  /** 入力ファイルの存在と読取権限を業務名付きで検査する。 */
  private static void requireReadable(Path path, String label) {
    if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
      throw new IllegalStateException(label + "を読み取れません: " + path);
    }
  }

  /** 必須文字列が空の場合に JSON 項目名を示して停止する。 */
  private static void requireText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " は必須です。");
    }
  }

  /** Excel 制限文字と 31 文字上限を満たす Sheet 名へ変換する。 */
  private static String safeSheetName(String value) {
    String safe = value.replaceAll("[\\\\/?*\\[\\]:]", "_");
    return safe.length() <= 31 ? safe : safe.substring(0, 31);
  }

  /** 指定セルへ値を設定し、テンプレートの既存スタイルを保持する。 */
  private static void set(Sheet sheet, String address, String value) {
    org.apache.poi.ss.util.CellReference reference = new org.apache.poi.ss.util.CellReference(address);
    Cell cell = getOrCreateCell(getOrCreateRow(sheet, reference.getRow()), reference.getCol());
    // Demo の SQL 名セルに残る配列数式を解除し、生成対象 SQL の固定名称へ確実に置換する。
    if (cell.isPartOfArrayFormulaGroup()) {
      sheet.removeArrayFormula(cell);
    } else if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.FORMULA) {
      cell.removeFormula();
    }
    cell.setCellValue(defaultText(value, ""));
  }

  /** テンプレート由来の不要値を空文字で明示的に消去する。 */
  private static void clear(Sheet sheet, String... addresses) {
    for (String address : addresses) {
      set(sheet, address, "");
    }
  }

  /** 未作成行だけを生成し、既存の高さやスタイルを壊さない。 */
  private static Row getOrCreateRow(Sheet sheet, int rowIndex) {
    Row row = sheet.getRow(rowIndex);
    return row == null ? sheet.createRow(rowIndex) : row;
  }

  /** 未作成セルだけを生成し、既存セルの書式を維持する。 */
  private static Cell getOrCreateCell(Row row, int columnIndex) {
    Cell cell = row.getCell(columnIndex);
    return cell == null ? row.createCell(columnIndex) : cell;
  }

  /** null リストを空リストへ正規化し、任意の入出力欄を安全に扱う。 */
  private static <T> List<T> safeList(List<T> values) {
    return values == null ? List.of() : values;
  }

  /** null または空文字だけを指定既定値へ置換する。 */
  private static String defaultText(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  /** 行挿入時に複製する業務区画の種類を表す。 */
  private enum RowKind {
    TABLE,
    OUTPUT,
    PARAMETER,
    STRUCTURE
  }

  /** 動的行挿入後の各業務区画の一始まり行番号を保持する。 */
  private record Layout(int sqlTypeRow, int multipleResultRow, int tableDataStartRow,
      int outputDataStartRow, int outputEndRow, int parameterDataStartRow,
      int parameterEndRow, int structureTitleRow, int structureDataStartRow,
      int extractionConditionRow, int sqlDetailStartRow) {
  }

  /** JSON ルートの生成条件と SQL 一覧を受け取る。 */
  public record GenerationConfig(String version, String templatePath, String outputDirectory,
      String fileNamePrefix, String batchSourcePath, String functionName,
      List<MapperSource> mapperSources, List<SqlSpec> sqlSpecifications) {
  }

  /** 通常 XML または JAR 内 XML の Mapper 入力位置を受け取る。 */
  public record MapperSource(String kind, String path, String entry) {
  }

  /** 一件の SQL 仕様書を構成する業務情報を受け取る。 */
  public record SqlSpec(String id, String name, String overview, String type, String operation,
      String baseWorkbookPath,
      List<TableSpec> tables, List<ItemSpec> parameters, List<ItemSpec> outputs) {
  }

  /** 利用表の和名、物理名、ロック、備考を受け取る。 */
  public record TableSpec(String logicalName, String physicalName, String lock, String note) {
  }

  /** パラメータまたは取得項目の業務名、英名、型、備考を受け取る。 */
  public record ItemSpec(String logicalName, String fieldName, String dataType, String note) {
  }
}
