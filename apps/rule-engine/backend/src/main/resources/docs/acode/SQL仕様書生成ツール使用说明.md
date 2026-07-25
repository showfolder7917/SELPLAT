# SQL仕様書生成ツール使用说明

## 1. 用途

`SQL仕様書生成ツール.java` 是 JSON 数据驱动的通用 SQL 规格书生成器。

它从目标 Java 检查 SQL 调用，从本机 Mapper XML 或离线源码 JAR 读取真实 SQL，然后复制 `参照XLS` 模板，为每条 SQL 生成一个 XLSX 文件和一个可见 Sheet。

默认示例配置为 `SQL仕様書生成ツール新規.json`。该 JSON 当前完整描述 CPMAB081 使用的 8 条 SQL，也可复制后用于其他程序。

## 2. 文件位置

- 通用生成器：`src/main/java/com/sp/selplat/ruleengine/fujitsu/sql/SQL仕様書生成ツール.java`
- 新规示例 JSON：`src/main/resources/templates/sql-spec/SQL仕様書生成ツール新規.json`
- 通用格式 Demo：`src/main/resources/templates/sql-spec/reference/SQL仕様書_アラート情報一括登録.xlsx`
- 默认输出：`OPTION/temp/sql-spec/`
- 兼容入口：`src/main/java/com/sp/selplat/ruleengine/fujitsu/sql/CPMAB081SQL仕様書生成ツール.java`

## 3. JSON 顶层结构

```json
{
  "version": "1.0",
  "templatePath": "reference/SQL仕様書_アラート情報一括登録.xlsx",
  "outputDirectory": "C:/absolute/output/path",
  "fileNamePrefix": "SQL仕様書_",
  "batchSourcePath": "C:/absolute/path/TargetBatch.java",
  "functionName": "功能名称",
  "mapperSources": [],
  "sqlSpecifications": []
}
```

字段说明：

- `version`：JSON 结构版本，当前为 `1.0`。
- `templatePath`：参考 XLSX。相对路径以 JSON 所在目录为基准，也可写绝对路径。
- `outputDirectory`：成果物输出目录，必须位于当前工程的 `OPTION/temp`。
- `fileNamePrefix`：输出文件名前缀，通常使用 `SQL仕様書_`。
- `batchSourcePath`：被分析 Java。填写后会确认 JSON 中每个 SQL ID 都在该 Java 中被调用；不需要检查时可设为 `null`。
- `functionName`：写入模板功能名称区域的文本。
- `mapperSources`：SQL 正文来源，可配置多个。
- `sqlSpecifications`：要生成的 SQL 规格数据，一条记录对应一个 XLSX。

通用格式固定采用 `SQL仕様書_アラート情報一括登録.xlsx`。第 16、23、28、36 行分别是利用表、取得项、参数和数据结构的首行；每条数据占独立的 15pt 行，后续区块按数据件数整体顺延。SQL 详情的基准起始位置是第 54 行，实际行号随前置数据行增加，分页固定移动到 SQL 详情标题之前。

数据结构明细行按 `No／名前／エイリアス／カテゴリ／結合有無／結合方法／結合条件` 七个列组进行合并，每个列组必须具有完整 `thin` 实线外框；多表产生的动态结构行使用相同格线。

生成完成后，工具会清理 Demo 遗留的 `calcChain.xml`、SQL 名数组公式和 Drawing 注记，因此输出不会包含 `固定文字列として変換対象とする。`、`※動的SQLパターン1` 或相应虚线框。

## 4. Mapper 来源结构

普通 Mapper XML：

```json
{
  "kind": "XML_FILE",
  "path": "C:/path/Mapper.xml",
  "entry": null
}
```

离线源码 JAR 内的 Mapper：

```json
{
  "kind": "JAR_ENTRY",
  "path": "C:/path/common-sources.jar",
  "entry": "mapper/CommonMapper.xml"
}
```

工具不会联网下载 Mapper、JAR 或依赖。

## 5. 单条 SQL 数据结构

```json
{
  "id": "SampleQSelectData",
  "name": "示例数据取得",
  "overview": "根据输入条件取得示例数据。",
  "type": "SELECT",
  "operation": "NEW",
  "baseWorkbookPath": null,
  "tables": [
    {
      "logicalName": "示例信息",
      "physicalName": "TB_SAMPLE",
      "lock": "なし",
      "note": "-"
    }
  ],
  "parameters": [
    {
      "logicalName": "示例代码",
      "fieldName": "sampleCd",
      "dataType": "VARCHAR",
      "note": "检索条件"
    }
  ],
  "outputs": [
    {
      "logicalName": "示例名称",
      "fieldName": "sampleNm",
      "dataType": "VARCHAR",
      "note": "出力データBean"
    }
  ]
}
```

约束：

- `id` 必须与 Mapper 的 `select/insert/update/delete` 元素 `id` 完全一致。
- `name` 同时用于文件名、Sheet 名和 SQL 名，不得重复。
- `type` 使用 `SELECT`、`INSERT`、`UPDATE` 或 `DELETE`。
- `operation` 使用 `NEW` 或 `CORRECT`。`NEW` 从顶层 `templatePath` 生成；`CORRECT` 从该记录的 `baseWorkbookPath` 修正。
- `baseWorkbookPath` 在 `NEW` 时设为 `null`，在 `CORRECT` 时必须填写已有 XLSX 路径。
- `tables` 至少一项。
- 没有参数或取得项时填写空数组 `[]`，不要删除字段。
- `parameters` 与 `outputs` 中的 `fieldName` 应与 DataBean 字段一致。
- `parameters` 与 `outputs` 中的 `dataType` 必须填写实际 Java 声明，例如 `String`、`List<Map<String, String>>` 或具体 DataBean 类名；禁止填写 `VARCHAR`、`INT`、`LIST`、`BEAN` 等数据库类型或占位类型。

## 6. 新规生成步骤

1. 复制 `SQL仕様書生成ツール新規.json`，使用新的明确文件名保存。
2. 修改模板、输出目录、目标 Java 和 Mapper 来源。
3. 将 `sqlSpecifications` 替换为目标 Java 实际使用的 SQL。
4. 根据 Mapper 和 DataBean 填写表、参数及取得项。
5. 离线编译并传入 JSON 路径执行。
6. 执行验证器或至少检查文件数量、Sheet、SQLID、SQL 名、SQL 详情和印刷区域。
7. 打开 Excel 前可通过 ZIP/OOXML 检查确认不存在 `xl/calcChain.xml` 和 `xl/drawings/drawing1.xml`。
8. 取得项和参数区块在明细后一行的 C 列红框写 `E`；空区块仍保留空白明细行，再在下一行写红框 `E`。
9. SQL 详情的末尾固定为“最后一行 SQL → B:BP 全宽底线行 → A 列红框 `E` 行”，打印区域结束于红框 `E` 行；不得让模板底线混入 SQL 正文。

## 7. 修正已有规格书

修改对应 JSON 记录，将 `operation` 改为 `CORRECT`，并在 `baseWorkbookPath` 填写已有规格书路径后重新执行。工具会把修正结果写入标准输出文件；输入文件与输出文件不是同一路径时不会修改输入原本。

若只修正一条 SQL，可创建只包含该 SQL 的 JSON，并将 `batchSourcePath` 设置为对应调用源或 `null`。输出目录中其他文件不会被工具主动删除。

## 8. 执行命令

在 SELPLAT 工程根执行：

```powershell
.\gradlew.bat --offline --console plain :apps:rule-engine:backend:classes
```

无参数运行默认 JSON：

```powershell
& 'C:\Program Files\Eclipse Adoptium\jdk-21.0.6.7-hotspot\bin\java.exe' `
  '-Dfile.encoding=UTF-8' `
  -cp 'build\apps\rule-engine\backend\classes\java\main;cache\cache-jars\*' `
  'com.sp.selplat.ruleengine.fujitsu.sql.SQL仕様書生成ツール'
```

指定其他 JSON：

```powershell
& 'C:\Program Files\Eclipse Adoptium\jdk-21.0.6.7-hotspot\bin\java.exe' `
  '-Dfile.encoding=UTF-8' `
  -cp 'build\apps\rule-engine\backend\classes\java\main;cache\cache-jars\*' `
  'com.sp.selplat.ruleengine.fujitsu.sql.SQL仕様書生成ツール' `
  'C:\absolute\path\自定义SQL仕様书.json'
```

也可以先在 VS Code 中执行任务 `acode-java: compile`，再使用对应 Java 启动项。

## 9. 常见失败

- `Java 呼出元に存在しない SQL ID`：JSON 的 SQL ID 未在 `batchSourcePath` 对应 Java 中调用。
- `Mapper SQL が見つかりません`：Mapper 来源不正确，或 Mapper 中没有对应 ID。
- `JAR 内 Mapper が見つかりません`：`entry` 不是 JAR 内的准确路径。
- `SQL ID が重複しています`：`sqlSpecifications` 内存在重复 ID。
- `SQL 名が重複しています`：两个记录会生成相同文件名，必须改为唯一名称。
