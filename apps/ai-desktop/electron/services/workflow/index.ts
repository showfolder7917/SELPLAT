// Workflow 门面是跨人物节点推进、暂停、恢复和人工接管的唯一公开入口。
export { CollaborationCoordinator as CollaborationWorkflowFacade } from "./collaboration-workflow.facade.js";
// 会话能力只依赖这些稳定 Workflow Port，不需要看到协调器的内部 Store。
import type { DatabasePort } from "../platform/persistence/index.js";
import { CollaborationDurationLog } from "./internal/collaboration-duration.log.js";
import { CollaborationStore } from "./internal/collaboration.store.js";
import { EvolutionFlowOrchestrator } from "./internal/evolution-flow.orchestrator.js";
import { createCollaborationResultSummary } from "./internal/result/result-summary.js";
import { WorkflowRepository } from "./internal/workflow.repository.js";
import { WorkflowSupervisor } from "./internal/workflow.supervisor.js";
import { PersonaCapabilityRegistry } from "./internal/persona-capability.registry.js";

// 以下 Port 只用于组合根和 IPC 的类型约束，不公开 internal 构造器或文件路径。
export type CollaborationStatePort = CollaborationStore;
export type CollaborationDurationPort = CollaborationDurationLog;
export type WorkflowRepositoryPort = WorkflowRepository;
export type WorkflowSupervisorPort = WorkflowSupervisor;
// 演化流程端口只判断下一步，不持有提案业务数据。
export type EvolutionFlowPort = EvolutionFlowOrchestrator;
// 分发端口把已审批计划转换为协作任务。

// JSON 状态只由 Workflow 自己创建并维护，人物不能直接修改状态文件。
export function createCollaborationState(...arguments_: ConstructorParameters<typeof CollaborationStore>): CollaborationStatePort {
  return new CollaborationStore(...arguments_);
}

// 耗时事实进入协作归档，为等待、执行、测试和集成瓶颈提供统一证据。
export function createCollaborationDurationLog(...arguments_: ConstructorParameters<typeof CollaborationDurationLog>): CollaborationDurationPort {
  return new CollaborationDurationLog(...arguments_);
}

// SQLite Repository 是 Workflow 事实的唯一持久化入口，IPC 只能调用受控查询方法。
export function createWorkflowRepository(database: DatabasePort): WorkflowRepositoryPort {
  return new WorkflowRepository(database);
}

// Supervisor 观察异常退出和心跳停滞，只通过正式恢复入口通知令狐。
export function createWorkflowSupervisor(...arguments_: ConstructorParameters<typeof WorkflowSupervisor>): WorkflowSupervisorPort {
  return new WorkflowSupervisor(...arguments_);
}

// 南宫通过公开工厂取得流程判断器，不直接依赖 Workflow 的 internal 目录。
export function createEvolutionFlow(): EvolutionFlowPort {
  return new EvolutionFlowOrchestrator();
}

// 南宫通过公开工厂取得任务分发器，Workflow 保持跨人物编排的所有权。
// 发布流水线复用同一结果摘要规则，页面与归档因此看到相同结论。
export { createCollaborationResultSummary };

// 跨人物演化运行时只在 Workflow 组合根创建；人物模块通过各自最小 Port 使用它。
export {
  PersonaEvolutionRuntime,
  type PersonaEvolutionRuntimeOptions,
} from "./internal/persona-evolution.runtime.js";

// 人物流程门面只负责轮转、分发和恢复，人物判断仍由各人物 Facade 完成。
export {
  PersonaWorkflowFacade,
  createPersonaWorkflowRuntime,
  type PersonaWorkflowApplicationPort,
  type PersonaWorkflowRuntime,
} from "./persona-workflow.facade.js";

// 组合根通过工厂登记人物；Registry 具体类不作为公共 API 输出。
export type { PersonaCapability, PersonaRegistration } from "./internal/persona-capability.registry.js";
export function createPersonaCapabilityRegistry(): Pick<PersonaCapabilityRegistry, "register" | "find" | "requireCapability" | "startAll" | "stopAll"> {
  return new PersonaCapabilityRegistry();
}
