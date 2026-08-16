# 查询后缀定义规则

## 适用范围

本规则适用于 `BaseDaoImpl#getPageList(Map<String, Object> queryColumnValueMap, ...)` 这类基于 `Map + 字段后缀` 的通用分页查询入口。

当前解析入口位于：

- `BasePagingQueryDaoImpl#buildQueryConditions`
- `BasePagingQueryDaoImpl#resolveConditionFieldName`
- `BasePagingQueryDaoImpl#resolveConditionOperator`

## 基本约定

- `Map` 中每一个参与解析的字段，最终都会转换成一个 `QueryCondition`
- 多个字段组合时，底层统一按 `AND` 条件拼接
- 无后缀时，默认按等于条件处理
- `View` 后缀字段只用于页面展示或回显，不参与数据库查询条件

## 后缀规则

| 后缀 | 含义 | 最终操作符 | 示例字段 | 最终字段 |
| --- | --- | --- | --- | --- |
| 无后缀 | 等于查询 | `EQ` | `status` | `status` |
| `Like` | 模糊查询 | `LIKE` | `nameLike` | `name` |
| `In` | 集合成员查询 | `IN` | `tableIdIn` | `tableId` |
| `Ge` | 大于等于 | `GTE` | `priceGe` | `price` |
| `Gt` | 大于 | `GT` | `priceGt` | `price` |
| `Le` | 小于等于 | `LTE` | `priceLe` | `price` |
| `Lt` | 小于 | `LT` | `priceLt` | `price` |
| `Begin` | 区间开始边界 | `GTE` | `createTimeBegin` | `createTime` |
| `End` | 区间结束边界 | `LTE` | `createTimeEnd` | `createTime` |
| `View` | 仅展示，不参与查询 | 跳过 | `deptNameView` | `deptName` |

## 使用示例

### 1. 等于查询

```java
Map<String, Object> queryMap = new LinkedHashMap<>();
queryMap.put("status", "ENABLED");
```

等价语义：

```sql
where status = 'ENABLED'
```

### 2. 模糊查询

```java
Map<String, Object> queryMap = new LinkedHashMap<>();
queryMap.put("nameLike", "platform");
```

等价语义：

```sql
where name like '%platform%'
```

### 3. 区间查询

```java
Map<String, Object> queryMap = new LinkedHashMap<>();
queryMap.put("createTimeBegin", "2026-07-01 00:00:00");
queryMap.put("createTimeEnd", "2026-07-31 23:59:59");
```

等价语义：

```sql
where createTime >= '2026-07-01 00:00:00'
  and createTime <= '2026-07-31 23:59:59'
```

### 4. 多条件组合查询

```java
Map<String, Object> queryMap = new LinkedHashMap<>();
queryMap.put("status", "ENABLED");
queryMap.put("nameLike", "platform");
queryMap.put("priceGe", 100);
queryMap.put("priceLt", 500);
queryMap.put("createTimeBegin", "2026-07-01 00:00:00");
queryMap.put("createTimeEnd", "2026-07-31 23:59:59");
queryMap.put("deptNameView", "研发一部");
```

等价语义：

```sql
where status = 'ENABLED'
  and name like '%platform%'
  and price >= 100
  and price < 500
  and createTime >= '2026-07-01 00:00:00'
  and createTime <= '2026-07-31 23:59:59'
```

说明：

- `deptNameView` 不参与 `where`
- 所有参与解析的字段统一按 `AND` 组合

## 不支持范围

当前这套规则暂不支持以下语义：

- `OR` 条件
- 同一字段多个同类型条件重复传入
- 用单个后缀直接表达 `BETWEEN`

如果需要 `BETWEEN`，当前建议直接使用结构化 `QueryCondition`：

```java
QueryCondition condition = new QueryCondition();
condition.setFieldName("createTime");
condition.setOperator(QueryOperator.BETWEEN);
condition.setValue("2026-07-01 00:00:00");
condition.setSecondValue("2026-07-31 23:59:59");
```

## 命名建议

- 时间区间优先使用 `Begin / End`
- 数值上下界可使用 `Ge / Gt / Le / Lt`
- 展示字段统一使用 `View`
- 不要混用多套同义后缀，避免同一项目里同时出现 `Start/End`、`Begin/End`、`From/To`

推荐长期固定为以下命名集合：

- `Like`
- `In`
- `Ge`
- `Gt`
- `Le`
- `Lt`
- `Begin`
- `End`
- `View`
