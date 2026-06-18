# xsd-fts H2 通用 fields 查询方案

## 背景

- 目标路径：`C:\xsd-fts\src\main\java\com\xsd\fts\h2`
- 目标诉求：不要在 Java 代码里把 `select field1, field2, field3 ...` 写死。
- 希望做成一个通用 `fields` 查询能力，让查询字段可以按表元数据或外部传入字段动态生成。

## 现状观察

从当前代码看，这个目录已经具备做“通用 fields 查询”的基础，不需要从零重构：

- `DBBaseSource`
  - 已经具备安全查询和结果集元数据读取能力。
  - `getSafeQuery()` / `getQuery()` 的返回结构本身就是动态 `List<Map>`。
- `DbH2`
  - 已经能从 `INFORMATION_SCHEMA.COLUMNS` 读取字段元数据。
  - 已经有 `getDbColumnsProp(String tableName)`，可返回字段名、类型、长度、备注、主键标记。
- `DbColumns` / `DbColumnsProp`
  - 已经有“字段模型对象”，可以承接前端或服务层的字段清单。
- `DBBaseSource`
  - 已经有 `FTSGCOLUMN` 相关字段配置逻辑，说明系统本来就有“表字段配置中心”的设计倾向。

结论：

- 当前最适合的方案不是“继续手工写 select 列表”。
- 最适合的是：把字段清单生成从“Java 硬编码”升级成“元数据驱动 + 白名单控制 + 可缓存配置”。

## 设计目标

### 目标 1

- Java 里不再硬编码完整的 `SELECT 字段列表`。

### 目标 2

- 查询层支持：
  - 全字段查询
  - 指定字段查询
  - 默认字段查询
  - 排除字段查询

### 目标 3

- 避免 SQL 注入。
- 字段名不能直接信任前端传入。
- 必须先经过白名单或元数据校验。

### 目标 4

- 当表新增字段时，不需要立即修改 Java 里的 `select columns` 常量。

## 推荐主方案

### 方案名称

- 元数据驱动的通用 fields 查询方案

### 核心思路

把查询字段分成三层：

1. 表结构真实字段
   - 来自 `INFORMATION_SCHEMA.COLUMNS`
   - 由 `DbH2#getDbColumnsProp(tableName)` 读取

2. 系统允许查询字段
   - 在代码或配置中形成白名单
   - 防止敏感字段、系统字段被随便带出

3. 本次请求实际使用字段
   - 来自前端传入的 `fields`
   - 或后端默认字段集
   - 最终必须与白名单取交集

最后生成：

```sql
select fieldA, fieldB, fieldC from TABLE_NAME ...
```

而不是在 Java 里手写固定字段字符串。

## 推荐实现结构

### 一、增加统一字段解析入口

建议增加一个统一方法，例如：

```java
public List<String> resolveSelectFields(String tableName, String fields)
```

职责：

- 读取表字段元数据
- 解析前端 `fields`
- 做字段合法性校验
- 生成本次查询允许使用的字段清单

### 二、fields 参数格式

推荐支持如下格式：

```text
id,name,status
```

也可以扩展支持：

```text
*
```

表示默认全字段，但这里的“全字段”不等于数据库全部字段，而是“白名单允许的全部字段”。

## 字段解析规则

### 规则 1：未传 fields

- 使用默认字段集

例如：

```java
["id", "name", "status", "createdAt"]
```

### 规则 2：fields = *

- 返回该表的“允许查询字段全集”

### 规则 3：fields = id,name,status

- 只返回白名单中存在的字段

### 规则 4：非法字段

- 直接报错
- 或忽略并记录日志

建议默认报错，因为更容易发现前端拼写问题。

## 为什么不能直接拼接前端传来的 fields

因为字段名位置不能用 PreparedStatement 参数化。

也就是说这种写法不安全：

```java
String sql = "select " + fields + " from " + tableName;
```

风险包括：

- SQL 注入
- 敏感字段外泄
- 字段拼错导致运行时异常

所以字段必须走：

1. 元数据枚举
2. 白名单过滤
3. 最后再拼成 SQL

## 推荐白名单策略

### 方案 A：完全依赖表元数据

优点：

- 表加字段后，查询层自动感知

缺点：

- 新加的敏感字段也可能自动暴露

结论：

- 不推荐直接用在正式业务查询接口

### 方案 B：表元数据 + 黑名单

例如排除：

- `PASSWORD`
- `PASSWORDHASH`
- `DELETED`
- `ROWVERSION`

优点：

- 维护成本低

缺点：

- 仍然存在误暴露风险

### 方案 C：表元数据 + 白名单

推荐做法：

- 真实字段来自元数据
- 可返回字段来自白名单
- 实际查询字段 = 元数据字段 ∩ 白名单 ∩ 请求字段

结论：

- 这是最推荐的正式方案

## 推荐默认字段配置方式

建议不要把默认字段直接散落在业务代码里，而是集中到一个配置源。

推荐三种实现方式：

### 方式 1：放数据库配置表

你当前代码里已经有 `FTSGCOLUMN` 的痕迹，说明你们有字段配置中心思路。

可扩展为：

- 表名
- 字段名
- 是否默认显示
- 是否允许查询
- 排序号
- 宽度
- 显示名

优点：

- 和现有系统风格最一致
- 前端字段展示和后端字段选择可以统一

缺点：

- 配置依赖数据库初始化

### 方式 2：放 YAML / properties / JSON

例如：

```json
{
  "FTSUSER": {
    "defaultFields": ["SELID", "USERNAME", "STATUS"],
    "allowedFields": ["SELID", "USERNAME", "STATUS", "CREATETIME"]
  }
}
```

优点：

- 简单
- 容易上线

缺点：

- 仍然需要维护配置文件

### 方式 3：纯代码常量

不推荐，因为这又回到了你想避免的问题：

- `select` 字段还是写死在 Java 里

## 推荐的最小落地方案

如果你要最快落地，我建议第一版这样做：

### 第一步

基于 `DbH2#getDbColumnsProp(tableName)` 获取表字段元数据。

### 第二步

增加统一方法：

```java
public String buildSelectFields(String tableName, String fields)
```

返回值是最终 SQL 可直接拼接的字段串，例如：

```text
SELID, USERNAME, STATUS
```

### 第三步

默认字段和允许字段先放配置表或内存缓存中，不放散落业务代码。

### 第四步

原先：

```java
String sql = "select SELID,USERNAME,STATUS from FTSUSER";
```

改成：

```java
String selectFields = buildSelectFields("FTSUSER", fields);
String sql = "select " + selectFields + " from FTSUSER";
```

## 推荐接口形态

### 方法一：解析字段列表

```java
public List<String> getAllowedFields(String tableName)
```

作用：

- 返回该表允许查询的字段全集

### 方法二：构建本次 select 字段串

```java
public String buildSelectFields(String tableName, String fields)
```

作用：

- 把 `fields` 解析成最终 SQL 字段串

### 方法三：获取默认字段

```java
public List<String> getDefaultFields(String tableName)
```

作用：

- 当前端没传 `fields` 时使用

## 推荐缓存策略

字段元数据不适合每次查询都读 `INFORMATION_SCHEMA`。

建议加缓存：

- key：`tableName`
- value：`DbColumnsProp` 列表或字段名列表

可选缓存方式：

- 本地内存 Map
- Spring Cache
- 启动后预热

推荐第一版先用本地内存缓存，够简单。

## 字段输出顺序

这是一个容易忽略但很重要的问题。

如果字段顺序不稳定，会影响：

- 前端表格列顺序
- 导出顺序
- 联调预期

建议规则：

1. 请求 fields 有顺序时，按请求顺序输出
2. 使用默认字段时，按配置顺序输出
3. 使用 `*` 时，按配置顺序或数据库定义顺序输出

## 与现有代码的最佳结合点

最适合落地的位置：

- `DBBaseSource`
  - 放通用字段解析与缓存能力
- `DbH2`
  - 继续负责 H2 元数据读取
- 业务查询入口
  - 改为调用 `buildSelectFields`

### 不建议放的位置

- Controller
  - 控制层不该承担 SQL 字段解析逻辑
- 单个业务 Service
  - 否则通用逻辑会再次散落

## 示例方案

### 输入

```text
tableName = FTSUSER
fields = SELID,USERNAME,STATUS
```

### 过程

1. 从缓存或 `INFORMATION_SCHEMA` 读取 `FTSUSER` 字段列表
2. 与允许字段白名单做交集
3. 校验 `SELID, USERNAME, STATUS` 均存在
4. 拼出最终字段串

### 输出

```text
SELID, USERNAME, STATUS
```

### 最终 SQL

```sql
select SELID, USERNAME, STATUS from FTSUSER
```

## 不推荐方案

### 方案 1：继续在每个方法里手写 select 字段

问题：

- 维护成本高
- 表字段变更时容易漏改
- 重复代码多

### 方案 2：直接 select *

问题：

- 字段过多
- 敏感字段外泄风险
- 前端列顺序不可控
- 性能不可控

### 方案 3：前端传什么 fields 就原样拼接

问题：

- 直接引入 SQL 注入风险
- 没有边界控制

## 最终推荐

最推荐的正式方案是：

- `INFORMATION_SCHEMA` 读取真实字段
- 配置表或缓存维护允许字段和默认字段
- 统一通用方法解析 `fields`
- 最终生成安全的 `select 字段串`

一句话总结：

- 不要把 `select` 字段写死在 Java 代码里
- 也不要直接 `select *`
- 应该做成“元数据驱动 + 白名单控制 + 默认字段配置 + 缓存”的通用 fields 查询层

## 下一步建议

如果后续要真正落代码，推荐分两步：

1. 先抽一个通用 `buildSelectFields(tableName, fields)` 方法
2. 再把现有写死字段的查询逐步替换成这个统一入口

这样风险最小，也最符合你当前 `xsd-fts h2` 代码基础。
