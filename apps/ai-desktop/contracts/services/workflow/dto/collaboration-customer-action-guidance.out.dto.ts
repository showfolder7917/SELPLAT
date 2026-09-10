/**
 * Workflow 客户介入指导输出协议。
 *
 * 生产者：令狐自动保障流程。
 * 消费者：Renderer 任务卡和恢复入口。
 * 数据方向：令狐 -> Workflow -> Renderer。
 * 本文件只说明客户应做什么，不自动获得文件或命令权限。
 */

// CollaborationParticipantSnapshotOutDto 记录生成指导的人物身份。
import type { CollaborationParticipantSnapshotOutDto } from "./collaboration-member.out.dto.js";

/** 只有客户能够解除卡点时显示的、可以逐步执行的行动指导。 */
export interface CollaborationCustomerActionGuidanceOutDto {
  /** 本条行动指导的唯一标识。 */
  guidanceId: string;
  /** 产生该指导的卡点事实指纹，用于避免重复生成。 */
  sourceFingerprint: string;
  /** 显示在任务卡上的指导标题。 */
  title: string;
  /** 当前需要客户处理的问题。 */
  problem: string;
  /** 为什么程序或人物不能代替客户完成该操作。 */
  reasonCustomerMustAct: string;
  /** Git 证据确认的工作区；只用于定位，不代表写权限。 */
  workspaceRoot?: string | null;
  /** 受问题影响的工作区相对文件路径。 */
  affectedFiles?: string[];
  /** 客户可以按顺序执行的处理步骤。 */
  steps: string[];
  /** 判断客户操作已经完成的检查条件。 */
  completionCriteria: string[];
  /** 客户处理完毕后继续任务按钮显示的文字。 */
  resumeLabel: string;
  /** 生成这份指导的人物快照。 */
  generatedBy: CollaborationParticipantSnapshotOutDto;
  /** 指导生成的时间。 */
  createdAt: string;
}
