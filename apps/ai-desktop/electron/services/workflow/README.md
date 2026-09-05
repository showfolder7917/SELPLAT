# Workflow 模块

本目录负责跨人物业务流程，阅读入口从 `persona-workflow.facade.ts` 和 `collaboration-workflow.facade.ts` 开始。

- `domain/collaboration-task.aggregate.ts`：单个协作任务聚合根，统一解释执行、验证、阻塞、恢复和集成状态。
- `domain/proposal-execution.aggregate.ts`：提案执行聚合根，维护原任务、修复任务、替代关系与韩立验收条件。
- `domain/workflow-checkpoint.aggregate.ts`：卡点聚合根，维护恢复轮次、修复任务、原步骤和耗尽条件。
- `domain/hanli-nangong-deliberation.aggregate.ts`：跨人物研讨聚合根，解释研讨阶段以及用户确认动作。
- `domain/evolution-flow.policy.ts`：无状态领域策略，只根据提案事实选择下一条流程命令。
- `domain/persona-capability.registry.ts`：人物能力注册表，按稳定能力定位唯一负责人。
- `internal/evolution/`：演化长流程运行时与韩立—南宫婉研讨应用服务。
- `internal/collaboration/`：协作状态持久化、运行监督、时长记录和 SQLite 查询仓储。
- `internal/checkpoint/`：卡点外部动作协调与人物交接投影。
- `internal/acceptance/`：韩立验收阶段的跨人物交接。
- `internal/result/`：协作结果摘要转换。
- `persona-workflow.facade.ts`：人物演化流程的唯一公开门面。
- `collaboration-workflow.facade.ts`：协作任务执行、测试和集成的唯一公开门面。
- `index.ts`：Workflow Electron 模块的唯一公开出口。

领域聚合只维护业务状态与决定，不调用模型、不写文件、不操作数据库。Runtime、Coordinator 和 Service 消费聚合决定后执行副作用；Store 与 Repository 只保存已经完成领域判断的事实。不同聚合之间通过稳定标识关联，禁止直接修改另一个聚合的内部状态。
