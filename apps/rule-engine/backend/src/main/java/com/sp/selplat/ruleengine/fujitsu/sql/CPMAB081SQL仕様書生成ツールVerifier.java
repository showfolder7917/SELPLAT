package com.sp.selplat.ruleengine.fujitsu.sql;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipFile;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;

/** CPMAB081 SQL 仕様書の件数、主要項目、SQL 本文、組織名称を検証する。 */
public final class CPMAB081SQL仕様書生成ツールVerifier {

  /** 生成ツールと同じ正式成果物ディレクトリを検証対象にする。 */
  private static final Path OUTPUT_DIR = Path.of(
      "C:/opt/workspace/SELPLAT/OPTION/temp/sql-spec");

  /** SQL 仕様書の通用レイアウトを定義する Demo を書式比較の正本にする。 */
  private static final Path FORMAT_DEMO = Path.of(
      "C:/opt/workspace/SELPLAT/apps/rule-engine/backend/src/main/resources/"
          + "templates/sql-spec/reference/"
          + "SQL仕様書_アラート情報一括登録.xlsx");

  /** ファイル名と SQL ID の対応を固定し、欠落や取り違えを検出する。 */
  private static final Map<String, String> EXPECTED = createExpected();

  /** Java 型欄へ残してはならない DB 型名と抽象型を回帰検証用に保持する。 */
  private static final Set<String> FORBIDDEN_NON_JAVA_TYPES = Set.of(
      "CHAR", "VARCHAR", "INT", "INTEGER", "BIGINT", "SMALLINT", "DECIMAL", "NUMERIC",
      "DATE", "TIMESTAMP", "CLOB", "BLOB", "LIST", "BEAN");

  /** 検証専用クラスの誤生成を防止する。 */
  private CPMAB081SQL仕様書生成ツールVerifier() {
  }

  /** 8 ファイルを開き、空白 Sheet を含む不完全な成果物を失敗させる。 */
  public static void main(String[] args) throws Exception {
    // 生成対象外の過去ファイルを含めず、今回の仕様書が正確に八件あることを確認する。
    long workbookCount;
    try (var files = Files.list(OUTPUT_DIR)) {
      workbookCount = files.filter(path -> path.getFileName().toString().startsWith("SQL仕様書_"))
          .filter(path -> path.getFileName().toString().endsWith(".xlsx")).count();
    }
    require(workbookCount == EXPECTED.size(), "workbook count must be 8 but was " + workbookCount);

    // Demo を一度だけ開き、全成果物の合併範囲、印刷方向、改頁、主要セル書式と比較する。
    try (InputStream demoInput = Files.newInputStream(FORMAT_DEMO);
        Workbook demoWorkbook = WorkbookFactory.create(demoInput)) {
      Sheet demoSheet = demoWorkbook.getSheetAt(0);
      for (Map.Entry<String, String> expected : EXPECTED.entrySet()) {
      Path workbookPath = OUTPUT_DIR.resolve("SQL仕様書_" + expected.getKey() + ".xlsx");
      // 各業務 SQL が独立ファイルとして存在し、実データを持つことを確認する。
      require(Files.isRegularFile(workbookPath), "missing workbook: " + workbookPath);
      require(Files.size(workbookPath) > 10_000, "workbook is unexpectedly small: " + workbookPath);
      try (InputStream input = Files.newInputStream(workbookPath);
          Workbook workbook = WorkbookFactory.create(input)) {
        require(workbook.getNumberOfSheets() == demoWorkbook.getNumberOfSheets(),
            "sheet count must match Demo: " + workbookPath);
        Sheet sheet = workbook.getSheetAt(0);
        require(!workbook.isSheetHidden(0), "sheet must be visible: " + workbookPath);
        require(countVisibleSheets(workbook) == 1, "visible sheet count must be 1: " + workbookPath);
        require(!sheet.getSheetName().isBlank(), "sheet name must not be blank: " + workbookPath);
        require(expected.getValue().equals(value(sheet, "F4")), "SQL ID mismatch: " + workbookPath);
        require(expected.getKey().equals(value(sheet, "F5")), "SQL name mismatch: " + workbookPath);
        require(!value(sheet, "B8").isBlank(), "overview must not be blank: " + workbookPath);
        int sqlTypeRow = findLabelRow(sheet, "SQL種別");
        int outputHeaderRow = findLabelRow(sheet, "取得項目（自動生成対象）");
        int parameterHeaderRow = findLabelRow(sheet, "パラメータ項目（自動生成対象）");
        int structureHeaderRow = findLabelRow(sheet, "データ構造");
        int relationTitleRow = findLabelRow(sheet, "①テーブル関連表");
        int extractionTitleRow = findLabelRow(sheet, "②抽出条件");
        int sqlHeaderRow = findLabelRow(sheet, "SQL詳細（自動生成対象）");
        require(!value(sheet, "G" + sqlTypeRow).isBlank(), "SQL type must not be blank: " + workbookPath);
        require(!value(sheet, "C" + (sqlHeaderRow + 2)).isBlank(),
            "SQL detail must not be blank: " + workbookPath);
        int lastSqlRow = findLastSqlRow(sheet, sqlHeaderRow + 2);
        int footerRow = lastSqlRow + 1;
        int endMarkerRow = footerRow + 1;
        require(hasSqlFooter(sheet, footerRow, endMarkerRow),
            "SQL footer line or red E end marker is invalid: " + workbookPath);
        require(matchesDemoFormat(sheet, demoSheet), "Demo format mismatch: " + workbookPath);
        require(outputHeaderRow < parameterHeaderRow && parameterHeaderRow < structureHeaderRow
            && structureHeaderRow < sqlHeaderRow, "section order mismatch: " + workbookPath);
        require(hasSingleLineDataRows(sheet, outputHeaderRow + 4, parameterHeaderRow - 2),
            "output rows must be one item per 15pt row: " + workbookPath);
        require(isRedEndMarker(sheet, "C", parameterHeaderRow - 2),
            "output section red E end marker is invalid: " + workbookPath);
        require(isRedEndMarker(sheet, "C", structureHeaderRow - 2),
            "parameter section red E end marker is invalid: " + workbookPath);
        require(hasOnlyJavaTypes(sheet, outputHeaderRow + 3, parameterHeaderRow - 3, 17)
            && hasOnlyJavaTypes(sheet, parameterHeaderRow + 3, structureHeaderRow - 3, 25),
            "data type must be a concrete Java type: " + workbookPath);
        require(hasStructureGridRows(sheet, relationTitleRow + 2, extractionTitleRow - 1),
            "structure rows must have merged thin-line grids: " + workbookPath);
        require(hasNoFormulas(workbook), "formula must not remain: " + workbookPath);
        require(isCleanPackage(workbookPath), "calcChain or forbidden drawing remains: " + workbookPath);
        require(sheet.getRowBreaks().length == 1 && sheet.getRowBreaks()[0] == sqlHeaderRow - 2,
            "row break must be immediately before SQL detail: " + workbookPath);
        require(workbook.getPrintArea(0).endsWith("$BQ$" + endMarkerRow),
            "print area must end at red E marker row: " + workbookPath);
        // 発行者取得仕様書では、報告された空白項目を名称と英名の両方で保証する。
        if ("CP発行者・法人・格付全量情報取得".equals(expected.getKey())) {
          require(value(sheet, "B8").contains("発行者組織名称"), "issuer organization overview is blank");
          require(containsCellText(sheet, "ogrniNm"), "issuer organization output field is blank");
          require(containsCellText(sheet, "組織名称"), "issuer organization Japanese name is blank");
        }
      }
      System.out.println("verified: " + workbookPath);
      }
    }
    System.out.println("completed: all CPMAB081 SQL specifications are valid");
  }

  /** 期待する業務名称と SQL ID を生成順で保持する。 */
  private static Map<String, String> createExpected() {
    Map<String, String> expected = new LinkedHashMap<>();
    expected.put("格付全量情報削除", "CPMAQDeleteFullRatingInfo");
    expected.put("格付差分会社名取得", "CPMAQSelectNewDiffCompanyName");
    expected.put("格付全量情報更新", "CPMAQUpdateFullRatingInfo");
    expected.put("格付全量情報登録", "CPMAQInsertFullRatingInfo");
    expected.put("アラート情報登録", "CPZZQInsertOneTbFcpalertinfo");
    expected.put("CP発行者・法人・格付全量情報取得", "CPMAQSelectIssuerAndCorpAndFullRatingInfo");
    expected.put("格付情報削除", "CPMAQDeleteRank");
    expected.put("格付情報登録", "CPMAQInsertRank");
    return expected;
  }

  /** 指定座標の表示値を安全に取得する。 */
  private static String value(Sheet sheet, String address) {
    org.apache.poi.ss.util.CellReference reference = new org.apache.poi.ss.util.CellReference(address);
    Row row = sheet.getRow(reference.getRow());
    if (row == null) {
      return "";
    }
    Cell cell = row.getCell(reference.getCol());
    return cell == null ? "" : cell.toString().strip();
  }

  /** 指定位置以降で SQL 本文を持つ最後の行を返す。 */
  private static int findLastSqlRow(Sheet sheet, int startRow) {
    int lastSqlRow = -1;
    // SQL 内部の空行を許容しながら、C 列に本文を持つ最終位置を特定する。
    for (int rowIndex = startRow - 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row != null && row.getCell(2) != null && !row.getCell(2).toString().isBlank()) {
        lastSqlRow = rowIndex + 1;
      }
    }
    require(lastSqlRow >= startRow, "last SQL row not found");
    return lastSqlRow;
  }

  /** SQL 直後の全幅下罫線と、最終赤色 E 行を検証する。 */
  private static boolean hasSqlFooter(Sheet sheet, int footerRowNumber, int endMarkerRowNumber) {
    Row footerRow = sheet.getRow(footerRowNumber - 1);
    Row endMarkerRow = sheet.getRow(endMarkerRowNumber - 1);
    if (footerRow == null || endMarkerRow == null
        || sheet.getLastRowNum() + 1 != endMarkerRowNumber) {
      return false;
    }
    // Demo の SQL 枠と同じ B:BP に下罫線が連続することを確認する。
    for (int column = 1; column <= 67; column++) {
      Cell cell = footerRow.getCell(column);
      if (cell == null || cell.getCellStyle().getBorderBottom() != BorderStyle.THIN) {
        return false;
      }
    }
    // SQL 仕様書の最終行は A 列の赤色枠へ E を置き、その他の値を持たせない。
    if (!isRedEndMarker(sheet, "A", endMarkerRowNumber)) {
      return false;
    }
    for (int column = 1; column <= 68; column++) {
      Cell cell = endMarkerRow.getCell(column);
      if (cell != null && !cell.toString().isBlank()) {
        return false;
      }
    }
    return true;
  }

  /** 指定セルが Demo 共通の赤色 E 終端枠であることを確認する。 */
  private static boolean isRedEndMarker(Sheet sheet, String column, int rowNumber) {
    String address = column + rowNumber;
    org.apache.poi.ss.util.CellReference reference = new org.apache.poi.ss.util.CellReference(address);
    Row row = sheet.getRow(reference.getRow());
    Cell cell = row == null ? null : row.getCell(reference.getCol());
    return cell != null && "E".equals(cell.toString())
        && cell.getCellStyle().getFillPattern() == FillPatternType.SOLID_FOREGROUND;
  }

  /** 取得項目・パラメータの型欄が具体的な Java 型であることを確認する。 */
  private static boolean hasOnlyJavaTypes(Sheet sheet, int startRow, int endRow, int column) {
    for (int rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      Row row = sheet.getRow(rowNumber - 1);
      Cell cell = row == null ? null : row.getCell(column);
      String dataType = cell == null ? "" : cell.toString().strip();
      if (dataType.isBlank()) {
        continue;
      }
      String baseType = dataType.replaceFirst("\\s*\\(.*$", "");
      if (dataType.equals(dataType.toUpperCase()) && FORBIDDEN_NON_JAVA_TYPES.contains(baseType)) {
        return false;
      }
    }
    return true;
  }

  /** Demo と同様に業務 Sheet が一枚だけ表示されていることを確認する。 */
  private static int countVisibleSheets(Workbook workbook) {
    int visible = 0;
    for (int index = 0; index < workbook.getNumberOfSheets(); index++) {
      if (!workbook.isSheetHidden(index) && !workbook.isSheetVeryHidden(index)) {
        visible++;
      }
    }
    return visible;
  }

  /** Demo の静的書式を保ちながら、動的行追加後もページ骨格が成立することを確認する。 */
  private static boolean matchesDemoFormat(Sheet actual, Sheet demo) {
    // 印刷方向は Demo と同じ縦向きを維持する。
    if (actual.getPrintSetup().getLandscape() != demo.getPrintSetup().getLandscape()) {
      return false;
    }
    // 動的に移動する五つの大見出しが Demo の同一 Style を保持する。
    for (String label : new String[] {"SQL種別", "取得項目（自動生成対象）",
        "パラメータ項目（自動生成対象）", "データ構造", "SQL詳細（自動生成対象）"}) {
      Cell actualCell = findLabelCell(actual, label);
      Cell demoCell = findLabelCell(demo, label);
      if (actualCell == null || demoCell == null
          || actualCell.getCellStyle().getIndex() != demoCell.getCellStyle().getIndex()) {
        return false;
      }
    }
    return true;
  }

  /** Sheet 内の指定見出し行を一始まりで取得する。 */
  private static int findLabelRow(Sheet sheet, String label) {
    Cell cell = findLabelCell(sheet, label);
    require(cell != null, "label not found: " + label);
    return cell.getRowIndex() + 1;
  }

  /** Sheet 内から完全一致する見出し Cell を検索する。 */
  private static Cell findLabelCell(Sheet sheet, String label) {
    for (Row row : sheet) {
      for (Cell cell : row) {
        if (label.equals(cell.toString())) {
          return cell;
        }
      }
    }
    return null;
  }

  /** 指定範囲のデータ行が改行を含まず 15pt であることを確認する。 */
  private static boolean hasSingleLineDataRows(Sheet sheet, int startRow, int endRow) {
    for (int rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      Row row = sheet.getRow(rowNumber - 1);
      if (row == null || row.getCell(2) == null || "E".equals(row.getCell(2).toString())) {
        continue;
      }
      if (Math.abs(row.getHeightInPoints() - 15.0f) > 0.01f) {
        return false;
      }
      for (Cell cell : row) {
        if (cell.toString().contains("\n")) {
          return false;
        }
      }
    }
    return true;
  }

  /** データ構造明細の七列組が Merge と thin 外枠を持つことを確認する。 */
  private static boolean hasStructureGridRows(Sheet sheet, int startRow, int endRow) {
    int[][] groups = {{4, 5}, {6, 12}, {13, 18}, {19, 25}, {26, 34}, {35, 45}, {46, 58}};
    for (int rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      Row row = sheet.getRow(rowNumber - 1);
      if (row == null) {
        return false;
      }
      for (int[] group : groups) {
        CellRangeAddress expected = new CellRangeAddress(rowNumber - 1, rowNumber - 1,
            group[0], group[1]);
        boolean merged = sheet.getMergedRegions().stream().anyMatch(expected::equals);
        Cell first = row.getCell(group[0]);
        Cell last = row.getCell(group[1]);
        if (!merged || first == null || last == null
            || first.getCellStyle().getBorderLeft() != BorderStyle.THIN
            || first.getCellStyle().getBorderTop() != BorderStyle.THIN
            || first.getCellStyle().getBorderBottom() != BorderStyle.THIN
            || last.getCellStyle().getBorderRight() != BorderStyle.THIN
            || last.getCellStyle().getBorderTop() != BorderStyle.THIN
            || last.getCellStyle().getBorderBottom() != BorderStyle.THIN) {
          return false;
        }
      }
    }
    return true;
  }

  /** 全 Sheet に数式 Cell が残っていないことを確認する。 */
  private static boolean hasNoFormulas(Workbook workbook) {
    for (Sheet sheet : workbook) {
      for (Row row : sheet) {
        for (Cell cell : row) {
          if (cell.getCellType() == CellType.FORMULA) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /** OOXML 包内に計算鎖、禁止 Drawing、禁止注記文字がないことを確認する。 */
  private static boolean isCleanPackage(Path workbookPath) throws Exception {
    try (ZipFile zip = new ZipFile(workbookPath.toFile())) {
      if (zip.getEntry("xl/calcChain.xml") != null || zip.getEntry("xl/drawings/drawing1.xml") != null) {
        return false;
      }
      var entries = zip.entries();
      while (entries.hasMoreElements()) {
        var entry = entries.nextElement();
        if (!entry.getName().endsWith(".xml") && !entry.getName().endsWith(".rels")) {
          continue;
        }
        String text;
        try (InputStream input = zip.getInputStream(entry)) {
          text = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        if (text.contains("calcChain") || text.contains("固定文字列として変換対象とする。")
            || text.contains("動的SQLパターン1") || text.contains("prstDash val=\"dashDot\"")) {
          return false;
        }
      }
      return true;
    }
  }

  /** Sheet 内のいずれかの Cell が指定業務文字列を含むことを確認する。 */
  private static boolean containsCellText(Sheet sheet, String expectedText) {
    for (Row row : sheet) {
      for (Cell cell : row) {
        if (cell.toString().contains(expectedText)) {
          return true;
        }
      }
    }
    return false;
  }

  /** 業務検証条件を満たさない場合に即時停止する。 */
  private static void require(boolean condition, String message) {
    if (!condition) {
      throw new IllegalStateException(message);
    }
  }
}
