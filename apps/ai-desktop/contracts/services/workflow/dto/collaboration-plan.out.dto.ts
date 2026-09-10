/**
 * Workflow 需求分析计划输出协议。
 *
 * 生产者：任务分析执行者。
 * 消费者：Workflow 协调器和具体执行者。
 * 数据方向：执行者 -> Workflow -> 后续执行者。
 * 本文件只描述已确认计划，不执行代码修改。
 */

// CollaborationPlanStatusValue 限定计划当前允许进入的业务阶段。
import type { CollaborationPlanStatusValue } from "../value/collaboration-task.value.js";

/** 一次任务分析产生的、可交给执行者实施的计划版本。 */
export interface CollaborationRequirementPlanOutDto {
  /** 同一任务内从 1 开始递增的计划版本号。 */
  version: number;
  /** 负责产生这个计划的成员标识。 */
  ownerMemberId: string;
  /** 计划负责人在界面上的显示名称。 */
  ownerDisplayName: string;
  /** 计划是否已经达到可执行状态。 */
  status: CollaborationPlanStatusValue;
  /** 可以直接交给执行者理解和实施的计划正文。 */
  text: string;
  /** 计划正文哈希，用于识别执行期间的意外变化。 */
  contentHash: string;
  /** 计划版本创建时间，使用 ISO 日期时间字符串。 */
  createdAt: string;
}
