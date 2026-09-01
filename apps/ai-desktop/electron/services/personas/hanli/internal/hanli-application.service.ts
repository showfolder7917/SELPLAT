import type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptancePlanOutDto,
  HanliAcceptanceRunOutDto,
} from "../../../../../contracts/collaboration/hanli/index.js";
import type { EvolutionMutationInDto, EvolutionProposal, EvolutionStateOutDto } from "../../../../../contracts/collaboration/evolution/index.js";
import { createEvolutionMutationCoordinator, type EvolutionMutationPort } from "../../../evolution/index.js";
import type { HanliApplicationPort } from "../hanli.facade.js";
import { EvolutionApprovalService } from "./evolution-approval.service.js";
import type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";
import { HanliDeliberationService } from "./hanli-deliberation.service.js";

export type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";

/** 韩立人物应用服务：统一拥有研讨、方向审批和真实应用验收判断。 */
export class HanliApplicationService implements HanliApplicationPort {
  readonly #store: HanliApplicationServiceOptions["store"];
  readonly #memory: NonNullable<HanliApplicationServiceOptions["memory"]> | null;
  readonly #planAcceptance: NonNullable<HanliApplicationServiceOptions["planAcceptance"]>;
  readonly #recordEvent: HanliApplicationServiceOptions["recordEvent"];
  readonly #mutations: EvolutionMutationPort;
  readonly #approvals: EvolutionApprovalService;
  readonly #deliberation: HanliDeliberationService;

  /** 装配韩立已有的研讨与审批能力；构造时不执行判断，也不修改 Evolution 状态。 */
  constructor(options: HanliApplicationServiceOptions) {
    this.#store = options.store;
    this.#memory = options.memory || null;
    this.#planAcceptance = options.planAcceptance || (async () => { throw new Error("韩立界面验收计划能力尚未接入。"); });
    this.#recordEvent = options.recordEvent;
    this.#mutations = createEvolutionMutationCoordinator({ begin: options.beginMutation, complete: options.completeMutation, fail: options.failMutation });
    this.#approvals = new EvolutionApprovalService(this.#store, options.recordTimelineEvent || null);
    this.#deliberation = new HanliDeliberationService({
      store: this.#store,
      memory: this.#memory,
      askHanli: options.askHanli || (async () => { throw new Error("韩立研讨会话尚未接入。"); }),
      askNangong: options.askNangong || (async () => { throw new Error("南宫婉研讨会话尚未接入。"); }),
      recordEvent: this.#recordEvent,
    });
  }

  /** 接收人物提交的提案并登记审批申请；不会提前作出审批结论。 */
  requestProposalReview(proposalId: string): EvolutionStateOutDto { return this.#approvals.recordApplication(proposalId); }

  /** 推进一轮韩立研讨；问题、证据判断和专题确立均留在韩立内部。 */
  advanceHanLiDeliberation(): Promise<EvolutionStateOutDto> { return this.#deliberation.advance(); }

  /** 保存用户给出的人工方向审批，Mutation 门禁保证重复请求不会覆盖历史。 */
  decideProposal(proposalId: string, request: DecideHanliProposalInDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "人工审批", request.mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => this.#approvals.decide(proposalId, request.decision, request.advice || "", "manual-user", [], request.feedbackTarget || "proposal-content", request.capabilityScope || ""));
  }

  /** 一次性流程请求韩立完成正式判断并保存决定；Workflow 只等待完成状态。 */
  async reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto> {
    const proposal = requireProposal(this.#store.state(), proposalId);
    const decision = await this.#deliberation.reviewOneShotProposal(proposal);
    return this.#approvals.decide(proposalId, decision.decision, decision.advice, "automatic-han-li", []);
  }

  /** 根据已保存人工偏好执行受控自动审批；缺少完整事实或历史依据时退回补充。 */
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto {
    const state = this.#store.state();
    const proposal = requireProposal(state, proposalId);
    const mutation = request || { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-approve:${proposalId}:${state.updatedAt}` };
    return this.#mutations.run(proposal.topicId, "韩立审批", mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => this.#autoApproveOnce(proposal));
  }

  /** 根据当前专题与历史发现生成可执行验收计划，但不伪造真实运行结果。 */
  async generateAcceptancePlan(proposalId: string): Promise<HanliAcceptancePlanOutDto> {
    const state = this.#store.state();
    const proposal = requireProposal(state, proposalId);
    if (proposal.status !== "pending-acceptance") throw new Error("只有等待结果验收的提案才能生成韩立界面验收计划。");
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!topic) throw new Error("验收计划对应的专题不存在。");
    const priorFindings = state.archiveRecords.filter((item) => item.eventType === "acceptance.experience_promoted").slice(-10).map((item) => item.payload);
    const plan = await this.#deliberation.createAcceptancePlan(topic, proposal, priorFindings, this.#planAcceptance);
    this.#store.recordAcceptancePlan(plan);
    this.#recordEvent("hanli.acceptance.plan_generated", { topicId: topic.topicId, proposalId, planId: plan.planId, checkCount: plan.checks.length });
    return plan;
  }

  /** 读取已保存的验收计划；返回副本以阻止调用方修改归档事实。 */
  acceptancePlan(planId: string): HanliAcceptancePlanOutDto {
    for (const record of [...this.#store.state().archiveRecords].reverse()) {
      const value = record.eventType === "acceptance.plan_generated" ? record.payload.acceptancePlan : null;
      if (value && typeof value === "object" && (value as HanliAcceptancePlanOutDto).planId === planId) return structuredClone(value as HanliAcceptancePlanOutDto);
    }
    throw new Error("韩立验收计划不存在或已清理。");
  }

  /** 保存真实应用运行证据；计划、专题和提案任一关联不一致都会阻断。 */
  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto {
    const plan = this.acceptancePlan(run.planId);
    if (plan.topicId !== run.topicId || plan.proposalId !== run.proposalId) throw new Error("真实验收记录与计划关联不一致。");
    return this.#store.recordAcceptanceRun(run);
  }

  /** 保存人工最终验收判断；真实运行证据是否充足仍由 Evolution 状态门禁核对。 */
  decideResult(proposalId: string, request: DecideHanliResultInDto): EvolutionStateOutDto { return this.#decideResult(proposalId, request, "manual-user"); }

  /** 一次性流程把真实运行结果交给韩立；韩立保存证据并形成自己的最终判断。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto {
    this.recordAcceptanceRun(run);
    const expectedStateVersion = this.#store.state().updatedAt;
    return this.#decideResult(run.proposalId, {
      mutation: { expectedStateVersion, idempotencyKey },
      decision: run.status === "passed" ? "approved" : "supplement-required",
      advice: run.status === "passed" ? "韩立已按真实用户路径完成检查，全部适用项目通过。" : "真实应用检查未通过，已携带复现步骤、实际结果、期望结果和截图证据返还南宫婉修订。",
    }, "automatic-han-li");
  }

  #decideResult(proposalId: string, request: DecideHanliResultInDto, source: "manual-user" | "automatic-han-li"): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "结果验收", request.mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => this.#store.decideResult(proposalId, request.decision, request.advice || "", source));
  }

  #autoApproveOnce(proposal: EvolutionProposal): EvolutionStateOutDto {
    const state = this.#store.state();
    const manualHistory = state.proposals.flatMap((item) => item.approvals.map((approval) => ({ item, approval })))
      .filter(({ item, approval }) => item.type === proposal.type && item.origin === proposal.origin && approval.source === "manual-user");
    if (!proposal.content || !proposal.evidence.length || !proposal.impactScope.length || !proposal.risks.length || !proposal.rollbackPlan || !proposal.acceptanceCriteria.length) {
      return this.#approvals.decide(proposal.proposalId, "supplement-required", `事实、范围、风险、回退或验收条件不完整，请${proposal.submitterDisplayName}补充调查。`, "automatic-han-li", []);
    }
    const databaseHistory = this.#memory?.approvalEvidence(proposal.type, proposal.origin) || [];
    if (!manualHistory.length && !databaseHistory.length) return this.#approvals.decide(proposal.proposalId, "supplement-required", "没有同类型人工审批记录，不能以低置信度猜测通过。", "automatic-han-li", []);
    const latestState = manualHistory.at(-1);
    const latestDatabase = databaseHistory[0];
    const latest = latestState && (!latestDatabase || Date.parse(latestState.approval.createdAt) >= Date.parse(latestDatabase.approvedAt))
      ? { approvalId: latestState.approval.approvalId, decision: latestState.approval.decision, advice: latestState.approval.advice }
      : latestDatabase!;
    const adviceContext = latest.advice.trim() ? `；历史建议：${latest.advice.trim().slice(0, 300)}` : "";
    return this.#approvals.decide(proposal.proposalId, latest.decision, `参考同类型人工审批 ${latest.approvalId}，按用户历史关注点和审批习惯作出决定${adviceContext}。`, "automatic-han-li", [latest.approvalId]);
  }
}

function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionProposal {
  const proposal = state.proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) throw new Error("演化提案不存在。");
  return proposal;
}
