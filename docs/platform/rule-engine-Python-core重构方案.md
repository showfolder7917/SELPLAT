# rule-engine Python core 重构方案

## 0. 第一版实施状态（2026-08-18）

第一版已采用“`executor.py + abilities + util`”结构：

- active core 从 26 个 Python 文件、约 1.1 万行收敛为 11 个 Python 文件、2916 行。
- `executor.py` 只读取 `abilities.json`，不再加载 `skills.json` 或 `apps.json`。
- 两个 reader skill 已转为 `util/ai_memory_reader.py` 与 `util/full_file_reader.py`。
- GUI、H2、媒体、页面视觉测试和批量文本替换实现已进入当前用户封存镜像。
- `GUI_VIDEO_TASK_RULES` 已退出根索引并与代码一同封存。
- 记账地址退役后，`ledger_http_submitter.py` 与 `ledger_utf8_submitter.py` 已退出注册并封存。
- `experience_query_bridge.py` 已退出 active 注册并进入当前用户封存镜像。
- `gradle_offline_test_restorer.py` 已迁为当前用户 `fujitsu_gradle_offline_test_restorer.py`，关联规则和模板同步进入 XUNAN Fujitsu 作用域。

封存内容不注册、不索引、不从 active 代码导入。恢复或重构前必须重新核对调用方、依赖、规则归属和测试。

## 1. 方案目标

目标目录：

`apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core`

本方案只规划重构，不直接删除或移动源码。目标是把 `core` 收敛为所有工程启动都必须依赖的最小内核，避免把媒体转换、H2 工作台、Fujitsu 离线恢复、页面测试等可选工具长期冻结在核心层。

预期结果：

- `core` 第一版先收敛到 `executor.py + abilities + util`，后续再按调用证据继续缩减大模块。
- 删除 `core/app` 和 `core/skill` 两套不再必要的运行时分层。
- `executor.py` 只调度核心 ability，不再承担 GUI、媒体和领域工具依赖注入。
- 启动协议、规则分层加载、执行/测试文档生命周期保持稳定逻辑 ID 和外部入口。
- 所有迁移和删除都记录保留方、替代路径、调用方同步及验证结果。

## 2. 当前盘点

### 2.1 规模

| 目录 | Python 文件 | 代码行数 | 主要问题 |
|---|---:|---:|---|
| `abilities` | 17 | 5889 | 核心能力与领域工具混放 |
| `skill` | 6 | 1587 | 只服务读取包装器和媒体 GUI，形成二次调度 |
| `app` | 2 | 3465 | GUI/H2 完整应用进入不可变 core |
| `executor.py` | 1 | 322 | 同时解析 ability、skill、app 三套注册表 |
| 合计 | 26 | 约 11263 | 可选工具约占一半以上 |

### 2.2 真实生产入口

明确存在生产调用链的核心入口：

- `startup_protocol_loader.py`：由工程根 `AGENTS.md` 强制启动。
- `layered_rule_loader.py`：由根规则索引、治理规则和 Python 测试调用。
- `execution_doc_manager.py`、`test_doc_manager.py`：由根 `build.gradle` 调用。
- `memory_file_full_reader.py`：由当前用户 `ai_rule_package_integrator.py` 调用。
- `page_visual_tester.py`：由 core `CODE_TEST_RULES` 固定登记。
- `rule_package_generator.py`：由规则生命周期治理材料登记。

只有注册表引用、未发现生产调用方或专项测试的入口：

- `gui_human_like_delivery.py`
- `h2_query_workbench_delivery.py`
- `mp4_to_transparent_png_sequence_delivery.py`
- `project_text_replace_unifier.py`
- `vob_to_mp4_delivery.py`

存在专项测试或文档，但职责不应属于 core 的入口：

- `gradle_offline_test_restorer.py`：只由 Fujitsu 离线恢复说明和专项测试使用。
- `experience_query_bridge.py`：无 active 生产调用方，已经停用并封存。

## 3. core 的目标边界

### 3.1 允许保留

core 只保留以下职责：

1. Python 能力统一执行入口。
2. 启动协议链加载。
3. core/common/当前作用域/当前用户规则分层加载。
4. 受控文件读取。
5. 执行文档和测试文档线程生命周期。
6. 规则包生成与索引维护。

### 3.2 必须迁出

以下职责不得继续放在 core：

- 特定媒体格式转换。
- PySide6 GUI 应用。
- H2 数据库工作台应用。
- Fujitsu 专属 Gradle 离线依赖恢复。
- 通用文本批量替换工具。
- 可替换的网页视觉测试实现。

### 3.3 第一版目标目录

```text
core/
├─ executor.py
├─ abilities/
   ├─ startup_protocol_loader.py
   ├─ layered_rule_loader.py
   ├─ ai_memory_file_reader.py
   ├─ memory_file_full_reader.py
   ├─ execution_doc_manager.py
   ├─ test_doc_manager.py
   └─ rule_package_generator.py
└─ util/
   ├─ ai_memory_reader.py
   └─ full_file_reader.py
```

`page_visual_tester.py` 已与专项测试封存；active 页面验证规则改为使用当前环境可用的浏览器控制能力。

## 4. 文件分类与替代关系

### 4.1 必须保留并瘦身

| 当前文件 | 结论 | 重构方向 |
|---|---|---|
| `executor.py` | 保留 | 删除 skill/app 注册表调度，只保留 ability 解析、模块加载、结果和退出码协议 |
| `startup_protocol_loader.py` | 保留 | 改为调用统一受控读取模块，删除自行动态加载 reader skill 的兼容链 |
| `layered_rule_loader.py` | 保留 | 拆分索引解析、分层合并和资源缓存；公开 API 与逻辑 ID 不变 |
| `execution_doc_manager.py` | 保留 | 抽取线程路径、锁、UTF-8 写入、revision、归档公共实现 |
| `test_doc_manager.py` | 保留 | 与执行文档共用 `thread_document_store.py`，只保留测试项状态机 |
| `rule_package_generator.py` | 保留 | 继续作为规则正文和叶子索引生成入口，补充与分层加载器的边界测试 |

### 4.2 合并候选

| 当前文件 | 保留方 | 替代关系 |
|---|---|---|
| `ai_memory_file_reader.py` | `controlled_file_reader.py` | 合并为 `mode=clean`，保留原 ability ID 临时别名 |
| `memory_file_full_reader.py` | `controlled_file_reader.py` | 合并为 `mode=full`，同步 `ai_rule_package_integrator` 调用方 |
| `skill/read_ai_memory_file.py` | `controlled_file_reader.py` | 读取和安全路径校验进入单一实现，删除 skill 二次包装 |
| `skill/read_memory_file_full.py` | `controlled_file_reader.py` | 同上 |

兼容原则：别名只保留一个迁移阶段。调用方和测试全部切换后，注册表必须删除旧 ID，禁止永久保留空壳兼容文件。

### 4.3 迁移出 core

| 当前内容 | 目标层 | 建议目标 | 原因 |
|---|---|---|---|
| `gradle_offline_test_restorer.py` | 当前用户/Fujitsu | `local/code/XUNAN/abilities/fujitsu_gradle_offline_test_restorer.py` | 只服务当前用户 Fujitsu 离线恢复，不属于启动内核 |
| `page_visual_tester.py` | XUNAN/封存 | `local/code/XUNAN/archive/python_core_20260818/abilities/` | 已断开生产入口并封存，不再作为启动内核或活动用户能力加载 |
| `h2_query_workbench_delivery.py` | XUNAN/封存 | `local/code/XUNAN/archive/python_core_20260818/abilities/` | 已断开生产入口并封存，后续需要时先重新审查职责和调用地址 |
| `app/h2_query_workbench/` | common/SELPLAT | 与 H2 delivery 同包 | 应用与交付入口保持同一职责归属 |
| `vob_to_mp4_delivery.py` | 当前用户/跨工程 | `local/code/XUNAN/跨工程/媒体转换/` | 当前没有公共生产调用证据，且依赖特定媒体工作流 |
| `mp4_to_transparent_png_sequence_delivery.py` | 当前用户/跨工程 | 同上 | 特定媒体处理能力，不应冻结到 core |
| `app/vob_to_mp4_gui_pyside6.py` | 当前用户/跨工程 | 同上 | 2978 行 GUI 是当前 core 最大单文件 |
| `skill/ffmpeg_*` | 当前用户/跨工程 | 同上 | 只服务媒体 delivery/GUI |
| `skill/launch_gui_app_with_plan.py` | 当前用户/跨工程 | 合并进媒体运行包 | 当前只有媒体相关调用方 |
| `gui_human_like_delivery.py` | 当前用户/跨工程 | 合并进媒体运行包 | 当前只是 GUI 启动包装器，没有独立生产调用方 |

迁移后采用目标层直接入口或目标层已登记能力，禁止让 core 注册表通过 `../common`、`../XUNAN` 路径反向引用高层代码。

### 4.4 删除候选

| 当前文件 | 删除条件 | 替代方式 |
|---|---|---|
| `project_text_replace_unifier.py` | 全仓调用方再次确认为零，且无外部脚本契约 | 使用 `rg` 定位、`apply_patch` 修改和残留扫描，不保留生产批量替换能力 |
| `skills.json` | reader 和媒体 skill 全部完成合并/迁移 | executor 直接加载核心 ability |
| `apps.json` | H2 与媒体 app 全部迁出 | 应用由所属层直接启动 |
| `core/skill/` | skills 注册表清空 | 删除空目录 |
| `core/app/` | apps 注册表清空 | 删除空目录 |

不能仅凭“只有注册表引用”立即删除 GUI、H2 和媒体代码；必须先确认是否存在仓库外人工调用，并由用户选择迁移保留或彻底删除。

## 5. 分阶段实施

### 阶段 0：冻结事实与建立基线

- 导出 abilities/skills/apps 注册快照。
- 建立“逻辑 ID → 文件 → 生产调用方 → 测试 → 规则正文”矩阵。
- 为所有 registry-only 能力记录一次人工保留/删除决定。
- 记录当前 Python core、active-user 和 Gradle 门禁命令到测试文档。

完成条件：每个待处理文件都有保留方和替代路径，没有“先删再找调用方”的项目。

### 阶段 1：迁出领域工具

优先顺序：

1. Fujitsu Gradle 恢复能力。
2. H2 工作台。
3. 媒体转换与 GUI。
4. 页面视觉测试器。

每次只迁移一组，完成路径引用、规则正文、注册表和专项测试同步后再进入下一组。

完成条件：`core/app` 清空；媒体和 H2 不再出现在 core 注册表。

### 阶段 2：删除 skill/app 二次调度

- 统一两个 reader ability 和两个 reader skill。
- executor 移除 `load skills.json`、`load apps.json`、`build_app_configs` 等分支。
- ability 统一签名可暂时保留 `skills/apps` 空参数，下一阶段再清理。
- 删除空的 `skills.json`、`apps.json`、`core/skill`、`core/app`。

完成条件：executor 只加载一套 ability registry；启动协议和分层加载结果不变。

### 阶段 3：合并公共基础设施

- 提取 `runtime/thread_document_store.py`，统一线程 ID、安全文件名、锁、revision、UTF-8 原子写入和历史归档。
- execution/test 两个 manager 只维护各自状态机。

完成条件：文档并发测试、失败重试测试和 HTTP 错误契约全部保持一致。

### 阶段 4：拆分超大核心模块

- `layered_rule_loader.py` 按索引解析、规则合并、资源缓存拆为内部模块，但对外能力 ID 和返回结构不变。
- `startup_protocol_loader.py` 只负责协议顺序和回执，不再包含通用文件读取实现。
- `executor.py` 增加注册路径边界校验，禁止 `..` 逃逸到其他层。

完成条件：根索引、当前用户索引和依赖闭包回执与重构前一致。

### 阶段 5：清理兼容入口

- 全仓扫描旧 ability ID、旧路径和旧 registry key。
- 删除临时别名、空壳 wrapper 和已迁移测试。
- 更新 README、COMMAND/CODE 协议、规则索引和源码归属门禁。
- 输出最终 core 文件数、行数和调用矩阵。

完成条件：旧路径零引用、注册能力全部可执行、无孤立源码和源码缓存。

## 6. 风险与控制

| 风险 | 控制措施 |
|---|---|
| 仓库外脚本直接调用旧路径 | registry-only 能力必须人工确认；提供一次迁移清单，不永久保留兼容壳 |
| core 规则引用迁出的 common 实现形成反向依赖 | core 只声明能力契约，具体实现路径由 common 规则登记 |
| executor 精简后动态能力加载失败 | 先建立单 registry 测试，再删除 skills/apps 代码 |
| 文档管理器合并后并发丢写 | 保留并扩展当前并发 complete/result 测试 |
| 移动 GUI/媒体后依赖路径失效 | 应用、skills、ability 和资源作为一个原子包迁移 |
| 一次改动过大导致回归定位困难 | 每阶段单独授权、单独测试文档、单独迁移回执，禁止跨阶段混改 |

## 7. 建议的首批执行范围

第一批建议只处理低耦合、高收益项：

1. 删除 `project_text_replace_unifier.py`，前提是再次确认仓库外无调用。
2. 把 `gradle_offline_test_restorer.py` 迁入当前用户 Fujitsu，并同步唯一说明文档。（已完成迁移，待统一测试）
3. 把 H2 工作台 ability 与 app 整包迁入 common/SELPLAT。
4. 把媒体 ability、skill、GUI 整包迁入当前用户跨工程媒体目录。
5. 清理对应 core registry 项，但暂不重构 executor。

这一批预计可让 core 减少约 6500 行，同时不触碰启动协议、分层规则加载和线程文档三条高风险主链。

## 8. 暂不建议的操作

- 不建议第一批直接重写 `layered_rule_loader.py`。
- 不再恢复没有有效地址的 ledger HTTP 链。
- 不建议通过 core 注册表相对路径逃逸引用 common 或用户层。
- 不建议保留长期 deprecated wrapper；兼容入口必须有明确删除阶段。
- 不建议因为“没有 Java/Python 仓内调用”就立即删除 GUI、媒体或 H2，人工入口也属于调用契约。

## 9. 后续授权建议

实际实施继续按阶段提交独立任务。记账能力已经退役，后续只评估 executor、文档基础设施和只读经验查询的进一步瘦身。
