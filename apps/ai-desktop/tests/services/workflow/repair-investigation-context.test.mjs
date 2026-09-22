import test from "node:test";
import assert from "node:assert/strict";
import { repairInvestigationContext } from "../../../../../build/ai-desktop/electron/electron/services/support/capabilities/conversation/internal/repair-investigation-context.js";
import { CollaborationTaskAggregate } from "../../../../../build/ai-desktop/electron/electron/services/workflow/domain/collaboration-task.aggregate.js";

test("重复失败上下文保留版本与前轮证据，要求共同根因调查", () => {
  const task = { taskId: "same-task", flowEvents: [
    { type: "unified_test.repair_completed", occurredAt: "first", summary: "修过路径", details: { repairResult: "previous-change" } },
    { type: "unified_test.failed", occurredAt: "second", summary: "仍缺文件", details: { technicalEvidence: ["original-error"] } },
  ], versionWorkspace: { rootPath: "/candidate/task", resultSha: "new-result" }, integrationFailure: { workspaceRoot: "/candidate/release", generation: 14 } };
  const text = repairInvestigationContext(task, "darwin");
  for (const expected of ["darwin", "same-task", "new-result", "/candidate/release", "previous-change", "original-error", "共同根因", "共同根因分组", "同一修复计划", "重构", "相邻回归", "运行应用携带的候选 SHA", "Git ancestry", "带时区的绝对时间", "持久化事实", "窗口 API DTO", "真实页面 DOM", "自动降级为待证伪假设"]) assert.ok(text.includes(expected), expected);
  assert.equal(task.flowEvents.length, 2);
});

test("令狐调查提示禁止用墙上钟点和源码存在性替代真实运行证据", () => {
  const context = repairInvestigationContext({ taskId: "runtime-proof", flowEvents: [] }, "darwin");
  assert.match(context, /禁止用不同时区的墙上钟点/);
  assert.match(context, /不能凭源码存在组件或测试通过认定页面已经具备能力/);
  assert.match(context, /第一个丢失或变形的边界/);
});

test("令狐接手时包含原执行人的自测与自修证据", () => {
  const task = { taskId: "handoff", flowEvents: [
    { type: "executor.self_test_failed", occurredAt: "first", summary: "首次交互失败" },
    { type: "executor.self_repair_completed", occurredAt: "second", summary: "补了设置浮层" },
    { type: "executor.self_test_failed", occurredAt: "third", summary: "同一路径再次失败" },
  ] };
  const context = repairInvestigationContext(task, "darwin");
  assert.match(context, /首次交互失败/);
  assert.match(context, /补了设置浮层/);
  assert.match(context, /同一路径再次失败/);
  assert.match(context, /已完成修复轮次：1/);
  assert.match(context, /共同根因/);
});

test("阶段心跳属于当前令狐而非原执行人", () => {
  const task = { taskId: "task", executorMemberId: "song-yu", currentHandler: { memberId: "linghu-ancestor" } };
  const members = [
    { memberId: "song-yu", currentTaskId: null, state: "idle" },
    { memberId: "linghu-ancestor", currentTaskId: "task", state: "working", lastProtocolProgressAt: "now" },
  ];
  assert.equal(new CollaborationTaskAggregate({ task }).activeOwner(members).lastProtocolProgressAt, "now");
  members[1].currentTaskId = "other-task";
  assert.equal(new CollaborationTaskAggregate({ task }).activeOwner(members), undefined);
});

test("统一测试发布和等待不复用原执行人超时", () => {
  for (const state of ["unified-testing", "integrating", "awaiting-restart", "recovering", "ready-for-integration"]) {
    assert.equal(new CollaborationTaskAggregate({ task: { state } }).requiresExecutionHeartbeat(), false, state);
  }
  for (const state of ["analyzing", "executing", "repairing-execution"]) {
    assert.equal(new CollaborationTaskAggregate({ task: { state } }).requiresExecutionHeartbeat(), true, state);
  }
});
