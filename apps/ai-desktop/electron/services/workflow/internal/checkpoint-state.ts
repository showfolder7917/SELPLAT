/** 持久化在原异常事实的 payload 中；受理、修复完成和原流程解除是不同阶段。 */
export interface CheckpointState {
  round: number;
  phase: string;
  repairTaskId: string | null;
  runId: string | null;
  proposalId: string | null;
  topicId: string | null;
  taskId: string | null;
  sourceMemberId: string;
  conversations: Record<string, string>;
  sourcePhase?: string;
  recoveryPoint?: string;
  issue?: string;
  blockedImpact?: string;
  repairGoal?: string;
  latestProgress?: string;
  investigation?: string;
  repairResult?: string;
  testResult?: string;
  exhausted?: boolean;
  resumedRound?: number;
}
