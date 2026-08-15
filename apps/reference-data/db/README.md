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

应用启动时按 Java 中登记的 `sql/*.sql` 固定顺序初始化结构。全新数据库只建立六张业务表和全局号段，
不写固定业务主键；旧正式库由一次性迁移器通过现有 Service 新增链装入数据。

六张业务表为 `ReferenceDataType`、`ReferenceDataTreeNode`、`ReferenceDataTable`、
`ReferenceDataTableElement`、`ReferenceDataControlLayout`、`ReferenceDataWindow`。
全部新增记录共享 `ReferenceDataObjectId` 号段，并由后端用“对象类型前缀 + id”生成不可变 code；
表格元素只通过真实外键 `tableId` 归属父表，公开定位只使用 code。

对象前缀固定为 `page/window/control/table/tableElement/type`；统一节点表再按所属类型使用
`dropdownOption/treeNode/gridMenuItem/panelMenuItem/contextMenuItem`。前缀便于人工识别，关联关系仍只依靠
`typeId`、`tableId`、`pageCode` 以及 `parentKind + parentCode`，禁止解析前缀代替外键。

## SQL 编写约定

- 表结构文件使用 `schema-<实际表名>.sql`，初始化数据文件使用 `data-<实际表名>.sql`；文件中的实际表名必须与文件名完全一致。
- 一个 `schema-<实际表名>.sql` 只允许创建对应的一张正式业务表，不得把多张表合并到含义模糊的 `tables.sql` 中。
- 引用数据六表作为同一全局 code 命名空间，共享 `ReferenceDataObjectId` 号段；其他普通业务表仍遵守一表一号段。
- `CommonSequenceSegment` 自身为避免循环发号可保留 identity；其余业务表主键必须由公共 SequenceGenerator 生成。
- 初始化脚本不得写固定业务主键；迁移与管理后台新增都必须经过 BaseService → Sequence → code 生成链。
- 每张表和每个字段必须在定义旁写明业务用途；状态、枚举、外键、唯一约束和索引必须说明取值或设置原因，不能只复述 SQL 语法。
- 表和字段必须同时声明 `COMMENT ON TABLE`、`COMMENT ON COLUMN`，保证数据库元数据查询也能直接看到中文业务含义。
- 六张业务表初始化脚本不得写业务数据；只有全局号段允许使用
  `INSERT ... SELECT ... WHERE NOT EXISTS` 补充缺失记录，禁止覆盖用户布局。
- SQL 变更至少使用隔离 H2 执行一次首次初始化和重复初始化验证，禁止使用 `db/reference-data.mv.db` 正式文件作为测试库。

## 边界

- 本目录不得存放构建产物、缓存、日志、临时文件或测试数据库。
- 测试使用内存数据库或测试临时目录，禁止连接这里的正式文件。
- 运行数据库文件由 `.gitignore` 排除；SQL、说明和空目录标记必须提交。
- 备份时应在应用停止写入后复制 `reference-data.mv.db`。
