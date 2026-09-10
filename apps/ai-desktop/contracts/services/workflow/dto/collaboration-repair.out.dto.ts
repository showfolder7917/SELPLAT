/**
 * Workflow 执行失败修复输出协议。
 *
 * 生产者：令狐故障调查流程。
 * 消费者：原执行者、任务卡和审计记录。
 * 数据方向：令狐 -> Workflow -> 原执行者与 Renderer。
 * 本文件只记录诊断结论，不直接修改文件或恢复任务。
 */

// CollaborationParticipantSnapshotOutDto 固定诊断发生时的负责人身份。
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";

/** 一次执行失败调查得到的修复依据和处理要求。 */
export interface CollaborationRepairDiagnosisOutDto {
  /** 诊断完成时间。 */
  diagnosedAt: string;
  /** 执行诊断的人物快照。 */
  diagnosedBy: CollaborationParticipantSnapshotOutDto;
  /** 失败发生的业务阶段。 */
  failureStage: string;
  /** 面向人员阅读的失败摘要。 */
  failureSummary: string;
  /** 支持诊断结论的日志、错误或文件事实。 */
  technicalEvidence: string[];
  /** 原执行者接到任务后应实施的修复说明。 */
  repairInstruction: string;
  /** 失败发生时的原执行者；无法从旧记录恢复时为 null。 */
  originalExecutor: CollaborationParticipantSnapshotOutDto | null;
}
