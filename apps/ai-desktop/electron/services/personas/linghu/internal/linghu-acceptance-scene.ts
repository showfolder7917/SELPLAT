import { randomUUID } from "node:crypto";
import type { CodexDynamicToolsPort } from "../../../support/platform/codex/index.js";
import type { AcceptanceScenePlanOutDto, HanliComputerAcceptanceInDto } from "../../../../../contracts/services/personas/hanli/index.js";

/** 验证令狐的结构化准备计划，任何缺项都退回环境排障，不默认为当前窗口。 */
export function validateAcceptanceScenePlan(input: unknown, goal: HanliComputerAcceptanceInDto): AcceptanceScenePlanOutDto {
  const value = input as AcceptanceScenePlanOutDto;
  if (!value || !["current-window", "empty-task-group", "failure-recovery-timeline", "blocked"].includes(value.kind)
    || typeof value.reason !== "string" || !value.reason.trim()
    || typeof value.completionReviewRequired !== "boolean" || !Array.isArray(value.conditions)) {
    throw new Error("令狐未提交有效的验收场景计划。");
  }
  const expectedIds = goal.criteria.map((_, index) => `criterion-${index + 1}`);
  const ids = value.conditions.map((condition) => condition?.criterionId);
  if (ids.length !== expectedIds.length || new Set(ids).size !== ids.length
    || expectedIds.some((id) => !ids.includes(id))
    || value.conditions.some((condition) => typeof condition?.prerequisite !== "string" || !condition.prerequisite.trim())) {
    throw new Error("令狐验收场景计划未逐项覆盖原验收条件。");
  }
  if (value.kind === "current-window" && !hasVerifiedCurrentWindowContext(goal)) {
    throw new Error("当前窗口场景缺少与验收目标一致的只读专题、提案或运行记录，不能把模型推测当作页面事实。");
  }
  if (value.completionReviewRequired && value.kind !== "current-window") {
    throw new Error("跨完成态复核只能使用当前真实窗口，隔离或受阻场景不能触发业务完成动作。");
  }
  return {
    kind: value.kind,
    reason: value.reason.trim(),
    completionReviewRequired: value.completionReviewRequired,
    conditions: value.conditions.map(({ criterionId, prerequisite }) => ({ criterionId, prerequisite: prerequisite.trim() })),
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

/** 固定令狐会话通过工具提交场景；说明文字不进入机器协议，回合外与旧请求都不能写入。 */
export function createAcceptanceSceneSubmission() {
  let active: { requestId: string; goal: HanliComputerAcceptanceInDto; plan: AcceptanceScenePlanOutDto | null } | null = null;
  const tools: CodexDynamicToolsPort = {
    definitions: [{ type: "function", name: "linghu_submit_acceptance_scene",
      description: "提交本轮逐项验收场景计划。必须填写当前请求编号；说明文字不能替代此提交。工具只记录计划，不修改页面或原任务数据。",
      inputSchema: { type: "object", additionalProperties: false, required: ["requestId", "kind", "reason", "completionReviewRequired", "conditions"], properties: {
        requestId: { type: "string" }, kind: { type: "string", enum: ["current-window", "empty-task-group", "failure-recovery-timeline", "blocked"] }, reason: { type: "string" },
        completionReviewRequired: { type: "boolean" },
        conditions: { type: "array", items: { type: "object", additionalProperties: false, required: ["criterionId", "prerequisite"], properties: { criterionId: { type: "string" }, prerequisite: { type: "string" } } } },
      } },
    }],
    async call(name, input) {
      try {
        if (name !== "linghu_submit_acceptance_scene" || !active || !input || typeof input !== "object" || !("requestId" in input) || input.requestId !== active.requestId) throw new Error("不是当前场景准备请求，拒绝提交。");
        if (active.plan) throw new Error("本轮场景已提交，不能覆盖。");
        active.plan = validateAcceptanceScenePlan(input, active.goal);
        return { success: true, contentItems: [{ type: "inputText", text: "场景计划已登记；实际就绪由准备器验证，页面结果由韩立验收。" }] };
      } catch (error) {
        return { success: false, contentItems: [{ type: "inputText", text: error instanceof Error ? error.message : String(error) }] };
      }
    },
  };
  return {
    tools,
    async run(goal: HanliComputerAcceptanceInDto, model: (requestId: string) => Promise<unknown>): Promise<AcceptanceScenePlanOutDto> {
      if (active) throw new Error("令狐已有场景准备请求，不能并发覆盖。");
      const request = { requestId: randomUUID(), goal, plan: null as AcceptanceScenePlanOutDto | null };
      active = request;
      try {
        await model(request.requestId);
        if (!request.plan) throw new Error("令狐未通过场景提交工具提交结果；普通说明文字不能代替场景计划。");
        return request.plan;
      } finally { active = null; }
    },
  };
}
