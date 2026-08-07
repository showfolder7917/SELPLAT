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
    → 连接配置 Service → MDA 私有控制库 DAO → mda.mv.db
    → 元数据/SQL Service → JdbcConnectionFactory → 动态目标数据库
```

- 连接配置是 MDA 控制库中的 CRUD。
- 元数据和 SQL Controller/Service 面向运行期选中的任意目标库，不属于固定业务表 CRUD。
- MDA 控制库不能注入为统一宿主的主 `DataSource`，否则会把其他应用的公共 BaseDao 指向错误数据库。
- 因此连接配置 DAO 使用 `MdaDatabase.controlJdbc()`；它保持 DAO/Service/Controller 分层，但不错误继承绑定宿主主数据源的 `BaseDao`。
- 目标库连接按请求创建并关闭，不注册成 Spring 全局数据源。

## 4. 页面能力

- 新增连接：公共可移动、可缩放窗口录入连接属性。
- 编辑连接：读取包含明文密码的详情并回填公共窗口。
- 删除连接：公共确认窗口执行逻辑删除，不影响目标库。
- 连接切换：公共下拉控件切换连接并刷新左侧元数据树。
- 数据浏览：点击表节点查询前 1000 行。
- SQL 操作：公共 SQL 窗口支持目标账号允许的查询、DDL 和 DML。

## 5. 权限边界

MDA 不通过关键字过滤模拟数据库权限。最终能力由目标数据库账号决定。由于允许执行原始 SQL，MDA 只能在受控本地开发环境运行，不得随业务应用部署上线。
