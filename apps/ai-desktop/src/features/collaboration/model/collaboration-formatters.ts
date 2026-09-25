import { fixedUiText, type FixedUiTextKey } from "../../../../contracts/foundation";
import type { CollaborationMemberOutDto, CollaborationStateOutDto, CollaborationTaskOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import type { EvolutionOneShotRunOutDto } from "../../../../contracts/services/evolution/dto/evolution-one-shot-run.out.dto";
import type { PersonaConversationActivityOutDto } from "../../../../contracts/services/personas/conversation/dto/persona-conversation-activity.out.dto";

export type CollaborationStateReadStatus = "syncing" | "ready" | "unavailable";
export type CollaborationMemberDisplayModelInput = {
  member: CollaborationMemberOutDto | null; locale: LocaleValue; status?: CollaborationStateReadStatus;
  oneShotRun?: Pick<EvolutionOneShotRunOutDto, "actor" | "phase" | "status"> | null;
  deliberating?: boolean; awaitingDeliberationConfirmation?: boolean;
  inquiryActivity?: Pick<PersonaConversationActivityOutDto, "phase" | "status"> | null;
  inquiryRole?: "owner" | "delegate" | null;
};
type MemberState = CollaborationMemberOutDto["state"];
type TaskState = CollaborationStateOutDto["tasks"][number]["state"];
const text = (locale: LocaleValue, key: FixedUiTextKey) => fixedUiText(locale, key);
const memberKeys: Record<MemberState, FixedUiTextKey> = { idle:"collaborationMemberIdle", conversation:"collaborationMemberConversation", assigned:"collaborationMemberAssigned", working:"collaborationMemberWorking", retiring:"collaborationMemberRetiring", recovering:"collaborationMemberRecovering", draining:"collaborationMemberDraining", offline:"collaborationMemberOffline" };
const phaseKeys: Record<NonNullable<CollaborationMemberOutDto["phase"]>, FixedUiTextKey> = { analyzing:"collaborationPhaseAnalyzing", planning:"collaborationPhasePlanning", implementing:"collaborationPhaseImplementing", verifying:"collaborationPhaseVerifying", finalizing:"collaborationPhaseFinalizing", ready:"collaborationPhaseReady", blocked:"collaborationPhaseBlocked", failed:"collaborationPhaseFailed" };
const taskKeys: Record<TaskState, FixedUiTextKey> = { "queued-executor":"collaborationTaskQueuedExecutor", "preparing-worktree":"collaborationTaskPreparingWorktree", analyzing:"collaborationTaskAnalyzing", executing:"collaborationTaskExecuting", "repairing-execution":"collaborationTaskRepairingExecution", "returned-to-nangong":"collaborationTaskReturnedNangong", "ready-for-integration":"collaborationTaskReadyIntegration", "queued-integration":"collaborationTaskQueuedIntegration", integrating:"collaborationTaskIntegrating", "unified-testing":"collaborationTaskUnifiedTesting", "awaiting-restart":"collaborationTaskAwaitingRestart", "test-failed":"collaborationTaskTestFailed", integrated:"collaborationTaskIntegrated", blocked:"collaborationTaskBlocked", recovering:"collaborationTaskRecovering", cancelled:"collaborationTaskCancelled" };
const executionKeys: Record<CollaborationTaskOutDto["executionRecords"][number]["status"], FixedUiTextKey> = { assigned:"collaborationExecutionAssigned", analyzing:"collaborationExecutionAnalyzing", executing:"collaborationExecutionExecuting", "code-verified":"collaborationExecutionVerified", transferred:"collaborationExecutionTransferred", blocked:"collaborationExecutionBlocked", cancelled:"collaborationExecutionCancelled" };

function memberPhaseLabel(member: CollaborationMemberOutDto, locale: LocaleValue): string | null {
  return member.state === "working" && member.phase ? text(locale, phaseKeys[member.phase]) : null;
}
function deliberationMemberDisplay(member: CollaborationMemberOutDto, oneShotRun: CollaborationMemberDisplayModelInput["oneShotRun"], locale: LocaleValue, deliberating = false, awaitingConfirmation = false): { presence: MemberState; label: string } | null {
  if (member.currentTaskId) return null;
  if (awaitingConfirmation) return member.memberId === "han-li" ? { presence:"conversation", label:text(locale,"collaborationAwaitingConfirmation") } : null;
  if (member.memberId === "nangong-wan" && deliberating) return { presence:"working", label:text(locale,"collaborationInternalDeliberating") };
  if (!oneShotRun || oneShotRun.status !== "running" || oneShotRun.actor !== member.memberId) return null;
  const keys: Partial<Record<EvolutionOneShotRunOutDto["phase"], FixedUiTextKey>> = { "preparing-topic":"collaborationTopicPreparing", "forming-proposal":"collaborationPhasePlanning", approving:"collaborationPhaseVerifying", revising:"collaborationInquiryVerifying", distributing:"collaborationMemberAssigned" };
  return { presence:"working", label:text(locale, keys[oneShotRun.phase] || "collaborationInternalDeliberating") };
}
function inquiryMemberDisplay(activity: CollaborationMemberDisplayModelInput["inquiryActivity"], role: CollaborationMemberDisplayModelInput["inquiryRole"], locale: LocaleValue): { presence: MemberState; label: string } | null {
  if (!activity || !role || activity.status === "completed") return null;
  if (activity.status === "retryable" || activity.status === "interrupted") return role === "owner" ? { presence:"recovering", label:text(locale,"collaborationInquiryRecovering") } : null;
  if (activity.status === "blocked") return role === "owner" ? { presence:"recovering", label:text(locale,"collaborationInquiryBlocked") } : null;
  if (activity.status !== "running") return null;
  if (role === "delegate") return activity.phase === "investigating" ? { presence:"working", label:text(locale,"collaborationInquiryVerifying") } : null;
  const keys: Partial<Record<PersonaConversationActivityOutDto["phase"], FixedUiTextKey>> = { queued:"collaborationInquiryPreparing", investigating:"collaborationInquiryWaiting", assessing:"collaborationInquiryAssessing", explaining:"collaborationInquiryExplaining" };
  return { presence:"working", label:text(locale, keys[activity.phase] || "collaborationInquiryInvestigating") };
}
export function collaborationMemberDisplayModel(input: CollaborationMemberDisplayModelInput): { presence: MemberState; label: string } {
  const { member, locale, status = "ready", oneShotRun = null } = input;
  if (!member) return { presence:"offline", label:text(locale, status === "unavailable" ? "collaborationStateUnavailable" : "collaborationStateSyncing") };
  const deliberation = deliberationMemberDisplay(member, oneShotRun, locale, input.deliberating, input.awaitingDeliberationConfirmation);
  if (deliberation) return deliberation;
  if (!member.currentTaskId) { const inquiry = inquiryMemberDisplay(input.inquiryActivity, input.inquiryRole, locale); if (inquiry) return inquiry; }
  const presence = member.currentTaskId ? member.state : "idle";
  return { presence, label: member.currentTaskId ? memberPhaseLabel(member, locale) || text(locale, memberKeys[presence]) : text(locale, memberKeys[presence]) };
}
export function collaborationTaskStateLabel(state: TaskState, locale: LocaleValue): string { return text(locale, taskKeys[state]); }
export function collaborationExecutorNames(task: CollaborationTaskOutDto): string[] { return [...new Map(task.executionRecords.map((record) => [record.executor.memberId, record.executor.displayName] as const)).values()]; }
export function collaborationPlanStatusLabel(status: CollaborationTaskOutDto["plans"][number]["status"], locale: LocaleValue): string { return text(locale, "collaborationPlanReady"); }
export function collaborationExecutionStatusLabel(status: CollaborationTaskOutDto["executionRecords"][number]["status"], locale: LocaleValue): string { return text(locale, executionKeys[status]); }
export function formatCollaborationTime(value: string | null, locale: LocaleValue): string {
  if (!value) return text(locale, "collaborationInProgress");
  const parsedTime = new Date(value); if (Number.isNaN(parsedTime.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(parsedTime);
}
export function formatCollaborationDuration(startedAt: string, completedAt: string | null, locale: LocaleValue): string {
  if (!completedAt) return text(locale, "collaborationInProgress");
  const durationMs=Math.max(0,Date.parse(completedAt)-Date.parse(startedAt)); if (!Number.isFinite(durationMs)) return "—";
  const seconds=Math.floor(durationMs/1000), days=Math.floor(seconds/86400), hours=Math.floor(seconds%86400/3600), minutes=Math.floor(seconds%3600/60), remainder=seconds%60;
  const unit = (key: FixedUiTextKey, value: number) => text(locale, key).replace("{value}", String(value));
  return [days ? unit("collaborationDurationDay", days) : "", hours ? unit("collaborationDurationHour", hours) : "", minutes ? unit("collaborationDurationMinute", minutes) : "", unit("collaborationDurationSecond", remainder)].filter(Boolean).join(" ");
}
