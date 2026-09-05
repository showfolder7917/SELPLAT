# 韩立人物模块

本目录按业务职责组织韩立能力，阅读入口从 `hanli.facade.ts` 开始。

- `domain/hanli-conversation.aggregate.ts`：会话聚合根。只解释当前会话状态和用户输入对应的业务动作，不调用模型、不写数据库、不调度 Workflow。
- `internal/application/`：应用用例装配。把会话、审批、判断和外部端口组合成韩立公开能力。
- `internal/conversation/`：普通对话、南宫婉只读调查、模型响应解析和上下文构造。
- `internal/decision/`：提案审批申请、审批决定和韩立结构化判断。
- `internal/acceptance/`：真实应用窗口的逐步验收与截图证据。
- `internal/semantic/`：后台语义提取，不阻塞当前人物会话。
- `hanli.facade.ts`：其他模块可以调用的唯一业务门面。
- `index.ts`：韩立 Electron 模块的唯一公开出口。

独立数字 `1` 的流程由会话聚合根判断：有当前观点则启动一次内部研讨；没有观点则返回明确原因；已有活动研讨则返回原流程。流程判断不读取韩立回复中的固定句子。
