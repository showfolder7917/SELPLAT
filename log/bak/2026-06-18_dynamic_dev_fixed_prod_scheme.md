# 动态只用于开发期、上线固化为固定产物方案

## 目标

解决下面这个问题：

- 开发阶段希望利用数据库元数据、动态 fields、动态表字段能力提升开发效率
- 但工程一旦稳定，线上运行时不能继续“直接看数据库表结构来决定查询字段和行为”
- 线上必须改成：
  - 固定代码
  - 固定配置
  - 固定白名单
  - 固定查询能力

也就是说：

- **动态能力只服务开发**
- **线上只使用固化结果**

---

## 一、核心原则

### 原则 1：动态能力只作为开发辅助，不作为线上运行依赖

动态能力可以做这些事：

- 读取表字段
- 生成字段白名单
- 生成默认查询字段
- 生成查询配置
- 生成 DTO / Entity / Query 配置草稿

但不能让线上接口每次请求都去：

- 读 `INFORMATION_SCHEMA`
- 动态推导字段
- 动态决定 SQL 结构

### 原则 2：上线运行必须只依赖“固化产物”

所谓固化产物，指的是：

- 固定 Java 类
- 固定 JSON/YAML 配置
- 固定字段白名单文件
- 固定查询模板

一句话：

- 开发期：动态生成
- 上线期：静态执行

### 原则 3：动态不是线上能力，而是“生成器能力”

这点很关键。

不要把动态元数据读取能力设计成：

- 线上查询核心链路的一部分

而要把它设计成：

- 代码生成器
- 配置生成器
- 开发辅助工具

---

## 二、推荐架构分层

建议把这套东西拆成两层：

### A. 生成层（只在开发期使用）

负责：

- 读取数据库元数据
- 读取表/字段注释
- 读取主键信息
- 生成固定配置或固定代码

典型输入：

- 数据源配置
- 表名
- 开发期的字段白名单选择
- 查询条件规则

典型输出：

- 固定字段配置文件
- 固定查询模板配置
- 固定 Java 骨架类

### B. 运行层（开发/测试/线上都可用）

负责：

- 仅读取固定产物
- 按固定产物执行查询
- 不再依赖数据库元数据动态推导

---

## 三、推荐的最终流程

### 第一步：开发期动态扫描

开发阶段，允许通过 `common-db` 的元数据读取能力扫描数据库：

- 表
- 字段
- 主键
- 类型
- 备注

这一步的目的不是直接用于线上，而是产出开发资料。

### 第二步：生成固定产物

扫描后，生成以下其中一种或多种产物：

#### 产物 1：字段白名单配置

例如：

```json
{
  "tableName": "ua_user",
  "allowedFields": ["id", "loginName", "displayName", "userStatus", "createdAt"],
  "defaultFields": ["id", "loginName", "displayName", "userStatus"],
  "sortableFields": ["id", "loginName", "createdAt"],
  "conditionFields": {
    "loginName": ["LIKE"],
    "userStatus": ["EQ"],
    "createdAt": ["GTE", "LTE", "BETWEEN"]
  }
}
```

#### 产物 2：固定查询定义

例如：

```json
{
  "queryCode": "uniauth-user-list",
  "sourceKey": "main",
  "databaseType": "H2",
  "tableName": "ua_user",
  "defaultOrder": ["createdAt DESC"]
}
```

#### 产物 3：Java 固定类骨架

例如生成：

- `UniauthUserGeneratedFields.java`
- `UniauthUserGeneratedQuerySpec.java`

#### 产物 4：文档或开发辅助文件

例如：

- 字段说明 Markdown
- 查询能力说明 JSON

### 第三步：人工确认或代码评审

生成后的产物不要自动直接上线。

建议流程：

1. 生成
2. 人工确认
3. 提交仓库
4. 随版本上线

这样能防止：

- 新字段误暴露
- 敏感字段被错误加入查询
- 查询规则被自动扩大

### 第四步：线上运行只读取固定产物

线上启动后，只读：

- 固定字段配置
- 固定查询定义
- 固定代码类

而不再调用：

- 动态元数据扫描
- `INFORMATION_SCHEMA`
- 运行时字段自动补齐

---

## 四、固化产物放哪里

推荐分两类：

### 1. 固定代码产物

放在：

- `shared/backend/common-db/src/main/java/...`
- 或具体业务模块下的 `generated` 包

例如：

```text
com/sp/selplat/uniauth/user/generated
```

### 2. 固定配置产物

放在：

- `src/main/resources`
- 或统一配置目录

例如：

```text
resources/db-query-spec/
```

推荐一个统一位置：

```text
shared/backend/common-db/src/main/resources/db-query-spec/
```

如果是业务专属配置，也可以放业务模块：

```text
apps/uniauth/backend/src/main/resources/db-query-spec/
```

---

## 五、推荐生成内容最小集合

如果想控制复杂度，第一版不建议生成 Java 实体类本身，而是先生成“查询定义”。

### 最推荐先生成的内容

#### 1. allowedFields

表示哪些字段允许被 select

#### 2. defaultFields

表示默认查哪些字段

#### 3. sortableFields

表示哪些字段允许出现在 order by

#### 4. conditionFields

表示每个字段允许哪些操作符：

- `EQ`
- `LIKE`
- `GTE`
- `LTE`
- `BETWEEN`

#### 5. tableName / sourceKey / databaseType

作为固定查询定义的一部分

### 为什么推荐先生成这些

因为这些产物刚好是线上查询真正需要的固定边界。

线上最重要的不是“还能动态看到表结构”，而是：

- 哪些字段允许被查
- 哪些条件允许被用
- 哪些字段允许排序

---

## 六、线上为什么不能继续直接走表字段动态驱动

主要有六个原因：

### 1. 安全风险

数据库新增字段后，如果线上动态感知，就可能：

- 自动暴露敏感字段
- 自动支持不该支持的排序字段
- 自动支持不该支持的筛选条件

### 2. 行为不稳定

上线后如果 DBA 改表：

- 接口行为会变
- 返回字段会变
- 排序字段可能会变

这对线上系统是不可接受的。

### 3. 测试不可控

如果运行时始终动态取字段，那么：

- 测试环境和生产环境表结构稍有不同
- 查询行为就会漂移

### 4. 性能与启动成本

频繁读元数据会引入额外成本，尤其在多数据源、多表、多模块下。

### 5. 发布边界被破坏

你本来应该通过：

- 改代码
- 提交 PR
- 评审
- 发版

来改变接口能力。

如果数据库加字段就自动改变线上接口行为，发布边界就失控了。

### 6. 审计困难

线上查询规则如果不是固定产物，很难准确回答：

- 这版代码到底允许查哪些字段
- 哪些字段什么时候被放开

---

## 七、推荐实现模式

### 模式 1：开发期生成 JSON / YAML 查询定义

最推荐。

开发期通过生成器产出：

- `db-query-spec/uniauth-user-list.json`

线上运行时由 `common-db` 只读取这个固定 spec。

#### 优点

- 灵活
- 易审查
- 易 diff
- 易热修配置

#### 缺点

- 需要写配置加载器

### 模式 2：开发期生成 Java 常量类

例如：

- `UniauthUserQuerySpec.java`

#### 优点

- 类型安全
- IDE 友好

#### 缺点

- 生成和更新成本更高
- 变更要重新编译

### 模式 3：开发期生成 XML 查询模板

如果项目继续大量使用 MyBatis，可以生成：

- 固定 select 片段
- 固定可用字段片段

#### 优点

- 贴近 MyBatis 现有模式

#### 缺点

- 可维护性一般
- 规则表达能力不如 JSON/YAML 清晰

### 推荐结论

第一版最推荐：

- **开发期生成 JSON 查询定义**
- **线上只读取 JSON 查询定义**

---

## 八、与 common-db 的结合方式

### 开发期模块

建议增加一个“生成器”能力，不直接并入线上查询主链路。

推荐形态：

- `common-db` 内部保留生成支持代码
- 但只在开发任务、脚本或手工命令中触发

例如：

- `QuerySpecGenerator`
- `MetadataSnapshotGenerator`

### 运行期模块

运行期只保留：

- `QuerySpecLoader`
- `CommonQueryExecutor`
- `CommonQueryValidator`

运行期不允许：

- 直接从数据库实时推断 fields 白名单
- 直接从数据库实时生成查询定义

---

## 九、推荐生成器产物示例

### 文件名

```text
db-query-spec/uniauth-user-list.json
```

### 内容示例

```json
{
  "queryCode": "uniauth-user-list",
  "sourceKey": "main",
  "databaseType": "H2",
  "tableName": "ua_user",
  "allowedFields": [
    "id",
    "tenantId",
    "loginName",
    "displayName",
    "userStatus",
    "createdAt"
  ],
  "defaultFields": [
    "id",
    "loginName",
    "displayName",
    "userStatus"
  ],
  "sortableFields": [
    "id",
    "loginName",
    "createdAt"
  ],
  "conditionFields": {
    "loginName": ["LIKE"],
    "userStatus": ["EQ"],
    "createdAt": ["GTE", "LTE", "BETWEEN"]
  },
  "defaultOrder": [
    "createdAt DESC"
  ]
}
```

这份文件生成后：

- 提交仓库
- 评审
- 上线

线上只认它，不再认数据库动态字段。

---

## 十、推荐的工作流

### 开发期

1. 连接开发库
2. 读取目标表结构
3. 生成查询定义草稿
4. 人工确认和裁剪字段
5. 保存到固定配置文件
6. 提交仓库

### 测试/上线前

1. 使用固定配置跑测试
2. 验证查询结果
3. 验证字段暴露边界

### 线上运行

1. 加载固定配置
2. 执行固定规则查询
3. 不再读取数据库元数据做运行时推导

---

## 十一、最终推荐

### 推荐结论

最合理的实现方式不是：

- 线上继续动态读表字段

而是：

- **开发期使用动态元数据能力生成固定查询定义**
- **线上只执行固定查询定义**

### 最推荐固化产物

优先级从高到低：

1. JSON / YAML 查询定义
2. Java 常量/Spec 类
3. MyBatis 固定 XML 片段

### 最终一句话

- **动态能力应当被设计成“开发期生成器”，而不是“线上运行期决策器”。**
