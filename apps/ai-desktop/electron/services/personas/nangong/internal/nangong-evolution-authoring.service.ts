import type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  ReviseNangongProposalInDto,
  UpdateNangongTopicInDto,
} from "../../../../../contracts/collaboration/nangong/index.js";
import type { EvolutionStateOutDto } from "../../../../../contracts/collaboration/evolution/index.js";
import type { NangongApplicationServiceOptions } from "./nangong-application.ports.js";
import { hasMaterialRevisionEvidence, parseRevisionInvestigation, revisionInvestigationPrompt } from "./nangong-revision.investigator.js";

type NangongEvolutionAuthoringServiceOptions = Pick<NangongApplicationServiceOptions,
  "store" | "mutations" | "investigateRevision" | "recordEvent" | "recordFailure" | "proposalReview" | "memberDirectory" | "oneShotWorkflow">;

/** 处理南宫对共同 Evolution 专题和提案的作者动作，不拥有审批结论或流程轮转。 */
export class NangongEvolutionAuthoringService {
  readonly #store: NangongEvolutionAuthoringServiceOptions["store"];
  readonly #mutations: NangongEvolutionAuthoringServiceOptions["mutations"];
  readonly #investigateRevision: NonNullable<NangongEvolutionAuthoringServiceOptions["investigateRevision"]>;
  readonly #recordEvent: NangongEvolutionAuthoringServiceOptions["recordEvent"];
  readonly #recordFailure: NonNullable<NangongEvolutionAuthoringServiceOptions["recordFailure"]>;
  readonly #proposalReview: NangongEvolutionAuthoringServiceOptions["proposalReview"];
  readonly #memberDirectory: NangongEvolutionAuthoringServiceOptions["memberDirectory"];
  readonly #oneShotWorkflow: NangongEvolutionAuthoringServiceOptions["oneShotWorkflow"];

  /** 装配专题和提案作者端口；构造时不创建或修改 Evolution 事实。 */
  constructor(options: NangongEvolutionAuthoringServiceOptions) {
    this.#store = options.store;
    this.#mutations = options.mutations;
    this.#investigateRevision = options.investigateRevision || (async () => { throw new Error("南宫婉返修调查能力尚未接入。"); });
    this.#recordEvent = options.recordEvent;
    this.#recordFailure = options.recordFailure || (() => undefined);
    this.#proposalReview = options.proposalReview;
    this.#memberDirectory = options.memberDirectory;
    this.#oneShotWorkflow = options.oneShotWorkflow;
  }

  /** 把用户确认的南宫对话冻结为正式专题事实。 */
  convertConversationToTopic(request: ConvertNangongConversationToTopicInDto): EvolutionStateOutDto { return this.#store.convertConversationToTopic(request); }

  /** 创建南宫提案并通过公开协作端口申请韩立审批。 */
  createProposal(topicId: string, request: CreateNangongProposalInDto): EvolutionStateOutDto {
    const next = this.#store.createProposal(topicId, request);
    return this.#proposalReview.requestReview(next.proposals.at(-1)!.proposalId);
  }

  /** 修改专题事实；版本和持久化仍由 Evolution Store 负责。 */
  updateTopic(topicId: string, request: UpdateNangongTopicInDto): EvolutionStateOutDto { return this.#store.updateTopic(topicId, request); }

  /** 根据明确反馈创建不可覆盖的新提案版本，并重新申请审批。 */
  reviseProposal(proposalId: string, request: ReviseNangongProposalInDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    const submitterDisplayName = this.#memberDirectory.resolveEnabledDisplayName(request.submitterMemberId);
    if (!submitterDisplayName) throw new Error("重新提交人不是当前已启用的协同人物。");
    return this.#mutations.run(proposal.topicId, "返修重提", request.mutation, () => this.#store.state().updatedAt, () => this.#store.state(), () => {
      const next = this.#store.revise(proposalId, request, submitterDisplayName);
      return this.#proposalReview.requestReview(next.proposals.at(-1)!.proposalId);
    });
  }

  /** 驳回后先只读核查工作区；没有新的可验证事实时保留原提案。 */
  async investigateAndReviseReturnedProposal(proposalId: string): Promise<EvolutionStateOutDto> {
    const state = this.#store.state();
    const proposal = requireProposal(state, proposalId);
    if (state.proposals.some((item) => item.supersedesProposalId === proposal.proposalId)) return state;
    const feedback = proposal.approvals.at(-1);
    const topic = state.topics.find((item) => item.topicId === proposal.topicId);
    if (!feedback?.advice.trim() || !topic) throw new Error("返修调查缺少课题或明确审批意见。");
    const response = await this.#investigateRevision(revisionInvestigationPrompt(topic, proposal, feedback.advice, feedback.feedbackTarget, feedback.capabilityScope), topic.workspaceState, topic.locale);
    const investigation = parseRevisionInvestigation(response);
    if (!hasMaterialRevisionEvidence(proposal, investigation, feedback.advice)) {
      const reason = `南宫婉只读调查没有产生可核验的新事实，未创建提案 v${proposal.version + 1}；请补充实际组件、状态或复现证据后从当前卡点继续。`;
      if (state.oneShotRun?.status === "running") return this.#oneShotWorkflow.blockFailure("business", "revise_proposal_without_new_evidence", new Error(reason), reason, { feedbackApprovalId: feedback.approvalId });
      this.#recordFailure({ kind: "business", sourceType: "member", sourceId: "nangong-wan", operation: "revise_proposal_without_new_evidence", error: new Error(reason), correlationId: topic.topicId, fingerprint: `nangong-revision:${proposal.proposalId}:no-material-evidence`, details: { topicId: topic.topicId, proposalId, feedbackApprovalId: feedback.approvalId } });
      return this.#store.state();
    }
    const revised = this.reviseProposal(proposal.proposalId, {
      mutation: { expectedStateVersion: state.updatedAt, idempotencyKey: `automatic-revise:${proposal.proposalId}:${state.updatedAt}` },
      submitterMemberId: proposal.submitterMemberId,
      content: investigation.content,
      evidence: investigation.evidence,
      impactScope: investigation.impactScope,
      exclusions: investigation.exclusions,
      risks: investigation.risks,
      rollbackPlan: investigation.rollbackPlan,
      acceptanceCriteria: investigation.acceptanceCriteria,
    });
    this.#recordEvent("member.evolution.proposal_revised_after_investigation", { proposalId: proposal.proposalId, submitterMemberId: proposal.submitterMemberId, feedbackApprovalId: feedback.approvalId, evidenceCount: investigation.evidence.length, correlationId: topic.topicId, resolvesFailure: true });
    return revised;
  }
}

function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionStateOutDto["proposals"][number] {
  const proposal = state.proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) throw new Error("演化提案不存在。");
  return proposal;
}
