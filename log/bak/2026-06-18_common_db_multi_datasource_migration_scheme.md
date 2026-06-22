# common-db 多数据源通用查询迁移方案（再次修正版）

## 目标

把 `C:\xsd-fts\src\main\java\com\xsd\fts\h2` 里的通用查询、字段元数据和数据库差异处理能力迁移到：

- `C:\opt\workspace\SELPLAT\shared\backend\common-db\src\main\java\com\sp\selplat\common\db`

并重构成以下模式：

- `common-db` 只负责提供通用数据库查询能力
- 业务上层 DAO 负责传入：
  - 数据源实体
  - 表名
  - 查询字段
  - 查询条件
  - 排序字段
  - 分页参数
- 数据库类型、连接的是哪个数据库、当前 schema 等信息，都从上层传入的数据源实体中获得
- 通用层尽量简化，不替业务擅自决定目标表、默认查询方式、默认排序或默认分页
- 查询能力至少支持：
  - 等于
  - like
  - 大于等于
  - 小于等于
  - 日期区间

同时评估：

- `BaseTemplateDao.java` 这种模板化配置风格是否更安全

---

## 一、迁移目录定位

迁移目录明确定位到：

- `shared/backend/common-db/src/main/java/com/sp/selplat/common/db`

原因：

- 这是跨模块共用能力
- 后续 `uniauth`、其他业务域都可能复用
- 放在 `common-db` 才符合公共基础设施定位

---

## 二、修正后的职责边界

### `common-db` 负责什么

- 提供可复用的通用查询模型
- 提供通用条件拼装能力
- 提供排序拼装能力
- 提供分页 SQL 拼装能力
- 提供多数据库差异适配
- 提供字段合法性校验入口
- 提供查询执行入口

### 业务 DAO 负责什么

例如：

- `UniauthUserDaoImpl.java`

由业务 DAO 负责传入：

- 数据源实体
- 表名
- fields
- 条件列表
- order by
- 分页参数

结论：

- `common-db` 不自己猜当前查哪张表
- `common-db` 不自己猜当前该走哪种数据库
- `common-db` 不自己猜当前默认排序
- `common-db` 不自己猜当前分页规则

这些都由业务上层明确传入

---

## 三、数据源来源与传递方式

### 1. 数据源来源

数据源本身来自工程配置，这一点不变。

### 2. 数据源使用方式

本次方案修正后，不再推荐底层只收：

- `sourceKey`
- `databaseType`

而是推荐由上层直接传一个“数据源实体”。

### 3. 推荐数据源实体

建议在 `common-db` 下定义：

- `CommonDbSource`

推荐字段：

```java
private String sourceKey;
private DatabaseType databaseType;
private javax.sql.DataSource dataSource;
private String catalogName;
private String schemaName;
```

### 4. 这样做的好处

上层 DAO 把 `CommonDbSource` 传进来后，底层可以直接获得：

- 当前用的是哪个数据源
- 当前数据库类型是什么
- 当前连接的是哪个数据库或 catalog
- 当前使用的是哪个 schema

结论：

- 数据源来源：工程配置
- 数据源选择：上层 DAO
- 数据库类型来源：上层传入的数据源实体

---

## 四、核心设计原则

### 原则 1：表名由业务 DAO 明确传入

例如：

- `ua_user`
- `ua_tenant`
- `FTSUSER`

不由 `common-db` 自己决定。

### 原则 2：order by 由业务 DAO 传入

例如：

- `id DESC`
- `createdAt DESC`
- `loginName ASC`

底层只负责合法性校验和 SQL 生成。

### 原则 3：分页参数由业务 DAO 传入

推荐支持：

- `pageNo`
- `pageSize`

不由底层自己决定默认分页规则。

### 原则 4：查询条件统一抽象，底层只负责翻译

业务 DAO 不直接拼 SQL 字符串，而是传一个结构化条件集合给通用层。

---

## 五、推荐的新模型：上层传入查询描述对象

建议在 `common-db` 下增加：

- `CommonDynamicQuery`

职责：

- 承接业务 DAO 传下来的完整查询描述

推荐字段：

```java
private CommonDbSource dataSource;
private String tableName;
private List<String> selectFields;
private List<QueryCondition> conditions;
private List<QueryOrder> orders;
private Integer pageNo;
private Integer pageSize;
```

---

## 六、推荐新增的条件与排序对象

### `QueryCondition`

推荐字段：

```java
private String fieldName;
private QueryOperator operator;
private Object value;
private Object secondValue;
```

### `QueryOperator`

第一版最少支持：

- `EQ`
- `LIKE`
- `GTE`
- `LTE`
- `BETWEEN`

### `QueryOrder`

推荐字段：

```java
private String fieldName;
private QueryOrderDirection direction;
```

### `QueryOrderDirection`

支持：

- `ASC`
- `DESC`

---

## 七、最符合当前诉求的调用方式

推荐未来调用形态：

```java
CommonDynamicQuery query = new CommonDynamicQuery();
query.setDataSource(commonDbSource);
query.setTableName("ua_user");
query.setSelectFields(Arrays.asList("id", "loginName", "userStatus", "createdAt"));
query.setConditions(...);
query.setOrders(...);
query.setPageNo(1);
query.setPageSize(20);
```

然后交给 `common-db`：

```java
List<Map<String, Object>> rows = commonQueryExecutor.query(query);
long total = commonQueryExecutor.count(query);
```

这样你就能做到：

- 查哪张表：上层决定
- 查什么字段：上层决定
- 用什么条件：上层决定
- 排序字段：上层决定
- 用哪个数据源：上层决定
- 用什么数据库：由上层传入的数据源实体决定
- 分页参数：上层决定
- SQL 方言：底层根据 `commonDbSource.getDatabaseType()` 选择

---

## 八、查询条件支持范围

第一版建议收敛成下面五类：

### 1. 等于

```java
fieldName = "userStatus"
operator = EQ
value = "ACTIVE"
```

生成：

```sql
userStatus = ?
```

### 2. like

```java
fieldName = "loginName"
operator = LIKE
value = "admin"
```

生成：

```sql
loginName LIKE ?
```

### 3. 大于等于

```java
fieldName = "createdAt"
operator = GTE
value = startDate
```

生成：

```sql
createdAt >= ?
```

### 4. 小于等于

```java
fieldName = "createdAt"
operator = LTE
value = endDate
```

生成：

```sql
createdAt <= ?
```

### 5. 日期区间

```java
fieldName = "createdAt"
operator = BETWEEN
value = startDate
secondValue = endDate
```

生成：

```sql
createdAt BETWEEN ? AND ?
```

结论：

这已经足够覆盖：

- 普通筛选
- 模糊搜索
- 数值范围
- 日期范围

---

## 九、多数据库支持：修正后的定位

多数据库支持不应理解成：

- `common-db` 自己判断现在是 H2 还是 Oracle 然后主导一切

而应理解成：

- 上层 DAO 传入 `CommonDbSource`
- `common-db` 从 `CommonDbSource` 中拿到 `databaseType`
- `common-db` 根据 `databaseType` 选择对应方言

推荐方式：

```java
DatabaseDialect dialect = dialectRegistry.get(commonDbSource.getDatabaseType());
```

不是：

```java
common-db 自己去猜
```

---

## 十、fields 查询能力的修正定位

fields 也应由上层 DAO 传入。

不是：

- 底层自己决定查哪些字段

而是：

- 上层 DAO 把 fields 传进来
- `common-db` 负责：
  - 判断字段是否合法
  - 判断字段是否允许查询
  - 生成 select 字段串

例如上层可以传：

```java
Arrays.asList("id", "loginName", "userStatus")
```

底层最终生成：

```sql
SELECT id, loginName, userStatus FROM ua_user
```

---

## 十一、`BaseTemplateDao` 风格是否更安全

### 结论

- 是的，相比手工 SQL 字符串拼接，`BaseTemplateDao` 风格整体更安全
- 但前提是动态部分必须被结构化、被校验，而不是裸字符串透传

### 为什么更安全

优点：

1. 查询值走参数绑定
2. SQL 模板集中管理
3. 业务层不再散落 JDBC 拼接代码
4. 后续更容易统一加校验

### 为什么不是天然绝对安全

因为模板里仍然有：

- `${tableName}`
- `${selectColumns}`
- `${columnName}`
- `${orderBy}`

这些动态部分如果不校验，仍然可能出问题。

### 正确使用方式

- 上层 DAO 负责传入：
  - 数据源实体
  - 表名
  - 字段
  - 条件
  - 排序
  - 分页
- `common-db` 负责做：
  - 表白名单校验
  - 字段白名单校验
  - 条件字段白名单校验
  - 排序字段白名单校验

一句话：

- **模板方式更安全，但必须建立在“上层传结构化参数，底层做白名单校验”的前提下。**

---

## 十二、推荐最终结构（简化版）

迁移目录仍放：

- `shared/backend/common-db/src/main/java/com/sp/selplat/common/db`

建议第一版结构尽量简化成：

```text
common/db
├─ config
│  ├─ DatabaseType.java
│  └─ CommonDbSource.java
├─ domain
│  ├─ CommonDynamicQuery.java
│  ├─ QueryCondition.java
│  ├─ QueryOperator.java
│  ├─ QueryOrder.java
│  └─ QueryOrderDirection.java
├─ metadata
│  ├─ ColumnMetadata.java
│  ├─ TableMetadata.java
│  └─ DatabaseMetadataReader.java
├─ dialect
│  ├─ DatabaseDialect.java
│  ├─ H2Dialect.java
│  ├─ MySqlDialect.java
│  ├─ SqlServerDialect.java
│  ├─ OracleDialect.java
│  └─ PostgreSqlDialect.java
├─ query
│  ├─ CommonQueryExecutor.java
│  ├─ CommonQuerySqlBuilder.java
│  └─ CommonQueryValidator.java
└─ dao
   ├─ BaseTemplateDao.java
   └─ BaseDao.java
```

---

## 十三、分阶段落地建议

### 第一阶段

先补通用查询模型：

- `CommonDbSource`
- `CommonDynamicQuery`
- `QueryCondition`
- `QueryOrder`
- `QueryOperator`

### 第二阶段

补执行器和 SQL 构建器：

- `CommonQueryExecutor`
- `CommonQuerySqlBuilder`

### 第三阶段

补多数据库差异支持：

- `DatabaseDialect`
- 多数据库实现类

### 第四阶段

补元数据与安全校验：

- `DatabaseMetadataReader`
- `CommonQueryValidator`

### 第五阶段

让业务 DAO（例如 `UniauthUserDaoImpl`）逐步改为结构化传参调用

---

## 最终结论

### 修正后的核心结论

1. 迁移目录应明确定位到：
   - `shared/backend/common-db/src/main/java/com/sp/selplat/common/db`

2. 数据源来自工程配置，但运行时不由底层选择，而是由上层 DAO 以数据源实体形式传入。

3. 用的是哪种数据库，不由底层猜测，而是由上层传入的数据源实体直接提供。

4. 表名、fields、条件、order by、分页参数，都应由上层 DAO 传入。

5. `common-db` 只负责：
   - 校验
   - 生成 SQL
   - 执行查询
   - 处理多数据库差异

6. 通用条件第一版至少支持：
   - 等于
   - like
   - 大于等于
   - 小于等于
   - 日期区间

7. `BaseTemplateDao` 风格整体更安全，但必须建立在“上层传结构化参数，底层做白名单校验”的前提下。

一句话总结：

- **迁移后的 common-db 应该是一个“由上层 DAO 传入数据源实体、表、字段、条件、排序、分页，再由底层完成校验与执行”的通用查询能力层。**
