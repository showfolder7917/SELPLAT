import type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptanceRunOutDto,
} from "../../../../../contracts/services/personas/hanli/index.js";
import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../../contracts/services/personas/conversation/index.js";
import type { EvolutionMutationInDto, EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../contracts/services/evolution/index.js";
import { createEvolutionMutationCoordinator, type EvolutionMutationPort } from "../../../evolution/index.js";
import type { HanliApplicationPort } from "../hanli.facade.js";
import { EvolutionApprovalService } from "./evolution-approval.service.js";
import type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";
import { HanliDecisionService } from "./hanli-decision.service.js";
import { HanliConversationService } from "./hanli-conversation.service.js";

export type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";

/** 韩立人物应用服务：统一拥有自由讨论、方向审批和真实应用验收判断。 */
export class HanliApplicationService implements HanliApplicationPort {
  readonly #store: HanliApplicationServiceOptions["store"];
  readonly #memory: NonNullable<HanliApplicationServiceOptions["memory"]> | null;
  readonly #recordEvent: HanliApplicationServiceOptions["recordEvent"];
  readonly #mutations: EvolutionMutationPort;
  readonly #approvals: EvolutionApprovalService;
  readonly #decision: HanliDecisionService;
  readonly #conversation: HanliConversationService;
  readonly #readStableUserId: () => string;
  readonly #readProjectScope: () => string;

  /** 装配韩立自由讨论与审批能力；构造时不执行判断，也不修改 Evolution 状态。 */
  constructor(options: HanliApplicationServiceOptions) {
    this.#store = options.store;
    this.#memory = options.memory || null;
    this.#recordEvent = options.recordEvent;
    this.#readStableUserId = options.readStableUserId || (() => { throw new Error("当前稳定用户尚未解析。"); });
    this.#readProjectScope = options.readProjectScope || (() => "global");
    this.#mutations = createEvolutionMutationCoordinator({ begin: options.beginMutation, complete: options.completeMutation, fail: options.failMutation });
    this.#approvals = new EvolutionApprovalService(this.#store, options.recordTimelineEvent || null);
    this.#conversation = new HanliConversationService(options);
    this.#decision = new HanliDecisionService({
      store: this.#store,
      prompts: options.prompts,
      memory: this.#memory,
      askHanli: options.askHanli || (async () => { throw new Error("韩立研讨会话尚未接入。"); }),
      readStableUserId: this.#readStableUserId,
      readProjectScope: () => this.#readProjectScope(),
    });
  }

  conversation(): PersonaConversationOutDto { return this.#conversation.conversation(); }
  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> { return this.#conversation.send(request); }
  newConversation(): Promise<PersonaConversationOutDto> { return this.#conversation.newConversation(); }

  /** 接收人物提交的提案并登记审批申请；不会提前作出审批结论。 */
  requestProposalReview(proposalId: string): EvolutionStateOutDto { return this.#approvals.recordApplication(proposalId); }


  /** 保存用户给出的人工方向审批，Mutation 门禁保证重复请求不会覆盖历史。 */
  decideProposal(proposalId: string, request: DecideHanliProposalInDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    return this.#mutations.run(proposal.topicId, "人工审批", request.mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => this.#approvals.decide(proposalId, request.decision, request.advice || "", "manual-user", [], request.feedbackTarget || "proposal-content", request.capabilityScope || ""));
  }

  /** 一次性流程请求韩立完成正式判断并保存决定；Workflow 只等待完成状态。 */
  async reviewAndDecideProposal(proposalId: string): Promise<EvolutionStateOutDto> {
    const proposal = requireProposal(this.#store.state(), proposalId);
    const decision = await this.#decision.reviewOneShotProposal(proposal);
    return this.#approvals.decide(proposalId, decision.decision, decision.advice, "automatic-han-li", []);
  }

  /** 根据已保存人工偏好执行受控自动审批；缺少完整事实或历史依据时退回补充。 */
  autoApprove(proposalId: string, request?: EvolutionMutationInDto): EvolutionStateOutDto {
    const state = this.#store.state();
    const proposal = requireProposal(state, proposalId);
    const mutation = request || { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-approve:${proposalId}:${state.updatedAt}` };
    return this.#mutations.run(proposal.topicId, "韩立审批", mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => this.#autoApproveOnce(proposal));
  }

  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto {
    if (run.version !== 2 || !run.stepResults.length || !run.evidenceAttachmentIds.length) throw new Error("缺少真实交互验收证据");
    return this.#store.recordAcceptanceRun(run);
  }

  /** 保存人工最终验收判断；真实运行证据是否充足仍由 Evolution 状态门禁核对。 */
  decideResult(proposalId: string, request: DecideHanliResultInDto): EvolutionStateOutDto { return this.#decideResult(proposalId, request, "manual-user"); }

  /** 一次性流程把真实运行结果交给韩立；韩立保存证据并形成自己的最终判断。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto {
    this.recordAcceptanceRun(run);
    // 工具受阻不是产品验收失败，保留原提案待验收，交统一卡点处理后原位复验。
    if (run.status === "blocked") return this.#store.state();
    const expectedStateVersion = this.#store.state().updatedAt;
    return this.#decideResult(run.proposalId, {
      mutation: { expectedStateVersion, idempotencyKey },
      decision: run.status === "passed" ? "approved" : "supplement-required",
      advice: run.status === "passed" ? "韩立已按真实用户路径完成检查，全部适用项目通过。" : "真实应用检查未通过，已携带复现步骤、实际结果、期望结果和截图证据返还南宫婉修订。",
    }, "automatic-han-li");
  }

  #decideResult(proposalId: string, request: DecideHanliResultInDto, source: "manual-user" | "automatic-han-li"): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    const next = this.#mutations.run(proposal.topicId, "结果验收", request.mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => this.#store.decideResult(proposalId, request.decision, request.advice || "", source));
    const experienceCandidate = [...next.archiveRecords].reverse().find((record) => record.proposalId === proposalId && record.eventType === "proposal.result_decided")?.payload.experienceCandidate;
    if (this.#memory && experienceCandidate && typeof experienceCandidate === "object") {
      this.#memory.recordVerifiedInspectionExperience(this.#readStableUserId(), this.#readProjectScope(), experienceCandidate as import("../../../../../contracts/services/personas/hanli/index.js").HanliAcceptanceExperienceCandidateOutDto);
      this.#recordEvent("acceptance.experience_promoted", { proposalId, experienceCandidate });
    }
    return next;
  }

  #autoApproveOnce(proposal: EvolutionProposalOutDto): EvolutionStateOutDto {
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
    return this.#approvals.decide(proposal.proposalId, latest.decision, `参考同类型人工审批 ${latest.approvalId} 的历史倾向；当前尚未把该记录等同为已确认客户关注点${adviceContext}。`, "automatic-han-li", [latest.approvalId]);
  }
}

function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionProposalOutDto {
  const proposal = state.proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) throw new Error("演化提案不存在。");
  return proposal;
}
