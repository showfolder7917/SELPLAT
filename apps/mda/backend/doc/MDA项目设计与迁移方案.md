# MDA 多数据库工作台设计与迁移方案

## 1. 目标与边界

MDA 是 SELPLAT 下独立的数据库工作台，负责保存连接、测试连接、读取数据库/模式/表/字段树，以及执行前端原样提交的 SQL。支持 H2、MySQL、SQL Server、Oracle、PostgreSQL。

本次明确放弃旧实现中的“安全查询”双轨设计：服务端不检查 SQL 关键字、不限制为 SELECT、不改写用户 SQL，也不按分号拆句。`Statement.execute(sql)` 直接执行一个完整 JDBC SQL 载荷，因此 DDL、DML、存储过程以及驱动允许的多结果集都可返回。批量多语句是否可用由目标 JDBC 驱动和连接参数决定。

仍保留三类运行保护，它们不改变 SQL 权限：连接配置中的自动提交开关、查询超时、最大返回行数。数据库账号权限是最终权限边界。

## 2. 数据库设计

连接配置永久存储于 `apps/mda/db/mda.mv.db` 的 `MdaConnectionProfile`。默认查询工作库永久存储于
`apps/mda/db/mda-workspace.mv.db`，用于直接展示表结构和前台查询；外部目标数据库数据不复制到控制库。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT PK | 控制库 identity 生成 |
| tenantId | BIGINT | 租户标识 |
| lastOperateUserId | BIGINT | 最近操作用户 |
| connectionName | VARCHAR(120) UNIQUE | 页面显示名称 |
| databaseType | VARCHAR(20) | H2/MYSQL/SQLSERVER/ORACLE/POSTGRESQL |
| host/port | VARCHAR/INTEGER | 服务地址与端口 |
| databaseName | VARCHAR(240) | 数据库名、H2 路径或 Oracle service name |
| schemaName | VARCHAR(120) | 默认 schema，可空 |
| username | VARCHAR(120) | 登录用户 |
| passwordCiphertext | VARCHAR(1000) | AES/GCM 加密口令，不返回前端 |
| customJdbcUrl | VARCHAR(1000) | 可选完整 JDBC URL，优先于自动拼接 |
| jdbcParameters | VARCHAR(1000) | 自动 URL 的附加参数 |
| defaultAutoCommit | BOOLEAN | SQL 执行默认自动提交 |
| sortnum/status | DECIMAL/INTEGER | 公共排序、逻辑状态 |
| createdAt/updatedAt | TIMESTAMP | 创建、更新时间 |

密钥取环境变量 `MDA_SECRET_KEY`；本地未配置时使用开发密钥，生产部署必须覆盖。更新连接时不传 `password` 会保留原口令，传入时重新加密。

## 3. 模块结构

```text
apps/mda/backend
├─ config      统一宿主模块入口与独立数据库配置
├─ connection  连接配置 Repository、Service、Controller 与口令加密
├─ jdbc        五类驱动定义、动态连接、元数据和原始 SQL 执行
├─ persistence MDA 独立 JDBC 上下文
└─ resources
   ├─ schema-mda.sql / schema-mda-workspace.sql
   └─ static/mda  页面装配、布局和交互
```

连接配置通过 MDA 专用 JDBC 上下文访问，不继承平台主数据源 DAO。元数据和 SQL 执行属于跨数据库 JDBC 能力，不伪装成业务表 DAO。MDA 可以被 8080 统一宿主显式导入，也保留 8082 独立启动入口。

## 4. API 结构

所有响应由 Service 构造为 `CommonResult` 或 `CommonPageResult`，Controller 只序列化。

| 方法 | 路径 | 主要入参 | 返回 data |
| --- | --- | --- | --- |
| GET | `/api/mda/connections` | 无 | 全部有效连接 |
| GET | `/api/mda/connections/{id}` | 路径 id | 脱敏连接详情 |
| POST | `/api/mda/connections` | 连接字段、password | 新连接 |
| POST | `/api/mda/connections/{id}` | 需更新字段 | 更新结果 |
| POST | `/api/mda/connections/{id}/delete` | 路径 id | 逻辑删除结果 |
| POST | `/api/mda/connections/test` | connectionId 或未保存连接字段 | 测试结果与数据库产品信息 |
| POST | `/api/mda/metadata/tree.htm` | connectionId | catalogs/schemas/tables/columns 树 |
| POST | `/api/mda/sql/execute.htm` | connectionId/sql/autoCommit/maxRows/queryTimeoutSeconds | 多结果集、更新计数、警告与耗时 |

SQL 返回中的结果集包含 `columns`、`rows`、`rowCount`、`truncated`；更新结果包含 `updateCount`。二进制转 Base64，大字段按配置上限读取。

## 5. 旧代码迁移映射

| 旧实现 | 问题 | MDA 替代 |
| --- | --- | --- |
| `DBFactory` | 修改传入对象、类型分支残缺 | 不可变驱动注册表与统一 URL 构建 |
| `DBBaseSource` | 连接、事务、查询、UI 配置混杂 | `JdbcConnectionFactory`、元数据服务、SQL 服务分离 |
| `DBBaseSafe/DBBaseSafeNo` | 安全/非安全双体系，结果与 ExtJS 耦合 | 单一原始 SQL 执行器，输出中立 JSON |
| `DBH2Exe/DbH2/DbMySql` | 重复元数据 SQL、依赖厂商系统表 | JDBC `DatabaseMetaData` |
| `H2Controller/H2ServiceImpl` | SQL、备份、代码生成、文件转换全混在一个服务 | 只迁移连接、元数据、SQL 三项目标能力 |
| `DbOracleTest` | 注释代码和历史凭据 | 不迁移任何凭据，仅保留 Oracle 驱动定义 |

以下旧能力明确淘汰：ExtJS 表格/表单 JSON、H2 专用备份与 CRUD SQL 生成、代码与文本转换、`FTSGCOLUMN`、ROWID 正则分页、按分号切 SQL、硬编码账号口令。

## 6. 分阶段迁移与回退

1. MDA 使用独立配置库，可在统一 8080 宿主或独立 8082 端口运行，不改动 `xsd-fts`。
2. 先用 H2 验证连接保存、树浏览、SELECT、DDL/DML、更新计数和异常返回。
3. 投放四种厂商驱动后，逐库验证 URL、catalog/schema 可见性、存储过程与多结果集。
4. 业务入口切换到 MDA 后，再由人工决定旧 `h2` 包的下线时间；本次不删除旧工程文件。

回退只需停止 MDA 并恢复旧入口，因为目标库没有迁移，MDA 也不会接管旧配置表。

## 7. 驱动与运行注意事项

- H2：`org.h2.Driver`，仓库当前可离线运行。
- MySQL：`com.mysql.cj.jdbc.Driver`。
- SQL Server：`com.microsoft.sqlserver.jdbc.SQLServerDriver`。
- Oracle：`oracle.jdbc.OracleDriver`。
- PostgreSQL：`org.postgresql.Driver`。

四个厂商驱动当前不在 SELPLAT 离线缓存内。投放时必须使用组织批准版本，并遵守各驱动许可；把标准命名的 JAR 放入 `cache/cache-jars` 后 MDA 会自动加入运行类路径，未投放时测试连接会返回明确的“驱动未安装”错误。

由于页面可执行任意 SQL，生产环境应使用按用途分配的数据库账号、网络访问控制、数据库审计和连接级资源限制。MDA 不以 SQL 文本过滤替代数据库权限。
