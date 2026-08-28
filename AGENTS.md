# SELPLAT Agent 启动入口

## 当前身份

- 当前稳定用户 ID：`XUNAN`

## 唯一绝对路径

- 执行路径解析前必须按实际运行环境设置 `CURRENT_OS=windows|macos|linux`；禁止根据路径文本或工程来源推断操作系统。
- Windows 工程根：`SELPLAT_ROOT_WINDOWS=C:/opt/workspace/SELPLAT`
- macOS 工程根：`SELPLAT_ROOT_MACOS=/Users/showfolder/Documents/workSpace/SELF/SELPLAT`
- `CURRENT_OS=windows` 时：`SELPLAT_ROOT=${SELPLAT_ROOT_WINDOWS}`
- `CURRENT_OS=macos` 时：`SELPLAT_ROOT=${SELPLAT_ROOT_MACOS}`
- `CURRENT_OS=linux` 时不固定机器绝对路径；必须从当前工作目录向上识别本文件所属工程根，并设置 `SELPLAT_ROOT=<识别出的工程根>`。
- 不可变核心资源根：`MEMORY_ROOT=${SELPLAT_ROOT}/apps/ai-desktop/ruleengine/rules/local/core`
- 核心协议目录：`CORE_PROTOCOL_ROOT=${MEMORY_ROOT}/protocol`
- rule-engine 资源根：`RULE_ENGINE_RESOURCE_ROOT=${MEMORY_ROOT}/../..`
- 唯一规则索引：`RULE_ENGINE_RULE_INDEX=${RULE_ENGINE_RESOURCE_ROOT}/RULE_INDEX.md`
- Python 核心代码根：`CORE_PYTHON_ROOT=${SELPLAT_ROOT}/apps/ai-desktop/ruleengine/python/local/core`
- rule-engine 新 Python 能力根：`RULE_ENGINE_PYTHON_ROOT=${SELPLAT_ROOT}/apps/ai-desktop/ruleengine/python/ruleengine`
- rule-engine 公共路径配置：`RULE_ENGINE_PATH_CONFIG=${SELPLAT_ROOT}/apps/ai-desktop/ruleengine/rules/config/路径配置.toml`
- rule-engine 规则根：`RULE_ENGINE_RULE_RESOURCE_ROOT=${SELPLAT_ROOT}/apps/ai-desktop/ruleengine/rules`

## 必须阅读链路

新会话执行任何任务前，必须通过 `${CORE_PYTHON_ROOT}/abilities/startup_protocol_loader.py` 加载：

`STARTER → USER → CODE → COMMAND → RULE_INDEX → GENERATOR_REPAIR_PROTOCOL`

若 Python 入口不可用，必须按上述顺序完整读取 `${CORE_PROTOCOL_ROOT}` 中对应文件；任一文件缺失、无法完整读取或顺序不一致时必须停止执行并报告，禁止回退到 `MEMORIES`、旧包或其他能力系统。

- 在 Codex 等受限运行环境调用 Python 前，必须先使用当前环境已验证可访问的解释器；默认 `python3` 若因 Xcode、开发工具或目录权限失败，禁止重复调用同一入口。
- Gradle 门禁必须通过 `-PselplatPython` 或 `SELPLAT_PYTHON` 接收已验证解释器；禁止把某台机器的 Python 绝对路径提交到工程源码。

启动完成后，必须说明已读协议以及本轮实际生效的协议约束。

## 索引加载与分层边界

- 所有专项规则必须从 `${RULE_ENGINE_RULE_INDEX}` 唯一入口开始；禁止在本文件重复写死 common 作用域、用户规则路径、用户能力路径或具体执行程序。
- 当前 common 作用域必须根据用户明确指出的工程、当前工程根或被操作文件所属工程识别，并且每轮只能命中一个；证据不足或出现多个候选时必须停止并报告，禁止猜测或合并加载。
- 当前用户只提供稳定用户 ID；用户规则入口必须通过根索引中的 `USER_RULE_INDEX_PATTERN` 解析，禁止为具体用户建立固定根索引键，也禁止扫描目录猜测入口。
- 专项规则必须根据当前任务从索引选择实际需要的逻辑 ID；core 由根索引直接登记，common 经汇总索引和已识别作用域递归命中，当前用户经根索引登记入口递归命中；未命中规则不得作为执行依据。
- 当前 `local/common` 为空预留提升入口；生产加载顺序为 `local/core → local/common_reserved_empty → local/active_user`，冲突优先级为 `active_user > core`。未来 common 恢复实体前必须经过独立审查与明确授权。
- 用户覆盖必须通过稳定逻辑 ID 显式登记；只能加载已验证的一个当前作用域和一个当前用户，禁止猜测或合并加载多个无关作用域、用户目录。
- `local/core` 与 `local/common` 默认保持冻结；没有用户明确点名修改目标时，自动修正只能写入当前已验证用户层。
- 当用户明确提出 `local/core` 或 `local/common` 的具体修改需求，并以独立 `1` 启动后，视为把该次指定范围托管给 AI；AI 可以直接完成分析、修改、引用同步和验证，但不得扩大目标范围。
- 用户明确托管的修改必须在执行前核对索引、调用方、注册表和测试；删除或合并必须记录保留方与替代关系，执行后必须完成相关回归。
- rule-engine 只承载 Python 执行代码与规则资源：通用执行器位于 `${RULE_ENGINE_PYTHON_ROOT}`，分层 Python 能力位于 `apps/ai-desktop/ruleengine/python/local/<layer>/`，规则与协议位于 `${RULE_ENGINE_RULE_RESOURCE_ROOT}/local/<layer>/`，测试位于 `apps/ai-desktop/ruleengine/tests/local/<layer>/`。禁止恢复 `backend/src/main|test` 或 `com/sp/selplat` 式目录。

## 失败阻断

- 对会产生新增、删除或修改的任务，必须先按 USER 协议取得独立 `1`，或由独立 `3` 成功记录最新一轮完整问答后仅执行该轮明确任务；独立 `2` 只追加执行池。
- 独立 `3` 必须先把紧邻命令前的最新一轮可见问题和回答写入当前稳定用户的 `会话/会话_<CURRENT_THREAD_ID>.md`，再由当前 Luna Max 主线程打开仅限该轮明确目标的执行窗口；禁止派生 Agent 子线程、委派给子 Agent、回填整个会话、重复记录同一轮或扩大 core/common、删除及跨工程范围。
- 独立 `1` 打开的执行窗口持续到当前任务完成验证与交付；窗口内追加的文件、材料、参数和同目标要求属于已授权补充，可以直接继续执行。补充内容改变总体目标、进入新工程或系统、新增未授权 core/common 层级、扩大删除范围或形成独立新任务时，必须重新说明并取得 `1`。
- 用户方案违反已加载规则、当前用户无法验证、索引登记缺失、路径逃逸、未取得明确托管授权的 core/common 写入或代码进入错误语言源目录时，必须停止并报告具体冲突。
- 代码变更必须按索引加载对应编码、业务注释与测试规则，并在交付前完成相匹配的离线验证。
- Java 新增、修改或重构必须从唯一规则索引加载 `SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES`，并以“方法作用、真实传参示例、真实返回示例、异常或副作用示例”为统一方法注释顺序。


## 稳定用户与规则沉淀完成门禁

- `AGENTS.md` 中的“当前稳定用户 ID”是当前工程识别用户身份的唯一事实来源；执行任务前必须读取该值并设置 `ACTIVE_STABLE_USER_ID=<读取值>`，禁止从目录、历史或代码推断用户。
- 每个任务交付前都必须从唯一规则索引加载 `RULE_LIFECYCLE_GOVERNANCE_RULES` 并完成规则沉淀评估；该要求是完成阶段固定门禁，不依赖关键词或任务类型命中。
- 评估必须明确得到“升级现有规则”“新增规则”或“无需沉淀并附上近义规则与原因”之一；未加载治理规则、未记录评估结论或防复发闭环未完成时，禁止标记任务完成。
- 自动沉淀只能写入由 `ACTIVE_STABLE_USER_ID` 解析的当前用户层；`core/common`、其他用户层及未授权范围继续受冻结和托管边界约束。
- 详细触发条件、目标目录、近义合并、索引同步和验证闭环以 `RULE_LIFECYCLE_GOVERNANCE_RULES` 为唯一权威，禁止在本入口复制规则正文。

## 测试门禁

- 任何生成、新增、修改、移动或删除程序源码的任务，必须从唯一规则索引加载对应专项规则；每次修改完成后，把需要验证的内容、命令和预期结果登记到与执行文档同线程的 `测试文档.<CURRENT_THREAD_ID>.md`，禁止为每个小改动重复自动执行完整测试。
- 用户明确提出“统一测试”后，必须按测试文档逐项执行全部待测内容并回写通过或失败；任一登记门禁未执行、执行失败或违规数不为零时，禁止把对应修改标记为已验证。
- 尚未触发统一测试时允许交付修改结果，但必须明确说明“待统一测试”、测试文档路径和待测项，禁止把未执行测试表述为通过。
