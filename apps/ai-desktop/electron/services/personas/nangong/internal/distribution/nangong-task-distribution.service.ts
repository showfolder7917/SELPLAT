import { randomUUID } from "node:crypto";

import type { CollaborationTimelineBusinessEventOutDto, CollaborationTaskOutDto } from "../../../../../../contracts/services/workflow/index.js";
import type { CodexStreamEventOutDto } from "../../../../../../contracts/services/support/platform/codex/index.js";
import type { EvolutionDistributionPlanOutDto, EvolutionDistributionUnitOutDto, EvolutionDistributionValidationOutDto, EvolutionMutationInDto, EvolutionProposalOutDto, EvolutionStateOutDto } from "../../../../../../contracts/services/evolution/index.js";
import type { CollaborationWorkflowFacade } from "../../../../workflow/index.js";
import type { EvolutionMutationPort, EvolutionStatePort } from "../../../../evolution/index.js";
import type { PromptLibraryPort } from "../../../../support/capabilities/prompts/index.js";

type PlanResult = { summary: string; units: EvolutionDistributionUnitOutDto[] };

export interface NangongTaskDistributionServiceOptions {
  store: EvolutionStatePort;
  mutations: EvolutionMutationPort;
  collaboration: CollaborationWorkflowFacade;
  plan(prompt: string, workspaceState: EvolutionStateOutDto["topics"][number]["workspaceState"], locale: EvolutionStateOutDto["topics"][number]["locale"], emit: (event: CodexStreamEventOutDto) => void): Promise<string>;
  prompts: PromptLibraryPort;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  timeline?: (event: CollaborationTimelineBusinessEventOutDto) => void;
  timelineStream?: (taskId: string, memberId: string, event: CodexStreamEventOutDto) => void;
}

/** 任务分发唯一服务：只消费“已通过审批”命令，不作审批判断。 */
export class NangongTaskDistributionService {
  constructor(private readonly options: NangongTaskDistributionServiceOptions) {}

  async dispatch(proposalId: string, request?: EvolutionMutationInDto): Promise<EvolutionStateOutDto> {
    const proposal = requireProposal(this.options.store.state(), proposalId);
    const mutation = request || { expectedStateVersion: this.options.store.state().updatedAt, idempotencyKey: `distribution:${proposalId}` };
    return this.options.mutations.runAsync(
      proposal.topicId,
      "南宫婉任务分发",
      mutation,
      () => this.options.store.state().updatedAt,
      () => this.options.store.state(),
      () => this.#dispatch(proposalId),
    );
  }

  async #dispatch(proposalId: string): Promise<EvolutionStateOutDto> {
    let state = this.options.store.state();
    let proposal = requireProposal(state, proposalId);
    const topic = requireTopic(state, proposal.topicId);
    if (proposal.status !== "approved") throw new Error("只有审批通过后才能分发任务。");
    if (!topic.workspaceState?.roots.length) throw new Error("当前专题缺少可用的实施工作区，无法分发。");

    if (!proposal.distributionPlan || proposal.distributionPlan.validation.decision !== "passed") {
      let feedback = proposal.distributionPlan?.validation.findings.join("；") || "";
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const planningTaskId = `proposal:${proposal.proposalId}`;
        const planningStartedAt = new Date().toISOString();
        this.#publishPlanning(proposal, topic, attempt, "current", "正在生成执行计划并分配执行人", feedback, planningStartedAt);
        let planned: PlanResult;
        try {
          planned = parseDistributionPlan(await this.options.plan(
            this.options.prompts.render("nangong.distribution-plan", {
              topicTitle: topic.title,
              topicGoal: topic.goal,
              proposalContent: proposal.content,
              impactScope: proposal.impactScope.join("；"),
              acceptanceCriteria: proposal.acceptanceCriteria.join("；"),
              exclusions: proposal.exclusions.join("；") || "无",
              feedback: feedback ? `程序上一轮核对到的确定性冲突：${feedback}` : "这是首次拆分。",
            }),
            topic.workspaceState,
            topic.locale,
            (event) => this.options.timelineStream?.(planningTaskId, proposal.submitterMemberId, event),
          ));
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.#publishPlanning(proposal, topic, attempt, "failed", "生成执行计划失败", detail, planningStartedAt);
          throw error;
        }
        this.#publishPlanning(proposal, topic, attempt, "completed", "执行计划生成完成", planned.summary, planningStartedAt);
        const hardFindings = distributionHardFindings(planned.units);
        const validation = validateDistributionPlan(planned, hardFindings);
        const plan: EvolutionDistributionPlanOutDto = { version: 1, summary: planned.summary, units: planned.units, validation, plannedAt: new Date().toISOString() };
        state = this.options.store.saveDistributionPlan(proposalId, plan);
        proposal = requireProposal(state, proposalId);
        this.options.recordEvent("nangong.evolution.distribution_planned", { proposalId, attempt, unitCount: plan.units.length, expectedFiles: plan.units.flatMap((unit) => unit.expectedFiles), validationDecision: validation.decision, validationFindings: validation.findings });
        this.options.recordEvent("nangong.distribution_validation.completed", { proposalId, attempt, decision: validation.decision, reason: validation.reason, findings: validation.findings });
        if (validation.decision === "passed") break;
        feedback = [validation.reason, ...validation.findings].filter(Boolean).join("；");
      }
    }

    proposal = requireProposal(this.options.store.state(), proposalId);
    if (!proposal.distributionPlan || proposal.distributionPlan.validation.decision !== "passed") throw new Error("程序核对到当前任务拆分仍存在确定性冲突，已阻止分发并交由南宫婉重新规划。");

    const distributedTaskIds = [...proposal.distributedTaskIds];
    const latestApproval = proposal.approvals.at(-1);
    const revisionFeedback = proposal.revisionFeedbackApprovalId
      ? state.proposals.flatMap((item) => item.approvals).find((approval) => approval.approvalId === proposal.revisionFeedbackApprovalId)
      : null;
    const collaborationState = typeof this.options.collaboration.state === "function" ? this.options.collaboration.state() : { members: [], tasks: [] };
    const targetMember = proposal.targetMemberId ? collaborationState.members.find((member) => member.memberId === proposal.targetMemberId) : null;
    const observedTasks: CollaborationTaskOutDto[] = collaborationState.tasks.filter((task) => task.evolutionProposalId === proposal.proposalId);
    const existingTaskTitles = new Set(observedTasks.map((task) => task.snapshot.title));
    for (const [index, unit] of proposal.distributionPlan.units.entries()) {
      if (existingTaskTitles.has(unit.title)) continue;
      const selfUpgradeContext = proposal.purpose === "self-capability-upgrade"
        ? `\n\n自身能力升级目标：${proposal.targetMemberDisplayName}（${proposal.targetMemberId}）\n能力范围：${proposal.capabilityScope}\n原人工反馈：${revisionFeedback?.advice || "—"}\n必须修改该人物自身使用的规则、提示、工作流或实现，并用回归测试证明以后同类提交会更具体。`
        : "";
      const next = this.options.collaboration.submitTask({
        title: unit.title, problemStatement: topic.goal,
        confirmedIntent: `${proposal.content}\n\n本任务范围：${unit.scope}\n\n回退方案：${proposal.rollbackPlan}${selfUpgradeContext}`,
        constraints: [...proposal.exclusions.map((item) => `不涉及：${item}`), ...proposal.risks.map((item) => `风险：${item}`)],
        acceptanceCriteria: unit.acceptanceCriteria, workspaceState: topic.workspaceState, locale: topic.locale,
        mergeStrategy: "ATOMIC_GROUP", atomicGroupId: proposal.proposalId, dependencyTaskIds: [], initiatorMemberId: proposal.submitterMemberId,
        preferredExecutorMemberId: proposal.purpose === "self-capability-upgrade" && targetMember?.kind === "worker" ? targetMember.memberId : proposal.origin === "linghu" ? "linghu-ancestor" : undefined,
        evolutionProposalId: proposal.proposalId, evolutionRoundId: proposal.proposalId,
        selfUpgradeTargetMemberId: proposal.targetMemberId || undefined, selfUpgradeCapabilityScope: proposal.capabilityScope || undefined,
        sourceEvolutionApprovalId: latestApproval?.approvalId,
        taskRuleIds: unit.taskRuleIds || [],
      });
      const createdTask = next.tasks.find((task) => task.evolutionProposalId === proposal.proposalId && !distributedTaskIds.includes(task.taskId));
      if (!createdTask) throw new Error("协同任务已经创建，但未能建立提案关联。");
      distributedTaskIds.push(createdTask.taskId);
      observedTasks.push(createdTask);
      existingTaskTitles.add(unit.title);
      this.options.recordEvent(`${proposal.origin}.evolution.proposal_distributed`, { proposalId, topicId: topic.topicId, unit: unit.title, index }, createdTask.taskId);
      state = this.options.store.markDispatched(proposalId, createdTask.taskId);
    }
    this.#publishDistribution(requireProposal(state, proposalId), topic, observedTasks);
    return state;
  }

  #publishPlanning(proposal: EvolutionProposalOutDto, topic: EvolutionStateOutDto["topics"][number], attempt: number, status: "current" | "completed" | "failed", action: string, content: string, startedAt: string): void {
    const occurredAt = new Date().toISOString();
    this.options.timeline?.({
      eventId: `distribution-planning-${proposal.proposalId}-${attempt}-${status}-${randomUUID()}`,
      eventType: status === "current" ? "task.distribution_planning_started" : status === "completed" ? "task.distribution_planning_completed" : "task.distribution_planning_failed",
      group: { groupId: `topic:${topic.topicId}`, topicId: topic.topicId, proposalId: proposal.proposalId, title: topic.title, status: "running", summary: proposal.content, startedAt: topic.createdAt, updatedAt: occurredAt },
      fact: {
        nodeId: `distribution-planning:${proposal.proposalId}:${attempt}`, taskId: `proposal:${proposal.proposalId}`, proposalId: proposal.proposalId,
        sourceFactKey: `distribution-planning:${proposal.proposalId}:${attempt}:${status}`, kind: "analysis",
        actor: { memberId: proposal.submitterMemberId, displayName: proposal.submitterDisplayName }, recipients: [],
        contentRole: "analysis-output", detailRole: "task-breakdown", status, action, summary: content || action,
        content, detail: proposal.content, startedAt,
        completedAt: status === "current" ? null : occurredAt, automaticOpen: status !== "completed", manualApprovalProposalId: null, occurredAt,
      },
    });
  }

  #publishDistribution(proposal: EvolutionProposalOutDto, topic: EvolutionStateOutDto["topics"][number], observedTasks: CollaborationTaskOutDto[]): void {
    const tasks = observedTasks.filter((task) => proposal.distributedTaskIds.includes(task.taskId));
    // 接收人只来自冻结的执行分配；currentHandler 可能仍是提交人，不能据此反推出“南宫婉发给南宫婉”。
    const recipients = tasks.map((task) => task.executionRecords?.[0]?.executor || task.originalExecutor || { memberId: `pending:${task.taskId}`, displayName: "等待分配" })
      .filter((recipient) => recipient.memberId !== proposal.submitterMemberId)
      .filter((value, index, values) => values.findIndex((candidate) => candidate.memberId === value.memberId) === index);
    const occurredAt = proposal.distributionPlan?.plannedAt || proposal.updatedAt;
    const priorAdvice = proposal.revisionFeedbackApprovalId
      ? this.options.store.state().proposals.flatMap((item) => item.approvals).find((approval) => approval.approvalId === proposal.revisionFeedbackApprovalId)?.advice || ""
      : "";
    this.options.timeline?.({
      eventId: `distribution-${proposal.proposalId}-${randomUUID()}`,
      eventType: "task.distribution",
      group: { groupId: `topic:${topic.topicId}`, topicId: topic.topicId, proposalId: proposal.proposalId, title: topic.title, status: "running", summary: proposal.distributionPlan?.summary || proposal.content, startedAt: topic.createdAt, updatedAt: occurredAt },
      fact: {
        nodeId: `distribution:${proposal.proposalId}`, taskId: null, proposalId: proposal.proposalId,
        sourceFactKey: `distribution:${proposal.proposalId}`, kind: "distribution", actor: { memberId: proposal.submitterMemberId, displayName: proposal.submitterDisplayName }, recipients,
        contentRole: "task-content", detailRole: "task-breakdown",
        status: "completed", action: "任务分发", summary: proposal.distributionPlan?.summary || proposal.content,
        content: [proposal.content, priorAdvice ? `审批退回后的补充：${priorAdvice}` : "", ...proposal.distributionPlan!.units.map((unit) => `${unit.title}：${unit.scope}`)].filter(Boolean).join("\n\n"),
        detail: proposal.distributionPlan!.units.map((unit) => `${unit.title}：${unit.scope}`).join("\n"), startedAt: occurredAt,
        completedAt: occurredAt, automaticOpen: false, manualApprovalProposalId: null, occurredAt,
      },
    });
  }
}

function parseDistributionPlan(text: string): PlanResult {
  const value = parseJsonObject(text);
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 4_000) : "";
  const rawUnits = Array.isArray(value.units) ? value.units : [];
  const units = rawUnits.flatMap((raw): EvolutionDistributionUnitOutDto[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 200) : "";
    const scope = typeof item.scope === "string" ? item.scope.trim().slice(0, 8_000) : "";
    const acceptanceCriteria = normalizeDraftList(item.acceptanceCriteria);
    const expectedFiles = normalizeDraftList(item.expectedFiles).map((file) => file.replaceAll("\\", "/").replace(/^\.\//u, "")).filter((file) => !file.startsWith("/") && !file.split("/").includes(".."));
    const taskRuleIds = normalizeDraftList(item.taskRuleIds).filter((id) => /^[A-Z][A-Z0-9_]{1,127}$/u.test(id));
    const independentReason = typeof item.independentReason === "string" ? item.independentReason.trim().slice(0, 4_000) : "";
    return title && scope && acceptanceCriteria.length && expectedFiles.length && independentReason ? [{ title, scope, acceptanceCriteria, expectedFiles, taskRuleIds, independentReason }] : [];
  });
  if (!summary || !units.length) throw new Error("南宫婉没有形成包含文件边界和独立验收条件的有效任务拆分计划。");
  return { summary, units };
}

function normalizeDraftList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 100) : [];
}

function parseJsonObject(text: string): Record<string, unknown> {
  const candidate = text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) throw new Error("AI 没有返回可解析的结构化判断。");
  try { return JSON.parse(candidate) as Record<string, unknown>; }
  catch { throw new Error("AI 返回的结构化判断不是有效 JSON。"); }
}

function distributionHardFindings(units: EvolutionDistributionUnitOutDto[]): string[] {
  const findings: string[] = [];
  for (let index = 0; index < units.length; index += 1) for (let other = index + 1; other < units.length; other += 1) {
    const overlap = units[index].expectedFiles.filter((file) => units[other].expectedFiles.includes(file));
    if (overlap.length) findings.push(`文件同时属于任务“${units[index].title}”与“${units[other].title}”：${overlap.join("、")}`);
  }
  return findings;
}

/** 程序只校验可确定的分发冲突；业务规划仍由南宫婉负责，令狐不参与常规分发审核。 */
function validateDistributionPlan(plan: PlanResult, hardFindings: string[]): EvolutionDistributionValidationOutDto {
  const findings = [...hardFindings];
  const titles = new Set<string>();
  const scopes = new Set<string>();
  for (const unit of plan.units) {
    const title = unit.title.normalize("NFKC").replaceAll(/\s+/gu, "").toLowerCase();
    const scope = unit.scope.normalize("NFKC").replaceAll(/\s+/gu, "").toLowerCase();
    if (titles.has(title)) findings.push(`存在重复任务标题：${unit.title}`);
    if (scopes.has(scope)) findings.push(`存在重复任务职责：${unit.scope}`);
    titles.add(title);
    scopes.add(scope);
  }
  const uniqueFindings = [...new Set(findings)];
  return {
    decision: uniqueFindings.length ? "revise" : "passed",
    reason: uniqueFindings.length ? "程序发现任务之间存在确定性冲突。" : "程序未发现文件、标题或职责的确定性冲突。",
    findings: uniqueFindings,
    validatedAt: new Date().toISOString(),
  };
}
function requireProposal(state: EvolutionStateOutDto, proposalId: string) { const value = state.proposals.find((item) => item.proposalId === proposalId); if (!value) throw new Error("演化提案不存在。"); return value; }
function requireTopic(state: EvolutionStateOutDto, topicId: string) { const value = state.topics.find((item) => item.topicId === topicId); if (!value) throw new Error("专项课题不存在。"); return value; }
