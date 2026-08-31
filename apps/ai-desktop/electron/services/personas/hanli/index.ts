// 韩立人物模块只公开唯一 Facade、Runtime 工厂和装配类型。
export {
  HanliFacade,
  createHanliRuntime,
  type CreateHanliRuntimeOptions,
  type HanliApplicationPort,
  type HanliRuntime,
} from "./hanli.facade.js";
import { EvolutionApprovalService } from "./internal/evolution-approval.service.js";
import { HanliDeliberationService, type HanliDeliberationDependencies } from "./internal/hanli-deliberation.service.js";

// 审批端口是韩立对南宫开放的唯一协作面，不泄露韩立内部文件路径。
export type EvolutionApprovalPort = EvolutionApprovalService;

// 南宫通过该工厂申请韩立审批，审批记录和时间线副作用仍由韩立模块控制。
export function createEvolutionApprovalService(
  ...arguments_: ConstructorParameters<typeof EvolutionApprovalService>
): EvolutionApprovalPort {
  return new EvolutionApprovalService(...arguments_);
}

// Workflow 只能取得韩立判断端口；具体提示、解析和证据判断继续封装在韩立 internal。
export type HanliDeliberationPort = Pick<HanliDeliberationService, "advance" | "reviewOneShotProposal" | "createAcceptancePlan">;
export function createHanliDeliberationPort(dependencies: HanliDeliberationDependencies): HanliDeliberationPort {
  return new HanliDeliberationService(dependencies);
}
