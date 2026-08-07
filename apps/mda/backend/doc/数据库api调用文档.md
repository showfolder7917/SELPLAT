# MDA 数据库 API 调用文档

## 1. 运行边界

- 控制库：`apps/mda/db/mda.mv.db`
- 控制表：`MdaConnectionProfile`
- 目标库：根据 `connectionId` 每次动态连接
- 密码：按本地开发工具约定明文保存、明文返回
- 默认工作库：已取消

## 2. 连接配置 API

### 查询连接列表

`GET /api/mda/connections`

返回示例：

```json
{"records":[{"id":10001,"connectionName":"开发库","databaseType":"H2","password":"dev-password"}],"totalCount":1,"pageNo":1,"pageSize":1}
```

### 查询连接详情

`GET /api/mda/connections/{id}`

返回完整可编辑属性，包括明文 `password`。

### 新增连接

`POST /api/mda/connections`

```json
{
  "connectionName": "本地开发库",
  "databaseType": "H2",
  "databaseName": "file:/opt/data/demo",
  "schemaName": "PUBLIC",
  "username": "sa",
  "password": "",
  "defaultAutoCommit": true,
  "sortnum": 10
}
```

### 更新连接

`POST /api/mda/connections/{id}`

请求体使用与新增相同的连接属性。请求中不提供 `password` 时保留原值；提供空字符串时把密码更新为空。

### 删除连接

`POST /api/mda/connections/{id}/delete`

该操作把控制表记录的 `status` 改为 `0`，不会删除目标数据库文件、表或数据。

### 测试连接

`POST /api/mda/connections/test`

已保存连接示例：

```json
{"connectionId":10001}
```

也可以提交一整组尚未保存的连接字段。成功时返回数据库产品、版本、驱动、JDBC URL 和只读状态。

## 3. 元数据 API

`POST /api/mda/metadata/tree.htm`

```json
{"connectionId":10001}
```

返回 catalog、schema、table/view 和 column 组成的树结构。

## 4. SQL API

`POST /api/mda/sql/execute.htm`

```json
{
  "connectionId": 10001,
  "sql": "SELECT * FROM DemoTable",
  "autoCommit": true,
  "maxRows": 1000,
  "queryTimeoutSeconds": 30
}
```

SQL 不做 SELECT 限制。目标账号有权限时可以执行查询、DDL 和 DML。结果集返回 `columns`、`rows`、`rowCount`；修改语句返回 `updateCount`。

## 5. 页面调用顺序

1. 页面读取连接列表。
2. 没有连接时显示空树，用户通过“新增连接”建立第一条配置。
3. 选中连接后读取元数据树。
4. 点击表节点或提交 SQL 时携带当前 `connectionId`。
5. 新增、编辑或删除连接后重新读取连接列表并刷新当前树。
