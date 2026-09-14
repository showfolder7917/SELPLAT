import { randomUUID } from "node:crypto";
import type { CodexDynamicToolsPort } from "../../../../support/platform/codex/index.js";
import type { AcceptanceSceneKind, AcceptanceScenePlanOutDto, AcceptanceSceneSegmentOutDto, HanliComputerAcceptanceInDto } from "../../../../../../contracts/services/personas/hanli/index.js";

const sceneKinds: AcceptanceSceneKind[] = ["current-window", "workspace-explorer-fixture", "workspace-lifecycle-review", "empty-task-group", "completed-recovery-timeline", "inspection-lifecycle-timeline", "user-language-detail-timeline", "recovery-action-lifecycle", "persona-conversation-lifecycle", "persona-conversation-with-task-handoff", "cross-task-member-occupancy", "member-idle", "collaboration-state-syncing", "collaboration-state-unavailable", "blocked"];
const stageRegistrationRequiredFields = ["requestId", "kind", "reason", "completionReviewRequired", "ownedConditions", "relatedCriterionIds"] as const;
const stageConditionRequiredFields = ["criterionId", "prerequisite"] as const;

const stageRegistrationInputSchema = {
  type: "object",
  additionalProperties: false,
  required: stageRegistrationRequiredFields,
  properties: {
    requestId: { type: "string" },
    kind: { type: "string", enum: sceneKinds },
    reason: { type: "string" },
    completionReviewRequired: { type: "boolean" },
    ownedConditions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: stageConditionRequiredFields,
        properties: { criterionId: { type: "string" }, prerequisite: { type: "string" } },
      },
    },
    relatedCriterionIds: { type: "array", uniqueItems: true, items: { type: "string" } },
  },
} as const;

interface AcceptanceScenePlanRejection {
  message: string;
}

interface AcceptanceScenePlanningContext {
  criteria: Array<{ criterionId: string; text: string }>;
  requirements: Array<{ requirementId: string; acceptedKinds: AcceptanceSceneKind[]; completed: boolean }>;
  remainingCriterionIds: string[];
  remainingRequirementIds: string[];
  previousAttemptFailure?: string;
}

interface AcceptanceSceneRequirement {
  requirementId: string;
  acceptedKinds: AcceptanceSceneKind[];
  missingMessage: string;
}

interface ActiveAcceptanceSceneAttempt {
  requestId: string;
  goal: HanliComputerAcceptanceInDto;
  model: AcceptanceScenePlanModel;
  plan: AcceptanceScenePlanOutDto | null;
  lastRejection: AcceptanceScenePlanRejection | null;
}

/** 条件归属和受控场景完成由同一模型推进，避免计划、重试和最终校验各自推断状态。 */
class AcceptanceScenePlanModel {
  readonly #expectedCriterionIds: string[];
  readonly #requirements: AcceptanceSceneRequirement[];
  readonly #segments: AcceptanceSceneSegmentOutDto[] = [];

  constructor(readonly goal: HanliComputerAcceptanceInDto) {
    this.#expectedCriterionIds = goal.criteria.map((_, index) => `criterion-${index + 1}`);
    this.#requirements = sceneRequirementsFor(goal);
  }

  get segments(): AcceptanceSceneSegmentOutDto[] { return this.#segments; }

  planningContext(previousAttemptFailure?: string): AcceptanceScenePlanningContext {
    const ownedCriterionIds = this.#segments.flatMap((segment) => segment.ownedConditions.map(({ criterionId }) => criterionId));
    const completedRequirementIds = this.completedRequirementIds();
    const context: AcceptanceScenePlanningContext = {
      criteria: this.goal.criteria.map((text, index) => ({ criterionId: `criterion-${index + 1}`, text })),
      requirements: this.#requirements.map((requirement) => ({
        requirementId: requirement.requirementId,
        acceptedKinds: requirement.acceptedKinds,
        completed: completedRequirementIds.includes(requirement.requirementId),
      })),
      remainingCriterionIds: this.#expectedCriterionIds.filter((id) => !ownedCriterionIds.includes(id)),
      remainingRequirementIds: this.#requirements.map(({ requirementId }) => requirementId).filter((id) => !completedRequirementIds.includes(id)),
    };
    return previousAttemptFailure ? { ...context, previousAttemptFailure } : context;
  }

  register(segment: AcceptanceSceneSegmentOutDto): AcceptanceScenePlanningContext {
    const ownedCriterionIds = this.#segments.flatMap((item) => item.ownedConditions.map(({ criterionId }) => criterionId));
    const newOwnedIds = segment.ownedConditions.map(({ criterionId }) => criterionId);
    const relatedCriterionIds = segment.relatedCriterionIds;
    if ((!newOwnedIds.length && !relatedCriterionIds.length) || (newOwnedIds.length && relatedCriterionIds.length)) {
      throw new Error("验收场景阶段必须唯一占用条件，或关联已有条件完成剩余场景。");
    }
    if (new Set(newOwnedIds).size !== newOwnedIds.length || newOwnedIds.some((id) => ownedCriterionIds.includes(id))) {
      throw new Error("验收场景阶段不能重复占用原验收条件。");
    }
    if (newOwnedIds.some((id) => !this.#expectedCriterionIds.includes(id))) {
      throw new Error("验收场景阶段包含未知的原验收条件。");
    }
    if (new Set(relatedCriterionIds).size !== relatedCriterionIds.length || relatedCriterionIds.some((id) => !ownedCriterionIds.includes(id))) {
      throw new Error("验收场景阶段只能关联先前已占用的原验收条件。");
    }
    this.#segments.push(segment);
    return this.planningContext();
  }

  assertCompleted(): void {
    const context = this.planningContext();
    if (context.remainingCriterionIds.length) throw new Error("韩立验收场景计划未逐项覆盖原验收条件。");
    const missingRequirement = this.#requirements.find((requirement) => context.remainingRequirementIds.includes(requirement.requirementId));
    if (missingRequirement) throw new Error(missingRequirement.missingMessage);
  }

  private completedRequirementIds(): string[] {
    return this.#requirements
      .filter((requirement) => this.#segments.some((segment) => requirement.acceptedKinds.includes(segment.kind)
        && (segment.ownedConditions.length > 0 || segment.relatedCriterionIds.length > 0)))
      .map(({ requirementId }) => requirementId);
  }
}

/** 验证韩立的结构化准备计划，任何缺项都退回环境排障，不默认为当前窗口。 */
export function validateAcceptanceScenePlan(input: unknown, goal: HanliComputerAcceptanceInDto): AcceptanceScenePlanOutDto {
  const value = input as AcceptanceScenePlanOutDto;
  if (!value || typeof value.reason !== "string" || !value.reason.trim()
    || !Array.isArray(value.segments) || value.segments.length === 0) {
    throw new Error("韩立未提交有效的验收场景计划。");
  }
  const segments = value.segments as AcceptanceSceneSegmentOutDto[];
  if (segments.some((segment) => !segment || !sceneKinds.includes(segment.kind)
      || typeof segment.reason !== "string" || !segment.reason.trim()
      || typeof segment.completionReviewRequired !== "boolean"
      || !Array.isArray(segment.ownedConditions) || !Array.isArray(segment.relatedCriterionIds)
      || segment.ownedConditions.some((condition) => typeof condition?.criterionId !== "string" || typeof condition?.prerequisite !== "string" || !condition.prerequisite.trim())
      || segment.relatedCriterionIds.some((criterionId) => typeof criterionId !== "string"))) {
    throw new Error("韩立未提交有效的验收场景阶段。");
  }
  const model = new AcceptanceScenePlanModel(goal);
  for (const segment of segments) model.register(segment);
  model.assertCompleted();
  if (segments.some((segment) => segment.kind === "current-window" || segment.kind === "workspace-explorer-fixture" || segment.kind === "workspace-lifecycle-review") && !hasVerifiedCurrentWindowContext(goal)) {
    throw new Error("当前窗口场景缺少与验收目标一致的只读专题、提案或运行记录，不能把模型推测当作页面事实。");
  }
  if (segments.some((segment) => segment.kind === "workspace-explorer-fixture") && !goal.workspaceAcceptanceFixture) {
    throw new Error("工作区验收场景缺少已签发的受控夹具，不能把普通目录当作加载、失败或空目录证据。");
  }
  if (segments.filter((segment) => segment.kind === "workspace-explorer-fixture").length > 1) {
    throw new Error("一次性工作区夹具只能使用一个验收阶段，相关条件必须合并取证。");
  }
  if (segments.some((segment) => segment.kind === "cross-task-member-occupancy") && !goal.crossTaskMemberOccupancyFixture) {
    throw new Error("跨任务人物占用场景缺少主进程签发的受控夹具。");
  }
  if (segments.filter((segment) => segment.kind === "cross-task-member-occupancy").length > 1) {
    throw new Error("跨任务人物占用夹具只能使用一个验收阶段。");
  }
  if (segments.some((segment) => segment.kind === "member-idle") && !goal.memberIdleFixture) {
    throw new Error("人物空闲场景缺少主进程签发的受控夹具。");
  }
  if (segments.filter((segment) => segment.kind === "member-idle").length > 1) {
    throw new Error("人物空闲夹具只能使用一个验收阶段。");
  }
  const usesStateProjection = segments.some((segment) => segment.kind === "collaboration-state-syncing" || segment.kind === "collaboration-state-unavailable");
  if (usesStateProjection && !goal.collaborationStateProjectionFixture) {
    throw new Error("协作状态验收场景缺少主进程签发的受控夹具。");
  }
  if (segments.filter((segment) => segment.kind === "collaboration-state-syncing").length > 1
    || segments.filter((segment) => segment.kind === "collaboration-state-unavailable").length > 1) {
    throw new Error("每种协作状态夹具只能使用一个验收阶段。");
  }
  const lifecycleReviewIndex = segments.findIndex((segment) => segment.kind === "workspace-lifecycle-review");
  const fixtureIndex = segments.findIndex((segment) => segment.kind === "workspace-explorer-fixture");
  const lifecycleReviewRequired = goal.interactionCapabilities?.some((capability) => capability === "workspace-cleanup-recovery" || capability === "workspace-startup-recovery") === true;
  if (lifecycleReviewIndex >= 0 && !lifecycleReviewRequired) {
    throw new Error("工作区生命周期复核缺少已批准的收尾或重启回收范围。");
  }
  if (lifecycleReviewRequired && (fixtureIndex < 0 || lifecycleReviewIndex !== fixtureIndex + 1)) {
    throw new Error("工作区收尾或重启回收条件必须紧接夹具阶段使用工作区生命周期复核场景。");
  }
  if (segments.filter((segment) => segment.kind === "workspace-lifecycle-review").length > 1) {
    throw new Error("工作区生命周期复核只能使用一个验收阶段。");
  }
  if (segments.some((segment) => segment.completionReviewRequired && segment.kind !== "current-window")) {
    throw new Error("跨完成态复核只能使用当前真实窗口，隔离或受阻场景不能触发业务完成动作。");
  }
  const completionIndex = segments.findIndex((segment) => segment.completionReviewRequired);
  if (completionIndex >= 0 && (completionIndex !== segments.length - 1 || segments.filter((segment) => segment.completionReviewRequired).length > 1)) {
    throw new Error("跨完成态复核必须是唯一且最后一个验收阶段。");
  }
  return {
    reason: value.reason.trim(),
    segments: segments.map((segment) => ({
      kind: segment.kind,
      reason: segment.reason.trim(),
      completionReviewRequired: segment.completionReviewRequired,
      ownedConditions: segment.ownedConditions.map(({ criterionId, prerequisite }) => ({ criterionId, prerequisite: prerequisite.trim() })),
      relatedCriterionIds: [...segment.relatedCriterionIds],
    })),
  };
}

/** 当前窗口只能复用已由运行时核实关联关系的专题，避免模型在无数据端口时臆测记录缺失。 */
function hasVerifiedCurrentWindowContext(goal: HanliComputerAcceptanceInDto): boolean {
  const context = goal.sceneContext;
  if (!context) return false;
  return context.topic.topicId === goal.topicId
    && context.proposal.proposalId === goal.proposalId
    && context.proposal.topicId === goal.topicId
    && context.oneShotRun?.topicId === goal.topicId
    && context.oneShotRun?.proposalId === goal.proposalId;
}

/** 从主进程已签发的目标派生唯一场景需求表；多个可选阶段仍只证明同一个受控夹具。 */
function sceneRequirementsFor(goal: HanliComputerAcceptanceInDto): AcceptanceSceneRequirement[] {
  const requirements: AcceptanceSceneRequirement[] = [];
  if (goal.workspaceAcceptanceFixture) requirements.push({
    requirementId: "workspace-acceptance-fixture",
    acceptedKinds: ["workspace-explorer-fixture"],
    missingMessage: "本轮已经签发工作区验收夹具，场景计划必须包含一个工作区夹具阶段；不能只观察普通工作区后报告临时根缺失。",
  });
  if (goal.crossTaskMemberOccupancyFixture) requirements.push({
    requirementId: "cross-task-member-occupancy",
    acceptedKinds: ["cross-task-member-occupancy"],
    missingMessage: "本轮已经签发跨任务人物占用夹具，场景计划必须使用该夹具阶段。",
  });
  if (goal.memberIdleFixture) requirements.push({
    requirementId: "member-idle",
    acceptedKinds: ["member-idle"],
    missingMessage: "本轮已经签发人物空闲夹具，场景计划必须使用该夹具阶段。",
  });
  if (goal.collaborationStateProjectionFixture) requirements.push({
    requirementId: "collaboration-state-projection",
    acceptedKinds: ["collaboration-state-syncing", "collaboration-state-unavailable"],
    missingMessage: "本轮已经签发协作状态夹具，场景计划必须覆盖同步中或状态暂未更新。 ",
  });
  return requirements;
}

/** 分段登记把唯一归属和关联场景一并交给权威模型，工具不得自行补写条件或夹具状态。 */
function registerAcceptanceSceneSegment(input: unknown, attempt: ActiveAcceptanceSceneAttempt): AcceptanceScenePlanningContext {
  const value = input as AcceptanceSceneSegmentOutDto & { requestId?: string };
  if (!value || value.requestId !== attempt.requestId || !sceneKinds.includes(value.kind)
    || typeof value.reason !== "string" || !value.reason.trim()
    || typeof value.completionReviewRequired !== "boolean"
    || !Array.isArray(value.ownedConditions) || !Array.isArray(value.relatedCriterionIds)
    || value.ownedConditions.some((condition) => typeof condition?.criterionId !== "string"
      || typeof condition?.prerequisite !== "string" || !condition.prerequisite.trim())
    || value.relatedCriterionIds.some((criterionId) => typeof criterionId !== "string")) {
    throw new Error("韩立未提交有效的验收场景阶段。");
  }
  return attempt.model.register({
    kind: value.kind,
    reason: value.reason.trim(),
    completionReviewRequired: value.completionReviewRequired,
    ownedConditions: value.ownedConditions.map(({ criterionId, prerequisite }) => ({ criterionId, prerequisite: prerequisite.trim() })),
    relatedCriterionIds: [...value.relatedCriterionIds],
  });
}

/** 将已逐项登记的阶段交给原有严格校验，保留夹具和完成态边界。 */
function finalizeAcceptanceScenePlan(input: unknown, attempt: ActiveAcceptanceSceneAttempt): AcceptanceScenePlanOutDto {
  const value = input as { requestId?: string; reason?: string };
  if (!value || value.requestId !== attempt.requestId || typeof value.reason !== "string" || !value.reason.trim()) throw new Error("韩立未提交有效的验收场景完成请求。");
  attempt.model.assertCompleted();
  return validateAcceptanceScenePlan({ reason: value.reason, segments: attempt.model.segments }, attempt.goal);
}

/** 失败审计只记录条件编号摘要，避免候选计划或页面数据离开本次准备请求。 */
function rejectionFrom(error: unknown): AcceptanceScenePlanRejection {
  const source = error && typeof error === "object" ? error as { message?: unknown } : {};
  return { message: typeof source.message === "string" ? source.message : String(error) };
}

/** 固定韩立验收会话通过工具提交场景；说明文字不进入机器协议，回合外与旧请求都不能写入。 */
export function createAcceptanceSceneSubmission(options: { onRejectedPlan?(rejection: AcceptanceScenePlanRejection): void } = {}) {
  let active: ActiveAcceptanceSceneAttempt | null = null;
  const tools: CodexDynamicToolsPort = {
    definitions: [
      { type: "function", name: "hanli_register_acceptance_scene_segment",
        description: "登记一个验收场景阶段。ownedConditions 唯一占用原条件；relatedCriterionIds 只能关联先前已占用条件完成剩余受控场景。工具返回当前权威模型的剩余状态。",
        inputSchema: stageRegistrationInputSchema },
      { type: "function", name: "hanli_finalize_acceptance_scene",
        description: "仅当所有原条件已登记后完成本轮验收场景计划；程序仍会严格校验夹具和完成态边界。",
        inputSchema: { type: "object", additionalProperties: false, required: ["requestId", "reason"], properties: { requestId: { type: "string" }, reason: { type: "string" } } },
      },
    ],
    async call(name, input) {
      try {
        if ((name !== "hanli_register_acceptance_scene_segment" && name !== "hanli_finalize_acceptance_scene") || !active || !input || typeof input !== "object" || !("requestId" in input) || input.requestId !== active.requestId) throw new Error("不是当前场景准备请求，拒绝提交。");
        if (active.plan) throw new Error("本轮场景已提交，不能覆盖。");
        if (name === "hanli_register_acceptance_scene_segment") {
          const result = registerAcceptanceSceneSegment(input, active);
          active.lastRejection = null;
          return { success: true, contentItems: [{ type: "inputText", text: JSON.stringify(result) }] };
        }
        active.plan = finalizeAcceptanceScenePlan(input, active);
        active.lastRejection = null;
        return { success: true, contentItems: [{ type: "inputText", text: "场景计划已登记；实际就绪由准备器验证，页面结果由韩立验收。" }] };
      } catch (error) {
        const rejection = rejectionFrom(error);
        const message = rejection.message;
        if (active && (name === "hanli_register_acceptance_scene_segment" || name === "hanli_finalize_acceptance_scene") && input && typeof input === "object"
          && "requestId" in input && input.requestId === active.requestId && !active.plan) {
          active.lastRejection = rejection;
          // 审计只保留校验摘要；第二回合会从当前目标创建新的登记会话。
          options.onRejectedPlan?.(rejection);
        }
        return { success: false, contentItems: [{ type: "inputText", text: message }] };
      }
    },
  };
  return {
    tools,
    async run(goal: HanliComputerAcceptanceInDto, model: (requestId: string, attempt: 1 | 2, planningContext: AcceptanceScenePlanningContext) => Promise<unknown>): Promise<AcceptanceScenePlanOutDto> {
      if (active) throw new Error("韩立已有场景准备请求，不能并发覆盖。");
      try {
        const beginAttempt = (): ActiveAcceptanceSceneAttempt => ({ requestId: randomUUID(), goal, model: new AcceptanceScenePlanModel(goal), plan: null, lastRejection: null });
        const firstAttempt = beginAttempt();
        active = firstAttempt;
        await model(firstAttempt.requestId, 1, firstAttempt.model.planningContext());
        if (firstAttempt.plan) return firstAttempt.plan;
        const secondAttempt = beginAttempt();
        active = secondAttempt;
        await model(secondAttempt.requestId, 2, secondAttempt.model.planningContext(firstAttempt.lastRejection?.message));
        if (!secondAttempt.plan) {
          if (secondAttempt.lastRejection) throw new Error(`韩立两次提交的场景计划均未通过校验：${secondAttempt.lastRejection.message}`);
          throw new Error("韩立两次都未通过场景提交工具提交结果；普通说明文字不能代替场景计划。");
        }
        return secondAttempt.plan;
      } finally { active = null; }
    },
  };
}
