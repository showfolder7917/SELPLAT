/**
 * 完成前门禁的只读事实。
 *
 * 它只授权切换到完成态预览复核，不能作为完整验收记录传给结果决定。
 */
export interface CompletionReviewGateOutDto {
  runId: string;
  topicId: string;
  proposalId: string;
  evidenceAttachmentIds: string[];
  summary: string;
}
