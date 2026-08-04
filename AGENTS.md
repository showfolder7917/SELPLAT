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
- 不可变核心资源根：`MEMORY_ROOT=${SELPLAT_ROOT}/apps/rule-engine/backend/src/main/resources/local/core`
- 核心协议目录：`CORE_PROTOCOL_ROOT=${MEMORY_ROOT}/protocol`
- rule-engine 资源根：`RULE_ENGINE_RESOURCE_ROOT=${MEMORY_ROOT}/../..`
- 唯一规则索引：`RULE_ENGINE_RULE_INDEX=${RULE_ENGINE_RESOURCE_ROOT}/RULE_INDEX.md`
- Java 核心代码根：`CORE_JAVA_ROOT=${MEMORY_ROOT}/../../../java/com/sp/selplat/local/code/core`
- Python 核心代码根：`CORE_PYTHON_ROOT=${MEMORY_ROOT}/../../../python/com/sp/selplat/local/code/core`
- Node 核心代码根：`CORE_NODE_ROOT=${MEMORY_ROOT}/../../../node/com/sp/selplat/local/code/core`

## 必须阅读链路

新会话执行任何任务前，必须通过 `${CORE_PYTHON_ROOT}/abilities/startup_protocol_loader.py` 加载：

`STARTER → USER → CODE → COMMAND → RULE_INDEX → GENERATOR_REPAIR_PROTOCOL`

若 Python 入口不可用，必须按上述顺序完整读取 `${CORE_PROTOCOL_ROOT}` 中对应文件；任一文件缺失、无法完整读取或顺序不一致时必须停止执行并报告，禁止回退到 `MEMORIES`、旧包或其他能力系统。

启动完成后，必须说明已读协议以及本轮实际生效的协议约束。

## 索引加载与分层边界

- 所有专项规则必须从 `${RULE_ENGINE_RULE_INDEX}` 唯一入口开始；禁止在本文件重复写死 common 作用域、用户规则路径、用户能力路径或具体执行程序。
- 当前 common 作用域必须根据用户明确指出的工程、当前工程根或被操作文件所属工程识别，并且每轮只能命中一个；证据不足或出现多个候选时必须停止并报告，禁止猜测或合并加载。
- 当前用户只提供稳定用户 ID；用户规则入口必须通过根索引中的 `USER_RULE_INDEX@<稳定用户ID>` 取得，禁止根据目录名称拼接路径。
- 专项规则必须根据当前任务从索引选择实际需要的逻辑 ID；core 由根索引直接登记，common 经汇总索引和已识别作用域递归命中，当前用户经根索引登记入口递归命中；未命中规则不得作为执行依据。
- 生产加载顺序为 `local/core → local/common/跨工程通用规则 → local/common/当前作用域 → local/active_user`，冲突优先级为 `active_user > 当前作用域 > 跨工程通用 > core`。
- 用户覆盖必须通过稳定逻辑 ID 显式登记；只能加载已验证的一个当前作用域和一个当前用户，禁止猜测或合并加载多个无关作用域、用户目录。
- `local/core` 与 `local/common` 默认保持冻结；没有用户明确点名修改目标时，自动修正只能写入当前已验证用户层。
- 当用户明确提出 `local/core` 或 `local/common` 的具体修改需求，并以独立 `1` 启动后，视为把该次指定范围托管给 AI；AI 可以直接完成分析、修改、引用同步和验证，但不得扩大目标范围。
- 用户明确托管的修改必须在执行前核对索引、调用方、注册表和测试；删除或合并必须记录保留方与替代关系，执行后必须完成相关回归。
- Java、Python、Node 执行代码分别位于 `src/main/<java|python|node>/com/sp/selplat/local/code/<layer>/`；禁止跨语言源目录混放；规则与协议仅位于 `src/main/resources/local/<layer>/`。

## 失败阻断

- 对会产生新增、删除或修改的任务，必须先按 USER 协议取得独立 `1`；独立 `2` 只追加执行池。
- 独立 `1` 打开的执行窗口持续到当前任务完成验证与交付；窗口内追加的文件、材料、参数和同目标要求属于已授权补充，可以直接继续执行。补充内容改变总体目标、进入新工程或系统、新增未授权 core/common 层级、扩大删除范围或形成独立新任务时，必须重新说明并取得 `1`。
- 用户方案违反已加载规则、当前用户无法验证、索引登记缺失、路径逃逸、未取得明确托管授权的 core/common 写入或代码进入错误语言源目录时，必须停止并报告具体冲突。
- 代码变更必须按索引加载对应编码、业务注释与测试规则，并在交付前完成相匹配的离线验证。
