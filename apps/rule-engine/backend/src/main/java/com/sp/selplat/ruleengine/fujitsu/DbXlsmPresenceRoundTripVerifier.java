package com.sp.selplat.ruleengine.fujitsu;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.sp.selplat.ruleengine.fujitsu.db.DBデータ生成ツール;

/**
 * XLSM の存在清单を使った Java 反向同期が、欠落・空表・有记录を往復保持することを検証します。
 */
public class DbXlsmPresenceRoundTripVerifier {

  /** JSON を構造比較し、整形差ではなく fixture 意味を検証する mapper です。 */
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /**
   * 旧 VBA の空 JSON 汚染を再現した後、Java 反向同期で元 fixture 集合へ戻ることを検証します。
   *
   * @param args XLSM、dbRoot、mode、物理表、欠落 Case、空表 Case、有记录 Case の順です。
   * @throws Exception JSON 読書きまたは検証に失敗した場合に送出します。
   */
  public static void main(String[] args) throws Exception {
    // 业务上三状态边界を明示するため、対象路径と Case をすべて参数で受け取ります。
    if (args.length != 7) {
      throw new IllegalArgumentException(
          "Usage: DbXlsmPresenceRoundTripVerifier <xlsm> <dbRoot> <mode> <table>"
              + " <absentCase> <emptyCase> <dataCase>");
    }
    // 业务上工作簿和 fixture 根分别管理，测试仅修改调用方准备的临时副本。
    Path xlsmPath = Path.of(args[0]);
    Path databaseRoot = Path.of(args[1]);
    String mode = args[2];
    String physicalTableName = args[3];
    String absentCase = args[4];
    String emptyCase = args[5];
    String dataCase = args[6];
    // 业务上反向同步前保存全部 JSON 语义快照，用于检出邻接表或其他 Case 回归。
    Map<String, JsonNode> expectedSnapshot = readJsonSnapshot(databaseRoot.resolve("testCase"));
    // 业务上分别确认缺失、明确空表和有记录三个前置状态，避免测试数据本身不成立。
    Path absentJson = resolveJson(databaseRoot, absentCase, mode, physicalTableName);
    Path emptyJson = resolveJson(databaseRoot, emptyCase, mode, physicalTableName);
    Path dataJson = resolveJson(databaseRoot, dataCase, mode, physicalTableName);
    require(!Files.exists(absentJson), "absent fixture unexpectedly exists: " + absentJson);
    require(readRecordCount(emptyJson) == 0, "empty fixture is not empty: " + emptyJson);
    require(readRecordCount(dataJson) > 0, "data fixture has no records: " + dataJson);
    // 业务上模拟旧 VBA 对本应缺失 Case 生成 tableData=[]，稳定复现本次故障。
    Files.createDirectories(absentJson.getParent());
    Map<String, Object> pollutedPayload = new LinkedHashMap<>();
    pollutedPayload.put("physicalTableName", physicalTableName);
    pollutedPayload.put("tableData", List.of());
    Files.writeString(absentJson, OBJECT_MAPPER.writeValueAsString(pollutedPayload),
        StandardCharsets.UTF_8);
    require(Files.exists(absentJson), "failed to reproduce legacy empty JSON pollution");
    // 业务上调用正式 Java 反向入口，由存在清单删除伪文件并保留明确空表及有记录数据。
    DBデータ生成ツール.exportDatabase(xlsmPath, databaseRoot);
    // 业务上全目录 JSON 结构必须回到污染前快照，证明修复没有损伤相邻 fixture。
    Map<String, JsonNode> actualSnapshot = readJsonSnapshot(databaseRoot.resolve("testCase"));
    require(expectedSnapshot.equals(actualSnapshot),
        "round-trip JSON snapshot mismatch: actual=" + actualSnapshot.keySet()
            + ", expected=" + expectedSnapshot.keySet());
    // 业务上固定成功文言供离线任务识别三状态回归已闭环。
    System.out.println("VERIFIED: absent, explicit-empty and populated JSON states round-trip exactly.");
  }

  /** Case/mode/物理表から fixture JSON パスを組み立てます。 */
  private static Path resolveJson(Path databaseRoot, String caseId, String mode,
      String physicalTableName) {
    // 业务上路径严格限定在 db/testCase/<Case>/<mode>/<table>.json。
    return databaseRoot.resolve("testCase").resolve(caseId).resolve(mode)
        .resolve(physicalTableName + ".json");
  }

  /** JSON の tableData record 件数を返します。 */
  private static int readRecordCount(Path jsonPath) throws IOException {
    // 业务上边界 fixture 必须实际存在，缺失时立即失败而不是当作空表。
    require(Files.isRegularFile(jsonPath), "fixture not found: " + jsonPath);
    JsonNode tableData = OBJECT_MAPPER.readTree(Files.readString(jsonPath)).path("tableData");
    return tableData.isArray() ? tableData.size() : -1;
  }

  /** testCase 配下の全 JSON を相対パス順の構造快照として読み取ります。 */
  private static Map<String, JsonNode> readJsonSnapshot(Path testCaseDirectory)
      throws IOException {
    // 业务上 TreeMap 固定文件顺序，失败日志可以直接比较缺失或多余路径。
    Map<String, JsonNode> snapshot = new TreeMap<>();
    try (var stream = Files.walk(testCaseDirectory)) {
      for (Path jsonPath : stream
          .filter(Files::isRegularFile)
          .filter(path -> path.getFileName().toString().endsWith(".json"))
          .sorted().toList()) {
        // 业务上使用相对路径作为键，临时验证根变化不会影响语义比较。
        String relativePath = testCaseDirectory.relativize(jsonPath).toString();
        snapshot.put(relativePath, OBJECT_MAPPER.readTree(Files.readString(jsonPath)));
      }
    }
    return snapshot;
  }

  /** 条件不成立时即座に検証を失敗させます。 */
  private static void require(boolean condition, String message) {
    // 业务上测试失败必须携带直接可定位的状态或路径。
    if (!condition) {
      throw new IllegalStateException(message);
    }
  }
}
