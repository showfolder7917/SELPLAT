# local/core

`local/core` 只保留规则引擎运行所需的稳定基线，目录保持三类：

- `protocol/`：启动协议，共五份，固定顺序为 `STARTER → USER → CODE → COMMAND → GENERATOR_REPAIR_PROTOCOL`；COMMAND 后直接加载资源根的唯一 `RULE_INDEX.md`。
- `rule/`：由根 `RULE_INDEX.md` 登记的正式规则；通用 core 规则直接放在本目录，不再重复建立 `common_rules/`。
- `registry/`：Python core 的 ability、skill、app 注册表。

Python 运行代码位于 `src/main/python/com/sp/selplat/local/code/core/`，统一从 `executor.py` 调用已登记 ability。编码、注释和测试要求分别由根索引中的语言规则和测试规则提供，不在此处复制模板文档。

生产资源不保存测试专用样本、历史人工工作簿、工作簿模板、XLS 专用规则或产品操作说明。`core` 默认冻结；只有用户明确点名目标并以独立 `1` 启动时，才按 `XUNAN` 用户覆盖规则打开本次 AI 托管修改窗口。
