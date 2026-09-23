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

/** 校验指导时只能使用已持久化的卡点事实，不能从模型文字推断文件或授权范围。 */
export interface CollaborationCustomerActionGuidanceEvidence {
  affectedFiles: readonly string[];
  nonFileRecovery: {
    capacity: unknown;
    recoveryAction: string | null | undefined;
    detail: string | null | undefined;
    summary: string | null | undefined;
  } | null;
}

/** 判断持久化指导是否能安全签发客户确认入口；文件型和容量授权型卡点各自保留对应事实门槛。 */
export function isCompleteCustomerActionGuidance(
  guidance: CollaborationCustomerActionGuidanceOutDto | null | undefined,
  sourceFingerprint: string | null | undefined,
  evidence: CollaborationCustomerActionGuidanceEvidence = { affectedFiles: [], nonFileRecovery: null },
): guidance is CollaborationCustomerActionGuidanceOutDto {
  if (!guidance || !sourceFingerprint || guidance.sourceFingerprint !== sourceFingerprint) return false;
  const files = guidance.affectedFiles || [];
  const concreteFiles = files.length > 0 && files.every((file) => {
    const value = file.trim();
    return Boolean(value) && value !== "未识别文件" && value !== "任务协作群卡点记录" && /[./\\]/u.test(value);
  });
  const fields = [guidance.problem, guidance.reasonCustomerMustAct, ...guidance.steps, ...guidance.completionCriteria];
  if (fields.length < 4 || !fields.every((value) => isSpecificGuidanceText(value))) return false;
  if (concreteFiles) return files.every((file) => evidence.affectedFiles.includes(file));
  return files.length === 0 && hasStructuredNonFileRecovery(evidence.nonFileRecovery);
}

/** 容量或授权等待没有文件时，仍须有真实容量、恢复动作和可观察的故障说明。 */
function hasStructuredNonFileRecovery(recovery: CollaborationCustomerActionGuidanceEvidence["nonFileRecovery"]): boolean {
  return Boolean(recovery?.capacity
    && recovery.recoveryAction?.trim()
    && (recovery.detail?.trim() || recovery.summary?.trim()));
}

/** 概括占位语不构成客户可执行的原因、步骤或完成标准。 */
function isSpecificGuidanceText(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return !/^(?:需要你确认外部条件已经满足|当前阻塞需要你确认已完成指定操作|核对阻塞说明|完成指定操作|操作已完成|可由令狐复查)[。！？.!?]*$/u.test(text);
}
