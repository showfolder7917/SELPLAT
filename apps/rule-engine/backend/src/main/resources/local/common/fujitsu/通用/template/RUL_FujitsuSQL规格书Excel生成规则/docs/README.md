# ACode Java 规则工具

ACode Java 工具已经并入 `apps/rule-engine/backend`，与规则、文档、模板和样例组成一个可独立编译的规则单元。

## 目录

```text
src/main/
├─ java/com/sp/selplat/local/code/common/fujitsu/app/
│  ├─ db/                       可人工或 AI 调用的 DB 应用
│  └─ sql/                      可人工或 AI 调用的 SQL 规格书应用
└─ resources/local/common/fujitsu/通用/
   ├─ rule/                     Fujitsu 通用规则
   └─ template/RUL_FujitsuSQL规格书Excel生成规则/
      ├─ docs/                  使用文档
      └─ SQL仕様書生成ツール/  SQL 规格书配置与参考模板
```

规则单元内部不再维护 `lib`、`build`、`work` 或独立 `.vscode`：

- 编译和测试统一使用工程根 `gradlew`。
- class 和 Gradle 构建报告统一进入工程根 `build`。
- 工具运行生成的业务数据、中间文件、日志和验证输出统一进入当前工程 `OPTION/temp`。
- Gradle 缓存和全部离线 JAR 统一从工程根 `cache` 读取。
- VS Code 从 SELPLAT 根工作区运行 `rule-engine:classes` 或 `acode-java: compile`。

## 编译

在 SELPLAT 工程根执行：

```powershell
.\gradlew.bat --offline --console plain :apps:rule-engine:backend:classes
```

编译结果位于：

```text
build/apps/rule-engine/backend/classes/java/main
```

## DB 数据工具

通用入口：

```text
com.sp.selplat.local.code.common.fujitsu.app.db.DBデータ生成ツール
```

通用工具保留 `--import-all <xlsmPath> <dbRoot>` 和 `--export-all <xlsmPath> <dbRoot>`。`dbRoot` 必须同时包含 `define` 与 `testCase`。工作簿保存中间文件进入目标工程的 `OPTION/temp`，结束后自动清理。

`--import-all` 会在工作簿内写入 very hidden 的 `_acode_json_presence` 清单，以 Case、input/expect、物理表三个维度区分 JSON 不存在、明确空表和有记录三种状态；需要无损反向同步时必须使用 Java `--export-all`。

## SQL 规格书工具

通用入口：

```text
com.sp.selplat.local.code.common.fujitsu.app.sql.SQL仕様書生成ツール
```

默认配置位于 `resources/local/common/fujitsu/通用/template/RUL_FujitsuSQL规格书Excel生成规则/SQL仕様書生成ツール/SQL仕様書生成ツール新規.json`，参考模板位于其 `reference/` 子目录，生成结果默认进入 `OPTION/temp/sql-spec`。详细配置见当前 `docs/` 中的《SQL仕様書生成ツール使用说明》。
