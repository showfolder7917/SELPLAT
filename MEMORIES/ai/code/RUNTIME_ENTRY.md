# Code Runtime Index

这个目录是 `ai/code` 运行能力库。

如果你第一次看这里，最容易卡住的点通常不是某一份 Python 文件太难，而是“入口层、索引层、能力层、内部依赖层”混在一起看。这个文档的目标，是先帮你建立一张阅读地图。

## 先记住这一句

- `ai/code` 不是一堆平铺脚本，而是一套“AI 只调 ability，ability 再调 skill/app”的运行框架。

## 目录说明

- `executor.py`：统一执行入口，负责按 ability 名称调度、加载依赖并执行 ability。
- `router.py`：路由与依赖检查入口，判断任务是否命中已登记 ability，以及 skill/app 是否缺失。
- `registry/`：机器可读索引层，说明“这里有哪些能力、技能、应用”。
- `abilities/`：AI 实际调用的综合能力层，负责组织真正的任务流程。
- `skill/`：能力内部依赖的单技能，一般做更小、更专一的动作。
- `app/`：能力内部依赖的交互式应用入口。
- `tests/`：对 executor、能力桥接和关键规则执行逻辑的测试。
- `tools/`：辅助脚本，不属于标准 ability 入口。
- `TEMPLATE.md`：新增 Python 文件时使用的正式模板。

## 建议阅读顺序

不要从 `abilities/` 目录硬读。更顺的顺序是：

1. 先读 `CODE.PROTOCOL.md` 和本文件，理解这里的运行约束。
2. 再读 `executor.py`，看真正的统一入口做了什么。
3. 再读 `registry/abilities.json`，理解系统对外暴露了哪些正式能力。
4. 再读 `registry/skills.json` 和 `registry/apps.json`，理解 ability 依赖了哪些内部部件。
5. 最后只挑一个简单 ability 通读，例如 `ai_memory_file_reader.py` 或 `experience_query_bridge.py`。
6. 已经理解简单能力后，再看 `*_delivery.py` 这类偏业务交付型 ability。

## 执行入口

- AI 先读取 `CODE.PROTOCOL.md`。
- 执行时优先通过 `./MEMORIES/ai/code/executor.py`。
- `executor.py` 会读取 `registry/abilities.json`、`registry/skills.json`、`registry/apps.json`。
- 如果存在匹配的 `ability`，优先调用 `ability`。
- 如果 `ability` 依赖的 `skill` 缺失，必须先询问是否新增。
- 如果 `ability` 依赖的 `app` 缺失，必须先询问是否新增。
- 如果没有匹配 `ability`，必须先询问是否新增 `ability`。
- 不允许绕过技能库直接执行未登记能力。
- AI 不允许直接调用 `skill`。
- AI 不允许直接调用 `app`。

## 用分层来理解代码

可以把这个目录分成 4 层：

1. 入口调度层
- `executor.py`
- `router.py`

2. 索引声明层
- `registry/abilities.json`
- `registry/skills.json`
- `registry/apps.json`

3. 对外能力层
- `abilities/*.py`

4. 内部依赖层
- `skill/*.py`
- `app/*.py`

阅读时如果跳过前两层，直接扎进 `abilities/`，通常会觉得“名字很多、边界很乱、看不出谁在调谁”。

## 当前能力分组

按职责看，当前 `abilities/` 大致可以分成几组：

- 启动与读取：
  `startup_protocol_loader`、`ai_memory_file_reader`、`memory_file_full_reader`
- 执行流程治理：
  `user_confirmation_gatekeeper`、`execution_doc_manager`
- 经验与记账能力：
  `experience_query_bridge`、`ledger_http_submitter`、`ledger_utf8_submitter`
- 通用交付：
  `bugfix_and_verify`、`feature_delivery`、`script_delivery`
- 页面与 GUI：
  `page_visual_tester`、`gui_human_like_delivery`
- 专项工具交付：
  `h2_query_workbench_delivery`、`vob_to_mp4_delivery`、`mp4_to_transparent_png_sequence_delivery`
- 模板/文档型返回能力：
  `detailed_design_xls_delivery`、`table_structure_definition_xls_delivery`

如果你只是想快速理解“这套系统靠什么活起来”，优先看前 3 组。

## skill 和 app 的定位

- `skill/` 更像“可复用的小动作”，例如读文件、写文件、跑 pytest、调用 ffmpeg。
- `app/` 更像“被 ability 启动的交互程序”，例如 H2 查询台、VOB 转码 GUI。
- `ability/` 才是对外承诺的完整工作单元，它会自己决定什么时候调用 skill、什么时候调用 app。

一个简单判断方法：

- 想看“AI 能直接做什么”，看 `abilities.json`。
- 想看“能力内部怎么拆动作”，看 `skills.json`。
- 想看“有没有图形界面或工具程序被拉起”，看 `apps.json`。

## 常见误区

- 误区 1：`abilities/` 里的每个文件都同级重要。
  实际上不是。先分清启动类、治理类、桥接类、交付类，再决定读哪个。
- 误区 2：`skill/` 是给 AI 直接调用的。
  实际上不是，`skill` 只是 `ability` 的内部依赖。
- 误区 3：看懂文件名就等于看懂执行链。
  实际上执行链主要在 `executor.py` 和注册表，不在单个业务文件里。
- 误区 4：目录里 Python 文件多，就说明结构复杂。
  实际上这里更像“小型运行时 + 若干能力插件”，结构核心比文件数量更重要。

## Runtime

- `./MEMORIES/ai/code/router.py`
- `./MEMORIES/ai/code/executor.py`
- `./MEMORIES/ai/code/registry/abilities.json`
- `./MEMORIES/ai/code/registry/skills.json`
- `./MEMORIES/ai/code/registry/apps.json`
- `./MEMORIES/ai/code/abilities/`
- `./MEMORIES/ai/code/skill/`
- `./MEMORIES/ai/code/app/`
- 当前视频转换 GUI 默认优先使用 `vob_to_mp4_gui_pyside6`
- 当前已提供通用 GUI 自动化能力 `gui_human_like_delivery`

## 快速定位表

- 想知道“从哪里开始执行”：看 `executor.py`
- 想知道“任务有没有正式 ability”：看 `registry/abilities.json`
- 想知道“某个 ability 依赖了什么”：先看 `abilities.json`，再看对应 `skill/app` 注册表
- 想知道“为什么会要求 1/2 确认”：看 `user_confirmation_gatekeeper.py`
- 想知道“为什么会触发经验查询或记账”：看 `experience_query_bridge.py`、`ledger_utf8_submitter.py`
- 想知道“页面或 GUI 自动化怎么接”：看 `page_visual_tester.py`、`gui_human_like_delivery.py`、`app/`

## Template

- `./MEMORIES/ai/code/TEMPLATE.md`
