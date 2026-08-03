## 固定路径配置（文件头唯一绝对路径区）
- 编译与依赖解析默认使用本机离线资源；仅 macOS 可在项目缓存和本机 Gradle 缓存都缺少必需依赖时，按 macOS 专属规则联网补齐并写入当前工程缓存。
- 唯一记忆库根目录：`MEMORY_ROOT=C:/opt/workspace/SELPLAT/MEMORIES`
- 统一能力系统目录：`MEMORY_CODE_ROOT=${MEMORY_ROOT}/ai/code`
- 统一协议目录：`MEMORY_PROTOCOL_ROOT=${MEMORY_ROOT}/ai/protocol`
- rule-engine 规则资源根目录：`RULE_ENGINE_RESOURCE_ROOT=${MEMORY_ROOT}/../apps/rule-engine/backend/src/main/resources`
- rule-engine 唯一规则索引：`RULE_ENGINE_RULE_INDEX=${RULE_ENGINE_RESOURCE_ROOT}/RULE_INDEX.md`
- `MEMORY_ROOT` 用于加载启动协议、能力和既有记忆；若其中已有与当前任务同主题且失效、冲突或路径错配的规则、协议、能力代码、测试或索引，必须同步修正，禁止因其位于 `MEMORY_ROOT` 而保留错误记录。
- 所有新规则、专项规则加载、规则主索引与规则主维护必须使用 `RULE_ENGINE_RULE_INDEX`；`MEMORY_ROOT` 中的既有相关记录仅作为同步修正对象，不得根据 `MEMORY_ROOT` 反推当前工程。
- 本节之后不得书写实际绝对路径；需要定位文件时必须引用本节变量、`CURRENT_PROJECT_ROOT` 或相对于对应根目录的路径。

## 当前工程识别、统一能力系统与离线执行基准

- 当前工程根目录不得固定为 SELPLAT：优先采用用户明确指定的工程绝对目录；未指定时，从当前命令工作目录向上查找最近的 `.git` 或 `AGENTS.md` 项目标记；没有项目标记时使用当前命令工作目录本身。
- 当前工程名称变量：`CURRENT_PROJECT_NAME` 取 `${CURRENT_PROJECT_ROOT}` 的末级目录名，仅用于任务记录和项目规则适用范围识别。
- 当前工程独立执行内务目录：`${CURRENT_PROJECT_ROOT}/OPTION`
- 当前工程当前线程执行文档：`${CURRENT_PROJECT_ROOT}/OPTION/执行文档.<CURRENT_THREAD_ID>.md`
- 当前工程当前线程执行历史：`${CURRENT_PROJECT_ROOT}/OPTION/temp/执行文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md`
- 当前工程执行池：`${CURRENT_PROJECT_ROOT}/OPTION/执行池.md`
- 当前工程统一编译产物目录：`${CURRENT_PROJECT_ROOT}/build`
- 当前工程工具运行生成数据与临时目录：`${CURRENT_PROJECT_ROOT}/OPTION/temp`
- 当前工程统一缓存目录：`${CURRENT_PROJECT_ROOT}/cache`
- 统一能力调用目录：`${MEMORY_ROOT}`
- 统一能力系统：`${MEMORY_CODE_ROOT}`
- 当前规则维护目录：`${RULE_ENGINE_RESOURCE_ROOT}`
- 当前规则索引：`${RULE_ENGINE_RULE_INDEX}`
- 本机 Python：优先使用当前系统 `PATH` 中可用的 `python3`，不得在正文固定解释器的机器绝对路径。
- 统一记忆库位于 SELPLAT 不代表当前工程是 SELPLAT；工程源码命令使用 `${CURRENT_PROJECT_ROOT}`，能力调用使用文件头定义的记忆库变量，规则读取与维护使用 `${RULE_ENGINE_RULE_INDEX}`，并且必须向执行文档能力传递当前工程根或从当前工程工作目录调用。
- 禁止回退到 `SELFMEMORY`、其他能力系统或跨工程共享 `OPTION`；禁止根据 `MEMORIES` 所在位置反推当前工程。
- Gradle 编译产物和构建报告必须统一写入当前工程的 `build`；依赖和可复用缓存必须统一写入 `cache`；Java、Python、能力、脚本、测试辅助工具和文档工具运行生成的业务数据、中间文件、报告、日志、验证输出及临时副本必须统一写入当前工程的 `OPTION/temp`。禁止写入工程根 `tmp`、`OPTION/tmp`、源码或 resources 目录以及未显式归属当前工程的系统临时目录。

## 操作系统规则分流

1. 执行任何平台相关命令前必须根据实际运行环境设置 `CURRENT_OS=macos|windows|linux`，禁止根据工程来源、路径文本或记忆库所在位置推断操作系统。
2. 标记为 macOS、Windows 或 Linux 的规则只在 `CURRENT_OS` 与其匹配时生效；不匹配的平台规则必须忽略，不得作为命令、路径、编码或环境变量写法的执行依据。
3. 当前环境为 macOS 时，必须忽略全部 Windows 专属设置，包括 PowerShell、`$env:`、Windows 代码页、`.bat` 和反斜杠路径写法。
4. 跨平台通用规则始终生效；平台专项规则与通用规则冲突时，先保持通用目标，再采用当前平台的等价实现。

## UTF-8 文件与命令规则

### 跨平台通用

1. 文本文件必须按 UTF-8 完整读取和写入；修改前不得使用会清洗、截断或按系统默认编码读取正文的命令。
2. 使用 Python、执行测试或编译 Python 文件前必须把字节码缓存统一定向到 `${CURRENT_PROJECT_ROOT}/cache/python-pycache`，禁止在源码目录生成 `__pycache__`。
3. 能力系统定位使用文件头定义的 `MEMORY_CODE_ROOT`；工程文件和执行文档定位使用 `${CURRENT_PROJECT_ROOT}` 派生路径；rule-engine 规则正文记录可迁移引用时使用相对于 `RULE_ENGINE_RESOURCE_ROOT` 的路径。

### macOS 专属

1. 本小节仅在 `CURRENT_OS=macos` 时生效；Windows 专属小节在 macOS 下必须完整忽略。
2. 使用本机 Python 前必须在 POSIX shell 中设置 `export PYTHONUTF8=1` 与 `export PYTHONIOENCODING=utf-8`。
3. 使用本机 Python、执行测试或编译 Python 文件前必须设置 `export PYTHONPYCACHEPREFIX="${CURRENT_PROJECT_ROOT}/cache/python-pycache"`。
4. macOS 命令必须使用 POSIX 路径和当前 shell 语法，禁止执行 PowerShell、`$env:`、`chcp` 或 `.bat` 指令。
5. 编译或依赖解析必须先检查 `${CURRENT_PROJECT_ROOT}/cache` 与本机 Gradle 缓存；两者均缺少必需依赖时，允许仅通过项目已声明的 Gradle 仓库联网解析。
6. macOS 联网解析必须设置 Gradle 用户目录为 `${CURRENT_PROJECT_ROOT}/cache/gradle-user-home`；解析完成后，供平铺式 `fileTree` 直接引用的二进制 JAR 必须补充到 `${CURRENT_PROJECT_ROOT}/cache/cache-jars`，不得写入源码目录或使用系统级临时目录。
7. 联网补齐仅限确有缺失的项目依赖，禁止下载无关工具、来源不明的二进制文件或源码、Javadoc 包；补齐后必须切回离线编译验证。

### Windows 专属

1. 本小节仅在 `CURRENT_OS=windows` 时生效；macOS 和 Linux 环境必须完整忽略本小节。
2. PowerShell 读取文本前设置 `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()`，并使用 `Get-Content -LiteralPath <目标文件> -Raw -Encoding utf8`。
3. 使用本机 Python 前必须设置 `$env:PYTHONUTF8='1'` 与 `$env:PYTHONIOENCODING='utf-8'`，避免 Windows 默认编码导致中文输出失败。
4. 使用本机 Python、执行测试或编译 Python 文件前必须设置 `$env:PYTHONPYCACHEPREFIX='${CURRENT_PROJECT_ROOT}/cache/python-pycache'`。
5. 执行可能输出中文的 `.bat` 前必须切换 UTF-8 代码页并设置 PowerShell UTF-8 输出；若仍乱码，必须停止依赖乱码输出并改用可明确指定 UTF-8 的等价本机入口。
6. Windows 的编译与依赖解析必须严格使用工程缓存和本机已有缓存，禁止为补齐依赖联网下载。

## 完工规则治理

1. 每次程序、能力、脚本或正式任务执行完成后，必须总结本轮暴露的可复用规则，并检查 `${RULE_ENGINE_RULE_INDEX}`。
2. 跨工程通用规则维护在 `${RULE_ENGINE_RESOURCE_ROOT}/跨工程通用规则/`；组织或独立业务模块规则维护在 `${RULE_ENGINE_RESOURCE_ROOT}/<module>/rule/`；模板、文档和样例按对应模块资源目录维护。工程之间禁止共用 `OPTION` 或工程专属执行文档。
3. SELPLAT 工程内全部应用共用的规则统一维护在 `${RULE_ENGINE_RESOURCE_ROOT}/selplat/通用规则/`；`${CURRENT_PROJECT_ROOT}/apps/<app>/` 下当前及未来单个应用的专项规则统一维护在 `${RULE_ENGINE_RESOURCE_ROOT}/selplat/应用规则/<app>/`。禁止使用语义不明的 `selplat/rule/`，也禁止为平台内部应用在 `${RULE_ENGINE_RESOURCE_ROOT}` 下创建同名顶层目录。
4. 新规则不存在时新增；已有同义或近义规则时更新、合并现有规则，不得重复堆叠。
5. 表面冲突但适用方向、场景或边界不同的规则必须分类到独立模块，不得互相覆盖；真正冲突且适用范围相同的规则以新规则替换旧规则。
6. 已失效、无调用入口或被新规则完全替代的规则必须删除，并同步清理 `${RULE_ENGINE_RULE_INDEX}` 中的旧引用。
7. 每个新主题规则使用直接位于所属规则根的独立 Markdown 主文件；规则文件使用 HTML 注释说明问题、场景和业务含义，并使用 DSL 行表达稳定约束。新建主规则文件必须命名为 `RUL_主题规则.md`。存在 README、说明、模板、样例或项目配置时，必须在主规则文件同级创建去掉 `.md` 后同名的资产目录，并仅使用 `docs/`、`template/`、`examples/`、`project/` 标准子目录；禁止把主规则文件放进同名资产目录。
8. 新增、更新、移动或删除规则后，必须同步 `${RULE_ENGINE_RULE_INDEX}`；规则正文中的工程内路径优先写相对于 `${RULE_ENGINE_RESOURCE_ROOT}` 的路径。
9. 新规则、规则主索引和规则主维护必须落在 `${RULE_ENGINE_RESOURCE_ROOT}`；但必须检查 `MEMORY_ROOT` 是否存在同主题记录。若其中的规则、协议、能力代码、测试或索引已失效、冲突、路径错配或无法满足当前规则，必须同步更新、迁移或删除对应旧记录；能力行为变更时必须同步修正其测试或验证入口。

## 会话启动

新会话必须完成最小启动链后才能执行任务。  
唯一合法能力系统：`${MEMORY_CODE_ROOT}`
启动流程：
- 优先使用 `${MEMORY_CODE_ROOT}/abilities/startup_protocol_loader.py`
- 否则按顺序完整读取并汇报：
  `STARTER → USER → CODE → COMMAND → RULE_INDEX → GENERATOR_REPAIR_PROTOCOL`
- `GENERATOR_REPAIR_PROTOCOL.md` 属于最小启动链的启动后必读通用修复协议；当任务暴露能力不足、规则不够、规则重复、生成器错配、模板失配或需要升级合并时，必须作为协议层执行依据。
- 启动链中的 `${MEMORY_PROTOCOL_ROOT}/RULE_INDEX.md` 仅作协议兼容入口；专项规则的实际加载、冲突裁决和主维护以 `${RULE_ENGINE_RULE_INDEX}` 为准，但其自身失效或与当前规则冲突时必须同步修正。
启动完成后必须对外说明：
- 已读协议：`STARTER → USER → CODE → COMMAND → RULE_INDEX → GENERATOR_REPAIR_PROTOCOL`
- 生效约束：仅说明本轮实际生效的协议约束与已加载规则约束，禁止笼统表述。
必须严格遵守已读协议内容；协议与规则冲突时，先按协议层级执行，再按已命中的规则执行。
对于会产生新增 / 删除 / 修改结果的任务，在给出独立 `1 / 2` 选项前，必须先根据 `${RULE_ENGINE_RULE_INDEX}` 查找并按需最小加载相应规则。
规则加载时必须对外给出加载提示，至少包含：
- 本次已加载的规则文件
- 每条规则的加载原因
- 若当前操作未命中任何专项规则，必须明确说明：`当前操作未加载任何专项规则，仅按启动协议与已生效通用约束执行。`
执行阶段必须严格遵守：
- 已读协议内容
- `${RULE_ENGINE_RULE_INDEX}` 命中的已加载规则内容
- 未经 `RULE_INDEX.md` 命中并加载的专项规则，不得擅自引用为执行依据

## SELPLAT 规则适配审查与阻断

1. 任何会产生新增、删除、修改或重构结果的 SELPLAT 任务，在给出 `1 / 2` 前必须对照已加载规则检查用户原始方案。
2. 用户指定的实现位置、继承关系、公开接口、调用层级、数据目录或测试方式违反任一已加载规则时，必须停止执行并报告规则文件、具体约束、冲突内容和不能执行的原因。
3. 规则冲突时可以说明合规方向，但不得静默替换用户方案、擅自选择替代方案、先执行后补规则或根据现有代码反向覆盖规则。
4. 只有用户明确要求修改冲突规则且规则治理完成后，原任务才能重新检查规则适配并重新取得 `1 / 2` 确认。


## 执行文档规则


进入正式执行前，必须通过统一入口 `${MEMORY_CODE_ROOT}/executor.py` 调用 `execution_doc_manager`，维护 `${CURRENT_PROJECT_ROOT}/OPTION/执行文档.<CURRENT_THREAD_ID>.md`。`CURRENT_THREAD_ID` 必须取当前 Codex 任务页面线程标识；调用时可显式传入 `thread_id`，未传时能力读取当前页面的 `CODEX_THREAD_ID`。调用时必须显式传入 `project_root`，或确保命令工作目录位于当前工程内；仅在能力不可用时才允许手工维护。除经确认的误放迁移动作外，禁止读写其他工程的 `OPTION`。

规则：
1. 任务开始前调用 `check` 或 `start_task`；若存在未完成步骤，必须继续完成，禁止清空或开启新任务。
2. 上一轮全部完成后，由能力自动归档至  
   `${CURRENT_PROJECT_ROOT}/OPTION/temp/执行文档.history_YYYY-MM-DD.<CURRENT_THREAD_ID>.md`，再生成新文档。
   - 归档仅允许通过能力的追加式程序；禁止 `apply_patch`、全文改写或手工修改历史文件。  
   - 返回 `status=completed` 即视为完成；除非失败或路径缺失，禁止二次检查或重复归档。
3. 日期使用当天 `YYYY-MM-DD`；同日同一线程记录写入同一历史文件，不同任务页面必须写入不同历史文件。
4. 两个任务页面必须使用不同的 `CURRENT_THREAD_ID`，不得共用、覆盖或阻塞对方的执行文档；旧的 `${CURRENT_PROJECT_ROOT}/OPTION/执行文档.md` 仅允许由能力在首次调用时迁移到当前线程文件，之后不得继续写入。
5. 新任务需通过能力写入总体目标和完整步骤，格式遵循当前文档结构。
6. 新步骤默认为“未完成”，执行完成后调用能力更新状态并补写结果。
7. 每一步必须描述具体任务内容，不得仅写序号或过短名称。


## 用户确认规则

1. 未先说明任务理解并给出独立 `1 / 2` 选项前，禁止进入任何任务相关的读取、分析、搜索、命令、能力调用或实现。
2. `${CURRENT_PROJECT_ROOT}/OPTION/执行文档.<CURRENT_THREAD_ID>.md` 的创建、续写、状态更新与结果补写属于执行内务，不需额外确认。
3. 纯查询、只读、解释或分析且不产生新增 / 删除 / 修改结果的任务，无需用户确认及 `1 / 2`。
4. 仅当任务会产生新增 / 删除 / 修改结果时，才需说明任务理解并给出独立 `1 / 2`，等待确认后执行。
5. 用户单独回复 `1`：仅确认最近一次明确陈述的任务并打开该任务执行门，不得扩展为确认其他任务。
6. 用户单独回复 `2`：仅表示将最近一次任务加入执行池，不立即执行。
7. “好 / 继续 / 可以”等非独立 `1 / 2` 不构成授权；涉及变更任务时必须重新给出 `1 / 2`。
8. 会话执行池为 USER 协议层的临时状态，不等同正式执行或记忆写入；仅在用户明确要求时才写入 `${CURRENT_PROJECT_ROOT}/OPTION/执行池.md`。
9. 执行池达到 5 项及以上时，每轮必须提示当前待办。
10. 用户明确要求执行执行池任务时，视为授权按顺序连续处理，直至全部完成或遇到不可解决的硬阻塞；最终仅交付整体结果
11. 若 `1 / 2` 语义存在歧义，优先按本规则解释；仍无法判断时必须向用户澄清，不得擅自执行或取消。

## 执行池追加例外规则

用户选择 `2` 或明确要求“加入执行池”时，仅表示将最近一次任务追加到  
`${CURRENT_PROJECT_ROOT}/OPTION/执行池.md`，不构成正式执行。

追加时必须遵守：
1. 不创建、修改、完成或归档执行文档。
2. 不查询经验库。
3. 不进行正式记账。
4. 不运行任何测试或验证。
5. 仅需确认执行池文本已成功追加。
6. 仅当用户明确要求执行执行池任务时，才进入执行文档、经验查询、测试验证与 UTF-8 正式记账流程。

## 代码完成后测试规则

1. 只要本轮任务涉及代码新增、删除、修改或重构，代码完成后必须执行与改动风险相匹配的测试或验证。
2. 禁止把“代码已写完”视为任务完成；未测试、未验证或未明确说明阻塞原因，禁止正式收口。
3. 测试应优先覆盖本次改动直接影响的主路径、边界路径和相邻回归路径。
4. 若无法运行测试，必须明确说明无法测试的原因、已完成的替代验证动作和剩余风险。

## JS Java Python 逐行业务注释规则

1. 只要本轮任务涉及 `js`、`java`、`py` 文件的新增、删除、修改或重构，交付前必须按业务语义补充逐行业务注释。
2. 逐行业务注释必须说明该行或紧邻几行代码在当前业务流程中的作用，禁止只写语法级、变量赋值级或显而易见的空洞注释。
3. 常量、状态字段、条件分支、返回结构、关键赋值、异常处理、循环、数据映射、接口调用、持久化、桥接逻辑都必须有对应的业务注释覆盖。
4. 若某几行属于同一个不可拆分的业务动作，可使用紧邻的多行注释整体说明，但不得跳过实际业务含义。
5. 未完成 `js`、`java`、`py` 的逐行业务注释前，禁止把相关代码任务视为完成；若文件过大需分阶段补注释，必须明确当前已覆盖范围和剩余范围。
6. Java 公开和受保护方法的参数注释必须说明参数来源、业务含义与实际输入示例；所有非 `void` 返回必须提供符合真实类型、字段名称和返回层级的实际结果示例。
7. 返回 `Map`、`List`、数组、实体、元数据、动态字段、主键定义、SQL 字符串、`CommonResult` 或 `CommonPageResult` 时，禁止只写类型名称或使用 `xxx`、`foo`、省略号代替关键字段，必须展示可识别的完整结构。
8. `void` 写入方法必须说明数据库、文件、消息或外部状态的实际副作用示例；异常分支必须说明触发条件和实际异常示例。
9. Java 注释优先采用 `输入或动作 → 实际结果` 形式；具体模板与真实示例必须加载 `SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES`。
10. import 包导入不用加注释。
