# AI Desktop 统一事件中心 SQLite 数据库接入方案

## 当前落地状态（2026-08-26）

第一阶段已经从“仅有 SQLite 连接框架”推进为可运行的全流程持久化入口：

- 数据库迁移版本为 `0002`，已建立事件、流程、任务执行、审批、成员运行状态和应用运行会话六类表。
- 既有 `BusinessAuditLog` 成为唯一事件入口，文件归档继续保留，同时投影到 SQLite；不为任何人物建立旁路日志。
- 南宫婉课题与提案、韩立审批历史、宗门成员任务与心跳、令狐持续保障状态都由主进程投影到同一数据库。
- 协同 IPC 中的业务校验失败统一登记为业务异常；未捕获异常和未处理 Promise 登记为技术异常。
- 独立监督器每 30 秒同步一次完整状态，任务超过 120 秒无心跳时登记一次卡住事件并交给令狐恢复入口。
- 应用运行会话在正常退出前关闭；下次启动发现残留运行会话时标记为中断并留下恢复事件。
- 南宫婉完成验收后，演化启动器在自动演化开启时只建立一条带前后课题关系的下一轮，避免重复启动。

SQLite 负责跨人物查询、异常发现和审计事实；现有 JSON 状态仍负责重建复杂运行对象，两者职责不同，不互相伪装为备用数据库。

## 1. 文档状态与实施结论

- 文档性质：详细设计与分阶段实施记录。阶段0的固定路径、内置 SQLite 连接、版本表、迁移事务、校验和、丢库恢复状态和退出 checkpoint 已实现，待统一测试；业务表尚未接入。
- 目标应用：`apps/ai-desktop`。
- 数据库选择：SQLite，不使用 H2。
- 核心目标：让南宫婉、韩立、令狐、Codex 线程、协同任务、测试系统和启动器产生的异常进入同一个可查询、可消费、可追踪的事件中心。
- 核心处理关系：全部异常先进入统一事件中心，令狐始终介入调查，再决定进入 Bug 修复、优化、重构、规则演进或观察流程。
- 数据边界：SQLite 保存结构化运行事实和处理状态；JSONL 继续保存不可变原始审计记录；截图、终端全文、测试报告等大对象继续使用文件存储。
- Git 边界：提交路径配置、数据库结构、迁移脚本、加载清单、测试和说明；运行数据库虽然固定在 `apps/ai-desktop/db`，但必须由 SELPLAT 根 `.gitignore` 精确排除 `events.sqlite3`、`events.sqlite3-wal`、`events.sqlite3-shm`。

## 2. 当前问题

AI Desktop 已有 `BusinessAuditLog.recordEvent()` 集中写入 JSONL，南宫婉线程删除失败也会写入 `nangong.conversation.thread.lifecycle`。但当前日志只有写入链，没有统一消费链：

1. 日志事件缺少强制统一的来源、严重程度、故障指纹、处理状态和责任人物字段。
2. 令狐只有写日志能力，没有读取新增日志、保存消费游标或认领问题的入口。
3. 南宫婉对话线程不属于协同任务，令狐只检查协同任务快照时无法发现其 `delete_failed`。
4. 重复异常只能形成多行 JSONL，不能聚合为同一个持续问题。
5. 无法可靠表达“待调查、调查中、等待审批、执行中、验证中、已解决”的处理链。
6. 提案、审批、任务、测试和启动器恢复点分散在多个 JSON 文件，跨实体关联依赖程序临时拼接。

因此，本方案不把 SQLite 当成日志文件的替代品，而是把它建设成可操作的事件与问题处理中心。

## 3. 可借鉴的 Japanese 数据库规范

`apps/japanese` 的以下做法可以复用：

- 应用拥有私有数据库边界。
- SQL 位于应用自身 `db/sql`。
- 表结构文件使用 `schema-<ActualTableName>.sql`。
- 有真实种子数据时才建立 `data-<ActualTableName>.sql`。
- 一个 schema 文件只负责一张正式表。
- 使用显式 `load-order.txt` 固定加载顺序。
- 表名使用 PascalCase，字段使用 camelCase。
- 约束和索引使用 `UK_`、`FK_`、`CK_`、`IDX_` 前缀。
- 数据源、事务、Service 和 DAO 职责分离。
- 使用真实隔离数据库执行结构契约测试。

以下实现不能照搬：

- Spring Bean、Hikari、JDBC、MyBatis。
- H2 的 `MODE=MySQL`、账号密码和 Java 数据源配置。
- `CommonSequenceSegment` 号段。SQLite 事件表使用本地整数主键和稳定公开编码即可。
- H2 专属 SQL，例如 `COMMENT ON`、部分 `ALTER TABLE` 和约束删除语法。
- Japanese 的 H2 运行库规则。AI Desktop 的 SQLite 运行库服从本方案阶段0的 `ai-memory-paths.json` 固定配置，不再按 Electron `userData` 分版本建立数据库。

## 4. 目标连接架构

```text
南宫婉 / 韩立 / 令狐 / Codex / 协同任务 / 测试 / 启动器
                            │
                            ▼
                    EventCenterFacade
                   ┌────────┴────────┐
                   ▼                 ▼
          EventIngestionService   JSONL 审计归档
                   │
          ┌────────┼─────────┐
          ▼        ▼         ▼
       EventDao IncidentDao CursorDao
          │        │         │
          └────────┴─────────┘
                   │
                   ▼
                 SQLite
                   ▲
                   │
        LinghuEventConsumerService
                   │
                   ▼
    调查 → 修复/优化/重构/规则演进/观察
                   │
                   ▼
              韩立审批与执行链
```

### 4.1 唯一连接入口

- 只有 Electron 主进程可以打开 SQLite。
- 渲染页面只能通过 IPC 调用主进程，禁止直接连接数据库。
- 南宫婉、韩立、令狐和其他模块只能调用 `EventCenterFacade`，禁止直接调用 DAO。
- DAO 只能由 Service 使用，禁止把 SQL、表名或连接对象暴露给业务调用方。
- 全应用共用一个 SQLite 连接管理器和一个串行写入队列，禁止各模块分别打开数据库文件。

### 4.2 分层职责

| 层级 | 职责 | 禁止事项 |
|---|---|---|
| IPC | 校验输入、调用 Facade、返回可展示结果 | 禁止拼 SQL、直接操作 DAO |
| EventCenterFacade | 全应用统一入口、兼容旧 `recordEvent`、协调 JSONL 与 SQLite | 禁止承载表级 CRUD 细节 |
| Service | 事件标准化、异常归类、指纹去重、状态流转、事务 | 禁止依赖页面组件 |
| DAO | 执行明确 SQL、映射数据库记录 | 禁止判断是否修复或优化 |
| Persistence | 数据库打开、PRAGMA、迁移、事务、关闭、备份恢复 | 禁止包含人物业务判断 |

### 4.3 建议源码目录

```text
apps/ai-desktop/
├── db/
│   ├── ai-memory-paths.json
│   ├── README.md
│   ├── events.sqlite3                 # 本机运行文件，Git 精确忽略
│   ├── events.sqlite3-wal             # 运行时可能出现，Git 精确忽略
│   ├── events.sqlite3-shm             # 运行时可能出现，Git 精确忽略
│   └── sql/
│       ├── load-order.txt
│       ├── schema-AiDesktopSchemaVersion.sql
│       ├── schema-AiDesktopEvent.sql
│       └── ...
└── electron/services/event-center/
    ├── event-center-facade.ts
    ├── service/
    │   ├── event-ingestion-service.ts
    │   ├── incident-service.ts
    │   └── linghu-event-consumer-service.ts
    ├── dao/
    │   ├── event-dao.ts
    │   ├── incident-dao.ts
    │   └── event-consumer-cursor-dao.ts
    └── persistence/
        ├── sqlite-database.ts
        ├── sqlite-migration-runner.ts
        └── sqlite-transaction.ts
```

## 5. 数据库文件位置与生命周期

### 5.1 运行文件

第一阶段先把配置文件位置固定为：

```text
/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db/ai-memory-paths.json
```

配置文件默认把数据库根固定为：

```text
/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db
```

因此当前 macOS 开发环境的唯一运行数据库为：

```text
/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db/events.sqlite3
```

配置文件初始内容：

```json
{
  "schemaVersion": 1,
  "databaseRoot": "/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db",
  "databaseFile": "events.sqlite3"
}
```

开发启动和 macOS Developer 打包版必须通过同一个 `AiMemoryPathResolver` 读取该配置，禁止再根据各自 `userData` 建立不同数据库。配置允许以后显式修改，但调用方不得自行覆盖、拼接或回退到另一位置。

如果配置文件、数据库根或已登记的数据库文件缺失：

- 真正首次初始化时，只有阶段0初始化器可以创建 `events.sqlite3`。
- 已经初始化过但文件缺失时，必须阻断数据库业务并进入恢复，禁止静默创建空数据库。
- 配置无法读取时必须明确报错，禁止回退到 `cache` 或 `Application Support` 生成第二份数据库。
- 其他操作系统接入前必须先提供对应的显式配置值，不能使用这条 macOS 绝对路径猜测位置。

运行期间允许同目录出现：

```text
events.sqlite3
events.sqlite3-wal
events.sqlite3-shm
```

### 5.2 打开与关闭

1. Electron `app.whenReady()` 后创建 `SqliteDatabase`。
2. 打开连接后立即设置连接参数并执行迁移。
3. 迁移成功后才创建 `EventCenterFacade` 和令狐消费者。
4. 应用退出前停止消费者、排空写入队列、执行 checkpoint，再关闭连接。
5. 受控重启必须先保存令狐消费游标、活动问题和启动器恢复点。

### 5.3 建议 SQLite 参数

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

- `foreign_keys` 保证问题、事件、审批和任务关联不产生孤儿记录。
- WAL 降低读取和写入相互阻塞。
- `synchronous=NORMAL` 在本地桌面性能和可靠性之间取得平衡。
- 单写入者仍是首要约束，`busy_timeout` 只处理短暂竞争，不能替代架构隔离。

### 5.4 SELPLAT 中央数据库运行类型登记

AI Desktop 与 Java/H2 应用共用当前用户唯一中央登记：

`apps/rule-engine/backend/src/main/resources/local/<active-stable-user-id>/selplat/通用/registry/managed-database-applications.json`

AI Desktop 固定登记为 `runtimeType=electron`、`databaseEngine=sqlite`，并声明 `schemaRoot=db/sql`、`databaseFile=db/events.sqlite3` 和 `pathConfig=db/ai-memory-paths.json`。Java/H2 条目固定登记为 `runtimeType=java-gradle`、`databaseEngine=h2`。门禁依据登记组合分流，禁止根据应用名称或仅凭 `db/sql` 目录推断数据库引擎；存在 `db/sql` 但没有中央登记时必须阻断。

## 6. 数据库与 SQL 命名规则

### 6.1 数据库对象

| 对象 | 规则 | 示例 |
|---|---|---|
| 路径配置 | 固定文件名，由统一解析器读取 | `db/ai-memory-paths.json` |
| 数据库文件 | 固定数据库根与固定文件名 | `db/events.sqlite3` |
| 表名 | `AiDesktop` + 单数业务名，PascalCase | `AiDesktopEvent` |
| 字段名 | camelCase | `sourceMemberId` |
| 主键 | 统一命名 `id`，SQLite `INTEGER PRIMARY KEY` | `id` |
| 公开编码 | `<业务名>Code`，TEXT，稳定且唯一 | `eventCode` |
| 外键字段 | `<目标业务名>Id` | `incidentId` |
| JSON 字段 | 以 `Json` 结尾 | `payloadJson` |
| 时间字段 | 以 `At` 结尾，UTC ISO-8601 TEXT | `occurredAt` |
| 布尔字段 | 以 `Flag` 或 `Enabled` 结尾，INTEGER 0/1 | `exceptionFlag` |
| 乐观锁 | `versionNo` | `versionNo` |

### 6.2 约束与索引

```text
PK_<TableName>_<Meaning>
UK_<TableName>_<Meaning>
FK_<TableName>_<Meaning>
CK_<TableName>_<Meaning>
IDX_<TableName>_<Meaning>
```

示例：

```text
UK_AiDesktopEvent_EventCode
UK_AiDesktopIncident_FingerprintOpen
FK_AiDesktopIncidentEvent_Incident
FK_AiDesktopIncidentEvent_Event
CK_AiDesktopIncident_Status
IDX_AiDesktopEvent_TypeOccurredAt
IDX_AiDesktopIncident_StatusSeverity
```

索引名表达查询目的，不机械罗列全部字段。只有真实查询路径才能增加索引。

### 6.3 SQL 文件

```text
schema-<ActualTableName>.sql
data-<ActualTableName>.sql
migration-<四位序号>-<kebab-case说明>.sql
```

示例：

```text
schema-AiDesktopEvent.sql
schema-AiDesktopIncident.sql
data-AiDesktopApprovalAutomationSetting.sql
migration-0002-add-event-fingerprint.sql
```

规则：

1. 一个 `schema-*.sql` 只创建文件名对应的一张正式表及其索引、约束。
2. 没有种子数据时不创建空 `data-*.sql`。
3. `load-order.txt` 明确列出首次建库顺序。
4. 已有数据库升级使用 migration 文件，禁止依靠删除数据库重建。
5. migration 一经发布不得修改正文；修正必须追加下一版本。
6. 每次迁移把版本、校验和、执行时间写入 `AiDesktopSchemaVersion`。
7. 禁止 `DROP TABLE`、`TRUNCATE` 或无前置备份的数据清空迁移。

### 6.4 枚举、时间和 JSON

- 数据库存储的枚举值统一使用大写下划线，例如 `INVESTIGATING`、`BUG_FIX`。
- TypeScript 合同可以使用更适合前端的字符串，但 DAO 必须显式转换，禁止隐式大小写兼容。
- 所有时间存储 UTC ISO-8601，例如 `2026-08-25T10:20:30.000Z`。
- JSON 字段只保存扩展事实，不得把应查询、关联或约束的核心字段藏入 JSON。
- `payloadJson` 必须经过长度限制、敏感字段清理和 JSON 有效性校验。

## 7. 统一事件合同

所有模块进入数据库前必须形成同一个事件包：

```ts
interface AiDesktopEventInput {
  eventCode: string;
  eventType: string;
  sourceModule: string;
  sourceMemberId?: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  exceptionFlag: boolean;
  taskId?: string;
  threadId?: string;
  proposalId?: string;
  correlationCode?: string;
  occurredAt: string;
  summary: string;
  details: Record<string, unknown>;
}
```

约束：

- 所有异常无条件写入，不允许在令狐介入前按“是否值得修复”过滤。
- 事件中心可以计算指纹和聚合重复事件，但每次原始发生仍保留 `AiDesktopEvent` 记录。
- 正常高频流不逐字符写入：Codex token、终端字符只记录开始、阶段摘要、完成和失败。
- 页面输入校验等预期异常同样进入事件中心；是否只观察或转为交互优化，由令狐调查决定。
- 事件记录失败不能递归调用事件中心记录自身失败，应写入独立紧急 JSONL 并向页面提供明确状态。

## 8. 分阶段实施方案

### 阶段 0：SQLite 基础设施与迁移门禁

#### 目标

先建立固定路径配置、统一解析器和数据库生命周期，不接管任何现有业务写入。应用仍完全依赖现有 JSON/JSONL 运行，确保基础设施可以独立验证和回退。

#### 本阶段建立的表

##### `AiDesktopSchemaVersion`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 主键 |
| `versionCode` | TEXT | 唯一迁移版本，例如 `0001` |
| `description` | TEXT | 迁移说明 |
| `checksum` | TEXT | SQL 文件校验和 |
| `appliedAt` | TEXT | 应用时间 |
| `durationMs` | INTEGER | 执行耗时 |
| `successFlag` | INTEGER | 是否成功 |

#### 实施内容

1. 在 `apps/ai-desktop/db` 建立 `ai-memory-paths.json`、`sql`、README 和加载清单。
2. 配置文件默认固定 `databaseRoot=/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db`、`databaseFile=events.sqlite3`。
3. 实现唯一 `AiMemoryPathResolver`；开发启动、macOS Developer 打包版和后续数据库组件只能通过它获取路径。
4. 解析器必须验证配置版本、绝对路径、文件名安全性和最终路径仍位于已配置数据库根内。
5. 配置缺失、损坏或路径逃逸时立即阻断数据库初始化，禁止回退到 `userData`、`cache` 或其他默认目录。
6. 在 SELPLAT 根 `.gitignore` 精确忽略 `apps/ai-desktop/db/events.sqlite3`、`events.sqlite3-wal` 和 `events.sqlite3-shm`；配置、SQL、README 继续进入 Git。
7. 实现 `SqliteDatabase`、迁移执行器和事务包装。
8. 完成首次建库、重复启动幂等、迁移失败回滚、正常关闭 checkpoint。
9. 已初始化数据库丢失时保持 AI Desktop 可启动，但关闭依赖数据库的业务并显示恢复提示，禁止伪造一份空库。

#### 验收条件

- 全新目录可以自动建立数据库。
- 配置解析结果严格等于 `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/db/events.sqlite3`。
- 开发启动和 macOS Developer 打包版解析为同一个数据库文件。
- 配置缺失、损坏、相对路径和路径逃逸均被阻断，不产生备用空数据库。
- 运行数据库、WAL 和 SHM 不进入 Git，配置和 SQL 可以进入 Git。
- 重复启动不重复执行迁移。
- 修改已发布迁移文件后能由校验和门禁阻断。
- 迁移失败不会留下半完成结构。
- 本阶段不改变任何现有人物和任务行为。

#### 回退

关闭 SQLite 功能开关并保留未接管业务的本地数据库现场；现有 JSON/JSONL 不受影响。禁止通过删除固定数据库完成普通回退。

### 阶段 1：统一事件写入

#### 目标

把现有 `BusinessAuditLog.recordEvent()` 背后的业务入口统一到 `EventCenterFacade.recordEvent()`。SQLite 成为可查询事件存储，JSONL 继续作为原始审计副本。

#### 本阶段建立的表

##### `AiDesktopEvent`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 本地递增主键，也是消费顺序 |
| `eventCode` | TEXT | 跨日志稳定唯一编码 |
| `eventType` | TEXT | 事件类型，如 `nangong.conversation.thread.lifecycle` |
| `sourceModule` | TEXT | 来源模块 |
| `sourceMemberId` | TEXT | 来源人物，可空 |
| `severity` | TEXT | `INFO/WARNING/ERROR/CRITICAL` |
| `exceptionFlag` | INTEGER | 是否属于异常 |
| `summary` | TEXT | 可读摘要 |
| `fingerprint` | TEXT | 标准化故障指纹，可空 |
| `taskId` | TEXT | 关联协同任务，可空 |
| `threadId` | TEXT | 关联 Codex 线程，可空 |
| `proposalId` | TEXT | 关联提案，可空 |
| `correlationCode` | TEXT | 一次跨模块流程的关联编码 |
| `occurredAt` | TEXT | 业务发生时间 |
| `payloadJson` | TEXT | 已清理的扩展事实 |
| `createdAt` | TEXT | 数据库写入时间 |

建议首批索引：

```text
UK_AiDesktopEvent_EventCode(eventCode)
IDX_AiDesktopEvent_TypeOccurredAt(eventType, occurredAt)
IDX_AiDesktopEvent_ExceptionId(exceptionFlag, id)
IDX_AiDesktopEvent_FingerprintId(fingerprint, id)
IDX_AiDesktopEvent_TaskId(taskId, id)
IDX_AiDesktopEvent_ThreadId(threadId, id)
```

#### 首批接入来源

1. 南宫婉：对话线程创建、删除、删除失败、调查回复、草稿生成、课题保存、提案分发。
2. 韩立：人工审批、自动审批、证据不足、审批失败、历史偏好引用。
3. 令狐：检测、恢复、修正方案、统一测试和模块完成。
4. Codex：线程创建、恢复、取消、删除、连接中断、`active writer` 和协议失败。
5. 协同任务：提交、领取、审核、执行、阻塞、取消、集成和完成。
6. 测试系统：排队、占用、冲突、释放、超时、测试结果。
7. 启动器：启动、关闭、受控重启、恢复点和恢复结果。
8. 基础能力：持久化、截图、文件、工作区、可信命令和 IPC 失败。

#### 写入策略

- `EventCenterFacade` 对 SQLite 与 JSONL 分别写入，任一副本失败不得伪装成全部成功。
- SQLite 是运行处理的权威来源；JSONL 是不可变审计和重建来源。
- 同一 `eventCode` 重试写入必须幂等。
- 普通业务不能因为非关键 INFO 事件暂时写入失败而被阻断；异常事件写入失败必须有紧急文件兜底和可见告警。

#### 验收条件

- 南宫婉 `delete_failed` 同时存在于 SQLite 和 JSONL。
- 所有异常具有来源、严重程度、异常标记、摘要和发生时间。
- 同一个 `eventCode` 不会产生重复数据库记录。
- 旧日志查询与现有审计归档保持可用。

#### 回退

把 `EventCenterFacade` 切回仅写 JSONL；SQLite 保留现场但不再接收新事件。

### 阶段 2：令狐统一调查与问题闭环

#### 目标

让令狐按数据库游标持续读取全部异常。事件中心不替令狐过滤异常；令狐调查后决定修复、优化、重构、规则演进或观察。

#### 本阶段建立的表

##### `AiDesktopEventConsumerCursor`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 主键 |
| `consumerCode` | TEXT | 消费者编码，令狐使用 `linghu-ancestor` |
| `lastEventId` | INTEGER | 已完成处理的最后事件 ID |
| `leaseOwner` | TEXT | 当前消费租约持有者 |
| `leaseUntil` | TEXT | 租约截止时间 |
| `lastConsumedAt` | TEXT | 最近消费时间 |
| `versionNo` | INTEGER | 乐观锁版本 |
| `createdAt` | TEXT | 创建时间 |
| `updatedAt` | TEXT | 更新时间 |

##### `AiDesktopIncident`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 主键 |
| `incidentCode` | TEXT | 问题公开编码 |
| `fingerprint` | TEXT | 故障归并指纹 |
| `title` | TEXT | 问题标题 |
| `severity` | TEXT | 当前最高严重程度 |
| `status` | TEXT | 问题处理状态 |
| `handlingDirection` | TEXT | 令狐判断的处理方向 |
| `ownerMemberId` | TEXT | 当前负责人，默认令狐 |
| `firstEventId` | INTEGER | 首次事件 |
| `lastEventId` | INTEGER | 最近事件 |
| `occurrenceCount` | INTEGER | 发生次数 |
| `investigationSummary` | TEXT | 调查结论 |
| `activeProposalId` | TEXT | 当前修正或优化提案，可空 |
| `activeTaskId` | TEXT | 当前执行任务，可空 |
| `versionNo` | INTEGER | 乐观锁版本 |
| `createdAt` | TEXT | 创建时间 |
| `updatedAt` | TEXT | 更新时间 |
| `resolvedAt` | TEXT | 解决时间，可空 |

##### `AiDesktopIncidentEvent`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 主键 |
| `incidentId` | INTEGER | 问题外键 |
| `eventId` | INTEGER | 事件外键 |
| `relationType` | TEXT | `TRIGGER/RECURRENCE/EVIDENCE/VERIFICATION` |
| `createdAt` | TEXT | 建立关联时间 |

##### `AiDesktopIncidentAction`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 主键 |
| `actionCode` | TEXT | 动作公开编码 |
| `incidentId` | INTEGER | 所属问题 |
| `actorMemberId` | TEXT | 操作人物或用户 |
| `actionType` | TEXT | 调查、归类、提交审批、执行、验证等 |
| `fromStatus` | TEXT | 动作前状态 |
| `toStatus` | TEXT | 动作后状态 |
| `conclusion` | TEXT | 结论或说明 |
| `evidenceJson` | TEXT | 使用的事实证据 |
| `proposalId` | TEXT | 关联提案，可空 |
| `taskId` | TEXT | 关联任务，可空 |
| `createdAt` | TEXT | 动作时间 |

##### `AiDesktopAutomationState`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER | 主键 |
| `automationCode` | TEXT | 自动流程编码，令狐为 `linghu-safeguard` |
| `enabled` | INTEGER | 是否开启 |
| `currentModule` | TEXT | 当前职责模块 |
| `cycle` | INTEGER | 当前循环 |
| `activeIncidentId` | INTEGER | 当前调查问题，可空 |
| `activeTaskId` | TEXT | 当前保障任务，可空 |
| `recoveryCheckpoint` | TEXT | 恢复点 |
| `blockingReason` | TEXT | 阻塞原因，可空 |
| `lastCheckedAt` | TEXT | 最近检查时间 |
| `versionNo` | INTEGER | 乐观锁版本 |
| `createdAt` | TEXT | 创建时间 |
| `updatedAt` | TEXT | 更新时间 |

#### 状态模型

```text
NEW
  → INVESTIGATING
  → AWAITING_APPROVAL
  → APPROVED
  → EXECUTING
  → VERIFYING
  → RESOLVED
```

允许的旁路状态：

- `BLOCKED`：需要人工业务选择或外部条件。
- `OBSERVING`：令狐已经调查，暂不修改但持续观察。
- `REJECTED`：韩立拒绝当前方案，令狐必须根据意见修订或重新调查。

处理方向：

```text
BUG_FIX
OPTIMIZATION
REFACTOR
RULE_EVOLUTION
OBSERVE
```

#### 消费规则

1. 令狐从 `lastEventId` 之后顺序读取事件。
2. 所有 `exceptionFlag=1` 的事件都必须被令狐认领或关联到已有问题。
3. 指纹相同只做问题聚合，不删除或跳过原事件。
4. 推进游标、创建或关联问题、写入调查动作必须处于同一事务。
5. 调查失败不能推进游标，重启后必须重新处理。
6. 同一事件重复消费必须依靠唯一约束保持幂等。
7. 自动开关开启后检测不自行关闭；阻塞时保存恢复点并继续读取其他事件。

#### 南宫婉删除失败示例

```text
nangong.conversation.thread.lifecycle/delete_failed
    → AiDesktopEvent
    → 令狐消费游标读取
    → 通过 active-writer 指纹创建或关联 AiDesktopIncident
    → AiDesktopIncidentAction 记录调查
    → 选择 BUG_FIX 或 OPTIMIZATION
    → 提交韩立审批
```

#### 验收条件

- 南宫婉删除失败无需依赖协同任务即可被令狐发现。
- 每个异常事件都能查询到令狐处理结果。
- 相同 `active writer` 连续发生时聚合为一个问题并增加次数。
- 应用重启后令狐从持久游标继续，不重复创建问题。
- 观察类问题也有令狐调查动作，不能被静默过滤。

#### 回退

暂停令狐数据库消费者，保留事件写入和已有问题；恢复原 `linghu-automation.json` 作为自动流程状态来源。

### 阶段 3：南宫婉、令狐与韩立的演化审批数据

#### 目标

把课题、提案、审批记录和审批偏好迁入关系数据库，使南宫婉与令狐共享同一个审批事实源，韩立能够按真实历史记录进行自动审批。

#### 本阶段建立的表

##### `AiDesktopEvolutionTopic`

核心字段：

```text
id, topicCode, title, goal, content, scopeJson, evidenceJson,
acceptanceCriteriaJson, submitterMemberId, status, sourceConversationId,
versionNo, createdAt, updatedAt, completedAt
```

##### `AiDesktopEvolutionProposal`

核心字段：

```text
id, proposalCode, topicId, origin, proposalType, title, content,
evidenceJson, impactScopeJson, risksJson, rollbackPlan,
acceptanceCriteriaJson, submitterMemberId, status, versionNo,
supersedesProposalId, createdAt, updatedAt
```

`origin` 固定为 `NANGONG` 或 `LINGHU`。`proposalType` 对应：

```text
RULE_EVOLUTION
RULE_OPTIMIZATION
RULE_REFACTOR
DIRECTORY_EVOLUTION
CODE_CORRECTION
BUG_FIX
```

##### `AiDesktopEvolutionApproval`

核心字段：

```text
id, approvalCode, proposalId, approverMemberId, decision, source,
advice, evidenceJson, feedbackTarget, capabilityScope,
createdAt
```

`source` 固定为 `MANUAL_USER` 或 `AUTOMATIC_HAN_LI`，禁止自动审批冒充用户审批。

##### `AiDesktopApprovalPreference`

核心字段：

```text
id, preferenceCode, proposalOrigin, proposalType, decisionDirection,
factPatternJson, sourceApprovalId, confidence, validFlag,
createdAt, updatedAt
```

偏好记录必须能追溯到人工审批事实，不能直接存储模型猜测。

##### `AiDesktopApprovalAutomationSetting`

核心字段：

```text
id, approvalOrigin, enabled, lastOperateUserId, versionNo,
createdAt, updatedAt
```

`NANGONG` 和 `LINGHU` 必须为两条独立设置，默认关闭。

#### 迁移策略

1. 从 `nangong-evolution.json` 只读生成迁移批次。
2. 校验课题、提案、版本、审批数量和关联关系。
3. 在一个事务中写入 SQLite。
4. 按记录数、稳定编码和摘要哈希复核。
5. 验证通过后切换为 SQLite 单写；旧 JSON 改为只读备份，禁止长期双写。
6. 发现差异立即回退到旧 JSON，不删除原数据。

#### 验收条件

- 南宫婉与令狐提案进入同一审批表。
- 两个自动审批开关独立且默认关闭。
- 自动审批只使用同来源、同类型、可追溯的人工审批历史。
- 提案补充、拒绝、修订和替代关系完整。
- 审批通过后能关联回南宫婉拆分任务或令狐修正任务。

#### 回退

停止 SQLite 审批写入并恢复迁移前 JSON；数据库记录保留为故障证据，不执行反向覆盖。

### 阶段 4：协同执行、测试与启动器恢复

#### 目标

把审批后的执行、检查点、测试和受控重启纳入同一事实链，令狐可以从问题一直追踪到最终验证。

#### 本阶段建立的表

##### `AiDesktopCollaborationTask`

核心字段：

```text
id, taskCode, title, initiatorMemberId, executorMemberId, reviewerMemberId,
proposalId, incidentId, state, phase, revisionNo, workerGeneration,
baseSha, resultSha, blockingReason, createdAt, updatedAt, completedAt
```

##### `AiDesktopTaskCheckpoint`

核心字段：

```text
id, checkpointCode, taskId, checkpointType, phase, stateSnapshotJson,
processId, port, buildRoot, recoveryInstruction, createdAt
```

##### `AiDesktopTestRun`

核心字段：

```text
id, testRunCode, taskId, incidentId, testType, status,
commandSummary, reportPath, evidencePath, startedAt, completedAt,
durationMs, createdAt
```

数据库不保存完整终端输出，只保存报告路径、证据路径、摘要和校验信息。

##### `AiDesktopLauncherCheckpoint`

核心字段：

```text
id, checkpointCode, reason, applicationVersion, executablePath,
activeTaskId, activeIncidentId, linghuCursorEventId,
stateSnapshotJson, status, createdAt, resumedAt
```

#### 接入流程

```text
Incident
  → EvolutionProposal
  → EvolutionApproval
  → CollaborationTask
  → TaskCheckpoint
  → TestRun
  → LauncherCheckpoint（需要重启时）
  → Incident RESOLVED
```

#### 验收条件

- 每个令狐问题都能查询关联提案、审批、任务、测试和最终结果。
- 任务取消、阻塞、集成冲突和测试失败不会丢失恢复点。
- 启动器重启后先恢复游标和活动问题，再继续任务。
- 测试报告和大日志仍存文件，数据库路径不存在时能明确报告资料缺失。
- 问题只有在验证证据完成后才能进入 `RESOLVED`。

#### 回退

保留数据库的事件与问题读取能力，把任务和启动器恢复切回现有 JSON 状态源；不删除已记录的检查点。

### 阶段 5：单一事实源切换、归档与维护

#### 目标

在前四阶段稳定后清理长期双写，建立备份、重建、归档和健康检查，使 SQLite 成为运行处理的单一事实源。

#### 本阶段新表

本阶段默认不新增业务表。只有真实维护需求出现时，才能新增备份批次或归档批次表，禁止为了目录对称预建空表。

#### 实施内容

1. 逐项确认哪些 JSON 已由数据库替代。
2. 被替代 JSON 先冻结为只读迁移备份，经过完整版本周期后再决定是否归档。
3. JSONL 保持原始审计权威，不因 SQLite 上线而删除。
4. 提供从 JSONL 重建 `AiDesktopEvent` 的工具，但重建问题处理状态必须保留人工确认边界。
5. 提供数据库一致性检查、外键检查、迁移校验和检查和 checkpoint 状态检查。
6. 数据库备份必须在暂停写入或使用 SQLite 在线备份能力时生成，禁止直接复制活跃 WAL 状态下的不完整主文件。
7. 不自动删除历史事件；保留周期必须在取得明确业务决定后配置。

#### 验收条件

- 所有运行状态都有唯一权威来源，没有永久双写。
- 数据库损坏时可以从备份和 JSONL 恢复事件事实。
- 备份恢复后令狐游标、未解决问题和审批关联一致。
- Git 工作区不会因运行数据库写入持续变脏。

## 9. Service 与 DAO 详细边界

### 9.1 EventIngestionService

负责：

- 校验统一事件合同。
- 补充 `eventCode`、`createdAt` 和关联编码。
- 清理敏感字段和机器私密信息。
- 计算稳定故障指纹。
- 在事务中追加事件。
- 通知令狐消费者有新事件，但通知丢失时仍能依靠游标轮询恢复。

不负责：

- 判断是否值得修复。
- 创建演化提案。
- 修改协同任务状态。

### 9.2 IncidentService

负责：

- 根据事件创建或关联问题。
- 维护首次、最近事件和发生次数。
- 校验问题状态流转。
- 记录令狐调查动作。
- 关联提案、审批、任务和验证证据。

### 9.3 LinghuEventConsumerService

负责：

- 获取和续期令狐消费租约。
- 按 ID 顺序读取未消费事件。
- 确保所有异常进入调查。
- 在事务成功后推进游标。
- 崩溃、重启或重复投递时保持幂等。

### 9.4 DAO 方法命名

DAO 使用业务语义方法，禁止通用表名字符串 CRUD：

```ts
eventDao.append(event)
eventDao.findByCode(eventCode)
eventDao.listExceptionsAfterId(lastEventId, limit)

incidentDao.findOpenByFingerprint(fingerprint)
incidentDao.create(incident)
incidentDao.attachEvent(incidentId, eventId, relationType)
incidentDao.transitionStatus(id, expectedStatus, nextStatus, versionNo)

cursorDao.acquireLease(consumerCode, leaseOwner, leaseUntil)
cursorDao.advance(consumerCode, expectedEventId, nextEventId, versionNo)
```

禁止：

```ts
baseDao.save(tableName, data)
baseDao.update(tableName, data)
baseDao.delete(tableName, id)
```

事件只能追加；问题状态必须受控流转；游标必须比较并原子推进，普通 CRUD 无法表达这些约束。

## 10. 事务与并发规则

1. SQLite 只有一个写入队列。
2. 单次事务应短小，禁止在事务内调用 Codex、文件选择器、网络或测试命令。
3. 事件追加与 JSONL 归档分别返回结果，不能因一方成功而伪造另一方成功。
4. 创建问题、关联事件、写入动作和推进令狐游标必须原子完成。
5. 状态更新使用 `versionNo` 防止过期页面或重复消费者覆盖新状态。
6. 批量事件可以按数量或极短时间窗口合并事务；具体阈值必须通过真实负载测试确定，不能写死为未经验证的性能结论。
7. 数据库繁忙超过 `busy_timeout` 后返回结构化失败，不无限等待。
8. 数据库迁移期间禁止业务写入。

## 11. 性能设计

### 11.1 数据库适合保存的内容

- 结构化事件元数据。
- 问题状态与处理动作。
- 消费游标和恢复点。
- 提案、审批、任务和测试之间的关联。
- 可检索的摘要、哈希和文件引用。

### 11.2 保留在文件中的内容

- JSONL 原始审计日志。
- 截图和附件。
- 完整终端输出。
- Codex 原始流式文本。
- 测试报告、构建产物和 Git 补丁。

### 11.3 性能门禁

- 不在渲染线程执行数据库 I/O。
- 不为每个 Codex token 或终端字符建事件。
- 不给低选择性字段盲目建立索引。
- 对事件分页必须使用 `id > cursor`，禁止大偏移量 `OFFSET` 扫描。
- `payloadJson` 设置大小上限，超出内容写文件并保存引用。
- 记录数据库写入时延、队列长度、批量大小和失败次数，令狐可以对事件中心自身进行优化。

## 12. 故障恢复

### 12.1 SQLite 写入失败

1. 不递归调用 `EventCenterFacade` 记录自身异常。
2. 写入独立紧急 JSONL，包含时间、操作、数据库路径、错误和原事件编码。
3. 页面展示数据库降级状态。
4. 令狐在数据库恢复后读取紧急日志并生成补录或调查动作。

### 12.2 JSONL 写入失败

- SQLite 事件保留。
- 标记 `auditMirrorStatus=FAILED` 的处理事实，或通过独立内存健康状态暴露。
- 修复归档目录后按事件编码补写，禁止产生重复事件。

### 12.3 数据库损坏

1. 停止写入并保留原文件。
2. 复制损坏数据库和 WAL/SHM 作为诊断材料。
3. 使用最近有效备份恢复。
4. 从 JSONL 补齐备份后的事件。
5. 对未解决问题、游标、审批和任务关联执行一致性核对。
6. 未验证一致前禁止自动标记问题已解决。

## 13. 安全与隐私

- 不保存访问令牌、密码、Cookie、环境变量全集或可信命令密钥。
- 对话内容只保存完成调查所需的最小摘要和事实引用；完整内容继续由原会话存储管理。
- 本机绝对路径可以作为诊断事实保存，但展示和导出前必须评估脱敏范围。
- `payloadJson` 必须执行字段白名单或明确的敏感字段清理。
- Git 导出只能包含结构、迁移和脱敏后的人工选择数据，禁止提交运行数据库。

## 14. 分阶段测试与交付门禁

| 阶段 | 必须验证 |
|---|---|
| 0 | 首次建库、重复迁移、校验和、失败回滚、关闭 checkpoint |
| 1 | 全模块事件合同、SQLite/JSONL 双副本、幂等和紧急兜底 |
| 2 | 令狐全异常消费、指纹聚合、事务游标、重启恢复和状态流转 |
| 3 | 课题/提案/审批迁移、独立自动开关、人工历史推断和修订链 |
| 4 | 任务、测试、启动器恢复点及问题最终解决证据 |
| 5 | 单一事实源、备份恢复、JSONL 重建、外键和长期性能 |

每个阶段必须同时具备：

1. DAO 隔离数据库测试。
2. Service 事务与状态流转测试。
3. Facade 调用链测试。
4. 真实 SQLite 文件的迁移和重启测试。
5. 生产交互测试。
6. 数据损坏、写入竞争和重复消费异常测试。
7. 现有 JSON/JSONL 行为回归。

前一阶段未通过统一测试和回退验证，禁止进入下一阶段的数据源切换。

## 15. 推荐实施顺序总结

```text
阶段 0：固定路径配置、SQLite、迁移和事务基础
    ↓
阶段 1：所有模块统一写事件，JSONL 保留
    ↓
阶段 2：令狐读取全部异常并形成问题闭环
    ↓
阶段 3：南宫婉/令狐提案与韩立审批迁入数据库
    ↓
阶段 4：协同任务、测试和启动器恢复关联
    ↓
阶段 5：切换单一事实源、备份、重建与长期维护
```

最先交付的业务价值必须是：南宫婉 `delete_failed` 等非协同任务异常能够进入统一事件表，令狐重启后仍能读取、调查、归并并提交修正或优化方案。数据库建设不能先扩大到普通设置、所有聊天消息或大文件存储，而延迟这一核心闭环。
