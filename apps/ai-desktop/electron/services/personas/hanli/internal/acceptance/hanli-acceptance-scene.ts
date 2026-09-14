import { randomUUID } from "node:crypto";
import type { CodexDynamicToolsPort } from "../../../../support/platform/codex/index.js";
import type { AcceptanceSceneKind, AcceptanceScenePlanOutDto, AcceptanceSceneSegmentOutDto, HanliComputerAcceptanceInDto } from "../../../../../../contracts/services/personas/hanli/index.js";

const sceneKinds: AcceptanceSceneKind[] = ["current-window", "workspace-explorer-fixture", "workspace-lifecycle-review", "empty-task-group", "completed-recovery-timeline", "inspection-lifecycle-timeline", "user-language-detail-timeline", "recovery-action-lifecycle", "persona-conversation-lifecycle", "persona-conversation-with-task-handoff", "cross-task-member-occupancy", "member-idle", "collaboration-state-syncing", "collaboration-state-unavailable", "blocked"];

/** 验证韩立的结构化准备计划，任何缺项都退回环境排障，不默认为当前窗口。 */
export function validateAcceptanceScenePlan(input: unknown, goal: HanliComputerAcceptanceInDto): AcceptanceScenePlanOutDto {
  const value = input as AcceptanceScenePlanOutDto;
  if (!value || typeof value.reason !== "string" || !value.reason.trim()
    || !Array.isArray(value.segments) || value.segments.length === 0) {
    throw new Error("韩立未提交有效的验收场景计划。");
  }
  const expectedIds = goal.criteria.map((_, index) => `criterion-${index + 1}`);
  const segments = value.segments as AcceptanceSceneSegmentOutDto[];
  const ids = segments.flatMap((segment) => Array.isArray(segment?.conditions)
    ? segment.conditions.map((condition) => condition?.criterionId)
    : []);
  if (ids.length !== expectedIds.length || new Set(ids).size !== ids.length
    || expectedIds.some((id) => !ids.includes(id))
    || segments.some((segment) => !segment || !sceneKinds.includes(segment.kind)
      || typeof segment.reason !== "string" || !segment.reason.trim()
      || typeof segment.completionReviewRequired !== "boolean"
      || !Array.isArray(segment.conditions) || segment.conditions.length === 0
      || segment.conditions.some((condition) => typeof condition?.prerequisite !== "string" || !condition.prerequisite.trim()))) {
    throw new Error("韩立验收场景计划未逐项覆盖原验收条件。");
  }
  if (segments.some((segment) => segment.kind === "current-window" || segment.kind === "workspace-explorer-fixture" || segment.kind === "workspace-lifecycle-review") && !hasVerifiedCurrentWindowContext(goal)) {
    throw new Error("当前窗口场景缺少与验收目标一致的只读专题、提案或运行记录，不能把模型推测当作页面事实。");
  }
  if (segments.some((segment) => segment.kind === "workspace-explorer-fixture") && !goal.workspaceAcceptanceFixture) {
    throw new Error("工作区验收场景缺少已签发的受控夹具，不能把普通目录当作加载、失败或空目录证据。");
  }
  if (goal.workspaceAcceptanceFixture
    && !segments.some((segment) => segment.kind === "workspace-explorer-fixture")) {
    throw new Error("本轮已经签发工作区验收夹具，场景计划必须包含一个工作区夹具阶段；不能只观察普通工作区后报告临时根缺失。");
  }
  if (segments.filter((segment) => segment.kind === "workspace-explorer-fixture").length > 1) {
    throw new Error("一次性工作区夹具只能使用一个验收阶段，相关条件必须合并取证。");
  }
  if (segments.some((segment) => segment.kind === "cross-task-member-occupancy") && !goal.crossTaskMemberOccupancyFixture) {
    throw new Error("跨任务人物占用场景缺少主进程签发的受控夹具。");
  }
  if (goal.crossTaskMemberOccupancyFixture && !segments.some((segment) => segment.kind === "cross-task-member-occupancy")) {
    throw new Error("本轮已经签发跨任务人物占用夹具，场景计划必须使用该夹具阶段。");
  }
  if (segments.filter((segment) => segment.kind === "cross-task-member-occupancy").length > 1) {
    throw new Error("跨任务人物占用夹具只能使用一个验收阶段。");
  }
  if (segments.some((segment) => segment.kind === "member-idle") && !goal.memberIdleFixture) {
    throw new Error("人物空闲场景缺少主进程签发的受控夹具。");
  }
  if (goal.memberIdleFixture && !segments.some((segment) => segment.kind === "member-idle")) {
    throw new Error("本轮已经签发人物空闲夹具，场景计划必须使用该夹具阶段。");
  }
  if (segments.filter((segment) => segment.kind === "member-idle").length > 1) {
    throw new Error("人物空闲夹具只能使用一个验收阶段。");
  }
  const usesStateProjection = segments.some((segment) => segment.kind === "collaboration-state-syncing" || segment.kind === "collaboration-state-unavailable");
  if (usesStateProjection && !goal.collaborationStateProjectionFixture) {
    throw new Error("协作状态验收场景缺少主进程签发的受控夹具。");
  }
  if (goal.collaborationStateProjectionFixture && !usesStateProjection) {
    throw new Error("本轮已经签发协作状态夹具，场景计划必须覆盖同步中或状态暂未更新。 ");
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
      conditions: segment.conditions.map(({ criterionId, prerequisite }) => ({ criterionId, prerequisite: prerequisite.trim() })),
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

/** 固定韩立验收会话通过工具提交场景；说明文字不进入机器协议，回合外与旧请求都不能写入。 */
export function createAcceptanceSceneSubmission() {
  let active: {
    requestId: string;
    goal: HanliComputerAcceptanceInDto;
    plan: AcceptanceScenePlanOutDto | null;
    lastRejection: string | null;
  } | null = null;
  const tools: CodexDynamicToolsPort = {
    definitions: [{ type: "function", name: "hanli_submit_acceptance_scene",
      description: "提交本轮逐项验收场景计划。必须填写当前请求编号；说明文字不能替代此提交。工具只记录计划，不修改页面或原任务数据。",
      inputSchema: { type: "object", additionalProperties: false, required: ["requestId", "reason", "segments"], properties: {
        requestId: { type: "string" }, reason: { type: "string" },
        segments: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["kind", "reason", "completionReviewRequired", "conditions"], properties: {
          kind: { type: "string", enum: sceneKinds }, reason: { type: "string" }, completionReviewRequired: { type: "boolean" },
          conditions: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["criterionId", "prerequisite"], properties: { criterionId: { type: "string" }, prerequisite: { type: "string" } } } },
        } } },
      } },
    }],
    async call(name, input) {
      try {
        if (name !== "hanli_submit_acceptance_scene" || !active || !input || typeof input !== "object" || !("requestId" in input) || input.requestId !== active.requestId) throw new Error("不是当前场景准备请求，拒绝提交。");
        if (active.plan) throw new Error("本轮场景已提交，不能覆盖。");
        active.plan = validateAcceptanceScenePlan(input, active.goal);
        active.lastRejection = null;
        return { success: true, contentItems: [{ type: "inputText", text: "场景计划已登记；实际就绪由准备器验证，页面结果由韩立验收。" }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (active && name === "hanli_submit_acceptance_scene" && input && typeof input === "object"
          && "requestId" in input && input.requestId === active.requestId && !active.plan) {
          active.lastRejection = message;
        }
        return { success: false, contentItems: [{ type: "inputText", text: message }] };
      }
    },
  };
  return {
    tools,
    async run(goal: HanliComputerAcceptanceInDto, model: (requestId: string, attempt: 1 | 2, previousRejection: string | null) => Promise<unknown>): Promise<AcceptanceScenePlanOutDto> {
      if (active) throw new Error("韩立已有场景准备请求，不能并发覆盖。");
      const request = { requestId: randomUUID(), goal, plan: null as AcceptanceScenePlanOutDto | null, lastRejection: null as string | null };
      active = request;
      try {
        // 模型只输出说明文字属于可纠正的格式遗漏；原请求保持活动并限重试一次，避免把同一验收重新走完整修复发布链。
        await model(request.requestId, 1, null);
        if (!request.plan) await model(request.requestId, 2, request.lastRejection);
        if (!request.plan) {
          if (request.lastRejection) throw new Error(`韩立两次提交的场景计划均未通过校验：${request.lastRejection}`);
          throw new Error("韩立两次都未通过场景提交工具提交结果；普通说明文字不能代替场景计划。");
        }
        return request.plan;
      } finally { active = null; }
    },
  };
}
