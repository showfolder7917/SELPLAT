# Mapper XML 规范

## 1. 目的

本规范只用于统一未来确有专用 SQL 时引入的 Java 后端 `Mapper XML` 写法，避免启用 XML 的模块在 `resultMap`、公共列片段、动态 SQL、增删改查结构和参数命名上各写各的。

当前 SELPLAT 的通用增删改查不使用 `Mapper XML`，而是复用 `BaseTemplateDao` 的注解式 SQL 与公共 JDBC 查询链路。本规范不得作为给空业务 DAO、基础 DAO 或简单主数据模块补建 XML 的依据。

## 2. 基本定位

`Mapper XML` 主要职责：

- 仅在注解式公共能力无法清晰承载专用 SQL 时，承接对应 DAO 接口方法的 SQL 实现
- 负责数据库列到 `domain.out` 的结果映射
- 负责 `domain.in`、简单参数和附加计算参数的绑定
- 在不脱离业务域边界的前提下沉淀公共列片段和动态条件写法

`Mapper XML` 不应承担：

- Service 层业务编排
- 跨多个无关业务域的大而全 SQL 仓库
- 与当前 DAO 无关的公用工具 SQL

## 3. 文件与命名规则

### 3.1 按需启用后 XML 与 DAO 一一对应

只有实际声明专用 XML SQL 方法的业务 DAO 才应创建独立的 `Mapper XML`，`namespace` 必须与 DAO 接口全限定名完全一致。仅继承基础 DAO 能力的空接口不得创建占位 XML。

示例：

```xml
<mapper namespace="com.sp.selplat.example.report.dao.ReportQueryDao">
```

禁止：

- 一个 XML 同时承接多个 DAO
- `namespace` 和 DAO 接口不一致

### 3.2 `id` 命名直接表达 SQL 用途

`select`、`insert`、`update`、`delete` 的 `id` 要与 DAO 方法语义一致，保持“看名字就知道干什么”。

推荐：

- `selectUserList`
- `selectUserById`
- `selectUserByLoginName`
- `insertUser`
- `updateUser`
- `deleteUserById`

不推荐：

- `getData`
- `save`
- `query1`

## 4. 结果映射规则

### 4.1 查询返回优先使用 `resultMap`

只要返回对象字段不止一两个，优先定义 `resultMap`，不要把所有映射都散落在 SQL 标签上。

示例结构：

```xml
<resultMap id="UserItemResultMap" type="com.xxx.domain.out.UserItemOut">
  <id column="id" property="id"/>
  <result column="tenantId" property="tenantId"/>
  <result column="loginName" property="loginName"/>
</resultMap>
```

### 4.2 主键字段使用 `<id>`

主键列映射必须用 `<id>`，其余普通字段使用 `<result>`。

这样便于 MyBatis 正确识别主键字段，也让阅读时能一眼看出实体主键来源。

### 4.3 `resultMap` 对应 `domain.out`

列表、详情、查询返回对象优先落到 `domain.out`，不要直接把数据库查询结果回填到保存入参对象或控制层参数对象。

## 5. 公共列片段规则

### 5.1 重复列清单使用 `<sql>`

同一张表的多个查询只要共用同一批列，统一抽成 `<sql id="...">`。

示例：

```xml
<sql id="UserColumns">
  id,
  tenantId,
  loginName,
  displayName
</sql>
```

查询中统一：

```xml
SELECT
  <include refid="UserColumns"/>
```

### 5.2 公共列片段只收当前查询稳定需要的列

不要把所有可能字段无脑堆进一个 `<sql>`，应以当前业务查询稳定需要的列为主。

## 6. 动态查询规则

### 6.1 动态条件统一放在 `<where>`

有可选条件时，统一使用 `<where>` 包裹，避免手工处理首个 `AND`。

示例：

```xml
<where>
  <if test="query != null and query.tenantId != null">
    tenantId = #{query.tenantId}
  </if>
</where>
```

### 6.2 字符串条件显式判空

字符串查询条件应同时判断：

- `!= null`
- `!= ''`

避免空串误入 SQL。

### 6.3 模糊查询显式写出拼接规则

模糊查询直接在 XML 中写清楚 `LIKE CONCAT(...)` 形式，不要把 `%` 拼接逻辑散落在调用方。

示例：

```xml
AND loginName LIKE CONCAT('%', #{query.loginName}, '%')
```

### 6.4 条件来源命名保持稳定

如果查询入参是复合对象，统一显式写出前缀，如：

- `query.tenantId`
- `query.loginName`

不要有的 SQL 带前缀，有的不带。

## 7. 单条查询规则

按主键、唯一字段查询时，SQL 结构应直接、单纯，不引入无意义动态判断。

示例：

```xml
<select id="selectUserById" resultMap="UserItemResultMap">
  SELECT
    <include refid="UserColumns"/>
  FROM UniauthUser
  WHERE id = #{id}
</select>
```

## 8. 新增规则

### 8.1 新增语句字段顺序与表结构主要字段顺序保持一致

`INSERT` 中列顺序和 `VALUES` 顺序必须严格一致，并尽量保持和表结构中的业务主字段顺序一致。

### 8.2 需要主键回填时显式声明

如果使用数据库自增主键，统一显式写：

```xml
useGeneratedKeys="true" keyProperty="in.id" keyColumn="id"
```

### 8.3 参数来源明确分层

像 `insertUser` 这种场景，可以接受：

- 主体字段来自 `in.xxx`
- 派生字段单独来自 `passwordHash`

但要保持参数来源清晰，不要一会儿全对象，一会儿散参数且无说明。

## 9. 更新规则

### 9.1 更新统一使用 `<set>`

更新语句统一用 `<set>`，避免尾逗号问题。

### 9.2 可选更新字段用 `<if>`

像密码这种“有值才更新”的字段，应单独用 `<if>` 包裹。

示例：

```xml
<if test="passwordHash != null and passwordHash != ''">
  passwordHash = #{passwordHash},
</if>
```

### 9.3 审计时间在更新语句中显式维护

如果表有 `updatedAt`，更新 SQL 里应显式写：

```xml
updatedAt = CURRENT_TIMESTAMP
```

不要依赖调用方手工传入更新时间。

## 10. 删除规则

简单按主键删除时，SQL 保持最小结构：

```xml
<delete id="deleteUserById">
  DELETE FROM UniauthUser
  WHERE id = #{id}
</delete>
```

如果项目统一改为假删除，则后续应统一切换到更新 `status`，不要一部分真删、一部分假删。

## 11. 表名与字段名规则

### 11.1 表名、字段名与当前数据库规范保持一致

当前项目规则已明确：

- 表名驼峰
- 字段名驼峰

因此 XML 中引用表名和列名时，也必须使用驼峰口径，不再使用下划线旧表结构。

### 11.2 XML 中的列名与表结构保持一一对应

不要在 XML 中发明不存在的历史列名，也不要一边实体驼峰、一边 SQL 下划线。

## 12. 参数对象分层规则

建议分层如下：

- `domain.in`：查询/保存入参
- `domain.out`：列表/详情返回

XML 中应体现这种分层：

- 查询条件主要绑定 `query.xxx`
- 新增更新主要绑定 `in.xxx`
- 结果映射主要落到 `domain.out`

## 13. 注释与可读性规则

`Mapper XML` 本身通常不强制逐行注释，但结构上必须做到可读：

- 先 `resultMap`
- 再公共 `<sql>`
- 再 `select`
- 再 `insert`
- 再 `update`
- 再 `delete`

同一类 SQL 放在一起，不要顺序混乱。

## 14. 最终要求

后续新增 `Mapper XML` 时，统一遵守：

- XML 与 DAO 一一对应
- `namespace` 必须准确
- 查询返回优先 `resultMap`
- 重复列用 `<sql>` 抽取
- 动态条件统一放 `<where>`
- 更新统一用 `<set>`
- 主键回填显式声明
- 表名和字段名统一驼峰
- `domain.in` / `domain.out` 分层清晰
