import type { CollaborationMemberOutDto, CollaborationRepairDiagnosisOutDto, CollaborationRequirementPlanOutDto, CollaborationTaskOutDto } from "../../../workflow/index.js";
import type { CodexStreamEventOutDto } from "../../../support/platform/codex/index.js";
import type { ExecutorExecutionResultOutDto } from "../dto/executor-execution-result.out.dto.js";

/** 单个执行人的任务会话能力；基础设施实现不得泄漏到 Workflow。 */
export interface ExecutorSessionPort {
  isAlive(): boolean;
  analyze(task: CollaborationTaskOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<string>;
  optimize(task: CollaborationTaskOutDto, feedback: string, emit: (event: CodexStreamEventOutDto) => void): Promise<string>;
  execute(task: CollaborationTaskOutDto, plan: CollaborationRequirementPlanOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<ExecutorExecutionResultOutDto>;
  investigateRepair(task: CollaborationTaskOutDto, failure: string, emit: (event: CodexStreamEventOutDto) => void): Promise<string>;
  executeRepair(task: CollaborationTaskOutDto, diagnosis: CollaborationRepairDiagnosisOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<ExecutorExecutionResultOutDto>;
  dispose(): Promise<void> | void;
}

/** 创建执行人会话的基础设施端口。 */
export interface ExecutorSessionFactoryPort {
  createExecutor(task: CollaborationTaskOutDto, member: CollaborationMemberOutDto): Promise<ExecutorSessionPort>;
}
