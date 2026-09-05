// 从 Evolution 契约读取提案事实，领域策略不依赖运行时或持久化实现。
import type { EvolutionProposalOutDto } from "../../../../contracts/services/evolution/index.js";

/** 提案流程策略允许返回的稳定下一步动作。 */
export type EvolutionFlowAction =
  // 等待韩立审批当前提案。
  | "await-approval"
  // 根据韩立意见补充调查并形成新版本。
  | "supplement"
  // 把已审批且尚未分发的提案交给南宫婉拆分。
  | "dispatch"
  // 观察已经分发的任务执行与恢复状态。
  | "monitor-execution"
  // 把已经完成集成的结果交给韩立验收。
  | "accept-result"
  // 提案已经验收完成，不再产生新命令。
  | "complete"
  // 当前状态没有可自动执行的动作。
  | "idle";

/**
 * Evolution 提案流程领域策略。
 *
 * 该策略没有自身身份和持久状态，因此不是聚合根；
 * 它只根据提案快照返回下一条命令，不审批、不分发也不写时间线。
 */
export class EvolutionFlowPolicy {
  /** 根据当前提案状态返回唯一下一步动作。 */
  next(proposal: EvolutionProposalOutDto): EvolutionFlowAction {
    // 新提案必须先等待韩立审批。
    if (proposal.status === "pending-approval") {
      // 返回审批等待动作。
      return "await-approval";
    }
    // 退回补充和驳回都必须由原提交人继续调查。
    if (proposal.status === "supplement-required" || proposal.status === "rejected") {
      // 返回补充动作。
      return "supplement";
    }
    // 只有已批准且没有真实任务的提案可以首次分发。
    if (proposal.status === "approved" && proposal.distributedTaskIds.length === 0) {
      // 返回分发动作。
      return "dispatch";
    }
    // 执行、验证和阻塞都需要提案执行聚合继续核对任务事实。
    if (proposal.status === "executing" || proposal.status === "verifying" || proposal.status === "blocked") {
      // 返回执行监控动作。
      return "monitor-execution";
    }
    // 集成完成后的结果必须经过韩立真实验收。
    if (proposal.status === "pending-acceptance") {
      // 返回验收动作。
      return "accept-result";
    }
    // 已完成提案不再触发副作用。
    if (proposal.status === "completed") {
      // 返回完成动作。
      return "complete";
    }
    // 其他兼容状态由上层等待新事实。
    return "idle";
  }
}
