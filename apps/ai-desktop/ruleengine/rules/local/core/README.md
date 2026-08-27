# local/core

`local/core` 只保留规则引擎运行所需的稳定基线，目录保持三类：

- `protocol/`：启动协议，共五份，固定顺序为 `STARTER → USER → CODE → COMMAND → GENERATOR_REPAIR_PROTOCOL`；COMMAND 后直接加载资源根的唯一 `RULE_INDEX.md`。
- `rule/`：由根 `RULE_INDEX.md` 登记的正式规则；通用 core 规则直接放在本目录，不再重复建立 `common_rules/`。
- `registry/`：Python core 的 ability、skill、app 注册表。

Python 核心代码位于 `python/local/core/`，活跃结构只包含 `abilities/` 和 `util/`。统一执行器位于 `python/ruleengine/执行器.py`，只读取 `abilities.json` 并执行已登记 ability；`util/` 只保存无独立入口的公共实现，禁止登记为 ability，也禁止反向调用 abilities。

非核心代码的 2026-08-18 封存快照位于当前用户代码层 `local/code/<active-user>/archive/python_core_20260818/`，对应规则清单位于当前用户资源层 `local/<active-user>/archive/python_core_20260818/`。封存目录不进入注册表、规则索引或生产调用链。

编码、注释和测试要求分别由根索引中的语言规则和测试规则提供，不在此处复制模板文档。

生产资源不保存测试专用样本、历史人工工作簿、工作簿模板、XLS 专用规则或产品操作说明。`core` 默认冻结；只有当前稳定用户明确点名目标并以独立 `1` 启动时，才按动态解析的当前用户覆盖规则打开本次 AI 托管修改窗口。
