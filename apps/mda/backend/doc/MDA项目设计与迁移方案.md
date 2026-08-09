# MDA 多数据库工作台设计方案

## 1. 目标

MDA 负责管理数据库连接、浏览 catalog/schema/table/column，并执行用户提交的 JDBC SQL。支持 H2、MySQL、SQL Server、Oracle 和 PostgreSQL。

MDA 是本地开发工具，不部署到生产环境。根据当前项目约定，数据库密码以明文保存并通过连接详情接口原样返回，便于直接编辑和重新连接。

## 2. 数据库结构

MDA 只维护一个永久控制库：`apps/mda/db/mda.mv.db`。

`MdaConnectionProfile` 保存：

| 字段 | 作用 |
| --- | --- |
| connectionName | 页面显示的连接名称 |
| databaseType | H2/MYSQL/SQLSERVER/ORACLE/POSTGRESQL |
| host、port | 服务地址和端口 |
| databaseName | 数据库名、H2 路径或 Oracle service name |
| schemaName | 默认 schema |
| username、password | 目标库账号和明文密码 |
| customJdbcUrl | 优先使用的完整 JDBC URL |
| jdbcParameters | 自动 URL 的附加参数 |
| defaultAutoCommit | SQL 默认自动提交设置 |
| sortnum、status | 排序和逻辑状态 |

旧版 `mda-workspace.mv.db` 和自动生成的“MDA 本地工作库”连接已退出架构。控制库不保存目标数据库的业务表和数据。

## 3. 分层边界

```text
页面公共组件
  → MDA Controller
    → 连接配置 Service → MDA 私有控制库 DAO → MdaControlPool → mda.mv.db
    → 元数据/SQL Service → JdbcConnectionFactory → 目标连接池注册表 → 动态目标数据库
```

- 连接配置是 MDA 控制库中的 CRUD。
- 元数据和 SQL Controller/Service 面向运行期选中的任意目标库，不属于固定业务表 CRUD。
- MDA 控制库不能注入为统一宿主的主 `DataSource`，否则会把其他应用的公共 BaseDao 指向错误数据库。
- 因此控制库使用限定名为 `mdaControlDataSource`、`mdaControlJdbcTemplate`、`mdaTransactionManager` 和 `mdaBaseDataSourceContext` 的模块私有上下文；连接配置 DAO 继续通过 MDA 项目 BaseDao 复用公共 CRUD。
- 每份有效目标连接定义拥有一个独立 Hikari 小型池；请求关闭逻辑连接时只是归还连接池，不会重新创建物理连接。
- 连接配置更新或删除后立即关闭旧池；目标池长期闲置且没有活动连接时自动回收，应用停止时关闭全部池。
- 元数据树使用短时内存缓存；SQL 成功执行后清除当前连接的结构缓存，以便 DDL 结果及时反映到页面。
- 连接池和缓存参数统一维护在 `mda-module.properties`，测试环境使用 `application-test.properties` 覆盖为隔离 H2 内存控制库。

### 3.1 包结构

```text
com.sp.selplat.mda
├── common
│   ├── config
│   │   └── MdaModuleConfiguration
│   └── persistence
│       ├── MdaBaseDao
│       └── MdaControlPersistenceConfiguration
├── connectionprofile
│   ├── controller
│   ├── service
│   └── dao
└── targetdatabase
    ├── common
    │   ├── config
    │   └── jdbc
    ├── metadata
    └── sql
```

- `common/config` 只保留跨宿主装配入口，保持与其他应用相同的模块入口结构。
- 所有访问 MDA 控制库固定表的 DAO 必须继承 `MdaBaseDao`，统一取得 `mdaBaseDataSourceContext`。
- `common/persistence` 统一保存 MDA 项目 BaseDao 与控制库配置；控制库直接使用 Hikari 官方 `HikariConfig` 绑定参数。
- 控制库实际参数只维护在 `mda-module.properties`，不再建立一份重复默认值的自定义属性类。
- `targetdatabase` 集中运行时目标数据库能力；其中 `metadata` 和 `sql` 不继承 `MdaBaseDao`，避免误连控制库。
- 旧的根级 `metadata`、根级 `sql` 与 `common/jdbc` 包不保留兼容层。

## 4. 页面能力

- 新增连接：公共可移动、可缩放窗口录入连接属性。
- 编辑连接：读取包含明文密码的详情并回填公共窗口。
- 删除连接：公共确认窗口执行逻辑删除，不影响目标库。
- 连接切换：公共下拉控件切换连接并刷新左侧元数据树。
- 数据浏览：点击表节点查询前 1000 行。
- SQL 操作：公共 SQL 窗口支持目标账号允许的查询、DDL 和 DML。
- 首屏加载：先挂载公共工作台、窗口和空状态，再异步读取连接配置及当前目标库元数据，控制库响应不会阻塞页面骨架。

## 5. SQL 执行边界

MDA 不通过关键字过滤限制 SQL 类型，实际可执行范围由目标数据库连接账号决定。由于允许执行原始 SQL，MDA 只能在受控本地开发环境运行，不得随业务应用部署上线。
