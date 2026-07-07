package com.sp.selplat.common.fujitsu;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;

/**
  - 如果想默认只跑 10 个，直接把这一行改成 private static final Integer DEFAULT_BATCH_LIMIT = 10;。
  - 名单文件名常量：/abs/path/C:/opt/workspace/SELPLAT/shared/backend/common-core/src/main/java/com/sp/selplat/common/
    fujitsu/GenericSqlSpecDocCorrector.java:63

  - 批量落名单：/abs/path/C:/opt/workspace/SELPLAT/shared/backend/common-core/src/main/java/com/sp/selplat/common/
    fujitsu/GenericSqlSpecDocCorrector.java:196

  - 写名单内容：/abs/path/C:/opt/workspace/SELPLAT/shared/backend/common-core/src/main/java/com/sp/selplat/common/
    fujitsu/GenericSqlSpecDocCorrector.java:633

    如果文档判定无需修正，会直接不生成 OPTION\fujitsu\GenericSqlSpecDocCorrector\out 文件
 * 通用 SQL 仕様書修正工具。
 *
 * <p>业务上本工具用于把 Mapper XML 和 Bean 里的权威定义回写到 Excel 仕様書中，并且只把差异内容标红。
 * 当前版本默认支持一键批量扫描 `OPTION/fujitsu/GenericSqlSpecDocCorrector/doc/SB|CP|IT`，也支持通过命令行参数传入单个 SQLID、工作簿、
 * 页签、Mapper 与 Bean 路径执行定向修正。
 */
public class GenericSqlSpecDocCorrector {

  /** 业务上统一使用 UTF-8 文本读写，避免中文路径和日文规格书名出现乱码。 */
  private static final java.nio.charset.Charset UTF_8 = StandardCharsets.UTF_8;

  /** 业务上差异内容统一用红字标记，便于审核人员快速定位修正点。 */
  private static final byte[] RED_RGB = new byte[] {(byte) 0xFF, 0x00, 0x00};

  /** 业务上 Excel 文本读取统一通过格式化器处理，减少公式和数值单元格的兼容分支。 */
  private static final DataFormatter DATA_FORMATTER = new DataFormatter();

  /** 业务上默认项目根目录优先自动识别当前工程，便于在 VS Code 里直接点击 main 运行。 */
  private static final Path DEFAULT_PROJECT_ROOT = detectProjectRoot();

  /** 业务上这里集中维护 main 默认使用的工程根目录，后续机器路径变更时优先改这一行。 */
  private static final Path MANUAL_PROJECT_ROOT = Paths.get("C:\\opt\\workspace\\SELPLAT").toAbsolutePath().normalize();

  /** 业务上这里集中维护规格书根目录，批量模式默认从工具目录下这个文件夹扫描 SB/CP/IT 三类文档。 */
  private static final Path MANUAL_DOC_ROOT = Paths.get("C:\\opt\\workspace\\SELPLAT\\OPTION\\fujitsu\\GenericSqlSpecDocCorrector\\doc").toAbsolutePath().normalize();

  /** 业务上这里集中维护工具专属文件目录，Mapper、名单和工具副本统一归档到这个文件夹。 */
  private static final Path MANUAL_TOOL_ROOT = Paths.get("C:\\opt\\workspace\\SELPLAT\\OPTION\\fujitsu\\GenericSqlSpecDocCorrector").toAbsolutePath().normalize();

  /** 业务上这里集中维护修正结果输出目录，批量修正后的规格书和报告默认都落到工具目录下这个文件夹。 */
  private static final Path MANUAL_OUT_ROOT = Paths.get("C:\\opt\\workspace\\SELPLAT\\OPTION\\fujitsu\\GenericSqlSpecDocCorrector\\out").toAbsolutePath().normalize();

  /** 业务上这里集中维护规格书修正规则参照用的 SB Mapper 文件全路径。 */
  private static final Path MANUAL_SB_MAPPER_PATH = Paths.get("C:\\opt\\bat\\SBMACOMMON\\src\\main\\resources\\mapper\\SBMAMapper.xml").toAbsolutePath().normalize();

  /** 业务上这里集中维护规格书修正规则参照用的 CP Mapper 文件全路径。 */
  private static final Path MANUAL_CP_MAPPER_PATH = Paths.get("C:\\opt\\bat\\CPMACOMMON\\src\\main\\resources\\mapper\\CPMAMapper.xml").toAbsolutePath().normalize();

  /** 业务上这里集中维护规格书修正规则参照用的 IT Mapper 文件全路径。 */
  private static final Path MANUAL_IT_MAPPER_PATH = Paths.get("C:\\opt\\bat\\ITMACOMMON\\src\\main\\resources\\mapper\\ITMAMapper.xml").toAbsolutePath().normalize();

  /** 业务上这里集中维护 SB 业务对应的 OutDataBean 文件夹路径，便于后续整目录替换。 */
  private static final Path MANUAL_SB_BEAN_ROOT = Paths.get("C:\\opt\\bat\\SBMACOMMON\\src\\main\\java\\jp\\or\\jasdec\\sbf\\sb\\ma\\parts\\bean\\db").toAbsolutePath().normalize();

  /** 业务上这里集中维护 CP 业务对应的 OutDataBean 文件夹路径，便于后续整目录替换。 */
  private static final Path MANUAL_CP_BEAN_ROOT = Paths.get("C:\\opt\\bat\\CPMACOMMON\\src\\main\\java\\jp\\or\\jasdec\\sbf\\cp\\ma\\parts\\bean\\db").toAbsolutePath().normalize();

  /** 业务上这里集中维护 IT 业务对应的 OutDataBean 文件夹路径，便于后续整目录替换。 */
  private static final Path MANUAL_IT_BEAN_ROOT = Paths.get("C:\\opt\\bat\\ITMACOMMON\\src\\main\\java\\jp\\or\\jasdec\\sbf\\it\\ma\\parts\\bean\\db").toAbsolutePath().normalize();

  /** 业务上这里集中维护 main 无参数单任务样例的规格书文件全路径，方便直接手工替换工具目录下的目标文档。 */
  private static final Path MANUAL_DEFAULT_WORKBOOK_PATH = Paths.get("C:\\opt\\workspace\\SELPLAT\\OPTION\\fujitsu\\GenericSqlSpecDocCorrector\\doc\\SB\\SQL仕様書_SB代理人設定済みチェック2-3取得.xlsx").toAbsolutePath().normalize();

  /** 业务上这里是源码内可直接调整的批量默认上限，改成 10 就只跑 10 个，设为 null 就全量执行。 */
  private static final Integer DEFAULT_BATCH_LIMIT = null;

  /** 业务上未发生实际修正的规格书统一登记到工具专属目录，避免继续散落在 OPTION 根目录。 */
  private static final String UNCHANGED_LIST_FILE_NAME = "未修正名单.md";

  /**
   * 主入口。
   *
   * <p>业务上无参数时直接执行内置样例，便于你双击或直接 main 运行验证；有参数时按参数覆盖默认配置。
   *
   * @param args 命令行参数。
   * @throws Exception 编译期外的读取、修正或写出失败时抛出。
   */
  public static void main(String[] args) throws Exception {
    // 业务上统一先把参数拆成键值表，后续单任务和批量任务都复用同一套解析结果。
    Map<String, String> overrides = parseArgs(args);
    // 业务上把 main 默认路径全部集中回写到参数覆盖表，后续改路径时只需要改上面的常量，不用再追踪方法内部拼接逻辑。
    applyManualDefaultPathOverrides(overrides);
    // 业务上默认批量上限直接写在源码里，VS Code 点 main 时不用额外传参数；显式传了 --limit 仍以外部参数为准。
    if (!overrides.containsKey("limit") && DEFAULT_BATCH_LIMIT != null) {
      overrides.put("limit", String.valueOf(DEFAULT_BATCH_LIMIT));
    }
    // 业务上显式指定 SQLID/规格书时继续走单任务模式，避免批量模式误扩大执行范围。
    if (isSingleTaskMode(overrides)) {
      CorrectionTask task = buildTaskFromOverrides(overrides);
      CorrectionResult result = executeTask(task);
      printSingleResult(result);
      return;
    }
    // 业务上没有显式指定目标时，默认进入一键批量模式，扫描 SB/CP/IT 目录执行全部规格书。
    BatchRunResult batchRunResult = executeBatch(overrides);
    printBatchResult(batchRunResult);
  }

  /**
   * 根据命令行参数构建修正任务。
   *
   * <p>业务上参数是为了让同一个工具在 SB、CP、IT 三套文档之间复用，而不是每次再复制一份专用 Java。
   *
   * @param args 命令行参数。
   * @return 修正任务配置。
   */
  private static CorrectionTask buildTaskFromArgs(String[] args) {
    return buildTaskFromOverrides(parseArgs(args));
  }

  /**
   * 根据参数覆盖构建单任务配置。
   *
   * <p>业务上单任务构建逻辑单独抽出来，是为了让批量模式也能复用相同默认值和参数口径。
   *
   * @param overrides 参数覆盖表。
   * @return 单任务配置。
   */
  private static CorrectionTask buildTaskFromOverrides(Map<String, String> overrides) {
    RuntimePaths runtimePaths = resolveRuntimePaths(overrides);
    // 业务上先准备一份可直接运行的样例配置，保证用户第一次执行就能看到修正结果。
    CorrectionTask defaultTask = new CorrectionTask(
        "SBMAQSelectAgentCompleteCheckTwoAndThree203",
        runtimePaths.defaultWorkbookPath(),
        "SB代理人設定済みチェック2-3取得 ",
        resolveMapperPath("SB", runtimePaths),
        resolveOptionalBeanPath("SB", "SBMAQSelectAgentCompleteCheckTwoAndThree203", runtimePaths),
        runtimePaths.outRoot(),
        26,
        4,
        17,
        26,
        34,
        2,
        0,
        1,
        true);
    return new CorrectionTask(
        valueOrDefault(overrides, "sqlId", defaultTask.sqlId()),
        Paths.get(valueOrDefault(overrides, "workbook", defaultTask.workbookPath().toString())),
        valueOrDefault(overrides, "sheet", defaultTask.sheetName()),
        Paths.get(valueOrDefault(overrides, "mapper", defaultTask.mapperPath().toString())),
        resolveTaskBeanPath(overrides, defaultTask, runtimePaths),
        Paths.get(valueOrDefault(overrides, "outRoot", defaultTask.outputRootPath().toString())),
        parseIntOrDefault(overrides, "outputStartRow", defaultTask.outputItemStartRowIndex()),
        parseIntOrDefault(overrides, "outputNameCol", defaultTask.outputNameColumnIndex()),
        parseIntOrDefault(overrides, "outputTypeCol", defaultTask.outputTypeColumnIndex()),
        parseIntOrDefault(overrides, "outputSourceCol", defaultTask.outputSourceColumnIndex()),
        parseIntOrDefault(overrides, "outputNoteCol", defaultTask.outputNoteColumnIndex()),
        parseIntOrDefault(overrides, "sqlCol", defaultTask.sqlColumnIndex()),
        parseIntOrDefault(overrides, "endMarkerCol", defaultTask.endMarkerColumnIndex()),
        parseIntOrDefault(overrides, "sectionTitleCol", defaultTask.sectionTitleColumnIndex()),
        parseBooleanOrDefault(overrides, "fixOutputItems", defaultTask.fixOutputItems()));
  }

  /**
   * 判断是否应走单任务模式。
   *
   * <p>业务上只要用户显式指定了关键任务边界，就按单任务执行，避免一键模式覆盖到不想处理的规格书。
   *
   * @param overrides 参数覆盖表。
   * @return 是否单任务模式。
   */
  private static boolean isSingleTaskMode(Map<String, String> overrides) {
    return overrides.containsKey("sqlId")
        || overrides.containsKey("workbook")
        || overrides.containsKey("sheet")
        || overrides.containsKey("mapper")
        || overrides.containsKey("bean");
  }

  /**
   * 执行批量修正。
   *
   * <p>业务上批量模式负责扫描规格书、发现对应 SQLID 和 Bean，再逐个复用单任务修正逻辑执行。
   *
   * @param overrides 参数覆盖表。
   * @return 批量执行结果。
   */
  private static BatchRunResult executeBatch(Map<String, String> overrides) {
    RuntimePaths runtimePaths = resolveRuntimePaths(overrides);
    Path docRoot = runtimePaths.docRoot();
    Path outRoot = runtimePaths.outRoot();
    int limit = resolveBatchLimit(overrides);
    boolean fixOutputItems = parseBooleanOrDefault(overrides, "fixOutputItems", true);
    List<CorrectionTask> tasks = discoverBatchTasks(docRoot, outRoot, fixOutputItems, limit, runtimePaths);
    List<CorrectionResult> modifiedResults = new ArrayList<>();
    List<CorrectionResult> unchangedResults = new ArrayList<>();
    List<String> failureMessages = new ArrayList<>();
    for (CorrectionTask task : tasks) {
      try {
        CorrectionResult correctionResult = executeTask(task);
        if (correctionResult.modified()) {
          modifiedResults.add(correctionResult);
        } else {
          unchangedResults.add(correctionResult);
        }
      } catch (Exception exception) {
        // 业务上单个规格书失败不能中断整批任务，失败原因要收集到汇总里便于后续逐个排查。
        failureMessages.add(task.workbookPath() + " -> " + exception.getMessage());
      }
    }
    // 业务上未修正名单跟工具参照文件放在同一目录，方便迁目录后仍能一处查看全部工具资料。
    Path unchangedListPath = runtimePaths.toolRoot().resolve(UNCHANGED_LIST_FILE_NAME);
    writeUnchangedList(unchangedListPath, unchangedResults, failureMessages);
    return new BatchRunResult(docRoot, outRoot, limit, tasks.size(), modifiedResults, unchangedResults, failureMessages, unchangedListPath);
  }

  /**
   * 发现批量任务列表。
   *
   * <p>业务上批量执行只扫描 `OPTION/fujitsu/GenericSqlSpecDocCorrector/doc/SB|CP|IT` 三类目录，并从规格书内部提取 SQLID 与首个页签名。
   *
   * @param docRoot 规格书根目录。
   * @param outRoot 输出根目录。
   * @param fixOutputItems 是否修正取得項目。
   * @param limit 最大任务数。
   * @return 待执行任务列表。
   */
  private static List<CorrectionTask> discoverBatchTasks(Path docRoot, Path outRoot, boolean fixOutputItems, int limit, RuntimePaths runtimePaths) {
    List<CorrectionTask> tasks = new ArrayList<>();
    for (String prefix : List.of("SB", "CP", "IT")) {
      Path prefixDir = docRoot.resolve(prefix);
      if (!Files.isDirectory(prefixDir)) {
        continue;
      }
      List<Path> workbookPaths = listWorkbookPaths(prefixDir);
      for (Path workbookPath : workbookPaths) {
        if (tasks.size() >= limit) {
          return tasks;
        }
        try {
          WorkbookDiscovery workbookDiscovery = discoverWorkbookMetadata(workbookPath, prefix);
          Path beanPath = resolveOptionalBeanPath(prefix, workbookDiscovery.sqlId(), runtimePaths);
          tasks.add(new CorrectionTask(
              workbookDiscovery.sqlId(),
              workbookPath,
              workbookDiscovery.sheetName(),
              resolveMapperPath(prefix, runtimePaths),
              beanPath,
              outRoot,
              26,
              4,
              17,
              26,
              34,
              2,
              0,
              1,
              fixOutputItems && beanPath != null));
        } catch (Exception exception) {
          // 业务上发现阶段如果某个规格书元数据不完整，先跳过并在控制台提示，不阻断其他规格书进入批处理。
          System.out.println("skipWorkbook=" + workbookPath);
          System.out.println("skipReason=" + exception.getMessage());
        }
      }
    }
    return tasks;
  }

  /**
   * 列出目录下的规格书文件。
   *
   * <p>业务上批量执行顺序要稳定，因此这里按文件名排序，确保“前 10 个”每次是一致的。
   *
   * @param prefixDir 分类目录。
   * @return 排序后的规格书路径列表。
   */
  private static List<Path> listWorkbookPaths(Path prefixDir) {
    try {
      try (var pathStream = Files.list(prefixDir)) {
        return pathStream
            .filter(path -> Files.isRegularFile(path) && path.getFileName().toString().toLowerCase().endsWith(".xlsx"))
            .sorted(Comparator.comparing(path -> path.getFileName().toString()))
            .toList();
      }
    } catch (IOException exception) {
      throw new IllegalStateException("cannot list workbooks: " + prefixDir, exception);
    }
  }

  /**
   * 从规格书内部发现 SQLID 与页签名。
   *
   * <p>业务上规格书自身已经包含 SQLID 和页签信息，因此批量模式不要求用户再逐个手填。
   *
   * @param workbookPath 规格书路径。
   * @param expectedPrefix 预期前缀。
   * @return 规格书元数据。
   */
  private static WorkbookDiscovery discoverWorkbookMetadata(Path workbookPath, String expectedPrefix) {
    // 业务上只认首个规格书页签里实际展示给人的单元格内容，避免 sharedStrings 等压缩包残留字符串污染 SQLID 识别。
    Pattern sqlPattern = Pattern.compile("\\b(?:" + Pattern.quote(expectedPrefix) + "|cp)MAQ[A-Za-z0-9]+\\b");
    try (InputStream inputStream = Files.newInputStream(workbookPath);
         Workbook workbook = WorkbookFactory.create(inputStream)) {
      // 业务上批量修正当前统一以首个页签为规格书正文页，因此 SQLID 也从这里提取。
      Sheet firstSheet = workbook.getSheetAt(0);
      // 业务上优先读取“SQLID”标签附近的值，避免正文说明里偶然出现的其他 SQLID 字样干扰主 SQLID 判定。
      Set<String> labeledSqlIds = findSqlIdsNearLabel(firstSheet, sqlPattern);
      if (labeledSqlIds.size() == 1) {
        return new WorkbookDiscovery(labeledSqlIds.iterator().next(), firstSheet.getSheetName());
      }
      // 业务上如果找不到明确标签，再退回到整张正文页可见单元格扫描，而不是扫描整个 xlsx 压缩包。
      Set<String> sheetSqlIds = findSqlIdsInSheet(firstSheet, sqlPattern);
      if (sheetSqlIds.size() != 1) {
        throw new IllegalStateException("cannot resolve unique sqlId, found=" + sheetSqlIds);
      }
      return new WorkbookDiscovery(sheetSqlIds.iterator().next(), firstSheet.getSheetName());
    } catch (IOException exception) {
      throw new IllegalStateException("cannot read workbook metadata: " + workbookPath, exception);
    }
  }

  /**
   * 读取首个页签名。
   *
   * <p>业务上当前复制过来的规格书都以首个页签为目标页，因此批量模式先统一读取第一个页签名。
   *
   * @param workbookPath 规格书路径。
   * @return 首个页签名。
   */
  private static String readFirstSheetName(Path workbookPath) {
    try (InputStream inputStream = Files.newInputStream(workbookPath);
         Workbook workbook = WorkbookFactory.create(inputStream)) {
      return workbook.getSheetAt(0).getSheetName();
    } catch (IOException exception) {
      throw new IllegalStateException("cannot read sheet name: " + workbookPath, exception);
    }
  }

  /**
   * 归一化 SQLID 大小写。
   *
   * <p>业务上 `CP` 文档里存在 `cpmaQ...` 这种大小写混写情况，回写前统一矫正成 `CPMAQ...` 口径。
   *
   * @param rawSqlId 原始 SQLID。
   * @return 归一化后的 SQLID。
   */
  private static String normalizeSqlIdCase(String rawSqlId) {
    if (rawSqlId.startsWith("cp")) {
      return "CP" + rawSqlId.substring(2);
    }
    return rawSqlId;
  }

  /**
   * 从首个页签中提取所有可见 SQLID。
   *
   * <p>业务上这里只扫描实际单元格文本，不扫描压缩包 XML，从而规避 sharedStrings 残留值造成的误命中。
   *
   * @param sheet 规格书正文页。
   * @param sqlPattern SQLID 正则。
   * @return 页签中出现的 SQLID 集合。
   */
  private static Set<String> findSqlIdsInSheet(Sheet sheet, Pattern sqlPattern) {
    Set<String> sqlIds = new LinkedHashSet<>();
    for (Row row : sheet) {
      for (Cell cell : row) {
        // 业务上统一通过格式化文本读取单元格，让字符串、数字和公式结果都走同一套匹配规则。
        collectSqlIdsFromText(sqlIds, DATA_FORMATTER.formatCellValue(cell), sqlPattern);
      }
    }
    return sqlIds;
  }

  /**
   * 优先从 SQLID 标签附近提取 SQLID。
   *
   * <p>业务上规格书通常会在表头附近单独标注 SQLID，这个值的可信度高于正文说明中的引用文字。
   *
   * @param sheet 规格书正文页。
   * @param sqlPattern SQLID 正则。
   * @return SQLID 标签附近提取到的 SQLID 集合。
   */
  private static Set<String> findSqlIdsNearLabel(Sheet sheet, Pattern sqlPattern) {
    Set<String> sqlIds = new LinkedHashSet<>();
    for (Row row : sheet) {
      for (Cell cell : row) {
        String cellText = DATA_FORMATTER.formatCellValue(cell);
        if (!containsSqlIdLabel(cellText)) {
          continue;
        }
        // 业务上优先检查同一行相邻单元格，因为规格书里的 SQLID 大多跟在“SQLID”标题右侧。
        for (int columnOffset = 0; columnOffset <= 3; columnOffset++) {
          Cell neighborCell = row.getCell(cell.getColumnIndex() + columnOffset);
          if (neighborCell == null) {
            continue;
          }
          collectSqlIdsFromText(sqlIds, DATA_FORMATTER.formatCellValue(neighborCell), sqlPattern);
        }
        // 业务上有些规格书会把 SQLID 放到下一行对应列，这里补一层纵向检查，避免漏掉唯一有效值。
        Row nextRow = sheet.getRow(row.getRowNum() + 1);
        if (nextRow != null) {
          for (int columnOffset = 0; columnOffset <= 1; columnOffset++) {
            Cell belowCell = nextRow.getCell(cell.getColumnIndex() + columnOffset);
            if (belowCell == null) {
              continue;
            }
            collectSqlIdsFromText(sqlIds, DATA_FORMATTER.formatCellValue(belowCell), sqlPattern);
          }
        }
      }
    }
    return sqlIds;
  }

  /**
   * 判断单元格文本是否为 SQLID 标签。
   *
   * <p>业务上规格书里常见的标签写法集中在 SQLID / SQL ID，因此这里只识别这类标题，不把普通说明文字当作标签。
   *
   * @param cellText 单元格文本。
   * @return 是否 SQLID 标签。
   */
  private static boolean containsSqlIdLabel(String cellText) {
    String normalizedText = cellText == null ? "" : cellText.replaceAll("\\s+", "").toUpperCase();
    return normalizedText.contains("SQLID");
  }

  /**
   * 从一段文本中收集 SQLID。
   *
   * <p>业务上同一个单元格里可能既有标题又有值，因此这里按正则逐个匹配并统一归一化大小写。
   *
   * @param sqlIds 累积 SQLID 集合。
   * @param text 待扫描文本。
   * @param sqlPattern SQLID 正则。
   */
  private static void collectSqlIdsFromText(Set<String> sqlIds, String text, Pattern sqlPattern) {
    Matcher sqlMatcher = sqlPattern.matcher(text == null ? "" : text);
    while (sqlMatcher.find()) {
      sqlIds.add(normalizeSqlIdCase(sqlMatcher.group()));
    }
  }

  /**
   * 自动识别当前工程根目录。
   *
   * <p>业务上 VS Code 直接点 main 时未必会手工传参数，因此这里从当前工作目录向上查找 `OPTION/fujitsu/GenericSqlSpecDocCorrector/doc` 与
   * `OPTION/fujitsu/GenericSqlSpecDocCorrector/SBMAMapper.xml`，找到后就把该目录视为工程根。
   *
   * @return 自动识别出的工程根目录。
   */
  private static Path detectProjectRoot() {
    Path currentPath = Paths.get("").toAbsolutePath().normalize();
    Path probePath = currentPath;
    while (probePath != null) {
      // 业务上工程根识别要同时命中工具目录里的规格书目录和 Mapper，避免 doc/out 迁移后仍按旧位置误判失败。
      if (Files.isDirectory(probePath.resolve("OPTION").resolve("fujitsu").resolve("GenericSqlSpecDocCorrector").resolve("doc"))
          && Files.exists(probePath.resolve("OPTION").resolve("fujitsu").resolve("GenericSqlSpecDocCorrector").resolve("SBMAMapper.xml"))) {
        return probePath;
      }
      probePath = probePath.getParent();
    }
    // 业务上如果自动识别失败，最后回退到当前工作目录，便于调用方从异常信息继续定位。
    return currentPath;
  }

  /**
   * 解析运行时目录。
   *
   * <p>业务上把工程根、规格书根、工具专属目录、输出根、Mapper 路径和三套 Bean 根全部集中到这里，避免 Java 源码里散落绝对路径。
   *
   * @param overrides 参数覆盖表。
   * @return 运行时目录集合。
   */
  private static RuntimePaths resolveRuntimePaths(Map<String, String> overrides) {
    // 业务上项目根仍保留自动识别兜底，但 main 默认会优先用上方手工常量，方便直接替换本机路径。
    Path projectRoot = Paths.get(valueOrDefault(overrides, "projectRoot", DEFAULT_PROJECT_ROOT.toString())).toAbsolutePath().normalize();
    // 业务上规格书目录允许通过一个独立变量直改，避免路径变更时再跟着工程根级联推导。
    Path docRoot = Paths.get(valueOrDefault(overrides, "docRoot", MANUAL_DOC_ROOT.toString())).toAbsolutePath().normalize();
    // 业务上工具目录单独显式暴露，后续若整体迁移 GenericSqlSpecDocCorrector 资料，只改这一项即可同步名单和参照文件。
    Path toolRoot = Paths.get(valueOrDefault(overrides, "toolRoot", MANUAL_TOOL_ROOT.toString())).toAbsolutePath().normalize();
    // 业务上输出目录同样拆成独立变量，便于把结果直接导到指定文件夹。
    Path outRoot = Paths.get(valueOrDefault(overrides, "outRoot", MANUAL_OUT_ROOT.toString())).toAbsolutePath().normalize();
    // 业务上三套 Mapper 都改成文件全路径变量，后续替换单个 Mapper 时不必再先算根目录。
    Path sbMapperPath = Paths.get(valueOrDefault(overrides, "sbMapper", MANUAL_SB_MAPPER_PATH.toString())).toAbsolutePath().normalize();
    Path cpMapperPath = Paths.get(valueOrDefault(overrides, "cpMapper", MANUAL_CP_MAPPER_PATH.toString())).toAbsolutePath().normalize();
    Path itMapperPath = Paths.get(valueOrDefault(overrides, "itMapper", MANUAL_IT_MAPPER_PATH.toString())).toAbsolutePath().normalize();
    // 业务上 Bean 目录继续按业务分类拆分成独立目录变量，路径迁移时可以单独替换某一套业务。
    Path sbBeanRoot = Paths.get(valueOrDefault(overrides, "sbBeanRoot", MANUAL_SB_BEAN_ROOT.toString())).toAbsolutePath().normalize();
    Path cpBeanRoot = Paths.get(valueOrDefault(overrides, "cpBeanRoot", MANUAL_CP_BEAN_ROOT.toString())).toAbsolutePath().normalize();
    Path itBeanRoot = Paths.get(valueOrDefault(overrides, "itBeanRoot", MANUAL_IT_BEAN_ROOT.toString())).toAbsolutePath().normalize();
    // 业务上默认单任务样例文档单独维护成文件全路径变量，方便 main 直接替换到指定仕様書。
    Path defaultWorkbookPath = Paths.get(valueOrDefault(overrides, "defaultWorkbook", MANUAL_DEFAULT_WORKBOOK_PATH.toString())).toAbsolutePath().normalize();
    return new RuntimePaths(projectRoot, docRoot, toolRoot, outRoot, sbMapperPath, cpMapperPath, itMapperPath, sbBeanRoot, cpBeanRoot, itBeanRoot, defaultWorkbookPath);
  }

  /**
   * 回填 main 默认路径覆盖项。
   *
   * <p>业务上这里专门把“手工替换区”常量同步到运行参数，确保无参数直接运行时也能命中你手工写死的路径。
   *
   * @param overrides 参数覆盖表。
   */
  private static void applyManualDefaultPathOverrides(Map<String, String> overrides) {
    // 业务上只有调用方没显式传值时才回填默认路径，避免覆盖命令行定向执行的真实目标。
    putIfAbsent(overrides, "projectRoot", MANUAL_PROJECT_ROOT.toString());
    putIfAbsent(overrides, "docRoot", MANUAL_DOC_ROOT.toString());
    putIfAbsent(overrides, "toolRoot", MANUAL_TOOL_ROOT.toString());
    putIfAbsent(overrides, "outRoot", MANUAL_OUT_ROOT.toString());
    putIfAbsent(overrides, "sbMapper", MANUAL_SB_MAPPER_PATH.toString());
    putIfAbsent(overrides, "cpMapper", MANUAL_CP_MAPPER_PATH.toString());
    putIfAbsent(overrides, "itMapper", MANUAL_IT_MAPPER_PATH.toString());
    putIfAbsent(overrides, "sbBeanRoot", MANUAL_SB_BEAN_ROOT.toString());
    putIfAbsent(overrides, "cpBeanRoot", MANUAL_CP_BEAN_ROOT.toString());
    putIfAbsent(overrides, "itBeanRoot", MANUAL_IT_BEAN_ROOT.toString());
    putIfAbsent(overrides, "defaultWorkbook", MANUAL_DEFAULT_WORKBOOK_PATH.toString());
  }

  /**
   * 仅在调用方未传值时写入默认参数。
   *
   * <p>业务上统一复用这一层判断，避免每个默认路径都重复写 `containsKey` 分支。
   *
   * @param overrides 参数覆盖表。
   * @param key 参数键。
   * @param value 默认值。
   */
  private static void putIfAbsent(Map<String, String> overrides, String key, String value) {
    // 业务上命令行显式传了空串也应视为调用方已介入，这里只在完全缺键时补默认值。
    if (!overrides.containsKey(key)) {
      overrides.put(key, value);
    }
  }

  /**
   * 解析单任务模式下的 Bean 路径。
   *
   * <p>业务上单任务如果显式传了 `--bean` 就直接使用；没传但给了 SQLID 时，则按前缀和 SQLID 自动推导。
   *
   * @param overrides 参数覆盖表。
   * @param defaultTask 默认任务。
   * @param runtimePaths 运行时目录。
   * @return Bean 路径，若无对应 OutDataBean 则返回 `null`。
   */
  private static Path resolveTaskBeanPath(Map<String, String> overrides, CorrectionTask defaultTask, RuntimePaths runtimePaths) {
    if (overrides.containsKey("bean")) {
      String beanValue = overrides.get("bean");
      return beanValue == null || beanValue.isBlank() ? null : Paths.get(beanValue);
    }
    String sqlId = valueOrDefault(overrides, "sqlId", defaultTask.sqlId());
    if (sqlId == null || sqlId.isBlank()) {
      return defaultTask.beanPath();
    }
    return resolveOptionalBeanPath(resolvePrefix(normalizeSqlIdCase(sqlId)), normalizeSqlIdCase(sqlId), runtimePaths);
  }

  /**
   * 解析前缀对应的 Mapper 路径。
   *
   * <p>业务上 SB、CP、IT 三类规格书都各自只允许参照对应的 Mapper XML。
   *
   * @param prefix 分类前缀。
   * @return Mapper 路径。
   */
  private static Path resolveMapperPath(String prefix, RuntimePaths runtimePaths) {
    return switch (prefix) {
      case "SB" -> runtimePaths.sbMapperPath();
      case "CP" -> runtimePaths.cpMapperPath();
      case "IT" -> runtimePaths.itMapperPath();
      default -> throw new IllegalArgumentException("unsupported prefix: " + prefix);
    };
  }

  /**
   * 解析前缀与 SQLID 对应的 OutDataBean 路径。
   *
   * <p>业务上当前批量修正只按 `SQLID + OutDataBean.java` 定位输出 Bean，避免人工逐个指定。
   *
   * @param prefix 分类前缀。
   * @param sqlId SQLID。
   * @return OutDataBean 路径。
   */
  private static Path resolveOptionalBeanPath(String prefix, String sqlId, RuntimePaths runtimePaths) {
    Path beanRoot = switch (prefix) {
      case "SB" -> runtimePaths.sbBeanRoot();
      case "CP" -> runtimePaths.cpBeanRoot();
      case "IT" -> runtimePaths.itBeanRoot();
      default -> throw new IllegalArgumentException("unsupported prefix: " + prefix);
    };
    Path beanPath = beanRoot.resolve(sqlId + "OutDataBean.java");
    // 业务上 delete / insert / update 一类 SQL 可能不存在 OutDataBean，此时允许只修 SQL 区块。
    return Files.exists(beanPath) ? beanPath : null;
  }

  /**
   * 输出单任务结果。
   *
   * <p>业务上单任务模式继续沿用原有明细回显格式，方便直接看某一份规格书的成果物路径。
   *
   * @param result 单任务结果。
   */
  private static void printSingleResult(CorrectionResult result) {
    System.out.println("sqlId=" + result.task().sqlId());
    System.out.println("modified=" + result.modified());
    System.out.println("outputWorkbook=" + result.outputWorkbookPath());
    System.out.println("outputReport=" + result.reportPath());
    System.out.println("changedOutputFields=" + result.changedOutputFieldCount());
    System.out.println("changedSqlLines=" + result.changedSqlLineCount());
    if (!result.modified()) {
      System.out.println("unchangedReason=当前规格书与 Mapper/Bean 一致，未输出修正文件。");
    }
  }

  /**
   * 输出批量结果。
   *
   * <p>业务上批量模式要优先给出成功/失败总数，再列出每份规格书的关键结果，便于快速抽样核对。
   *
   * @param batchRunResult 批量结果。
   */
  private static void printBatchResult(BatchRunResult batchRunResult) {
    System.out.println("batchDocRoot=" + batchRunResult.docRoot());
    System.out.println("batchOutRoot=" + batchRunResult.outRoot());
    System.out.println("batchLimit=" + (batchRunResult.limit() == Integer.MAX_VALUE ? "ALL" : batchRunResult.limit()));
    System.out.println("discoveredTaskCount=" + batchRunResult.discoveredTaskCount());
    System.out.println("successCount=" + batchRunResult.modifiedResults().size());
    System.out.println("unchangedCount=" + batchRunResult.unchangedResults().size());
    System.out.println("failureCount=" + batchRunResult.failureMessages().size());
    System.out.println("unchangedList=" + batchRunResult.unchangedListPath());
    for (CorrectionResult successResult : batchRunResult.modifiedResults()) {
      System.out.println("successSqlId=" + successResult.task().sqlId());
      System.out.println("successWorkbook=" + successResult.outputWorkbookPath());
      System.out.println("successChangedOutputFields=" + successResult.changedOutputFieldCount());
      System.out.println("successChangedSqlLines=" + successResult.changedSqlLineCount());
    }
    for (CorrectionResult unchangedResult : batchRunResult.unchangedResults()) {
      System.out.println("unchangedSqlId=" + unchangedResult.task().sqlId());
      System.out.println("unchangedWorkbook=" + unchangedResult.task().workbookPath());
    }
    for (String failureMessage : batchRunResult.failureMessages()) {
      System.out.println("failure=" + failureMessage);
    }
  }

  /**
   * 执行一条修正任务。
   *
   * <p>业务上同一任务里要同时完成 SQL 詳細修正、取得項目修正、差异报告输出和成品文件落盘。
   *
   * @param task 修正任务配置。
   * @return 修正结果。
   * @throws Exception 读取或写出失败时抛出。
   */
  private static CorrectionResult executeTask(CorrectionTask task) throws Exception {
    // 业务上先校验输入存在，避免执行到一半才发现文档或参照源路径错误。
    ensureExists(task.workbookPath(), "规格书不存在");
    ensureExists(task.mapperPath(), "Mapper 不存在");
    if (task.fixOutputItems() && task.beanPath() != null) {
      ensureExists(task.beanPath(), "Bean 不存在");
    }

    // 业务上输出目录仍按 SB/CP/IT 分类，但只有真正发生修正时才创建，避免“无需修正”的文档也落成果物。
    Path outputDir = task.outputRootPath().resolve(resolvePrefix(task.sqlId()));
    Path outputWorkbookPath = outputDir.resolve(task.workbookPath().getFileName());
    Path reportPath = outputDir.resolve(removeExtension(task.workbookPath().getFileName().toString()) + "_修正报告.md");

    // 业务上先从权威参照源抽取目标 SQL 和 Bean 字段，再去修规格书，避免用旧文档反推新文档。
    List<String> mapperSqlLines = extractMapperSqlLines(task.mapperPath(), task.sqlId());
    List<OutputItem> beanOutputItems = Collections.emptyList();
    boolean shouldFixOutputItems = task.fixOutputItems();
    if (task.fixOutputItems() && task.beanPath() != null) {
      beanOutputItems = extractBeanOutputItems(task.beanPath());
      if (beanOutputItems.isEmpty()) {
        // 业务上某些存在确认/件数取得 Bean 即使存在，也不一定定义了可回写字段；这类文档自动降级成只修 SQL。
        shouldFixOutputItems = false;
      }
    }

    // 业务上先直接读取原规格书做差异判断，只有确认有变化时才输出副本，避免无差异文档落空文件。
    try (InputStream inputStream = Files.newInputStream(task.workbookPath());
         Workbook workbook = WorkbookFactory.create(inputStream)) {
      // 业务上页签名是规格书定位边界，优先按传入页签精准落点，避免误改同工作簿其他页。
      Sheet sheet = workbook.getSheet(task.sheetName());
      if (sheet == null) {
        throw new IllegalStateException("target sheet not found: " + task.sheetName());
      }

      Set<Integer> changedOutputIndexes = new LinkedHashSet<>();
      List<String> originalOutputFieldNames = Collections.emptyList();
      List<OutputItem> targetOutputItems = Collections.emptyList();
      int outputStartRowIndexForReport = task.outputItemStartRowIndex();

      // 业务上只有在开启字段修正时，才触碰取得項目区块，避免对只修 SQL 的任务扩大改动面。
      if (shouldFixOutputItems) {
        OutputSection outputSection = readCurrentOutputSection(sheet, task);
        originalOutputFieldNames = outputSection.fieldNames();
        List<OutputItem> currentOutputItems = readCurrentOutputItems(sheet, outputSection, task);
        targetOutputItems = buildTargetOutputItems(currentOutputItems, beanOutputItems);
        Set<Integer> unchangedOutputIndexes = findUnchangedTargetIndexes(
            outputSection.fieldNames(),
            targetOutputItems.stream().map(OutputItem::fieldName).toList());
        for (int index = 0; index < targetOutputItems.size(); index++) {
          if (!unchangedOutputIndexes.contains(index)) {
            changedOutputIndexes.add(index);
          }
        }
        resizeOutputSection(sheet, outputSection, targetOutputItems.size());
        applyOutputItems(workbook, sheet, outputSection, targetOutputItems, changedOutputIndexes, task);
        outputStartRowIndexForReport = outputSection.startRowIndex();
      }

      // 业务上 SQL 詳細是本轮修正的第一基准，必须按 Mapper 分行结果完整回写。
      SqlSection sqlSection = readCurrentSqlSection(sheet, task);
      Set<Integer> unchangedSqlIndexes = findUnchangedTargetIndexes(sqlSection.lines(), mapperSqlLines);
      Set<Integer> changedSqlIndexes = new LinkedHashSet<>();
      for (int index = 0; index < mapperSqlLines.size(); index++) {
        if (!unchangedSqlIndexes.contains(index)) {
          changedSqlIndexes.add(index);
        }
      }
      // 业务上 SQL 和取得項目都无差异时，直接登记为未修正，不生成 out 文件也不生成差异报告。
      if (changedOutputIndexes.isEmpty() && changedSqlIndexes.isEmpty()) {
        // 业务上如果之前跑过旧版本，需要顺手清掉历史残留成果物，避免“未修正”文档继续留在 out 目录里误导判断。
        Files.deleteIfExists(outputWorkbookPath);
        Files.deleteIfExists(reportPath);
        return new CorrectionResult(task, null, null, 0, 0, false);
      }
      resizeSqlSection(sheet, sqlSection, mapperSqlLines.size());
      applySqlLines(workbook, sheet, sqlSection, mapperSqlLines, changedSqlIndexes, task);

      // 业务上部分模板在平移与克隆 merge 后会留下完全重复的合并区域，
      // Excel 打开时会把这类重复 merge 当作损坏记录删除，因此写盘前统一做一次去重。
      deduplicateMergedRegions(sheet);

      // 业务上确认存在实际修正后，才创建输出目录并写出成品，避免 out 下混入未改文件。
      Files.createDirectories(outputDir);
      try (OutputStream outputStream = Files.newOutputStream(outputWorkbookPath)) {
        workbook.write(outputStream);
      }

      // 业务上差异报告是收口必需品，用来告诉人工审核本次到底改了哪些字段和 SQL 行。
      writeReport(
          task,
          reportPath,
          originalOutputFieldNames,
          targetOutputItems,
          changedOutputIndexes,
          outputStartRowIndexForReport,
          sqlSection.lines(),
          mapperSqlLines,
          changedSqlIndexes,
          sqlSection.startRowIndex(),
          shouldFixOutputItems);

      return new CorrectionResult(task, outputWorkbookPath, reportPath, changedOutputIndexes.size(), changedSqlIndexes.size(), true);
    }
  }

  /**
   * 解析批量执行上限。
   *
   * <p>业务上只有显式给了 `--limit` 或源码里写了默认上限时才截断任务，否则直接全量执行。
   *
   * @param overrides 参数映射。
   * @return 批量上限，`Integer.MAX_VALUE` 表示全量。
   */
  private static int resolveBatchLimit(Map<String, String> overrides) {
    String value = overrides.get("limit");
    return value == null || value.isBlank() ? Integer.MAX_VALUE : Integer.parseInt(value);
  }

  /**
   * 写出未修正名单。
   *
   * <p>业务上批量执行后需要单独留一份“未修正名单”，让你直接确认哪些规格书无需输出、哪些规格书执行失败。
   *
   * @param unchangedListPath 未修正名单路径。
   * @param unchangedResults 未修正结果。
   * @param failureMessages 失败信息。
   */
  private static void writeUnchangedList(Path unchangedListPath, List<CorrectionResult> unchangedResults, List<String> failureMessages) {
    List<String> lines = new ArrayList<>();
    Collections.addAll(lines,
        "# 未修正名单",
        "",
        "## 无需修正",
        "");
    if (unchangedResults.isEmpty()) {
      lines.add("- 无");
    } else {
      for (CorrectionResult unchangedResult : unchangedResults) {
        lines.add("- `" + unchangedResult.task().sqlId() + "`: `" + unchangedResult.task().workbookPath() + "`");
      }
    }
    Collections.addAll(lines, "", "## 执行失败", "");
    if (failureMessages.isEmpty()) {
      lines.add("- 无");
    } else {
      for (String failureMessage : failureMessages) {
        lines.add("- `" + failureMessage + "`");
      }
    }
    try {
      Files.write(unchangedListPath, lines, UTF_8);
    } catch (IOException exception) {
      throw new IllegalStateException("cannot write unchanged list: " + unchangedListPath, exception);
    }
  }

  /**
   * 解析 `--key=value` 形式的命令行参数。
   *
   * <p>业务上统一做成简单键值对，方便后续在 bat 或 IDE Run Configuration 里直接复用。
   *
   * @param args 原始命令行参数。
   * @return 参数键值映射。
   */
  private static Map<String, String> parseArgs(String[] args) {
    Map<String, String> overrides = new LinkedHashMap<>();
    for (String arg : args) {
      if (arg == null || !arg.startsWith("--") || !arg.contains("=")) {
        continue;
      }
      int splitIndex = arg.indexOf('=');
      overrides.put(arg.substring(2, splitIndex), arg.substring(splitIndex + 1));
    }
    return overrides;
  }

  /**
   * 从 Mapper XML 中抽取目标 SQLID 的 SQL 行。
   *
   * <p>业务上 SQL 詳細必须以 Mapper 为唯一权威来源，因此这里只认 `select / update / insert / delete` 节点的精确 SQLID。
   *
   * @param mapperPath Mapper 路径。
   * @param sqlId SQLID。
   * @return SQL 行列表。
   * @throws IOException 读取失败时抛出。
   */
  private static List<String> extractMapperSqlLines(Path mapperPath, String sqlId) throws IOException {
    String mapperText = Files.readString(mapperPath, UTF_8);
    Pattern pattern = Pattern.compile(
        "<(select|update|insert|delete)\\s+id=\"" + Pattern.quote(sqlId) + "\".*?>\\s*/\\*.*?\\*/\\s*(.*?)\\s*</\\1>",
        Pattern.DOTALL);
    Matcher matcher = pattern.matcher(mapperText);
    if (!matcher.find()) {
      throw new IllegalStateException("sql id not found in mapper: " + sqlId);
    }
    List<String> lines = new ArrayList<>();
    for (String rawLine : matcher.group(2).strip().split("\\R")) {
      lines.add(rawLine.strip());
    }
    return lines;
  }

  /**
   * 从 Bean 中抽取输出字段定义。
   *
   * <p>业务上取得項目区块的字段名以 OutDataBean 为权威来源，注释文字则作为默认备注候选。
   *
   * @param beanPath Bean 路径。
   * @return 字段定义列表。
   * @throws IOException 读取失败时抛出。
   */
  private static List<OutputItem> extractBeanOutputItems(Path beanPath) throws IOException {
    String beanText = Files.readString(beanPath, UTF_8);
    Pattern pattern = Pattern.compile(
        "/\\*\\*(.*?)\\*/\\s*private\\s+([\\w<>?,\\s]+?)\\s+(\\w+)\\s*;",
        Pattern.DOTALL);
    Matcher matcher = pattern.matcher(beanText);
    List<OutputItem> items = new ArrayList<>();
    while (matcher.find()) {
      String label = normalizeBeanComment(matcher.group(1));
      String dataType = simplifyJavaType(matcher.group(2));
      String fieldName = matcher.group(3).trim();
      // 业务上 Bean 注释更接近规格书里的“取得元データ”说明，新追加字段默认先写到取得元列，備考列留空避免串列。
      items.add(new OutputItem(fieldName, dataType, label, ""));
    }
    return items;
  }

  /**
   * 归一化 Bean 字段注释。
   *
   * <p>业务上自动生成 Bean 的注释既可能是一行，也可能是多行 Javadoc，
   * 这里把前导 `*`、空白和换行统一压平，输出成适合写入规格书“取得元データ”的单行文本。
   *
   * @param rawComment 原始 Javadoc 内容。
   * @return 归一化后的注释文本。
   */
  private static String normalizeBeanComment(String rawComment) {
    List<String> lines = new ArrayList<>();
    for (String line : rawComment.split("\\R")) {
      String normalizedLine = line.replaceFirst("^\\s*\\*", "").trim();
      if (!normalizedLine.isBlank()) {
        lines.add(normalizedLine);
      }
    }
    return String.join(" ", lines);
  }

  /**
   * 提取 Java 字段类型的展示名。
   *
   * <p>业务上规格书里的数据型只需要看最终类型名，不需要保留包名和冗长的泛型限定。
   *
   * @param rawJavaType Java 原始类型声明。
   * @return 规格书可读的数据型名称。
   */
  private static String simplifyJavaType(String rawJavaType) {
    String normalizedType = rawJavaType.trim().replaceAll("\\s+", " ");
    int genericStartIndex = normalizedType.indexOf('<');
    if (genericStartIndex >= 0) {
      normalizedType = normalizedType.substring(0, genericStartIndex);
    }
    int packageSeparatorIndex = normalizedType.lastIndexOf('.');
    return packageSeparatorIndex >= 0 ? normalizedType.substring(packageSeparatorIndex + 1) : normalizedType;
  }

  /**
   * 读取当前规格书中的取得項目区块边界。
   *
   * <p>业务上当前模板的取得項目具体起点已由配置传入，而结束位置仍通过结束标记动态识别，避免硬编码整段长度。
   *
   * @param sheet 目标页签。
   * @param task 修正任务。
   * @return 取得項目区块。
   */
  private static OutputSection readCurrentOutputSection(Sheet sheet, CorrectionTask task) {
    int searchStartRowIndex = Math.max(0, task.outputItemStartRowIndex() - 5);
    int endMarkerRowIndex = findOutputEndMarkerRowIndex(sheet, searchStartRowIndex, task.sqlColumnIndex());
    int headerRowIndex = findOutputHeaderRowIndex(sheet, searchStartRowIndex, endMarkerRowIndex, task);
    int startRowIndex = findOutputDataStartRowIndex(sheet, headerRowIndex, endMarkerRowIndex, task);
    List<String> fieldNames = new ArrayList<>();
    int currentLastRowIndex = startRowIndex - 1;
    for (int rowIndex = startRowIndex; rowIndex < endMarkerRowIndex; rowIndex++) {
      String fieldName = readCellText(sheet, rowIndex, task.outputNameColumnIndex());
      // 业务上取得項目区块是从起始行开始的连续字段行，遇到首个字段名空行后，后续就是版式行或下一区块，不能继续吞进去。
      if (fieldName.isBlank()) {
        break;
      }
      fieldNames.add(fieldName);
      currentLastRowIndex = rowIndex;
    }
    return new OutputSection(startRowIndex, currentLastRowIndex, endMarkerRowIndex, fieldNames);
  }

  /**
   * 查找取得項目区块结束标记。
   *
   * <p>业务上当前模板用 SQL 列上的 `E` 作为段落结束标记，因此从字段起点向下扫描即可。
   *
   * @param sheet 目标页签。
   * @param task 修正任务。
   * @return 结束标记行号。
   */
  private static int findOutputEndMarkerRowIndex(Sheet sheet, int startRowIndex, int sqlColumnIndex) {
    for (int rowIndex = startRowIndex; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      if ("E".equals(readCellText(sheet, rowIndex, sqlColumnIndex))) {
        return rowIndex;
      }
    }
    throw new IllegalStateException("output section end marker not found.");
  }

  /**
   * 查找取得項目表头行。
   *
   * <p>业务上不同规格书的字段区块起始行并不固定，因此先定位含有 `No` 与 `項目名` 的表头行，再向下找实际数据行。
   *
   * @param sheet 目标页签。
   * @param searchStartRowIndex 搜索起始行。
   * @param endMarkerRowIndex 结束标记行。
   * @param task 修正任务。
   * @return 表头行号。
   */
  private static int findOutputHeaderRowIndex(
      Sheet sheet,
      int searchStartRowIndex,
      int endMarkerRowIndex,
      CorrectionTask task) {
    for (int rowIndex = searchStartRowIndex; rowIndex < endMarkerRowIndex; rowIndex++) {
      String numberHeaderText = readCellText(sheet, rowIndex, task.sqlColumnIndex());
      String nameHeaderText = readCellText(sheet, rowIndex, task.outputNameColumnIndex());
      if ("No".equalsIgnoreCase(numberHeaderText) && nameHeaderText.contains("項目名")) {
        return rowIndex;
      }
    }
    return Math.max(searchStartRowIndex, task.outputItemStartRowIndex() - 1);
  }

  /**
   * 查找取得項目数据起始行。
   *
   * <p>业务上表头下一行未必立即就是字段数据，因此这里从表头后向下找首个字段名非空的行作为实际起点。
   *
   * @param sheet 目标页签。
   * @param headerRowIndex 表头行。
   * @param endMarkerRowIndex 结束标记行。
   * @param task 修正任务。
   * @return 数据起始行号。
   */
  private static int findOutputDataStartRowIndex(
      Sheet sheet,
      int headerRowIndex,
      int endMarkerRowIndex,
      CorrectionTask task) {
    for (int rowIndex = headerRowIndex + 1; rowIndex < endMarkerRowIndex; rowIndex++) {
      if (!readCellText(sheet, rowIndex, task.outputNameColumnIndex()).isBlank()) {
        return rowIndex;
      }
    }
    return headerRowIndex + 1;
  }

  /**
   * 查找取得項目区块结束标记。
   *
   * <p>业务上当前模板用 SQL 列上的 `E` 作为段落结束标记，因此从字段起点附近向下扫描即可。
   *
   * @param sheet 目标页签。
   * @param task 修正任务。
   * @return 结束标记行号。
   */
  private static int findOutputEndMarkerRowIndex(Sheet sheet, CorrectionTask task) {
    for (int rowIndex = task.outputItemStartRowIndex(); rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      if ("E".equals(readCellText(sheet, rowIndex, task.sqlColumnIndex()))) {
        return rowIndex;
      }
    }
    throw new IllegalStateException("output section end marker not found.");
  }

  /**
   * 读取当前规格书中的取得項目明细。
   *
   * <p>业务上现有字段的取得元和备注应优先保留，因此要先把当前行内容完整读出来再决定如何修正。
   *
   * @param sheet 目标页签。
   * @param outputSection 输出区块。
   * @param task 修正任务。
   * @return 当前字段清单。
   */
  private static List<OutputItem> readCurrentOutputItems(Sheet sheet, OutputSection outputSection, CorrectionTask task) {
    List<OutputItem> items = new ArrayList<>();
    for (int rowIndex = outputSection.startRowIndex(); rowIndex <= outputSection.endRowIndex(); rowIndex++) {
      String fieldName = readCellText(sheet, rowIndex, task.outputNameColumnIndex());
      if (fieldName.isBlank()) {
        continue;
      }
      items.add(new OutputItem(
          fieldName,
          readCellText(sheet, rowIndex, task.outputTypeColumnIndex()),
          readCellText(sheet, rowIndex, task.outputSourceColumnIndex()),
          readCellText(sheet, rowIndex, task.outputNoteColumnIndex())));
    }
    return items;
  }

  /**
   * 构建最终要回写的取得項目。
   *
   * <p>业务上优先保留文档里已存在字段的顺序和描述，只对 Bean 里存在但文档缺失的字段追加默认定义。
   *
   * @param currentOutputItems 当前文档字段。
   * @param beanOutputItems Bean 字段。
   * @return 目标字段清单。
   */
  private static List<OutputItem> buildTargetOutputItems(List<OutputItem> currentOutputItems, List<OutputItem> beanOutputItems) {
    Map<String, OutputItem> currentMap = new LinkedHashMap<>();
    for (OutputItem currentOutputItem : currentOutputItems) {
      currentMap.put(currentOutputItem.fieldName(), currentOutputItem);
    }
    Map<String, OutputItem> beanMap = new LinkedHashMap<>();
    for (OutputItem beanOutputItem : beanOutputItems) {
      beanMap.put(beanOutputItem.fieldName(), beanOutputItem);
    }
    List<OutputItem> targetOutputItems = new ArrayList<>();
    // 业务上文档里已存在且仍在 Bean 中的字段顺序必须优先保留，避免只因 Bean 声明顺序不同而误重排。
    for (OutputItem currentOutputItem : currentOutputItems) {
      if (beanMap.containsKey(currentOutputItem.fieldName())) {
        targetOutputItems.add(currentOutputItem);
      }
    }
    // 业务上只有 Bean 新增而文档缺失的字段，才允许按 Bean 顺序追加到尾部。
    for (OutputItem beanOutputItem : beanOutputItems) {
      if (!currentMap.containsKey(beanOutputItem.fieldName())) {
        targetOutputItems.add(beanOutputItem);
      }
    }
    return targetOutputItems;
  }

  /**
   * 调整取得項目区块大小。
   *
   * <p>业务上字段数变化时必须先整体下移后续区块，否则会直接覆盖参数区块或 SQL 詳細。
   *
   * @param sheet 目标页签。
   * @param outputSection 原区块。
   * @param targetItemCount 目标字段数。
   */
  private static void resizeOutputSection(Sheet sheet, OutputSection outputSection, int targetItemCount) {
    int currentItemCount = outputSection.fieldNames().size();
    int delta = targetItemCount - currentItemCount;
    if (delta == 0) {
      return;
    }
    if (delta < 0) {
      // 业务上字段区块缩容前，要先移除“即将退出输出区块”的旧横向 merge，
      // 否则下方参数区块上移到这些行后，会与老字段行 merge 叠在一起，导致 Excel 判定文件损坏。
      removeMergedRegionsForRows(
          sheet,
          outputSection.startRowIndex() + targetItemCount,
          outputSection.endRowIndex());
    }
    // 业务上字段追加要从“字段区块之后的第一行”开始整体下移，避免把本应保留的版式行直接覆盖掉。
    shiftRowsUnsafe(sheet, outputSection.endRowIndex() + 1, sheet.getLastRowNum(), delta);
  }

  /**
   * 回写取得項目区块。
   *
   * <p>业务上这里既要写字段内容，也要保持模板样式和红字标识规则。
   *
   * @param workbook 工作簿。
   * @param sheet 页签。
   * @param outputSection 输出区块。
   * @param outputItems 目标字段。
   * @param changedOutputIndexes 变更字段索引。
   * @param task 修正任务。
   */
  private static void applyOutputItems(
      Workbook workbook,
      Sheet sheet,
      OutputSection outputSection,
      List<OutputItem> outputItems,
      Set<Integer> changedOutputIndexes,
      CorrectionTask task) {
    for (int index = 0; index < outputItems.size(); index++) {
      int rowIndex = outputSection.startRowIndex() + index;
      OutputTemplateRow templateRow = resolveOutputTemplateRow(sheet, outputSection, index, task);
      // 业务上只有追加新字段时，才需要把模板行的整行结构、隐藏列样式和合并区域完整复制到新行。
      if (index >= outputSection.fieldNames().size()) {
        cloneOutputTemplateRowStructure(sheet, templateRow, rowIndex);
      }
      Row row = getOrCreateRow(sheet, rowIndex);
      if (templateRow.sourceRow() != null) {
        row.setHeight(templateRow.sourceRow().getHeight());
      }
      OutputItem outputItem = outputItems.get(index);
      boolean changed = changedOutputIndexes.contains(index);
      writeOutputCell(workbook, row, task.sqlColumnIndex(), Integer.toString(index + 1), templateRow.numberStyle(), changed);
      writeOutputCell(workbook, row, task.outputNameColumnIndex(), outputItem.fieldName(), templateRow.nameStyle(), changed);
      writeOutputCell(workbook, row, task.outputTypeColumnIndex(), outputItem.dataType(), templateRow.typeStyle(), changed);
      writeOutputCell(workbook, row, task.outputSourceColumnIndex(), outputItem.sourceName(), templateRow.sourceStyle(), changed);
      writeOutputCell(workbook, row, task.outputNoteColumnIndex(), outputItem.note(), templateRow.noteStyle(), changed);
    }
    clearStaleOutputCells(sheet, outputSection, outputItems.size(), task);
  }

  /**
   * 克隆新增输出行的模板结构。
   *
   * <p>业务上追加字段行时，必须把模板行已有的整行样式、空白占位单元格和合并区域一起复制过去，
   * 否则新行虽然字段文本写上去了，但视觉格式会与上方原模板断层。
   *
   * @param sheet 目标页签。
   * @param templateRow 模板行信息。
   * @param targetRowIndex 目标行号。
   */
  private static void cloneOutputTemplateRowStructure(Sheet sheet, OutputTemplateRow templateRow, int targetRowIndex) {
    Row sourceRow = templateRow.sourceRow();
    if (sourceRow == null) {
      return;
    }
    Row targetRow = getOrCreateRow(sheet, targetRowIndex);
    targetRow.setHeight(sourceRow.getHeight());
    short firstCellNum = sourceRow.getFirstCellNum();
    short lastCellNum = sourceRow.getLastCellNum();
    if (firstCellNum >= 0 && lastCellNum >= 0) {
      for (int columnIndex = firstCellNum; columnIndex < lastCellNum; columnIndex++) {
        Cell sourceCell = sourceRow.getCell(columnIndex);
        if (sourceCell == null) {
          continue;
        }
        Cell targetCell = getOrCreateCell(targetRow, columnIndex);
        targetCell.setBlank();
        targetCell.setCellStyle(sourceCell.getCellStyle());
      }
    }
    cloneRowMergedRegions(sheet, sourceRow.getRowNum(), targetRowIndex);
  }

  /**
   * 复制模板行的合并区域到新行。
   *
   * <p>业务上输出项的显示格式依赖 C:D、E:Q、R:Z、AA:AH、AI:BO 等横向合并，
   * 追加新行时若不把这些合并关系一起复制，新增字段就会看起来“串行”。
   *
   * @param sheet 目标页签。
   * @param sourceRowIndex 模板行号。
   * @param targetRowIndex 目标行号。
   */
  private static void cloneRowMergedRegions(Sheet sheet, int sourceRowIndex, int targetRowIndex) {
    removeMergedRegionsForRow(sheet, targetRowIndex);
    List<CellRangeAddress> mergedRegionsToClone = new ArrayList<>();
    for (int index = 0; index < sheet.getNumMergedRegions(); index++) {
      CellRangeAddress mergedRegion = sheet.getMergedRegion(index);
      if (mergedRegion.getFirstRow() == sourceRowIndex && mergedRegion.getLastRow() == sourceRowIndex) {
        mergedRegionsToClone.add(mergedRegion.copy());
      }
    }
    for (CellRangeAddress mergedRegion : mergedRegionsToClone) {
      int rowOffset = targetRowIndex - sourceRowIndex;
      CellRangeAddress targetRegion = new CellRangeAddress(
          mergedRegion.getFirstRow() + rowOffset,
          mergedRegion.getLastRow() + rowOffset,
          mergedRegion.getFirstColumn(),
          mergedRegion.getLastColumn());
      if (!hasExactMergedRegion(sheet, targetRegion)) {
        sheet.addMergedRegionUnsafe(targetRegion);
      }
    }
  }

  /**
   * 删除目标行已有的合并区域。
   *
   * <p>业务上重新生成新增行格式前，要先清掉该行现存的合并定义，避免重复添加时触发重叠异常。
   *
   * @param sheet 目标页签。
   * @param rowIndex 目标行号。
   */
  private static void removeMergedRegionsForRow(Sheet sheet, int rowIndex) {
    for (int index = sheet.getNumMergedRegions() - 1; index >= 0; index--) {
      CellRangeAddress mergedRegion = sheet.getMergedRegion(index);
      if (mergedRegion.getFirstRow() <= rowIndex && mergedRegion.getLastRow() >= rowIndex) {
        sheet.removeMergedRegion(index);
      }
    }
  }

  /**
   * 删除指定行区间内的合并区域。
   *
   * <p>业务上输出项缩容会让后续参数区块整体上移，因此要先清掉将被裁掉那些旧字段行上的 merge，
   * 避免后续区块搬到同一行号后仍与旧 merge 重叠。
   *
   * @param sheet 目标页签。
   * @param startRowIndex 开始行号。
   * @param endRowIndex 结束行号。
   */
  private static void removeMergedRegionsForRows(Sheet sheet, int startRowIndex, int endRowIndex) {
    if (startRowIndex > endRowIndex) {
      return;
    }
    for (int rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex++) {
      removeMergedRegionsForRow(sheet, rowIndex);
    }
  }

  /**
   * 判断目标合并区域是否已存在。
   *
   * <p>业务上同一行模板结构可能被多次探测，这里用精确匹配避免重复加入相同合并区域。
   *
   * @param sheet 目标页签。
   * @param expectedRegion 目标合并区域。
   * @return 是否已存在。
   */
  private static boolean hasExactMergedRegion(Sheet sheet, CellRangeAddress expectedRegion) {
    for (int index = 0; index < sheet.getNumMergedRegions(); index++) {
      CellRangeAddress mergedRegion = sheet.getMergedRegion(index);
      if (mergedRegion.getFirstRow() == expectedRegion.getFirstRow()
          && mergedRegion.getLastRow() == expectedRegion.getLastRow()
          && mergedRegion.getFirstColumn() == expectedRegion.getFirstColumn()
          && mergedRegion.getLastColumn() == expectedRegion.getLastColumn()) {
        return true;
      }
    }
    return false;
  }

  /**
   * 去重页签里的完全重复 merge。
   *
   * <p>业务上我们需要保留模板自身的特殊 merge 结构，但不能把完全相同的范围写两次；
   * 否则 Excel 会在打开时提示“削除されたレコード: セルの結合”。
   *
   * @param sheet 目标页签。
   */
  private static void deduplicateMergedRegions(Sheet sheet) {
    Map<String, CellRangeAddress> uniqueMergedRegions = new LinkedHashMap<>();
    for (int index = 0; index < sheet.getNumMergedRegions(); index++) {
      CellRangeAddress mergedRegion = sheet.getMergedRegion(index);
      uniqueMergedRegions.putIfAbsent(mergedRegion.formatAsString(), mergedRegion.copy());
    }
    for (int index = sheet.getNumMergedRegions() - 1; index >= 0; index--) {
      sheet.removeMergedRegion(index);
    }
    for (CellRangeAddress mergedRegion : uniqueMergedRegions.values()) {
      sheet.addMergedRegionUnsafe(mergedRegion);
    }
  }

  /**
   * 解析字段区块要复用的模板样式。
   *
   * <p>业务上新增字段也要尽量沿用现有字段行样式，避免规格书新增行出现视觉断层。
   *
   * @param sheet 目标页签。
   * @param outputSection 输出区块。
   * @param targetIndex 目标字段索引。
   * @param task 修正任务。
   * @return 模板样式集合。
   */
  private static OutputTemplateRow resolveOutputTemplateRow(
      Sheet sheet,
      OutputSection outputSection,
      int targetIndex,
      CorrectionTask task) {
    int sourceRowIndex = outputSection.startRowIndex() + Math.min(targetIndex, Math.max(outputSection.fieldNames().size() - 1, 0));
    Row sourceRow = sheet.getRow(sourceRowIndex);
    return new OutputTemplateRow(
        sourceRow,
        readCellStyle(sourceRow, task.sqlColumnIndex()),
        readCellStyle(sourceRow, task.outputNameColumnIndex()),
        readCellStyle(sourceRow, task.outputTypeColumnIndex()),
        readCellStyle(sourceRow, task.outputSourceColumnIndex()),
        readCellStyle(sourceRow, task.outputNoteColumnIndex()));
  }

  /**
   * 清理旧字段残留。
   *
   * <p>业务上新字段数少于旧字段数时，尾部老字段必须清空，否则规格书会保留脏数据。
   *
   * @param sheet 目标页签。
   * @param outputSection 输出区块。
   * @param targetItemCount 新字段数。
   * @param task 修正任务。
   */
  private static void clearStaleOutputCells(Sheet sheet, OutputSection outputSection, int targetItemCount, CorrectionTask task) {
    if (targetItemCount <= outputSection.fieldNames().size()) {
      // 业务上字段区块缩容时，后续参数区块已经通过整段上移填充到尾部旧行号，
      // 这里不能再按“旧字段尾行”去清单元格，否则会把刚搬上来的参数区块正文再次擦空。
      return;
    }
    for (int rowIndex = outputSection.startRowIndex() + targetItemCount; rowIndex <= outputSection.endRowIndex(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      for (int columnIndex : new int[] {
          task.sqlColumnIndex(),
          task.outputNameColumnIndex(),
          task.outputTypeColumnIndex(),
          task.outputSourceColumnIndex(),
          task.outputNoteColumnIndex()}) {
        Cell cell = row.getCell(columnIndex);
        if (cell != null) {
          cell.setBlank();
        }
      }
    }
  }

  /**
   * 写入字段单元格。
   *
   * <p>业务上这里必须先继承模板样式，再按需改成红字，避免把边框、行高和底色弄丢。
   *
   * @param workbook 工作簿。
   * @param row 目标行。
   * @param columnIndex 目标列。
   * @param value 写入值。
   * @param baseStyle 模板样式。
   * @param markRed 是否标红。
   */
  private static void writeOutputCell(
      Workbook workbook,
      Row row,
      int columnIndex,
      String value,
      CellStyle baseStyle,
      boolean markRed) {
    Cell cell = getOrCreateCell(row, columnIndex);
    if (baseStyle != null) {
      cell.setCellStyle(baseStyle);
    }
    cell.setCellValue(value == null ? "" : value);
    if (markRed) {
      cell.setCellStyle(createRedStyle(workbook, baseStyle));
    }
  }

  /**
   * 读取当前规格书中的 SQL 詳細区块。
   *
   * <p>业务上 SQL 起点通过“SQL詳細”标题后首个 SQL 行动态查找，结束位置通过 `E` 结束标记识别。
   *
   * @param sheet 目标页签。
   * @param task 修正任务。
   * @return SQL 区块。
   */
  private static SqlSection readCurrentSqlSection(Sheet sheet, CorrectionTask task) {
    SqlStart sqlStart = findSqlStart(sheet, task);
    int startRowIndex = sqlStart.rowIndex();
    int sqlColumnIndex = sqlStart.columnIndex();
    int endMarkerRowIndex = findEndMarkerRowIndex(sheet, startRowIndex);
    int currentLastSqlRowIndex = findLastSqlRowIndex(sheet, startRowIndex, endMarkerRowIndex, sqlColumnIndex);
    List<String> lines = new ArrayList<>();
    for (int rowIndex = startRowIndex; rowIndex <= currentLastSqlRowIndex; rowIndex++) {
      lines.add(readCellText(sheet, rowIndex, sqlColumnIndex));
    }
    return new SqlSection(startRowIndex, currentLastSqlRowIndex, endMarkerRowIndex, sqlColumnIndex, lines);
  }

  /**
   * 查找 SQL 詳細起始位置。
   *
   * <p>业务上不同规格书里“SQL詳細”标题列和 SQL 文本列并不固定，因此这里先整行找标题，
   * 再向下找首个非空单元格作为 SQL 的真实起始行与真实列。
   *
   * @param sheet 目标页签。
   * @param task 修正任务。
   * @return SQL 起始位置。
   */
  private static SqlStart findSqlStart(Sheet sheet, CorrectionTask task) {
    for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      if (rowContainsText(sheet, rowIndex, "SQL詳細")) {
        for (int nextRowIndex = rowIndex + 1; nextRowIndex <= sheet.getLastRowNum(); nextRowIndex++) {
          int sqlColumnIndex = findFirstNonBlankColumnIndex(sheet, nextRowIndex);
          if (sqlColumnIndex >= 0) {
            return new SqlStart(nextRowIndex, sqlColumnIndex);
          }
        }
      }
    }
    throw new IllegalStateException("sql start row not found.");
  }

  /**
   * 查找段落结束标记。
   *
   * <p>业务上结束标记 `E` 可能出现在 A 列、C 列等不同位置，因此这里按整行识别“只有一个非空单元格且内容为 E”的结束行。
   *
   * @param sheet 目标页签。
   * @param startRowIndex 起始行。
   * @return 结束标记行号。
   */
  private static int findEndMarkerRowIndex(Sheet sheet, int startRowIndex) {
    for (int rowIndex = startRowIndex; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
      if (isSingleEndMarkerRow(sheet, rowIndex)) {
        return rowIndex;
      }
    }
    // 业务上部分规格书的 SQL 詳細直接写到工作表末尾，没有单独的 E 结束标记，此时按“末尾下一行”处理即可。
    return sheet.getLastRowNum() + 1;
  }

  /**
   * 查找 SQL 实际结束行。
   *
   * <p>业务上结束标记前常常夹着若干空白行，因此不能简单用 `endMarker - 2`；
   * 这里从结束标记往上回溯，找到 SQL 文本列最后一个非空行作为真实结尾。
   *
   * @param sheet 目标页签。
   * @param startRowIndex SQL 起始行。
   * @param endMarkerRowIndex 结束标记行。
   * @param sqlColumnIndex SQL 文本列。
   * @return SQL 实际结束行。
   */
  private static int findLastSqlRowIndex(Sheet sheet, int startRowIndex, int endMarkerRowIndex, int sqlColumnIndex) {
    for (int rowIndex = endMarkerRowIndex - 1; rowIndex >= startRowIndex; rowIndex--) {
      if (!readCellText(sheet, rowIndex, sqlColumnIndex).isBlank()) {
        return rowIndex;
      }
    }
    throw new IllegalStateException("sql end marker not found.");
  }

  /**
   * 判断一行里是否包含指定文本。
   *
   * <p>业务上标题列会随规格书模板变化，因此这里按整行扫描，避免因为标题不在固定列而漏掉区块。
   *
   * @param sheet 目标页签。
   * @param rowIndex 行号。
   * @param text 目标文本。
   * @return 是否包含。
   */
  private static boolean rowContainsText(Sheet sheet, int rowIndex, String text) {
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      return false;
    }
    short firstCellNum = row.getFirstCellNum();
    short lastCellNum = row.getLastCellNum();
    if (firstCellNum < 0 || lastCellNum < 0) {
      return false;
    }
    for (int columnIndex = firstCellNum; columnIndex < lastCellNum; columnIndex++) {
      if (readCellText(sheet, rowIndex, columnIndex).contains(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 查找一行里首个非空单元格列号。
   *
   * <p>业务上 SQL 文本列在不同规格书里可能是 C、D、E 列，因此起始列也必须动态探测。
   *
   * @param sheet 目标页签。
   * @param rowIndex 行号。
   * @return 首个非空列号，不存在时返回 `-1`。
   */
  private static int findFirstNonBlankColumnIndex(Sheet sheet, int rowIndex) {
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      return -1;
    }
    short firstCellNum = row.getFirstCellNum();
    short lastCellNum = row.getLastCellNum();
    if (firstCellNum < 0 || lastCellNum < 0) {
      return -1;
    }
    for (int columnIndex = firstCellNum; columnIndex < lastCellNum; columnIndex++) {
      if (!readCellText(sheet, rowIndex, columnIndex).isBlank()) {
        return columnIndex;
      }
    }
    return -1;
  }

  /**
   * 判断是否为单独的结束标记行。
   *
   * <p>业务上只有“整行唯一非空值为 E”才视为段落结束，避免把 SQL 本文中的普通字符或其他区块误判成结束标记。
   *
   * @param sheet 目标页签。
   * @param rowIndex 行号。
   * @return 是否结束标记行。
   */
  private static boolean isSingleEndMarkerRow(Sheet sheet, int rowIndex) {
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      return false;
    }
    short firstCellNum = row.getFirstCellNum();
    short lastCellNum = row.getLastCellNum();
    if (firstCellNum < 0 || lastCellNum < 0) {
      return false;
    }
    int nonBlankCount = 0;
    String onlyText = "";
    for (int columnIndex = firstCellNum; columnIndex < lastCellNum; columnIndex++) {
      String text = readCellText(sheet, rowIndex, columnIndex);
      if (!text.isBlank()) {
        nonBlankCount++;
        onlyText = text;
        if (nonBlankCount > 1) {
          return false;
        }
      }
    }
    return nonBlankCount == 1 && "E".equals(onlyText);
  }

  /**
   * 调整 SQL 区块大小。
   *
   * <p>业务上 SQL 行数变化时，需要先整体平移结束标记和后续区块，避免 SQL 覆盖其他内容。
   *
   * @param sheet 目标页签。
   * @param sqlSection 原 SQL 区块。
   * @param targetLineCount 目标 SQL 行数。
   */
  private static void resizeSqlSection(Sheet sheet, SqlSection sqlSection, int targetLineCount) {
    int currentLineCount = sqlSection.lines().size();
    int delta = targetLineCount - currentLineCount;
    if (delta == 0) {
      return;
    }
    shiftRowsUnsafe(sheet, sqlSection.endMarkerRowIndex(), sheet.getLastRowNum(), delta);
  }

  /**
   * 手动平移行与合并区域。
   *
   * <p>业务上部分原始规格书自身就带有边界重叠但可被 Excel 容忍的 merge 结构，
   * `sheet.shiftRows` 会在平移过程中强校验这些 merge 并直接失败，因此这里改为手动搬运行和 merge。
   *
   * @param sheet 目标页签。
   * @param startRowIndex 平移起点。
   * @param endRowIndex 平移终点。
   * @param delta 平移量，正数下移，负数上移。
   */
  private static void shiftRowsUnsafe(Sheet sheet, int startRowIndex, int endRowIndex, int delta) {
    if (delta == 0 || startRowIndex > endRowIndex) {
      return;
    }
    List<CellRangeAddress> mergedRegions = new ArrayList<>();
    for (int index = 0; index < sheet.getNumMergedRegions(); index++) {
      mergedRegions.add(sheet.getMergedRegion(index).copy());
    }
    for (int index = sheet.getNumMergedRegions() - 1; index >= 0; index--) {
      sheet.removeMergedRegion(index);
    }
    if (delta > 0) {
      for (int rowIndex = endRowIndex; rowIndex >= startRowIndex; rowIndex--) {
        copyRow(sheet, rowIndex, rowIndex + delta);
      }
      for (int rowIndex = startRowIndex; rowIndex < startRowIndex + delta; rowIndex++) {
        clearRow(sheet, rowIndex);
      }
    } else {
      for (int rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex++) {
        copyRow(sheet, rowIndex, rowIndex + delta);
      }
      for (int rowIndex = endRowIndex + delta + 1; rowIndex <= endRowIndex; rowIndex++) {
        clearRow(sheet, rowIndex);
      }
    }
    for (CellRangeAddress mergedRegion : mergedRegions) {
      CellRangeAddress shiftedRegion = shiftMergedRegion(mergedRegion, startRowIndex, delta);
      sheet.addMergedRegionUnsafe(shiftedRegion);
    }
  }

  /**
   * 复制整行内容。
   *
   * <p>业务上平移规格书时不只要搬字段文本，还要保留原行的高度、隐藏状态、每个单元格样式和已有公式。
   *
   * @param sheet 目标页签。
   * @param sourceRowIndex 原行号。
   * @param targetRowIndex 目标行号。
   */
  private static void copyRow(Sheet sheet, int sourceRowIndex, int targetRowIndex) {
    Row sourceRow = sheet.getRow(sourceRowIndex);
    if (sourceRow == null) {
      clearRow(sheet, targetRowIndex);
      return;
    }
    Row targetRow = getOrCreateRow(sheet, targetRowIndex);
    clearRow(sheet, targetRowIndex);
    targetRow = getOrCreateRow(sheet, targetRowIndex);
    targetRow.setHeight(sourceRow.getHeight());
    targetRow.setZeroHeight(sourceRow.getZeroHeight());
    short firstCellNum = sourceRow.getFirstCellNum();
    short lastCellNum = sourceRow.getLastCellNum();
    if (firstCellNum >= 0 && lastCellNum >= 0) {
      for (int columnIndex = firstCellNum; columnIndex < lastCellNum; columnIndex++) {
        Cell sourceCell = sourceRow.getCell(columnIndex);
        if (sourceCell == null) {
          continue;
        }
        copyCell(sourceCell, getOrCreateCell(targetRow, columnIndex));
      }
    }
  }

  /**
   * 复制单元格内容。
   *
   * <p>业务上平移时要完整保留单元格的数据类型、样式和公式，避免插入行后规格书内容变形。
   *
   * @param sourceCell 原单元格。
   * @param targetCell 目标单元格。
   */
  private static void copyCell(Cell sourceCell, Cell targetCell) {
    targetCell.setCellStyle(sourceCell.getCellStyle());
    switch (sourceCell.getCellType()) {
      case STRING -> targetCell.setCellValue(sourceCell.getStringCellValue());
      case NUMERIC -> targetCell.setCellValue(sourceCell.getNumericCellValue());
      case BOOLEAN -> targetCell.setCellValue(sourceCell.getBooleanCellValue());
      case FORMULA -> targetCell.setCellFormula(sourceCell.getCellFormula());
      case ERROR -> targetCell.setCellErrorValue(sourceCell.getErrorCellValue());
      case BLANK -> targetCell.setBlank();
      default -> targetCell.setBlank();
    }
  }

  /**
   * 清空整行内容。
   *
   * <p>业务上插入空白行或移除旧尾行时，要把原位置的单元格全部清掉，避免残留重复内容。
   *
   * @param sheet 目标页签。
   * @param rowIndex 行号。
   */
  private static void clearRow(Sheet sheet, int rowIndex) {
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      return;
    }
    short firstCellNum = row.getFirstCellNum();
    short lastCellNum = row.getLastCellNum();
    if (firstCellNum >= 0 && lastCellNum >= 0) {
      for (int columnIndex = firstCellNum; columnIndex < lastCellNum; columnIndex++) {
        Cell cell = row.getCell(columnIndex);
        if (cell != null) {
          row.removeCell(cell);
        }
      }
    }
    row.setHeight(sheet.getDefaultRowHeight());
    row.setZeroHeight(false);
  }

  /**
   * 计算 merge 平移后的新位置。
   *
   * <p>业务上只平移起点及其后的 merge，起点之前的 merge 结构保持不动。
   *
   * @param mergedRegion 原 merge。
   * @param startRowIndex 平移起点。
   * @param delta 平移量。
   * @return 平移后的 merge。
   */
  private static CellRangeAddress shiftMergedRegion(CellRangeAddress mergedRegion, int startRowIndex, int delta) {
    if (mergedRegion.getFirstRow() < startRowIndex) {
      return mergedRegion.copy();
    }
    return new CellRangeAddress(
        mergedRegion.getFirstRow() + delta,
        mergedRegion.getLastRow() + delta,
        mergedRegion.getFirstColumn(),
        mergedRegion.getLastColumn());
  }

  /**
   * 回写 SQL 明细。
   *
   * <p>业务上逐行写入 Mapper 权威 SQL，并只把真正变化的目标行标红。
   *
   * @param workbook 工作簿。
   * @param sheet 目标页签。
   * @param sqlSection 原 SQL 区块。
   * @param targetLines 目标 SQL 行。
   * @param changedTargetIndexes 变化行索引。
   * @param task 修正任务。
   */
  private static void applySqlLines(
      Workbook workbook,
      Sheet sheet,
      SqlSection sqlSection,
      List<String> targetLines,
      Set<Integer> changedTargetIndexes,
      CorrectionTask task) {
    for (int index = 0; index < targetLines.size(); index++) {
      int rowIndex = sqlSection.startRowIndex() + index;
      TemplateCell templateCell = resolveTemplateCell(sheet, sqlSection, index, sqlSection.sqlColumnIndex());
      Row targetRow = getOrCreateRow(sheet, rowIndex);
      if (templateCell.sourceRow() != null && targetRow.getHeight() <= 0) {
        targetRow.setHeight(templateCell.sourceRow().getHeight());
      }
      Cell targetCell = getOrCreateCell(targetRow, sqlSection.sqlColumnIndex());
      if (templateCell.sourceCellStyle() != null) {
        targetCell.setCellStyle(templateCell.sourceCellStyle());
      }
      targetCell.setCellValue(targetLines.get(index));
      if (changedTargetIndexes.contains(index)) {
        targetCell.setCellStyle(createRedStyle(workbook, templateCell.sourceCellStyle()));
      }
    }
    clearStaleSqlCells(sheet, sqlSection, targetLines.size(), sqlSection.sqlColumnIndex());
  }

  /**
   * 清理旧 SQL 残留。
   *
   * <p>业务上旧 SQL 比新 SQL 更长时，尾部老行内容必须清掉，否则规格书仍会展示无效旧 SQL。
   *
   * @param sheet 目标页签。
   * @param sqlSection 原 SQL 区块。
   * @param targetLineCount 新 SQL 行数。
   * @param sqlColumnIndex SQL 列。
   */
  private static void clearStaleSqlCells(Sheet sheet, SqlSection sqlSection, int targetLineCount, int sqlColumnIndex) {
    for (int rowIndex = sqlSection.startRowIndex() + targetLineCount; rowIndex <= sqlSection.endRowIndex(); rowIndex++) {
      Row row = sheet.getRow(rowIndex);
      if (row == null) {
        continue;
      }
      Cell cell = row.getCell(sqlColumnIndex);
      if (cell != null) {
        cell.setBlank();
      }
    }
  }

  /**
   * 解析 SQL 区块模板样式。
   *
   * <p>业务上新增 SQL 行也要沿用原模板样式，避免新行边框、字号和对齐方式异常。
   *
   * @param sheet 目标页签。
   * @param sqlSection 原 SQL 区块。
   * @param targetIndex 目标索引。
   * @param sqlColumnIndex SQL 列。
   * @return 模板单元格。
   */
  private static TemplateCell resolveTemplateCell(Sheet sheet, SqlSection sqlSection, int targetIndex, int sqlColumnIndex) {
    int sourceRowIndex = sqlSection.startRowIndex() + Math.min(targetIndex, Math.max(sqlSection.lines().size() - 1, 0));
    Row sourceRow = sheet.getRow(sourceRowIndex);
    CellStyle sourceCellStyle = null;
    if (sourceRow != null) {
      Cell sourceCell = sourceRow.getCell(sqlColumnIndex);
      if (sourceCell != null) {
        sourceCellStyle = sourceCell.getCellStyle();
      }
    }
    return new TemplateCell(sourceRow, sourceCellStyle);
  }

  /**
   * 创建红字样式。
   *
   * <p>业务上红字只能改字体颜色，不能破坏原模板的边框、背景、对齐和换行设置。
   *
   * @param workbook 工作簿。
   * @param baseStyle 原样式。
   * @return 红字样式。
   */
  private static CellStyle createRedStyle(Workbook workbook, CellStyle baseStyle) {
    XSSFCellStyle style = (XSSFCellStyle) workbook.createCellStyle();
    if (baseStyle != null) {
      style.cloneStyleFrom(baseStyle);
    }
    XSSFFont font = (XSSFFont) workbook.createFont();
    if (baseStyle != null) {
      Font originalFont = workbook.getFontAt(baseStyle.getFontIndex());
      if (originalFont instanceof XSSFFont originalXssfFont) {
        font.setFontName(originalXssfFont.getFontName());
        font.setFontHeight(originalXssfFont.getFontHeight());
        font.setBold(originalXssfFont.getBold());
        font.setItalic(originalXssfFont.getItalic());
        font.setStrikeout(originalXssfFont.getStrikeout());
        font.setTypeOffset(originalXssfFont.getTypeOffset());
        font.setUnderline(originalXssfFont.getUnderline());
        font.setCharSet(originalXssfFont.getCharSet());
      }
      if (baseStyle instanceof XSSFCellStyle originalStyle) {
        style.setFillForegroundColor(originalStyle.getFillForegroundColorColor());
        style.setFillBackgroundColor(originalStyle.getFillBackgroundColorColor());
        style.setFillPattern(originalStyle.getFillPattern());
      } else {
        style.setFillPattern(FillPatternType.NO_FILL);
      }
    }
    font.setColor(new XSSFColor(RED_RGB, null));
    style.setFont(font);
    return style;
  }

  /**
   * 计算目标序列中的未变化索引。
   *
   * <p>业务上通过最长公共子序列识别未变化项，避免因为插入行导致整段内容都被误判成变化。
   *
   * @param source 原序列。
   * @param target 目标序列。
   * @return 目标侧未变化索引集合。
   */
  private static Set<Integer> findUnchangedTargetIndexes(List<String> source, List<String> target) {
    int[][] dp = new int[source.size() + 1][target.size() + 1];
    for (int sourceIndex = source.size() - 1; sourceIndex >= 0; sourceIndex--) {
      for (int targetIndex = target.size() - 1; targetIndex >= 0; targetIndex--) {
        if (source.get(sourceIndex).equals(target.get(targetIndex))) {
          dp[sourceIndex][targetIndex] = dp[sourceIndex + 1][targetIndex + 1] + 1;
        } else {
          dp[sourceIndex][targetIndex] = Math.max(dp[sourceIndex + 1][targetIndex], dp[sourceIndex][targetIndex + 1]);
        }
      }
    }
    Set<Integer> unchangedTargetIndexes = new LinkedHashSet<>();
    int sourceIndex = 0;
    int targetIndex = 0;
    while (sourceIndex < source.size() && targetIndex < target.size()) {
      if (source.get(sourceIndex).equals(target.get(targetIndex))) {
        unchangedTargetIndexes.add(targetIndex);
        sourceIndex++;
        targetIndex++;
      } else if (dp[sourceIndex + 1][targetIndex] >= dp[sourceIndex][targetIndex + 1]) {
        sourceIndex++;
      } else {
        targetIndex++;
      }
    }
    return unchangedTargetIndexes;
  }

  /**
   * 输出差异报告。
   *
   * <p>业务上报告要明确本次用的 SQLID、Mapper、Bean、输入输出文件，以及字段和 SQL 的逐项差异。
   *
   * @param task 修正任务。
   * @param reportPath 报告路径。
   * @param originalOutputFieldNames 原字段名列表。
   * @param outputItems 目标字段列表。
   * @param changedOutputIndexes 变更字段索引。
   * @param outputStartRowIndex 输出区块起始行。
   * @param originalSqlLines 原 SQL 行。
   * @param targetSqlLines 目标 SQL 行。
   * @param changedSqlIndexes 变更 SQL 索引。
   * @param sqlStartRowIndex SQL 起始行。
   * @throws IOException 写报告失败时抛出。
   */
  private static void writeReport(
      CorrectionTask task,
      Path reportPath,
      List<String> originalOutputFieldNames,
      List<OutputItem> outputItems,
      Set<Integer> changedOutputIndexes,
      int outputStartRowIndex,
      List<String> originalSqlLines,
      List<String> targetSqlLines,
      Set<Integer> changedSqlIndexes,
      int sqlStartRowIndex,
      boolean outputItemsFixed) throws IOException {
    List<String> reportLines = new ArrayList<>();
    Collections.addAll(reportLines,
        "# SQL仕様書 修正报告",
        "",
        "- SQLID: `" + task.sqlId() + "`",
        "- Mapper: `" + task.mapperPath() + "`",
        "- Bean: `" + (task.beanPath() == null ? "<未使用 OutDataBean，仅修正 SQL>" : task.beanPath()) + "`",
        "- 原始工作簿: `" + task.workbookPath() + "`",
        "- 修正后工作簿: `" + task.outputRootPath().resolve(resolvePrefix(task.sqlId())).resolve(task.workbookPath().getFileName()) + "`",
        "",
        "## 取得項目差异",
        "");
    if (!outputItemsFixed) {
      reportLines.add("- 当前任务未开启取得項目修正。");
    } else if (changedOutputIndexes.isEmpty()) {
      reportLines.add("- 无差异，本次未发生取得項目修正。");
    } else {
      for (int targetIndex : changedOutputIndexes) {
        String oldText = targetIndex < originalOutputFieldNames.size() ? originalOutputFieldNames.get(targetIndex) : "<新增行>";
        OutputItem outputItem = outputItems.get(targetIndex);
        reportLines.add("- E" + (outputStartRowIndex + targetIndex + 1) + ": `" + oldText + "` -> `" + outputItem.fieldName() + "`");
      }
    }
    Collections.addAll(reportLines, "", "## SQL 詳細差异", "");
    if (changedSqlIndexes.isEmpty()) {
      reportLines.add("- 无差异，本次未发生 SQL 修正。");
    } else {
      for (int targetIndex : changedSqlIndexes) {
        String oldText = targetIndex < originalSqlLines.size() ? originalSqlLines.get(targetIndex) : "<新增行>";
        String newText = targetSqlLines.get(targetIndex);
        reportLines.add("- C" + (sqlStartRowIndex + targetIndex + 1) + ": `" + oldText + "` -> `" + newText + "`");
      }
    }
    Files.write(reportPath, reportLines, UTF_8);
  }

  /**
   * 读取单元格文本。
   *
   * <p>业务上空行与空单元格统一返回空字符串，减少区块扫描时的空指针判断。
   *
   * @param sheet 目标页签。
   * @param rowIndex 行号。
   * @param columnIndex 列号。
   * @return 单元格文本。
   */
  private static String readCellText(Sheet sheet, int rowIndex, int columnIndex) {
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      return "";
    }
    Cell cell = row.getCell(columnIndex);
    if (cell == null) {
      return "";
    }
    return DATA_FORMATTER.formatCellValue(cell).trim();
  }

  /**
   * 读取单元格样式。
   *
   * <p>业务上样式获取统一封装，避免新增字段或 SQL 行时到处散落空指针分支。
   *
   * @param row 行对象。
   * @param columnIndex 列号。
   * @return 单元格样式。
   */
  private static CellStyle readCellStyle(Row row, int columnIndex) {
    if (row == null) {
      return null;
    }
    Cell cell = row.getCell(columnIndex);
    return cell == null ? null : cell.getCellStyle();
  }

  /**
   * 获取或创建目标行。
   *
   * <p>业务上区块扩容后，新增行需要即时创建才能承接模板样式和文本。
   *
   * @param sheet 页签。
   * @param rowIndex 行号。
   * @return 行对象。
   */
  private static Row getOrCreateRow(Sheet sheet, int rowIndex) {
    Row row = sheet.getRow(rowIndex);
    if (row == null) {
      row = sheet.createRow(rowIndex);
    }
    return row;
  }

  /**
   * 获取或创建目标单元格。
   *
   * <p>业务上新增字段和新增 SQL 行都可能落到原本不存在的单元格位置，因此要统一补建。
   *
   * @param row 行对象。
   * @param columnIndex 列号。
   * @return 单元格对象。
   */
  private static Cell getOrCreateCell(Row row, int columnIndex) {
    Cell cell = row.getCell(columnIndex);
    if (cell == null) {
      cell = row.createCell(columnIndex);
    }
    return cell;
  }

  /**
   * 解析 SQLID 前缀目录。
   *
   * <p>业务上输出目录按 SB、CP、IT 分类，因此这里通过 SQLID 前缀决定成果物子目录。
   *
   * @param sqlId SQLID。
   * @return 前缀目录名。
   */
  private static String resolvePrefix(String sqlId) {
    if (sqlId.startsWith("SB")) {
      return "SB";
    }
    if (sqlId.startsWith("CP") || sqlId.startsWith("cp")) {
      return "CP";
    }
    if (sqlId.startsWith("IT")) {
      return "IT";
    }
    throw new IllegalArgumentException("unsupported sql prefix: " + sqlId);
  }

  /**
   * 去掉文件扩展名。
   *
   * <p>业务上报告文件要复用原规格书文件名，只在尾部追加“修正报告”。
   *
   * @param fileName 原文件名。
   * @return 去扩展名后的文件名。
   */
  private static String removeExtension(String fileName) {
    int lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex >= 0 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  /**
   * 校验输入文件存在。
   *
   * <p>业务上输入缺失属于硬阻塞，需要在执行早期直接失败，而不是继续生成半成品。
   *
   * @param path 目标路径。
   * @param message 失败消息。
   */
  private static void ensureExists(Path path, String message) {
    if (!Files.exists(path)) {
      throw new IllegalArgumentException(message + ": " + path);
    }
  }

  /**
   * 从参数表中取值，不存在时回退默认值。
   *
   * @param overrides 参数映射。
   * @param key 参数名。
   * @param defaultValue 默认值。
   * @return 参数值。
   */
  private static String valueOrDefault(Map<String, String> overrides, String key, String defaultValue) {
    return overrides.getOrDefault(key, defaultValue);
  }

  /**
   * 解析整型参数。
   *
   * @param overrides 参数映射。
   * @param key 参数名。
   * @param defaultValue 默认值。
   * @return 整型值。
   */
  private static int parseIntOrDefault(Map<String, String> overrides, String key, int defaultValue) {
    String value = overrides.get(key);
    return value == null || value.isBlank() ? defaultValue : Integer.parseInt(value);
  }

  /**
   * 解析布尔参数。
   *
   * @param overrides 参数映射。
   * @param key 参数名。
   * @param defaultValue 默认值。
   * @return 布尔值。
   */
  private static boolean parseBooleanOrDefault(Map<String, String> overrides, String key, boolean defaultValue) {
    String value = overrides.get(key);
    return value == null || value.isBlank() ? defaultValue : Boolean.parseBoolean(value);
  }

  /**
   * SQL 区块定位信息。
   *
   * @param startRowIndex SQL 起始行。
   * @param endRowIndex SQL 结束行。
   * @param endMarkerRowIndex 结束标记行。
   * @param lines 当前 SQL 行。
   */
  private record SqlSection(int startRowIndex, int endRowIndex, int endMarkerRowIndex, int sqlColumnIndex, List<String> lines) {
  }

  /**
   * SQL 起始定位结果。
   *
   * @param rowIndex SQL 起始行。
   * @param columnIndex SQL 起始列。
   */
  private record SqlStart(int rowIndex, int columnIndex) {
  }

  /**
   * 输出字段区块定位信息。
   *
   * @param startRowIndex 区块起始行。
   * @param endRowIndex 区块结束行。
   * @param endMarkerRowIndex 结束标记行。
   * @param fieldNames 当前字段名。
   */
  private record OutputSection(int startRowIndex, int endRowIndex, int endMarkerRowIndex, List<String> fieldNames) {
  }

  /**
   * SQL 模板单元格信息。
   *
   * @param sourceRow 模板来源行。
   * @param sourceCellStyle 模板来源样式。
   */
  private record TemplateCell(Row sourceRow, CellStyle sourceCellStyle) {
  }

  /**
   * 输出字段模板样式集合。
   *
   * @param sourceRow 模板来源行。
   * @param numberStyle 序号样式。
   * @param nameStyle 字段名样式。
   * @param typeStyle 类型样式。
   * @param sourceStyle 取得元样式。
   * @param noteStyle 备注样式。
   */
  private record OutputTemplateRow(
      Row sourceRow,
      CellStyle numberStyle,
      CellStyle nameStyle,
      CellStyle typeStyle,
      CellStyle sourceStyle,
      CellStyle noteStyle) {
  }

  /**
   * 输出字段定义。
   *
   * @param fieldName 字段英文名。
   * @param dataType 数据型。
   * @param sourceName 取得元。
   * @param note 备注。
   */
  private record OutputItem(String fieldName, String dataType, String sourceName, String note) {
  }

  /**
   * 修正任务配置。
   *
   * @param sqlId SQLID。
   * @param workbookPath 原规格书路径。
   * @param sheetName 页签名。
   * @param mapperPath Mapper 路径。
   * @param beanPath Bean 路径。
   * @param outputRootPath 输出根目录。
   * @param outputItemStartRowIndex 取得項目起始行（0 基）。
   * @param outputNameColumnIndex 字段名列（0 基）。
   * @param outputTypeColumnIndex 类型列（0 基）。
   * @param outputSourceColumnIndex 取得元列（0 基）。
   * @param outputNoteColumnIndex 备注列（0 基）。
   * @param sqlColumnIndex SQL 文本列（0 基）。
   * @param endMarkerColumnIndex 结束标记列（0 基）。
   * @param sectionTitleColumnIndex 标题列（0 基）。
   * @param fixOutputItems 是否修正取得項目。
   */
  private record CorrectionTask(
      String sqlId,
      Path workbookPath,
      String sheetName,
      Path mapperPath,
      Path beanPath,
      Path outputRootPath,
      int outputItemStartRowIndex,
      int outputNameColumnIndex,
      int outputTypeColumnIndex,
      int outputSourceColumnIndex,
      int outputNoteColumnIndex,
      int sqlColumnIndex,
      int endMarkerColumnIndex,
      int sectionTitleColumnIndex,
      boolean fixOutputItems) {
  }

  /**
   * 修正执行结果。
   *
   * @param task 执行任务。
   * @param outputWorkbookPath 修正后工作簿路径。
   * @param reportPath 差异报告路径。
   * @param changedOutputFieldCount 变更字段数。
   * @param changedSqlLineCount 变更 SQL 行数。
   */
  private record CorrectionResult(
      CorrectionTask task,
      Path outputWorkbookPath,
      Path reportPath,
      int changedOutputFieldCount,
      int changedSqlLineCount,
      boolean modified) {
  }

  /**
   * 工作簿发现结果。
   *
   * @param sqlId 从规格书内部抽出的唯一 SQLID。
   * @param sheetName 规格书首个页签名。
   */
  private record WorkbookDiscovery(String sqlId, String sheetName) {
  }

  /**
   * 运行时目录集合。
   *
   * @param projectRoot 工程根目录。
   * @param docRoot 规格书根目录。
   * @param toolRoot 工具专属文件根目录。
   * @param outRoot 输出根目录。
   * @param sbMapperPath SB Mapper 文件全路径。
   * @param cpMapperPath CP Mapper 文件全路径。
   * @param itMapperPath IT Mapper 文件全路径。
   * @param sbBeanRoot SB Bean 根目录。
   * @param cpBeanRoot CP Bean 根目录。
   * @param itBeanRoot IT Bean 根目录。
   * @param defaultWorkbookPath main 无参数样例规格书全路径。
   */
  private record RuntimePaths(
      Path projectRoot,
      Path docRoot,
      Path toolRoot,
      Path outRoot,
      Path sbMapperPath,
      Path cpMapperPath,
      Path itMapperPath,
      Path sbBeanRoot,
      Path cpBeanRoot,
      Path itBeanRoot,
      Path defaultWorkbookPath) {
  }

  /**
   * 批量执行结果。
   *
   * @param docRoot 规格书扫描根目录。
   * @param outRoot 输出根目录。
   * @param limit 本次批量上限。
   * @param discoveredTaskCount 实际进入执行的任务数。
   * @param successResults 成功结果。
   * @param failureMessages 失败信息。
   */
  private record BatchRunResult(
      Path docRoot,
      Path outRoot,
      int limit,
      int discoveredTaskCount,
      List<CorrectionResult> modifiedResults,
      List<CorrectionResult> unchangedResults,
      List<String> failureMessages,
      Path unchangedListPath) {
  }
}
