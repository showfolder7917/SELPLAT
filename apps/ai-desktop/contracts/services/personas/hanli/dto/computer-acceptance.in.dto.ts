/** 只携带验收目标；不携带预生成的操作清单。 */
export interface HanliComputerAcceptanceInDto {
  topicId: string;
  proposalId: string;
  title: string;
  criteria: string[];
}
