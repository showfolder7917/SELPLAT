import type { CollaborationStateOutDto, CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";

/** 只把同一提案、同一确认目标且晚于旧任务真正集成的令狐结果视为等价接管。 */
export function findIntegratedEquivalentRepair(task: CollaborationTaskOutDto, state: CollaborationStateOutDto): CollaborationTaskOutDto | null {
  if (task.automationSource !== "linghu-safeguard" || !task.evolutionProposalId) return null;
  return state.tasks.find((candidate) => candidate.taskId !== task.taskId
    && candidate.state === "integrated"
    && candidate.automationSource === "linghu-safeguard"
    && candidate.evolutionProposalId === task.evolutionProposalId
    && candidate.createdAt > task.createdAt
    && candidate.snapshot.problemStatement === task.snapshot.problemStatement
    && candidate.snapshot.confirmedIntent === task.snapshot.confirmedIntent) || null;
}
