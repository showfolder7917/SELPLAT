import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceRunOutDto } from "../../../../contracts/services/personas/hanli/index.js";

/** 完成态复核恢复所需的两段不可变验收证据。 */
export type CompletionReviewCheckpoint = {
  /** 已经触发业务完成的完成前通过记录。 */
  initialPass: HanliAcceptanceRunOutDto;
  /** 业务完成后因能力或环境受阻的只读复核记录。 */
  blockedReview: HanliAcceptanceRunOutDto;
};

/**
 * 只从共同状态中识别可恢复的完成态复核卡点。
 * 通过与阻塞记录必须属于同一运行且顺序相邻，避免把其他历史通过记录误当恢复依据。
 */
export function findCompletionReviewCheckpoint(
  state: EvolutionStateOutDto,
  proposalId: string,
): CompletionReviewCheckpoint | null {
  const proposal = state.proposals.find((item) => item.proposalId === proposalId);
  const topic = proposal ? state.topics.find((item) => item.topicId === proposal.topicId) : null;
  if (proposal?.status !== "completed" || topic?.status !== "completed") return null;

  const runs = state.archiveRecords
    .filter((record) => record.proposalId === proposalId && record.eventType === "acceptance.real_app_checked")
    .map((record) => record.payload.acceptanceRun)
    .filter(isAcceptanceRun);
  const blockedReview = runs.at(-1);
  if (blockedReview?.status !== "blocked") return null;
  // 后续只读复核可以再次受阻；最初相邻的同运行通过/阻塞记录始终是业务已完成的可信来源。
  for (let index = runs.length - 2; index >= 0; index -= 1) {
    const initialPass = runs[index];
    const firstBlockedReview = runs[index + 1];
    if (initialPass.status === "passed"
      && firstBlockedReview.status === "blocked"
      && initialPass.runId === firstBlockedReview.runId) {
      return { initialPass, blockedReview };
    }
  }
  return null;
}

/** 拒绝把不完整的历史载荷提升为正式恢复证据。 */
function isAcceptanceRun(value: unknown): value is HanliAcceptanceRunOutDto {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<HanliAcceptanceRunOutDto>;
  return run.version === 2
    && typeof run.runId === "string"
    && typeof run.topicId === "string"
    && typeof run.proposalId === "string"
    && Array.isArray(run.criteria)
    && Array.isArray(run.stepResults)
    && Array.isArray(run.evidenceAttachmentIds)
    && ["passed", "failed", "blocked"].includes(String(run.status));
}
