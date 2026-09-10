/**
 * Workflow 任务完成结果输出协议。
 *
 * 生产者：Workflow 结果汇总流程。
 * 消费者：Renderer、发布流程和审计记录。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件只汇总结果，不决定任务是否可以集成。
 */

// CollaborationResultOutcomeValue 表示结果汇总后的标准业务结论。
import type { CollaborationResultOutcomeValue } from "../value/collaboration-task.value.js";

/** 面向用户展示的一次任务最终结果摘要。 */
export interface CollaborationResultSummaryOutDto {
  /** 任务结果的标准化结论。 */
  outcome: CollaborationResultOutcomeValue;
  /** 执行者返回的最终说明。 */
  finalResult: string;
  /** 任务开始时需要解决的原始问题。 */
  originalProblem: string;
  /** 本次执行实际解决的问题。 */
  solvedProblem: string;
  /** 对代码、配置或文档所做变更的摘要。 */
  changes: string;
  /** 尚未完成、需要后续处理的内容。 */
  remaining: string;
  /** 是否已经满足当前任务的成功条件。 */
  success: boolean;
  /** 该结果摘要生成的时间。 */
  generatedAt: string;
}
