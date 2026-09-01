import type { EvolutionMutationInDto, EvolutionStateOutDto } from "../../../contracts/collaboration/evolution/index.js";
import type { HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto } from "../../../contracts/collaboration/hanli/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../contracts/collaboration/workflow/index.js";

/** Workflow 端口只包含跨人物轮转、分发、恢复和生命周期动作。 */
export interface PersonaWorkflowApplicationPort {
  start(): void;
  stop(): void;
  notifyWorkflowChanged(): void;
  setOneShotAcceptanceRunner(runner: (plan: HanliAcceptancePlanOutDto) => Promise<HanliAcceptanceRunOutDto>): void;
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean): EvolutionStateOutDto;
  configureAutomation(request: ConfigurePersonaWorkflowInDto): EvolutionStateOutDto;
  controlAutomation(action: PersonaWorkflowActionInDto): EvolutionStateOutDto;
  resumeOneShotRun(): Promise<EvolutionStateOutDto>;
  dispatch(proposalId: string, request?: EvolutionMutationInDto): Promise<EvolutionStateOutDto>;
}

/** Workflow 唯一跨人物演化门面；它负责编排，不公开任何人物内部 Service。 */
export class PersonaWorkflowFacade {
  readonly #application: PersonaWorkflowApplicationPort;
  /** 传入已组装的人物能力端口；构造时不启动轮询。 */
  constructor(application: PersonaWorkflowApplicationPort) { this.#application = application; }
  /** 启动跨人物流程检查；重复调用由内部运行时保持幂等。 */
  start() { this.#application.start(); }
  /** 停止流程检查但保留 Evolution 已持久化的恢复点。 */
  stop() { this.#application.stop(); }
  /** 协作任务变化后立即检查下一节点，避免等待固定轮询时间。 */
  notifyWorkflowChanged() { this.#application.notifyWorkflowChanged(); }
  /** 登记真实应用验收执行端口；Workflow 只决定调用时机。 */
  setAcceptanceRunner(runner: (plan: HanliAcceptancePlanOutDto) => Promise<HanliAcceptanceRunOutDto>) { this.#application.setOneShotAcceptanceRunner(runner); }
  /** 独立修改一个自动化开关，不联动其他人物审批开关。 */
  setAutomation(kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean) { return this.#application.setAutomation(kind, enabled); }
  /** 保存自动化参数；此动作不会自行推进当前流程。 */
  configureAutomation(request: ConfigurePersonaWorkflowInDto) { return this.#application.configureAutomation(request); }
  /** 执行启动、暂停、恢复或停止控制并保存恢复点。 */
  controlAutomation(action: PersonaWorkflowActionInDto) { return this.#application.controlAutomation(action); }
  /** 从已保存卡点恢复同一轮，不创建第二条流程。 */
  resumeOneShotRun() { return this.#application.resumeOneShotRun(); }
  /** 审批通过后分发协作任务；Workflow 不修改人物判断。 */
  dispatch(proposalId: string, request?: EvolutionMutationInDto) { return this.#application.dispatch(proposalId, request); }
}

/** Workflow Runtime 暴露稳定身份和唯一门面，供人物能力注册表登记。 */
export interface PersonaWorkflowRuntime { readonly facade: PersonaWorkflowFacade; start(): void; stop(): void; }
/** 创建 Workflow Runtime；生命周期委托给同一个跨人物运行实例。 */
export function createPersonaWorkflowRuntime(application: PersonaWorkflowApplicationPort): PersonaWorkflowRuntime {
  const facade = new PersonaWorkflowFacade(application);
  return { facade, start: () => facade.start(), stop: () => facade.stop() };
}
