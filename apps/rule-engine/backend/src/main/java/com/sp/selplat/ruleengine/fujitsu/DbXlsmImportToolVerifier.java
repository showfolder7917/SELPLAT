package com.sp.selplat.ruleengine.fujitsu;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.openxml4j.opc.PackageRelationship;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.w3c.dom.Element;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * DBデータ生成ツール の全量同期結果とマクロ保持をオフライン検証します。
 */
public class DbXlsmImportToolVerifier {

  /** JSON を UTF-8 かつ順序保持で比較するための mapper です。 */
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /** データ列が始まる K 列の 0 origin 列番号です。 */
  private static final int DATA_START_COLUMN = 10;

  /** testCaseId を保持する 10 行目の 0 origin 行番号です。 */
  private static final int TEST_CASE_ID_ROW_INDEX = 9;

  /** データ項目が始まる 14 行目の 0 origin 行番号です。 */
  private static final int DATA_FIELD_START_ROW_INDEX = 13;

  /** VBA が対象テーブルとして認識する原版互換のチェック印です。 */
  private static final String ENABLED_MARK = "✔";

  /** JSON の欠落と空配列を区別する Java 専用存在清单シート名です。 */
  private static final String JSON_PRESENCE_SHEET_NAME = "_acode_json_presence";

  /** Excel のワークシート重複判定に使用される revision 名前空間です。 */
  private static final String REVISION_NAMESPACE =
      "http://schemas.microsoft.com/office/spreadsheetml/2014/revision";

  /**
   * 生成 xlsm・db ルート・原版 xlsm を受け取り、全検証を実行します。
   *
   * @param args 生成 xlsm、db ルート、原版 xlsm の順です。
   * @throws Exception 検証不一致またはファイル読込失敗時に送出します。
   */
  public static void main(String[] args) throws Exception {
    // 业务上検証対象を曖昧にしないため、3 つの絶対パス指定を必須にします。
    if (args.length != 3) {
      throw new IllegalArgumentException("Usage: DbXlsmImportToolVerifier <generatedXlsm> <dbRoot> <baselineXlsm>");
    }
    // 业务上生成物、源データ、宏基准をそれぞれ独立した Path として保持します。
    Path generatedXlsm = Path.of(args[0]);
    Path databaseRoot = Path.of(args[1]);
    Path baselineXlsm = Path.of(args[2]);
    // 业务上宏二进制完全一致を最初に確認し、反向 JSON 能力を失った生成物を後段へ通しません。
    verifyMacroHash(generatedXlsm, baselineXlsm);
    // 业务上 Workbook と JSON を同時に照合し、定義・ケース一覧・全セル値を確認します。
    try (InputStream inputStream = Files.newInputStream(generatedXlsm); Workbook workbook = new XSSFWorkbook(inputStream)) {
      DataFormatter formatter = new DataFormatter();
      Map<String, DefinitionPayload> definitions = readDefinitions(databaseRoot.resolve("define"));
      List<Path> caseDirectories = listCaseDirectories(databaseRoot.resolve("testCase"));
      // 业务上所有 Sheet 的内部 UID 必须唯一，防止 Excel 打开时替换新增业务 Sheet。
      verifyUniqueWorksheetIds(workbook);
      // 业务上工作表控件关系必须单独归属，防止克隆 Sheet 共用 VML/ctrlProp 后被 Excel 替换。
      verifyWorksheetControlRelationships(workbook);
      // 业务上测试用例清单必须使用当前 db 所属工程号，防止宏把结果路由到旧工程。
      verifyProjectId(workbook, databaseRoot.getParent().getFileName().toString(), formatter);
      verifyDefinitions(workbook, definitions, formatter);
      verifyCaseList(workbook, caseDirectories, formatter);
      verifyMode(workbook, caseDirectories, definitions.keySet(), "input", "inp_", formatter);
      verifyMode(workbook, caseDirectories, definitions.keySet(), "expect", "exp_", formatter);
      // 业务上记录件数为 0 的 JSON 也必须由存在清单验证，避免验证器再次把缺失与空表视为相同。
      verifyJsonPresence(workbook, caseDirectories, formatter);
      verifyTableList(workbook, caseDirectories, definitions, formatter);
    }
    // 业务上全検証完了を固定文言で出し、VS Code task が成功を判定できるようにします。
    System.out.println("VERIFIED: definitions, cases, cells, JSON presence, table-list and VBA macro are consistent.");
  }

  /** ワークシートのフォームコントロール関係が矛盾せず、共有されていないことを確認します。 */
  private static void verifyWorksheetControlRelationships(Workbook workbook) throws InvalidFormatException {
    // 业务上不可共享部件的目标 URI 与首个拥有 Sheet 对应保存，用于检出第二个所有者。
    Map<String, String> relationshipOwnerByTarget = new HashMap<>();
    // 业务上逐 Sheet 同时核对 XML controls 节点和 OPC 关系所有权，覆盖 Excel 特有修复条件。
    for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
      // 业务上 XLSM 工作表统一按 XSSF 读取底层节点和包关系。
      XSSFSheet sheet = (XSSFSheet) workbook.getSheetAt(sheetIndex);
      // 业务上从最终 DOM 搜索 AlternateContent 中的 controls，避免 schema API 漏掉 Excel 扩展节点。
      boolean hasControls = ((Element) sheet.getCTWorksheet().getDomNode())
          .getElementsByTagNameNS("*", "controls").getLength() > 0;
      // 业务上存在 controls 时必须同时存在 legacyDrawing，避免控件声明没有对应 VML 图形。
      require(!hasControls || sheet.getCTWorksheet().isSetLegacyDrawing(),
          "worksheet controls without legacyDrawing: " + sheet.getSheetName());
      // 业务上遍历工作表关系，锁定不可跨 Sheet 共用的 VML、控件属性和打印设置部件。
      for (PackageRelationship relationship : sheet.getPackagePart().getRelationships()) {
        // 业务上普通图像等可共享资源不在本规则范围，只检查 Excel 要求独立所有权的关系类型。
        if (!isNonShareableWorksheetRelationship(relationship.getRelationshipType())) {
          continue;
        }
        // 业务上相对目标 URI 在 worksheets 目录下可作为稳定部件标识，用于比较不同 Sheet 的所有权。
        String relationshipTarget = relationship.getTargetURI().toString();
        // 业务上记录首个所有者；若已有其他 Sheet 占用同一部件，则生成包会触发 Excel 修复。
        String existingOwner = relationshipOwnerByTarget.putIfAbsent(relationshipTarget, sheet.getSheetName());
        require(existingOwner == null,
            "worksheet relationship shared: " + relationshipTarget + " / " + existingOwner
                + " / " + sheet.getSheetName());
      }
    }
  }

  /** VML・コントロール属性・印刷設定の共有禁止関係かを判定します。 */
  private static boolean isNonShareableWorksheetRelationship(String relationshipType) {
    // 业务上这三类部件都包含 Sheet 专属标识或状态，模板克隆时不能继续指向同一目标。
    return relationshipType.endsWith("/vmlDrawing")
        || relationshipType.endsWith("/ctrlProp")
        || relationshipType.endsWith("/printerSettings");
  }

  /** 全ワークシートの revision UID が存在し、重複しないことを確認します。 */
  private static void verifyUniqueWorksheetIds(Workbook workbook) {
    // 业务上已出现的 UID 用集合保存，使模板与任一克隆 Sheet 的重复都能立即检出。
    Set<String> worksheetIds = new java.util.HashSet<>();
    // 业务上逐 Sheet 检查 Excel 实际使用的底层 UID，而不是只验证普通 XML 能否解析。
    for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
      // 业务上 XLSM Sheet 必须是 XSSF 类型，才能读取 revision UID 根属性。
      XSSFSheet sheet = (XSSFSheet) workbook.getSheetAt(sheetIndex);
      // 业务上通过 DOM 读取保存时实际使用的 worksheet 根属性，避免验证游标与最终 XML 不一致。
      if (!(sheet.getCTWorksheet().getDomNode() instanceof Element worksheetElement)) {
        throw new IllegalStateException("worksheet XML root not found: " + sheet.getSheetName());
      }
      // 业务上取得当前 Sheet 的 UID，供缺失和重复两类状态分别判定。
      String worksheetId = worksheetElement.getAttributeNS(REVISION_NAMESPACE, "uid");
      // 业务上原模板的部分管理 Sheet 本来没有 UID，此类缺省值不参与重复判定。
      if (worksheetId == null || worksheetId.isBlank()) {
        continue;
      }
      // 业务上 UID 重复就是本次 Excel 替换 Sheet 的根因，必须在交付前阻断。
      require(worksheetIds.add(worksheetId),
          "worksheet UID duplicated: " + sheet.getSheetName() + " / " + worksheetId);
    }
  }

  /** テストケース一覧の処理 ID が対象工程と一致することを確認します。 */
  private static void verifyProjectId(Workbook workbook, String expectedProjectId, DataFormatter formatter) {
    // 业务上宏反向生成的工程路由来自测试用例清单，因此必须确认管理 Sheet 存在。
    Sheet caseList = workbook.getSheet("テストケース一覧");
    require(caseList != null, "テストケース一覧 sheet missing");
    // 业务上 B3 必须等于 db 目录所属工程号，禁止继续保留 CPMAB081 模板值。
    String actualProjectId = cellText(caseList, 2, 1, formatter);
    require(expectedProjectId.equals(actualProjectId),
        "project ID mismatch: " + actualProjectId + " != " + expectedProjectId);
  }

  /** 原版と生成物の vbaProject.bin SHA-256 を比較します。 */
  private static void verifyMacroHash(Path generatedXlsm, Path baselineXlsm)
      throws IOException, NoSuchAlgorithmException {
    // 业务上反向 JSON 宏のコード本体は 1 byte でも変化を許さず、ハッシュ完全一致を要求します。
    String generatedHash = hashZipEntry(generatedXlsm, "xl/vbaProject.bin");
    String baselineHash = hashZipEntry(baselineXlsm, "xl/vbaProject.bin");
    require(generatedHash.equals(baselineHash), "VBA hash mismatch: " + generatedHash + " != " + baselineHash);
  }

  /** ZIP 内の指定 entry を SHA-256 化します。 */
  private static String hashZipEntry(Path zipPath, String entryName)
      throws IOException, NoSuchAlgorithmException {
    // 业务上 xlsm を ZIP として開き、宏部件だけを他の可変 XML から切り離して検証します。
    try (ZipFile zipFile = new ZipFile(zipPath.toFile())) {
      ZipEntry entry = zipFile.getEntry(entryName);
      require(entry != null, "ZIP entry not found: " + entryName + " in " + zipPath);
      // 业务上 SHA-256 で宏内容を読み切り、原版との完全一致値を生成します。
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      try (InputStream inputStream = zipFile.getInputStream(entry)) {
        byte[] buffer = new byte[8192];
        int readLength;
        while ((readLength = inputStream.read(buffer)) >= 0) {
          digest.update(buffer, 0, readLength);
        }
      }
      // 业务上バイト列を固定 16 進表記へ変換して比較・記録可能にします。
      StringBuilder hash = new StringBuilder();
      for (byte value : digest.digest()) {
        hash.append(String.format("%02X", value));
      }
      return hash.toString();
    }
  }

  /** define JSON を物理テーブル名単位に読み取ります。 */
  private static Map<String, DefinitionPayload> readDefinitions(Path defineDirectory) throws IOException {
    // 业务上 define ファイル順を固定し、検証エラーの再現順序を安定させます。
    Map<String, DefinitionPayload> definitions = new LinkedHashMap<>();
    try (var stream = Files.list(defineDirectory)) {
      for (Path jsonFile : stream.filter(path -> path.getFileName().toString().endsWith(".json")).sorted().toList()) {
        Map<String, Object> json = OBJECT_MAPPER.readValue(Files.readString(jsonFile), new TypeReference<LinkedHashMap<String, Object>>() {});
        String physicalTableName = stringValue(json.get("physicalTableName"));
        String logicalTableName = stringValue(json.get("logicalTableName"));
        List<Map<String, Object>> fields = mapList(json.get("tableStructure"));
        definitions.put(physicalTableName, new DefinitionPayload(logicalTableName, fields));
      }
    }
    return definitions;
  }

  /** testCase 直下の case を安定順で列挙します。 */
  private static List<Path> listCaseDirectories(Path testCaseDirectory) throws IOException {
    // 业务上ディレクトリだけを case とみなし、名称昇順で Workbook の一覧順と比較します。
    try (var stream = Files.list(testCaseDirectory)) {
      return stream.filter(Files::isDirectory)
          .sorted(Comparator.comparing(path -> path.getFileName().toString())).toList();
    }
  }

  /** define の項目順と def_/inp_ シート定義を検証します。 */
  private static void verifyDefinitions(Workbook workbook, Map<String, DefinitionPayload> definitions,
      DataFormatter formatter) {
    // 业务上各物理表には必ず def_ と inp_ が存在し、字段数・物理名順が define と一致する必要があります。
    for (Map.Entry<String, DefinitionPayload> entry : definitions.entrySet()) {
      String physicalTableName = entry.getKey();
      List<Map<String, Object>> fields = entry.getValue().fields();
      Sheet definitionSheet = findSheet(workbook, "def_", physicalTableName, formatter);
      Sheet inputSheet = findSheet(workbook, "inp_", physicalTableName, formatter);
      require(definitionSheet != null, "definition sheet missing: " + physicalTableName);
      require(inputSheet != null, "input sheet missing: " + physicalTableName);
      verifyFieldOrder(definitionSheet, 9, fields, formatter);
      verifyFieldOrder(inputSheet, DATA_FIELD_START_ROW_INDEX, fields, formatter);
    }
  }

  /** シート D 列の物理項目名順を define と比較します。 */
  private static void verifyFieldOrder(Sheet sheet, int startRowIndex, List<Map<String, Object>> fields,
      DataFormatter formatter) {
    // 业务上 define の各字段を同じ行オフセットで照合し、字段ずれを即座に特定します。
    for (int fieldIndex = 0; fieldIndex < fields.size(); fieldIndex++) {
      String expected = stringValue(fields.get(fieldIndex).get("physicalName"));
      String actual = cellText(sheet, startRowIndex + fieldIndex, 3, formatter);
      require(expected.equals(actual), sheet.getSheetName() + " field mismatch at " + fieldIndex + ": " + actual + " != " + expected);
    }
    // 业务上最終字段の次に旧物理名が残っていないことを確認し、反向 JSON への余分な項目混入を防ぎます。
    String trailing = cellText(sheet, startRowIndex + fields.size(), 3, formatter);
    require(trailing.isBlank(), sheet.getSheetName() + " has stale trailing field: " + trailing);
  }

  /** テストケース一覧が source case と完全一致することを検証します。 */
  private static void verifyCaseList(Workbook workbook, List<Path> caseDirectories, DataFormatter formatter) {
    // 业务上一覧 B 列の非空 caseId を抽出し、source の 5 case と順序まで一致させます。
    Sheet sheet = workbook.getSheet("テストケース一覧");
    require(sheet != null, "テストケース一覧 sheet missing");
    List<String> actualCaseIds = new ArrayList<>();
    for (int rowIndex = 6; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      String caseId = cellText(sheet, rowIndex, 1, formatter);
      if (!caseId.isBlank()) {
        actualCaseIds.add(caseId);
      }
    }
    List<String> expectedCaseIds = caseDirectories.stream().map(path -> path.getFileName().toString()).toList();
    require(expectedCaseIds.equals(actualCaseIds), "case list mismatch: " + actualCaseIds + " != " + expectedCaseIds);
  }

  /** input または expect の全 JSON レコードを Workbook セルと比較します。 */
  private static void verifyMode(Workbook workbook, List<Path> caseDirectories, Set<String> definedTables,
      String sourceMode, String sheetPrefix, DataFormatter formatter) throws IOException {
    // 业务上 case 単位で存在 JSON を読み、各表の record 件数と全字段値を列順どおり比較します。
    for (Path caseDirectory : caseDirectories) {
      String caseId = caseDirectory.getFileName().toString();
      Map<String, List<Map<String, Object>>> recordsByTable = readCasePayloads(caseDirectory.resolve(sourceMode));
      for (String physicalTableName : definedTables) {
        List<Map<String, Object>> expectedRecords = recordsByTable.getOrDefault(physicalTableName, List.of());
        Sheet sheet = findSheet(workbook, sheetPrefix, physicalTableName, formatter);
        if (sheet == null) {
          require(expectedRecords.isEmpty(), sheetPrefix + " sheet missing for non-empty table: " + physicalTableName);
          continue;
        }
        List<Integer> columns = findCaseColumns(sheet, caseId, formatter);
        require(columns.size() == expectedRecords.size(), sheetPrefix + physicalTableName + " record count mismatch for " + caseId);
        for (int recordIndex = 0; recordIndex < expectedRecords.size(); recordIndex++) {
          verifyRecord(sheet, columns.get(recordIndex), expectedRecords.get(recordIndex), formatter, caseId);
        }
      }
    }
  }

  /** case の input/expect JSON を物理表単位に読み取ります。 */
  private static Map<String, List<Map<String, Object>>> readCasePayloads(Path directory) throws IOException {
    // 业务上 directory 不存在は対象 JSON なしとして扱い、Workbook 側も 0 列であることを検証します。
    Map<String, List<Map<String, Object>>> recordsByTable = new HashMap<>();
    if (!Files.isDirectory(directory)) {
      return recordsByTable;
    }
    try (var stream = Files.list(directory)) {
      for (Path jsonFile : stream.filter(path -> path.getFileName().toString().endsWith(".json")).sorted().toList()) {
        Map<String, Object> json = OBJECT_MAPPER.readValue(Files.readString(jsonFile), new TypeReference<LinkedHashMap<String, Object>>() {});
        recordsByTable.put(stringValue(json.get("physicalTableName")), mapList(json.get("tableData")));
      }
    }
    return recordsByTable;
  }

  /** 1 record の全項目値を物理名行と比較します。 */
  private static void verifyRecord(Sheet sheet, int columnIndex, Map<String, Object> expectedRecord,
      DataFormatter formatter, String caseId) {
    // 业务上 JSON の各物理項目をシート D 列から探し、同じ record 列の表示値と比較します。
    for (Map.Entry<String, Object> field : expectedRecord.entrySet()) {
      int rowIndex = findFieldRow(sheet, field.getKey(), formatter);
      require(rowIndex >= 0, sheet.getSheetName() + " field row missing: " + field.getKey());
      // 业务上测试数据中的前后空白具有边界值意义，实际数据セル比較では trim しません。
      String actual = semanticCellText(sheet, rowIndex, columnIndex, formatter);
      String expected = stringValue(field.getValue());
      require(expected.equals(actual), sheet.getSheetName() + " cell mismatch " + caseId + "/" + field.getKey() + ": " + actual + " != " + expected);
    }
  }

  /** JSON 存在清单が全 Case の実在ファイル集合と完全一致することを確認します。 */
  private static void verifyJsonPresence(Workbook workbook, List<Path> caseDirectories,
      DataFormatter formatter) throws IOException {
    // 业务上期待集合直接由文件是否存在构建，tableData 件数不参与判断。
    Set<String> expectedPresences = new LinkedHashSet<>();
    for (Path caseDirectory : caseDirectories) {
      String caseId = caseDirectory.getFileName().toString();
      for (String mode : List.of("input", "expect")) {
        // 业务上每个 mode 读取 JSON 的 physicalTableName，文件存在即登记。
        Path directory = caseDirectory.resolve(mode);
        if (!Files.isDirectory(directory)) {
          continue;
        }
        try (var stream = Files.list(directory)) {
          for (Path jsonFile : stream
              .filter(path -> path.getFileName().toString().endsWith(".json")).sorted().toList()) {
            Map<String, Object> json = OBJECT_MAPPER.readValue(Files.readString(jsonFile),
                new TypeReference<LinkedHashMap<String, Object>>() {});
            expectedPresences.add(mode + "|" + caseId + "|"
                + stringValue(json.get("physicalTableName")));
          }
        }
      }
    }
    // 业务上工作簿必须包含 Java 专用清单，否则无法支持无损反向同步。
    Sheet sheet = workbook.getSheet(JSON_PRESENCE_SHEET_NAME);
    require(sheet != null, "JSON presence sheet missing");
    Set<String> actualPresences = new LinkedHashSet<>();
    for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      // 业务上 mode、Case、物理表三列组成唯一存在键。
      String mode = cellText(sheet, rowIndex, 0, formatter);
      String caseId = cellText(sheet, rowIndex, 1, formatter);
      String physicalTableName = cellText(sheet, rowIndex, 2, formatter);
      if (!mode.isBlank() && !caseId.isBlank() && !physicalTableName.isBlank()) {
        actualPresences.add(mode + "|" + caseId + "|" + physicalTableName);
      }
    }
    // 业务上双向可逆要求集合完全一致，多条或少条都必须失败。
    require(expectedPresences.equals(actualPresences),
        "JSON presence mismatch: actual=" + actualPresences + ", expected=" + expectedPresences);
  }

  /** テーブル一覧の input/expect 選択印を source JSON 出現状況と比較します。 */
  private static void verifyTableList(Workbook workbook, List<Path> caseDirectories,
      Map<String, DefinitionPayload> definitions, DataFormatter formatter) throws IOException {
    // 业务上全 case から実際に使う input/expect 表を集計し、宏出力対象マークの有無と一致させます。
    Set<String> inputTables = collectTables(caseDirectories, "input");
    Set<String> expectTables = collectTables(caseDirectories, "expect");
    Sheet tableList = workbook.getSheet("テーブル一覧");
    require(tableList != null, "テーブル一覧 sheet missing");
    for (String physicalTableName : definitions.keySet()) {
      int rowIndex = findTableListRow(tableList, physicalTableName, formatter);
      require(rowIndex >= 0, "table-list row missing: " + physicalTableName);
      // 业务上输入选择标记必须使用旧 VBA 识别的原版字符，非空但不同的圆圈也判为不兼容。
      String expectedInputMark = inputTables.contains(physicalTableName) ? ENABLED_MARK : "";
      // 业务上期待值选择标记同样使用原版字符，确保宏能识别需要反向输出的表。
      String expectedExpectMark = expectTables.contains(physicalTableName) ? ENABLED_MARK : "";
      // 业务上逐表确认 input 标记字符完全一致，而不是只判断单元格非空。
      require(expectedInputMark.equals(cellText(tableList, rowIndex, 2, formatter)),
          "input mark mismatch: " + physicalTableName);
      // 业务上逐表确认 expect 标记字符完全一致，避免宏静默跳过新表。
      require(expectedExpectMark.equals(cellText(tableList, rowIndex, 3, formatter)),
          "expect mark mismatch: " + physicalTableName);
    }
  }

  /** case JSON に出現する物理テーブル名を集計します。 */
  private static Set<String> collectTables(List<Path> caseDirectories, String mode) throws IOException {
    // 业务上既存 Map の keySet を統合し、空 tableData の JSON も対象表として保持します。
    Set<String> tables = new java.util.LinkedHashSet<>();
    for (Path caseDirectory : caseDirectories) {
      tables.addAll(readCasePayloads(caseDirectory.resolve(mode)).keySet());
    }
    return tables;
  }

  /** prefix と C4 物理名で Workbook シートを探します。 */
  private static Sheet findSheet(Workbook workbook, String prefix, String physicalTableName, DataFormatter formatter) {
    // 业务上表示名変更に依存せず、物理テーブル名を一意な照合キーにします。
    for (int index = 0; index < workbook.getNumberOfSheets(); index++) {
      Sheet sheet = workbook.getSheetAt(index);
      if (sheet.getSheetName().startsWith(prefix) && physicalTableName.equals(cellText(sheet, 3, 2, formatter))) {
        return sheet;
      }
    }
    return null;
  }

  /** 指定 caseId のデータ列を左から順に返します。 */
  private static List<Integer> findCaseColumns(Sheet sheet, String caseId, DataFormatter formatter) {
    // 业务上 K 列以降だけを対象とし、同一 case の複数 record 列順を保持します。
    List<Integer> columns = new ArrayList<>();
    Row headerRow = sheet.getRow(TEST_CASE_ID_ROW_INDEX);
    int lastColumn = headerRow == null ? DATA_START_COLUMN : Math.max(DATA_START_COLUMN, headerRow.getLastCellNum());
    for (int columnIndex = DATA_START_COLUMN; columnIndex < lastColumn; columnIndex++) {
      if (caseId.equals(cellText(sheet, TEST_CASE_ID_ROW_INDEX, columnIndex, formatter))) {
        columns.add(columnIndex);
      }
    }
    return columns;
  }

  /** D 列から物理項目名の行を探します。 */
  private static int findFieldRow(Sheet sheet, String physicalName, DataFormatter formatter) {
    // 业务上定义行范围を末尾まで見て、対象物理項目の実データ行を返します。
    for (int rowIndex = DATA_FIELD_START_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      if (physicalName.equals(cellText(sheet, rowIndex, 3, formatter))) {
        return rowIndex;
      }
    }
    return -1;
  }

  /** テーブル一覧 F 列から物理テーブル行を探します。 */
  private static int findTableListRow(Sheet sheet, String physicalTableName, DataFormatter formatter) {
    // 业务上一覧全体を物理名で検索し、新規追加表を含めて正確な行を返します。
    for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      if (physicalTableName.equals(cellText(sheet, rowIndex, 5, formatter))) {
        return rowIndex;
      }
    }
    return -1;
  }

  /** セル表示値を trim 済み文字列で返します。 */
  private static String cellText(Sheet sheet, int rowIndex, int columnIndex, DataFormatter formatter) {
    // 业务上不存在行・セルを空欄と統一し、JSON の空値と比較可能にします。
    Row row = sheet.getRow(rowIndex);
    Cell cell = row == null ? null : row.getCell(columnIndex);
    return cell == null ? "" : formatter.formatCellValue(cell).trim();
  }

  /** セル表示値を前後空白を保持したまま返します。 */
  private static String cellDisplayText(Sheet sheet, int rowIndex, int columnIndex, DataFormatter formatter) {
    // 业务上组织名などの空白边界テストを改変せず比较するため、表示値をそのまま返します。
    Row row = sheet.getRow(rowIndex);
    Cell cell = row == null ? null : row.getCell(columnIndex);
    return cell == null ? "" : formatter.formatCellValue(cell);
  }

  /** Java 导入的单引号占位を JSON 空文字として意味比較します。 */
  private static String semanticCellText(Sheet sheet, int rowIndex, int columnIndex,
      DataFormatter formatter) {
    // 业务上 null 的空白 Cell 和显式空字符串占位在显示层不同，比较时分别还原业务语义。
    String displayedValue = cellDisplayText(sheet, rowIndex, columnIndex, formatter);
    if ("'".equals(displayedValue) || "''".equals(displayedValue)) {
      return "";
    }
    return displayedValue;
  }

  /** JSON 配列を順序保持 Map 一覧へ変換します。 */
  private static List<Map<String, Object>> mapList(Object rawList) {
    // 业务上配列以外は空一覧とし、空 tableData と同じ検証口径に揃えます。
    List<Map<String, Object>> converted = new ArrayList<>();
    if (!(rawList instanceof List<?> rows)) {
      return converted;
    }
    for (Object row : rows) {
      if (row instanceof Map<?, ?> map) {
        Map<String, Object> convertedRow = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          convertedRow.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        converted.add(convertedRow);
      }
    }
    return converted;
  }

  /** null を空欄として文字列化します。 */
  private static String stringValue(Object value) {
    // 业务上 null を文字列 "null" にせず、Workbook の空欄と一致させます。
    return value == null ? "" : String.valueOf(value);
  }

  /** 条件不成立時に検証を即時失敗させます。 */
  private static void require(boolean condition, String message) {
    // 业务上最初の不一致位置を明確にし、不完全な工作簿を合格扱いしません。
    if (!condition) {
      throw new IllegalStateException(message);
    }
  }

  /** define の論理名と字段一覧を保持します。 */
  private record DefinitionPayload(String logicalTableName, List<Map<String, Object>> fields) {
  }
}
