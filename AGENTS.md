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
- rule-engine 新 Python 能力根：`RULE_ENGINE_PYTHON_ROOT=${SELPLAT_ROOT}/apps/rule-engine/backend/src/main/python/com/sp/selplat/ruleengine`
- rule-engine 公共路径配置：`RULE_ENGINE_PATH_CONFIG=${SELPLAT_ROOT}/apps/rule-engine/backend/src/main/resources/ruleengine/config/路径配置.toml`
- rule-engine 调整后规则根：`RULE_ENGINE_RULE_RESOURCE_ROOT=${SELPLAT_ROOT}/apps/rule-engine/backend/src/main/resources/ruleengine`

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
- 旧分层 Java、Python、Node 执行代码分别位于 `src/main/<java|python|node>/com/sp/selplat/local/code/<layer>/`；本次已迁移的 rule-engine Python 能力位于 `${RULE_ENGINE_PYTHON_ROOT}`。禁止跨语言源目录混放；新调整的 rule-engine 规则可位于 `${RULE_ENGINE_RULE_RESOURCE_ROOT}`，其余规则与协议仍位于 `src/main/resources/local/<layer>/`。

## 失败阻断

- 对会产生新增、删除或修改的任务，必须先按 USER 协议取得独立 `1`；独立 `2` 只追加执行池。
- 独立 `1` 打开的执行窗口持续到当前任务完成验证与交付；窗口内追加的文件、材料、参数和同目标要求属于已授权补充，可以直接继续执行。补充内容改变总体目标、进入新工程或系统、新增未授权 core/common 层级、扩大删除范围或形成独立新任务时，必须重新说明并取得 `1`。
- 用户方案违反已加载规则、当前用户无法验证、索引登记缺失、路径逃逸、未取得明确托管授权的 core/common 写入或代码进入错误语言源目录时，必须停止并报告具体冲突。
- 代码变更必须按索引加载对应编码、业务注释与测试规则，并在交付前完成相匹配的离线验证。
- Java 新增、修改或重构必须从唯一规则索引加载 `SELPLAT_JAVA_BUSINESS_COMMENT_AND_RETURN_EXAMPLE_RULES`，并以“方法作用、真实传参示例、真实返回示例、异常或副作用示例”为统一方法注释顺序。


## 稳定用户 ID 与用户层规则沉淀

### 用户身份来源

- `AGENTS.md` 中的“当前稳定用户 ID”是当前工程识别用户身份的唯一事实来源。
- 执行任务前必须读取当前稳定用户 ID，并设置 `ACTIVE_STABLE_USER_ID=<读取值>`；禁止从目录名称、历史规则、环境来源或既有代码推断当前用户。
- 用户规则资源统一沉淀到 `local/<ACTIVE_STABLE_USER_ID>/`。
- 用户 Java、Python、Node 能力分别沉淀到对应语言源码根下的 `<ACTIVE_STABLE_USER_ID>/`。
- 当前用户实体目录只能由上述变量代入生成；文档、程序、规则逻辑 ID 和测试框架不得枚举具体用户名作为分支条件。
- 禁止扫描 `local/` 下已有目录选择当前用户，也禁止同时加载或合并多个用户层。

### 必须评估规则沉淀的时机

出现以下任一情况时，任务完成前必须进行规则沉淀评估：

- 用户指出当前实现“不符合规范”“以后都要这样”“作为工程规范固定下来”。
- 用户纠正 AI 的目录、命名、分层、继承、数据结构、注释、测试或验证方式。
- 同一类错误、返工或偏差出现两次及以上。
- 当前问题可能在其他应用、模块、组件、表、接口或后续任务中再次发生。
- 本次修正形成了稳定、可检索、可重复执行的判断条件。
- 本次修正涉及公共目录结构、文件命名、职责边界、调用顺序或完成门槛。
- 用户明确要求“沉淀规则”“以后按这个执行”“不要再出现”。
- 已有规则缺失、语义不完整、路径失效、索引缺失或无法阻止当前问题。
- AI 发现仅修正当前文件不能防止同类问题再次发生。

### 必须自动沉淀的情况

满足以下条件时，AI 不得只修改当前成品，必须在同一任务中把规则沉淀到当前用户层：

- 用户修正确认了一项可复用的工程约束。
- 约束不只适用于当前单个文件。
- 规则语义已经明确，不需要额外业务选择。
- 沉淀不会修改未授权的 core 或 common。
- 当前任务已经取得独立 `1`，且规则沉淀属于同一问题的防复发闭环。
- 此类沉淀属于当前任务的正常完成步骤，不应再次等待用户主动提醒。

### 不应自动沉淀的情况

以下内容不得直接建立长期规则：

- 只对当前一条数据、一个临时文件或一次性页面调整有效。
- 用户仍在比较多个方案，尚未确认最终方向。
- 约束依赖尚未确认的业务含义。
- 与现有规则近义，可以通过升级已有规则解决。
- 会改变 core、common 或其他用户层，但没有对应托管授权。
- 只是 AI 的临时实现偏好，没有用户确认或稳定工程证据。
- 无法判断是否值得沉淀时，应在交付中说明候选规则和判断依据，不得静默建立大量规则。

### 沉淀目标选择

- 默认自动沉淀到当前解析得到的 `local/<ACTIVE_STABLE_USER_ID>/`。
- 只适用于一个应用的规则进入 `local/<ACTIVE_STABLE_USER_ID>/<大项目>/应用/<应用名>/rule/`。
- 适用于同一大项目多个应用的规则进入 `local/<ACTIVE_STABLE_USER_ID>/<大项目>/通用/rule/`。
- 与具体大项目无关的规则进入 `local/<ACTIVE_STABLE_USER_ID>/跨工程通用规则/`。
- 未经用户明确授权，不得自动写入 `local/core` 或 `local/common`。
- 用户规则成熟后需要提升为 common 时，必须经过独立审查和明确授权。

### 用户索引解析

- 根规则索引只登记用户索引解析模式：`USER_RULE_INDEX_PATTERN = local/<stable-user-id>/RULE_INDEX.md`。
- 加载器先读取 `AGENTS.md` 的当前稳定用户 ID，再代入用户索引模式。
- 用户索引不存在、用户 ID 不符合安全格式或路径发生逃逸时必须停止执行。
- core、common、用户规则正文、通用程序和测试框架不得将某个具体用户 ID 写成固定运行条件。
- 用户层逻辑 ID 必须描述业务语义，不得使用具体用户 ID 作为逻辑 ID 前缀。
- 规则正文使用 `rule_owner_source = AGENTS.md.current_stable_user_id`，禁止使用 `rule_owner = <具体用户ID>` 固定所有者。

### 沉淀执行闭环

规则沉淀必须完成以下步骤：

- 检查唯一规则索引和现有近义规则。
- 判断应升级现有规则还是新增规则。
- 创建或修改当前用户层规则正文。
- 为每条 DSL 声明补充紧邻的中文业务注释。
- 同步所属叶子索引及全部父级索引。
- 验证从根索引能够按当前稳定用户 ID 命中规则。
- 验证规则不存在失效路径、重复逻辑 ID 或跨用户引用。
- 执行相关规则加载测试和业务回归。
- 在交付结果中说明沉淀了什么、进入哪个用户层，以及以后何时自动加载。
- 任务只有在当前问题修正和对应防复发规则完成后，才能视为完整交付。
###门禁
- 任何生成、新增、修改、移动或删除程序源码的任务，必须从唯一规则索引加载对应专项规则；每次修改完成后，把需要验证的内容、命令和预期结果登记到与执行文档同线程的 `测试文档.<CURRENT_THREAD_ID>.md`，禁止为每个小改动重复自动执行完整测试。
- 用户明确提出“统一测试”后，必须按测试文档逐项执行全部待测内容并回写通过或失败；任一登记门禁未执行、执行失败或违规数不为零时，禁止把对应修改标记为已验证。
- 尚未触发统一测试时允许交付修改结果，但必须明确说明“待统一测试”、测试文档路径和待测项，禁止把未执行测试表述为通过。
