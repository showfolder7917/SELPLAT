import type {
  DecideHanliProposalInDto,
  DecideHanliResultInDto,
  HanliAcceptanceRunOutDto,
} from "../../../../../../contracts/services/personas/hanli/index.js";
import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../../../../contracts/services/personas/conversation/index.js";
import type { EvolutionMutationInDto, EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";
import { createEvolutionMutationCoordinator, type EvolutionMutationPort } from "../../../../evolution/index.js";
import type { HanliApplicationPort } from "../../hanli.facade.js";
import { EvolutionApprovalService } from "../decision/evolution-approval.service.js";
import type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";
import { HanliDecisionService } from "../decision/hanli-decision.service.js";
import { HanliConversationService } from "../conversation/hanli-conversation.service.js";

export type { HanliApplicationServiceOptions } from "./hanli-application.ports.js";

/** 韩立人物应用服务：统一拥有自由讨论、方向审批和真实应用验收判断。 */
export class HanliApplicationService implements HanliApplicationPort {
  /** Evolution 权威状态端口，所有审批和验收决定都从这里读取及写入。 */
  readonly #store: HanliApplicationServiceOptions["store"];
  /** 统一人物记忆端口；未接入数据库时允许为空并由具体能力阻断。 */
  readonly #memory: NonNullable<HanliApplicationServiceOptions["memory"]> | null;
  /** 统一事件中心写入函数，用于记录人物业务动作和可恢复异常。 */
  readonly #recordEvent: HanliApplicationServiceOptions["recordEvent"];
  /** Mutation 协调器，保证重复人工决定不会覆盖既有状态。 */
  readonly #mutations: EvolutionMutationPort;
  /** 方向审批服务，只负责审批申请、决定和补充等待事实。 */
  readonly #approvals: EvolutionApprovalService;
  /** 韩立提案判断服务，只负责读取事实并形成结构化决定。 */
  readonly #decision: HanliDecisionService;
  /** 韩立会话服务，协调 Aggregate、模型、调查和研讨启动。 */
  readonly #conversation: HanliConversationService;
  /** 当前稳定用户读取函数，确保客户经验不会跨用户保存。 */
  readonly #readStableUserId: () => string;
  /** 当前工程语义范围读取函数，确保客户经验不会跨项目使用。 */
  readonly #readProjectScope: () => string;

  /** 装配韩立自由讨论与审批能力；构造时不执行判断，也不修改 Evolution 状态。 */
  constructor(options: HanliApplicationServiceOptions) {
    this.#store = options.store;
    this.#memory = options.memory || null;
    this.#recordEvent = options.recordEvent;
    this.#readStableUserId = options.readStableUserId || (() => {
      throw new Error("当前稳定用户尚未解析。");
    });
    this.#readProjectScope = options.readProjectScope || (() => "global");
    this.#mutations = createEvolutionMutationCoordinator({
      begin: options.beginMutation,
      complete: options.completeMutation,
      fail: options.failMutation,
    });
    this.#approvals = new EvolutionApprovalService(this.#store, options.recordTimelineEvent || null);
    this.#conversation = new HanliConversationService(options);
    this.#decision = new HanliDecisionService({
      store: this.#store,
      prompts: options.prompts,
      memory: this.#memory,
      askHanli: options.askHanli || (async () => {
        throw new Error("韩立研讨会话尚未接入。");
      }),
      readStableUserId: this.#readStableUserId,
      readProjectScope: () => this.#readProjectScope(),
    });
  }

  conversation(): PersonaConversationOutDto {
    return this.#conversation.conversation();
  }

  sendConversationMessage(request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto> {
    return this.#conversation.send(request);
  }

  newConversation(): Promise<PersonaConversationOutDto> {
    return this.#conversation.newConversation();
  }

  /** 接收人物提交的提案并登记审批申请；不会提前作出审批结论。 */
  requestProposalReview(proposalId: string): EvolutionStateOutDto {
    return this.#approvals.recordApplication(proposalId);
  }


  /** 保存用户给出的人工方向审批，Mutation 门禁保证重复请求不会覆盖历史。 */
  decideProposal(proposalId: string, request: DecideHanliProposalInDto): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    return this.#mutations.run(
      proposal.topicId,
      "人工审批",
      request.mutation,
      () => this.#store.state().updatedAt,
      () => this.#store.state(),
      () => this.#approvals.decide(
        proposalId,
        request.decision,
        request.advice || "",
        "manual-user",
        [],
        request.feedbackTarget || "proposal-content",
        request.capabilityScope || "",
      ),
    );
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
    return this.#mutations.run(
      proposal.topicId,
      "韩立审批",
      mutation,
      () => this.#store.state().updatedAt,
      () => this.#store.state(),
      () => this.#autoApproveOnce(proposal),
    );
  }

  recordAcceptanceRun(run: HanliAcceptanceRunOutDto): EvolutionStateOutDto {
    const hasValidVersion = run.version === 2;
    const hasInteractionSteps = run.stepResults.length > 0;
    const hasEvidence = run.evidenceAttachmentIds.length > 0;
    if (!hasValidVersion || !hasInteractionSteps || !hasEvidence) {
      throw new Error("缺少真实交互验收证据");
    }
    return this.#store.recordAcceptanceRun(run);
  }

  /** 保存人工最终验收判断；真实运行证据是否充足仍由 Evolution 状态门禁核对。 */
  decideResult(proposalId: string, request: DecideHanliResultInDto): EvolutionStateOutDto {
    return this.#decideResult(proposalId, request, "manual-user");
  }

  /** 一次性流程把真实运行结果交给韩立；失败先保留证据，由 Workflow 判断修复范围。 */
  completeAutomaticAcceptance(run: HanliAcceptanceRunOutDto, idempotencyKey: string): EvolutionStateOutDto {
    this.recordAcceptanceRun(run);
    // 工具受阻和产品失败都要保留原提案待验收，不能退回南宫婉重做原提案。
    if (run.status !== "passed") {
      // Workflow 会先提取本轮真实缺陷并判断是否仍属于原验收范围。
      return this.#store.state();
    }
    const expectedStateVersion = this.#store.state().updatedAt;
    // 全部验收条件通过后，韩立才能作出最终通过决定。
    const decision: DecideHanliResultInDto["decision"] = "approved";
    // 可见说明明确指出通过依据来自真实用户路径。
    const advice = "韩立已按真实用户路径完成检查，全部适用项目通过。";
    return this.#decideResult(run.proposalId, {
      mutation: {
        expectedStateVersion,
        idempotencyKey,
      },
      decision,
      advice,
    }, "automatic-han-li");
  }

  #decideResult(proposalId: string, request: DecideHanliResultInDto, source: "manual-user" | "automatic-han-li"): EvolutionStateOutDto {
    const proposal = requireProposal(this.#store.state(), proposalId);
    const next = this.#mutations.run(
      proposal.topicId,
      "结果验收",
      request.mutation,
      () => this.#store.state().updatedAt,
      () => this.#store.state(),
      () => this.#store.decideResult(proposalId, request.decision, request.advice || "", source),
    );
    const archiveRecords = [...next.archiveRecords].reverse();
    const decidedRecord = archiveRecords.find((record) => {
      return record.proposalId === proposalId && record.eventType === "proposal.result_decided";
    });
    const experienceCandidate = decidedRecord?.payload.experienceCandidate;
    if (this.#memory && experienceCandidate && typeof experienceCandidate === "object") {
      this.#memory.recordVerifiedInspectionExperience(
        this.#readStableUserId(),
        this.#readProjectScope(),
        experienceCandidate as import("../../../../../../contracts/services/personas/hanli/index.js").HanliAcceptanceExperienceCandidateOutDto,
      );
      this.#recordEvent("acceptance.experience_promoted", { proposalId, experienceCandidate });
    }
    return next;
  }

  #autoApproveOnce(proposal: EvolutionProposalOutDto): EvolutionStateOutDto {
    const state = this.#store.state();
    const manualHistory: Array<{
      item: EvolutionProposalOutDto;
      approval: EvolutionProposalOutDto["approvals"][number];
    }> = [];
    for (const item of state.proposals) {
      for (const approval of item.approvals) {
        const sameProposalKind = item.type === proposal.type && item.origin === proposal.origin;
        if (sameProposalKind && approval.source === "manual-user") {
          manualHistory.push({ item, approval });
        }
      }
    }
    const hasCompleteFacts = Boolean(proposal.content)
      && proposal.evidence.length > 0
      && proposal.impactScope.length > 0
      && proposal.risks.length > 0
      && Boolean(proposal.rollbackPlan)
      && proposal.acceptanceCriteria.length > 0;
    if (!hasCompleteFacts) {
      return this.#approvals.decide(proposal.proposalId, "supplement-required", `事实、范围、风险、回退或验收条件不完整，请${proposal.submitterDisplayName}补充调查。`, "automatic-han-li", []);
    }
    const databaseHistory = this.#memory?.approvalEvidence(proposal.type, proposal.origin) || [];
    if (!manualHistory.length && !databaseHistory.length) {
      return this.#approvals.decide(
        proposal.proposalId,
        "supplement-required",
        "没有同类型人工审批记录，不能以低置信度猜测通过。",
        "automatic-han-li",
        [],
      );
    }
    const latestState = manualHistory.at(-1);
    const latestDatabase = databaseHistory[0];
    let latest: {
      approvalId: string;
      decision: EvolutionProposalOutDto["approvals"][number]["decision"];
      advice: string;
    } | undefined = latestDatabase;
    if (latestState) {
      const stateHistoryIsNewer = !latestDatabase
        || Date.parse(latestState.approval.createdAt) >= Date.parse(latestDatabase.approvedAt);
      if (stateHistoryIsNewer) {
        latest = {
          approvalId: latestState.approval.approvalId,
          decision: latestState.approval.decision,
          advice: latestState.approval.advice,
        };
      }
    }
    if (!latest) {
      throw new Error("没有可用于自动审批的历史记录。");
    }
    let adviceContext = "";
    if (latest.advice.trim()) {
      adviceContext = `；历史建议：${latest.advice.trim().slice(0, 300)}`;
    }
    return this.#approvals.decide(
      proposal.proposalId,
      latest.decision,
      `参考同类型人工审批 ${latest.approvalId} 的历史倾向；当前尚未把该记录等同为已确认客户关注点${adviceContext}。`,
      "automatic-han-li",
      [latest.approvalId],
    );
  }
}

function requireProposal(state: EvolutionStateOutDto, proposalId: string): EvolutionProposalOutDto {
  const proposal = state.proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) {
    throw new Error("演化提案不存在。");
  }
  return proposal;
}
