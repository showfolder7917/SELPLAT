package com.sp.selplat.local.code.common.fujitsu.app.db;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Comment;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Hyperlink;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.SheetVisibility;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.openxml4j.opc.PackageRelationship;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.openxmlformats.schemas.spreadsheetml.x2006.main.CTWorksheet;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * xlsm 形式の DB データ生成ツールへ define / testCase JSON を全量同期する補助ツールです。
 */
public class DBデータ生成ツール {
  // implementation "org.apache.poi:poi:5.2.5"
  // implementation "org.apache.poi:poi-ooxml:5.2.5"
  // implementation 'org.junit.platform:junit-platform-launcher:1.9.1'

  /** JSON を UTF-8 で安定して読み取るための mapper です。 */
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /** 呼出元が工程ルートを明示する場合に使用するシステムプロパティです。 */
  private static final String PROJECT_ROOT_PROPERTY = "acode.currentProjectRoot";

  /** JSON の存在状態を保持し、欠落と空配列を区別する非表示シート名です。 */
  private static final String JSON_PRESENCE_SHEET_NAME = "_acode_json_presence";

  /** JSON 存在状態シートで input / expect を保持する列です。 */
  private static final int PRESENCE_MODE_COLUMN = 0;

  /** JSON 存在状態シートでテストケース ID を保持する列です。 */
  private static final int PRESENCE_CASE_COLUMN = 1;

  /** JSON 存在状態シートで物理テーブル名を保持する列です。 */
  private static final int PRESENCE_TABLE_COLUMN = 2;

  /** テストケース一覧へ新規登録する時の既定区分です。 */
  private static final String DEFAULT_CASE_STATUS = "正常";

  /** xlsm テンプレートで testCase 列が始まる K 列の番号です。 */
  private static final int DATA_START_COLUMN = CellReference.convertColStringToIndex("K");

  /** 項目の物理名が並ぶ D 列の番号です。 */
  private static final int FIELD_NAME_COLUMN = CellReference.convertColStringToIndex("D");

  /** testCaseId を書く 10 行目の 0 origin 行番号です。 */
  private static final int TEST_CASE_ID_ROW_INDEX = 9;

  /** 出力列番号を持つ 9 行目の 0 origin 行番号です。 */
  private static final int OUTPUT_HEADER_ROW_INDEX = 8;

  /** 対象外チェックを持つ 11 行目の 0 origin 行番号です。 */
  private static final int EXCLUDED_ROW_INDEX = 10;

  /** 操作種別を持つ 12 行目の 0 origin 行番号です。 */
  private static final int OPERATION_ROW_INDEX = 11;

  /** 実データ項目が始まる 14 行目の 0 origin 行番号です。 */
  private static final int DATA_FIELD_START_ROW_INDEX = 13;

  /** テストケース一覧の先頭データ行です。 */
  private static final int TEST_CASE_LIST_START_ROW_INDEX = 6;

  /** 定義シートで項目定義が始まる 10 行目の 0 origin 行番号です。 */
  private static final int DEFINITION_FIELD_START_ROW_INDEX = 9;

  /** 定義 JSON とシートを対応付ける物理テーブル名セルの列番号です。 */
  private static final int PHYSICAL_TABLE_NAME_COLUMN = 2;

  /** テーブル一覧で入力対象を表す C 列の番号です。 */
  private static final int TABLE_LIST_INPUT_COLUMN = 2;

  /** テーブル一覧で期待値対象を表す D 列の番号です。 */
  private static final int TABLE_LIST_EXPECT_COLUMN = 3;

  /** テーブル一覧で論理テーブル名を保持する E 列の番号です。 */
  private static final int TABLE_LIST_LOGICAL_NAME_COLUMN = 4;

  /** テーブル一覧で物理テーブル名を保持する F 列の番号です。 */
  private static final int TABLE_LIST_PHYSICAL_NAME_COLUMN = 5;

  /** マクロが対象表として認識するチェック印です。 */
  private static final String ENABLED_MARK = "✔";

  /** Excel がワークシートを一意に識別する revision 名前空間です。 */
  private static final String REVISION_NAMESPACE =
      "http://schemas.microsoft.com/office/spreadsheetml/2014/revision";

  /**
   * xlsm パスと testCase ルートまたは単独 case ディレクトリを受け取り、JSON を xlsm へ反映します。
   *
   * @param args 1 件目が xlsm、2 件目が testCase ルートまたは case ディレクトリ、3 件目以降は任意の caseId です。
   * @throws Exception 読込または保存に失敗した場合に送出します。
   */
  public static void main(String[] args) throws Exception {
    // 业务上 VS Code 无参运行时把定义数据来源单独展示，操作者可以一眼确认哪些字段定义会写入工作簿。
    Path definePath;
    // 业务上测试数据路径继续使用 sourcePath 名称，明确它只负责 testCase 的 input/expect 数据。
    Path sourcePath;
    // 业务上目标工作簿路径单独展示，操作者可以在执行前确认最终会修改哪个 xlsm。
    Path xlsmPath;
    String[] effectiveArgs;
    // 业务上全量模式需要同时刷新表定义和测试数据，并保留原有位置参数模式供既有人工路径继续使用。
    if (args.length == 3 && "--import-all".equals(args[0])) {
      // 业务上第 2 个参数固定为目标 xlsm，第 3 个参数固定为包含 define/testCase 的 db 根目录。
      importDatabase(Paths.get(args[1]), Paths.get(args[2]));
      // 业务上输出明确完成标记，便于 VS Code 任务和自动验证判断工具是否正常收口。
      System.out.println("synced database: " + args[2]);
      return;
    }
    // 业务上无损反向同步必须使用存在清单，避免旧 VBA 把未选择的 Case×表误生成为空 JSON。
    if (args.length == 3 && "--export-all".equals(args[0])) {
      // 第 2 个参数是已由 Java 导入过存在清单的工作簿，第 3 个参数是输出目标 db 根目录。
      exportDatabase(Paths.get(args[1]), Paths.get(args[2]));
      // 控制台明确回显反向同步完成，供离线任务和人工操作确认目标范围。
      System.out.println("exported database: " + args[2]);
      return;
    }
    // 业务上无参执行时明确读取 define 与 testCase 两个目录并更新指定 xlsm，满足 VS Code 一键全量刷新。
    if (args.length == 0) {
      // 业务上 definePath 是字段定义的唯一来源，修改该变量即可明确控制 def_/inp_/exp_ 的定义内容。
      definePath = Paths.get("C:\\opt\\bat\\CPMAB081\\test\\inputData\\CPMA\\CPMAB081\\db\\define");
      // 业务上 sourcePath 是测试数据的唯一来源，修改该变量即可明确控制写入哪些 case 数据。
      sourcePath = Paths.get("C:\\opt\\bat\\CPMAB081\\test\\inputData\\CPMA\\CPMAB081\\db\\testCase");
      // 业务上 xlsmPath 是唯一修改目标，修改该变量即可明确控制最终覆盖哪个 DB 数据生成工具。
      xlsmPath = Paths.get("C:\\opt\\bat\\CPMAB081\\test\\020_DBデータ生成ツール_v2.15_template_CP.xlsm");
      // 业务上 VS Code 的 Run Java 无参入口必须同时使用三个显式路径，不能退回只导入 testCase 的旧行为。
      importDatabase(xlsmPath, definePath, sourcePath);
      // 业务上控制台同时回显三个路径，便于操作者执行后再次确认数据来源和修改目标。
      System.out.println("synced define: " + definePath);
      System.out.println("synced testCase: " + sourcePath);
      System.out.println("updated xlsm: " + xlsmPath);
      return;
    } else {
      // 业务上显式传参时优先按调用方指定范围同步，避免工具把局部导入误扩成全量覆盖。
      if (args.length < 2) {
        System.out.println("Usage: DBデータ生成ツール <xlsmPath> <testCaseRootOrDir> [caseId...]"
            + " | --import-all <xlsmPath> <dbRoot> | --export-all <xlsmPath> <dbRoot>");
        return;
      }
      xlsmPath = Paths.get(args[0]);
      sourcePath = Paths.get(args[1]);
      effectiveArgs = args;
    }
    // 业务上统一复用目录解析逻辑，确保单 case、根目录全量、指定 case 列表三种入口的路径规则完全一致。
    List<Path> caseDirectories = resolveCaseDirectories(sourcePath, effectiveArgs);
    // 业务上总 Case 数用于向操作者持续展示批量处理进度，避免长时间运行时无法判断剩余数量。
    int totalCaseCount = caseDirectories.size();
    // 业务上按稳定顺序把每个 case 的 input/expect JSON 写回同一份 xlsm，保证测试工具台账与 JSON 数据一致。
    for (int caseIndex = 0; caseIndex < totalCaseCount; caseIndex++) {
      // 业务上按已解析的稳定顺序取得当前 Case，确保显示序号和实际写入对象完全对应。
      Path caseDirectory = caseDirectories.get(caseIndex);
      // 业务上在写入前输出当前序号、总数和 CaseID，异常停止时可由最后一条日志定位处理位置。
      printCaseProgress(caseIndex + 1, totalCaseCount, caseDirectory);
      // 业务上把当前 Case 的 input/expect 写入目标工作簿，保持既有逐 Case 保存行为不变。
      importTestCase(xlsmPath, caseDirectory);
      // 业务上保留既有完成日志，区分“开始处理”与“已经同步完成”两个状态。
      System.out.println("synced: " + caseDirectory.getFileName());
    }
  }

  /**
   * db ルート配下の define と testCase を 1 回の保存で Workbook へ全量同期します。
   *
   * @param xlsmPath 更新対象の xlsm です。
   * @param databaseRoot define / testCase を持つ db ルートです。
   * @throws IOException JSON 読込または Workbook 保存に失敗した場合に送出します。
   */
  public static void importDatabase(Path xlsmPath, Path databaseRoot) throws IOException {
    // 业务上 define 和 testCase 必须来自同一个 db 根，禁止跨工程拼接造成表结构与数据不一致。
    Path defineDirectory = databaseRoot.resolve("define");
    // 业务上同时兼容既存的 testCase 大小写，优先采用实际存在的目录。
    Path testCaseDirectory = Files.isDirectory(databaseRoot.resolve("testCase"))
        ? databaseRoot.resolve("testCase") : databaseRoot.resolve("testcase");
    // 业务上参数化 db 根入口也统一委托给三个显式路径入口，保证 VS Code 与 CLI 的处理逻辑一致。
    importDatabase(xlsmPath, defineDirectory, testCaseDirectory);
  }

  /**
   * 明示された define・testCase・xlsm の 3 パスを使って Workbook を全量同期します。
   *
   * @param xlsmPath 更新対象の xlsm です。
   * @param defineDirectory define JSON ディレクトリです。
   * @param testCaseDirectory testCase ディレクトリです。
   * @throws IOException JSON 読込または Workbook 保存に失敗した場合に送出します。
   */
  public static void importDatabase(Path xlsmPath, Path defineDirectory, Path testCaseDirectory) throws IOException {
    // 业务上入口前置校验要阻止空目录写坏模板，并给出可直接定位的绝对路径。
    if (!Files.isDirectory(defineDirectory) || !Files.isDirectory(testCaseDirectory)) {
      throw new IllegalArgumentException("define/testCase directory not found: define=" + defineDirectory
          + ", testCase=" + testCaseDirectory);
    }
    // 业务上先读取全部定义和用例目录，确保解析失败时原工作簿保持原样。
    List<TableDefinitionPayload> definitions = readDefinitionPayloads(defineDirectory);
    // 业务上按目录名稳定排序，使每次写入得到一致的测试用例顺序。
    List<Path> caseDirectories = resolveCaseDirectories(testCaseDirectory, new String[] {xlsmPath.toString(), testCaseDirectory.toString()});
    // 业务上收集 input/expect 实际出现的物理表，驱动表清单和所需数据表的精确生成。
    Set<String> inputTables = collectCaseTableNames(caseDirectories, "input");
    // 业务上期望值表单独统计，避免没有 expect 的表被宏误生成空 JSON。
    Set<String> expectTables = collectCaseTableNames(caseDirectories, "expect");
    // 业务上一个 Workbook 会话内连续完成结构和数据同步，避免多次保存导致宏部件反复重写。
    try (InputStream inputStream = Files.newInputStream(xlsmPath); Workbook workbook = new XSSFWorkbook(inputStream)) {
      // 业务上先把 define 写入 def/inp/exp 表，后续数据导入才能依据最新物理字段正确落位。
      synchronizeDefinitions(workbook, definitions, inputTables, expectTables);
      // 业务上全量导入前清除所有旧 case 列，杜绝模板中 CPMAB081 的历史数据混入 CPMAB082。
      clearAllCaseColumns(workbook);
      // 业务上测试用例列表必须精确等于源目录，宏反向生成时才能只创建本次 5 个目录。
      // 业务上 testCase 路径同时携带工程号，使反向生成时不会继续沿用模板中的 CPMAB081。
      synchronizeTestCaseList(workbook, caseDirectories, resolveProjectId(testCaseDirectory));
      // 业务上定义完成后重新构建表映射，确保新建表能立即接收 JSON 数据。
      WorkbookContext context = buildWorkbookContext(workbook);
      // 业务上全量导入的总 Case 数用于生成可核对的当前进度，操作者可以判断已处理比例。
      int totalCaseCount = caseDirectories.size();
      // 业务上按 case 顺序把 input/expect 同步进同一个 Workbook，保持列块连续且可复现。
      for (int caseIndex = 0; caseIndex < totalCaseCount; caseIndex++) {
        // 业务上按同步清单取得当前 Case，使控制台序号与工作簿列写入顺序保持一致。
        Path caseDirectory = caseDirectories.get(caseIndex);
        // 业务上在当前 Case 写入前显示执行位置，长时间生成时无需等待最终保存才知道处理到哪里。
        printCaseProgress(caseIndex + 1, totalCaseCount, caseDirectory);
        // 业务上统一 CaseID 格式，确保进度显示、input 数据和 expect 数据使用相同标识。
        String testCaseId = normalizeCaseId(caseDirectory.getFileName().toString());
        // 业务上先同步当前 Case 的输入数据，为测试执行准备数据库初始状态。
        importDirectory(context, caseDirectory.resolve("input"), "inp", testCaseId);
        // 业务上再同步当前 Case 的期待数据，为测试结果核对准备目标状态。
        importDirectory(context, caseDirectory.resolve("expect"), "exp", testCaseId);
      }
      // 业务上把每个 Case×input/expect×物理表的“文件存在”事实写入工作簿，独立于 tableData 件数保存。
      synchronizeJsonPresenceSheet(workbook, caseDirectories);
      // 业务上仅在全部结构和数据写入成功后执行安全替换，失败时不破坏输入模板。
      saveWorkbookSafely(workbook, xlsmPath);
    }
  }

  /**
   * Java 导入时保存的 Case×表存在清单を基準に、Workbook から JSON を無損失で反向同期します。
   *
   * @param xlsmPath 同期元 XLSM です。
   * @param databaseRoot define / testCase を持つ出力先 db ルートです。
   * @throws IOException Workbook 読込または JSON 出力に失敗した場合に送出します。
   */
  public static void exportDatabase(Path xlsmPath, Path databaseRoot) throws IOException {
    // 业务上反向输出仅写入 db/testCase，define 仍由既有定义生成流程管理，避免无关重排。
    Path testCaseDirectory = Files.isDirectory(databaseRoot.resolve("testCase"))
        ? databaseRoot.resolve("testCase") : databaseRoot.resolve("testcase");
    // 业务上输出目标必须是既存测试数据根，禁止路径错误时在意外位置新建整套目录。
    if (!Files.isDirectory(testCaseDirectory)) {
      throw new IllegalArgumentException("testCase directory not found: " + testCaseDirectory);
    }
    // 业务上一次只读 Workbook 会话完成全部 JSON 输出，保证各表使用同一个存在清单快照。
    try (InputStream inputStream = Files.newInputStream(xlsmPath);
        Workbook workbook = new XSSFWorkbook(inputStream)) {
      // 业务上存在清单是缺失与明确空表的唯一判定事实，旧模板没有清单时禁止猜测后删除文件。
      Set<JsonPresence> presences = readJsonPresenceSheet(workbook);
      if (presences.isEmpty()) {
        throw new IllegalStateException("JSON presence sheet is missing or empty. Run --import-all first: "
            + xlsmPath);
      }
      // 业务上从当前工作簿重建 input/expect 表映射，反向输出不依赖显示用逻辑表名。
      WorkbookContext context = buildWorkbookContext(workbook);
      // 业务上测试用例列表决定允许输出的 Case 范围，防止历史目录继续残留在反向结果中。
      List<String> caseIds = readWorkbookCaseIds(workbook);
      for (int caseIndex = 0; caseIndex < caseIds.size(); caseIndex++) {
        // 业务上按稳定 Case 顺序显示进度，异常时可以直接定位最后处理对象。
        String caseId = caseIds.get(caseIndex);
        System.out.printf("exporting case %d/%d: %s%n", caseIndex + 1, caseIds.size(), caseId);
        // 业务上 input 与 expect 分开输出，各自依据同一存在清单判断文件应存在、为空或缺失。
        exportMode(context, testCaseDirectory, caseId, "input", "inp", presences);
        exportMode(context, testCaseDirectory, caseId, "expect", "exp", presences);
      }
    }
  }

  /**
   * 1 Case・1 mode の全物理表を Workbook と存在清单に完全一致させます。
   *
   * @param context Workbook の表映射です。
   * @param testCaseDirectory testCase ルートです。
   * @param caseId 出力対象 CaseID です。
   * @param mode input または expect です。
   * @param sheetMode inp または exp です。
   * @param presences Java 导入時に保存した JSON 存在清单です。
   * @throws IOException JSON の作成または不要ファイル削除に失敗した場合に送出します。
   */
  private static void exportMode(WorkbookContext context, Path testCaseDirectory, String caseId,
      String mode, String sheetMode, Set<JsonPresence> presences) throws IOException {
    // 业务上当前 mode 的每张数据 Sheet 都是可管理表，物理名用于限定允许新增或删除的 JSON 文件。
    for (Map.Entry<String, Sheet> entry : context.getSheets(sheetMode).entrySet()) {
      // 业务上物理表名同时作为存在清单键与 JSON 文件名，避免逻辑名变更影响同步。
      String physicalTableName = entry.getKey();
      Sheet sheet = entry.getValue();
      // 业务上只读取未标记“定义输出対象外”的 Case 列，行为与原 VBA 的输出列过滤一致。
      List<Integer> activeColumns = findColumnsByTestCaseId(sheet, context.formatter(), caseId).stream()
          .filter(columnIndex -> !ENABLED_MARK.equals(
              readNormalizedCellText(sheet, EXCLUDED_ROW_INDEX, columnIndex, context.formatter())))
          .toList();
      // 业务上有数据列代表人工在 Excel 新增了记录；即使原清单没有，也应作为新 JSON 输出。
      boolean shouldExist = !activeColumns.isEmpty()
          || presences.contains(new JsonPresence(mode, caseId, physicalTableName));
      // 业务上删除范围严格限制为当前 Case/mode/已知物理表，防止清理宏副产物时误删其他文件。
      Path jsonPath = testCaseDirectory.resolve(caseId).resolve(mode).resolve(physicalTableName + ".json");
      if (!shouldExist) {
        // 业务上清单缺失且无数据列即表示该 JSON 本来不存在，移除旧 VBA 误生成的空文件。
        Files.deleteIfExists(jsonPath);
        continue;
      }
      // 业务上显式空表没有数据列，但仍输出 tableData=[]，从而与“文件不存在”保持可逆区别。
      List<Map<String, Object>> records = new ArrayList<>();
      for (int columnIndex : activeColumns) {
        // 业务上每个有效列对应一条 DB 记录，并按 Excel 列顺序稳定输出。
        records.add(readRecordFromSheet(sheet, columnIndex, context.formatter()));
      }
      // 业务上输出目录仅在确实需要 JSON 时创建，缺失状态不会留下空目录中的伪文件。
      Files.createDirectories(jsonPath.getParent());
      // 业务上使用 LinkedHashMap 固定 physicalTableName、tableData 顺序，保持既存 fixture 可读性。
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("physicalTableName", physicalTableName);
      payload.put("tableData", records);
      // 业务上 UTF-8 直接覆盖目标 JSON，使 Java 反向同步成为旧 VBA 的无损替代入口。
      try (var writer = Files.newBufferedWriter(jsonPath, StandardCharsets.UTF_8)) {
        OBJECT_MAPPER.writeValue(writer, payload);
      }
    }
  }

  /**
   * Workbook の 1 record 列を JSON 項目 Map へ変換します。
   *
   * @param sheet データシートです。
   * @param columnIndex record 列番号です。
   * @param formatter 表示値取得用 formatter です。
   * @return 物理項目順を保持した record です。
   */
  private static Map<String, Object> readRecordFromSheet(Sheet sheet, int columnIndex,
      DataFormatter formatter) {
    // 业务上定义行顺序就是 JSON 字段顺序，使用 LinkedHashMap 保持模板和 fixture 一致。
    Map<String, Object> record = new LinkedHashMap<>();
    for (int rowIndex = DATA_FIELD_START_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      // 业务上没有定义行时跳过，避免把模板尾部格式行误输出为字段。
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      // 业务上 D 列物理名是 JSON key 的唯一事实来源。
      String physicalName = readNormalizedCellText(sheet, rowIndex, FIELD_NAME_COLUMN, formatter);
      if (physicalName.isBlank()) {
        continue;
      }
      // 业务上 E 列数据型决定数值是否作为 JSON number 输出，其余保持业务字符串。
      String dataType = readNormalizedCellText(sheet, rowIndex, FIELD_NAME_COLUMN + 1, formatter)
          .toLowerCase(Locale.ROOT);
      // 业务上单元格原始状态用于区分 null、空字符串和数值，不能只看 trim 后显示值。
      Cell cell = row.getCell(columnIndex);
      record.put(physicalName, readJsonCellValue(cell, dataType, formatter));
    }
    return record;
  }

  /**
   * Excel セルを旧 VBA と同じ null・空文字・数値契約で JSON 値へ変換します。
   *
   * @param cell 対象セルです。
   * @param dataType 定義上のデータ型です。
   * @param formatter 表示値取得用 formatter です。
   * @return JSON へ設定する値です。
   */
  private static Object readJsonCellValue(Cell cell, String dataType, DataFormatter formatter) {
    // 业务上不存在或纯空白 Cell 表示用户未输入，反向 JSON 必须输出 null。
    if (cell == null || cell.getCellType() == CellType.BLANK) {
      return null;
    }
    // 业务上 Java 导入使用单引号占位保存显式空字符串，反向时恢复为 ""。
    String displayedValue = formatter.formatCellValue(cell);
    if ("'".equals(displayedValue) || "''".equals(displayedValue)) {
      return "";
    }
    // 业务上数值定义沿用旧 VBA 的 JSON number 语义，整数不附加无意义小数。
    if (isNumericDataType(dataType)) {
      try {
        // 显示值可能来自数值 Cell 或字符串 Cell，统一按十进制解析并去除尾随零。
        BigDecimal numericValue = new BigDecimal(displayedValue).stripTrailingZeros();
        if (numericValue.scale() <= 0) {
          try {
            // 业务上 long 范围内整数沿用简洁整数节点，保持既存 fixture 表现。
            return numericValue.longValueExact();
          } catch (ArithmeticException ignored) {
            // 业务上超出 long 范围的整数仍必须作为 JSON number 保存，禁止降级为字符串。
            return numericValue;
          }
        }
        return numericValue;
      } catch (NumberFormatException ignored) {
        // 业务上非标准边界值不能丢失，无法解析时按原显示字符串输出。
        return displayedValue;
      }
    }
    // 业务上 char/varchar/date/timestamp 等保持模板显示值及前后空白，不做额外清洗。
    return displayedValue;
  }

  /** 数値 JSON として出力する定義型かを判定します。 */
  private static boolean isNumericDataType(String dataType) {
    // 业务上与既存 VBA 的 numeric/integer/number/decimal 四种判定完全一致。
    return Set.of("numeric", "integer", "number", "decimal").contains(dataType);
  }

  /**
   * Java 导入元に実在する input/expect JSON 一覧を Workbook の非表示シートへ全量保存します。
   *
   * @param workbook 更新対象 Workbook です。
   * @param caseDirectories 全 Case ディレクトリです。
   * @throws IOException JSON ディレクトリ読込に失敗した場合に送出します。
   */
  private static void synchronizeJsonPresenceSheet(Workbook workbook, List<Path> caseDirectories)
      throws IOException {
    // 业务上全量导入时以当前文件系统事实重建清单，旧工程残留条目不允许继续存在。
    Set<JsonPresence> presences = new LinkedHashSet<>();
    for (Path caseDirectory : caseDirectories) {
      // 业务上 CaseID 使用规范化目录名，与数据 Sheet 第 10 行完全一致。
      String caseId = normalizeCaseId(caseDirectory.getFileName().toString());
      // 业务上空 tableData 的 JSON 也通过 keySet 记录为“文件存在”，不依赖记录件数。
      for (String physicalTableName : readPayloadMap(caseDirectory.resolve("input")).keySet()) {
        presences.add(new JsonPresence("input", caseId, physicalTableName));
      }
      for (String physicalTableName : readPayloadMap(caseDirectory.resolve("expect")).keySet()) {
        presences.add(new JsonPresence("expect", caseId, physicalTableName));
      }
    }
    // 业务上统一重写隐藏清单，保持全量导入可复现。
    writeJsonPresenceSheet(workbook, presences);
  }

  /**
   * 単 Case 导入時に当該 Case の JSON 存在状態だけを更新します。
   *
   * @param workbook 更新対象 Workbook です。
   * @param caseDirectory 当該 Case ディレクトリです。
   * @throws IOException JSON ディレクトリ読込に失敗した場合に送出します。
   */
  private static void synchronizeJsonPresenceForCase(Workbook workbook, Path caseDirectory)
      throws IOException {
    // 业务上既有清单可以包含其他 Case，局部导入只替换当前 Case 事实。
    Set<JsonPresence> presences = new LinkedHashSet<>(readJsonPresenceSheet(workbook));
    String caseId = normalizeCaseId(caseDirectory.getFileName().toString());
    presences.removeIf(presence -> caseId.equals(presence.caseId()));
    // 业务上 input/expect 分别记录实际存在文件，包括 tableData=[]。
    for (String physicalTableName : readPayloadMap(caseDirectory.resolve("input")).keySet()) {
      presences.add(new JsonPresence("input", caseId, physicalTableName));
    }
    for (String physicalTableName : readPayloadMap(caseDirectory.resolve("expect")).keySet()) {
      presences.add(new JsonPresence("expect", caseId, physicalTableName));
    }
    // 业务上局部更新后重新写入统一格式，避免重复行。
    writeJsonPresenceSheet(workbook, presences);
  }

  /** JSON 存在清单を非表示シートへ書き込みます。 */
  private static void writeJsonPresenceSheet(Workbook workbook, Set<JsonPresence> presences) {
    // 业务上重建清单前删除旧 Sheet，避免已删除 Case 继续残留。
    int existingIndex = workbook.getSheetIndex(JSON_PRESENCE_SHEET_NAME);
    if (existingIndex >= 0) {
      workbook.removeSheetAt(existingIndex);
    }
    // 业务上新增专用元数据 Sheet，不复用业务 Sheet 行列以免影响旧宏定位。
    Sheet sheet = workbook.createSheet(JSON_PRESENCE_SHEET_NAME);
    Row header = sheet.createRow(0);
    writeCell(header, PRESENCE_MODE_COLUMN, "mode");
    writeCell(header, PRESENCE_CASE_COLUMN, "caseId");
    writeCell(header, PRESENCE_TABLE_COLUMN, "physicalTableName");
    // 业务上 LinkedHashSet 顺序按 Case/input/expect/文件名稳定写入，便于差分和验证。
    int rowIndex = 1;
    for (JsonPresence presence : presences) {
      Row row = sheet.createRow(rowIndex++);
      writeCell(row, PRESENCE_MODE_COLUMN, presence.mode());
      writeCell(row, PRESENCE_CASE_COLUMN, presence.caseId());
      writeCell(row, PRESENCE_TABLE_COLUMN, presence.physicalTableName());
    }
    // 业务上清单仅供 Java 无损反向使用，设置为 very hidden 防止人工误改模板业务数据。
    workbook.setSheetVisibility(workbook.getSheetIndex(sheet), SheetVisibility.VERY_HIDDEN);
  }

  /** Workbook から JSON 存在清单を読み取ります。 */
  private static Set<JsonPresence> readJsonPresenceSheet(Workbook workbook) {
    // 业务上旧模板可能没有清单，返回空集合并由调用方决定是首次导入还是拒绝反向输出。
    Sheet sheet = workbook.getSheet(JSON_PRESENCE_SHEET_NAME);
    Set<JsonPresence> presences = new LinkedHashSet<>();
    if (sheet == null) {
      return presences;
    }
    DataFormatter formatter = new DataFormatter();
    for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      // 业务上逐行读取 mode、Case、物理表三元组，任一缺失的损坏行都不作为删除依据。
      String mode = readNormalizedCellText(sheet, rowIndex, PRESENCE_MODE_COLUMN, formatter);
      String caseId = readNormalizedCellText(sheet, rowIndex, PRESENCE_CASE_COLUMN, formatter);
      String physicalTableName =
          readNormalizedCellText(sheet, rowIndex, PRESENCE_TABLE_COLUMN, formatter);
      if (!mode.isBlank() && !caseId.isBlank() && !physicalTableName.isBlank()) {
        presences.add(new JsonPresence(mode, caseId, physicalTableName));
      }
    }
    return presences;
  }

  /** テストケース一覧から反向出力対象 CaseID を順序保持で取得します。 */
  private static List<String> readWorkbookCaseIds(Workbook workbook) {
    // 业务上列表 Sheet 缺失会让输出范围不可信，立即停止而不是扫描目录猜测。
    Sheet sheet = workbook.getSheet("テストケース一覧");
    if (sheet == null) {
      throw new IllegalStateException("テストケース一覧 sheet not found.");
    }
    DataFormatter formatter = new DataFormatter();
    List<String> caseIds = new ArrayList<>();
    for (int rowIndex = TEST_CASE_LIST_START_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      // 业务上 B 列是正式 CaseID，空行不生成目录。
      String caseId = normalizeCaseId(readNormalizedCellText(sheet, rowIndex, 1, formatter));
      if (!caseId.isBlank()) {
        caseIds.add(caseId);
      }
    }
    return caseIds;
  }

  /**
   * バッチ処理中の現在位置を CaseID とともにコンソールへ出力します。
   *
   * @param currentCaseNumber 現在処理する Case の 1 origin 番号です。
   * @param totalCaseCount 処理対象 Case の総数です。
   * @param caseDirectory 現在処理する Case ディレクトリです。
   */
  private static void printCaseProgress(int currentCaseNumber, int totalCaseCount, Path caseDirectory) {
    // 业务上目录名可能带有工程前缀，因此沿用导入逻辑的规范化规则取得实际 CaseID。
    String testCaseId = normalizeCaseId(caseDirectory.getFileName().toString());
    // 业务上输出“当前/总数”和 CaseID，让操作者实时掌握进度并能定位发生异常的 Case。
    System.out.printf("processing case %d/%d: %s%n", currentCaseNumber, totalCaseCount, testCaseId);
  }

  /**
   * define JSON を安定順で読み取ります。
   *
   * @param defineDirectory define JSON ディレクトリです。
   * @return 読み込み済みテーブル定義です。
   * @throws IOException JSON 読込に失敗した場合に送出します。
   */
  private static List<TableDefinitionPayload> readDefinitionPayloads(Path defineDirectory) throws IOException {
    // 业务上物理ファイル名顺序を固定し、同じ入力から同じシート追加顺序を得ます。
    try (var stream = Files.list(defineDirectory)) {
      List<Path> jsonFiles = stream.filter(path -> path.getFileName().toString().endsWith(".json")).sorted().toList();
      // 业务上空 define は表構造を確定できないため、テンプレート更新前に停止します。
      if (jsonFiles.isEmpty()) {
        throw new IllegalArgumentException("define JSON not found: " + defineDirectory);
      }
      // 业务上各 JSON を順序保持 Map として読み、項目順をそのままシート行順へ反映します。
      List<TableDefinitionPayload> definitions = new ArrayList<>();
      for (Path jsonFile : jsonFiles) {
        Map<String, Object> payload = OBJECT_MAPPER.readValue(Files.readString(jsonFile), new TypeReference<LinkedHashMap<String, Object>>() {});
        String logicalTableName = String.valueOf(payload.getOrDefault("logicalTableName", ""));
        String physicalTableName = String.valueOf(payload.getOrDefault("physicalTableName", ""));
        List<Map<String, Object>> fields = convertMapList(payload.get("tableStructure"));
        if (physicalTableName.isBlank() || fields.isEmpty()) {
          throw new IllegalArgumentException("invalid define JSON: " + jsonFile);
        }
        definitions.add(new TableDefinitionPayload(logicalTableName, physicalTableName, fields));
      }
      return definitions;
    }
  }

  /**
   * JSON 配列を順序保持 Map の一覧へ変換します。
   *
   * @param rawList Jackson が返した未型付け配列です。
   * @return 項目順を保持した Map 一覧です。
   */
  private static List<Map<String, Object>> convertMapList(Object rawList) {
    // 业务上 JSON 配列以外は空として返し、呼出側の定義不正判定へ統一します。
    List<Map<String, Object>> converted = new ArrayList<>();
    if (!(rawList instanceof List<?> rows)) {
      return converted;
    }
    // 业务上各項目のキー順を維持し、定義表の列対応を安定させます。
    for (Object row : rows) {
      if (row instanceof Map<?, ?> map) {
        Map<String, Object> field = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          field.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        converted.add(field);
      }
    }
    return converted;
  }

  /**
   * 全 case の input または expect から物理テーブル名を収集します。
   *
   * @param caseDirectories case ディレクトリ一覧です。
   * @param mode input または expect です。
   * @return 出現順を保持した物理テーブル名です。
   * @throws IOException JSON 読込に失敗した場合に送出します。
   */
  private static Set<String> collectCaseTableNames(List<Path> caseDirectories, String mode) throws IOException {
    // 业务上最初に現れた順序を保持し、追加表の生成順序を毎回同じにします。
    Set<String> tableNames = new LinkedHashSet<>();
    for (Path caseDirectory : caseDirectories) {
      tableNames.addAll(readPayloadMap(caseDirectory.resolve(mode)).keySet());
    }
    return tableNames;
  }

  /**
   * define とケース利用状況を Workbook の定義表・データ表・テーブル一覧へ同期します。
   *
   * @param workbook 更新対象 Workbook です。
   * @param definitions define JSON 一覧です。
   * @param inputTables input に現れる物理テーブル名です。
   * @param expectTables expect に現れる物理テーブル名です。
   */
  private static void synchronizeDefinitions(Workbook workbook, List<TableDefinitionPayload> definitions,
      Set<String> inputTables, Set<String> expectTables) {
    // 业务上既存表は物理名で再利用し、新規表だけテンプレートから作成します。
    DataFormatter formatter = new DataFormatter();
    for (TableDefinitionPayload definition : definitions) {
      Sheet definitionSheet = findSheetByPrefixAndPhysicalName(workbook, "def_", definition.physicalTableName(), formatter);
      if (definitionSheet == null) {
        definitionSheet = cloneTemplateSheet(workbook, "テーブル定義シートフォーマット", "def_" + definition.logicalTableName());
      }
      writeDefinitionSheet(definitionSheet, definition);
      if (inputTables.contains(definition.physicalTableName())) {
        Sheet inputSheet = findSheetByPrefixAndPhysicalName(workbook, "inp_", definition.physicalTableName(), formatter);
        if (inputSheet == null) {
          inputSheet = cloneTemplateSheet(workbook, "DBデータ基本フォーマット", "inp_" + definition.logicalTableName());
        }
        writeDataSheetDefinition(inputSheet, definition);
      }
      if (expectTables.contains(definition.physicalTableName())) {
        Sheet expectSheet = findSheetByPrefixAndPhysicalName(workbook, "exp_", definition.physicalTableName(), formatter);
        if (expectSheet == null) {
          expectSheet = cloneTemplateSheet(workbook, "DBデータ基本フォーマット", "exp_" + definition.logicalTableName());
        }
        writeDataSheetDefinition(expectSheet, definition);
      }
    }
    // 业务上表清单只启用本次输入实际使用的表，宏反向生成不会混入旧工程空表。
    synchronizeTableList(workbook, definitions, inputTables, expectTables, formatter);
  }

  /**
   * prefix と物理テーブル名が一致するシートを探します。
   */
  private static Sheet findSheetByPrefixAndPhysicalName(Workbook workbook, String prefix,
      String physicalTableName, DataFormatter formatter) {
    // 业务上シート表示名ではなく C4 の物理名を正とし、論理名変更の影響を受けないようにします。
    for (int index = 0; index < workbook.getNumberOfSheets(); index++) {
      Sheet sheet = workbook.getSheetAt(index);
      if (sheet.getSheetName().startsWith(prefix)
          && physicalTableName.equals(readNormalizedCellText(sheet, 3, PHYSICAL_TABLE_NAME_COLUMN, formatter))) {
        return sheet;
      }
    }
    return null;
  }

  /**
   * hidden テンプレートを複製し、重複しない業務シート名を付けます。
   */
  private static Sheet cloneTemplateSheet(Workbook workbook, String templateName, String requestedName) {
    // 业务上テンプレート不存在なら不完全な表を作らず即時停止します。
    int templateIndex = workbook.getSheetIndex(templateName);
    if (templateIndex < 0) {
      throw new IllegalStateException("template sheet not found: " + templateName);
    }
    // 业务上 Excel の 31 文字制限に収めた基本名を作り、同名表があれば安定した連番を付けます。
    String baseName = requestedName.length() <= 31 ? requestedName : requestedName.substring(0, 31);
    String sheetName = baseName;
    int suffix = 2;
    while (workbook.getSheet(sheetName) != null) {
      String suffixText = "_" + suffix++;
      sheetName = baseName.substring(0, Math.min(baseName.length(), 31 - suffixText.length())) + suffixText;
    }
    // 业务上原版样式、印刷設定、数式を保持するため Workbook 標準 clone を使います。
    Sheet clonedSheet = workbook.cloneSheet(templateIndex);
    // 业务上克隆 Sheet 必须重建 Excel 内部唯一标识，否则 Excel 会替换重复 UID 的新 Sheet 并清空内容。
    assignUniqueWorksheetId(clonedSheet);
    // 业务上业务 Sheet 不继承模板按钮和控件关系，避免多个 Sheet 共用 VML/ctrlProp 后被 Excel 判为损坏。
    stripTemplateArtifacts(clonedSheet);
    // 业务上在唯一标识修复后设置名称，确保最终业务 Sheet 与模板 Sheet 可被 Excel 独立识别。
    workbook.setSheetName(workbook.getSheetIndex(clonedSheet), sheetName);
    // 业务上新生成的业务 Sheet 必须可见，操作者才能核对字段定义与 Case 数据。
    workbook.setSheetHidden(workbook.getSheetIndex(clonedSheet), false);
    // 业务上返回已具有独立 UID 的 Sheet，后续字段和 Case 写入不会再被 Excel 修复过程丢弃。
    return clonedSheet;
  }

  /**
   * クローンしたワークシートへ新しい revision UID を設定します。
   *
   * @param clonedSheet UID を再採番するワークシートです。
   */
  private static void assignUniqueWorksheetId(Sheet clonedSheet) {
    // 业务上当前工具仅处理 XSSF/XLSM，其他 Workbook 实现无法安全修改 revision UID，因此立即停止。
    if (!(clonedSheet instanceof XSSFSheet xssfSheet)) {
      throw new IllegalArgumentException("XSSF worksheet required: " + clonedSheet.getSheetName());
    }
    // 业务上生成符合 Excel GUID 表示的独立值，避免模板与多个克隆 Sheet 共享同一个内部标识。
    String uniqueId = "{" + UUID.randomUUID().toString().toUpperCase(Locale.ROOT) + "}";
    // 业务上通过底层 DOM 直接取得 worksheet 根元素，避免游标定位偏差导致 UID 只在内存中看似更新。
    if (!(xssfSheet.getCTWorksheet().getDomNode() instanceof Element worksheetElement)) {
      throw new IllegalStateException("worksheet XML root not found: " + clonedSheet.getSheetName());
    }
    // 业务上使用 revision 命名空间覆盖克隆 UID，确保保存后的 XML 根属性得到真实更新。
    worksheetElement.setAttributeNS(REVISION_NAMESPACE, "xr:uid", uniqueId);
  }

  /**
   * クローン先で共有できないテンプレート固有の描画・コントロール関係を除去します。
   *
   * @param clonedSheet テンプレートから複製した業務ワークシートです。
   */
  private static void stripTemplateArtifacts(Sheet clonedSheet) {
    // 业务上 XLSM 克隆 Sheet 必须是 XSSF 类型，才能同时清理 OOXML 节点和包关系。
    if (!(clonedSheet instanceof XSSFSheet xssfSheet)) {
      throw new IllegalArgumentException("XSSF worksheet required: " + clonedSheet.getSheetName());
    }
    // 业务上获取工作表 XML 根对象，逐一移除只属于隐藏模板的打印和按钮入口。
    CTWorksheet worksheet = xssfSheet.getCTWorksheet();
    // 业务上克隆的打印设置仍指向模板二进制部件，业务 Sheet 不继承该共享关系。
    if (worksheet.isSetPageSetup()) {
      worksheet.unsetPageSetup();
    }
    // 业务上绘图中只包含模板按钮外观，CoverSheet 全量宏不依赖这些单 Sheet 图形。
    if (worksheet.isSetDrawing()) {
      worksheet.unsetDrawing();
    }
    // 业务上 VML 按钮不得由多个 Sheet 共用，同步移除旧式绘图入口。
    if (worksheet.isSetLegacyDrawing()) {
      worksheet.unsetLegacyDrawing();
    }
    // 业务上 controls 引用模板 ctrlProp 时会让 Excel 替换整个 Sheet，因此必须从业务 Sheet 删除。
    if (worksheet.isSetControls()) {
      worksheet.unsetControls();
    }
    // 业务上新版 Excel 把 controls 包在 mc:AlternateContent 时 schema API 无法识别，必须从最终 DOM 清理。
    removeAlternateContentControls(xssfSheet);
    try {
      // 业务上先收集所有模板关系 ID，再统一删除，避免遍历关系集合时发生并发修改。
      List<String> templateRelationshipIds = new ArrayList<>();
      // 业务上新克隆 Sheet 的关系全部来自隐藏模板，数据与样式本身不依赖这些外部部件。
      for (PackageRelationship relationship : xssfSheet.getPackagePart().getRelationships()) {
        templateRelationshipIds.add(relationship.getId());
      }
      // 业务上删除打印、drawing、VML 和 ctrlProp 的包关系，使业务 Sheet 成为独立可打开的数据部件。
      for (String relationshipId : templateRelationshipIds) {
        xssfSheet.getPackagePart().removeRelationship(relationshipId);
      }
    } catch (InvalidFormatException e) {
      // 业务上关系读取失败意味着无法保证生成包合法，禁止继续覆盖目标 XLSM。
      throw new IllegalStateException("worksheet relationship cleanup failed: " + clonedSheet.getSheetName(), e);
    }
  }

  /** mc:AlternateContent 内に残るフォームコントロール宣言を DOM から除去します。 */
  private static void removeAlternateContentControls(XSSFSheet xssfSheet) {
    // 业务上取得 worksheet 根元素，后续只删除其直接子级中的控件包装块。
    if (!(xssfSheet.getCTWorksheet().getDomNode() instanceof Element worksheetElement)) {
      throw new IllegalStateException("worksheet XML root not found: " + xssfSheet.getSheetName());
    }
    // 业务上搜索所有命名空间中的 controls，兼容 POI 无法映射的 mc:AlternateContent 表示。
    NodeList controlNodes = worksheetElement.getElementsByTagNameNS("*", "controls");
    // 业务上先收集 worksheet 直接子节点，再删除，避免修改 DOM 时 NodeList 动态变化导致漏删。
    List<Node> worksheetChildrenToRemove = new ArrayList<>();
    for (int controlIndex = 0; controlIndex < controlNodes.getLength(); controlIndex++) {
      // 业务上从 controls 向上追溯，找到实际挂在 worksheet 根下的 AlternateContent 包装节点。
      Node worksheetChild = controlNodes.item(controlIndex);
      while (worksheetChild.getParentNode() != null
          && worksheetChild.getParentNode() != worksheetElement) {
        worksheetChild = worksheetChild.getParentNode();
      }
      // 业务上只删除确属当前 worksheet 根下的包装块，禁止影响其他 XML 子树。
      if (worksheetChild.getParentNode() == worksheetElement
          && !worksheetChildrenToRemove.contains(worksheetChild)) {
        worksheetChildrenToRemove.add(worksheetChild);
      }
    }
    // 业务上删除控件包装块后，Sheet 仅保留单元格与格式，不再引用模板按钮。
    for (Node worksheetChild : worksheetChildrenToRemove) {
      worksheetElement.removeChild(worksheetChild);
    }
  }

  /**
   * define payload を def_ シートへ反映します。
   */
  private static void writeDefinitionSheet(Sheet sheet, TableDefinitionPayload definition) {
    // 业务上論理名と物理名を表头へ反映し、宏と人の双方が同じ表を識別できるようにします。
    writeCell(getOrCreateRow(sheet, 2), 2, definition.logicalTableName());
    writeCell(getOrCreateRow(sheet, 3), 2, definition.physicalTableName());
    // 业务上旧定義の残存を防ぐため、今回項目数と既存行数の大きい方まで定義領域を再構築します。
    int clearEndRow = Math.max(sheet.getLastRowNum(), DEFINITION_FIELD_START_ROW_INDEX + definition.fields().size() - 1);
    for (int rowIndex = DEFINITION_FIELD_START_ROW_INDEX; rowIndex <= clearEndRow; rowIndex++) {
      prepareDefinitionRow(sheet, rowIndex, definition.fields(), DEFINITION_FIELD_START_ROW_INDEX);
    }
  }

  /**
   * define payload を inp_/exp_ シートの項目定義へ反映します。
   */
  private static void writeDataSheetDefinition(Sheet sheet, TableDefinitionPayload definition) {
    // 业务上データ表にも同一論理名・物理名を設定し、JSON との物理名対応を成立させます。
    writeCell(getOrCreateRow(sheet, 2), 2, definition.logicalTableName());
    writeCell(getOrCreateRow(sheet, 3), 2, definition.physicalTableName());
    // 业务上旧項目行を残さず、14 行目から define の順序どおりに再構築します。
    int clearEndRow = Math.max(sheet.getLastRowNum(), DATA_FIELD_START_ROW_INDEX + definition.fields().size() - 1);
    for (int rowIndex = DATA_FIELD_START_ROW_INDEX; rowIndex <= clearEndRow; rowIndex++) {
      prepareDefinitionRow(sheet, rowIndex, definition.fields(), DATA_FIELD_START_ROW_INDEX);
    }
  }

  /**
   * 1 行分の項目定義を書き、範囲外の旧行は空欄化します。
   */
  private static void prepareDefinitionRow(Sheet sheet, int rowIndex, List<Map<String, Object>> fields, int startRowIndex) {
    // 业务上追加行は直前行の見た目を複製してから値を書き、Excel 上の罫線と書式を維持します。
    Row row = getOrCreateRow(sheet, rowIndex);
    copyRowStylesFromPrevious(sheet, rowIndex, 1, 9);
    int fieldIndex = rowIndex - startRowIndex;
    if (fieldIndex < 0 || fieldIndex >= fields.size()) {
      for (int columnIndex = 1; columnIndex <= 9; columnIndex++) {
        clearCell(row, columnIndex);
      }
      return;
    }
    // 业务上定義 JSON の各属性を原版テンプレート B～J 列へ固定対応で写します。
    Map<String, Object> field = fields.get(fieldIndex);
    writeCell(row, 1, Integer.toString(fieldIndex + 1));
    writeCell(row, 2, stringValue(field.get("logicalName")));
    writeCell(row, 3, stringValue(field.get("physicalName")));
    writeCell(row, 4, stringValue(field.get("dataType")));
    writeCell(row, 5, booleanValue(field.get("notNull")) ? "Yes" : "");
    int digits = integerValue(field.get("numberOfDigits"));
    writeCell(row, 6, digits > 0 ? Integer.toString(digits) : "-");
    int primaryKey = integerValue(field.get("primaryKey"));
    writeCell(row, 7, primaryKey > 0 ? Integer.toString(primaryKey) : "");
    writeCell(row, 8, stringValue(field.get("format")));
    writeCell(row, 9, booleanValue(field.get("subjectOfEntry")) ? ENABLED_MARK : "");
  }

  /** 追加行へ直前行のセル style を適用します。 */
  private static void copyRowStylesFromPrevious(Sheet sheet, int rowIndex, int firstColumn, int lastColumn) {
    // 业务上先頭定義行には既存テンプレート style があるため、それ以降だけ直前行から補います。
    if (rowIndex <= 0) {
      return;
    }
    Row sourceRow = sheet.getRow(rowIndex - 1);
    Row targetRow = getOrCreateRow(sheet, rowIndex);
    if (sourceRow == null) {
      return;
    }
    // 业务上値はコピーせず style だけを複製し、前項目の業務値混入を防ぎます。
    for (int columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex++) {
      Cell sourceCell = sourceRow.getCell(columnIndex);
      if (sourceCell == null) {
        continue;
      }
      Cell targetCell = targetRow.getCell(columnIndex);
      if (targetCell == null) {
        targetCell = targetRow.createCell(columnIndex);
      }
      targetCell.setCellStyle(sourceCell.getCellStyle());
    }
  }

  /** テーブル一覧の選択状態と新規物理表を同期します。 */
  private static void synchronizeTableList(Workbook workbook, List<TableDefinitionPayload> definitions,
      Set<String> inputTables, Set<String> expectTables, DataFormatter formatter) {
    // 业务上宏の入口となるテーブル一覧が無ければ反向生成不能のため即時停止します。
    Sheet tableList = workbook.getSheet("テーブル一覧");
    if (tableList == null) {
      throw new IllegalStateException("テーブル一覧 sheet not found.");
    }
    // 业务上既存全行の選択印を一旦消し、旧工程の出力対象を残さないようにします。
    Map<String, Integer> rowByPhysicalName = new HashMap<>();
    for (int rowIndex = 0; rowIndex <= tableList.getLastRowNum(); rowIndex++) {
      Row row = getOrCreateRow(tableList, rowIndex);
      String physicalName = readNormalizedCellText(tableList, rowIndex, TABLE_LIST_PHYSICAL_NAME_COLUMN, formatter);
      if (!physicalName.isBlank()) {
        rowByPhysicalName.put(physicalName, rowIndex);
      }
      clearCell(row, TABLE_LIST_INPUT_COLUMN);
      clearCell(row, TABLE_LIST_EXPECT_COLUMN);
    }
    // 业务上 define ごとに既存行を再利用し、未登録物理表だけ一覧末尾へ追加します。
    int appendRowIndex = tableList.getLastRowNum() + 1;
    for (TableDefinitionPayload definition : definitions) {
      Integer rowIndex = rowByPhysicalName.get(definition.physicalTableName());
      if (rowIndex == null) {
        rowIndex = appendRowIndex++;
        copyRowStylesFromPrevious(tableList, rowIndex, TABLE_LIST_INPUT_COLUMN, TABLE_LIST_PHYSICAL_NAME_COLUMN);
      }
      Row row = getOrCreateRow(tableList, rowIndex);
      writeCell(row, TABLE_LIST_INPUT_COLUMN, inputTables.contains(definition.physicalTableName()) ? ENABLED_MARK : "");
      writeCell(row, TABLE_LIST_EXPECT_COLUMN, expectTables.contains(definition.physicalTableName()) ? ENABLED_MARK : "");
      writeCell(row, TABLE_LIST_LOGICAL_NAME_COLUMN, definition.logicalTableName());
      writeCell(row, TABLE_LIST_PHYSICAL_NAME_COLUMN, definition.physicalTableName());
    }
  }

  /** 全 inp_/exp_ シートの K 列以降を空欄化します。 */
  private static void clearAllCaseColumns(Workbook workbook) {
    // 业务上全量模式では旧 case 列を完全に消し、源 JSON に存在する列だけを後から再生成します。
    for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
      Sheet sheet = workbook.getSheetAt(sheetIndex);
      if (!sheet.getSheetName().startsWith("inp_") && !sheet.getSheetName().startsWith("exp_")) {
        continue;
      }
      int maxColumnIndex = findMaxUsedColumnIndex(sheet);
      for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
        Row row = sheet.getRow(rowIndex);
        if (row == null) {
          continue;
        }
        for (int columnIndex = DATA_START_COLUMN; columnIndex <= maxColumnIndex; columnIndex++) {
          clearCell(row, columnIndex);
        }
      }
    }
  }

  /**
   * テストケース一覧を源ディレクトリと完全一致させます。
   *
   * @param workbook 更新対象 Workbook です。
   * @param caseDirectories 同期対象 Case ディレクトリ一覧です。
   * @param projectId 反向生成先を識別する工程 ID です。
   */
  private static void synchronizeTestCaseList(Workbook workbook, List<Path> caseDirectories, String projectId) {
    // 业务上一覧が無ければ宏生成目录の基准がないため処理を停止します。
    Sheet sheet = workbook.getSheet("テストケース一覧");
    if (sheet == null) {
      throw new IllegalStateException("テストケース一覧 sheet not found.");
    }
    // 业务上 db 路径可识别工程号时覆盖模板旧值，防止宏按 CPMAB081 路由反向生成结果。
    if (!projectId.isBlank()) {
      // 业务上处理 ID 固定写入 B3，保持与模板的测试用例元数据布局一致。
      writeCell(getOrCreateRow(sheet, 2), 1, projectId);
    }
    // 业务上既存の補足列を caseId ごとに退避し、同じ case の説明だけは保持します。
    DataFormatter formatter = new DataFormatter();
    Map<String, CaseListRowData> existingByCase = new HashMap<>();
    for (int rowIndex = TEST_CASE_LIST_START_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      String caseId = normalizeCaseId(readNormalizedCellText(sheet, rowIndex, 1, formatter));
      if (!caseId.isBlank()) {
        existingByCase.putIfAbsent(caseId, new CaseListRowData(readCellText(sheet, rowIndex, 2, formatter), readCellText(sheet, rowIndex, 3, formatter)));
      }
      Row row = getOrCreateRow(sheet, rowIndex);
      for (int columnIndex = 0; columnIndex <= 3; columnIndex++) {
        clearCell(row, columnIndex);
      }
    }
    // 业务上 source case を昇順で 1 行ずつ再登録し、一覧とデータ列の対象を一致させます。
    for (int index = 0; index < caseDirectories.size(); index++) {
      String caseId = normalizeCaseId(caseDirectories.get(index).getFileName().toString());
      CaseListRowData existing = existingByCase.getOrDefault(caseId, new CaseListRowData("", DEFAULT_CASE_STATUS));
      Row row = getOrCreateRow(sheet, TEST_CASE_LIST_START_ROW_INDEX + index);
      writeCell(row, 0, Integer.toString(index + 1));
      writeCell(row, 1, caseId);
      writeCell(row, 2, existing.columnC());
      writeCell(row, 3, existing.status().isBlank() ? DEFAULT_CASE_STATUS : existing.status());
    }
  }

  /**
   * testCase ディレクトリから対象工程 ID を取得します。
   *
   * @param testCaseDirectory `<project>/db/testCase` 形式の入力ディレクトリです。
   * @return 工程 ID、標準構造でない場合は空文字です。
   */
  private static String resolveProjectId(Path testCaseDirectory) {
    // 业务上 testCase 的父目录必须是 db，其他手工目录不擅自推断工程号。
    Path databaseDirectory = testCaseDirectory.getParent();
    if (databaseDirectory == null || !"db".equalsIgnoreCase(databaseDirectory.getFileName().toString())) {
      return "";
    }
    // 业务上 db 的父目录名就是 CPMAB082 等工程 ID，用于覆盖模板残留的旧处理 ID。
    Path projectDirectory = databaseDirectory.getParent();
    // 业务上路径不完整时返回空值，保留既有模板元数据而不是写入错误工程号。
    return projectDirectory == null ? "" : projectDirectory.getFileName().toString();
  }

  /** Workbook を対象工程の統一 OPTION/temp に置いた一時ファイル経由で安全に置換します。 */
  private static void saveWorkbookSafely(Workbook workbook, Path xlsmPath) throws IOException {
    // 业务上从目标工作簿反查当前工程根，不能把 ACODE 宿主 SELPLAT 误当作业务工程。
    Path toolTempDirectory = resolveCurrentProjectRoot(xlsmPath).resolve("OPTION").resolve("temp");
    // 业务上保存失败时原本必须可恢复，因此完成写出前不直接覆盖目标文件。
    Files.createDirectories(toolTempDirectory);
    // 业务上中间成果只进入当前工程 OPTION/temp，避免跨工程共享执行内务。
    Path tempOutputPath = Files.createTempFile(
        toolTempDirectory, "db-xlsm-import-", ".xlsm");
    try {
      try (OutputStream outputStream = Files.newOutputStream(tempOutputPath)) {
        workbook.write(outputStream);
      }
      Files.move(tempOutputPath, xlsmPath, StandardCopyOption.REPLACE_EXISTING);
    } finally {
      // 业务上一旦移动或异常都清理残留临时文件，避免工具目录出现无归属文件。
      Files.deleteIfExists(tempOutputPath);
    }
  }

  /**
   * XLSM パスまたは明示プロパティから現在工程ルートを解決します。
   *
   * @param xlsmPath 更新対象 XLSM です。
   * @return `.git` / `AGENTS.md` または test 親から特定した工程ルートです。
   */
  private static Path resolveCurrentProjectRoot(Path xlsmPath) {
    // 业务上自动化调用可以显式传入工程根，优先级高于路径推断。
    String configuredRoot = System.getProperty(PROJECT_ROOT_PROPERTY, "").trim();
    if (!configuredRoot.isEmpty()) {
      Path explicitRoot = Path.of(configuredRoot).toAbsolutePath().normalize();
      if (!Files.isDirectory(explicitRoot)) {
        throw new IllegalArgumentException("Configured project root not found: " + explicitRoot);
      }
      return explicitRoot;
    }
    // 业务上从目标工作簿所在目录向上寻找最近工程标识，与会话工程识别规则一致。
    Path current = xlsmPath.toAbsolutePath().normalize().getParent();
    Path testParentFallback = null;
    while (current != null) {
      if (Files.exists(current.resolve(".git")) || Files.exists(current.resolve("AGENTS.md"))) {
        return current;
      }
      // 业务上既存 CP/BAT 工程未必有 Git 标识，test 目录父级作为兼容回退候选。
      if (current.getFileName() != null && "test".equalsIgnoreCase(current.getFileName().toString())) {
        testParentFallback = current.getParent();
      }
      current = current.getParent();
    }
    if (testParentFallback != null) {
      return testParentFallback;
    }
    // 业务上无法确认工程归属时禁止写临时文件，避免回退到系统或其他工程 temp。
    throw new IllegalStateException("Current project root cannot be resolved from XLSM path. Set -D"
        + PROJECT_ROOT_PROPERTY + "=<projectRoot>: " + xlsmPath);
  }

  /** 未型付け値を業務文字列へ変換します。 */
  private static String stringValue(Object value) {
    // 业务上 null は Excel 空欄として扱い、文字列 "null" を生成しません。
    return value == null ? "" : String.valueOf(value);
  }

  /** 未型付け値を業務真偽値へ変換します。 */
  private static boolean booleanValue(Object value) {
    // 业务上 Jackson Boolean と文字列の双方を許容し、define 生成元の表記差を吸収します。
    return value instanceof Boolean booleanValue ? booleanValue : Boolean.parseBoolean(stringValue(value));
  }

  /** 未型付け値を業務整数へ変換します。 */
  private static int integerValue(Object value) {
    // 业务上数値型は直接変換し、文字列数値も同じ列値として受け入れます。
    if (value instanceof Number number) {
      return number.intValue();
    }
    String text = stringValue(value).trim();
    return text.isEmpty() ? 0 : Integer.parseInt(text);
  }

  /**
   * 引数から実際に同期する case ディレクトリ一覧を解決します。
   *
   * @param sourcePath testCase ルートまたは単独 case ディレクトリです。
   * @param args 実行引数です。
   * @return 同期対象の case ディレクトリ一覧です。
   * @throws IOException ディレクトリ列挙に失敗した場合に送出します。
   */
  private static List<Path> resolveCaseDirectories(Path sourcePath, String[] args) throws IOException {
    // 3 件目以降の caseId が指定されている場合は、ルート配下から個別解決します。
    if (args.length >= 3) {
      List<Path> caseDirectories = new ArrayList<>();
      for (int index = 2; index < args.length; index++) {
        // caseId ごとに配下ディレクトリを組み立て、存在しない case は即時に検知します。
        Path caseDirectory = sourcePath.resolve(args[index]);
        if (!Files.isDirectory(caseDirectory)) {
          throw new IllegalArgumentException("testCase directory not found: " + caseDirectory);
        }
        caseDirectories.add(caseDirectory);
      }
      return caseDirectories;
    }
    // 単独 case ディレクトリが渡された場合は、その 1 件だけ同期対象にします。
    if (Files.isDirectory(sourcePath) && Files.isDirectory(sourcePath.resolve("input")) && Files.isDirectory(sourcePath.resolve("expect"))) {
      return List.of(sourcePath);
    }
    // ルートディレクトリが渡された場合は、直下の case ディレクトリを昇順で同期対象にします。
    if (!Files.isDirectory(sourcePath)) {
      throw new IllegalArgumentException("source path not found: " + sourcePath);
    }
    try (var stream = Files.list(sourcePath)) {
      return stream.filter(Files::isDirectory).sorted(Comparator.comparing(path -> path.getFileName().toString())).toList();
    }
  }

  /**
   * testCase ディレクトリ内の input / expect JSON を xlsm に取り込みます。
   *
   * @param xlsmPath xlsm テンプレートのパスです。
   * @param testCaseDir `000001` のような testCase ディレクトリです。
   * @throws IOException 読込または保存に失敗した場合に送出します。
   */
  public static void importTestCase(Path xlsmPath, Path testCaseDir) throws IOException {
    // 业务上 testCase000001 这类历史脏目录名也要统一折算成 000001，避免再把错误前缀写回 xlsm。
    String testCaseId = normalizeCaseId(testCaseDir.getFileName().toString());
    // xlsm 全体を同一 Workbook として読み込み、シート間の style 参照を維持します。
    try (InputStream inputStream = Files.newInputStream(xlsmPath); Workbook workbook = new XSSFWorkbook(inputStream)) {
      // Workbook から `inp_` / `exp_` シートの対応表を作成します。
      WorkbookContext context = buildWorkbookContext(workbook);
      // 业务上每次导入前先把テストケース一覧中的前缀脏数据、重复行和乱序行收敛，保证反向生成目录稳定。
      normalizeTestCaseListSheet(workbook);
      // 一覧シートへ testCase が無ければ末尾へ追加して識別可能にします。
      ensureTestCaseRegistered(workbook, testCaseId);
      // input JSON を `inp_` シートへ全量同期します。
      importDirectory(context, testCaseDir.resolve("input"), "inp", testCaseId);
      // expect JSON を `exp_` シートへ全量同期します。
      importDirectory(context, testCaseDir.resolve("expect"), "exp", testCaseId);
      // 业务上单 Case 导入也同步该 Case 的文件存在事实，避免局部更新破坏缺失/空表区别。
      synchronizeJsonPresenceForCase(workbook, testCaseDir);
      // 业务上单 Case 导入也复用统一安全保存入口，保持临时目录和原本保护策略一致。
      saveWorkbookSafely(workbook, xlsmPath);
    }
  }

  /**
   * Workbook から物理テーブル名と `inp_` / `exp_` シートの対応を作成します。
   *
   * @param workbook 読み込み済み Workbook です。
   * @return シート対応と formatter を束ねた文脈です。
   */
  private static WorkbookContext buildWorkbookContext(Workbook workbook) {
    // 表示値ベースでヘッダや物理名を読むため formatter を共有します。
    DataFormatter formatter = new DataFormatter();
    // input 系シートの対応表です。
    Map<String, Sheet> inputSheets = new LinkedHashMap<>();
    // expect 系シートの対応表です。
    Map<String, Sheet> expectSheets = new LinkedHashMap<>();
    // Workbook 内の全シートを走査し、実データシートだけを登録します。
    for (int index = 0; index < workbook.getNumberOfSheets(); index++) {
      // 現在のシートを取得します。
      Sheet sheet = workbook.getSheetAt(index);
      // シート名から `inp_` / `exp_` 判定を行います。
      String sheetName = sheet.getSheetName();
      // C4 にある物理テーブル名で JSON ファイルとの対応を取ります。
      String physicalTableName = readNormalizedCellText(sheet, 3, 2, formatter);
      // 管理シートのように物理テーブル名が無いものは対象外です。
      if (physicalTableName.isBlank()) {
        continue;
      }
      // `inp_` シートは input 用の保存先に登録します。
      if (sheetName.startsWith("inp_")) {
        inputSheets.put(physicalTableName, sheet);
      }
      // `exp_` シートは expect 用の保存先に登録します。
      if (sheetName.startsWith("exp_")) {
        expectSheets.put(physicalTableName, sheet);
      }
    }
    // 以後の import 処理で再利用するため文脈として返します。
    return new WorkbookContext(formatter, inputSheets, expectSheets);
  }

  /**
   * テストケース一覧に対象 case が無ければ末尾に追記します。
   *
   * @param workbook 更新対象 Workbook です。
   * @param testCaseId 追加対象の testCaseId です。
   */
  private static void ensureTestCaseRegistered(Workbook workbook, String testCaseId) {
    // テストケース一覧シートを取得します。
    Sheet sheet = workbook.getSheet("テストケース一覧");
    // 一覧シートが無いとテンプレートが破綻しているため即座に止めます。
    if (sheet == null) {
      throw new IllegalStateException("テストケース一覧 sheet not found.");
    }
    // 既に同じ case が存在する場合は二重登録を防ぐため何もしません。
    if (findTestCaseRow(sheet, testCaseId) >= 0) {
      return;
    }
    // B 列で最後に値がある行の次を新規ケース行とします。
    int newRowIndex = findLastNonEmptyRow(sheet, 1) + 1;
    // 新規行を取得または作成します。
    Row row = getOrCreateRow(sheet, newRowIndex);
    // 一覧の連番列へ見た目用の番号を入れます。
    writeCell(row, 0, Integer.toString(newRowIndex - TEST_CASE_LIST_START_ROW_INDEX + 1));
    // 一覧の testCaseId 列へ今回の case を登録します。
    writeCell(row, 1, testCaseId);
    // 備考列へ通常の正常ケースとして扱う既定値を入れます。
    writeCell(row, 3, DEFAULT_CASE_STATUS);
  }

  /**
   * テストケース一覧の caseId を正規化し、重複を除去したうえで昇順へ並べ直します。
   *
   * @param workbook 更新対象 Workbook です。
   */
  private static void normalizeTestCaseListSheet(Workbook workbook) {
    // 业务上反向生成目录名直接读取この一覧シート，因此这里必须先把 testCase 前缀脏值清掉。
    Sheet sheet = workbook.getSheet("テストケース一覧");
    if (sheet == null) {
      throw new IllegalStateException("テストケース一覧 sheet not found.");
    }
    // 业务上按 caseId 聚合现有行，优先保留第一次出现的辅助列值，再对重复脏行做合并。
    DataFormatter formatter = new DataFormatter();
    Map<String, CaseListRowData> normalizedRowMap = new TreeMap<>();
    int lastRowIndex = findLastNonEmptyRow(sheet, 1);
    for (int rowIndex = TEST_CASE_LIST_START_ROW_INDEX; rowIndex <= lastRowIndex; rowIndex++) {
      String rawCaseId = readNormalizedCellText(sheet, rowIndex, 1, formatter);
      String normalizedCaseId = normalizeCaseId(rawCaseId);
      if (normalizedCaseId.isBlank()) {
        continue;
      }
      String columnC = readCellText(sheet, rowIndex, 2, formatter);
      String status = readCellText(sheet, rowIndex, 3, formatter);
      CaseListRowData existing = normalizedRowMap.get(normalizedCaseId);
      if (existing == null) {
        normalizedRowMap.put(normalizedCaseId, new CaseListRowData(columnC, status));
        continue;
      }
      // 业务上若首个重复行缺少补充信息，则从后续重复行补齐，避免清理脏行时把有效备注一并丢掉。
      String mergedColumnC = existing.columnC().isBlank() ? columnC : existing.columnC();
      String mergedStatus = existing.status().isBlank() ? status : existing.status();
      normalizedRowMap.put(normalizedCaseId, new CaseListRowData(mergedColumnC, mergedStatus));
    }
    // 业务上先把原区域清空，再按规范顺序重写，避免旧的 testCase000001 行继续残留在尾部。
    for (int rowIndex = TEST_CASE_LIST_START_ROW_INDEX; rowIndex <= lastRowIndex; rowIndex++) {
      Row row = getOrCreateRow(sheet, rowIndex);
      writeCell(row, 0, "");
      writeCell(row, 1, "");
      writeCell(row, 2, "");
      writeCell(row, 3, "");
    }
    int sequence = 1;
    int rowIndex = TEST_CASE_LIST_START_ROW_INDEX;
    for (Map.Entry<String, CaseListRowData> entry : normalizedRowMap.entrySet()) {
      Row row = getOrCreateRow(sheet, rowIndex++);
      writeCell(row, 0, Integer.toString(sequence++));
      writeCell(row, 1, entry.getKey());
      writeCell(row, 2, entry.getValue().columnC());
      writeCell(row, 3, entry.getValue().status().isBlank() ? DEFAULT_CASE_STATUS : entry.getValue().status());
    }
  }

  /**
   * 旧ツールが作った `testCase000001` のような case 名を、純粋な caseId へ正規化します。
   *
   * @param rawCaseId 元の case 名です。
   * @return `000001` のような正規化後 caseId です。
   */
  private static String normalizeCaseId(String rawCaseId) {
    // 业务上反向生成目录和一覧表示は純 case 号だけで揃えるため、誤って付いた testCase 前缀は必ず落とします。
    if (rawCaseId == null) {
      return "";
    }
    String trimmedCaseId = rawCaseId.trim();
    if (trimmedCaseId.startsWith("testCase")) {
      return trimmedCaseId.substring("testCase".length());
    }
    return trimmedCaseId;
  }

  /**
   * input または expect ディレクトリ配下の JSON をシート単位で全量同期します。
   *
   * @param context Workbook のシート対応情報です。
   * @param directory `input` または `expect` ディレクトリです。
   * @param mode `inp` か `exp` です。
   * @param testCaseId 反映対象のテストケース ID です。
   * @throws IOException JSON 読込に失敗した場合に送出します。
   */
  private static void importDirectory(WorkbookContext context, Path directory, String mode, String testCaseId) throws IOException {
    // ディレクトリが無くても全量同期では「対象テーブル無し」として扱うため、空ディレクトリ相当で処理を続行します。
    Map<String, TableDataPayload> payloadByTable = readPayloadMap(directory);
    // 対象モードの全シートを走査し、JSON にあるものは書込み、無いものは当該 case 列を削除します。
    for (Map.Entry<String, Sheet> entry : context.getSheets(mode).entrySet()) {
      // 物理テーブル名ごとに対応シートを取得します。
      String physicalTableName = entry.getKey();
      Sheet sheet = entry.getValue();
      // JSON が存在する場合はその tableData を使い、存在しない場合は空リストで削除同期します。
      TableDataPayload payload = payloadByTable.getOrDefault(physicalTableName, new TableDataPayload(physicalTableName, List.of()));
      syncTableCaseColumns(sheet, context.formatter(), testCaseId, payload.tableData());
    }
  }

  /**
   * ディレクトリ配下の JSON を物理テーブル名単位の payload へ読み込みます。
   *
   * @param directory `input` または `expect` ディレクトリです。
   * @return 物理テーブル名をキーにした payload 対応表です。
   * @throws IOException JSON 読込に失敗した場合に送出します。
   */
  private static Map<String, TableDataPayload> readPayloadMap(Path directory) throws IOException {
    // 物理テーブル名ごとの tableData を保持し、後段で全シート同期に使います。
    Map<String, TableDataPayload> payloadByTable = new HashMap<>();
    // ディレクトリが存在しない場合は空の対応表を返し、全シートを削除同期します。
    if (!Files.isDirectory(directory)) {
      return payloadByTable;
    }
    // ディレクトリ直下の JSON を安定順で読み込み、テーブルごとの最新 payload を保持します。
    try (var stream = Files.list(directory)) {
      List<Path> jsonFiles = stream.filter(path -> path.getFileName().toString().endsWith(".json")).sorted().toList();
      for (Path jsonFile : jsonFiles) {
        // JSON から物理テーブル名と tableData を読み取り、同名テーブルの同期元として保存します。
        TableDataPayload payload = readPayload(jsonFile);
        if (!payload.physicalTableName().isBlank()) {
          payloadByTable.put(payload.physicalTableName(), payload);
        }
      }
    }
    return payloadByTable;
  }

  /**
   * シート上の対象 case 列を JSON の件数に完全一致するよう同期します。
   *
   * @param sheet 更新対象シートです。
   * @param formatter ヘッダ比較に使う formatter です。
   * @param testCaseId 同期対象の testCaseId です。
   * @param records JSON 側のレコード一覧です。
   */
  private static void syncTableCaseColumns(Sheet sheet, DataFormatter formatter, String testCaseId, List<Map<String, Object>> records) {
    // 既存の同一 case 列を全て把握し、再配置前の削除対象として扱います。
    List<Integer> existingColumns = findColumnsByTestCaseId(sheet, formatter, testCaseId);
    // 右から削除することで、左側の列番号がずれて別列を消してしまう事故を防ぎます。
    for (int index = existingColumns.size() - 1; index >= 0; index--) {
      deleteColumn(sheet, existingColumns.get(index));
    }
    // JSON 側にレコードが無い場合は、旧列削除だけで同期完了とします。
    if (records.isEmpty()) {
      // 削除だけのケースでも第 9 行の出力列番号は詰め直し、宏が有効列を見失わないようにします。
      recalcOutputHeaderNumbers(sheet, formatter);
      return;
    }
    // 既存列削除後の現在位置から、case 並び順を崩さない挿入開始列を決定します。
    int insertionColumnIndex = findInsertionColumn(sheet, formatter, testCaseId);
    // JSON の件数ぶんだけ空列を挿入し、同じ case の列ブロックを連続で確保します。
    insertBlankColumns(sheet, insertionColumnIndex, records.size());
    // 確保した列ブロックへ 1 レコードずつ順番に書き込みます。
    for (int recordIndex = 0; recordIndex < records.size(); recordIndex++) {
      // 同一 case ブロック内の書込み先列を計算します。
      int columnIndex = insertionColumnIndex + recordIndex;
      // 各列のヘッダを今回の case として初期化し、対象外・操作種別も JSON 同期用の既定値へ揃えます。
      initializeCaseColumn(sheet, columnIndex, testCaseId);
      // JSON レコードの項目値を物理名に対応する行へ書き込みます。
      writeRecordToSheet(sheet, records.get(recordIndex), columnIndex, formatter);
    }
    // 同期後の有効列配置に合わせて第 9 行の出力列番号を再採番し、反向 JSON 生成マクロの列認識を維持します。
    recalcOutputHeaderNumbers(sheet, formatter);
  }

  /**
   * 追加した列へ testCase ヘッダと制御行の初期値を書き込みます。
   *
   * @param sheet 更新対象シートです。
   * @param columnIndex 初期化する列番号です。
   * @param testCaseId 書き込む testCaseId です。
   */
  private static void initializeCaseColumn(Sheet sheet, int columnIndex, String testCaseId) {
    // ヘッダ行へ testCaseId を書き、どの case に属する列か明示します。
    writeCell(getOrCreateRow(sheet, TEST_CASE_ID_ROW_INDEX), columnIndex, testCaseId);
    // 対象外チェック行は JSON 同期対象として空欄へ戻します。
    writeCell(getOrCreateRow(sheet, EXCLUDED_ROW_INDEX), columnIndex, "");
    // 操作種別行も空欄で初期化し、旧列の残骸が残らないようにします。
    writeCell(getOrCreateRow(sheet, OPERATION_ROW_INDEX), columnIndex, "");
  }

  /**
   * 第 10 行に値がある有効 case 列だけを対象に、第 9 行の出力列番号を左から再採番します。
   *
   * @param sheet 更新対象シートです。
   * @param formatter ヘッダ比較に使う formatter です。
   */
  private static void recalcOutputHeaderNumbers(Sheet sheet, DataFormatter formatter) {
    // 出力列番号行を確保し、削除や挿入後の列番号をここへ再配置します。
    Row outputHeaderRow = getOrCreateRow(sheet, OUTPUT_HEADER_ROW_INDEX);
    // testCaseId 行に存在する有効列を基準に採番するため、右端はシート全体の最終使用列まで見ます。
    int maxColumnIndex = findMaxUsedColumnIndex(sheet);
    // 宏の列判定口径に合わせ、K 列を 1 とした連番を有効列だけに割り振ります。
    int outputNumber = 1;
    for (int columnIndex = DATA_START_COLUMN; columnIndex <= maxColumnIndex; columnIndex++) {
      // 第 10 行に caseId が無い列は無効列として扱い、第 9 行の番号も空白へ戻します。
      String headerCaseId = readNormalizedCellText(sheet, TEST_CASE_ID_ROW_INDEX, columnIndex, formatter);
      if (headerCaseId.isBlank()) {
        clearCell(outputHeaderRow, columnIndex);
        continue;
      }
      // 有効列だけを左から順番に採番し、原版テンプレートの出力列番号構造を再現します。
      writeNumberCell(outputHeaderRow, columnIndex, outputNumber);
      outputNumber++;
    }
  }

  /**
   * case 並び順を壊さない挿入開始列を返します。
   *
   * @param sheet 対象シートです。
   * @param formatter ヘッダ比較に使う formatter です。
   * @param testCaseId 挿入対象の testCaseId です。
   * @return 今回の case ブロックを挿入する列番号です。
   */
  private static int findInsertionColumn(Sheet sheet, DataFormatter formatter, String testCaseId) {
    // testCaseId ヘッダ行を取得し、K 列以降の並びを走査します。
    Row headerRow = getOrCreateRow(sheet, TEST_CASE_ID_ROW_INDEX);
    int lastColumn = resolveHeaderLastColumn(headerRow);
    // 既存の case 並びを左から見て、自分より大きい case の直前へ挿入します。
    for (int columnIndex = DATA_START_COLUMN; columnIndex < lastColumn; columnIndex++) {
      String headerCaseId = readNormalizedCellText(sheet, TEST_CASE_ID_ROW_INDEX, columnIndex, formatter);
      if (headerCaseId.isBlank()) {
        return columnIndex;
      }
      if (headerCaseId.compareTo(testCaseId) > 0) {
        return columnIndex;
      }
    }
    // 末尾まで自分以上が無い場合は、最後の使用列の次へ連続追加します。
    return lastColumn;
  }

  /**
   * 指定位置へ空列を複数挿入し、前列の見た目を引き継ぎます。
   *
   * @param sheet 更新対象シートです。
   * @param insertionColumnIndex 挿入開始列です。
   * @param count 挿入する列数です。
   */
  private static void insertBlankColumns(Sheet sheet, int insertionColumnIndex, int count) {
    // 挿入件数が 0 以下なら何もせず終了します。
    if (count <= 0) {
      return;
    }
    // 既存列を右へずらして連続空列を確保します。
    for (int index = 0; index < count; index++) {
      insertBlankColumn(sheet, insertionColumnIndex + index);
    }
  }

  /**
   * 指定位置へ 1 列だけ空列を挿入し、周辺列の見た目を流用します。
   *
   * @param sheet 更新対象シートです。
   * @param insertionColumnIndex 挿入開始列です。
   */
  private static void insertBlankColumn(Sheet sheet, int insertionColumnIndex) {
    // シート全体で現在使用されている最終列を把握し、右シフトの終端に使います。
    int maxColumnIndex = findMaxUsedColumnIndex(sheet);
    // 最終列から右へ 1 列ずつ退避し、挿入位置に空きを作ります。
    for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      for (int columnIndex = maxColumnIndex + 1; columnIndex >= insertionColumnIndex + 1; columnIndex--) {
        copyCell(row, columnIndex - 1, columnIndex);
      }
      clearCell(row, insertionColumnIndex);
    }
    // 列幅と非表示設定も右へ詰め替え、列見た目のズレを防ぎます。
    for (int columnIndex = maxColumnIndex + 1; columnIndex >= insertionColumnIndex + 1; columnIndex--) {
      sheet.setColumnWidth(columnIndex, sheet.getColumnWidth(columnIndex - 1));
      sheet.setColumnHidden(columnIndex, sheet.isColumnHidden(columnIndex - 1));
    }
    // 新規列の見た目は直前列を優先し、先頭挿入だけは右隣列を代用してテンプレート体裁を維持します。
    applyTemplateStyleToInsertedColumn(sheet, insertionColumnIndex);
  }

  /**
   * 指定列を削除し、右側の列を左へ詰めます。
   *
   * @param sheet 更新対象シートです。
   * @param columnIndex 削除する列番号です。
   */
  private static void deleteColumn(Sheet sheet, int columnIndex) {
    // シート全体で現在使用されている最終列を把握し、左シフトの終端に使います。
    int maxColumnIndex = findMaxUsedColumnIndex(sheet);
    // 削除位置より右の列を 1 列ずつ左へ詰め、当該列を物理削除した状態に近づけます。
    for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      for (int currentColumnIndex = columnIndex; currentColumnIndex < maxColumnIndex; currentColumnIndex++) {
        copyCell(row, currentColumnIndex + 1, currentColumnIndex);
      }
      clearCell(row, maxColumnIndex);
    }
    // 列幅と非表示設定も左へ詰めて、削除後の見た目を崩さないようにします。
    for (int currentColumnIndex = columnIndex; currentColumnIndex < maxColumnIndex; currentColumnIndex++) {
      sheet.setColumnWidth(currentColumnIndex, sheet.getColumnWidth(currentColumnIndex + 1));
      sheet.setColumnHidden(currentColumnIndex, sheet.isColumnHidden(currentColumnIndex + 1));
    }
  }

  /**
   * 新規挿入列へ周辺列のスタイルと列設定を適用します。
   *
   * @param sheet 更新対象シートです。
   * @param columnIndex 挿入した列番号です。
   */
  private static void applyTemplateStyleToInsertedColumn(Sheet sheet, int columnIndex) {
    // 直前列が存在する場合は、同一 block 直前の見た目をそのまま継承します。
    int templateColumnIndex = columnIndex > DATA_START_COLUMN ? columnIndex - 1 : columnIndex + 1;
    if (templateColumnIndex < DATA_START_COLUMN || templateColumnIndex > findMaxUsedColumnIndex(sheet)) {
      return;
    }
    // 列幅と表示状態をテンプレート列から複製します。
    sheet.setColumnWidth(columnIndex, sheet.getColumnWidth(templateColumnIndex));
    sheet.setColumnHidden(columnIndex, sheet.isColumnHidden(templateColumnIndex));
    // 行ごとのセル style を複製し、挿入列も既存列と同じ装飾へ揃えます。
    for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      Cell sourceCell = row.getCell(templateColumnIndex);
      if (sourceCell == null) {
        continue;
      }
      Cell targetCell = row.getCell(columnIndex);
      if (targetCell == null) {
        targetCell = row.createCell(columnIndex);
      }
      CellStyle sourceStyle = sourceCell.getCellStyle();
      if (sourceStyle != null) {
        targetCell.setCellStyle(sourceStyle);
      }
    }
  }

  /**
   * 1 レコード分の JSON 項目をシートの物理名行へ書き込みます。
   *
   * @param sheet 書込先シートです。
   * @param record 1 レコード分の JSON 項目です。
   * @param columnIndex 書込先列番号です。
   * @param formatter 物理名の表示値を読む formatter です。
   */
  private static void writeRecordToSheet(Sheet sheet, Map<String, Object> record, int columnIndex, DataFormatter formatter) {
    // 定義行を順に見て JSON 側に存在しない項目も含めて列値を初期化し、旧データの残骸を残しません。
    for (int rowIndex = DATA_FIELD_START_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      // D 列の物理名を取り出して JSON 項目との対応に使います。
      String physicalName = readNormalizedCellText(sheet, rowIndex, FIELD_NAME_COLUMN, formatter);
      if (physicalName.isBlank()) {
        continue;
      }
      // JSON に同名項目があればその値を書き、無ければ null 相当の空白にして完全同期を維持します。
      Object rawValue = record.get(physicalName);
      if (rawValue == null) {
        // 业务上 JSON null 或字段缺失使用真正空白 Cell，反向时恢复为 null。
        writeCell(row, columnIndex, "");
      } else if (rawValue instanceof String stringValue && stringValue.isEmpty()) {
        // 业务上显式空字符串使用原 VBA 识别的单引号占位，避免与 null 合并。
        writeCell(row, columnIndex, "'");
      } else {
        // 业务上非空业务值保持原文字列，数值型由反向导出时依据定义转换。
        writeCell(row, columnIndex, rawValue.toString());
      }
    }
  }

  /**
   * testCaseId ヘッダが一致する列を左から順に返します。
   *
   * @param sheet 対象シートです。
   * @param formatter ヘッダ比較に使う formatter です。
   * @param testCaseId 探索対象の testCaseId です。
   * @return 同一 testCaseId を持つ列番号一覧です。
   */
  private static List<Integer> findColumnsByTestCaseId(Sheet sheet, DataFormatter formatter, String testCaseId) {
    // 再配置前に削除すべき既存列位置を保持します。
    List<Integer> matchedColumns = new ArrayList<>();
    // testCaseId ヘッダ行を起点に探索上限を決めます。
    Row headerRow = getOrCreateRow(sheet, TEST_CASE_ID_ROW_INDEX);
    int lastColumn = resolveHeaderLastColumn(headerRow);
    // K 列以降の全ヘッダを見て同じ case の列を回収します。
    for (int columnIndex = DATA_START_COLUMN; columnIndex < lastColumn; columnIndex++) {
      String cellText = readNormalizedCellText(sheet, TEST_CASE_ID_ROW_INDEX, columnIndex, formatter);
      if (testCaseId.equals(cellText)) {
        matchedColumns.add(columnIndex);
      }
    }
    return matchedColumns;
  }

  /**
   * テストケース一覧から指定 case の行を探します。
   *
   * @param sheet テストケース一覧シートです。
   * @param testCaseId 探したい testCaseId です。
   * @return 見つかった行番号、無ければ -1 です。
   */
  private static int findTestCaseRow(Sheet sheet, String testCaseId) {
    // 一覧の B 列を順番に見て一致する case を探します。
    for (int rowIndex = TEST_CASE_LIST_START_ROW_INDEX; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = getOrCreateRow(sheet, rowIndex);
      Cell cell = row.getCell(1);
      if (cell != null && testCaseId.equals(cell.getStringCellValue())) {
        return rowIndex;
      }
    }
    return -1;
  }

  /**
   * 指定列で最後に値がある行番号を返します。
   *
   * @param sheet 対象シートです。
   * @param columnIndex 確認対象列です。
   * @return 最終データ行番号です。
   */
  private static int findLastNonEmptyRow(Sheet sheet, int columnIndex) {
    // 末尾から前へ遡り、最初に値がある行を返します。
    for (int rowIndex = sheet.getLastRowNum(); rowIndex >= TEST_CASE_LIST_START_ROW_INDEX; rowIndex--) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      Cell cell = row.getCell(columnIndex);
      if (cell != null && !cell.toString().isBlank()) {
        return rowIndex;
      }
    }
    return TEST_CASE_LIST_START_ROW_INDEX - 1;
  }

  /**
   * 指定セルを表示文字列として取得します。
   *
   * @param sheet 対象シートです。
   * @param rowIndex 行番号です。
   * @param columnIndex 列番号です。
   * @param formatter 表示値変換 formatter です。
   * @return 空欄なら空文字、値があれば表示文字列です。
   */
  private static String readCellText(Sheet sheet, int rowIndex, int columnIndex, DataFormatter formatter) {
    // 参照行を取得します。
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      return "";
    }
    // 参照セルを取得します。
    Cell cell = row.getCell(columnIndex);
    if (cell == null) {
      return "";
    }
    // 表示形式を維持した文字列をそのまま返し、業務値の末尾空白をここで落とさないようにします。
    return formatter.formatCellValue(cell);
  }

  /**
   * 制御項目の照合に使うため、前後空白を除去した表示文字列を返します。
   *
   * @param sheet 対象シートです。
   * @param rowIndex 行番号です。
   * @param columnIndex 列番号です。
   * @param formatter 表示値変換 formatter です。
   * @return 空欄なら空文字、値があれば前後空白を除去した表示文字列です。
   */
  private static String readNormalizedCellText(Sheet sheet, int rowIndex, int columnIndex, DataFormatter formatter) {
    // caseId、物理名、ヘッダ比較では前後空白の揺れを吸収したいので、原文取得後にだけ trim します。
    return readCellText(sheet, rowIndex, columnIndex, formatter).trim();
  }

  /**
   * 指定行を取得し、無ければ新規作成します。
   *
   * @param sheet 対象シートです。
   * @param rowIndex 行番号です。
   * @return 既存または新規作成した行です。
   */
  private static Row getOrCreateRow(Sheet sheet, int rowIndex) {
    // 既存行を確認します。
    Row row = sheet.getRow(rowIndex);
    // 行が無ければこの場で生成して後続処理で再利用します。
    return row != null ? row : sheet.createRow(rowIndex);
  }

  /**
   * 指定セルへ文字列を設定します。
   *
   * @param row 書込先行です。
   * @param columnIndex 書込先列番号です。
   * @param value 設定する文字列です。
   */
  private static void writeCell(Row row, int columnIndex, String value) {
    // 対象セルを取得し、無ければ新規作成します。
    Cell cell = row.getCell(columnIndex);
    if (cell == null) {
      cell = row.createCell(columnIndex);
    }
    // 値が無い項目は空文字列セルを作らず、純粋な空白セルへ戻してテンプレート上の二重引用符表示を避けます。
    if (value == null || value.isEmpty()) {
      cell.setBlank();
      return;
    }
    // テンプレート運用に合わせて全て文字列として保存します。
    cell.setCellValue(value);
  }

  /**
   * 指定セルへ数値の列番号を設定します。
   *
   * @param row 書込先行です。
   * @param columnIndex 書込先列番号です。
   * @param value 設定する列番号です。
   */
  private static void writeNumberCell(Row row, int columnIndex, int value) {
    // 出力列番号セルを取得し、無ければ新規作成します。
    Cell cell = row.getCell(columnIndex);
    if (cell == null) {
      cell = row.createCell(columnIndex);
    }
    // 第 9 行の列番号は原版テンプレートと同じく数値セルで保持し、宏の数値判定と揃えます。
    cell.setCellValue(value);
  }

  /**
   * 行内の 1 セルを別列へ複製します。
   *
   * @param row 対象行です。
   * @param sourceColumnIndex コピー元列です。
   * @param targetColumnIndex コピー先列です。
   */
  private static void copyCell(Row row, int sourceColumnIndex, int targetColumnIndex) {
    // コピー元セルが無い場合はコピー先も空にして、シフト後にゴミ値が残らないようにします。
    Cell sourceCell = row.getCell(sourceColumnIndex);
    if (sourceCell == null) {
      clearCell(row, targetColumnIndex);
      return;
    }
    // コピー先セルを確保し、値と style を同時に引き継ぎます。
    Cell targetCell = row.getCell(targetColumnIndex);
    if (targetCell == null) {
      targetCell = row.createCell(targetColumnIndex);
    }
    targetCell.setBlank();
    CellStyle style = sourceCell.getCellStyle();
    if (style != null) {
      targetCell.setCellStyle(style);
    }
    Comment comment = sourceCell.getCellComment();
    if (comment != null) {
      targetCell.setCellComment(comment);
    } else {
      targetCell.removeCellComment();
    }
    Hyperlink hyperlink = sourceCell.getHyperlink();
    if (hyperlink != null) {
      targetCell.setHyperlink(hyperlink);
    }
    // セル型ごとに値のコピー方法を変え、表示値の破損を防ぎます。
    CellType cellType = sourceCell.getCellType();
    if (cellType == CellType.FORMULA) {
      targetCell.setCellFormula(sourceCell.getCellFormula());
      return;
    }
    if (cellType == CellType.STRING) {
      targetCell.setCellValue(sourceCell.getRichStringCellValue());
      return;
    }
    if (cellType == CellType.NUMERIC) {
      targetCell.setCellValue(sourceCell.getNumericCellValue());
      return;
    }
    if (cellType == CellType.BOOLEAN) {
      targetCell.setCellValue(sourceCell.getBooleanCellValue());
      return;
    }
    if (cellType == CellType.ERROR) {
      targetCell.setCellErrorValue(sourceCell.getErrorCellValue());
      return;
    }
    targetCell.setBlank();
  }

  /**
   * 指定セルを空欄へ戻します。
   *
   * @param row 対象行です。
   * @param columnIndex 空欄化する列です。
   */
  private static void clearCell(Row row, int columnIndex) {
    // 対象セルが存在しない場合は空欄化済みなので何もしません。
    Cell cell = row.getCell(columnIndex);
    if (cell == null) {
      return;
    }
    // 値・コメント・リンクを落として、旧列データの残骸を消します。
    cell.setBlank();
    cell.removeCellComment();
    cell.removeHyperlink();
  }

  /**
   * シート全体で現在使用されている最終列番号を返します。
   *
   * @param sheet 対象シートです。
   * @return 使用中の最終列番号です。
   */
  private static int findMaxUsedColumnIndex(Sheet sheet) {
    // 行ごとの最終セル位置を拾い、シート全体で最も右にある列を返します。
    int maxColumnIndex = DATA_START_COLUMN;
    for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null || row.getLastCellNum() < 0) {
        continue;
      }
      maxColumnIndex = Math.max(maxColumnIndex, row.getLastCellNum() - 1);
    }
    return maxColumnIndex;
  }

  /**
   * ヘッダ行の探索終端列を返します。
   *
   * @param headerRow testCaseId ヘッダ行です。
   * @return 探索時に使う終端列です。
   */
  private static int resolveHeaderLastColumn(Row headerRow) {
    // ヘッダ行が未初期化でも K 列から探索できるよう最低終端を保証します。
    return Math.max(DATA_START_COLUMN, headerRow.getLastCellNum() < 0 ? DATA_START_COLUMN : headerRow.getLastCellNum());
  }

  /**
   * JSON ファイルを Workbook 反映用 payload に変換します。
   *
   * @param jsonFile 読み込む JSON ファイルです。
   * @return 物理テーブル名と tableData を保持した payload です。
   * @throws IOException JSON 読込または解析に失敗した場合に送出します。
   */
  private static TableDataPayload readPayload(Path jsonFile) throws IOException {
    // JSON を連想順維持で読み込み、列反映時の項目順ズレを防ぎます。
    Map<String, Object> payload = OBJECT_MAPPER.readValue(Files.readString(jsonFile), new TypeReference<LinkedHashMap<String, Object>>() {});
    // 物理テーブル名を取り出して対応シート解決に使います。
    String physicalTableName = (String) payload.getOrDefault("physicalTableName", "");
    // tableData を 1 レコードずつ扱いやすい形へ詰め替えます。
    List<Map<String, Object>> tableData = new ArrayList<>();
    Object rawTableData = payload.get("tableData");
    if (rawTableData instanceof List<?> rows) {
      for (Object row : rows) {
        if (row instanceof Map<?, ?> map) {
          // 各レコードを連想順維持のまま格納し、同一 JSON の列順を崩さないようにします。
          Map<String, Object> record = new LinkedHashMap<>();
          for (Map.Entry<?, ?> entry : map.entrySet()) {
            record.put(String.valueOf(entry.getKey()), entry.getValue());
          }
          tableData.add(record);
        }
      }
    }
    return new TableDataPayload(physicalTableName, tableData);
  }

  /**
   * Workbook 内の `inp_` / `exp_` シート対応を保持する文脈です。
   */
  private record WorkbookContext(DataFormatter formatter, Map<String, Sheet> inputSheets, Map<String, Sheet> expectSheets) {

    /**
     * モードごとのシート対応表を返します。
     *
     * @param mode `inp` または `exp` です。
     * @return 対応シート一覧です。
     */
    private Map<String, Sheet> getSheets(String mode) {
      // input データは `inp_` 対応表を返します。
      if ("inp".equals(mode)) {
        return inputSheets;
      }
      // expect データは `exp_` 対応表を返します。
      if ("exp".equals(mode)) {
        return expectSheets;
      }
      throw new IllegalArgumentException("Unsupported mode: " + mode);
    }
  }

  /**
   * Case×input/expect×物理表の JSON ファイル存在事实を保持するレコードです。
   */
  private record JsonPresence(String mode, String caseId, String physicalTableName) {
  }

  /**
   * JSON payload の必要情報だけを保持するレコードです。
   */
  private record TableDataPayload(String physicalTableName, List<Map<String, Object>> tableData) {
  }

  /**
   * define JSON の表名と項目定義を順序どおり保持するレコードです。
   */
  private record TableDefinitionPayload(String logicalTableName, String physicalTableName,
      List<Map<String, Object>> fields) {
  }

  /**
   * テストケース一覧の 1 行分で保持したい補助列をまとめるレコードです。
   */
  private record CaseListRowData(String columnC, String status) {
  }
}
