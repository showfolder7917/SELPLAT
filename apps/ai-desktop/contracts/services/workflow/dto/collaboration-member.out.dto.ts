import type { DesktopOperatingModeValue, CollaborationMemberKindValue, CollaborationMemberRoleValue, CollaborationMemberStateValue, CollaborationWorkerPhaseValue } from "../value/collaboration-member.value.js";
/**
 * Workflow 协作成员与任务来源快照输出协议。
 * 生产者：Workflow 协作存储；消费者：Renderer、人物模块和集成服务。
 * 数据方向：Workflow -> 协作消费者。
 * 本文件不创建成员、不启动 Agent，也不保存运行实现。
 */
import type { LocaleValue } from "../../../foundation/index.js";
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";


export interface CollaborationMemberOutDto {
  memberId: string;
  displayName: string;
  kind: CollaborationMemberKindValue;
  protected: boolean;
  enabled: boolean;
  state: CollaborationMemberStateValue;
  role: CollaborationMemberRoleValue;
  phase: CollaborationWorkerPhaseValue;
  generation: number;
  currentTaskId: string | null;
  blockingReason: string | null;
  lastHeartbeatAt: string | null;
  lastProtocolProgressAt: string | null;
  lastAssignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationParticipantSnapshotOutDto {
  memberId: string;
  displayName: string;
}

export interface CollaborationTaskRuleContextOutDto {
  activeUserId: string;
  role: "hanli" | "nangong" | "executor" | "linghu";
  ruleRevision: string;
  mandatoryRoleRuleIds: string[];
  matchedTaskRuleIds: string[];
  dependencyRuleIds: string[];
  loadedRuleHashes: Record<string, string>;
  loadedRuleContents: Record<string, string>;
  agentsContent: string;
  indexCatalog: string;
  ruleReceipt: string[];
}

export interface CollaborationTaskSnapshotOutDto {
  title: string;
  problemStatement: string;
  confirmedIntent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  sourceMessageIds: number[];
  attachmentIds: string[];
  workspaceState: WorkspaceStateOutDto;
  locale: LocaleValue;
  contentHash: string;
  ruleContext: CollaborationTaskRuleContextOutDto | null;
}
