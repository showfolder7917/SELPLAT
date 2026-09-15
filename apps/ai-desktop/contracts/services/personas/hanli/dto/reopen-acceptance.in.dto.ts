/** 已完成专题重新验收输入；只建立同专题的新轮次并保留原完成记录。 */
export interface ReopenHanliAcceptanceInDto {
  topicId: string;
  proposalId: string;
  reason: string;
  sourceRecordId: string;
}
