import type {
  EvolutionAcceptanceMaterialActionValue,
  EvolutionAcceptanceMaterialAuthorizationOutDto,
} from "../../../evolution/index.js";

/** 电脑验收只消费验收计划已冻结的材料授权，不能另建授权来源。 */
export type HanliAcceptanceMaterialActionValue = EvolutionAcceptanceMaterialActionValue;
export type HanliAcceptanceMaterialAuthorizationInDto = EvolutionAcceptanceMaterialAuthorizationOutDto;

/**
 * 页面型任务交给韩立真实窗口验收的最小目标。
 *
 * 生产者：演化运行时；消费者：韩立场景规划与验收器。
 * 数据方向：运行时 -> 场景准备 -> 验收器；禁止职责：不能由此 DTO 修改产品、任务或验收状态。
 */
export interface HanliComputerAcceptanceInDto {
  topicId: string;
  proposalId: string;
  title: string;
  criteria: string[];
  /** mixed 验收保留原提案编号，不能因筛选页面条件而重新编号。 */
  criterionIds?: string[];
  /** 仅由已冻结验收计划传入的专题材料授权；省略时保持现有只读导航边界。 */
  materials?: HanliAcceptanceMaterialAuthorizationInDto[];
}
