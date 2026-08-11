# reference-data database

本目录是 reference-data 自己的权威本地数据库根，只保存可追踪的结构与初始化 SQL 和正式运行数据。

## 目录约定

```text
db/
├── sql/                 # 纳入版本管理的表结构与初始化数据脚本
└── reference-data.mv.db # 永久 H2 文件数据库，运行文件不提交 Git
```

正式数据库文件：

```text
apps/reference-data/db/reference-data.mv.db
```

本地正式库统一使用用户名 `sa`、默认密码 `123456`；测试必须通过测试属性显式覆盖，禁止连接正式文件。

应用启动时按 Java 中登记的 `sql/*.sql` 固定顺序初始化结构。七个数据脚本均为空脚本，启动和重启都不会自动写入任何业务记录。

六张业务表分别负责类型目录、树形节点、下拉选项、右键菜单项、页面表格登记和页面表格头配置，`CommonSequenceSegment` 负责主键号段。`ReferenceDataTable` 使用 `projectName + gridColumnId` 唯一登记一个页面表格；点击记录后按 `tableName + gridColumnId` 进入 `ReferenceDataTableColumn` 明细。

## SQL 编写约定

- 表结构文件使用 `schema-<实际表名>.sql`，初始化数据文件使用 `data-<实际表名>.sql`；文件中的实际表名必须与文件名完全一致。
- 一个 `schema-<实际表名>.sql` 只允许创建对应的一张正式业务表，不得把多张表合并到含义模糊的 `tables.sql` 中。
- 每张业务表使用 `<实际表名>Id` 独立号段；管理员开始新增业务数据前，必须先为该表在 `CommonSequenceSegment` 手动建立一条启用记录，禁止多表共用一个 seqCode。
- `CommonSequenceSegment` 自身为避免循环发号可保留 identity；其余业务表主键必须由公共 SequenceGenerator 生成。
- 七张表初始必须全部为空；后续手工建立的数据使用六位主键规范，禁止写入超出六位的固定初始 ID。
- 每张表和每个字段必须在定义旁写明业务用途；状态、枚举、外键、唯一约束和索引必须说明取值或设置原因，不能只复述 SQL 语法。
- 表和字段必须同时声明 `COMMENT ON TABLE`、`COMMENT ON COLUMN`，保证数据库元数据查询也能直接看到中文业务含义。
- 初始化数据脚本不得包含 INSERT、MERGE 或 UPDATE；服务重启既不补数据，也不覆盖管理后台后来维护的数据。
- SQL 变更至少使用隔离 H2 执行一次首次初始化和重复初始化验证，禁止使用 `db/reference-data.mv.db` 正式文件作为测试库。

## 边界

- 本目录不得存放构建产物、缓存、日志、临时文件或测试数据库。
- 测试使用内存数据库或测试临时目录，禁止连接这里的正式文件。
- 运行数据库文件由 `.gitignore` 排除；SQL、说明和空目录标记必须提交。
- 备份时应在应用停止写入后复制 `reference-data.mv.db`。
