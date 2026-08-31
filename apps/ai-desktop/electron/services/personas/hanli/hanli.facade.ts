import type { BrowserWindow } from "electron";
import type {
  DecideEvolutionProposalRequest,
  DecideEvolutionResultRequest,
  EvolutionMutationRequest,
  HanLiAcceptancePlan,
  HanLiAcceptanceRun,
  EvolutionState,
} from "../../../../contracts/collaboration/evolution/index.js";
import type { AttachmentFacade } from "../../platform/attachments/index.js";
import { HanliRealAppAcceptanceRunner } from "./internal/hanli-real-app-acceptance.runner.js";

/** 韩立人物端口只包含研讨、审批和验收，不包含南宫对话或令狐恢复。 */
export interface HanliApplicationPort {
  advanceHanLiDeliberation(): Promise<EvolutionState>;
  decideProposal(proposalId: string, request: DecideEvolutionProposalRequest): EvolutionState;
  autoApprove(proposalId: string, request?: EvolutionMutationRequest): EvolutionState;
  generateAcceptancePlan(proposalId: string): Promise<HanLiAcceptancePlan>;
  acceptancePlan(planId: string): HanLiAcceptancePlan;
  recordAcceptanceRun(run: HanLiAcceptanceRun): EvolutionState;
  decideResult(proposalId: string, request: DecideEvolutionResultRequest): EvolutionState;
}

/** 韩立 Runtime 的装配参数；共同状态仍由 Evolution 管理。 */
export interface CreateHanliRuntimeOptions { application: HanliApplicationPort; screenshots: AttachmentFacade; }

/** 韩立人物运行对象，提供稳定身份、公开门面和独立生命周期。 */
export interface HanliRuntime {
  readonly memberId: "han-li";
  readonly facade: HanliFacade;
  start(): void;
  stop(): void;
}

/** 韩立唯一公开业务入口；调用方无法通过它修改南宫私有会话。 */
export class HanliFacade {
  readonly #application: HanliApplicationPort;
  readonly #acceptanceRunner: HanliRealAppAcceptanceRunner;
  /** 传入韩立能力端口；构造时不执行审批，也不自动判定结果。 */
  constructor(application: HanliApplicationPort, acceptanceRunner: HanliRealAppAcceptanceRunner) {
    this.#application = application;
    this.#acceptanceRunner = acceptanceRunner;
  }
  /** 推进一轮证据研讨；证据不足时继续提问而不是机械确立专题。 */
  advanceDeliberation() { return this.#application.advanceHanLiDeliberation(); }
  /** 记录人工方向审批；返回 Evolution 保存后的最新共同状态。 */
  decideProposal(proposalId: string, request: DecideEvolutionProposalRequest) { return this.#application.decideProposal(proposalId, request); }
  /** 根据已登记偏好执行受控自动审批；缺少事实时退回补充。 */
  autoApprove(proposalId: string, request?: EvolutionMutationRequest) { return this.#application.autoApprove(proposalId, request); }
  /** 根据当前专题和提案生成真实应用验收计划，但不会伪造执行结果。 */
  generateAcceptancePlan(proposalId: string) { return this.#application.generateAcceptancePlan(proposalId); }
  /** 读取已保存验收计划；不存在时抛出可理解错误。 */
  acceptancePlan(planId: string) { return this.#application.acceptancePlan(planId); }
  /** 保存真实应用验收运行证据；计划与提案不一致时阻断写入。 */
  recordAcceptanceRun(run: HanLiAcceptanceRun) { return this.#application.recordAcceptanceRun(run); }
  /** 在真实 Electron 窗口执行白名单验收操作；危险写按钮会被 Runner 阻断。 */
  executeAcceptancePlan(plan: HanLiAcceptancePlan, targetWindow: BrowserWindow) { return this.#acceptanceRunner.execute(plan, targetWindow); }
  /** 审批最终执行结果；旧提案与既有验收证据不会被覆盖。 */
  decideResult(proposalId: string, request: DecideEvolutionResultRequest) { return this.#application.decideResult(proposalId, request); }
}

/** 创建韩立独立 Runtime；人物开关和 Workflow 自动化开关保持分离。 */
export function createHanliRuntime(options: CreateHanliRuntimeOptions): HanliRuntime {
  // Runner 在韩立 Runtime 内创建，IPC 只看到受控 Facade 方法，不能取得 Runner 对象。
  const facade = new HanliFacade(options.application, new HanliRealAppAcceptanceRunner(options.screenshots));
  return { memberId: "han-li", facade, start: () => undefined, stop: () => undefined };
}
