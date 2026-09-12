import type { AcceptanceScenePlanOutDto } from "./acceptance-scene.out.dto.js";
/** 只携带验收目标；不携带预生成的操作清单。 */
export interface HanliComputerAcceptanceInDto {
  topicId: string;
  proposalId: string;
  title: string;
  criteria: string[];
  /** 令狐准备成功后附带的场景事实，不代表页面验收通过。 */
  preparedScene?: AcceptanceScenePlanOutDto;
}
