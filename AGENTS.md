# SELPLAT Agent 启动入口

## 唯一绝对路径

- 不可变核心资源根：`MEMORY_ROOT=C:/opt/workspace/SELPLAT/apps/rule-engine/backend/src/main/resources/local/core`
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

- 所有专项规则必须先读取 `${RULE_ENGINE_RULE_INDEX}`；core 由根索引直接登记，common 必须经 `local/common/RULE_INDEX.md` 和当前作用域索引递归命中，未命中规则不得作为执行依据。
- 生产加载顺序为 `local/core → local/common/跨工程通用规则 → local/common/当前作用域 → local/active_user`，冲突优先级为 `active_user > 当前作用域 > 跨工程通用 > core`。
- 用户覆盖必须通过稳定逻辑 ID 显式登记；只能加载已验证的一个当前作用域和一个当前用户，禁止猜测或合并加载多个无关作用域、用户目录。
- `local/core` 完成迁移冻结后禁止新增、删除或修改；`local/common` 只允许人工审查后手工合并；自动修正只能写入当前已验证用户层。
- Java、Python、Node 执行代码分别位于 `src/main/<java|python|node>/com/sp/selplat/local/code/<layer>/`；禁止跨语言源目录混放；规则与协议仅位于 `src/main/resources/local/<layer>/`。

## 失败阻断

- 对会产生新增、删除或修改的任务，必须先按 USER 协议取得独立 `1`；独立 `2` 只追加执行池。
- 用户方案违反已加载规则、当前用户无法验证、索引登记缺失、路径逃逸、core/common 写入越权或代码进入错误语言源目录时，必须停止并报告具体冲突。
- 代码变更必须按索引加载对应编码、业务注释与测试规则，并在交付前完成相匹配的离线验证。
