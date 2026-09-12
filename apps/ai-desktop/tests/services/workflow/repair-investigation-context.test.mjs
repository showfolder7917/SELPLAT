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
  for (const expected of ["darwin", "same-task", "new-result", "/candidate/release", "previous-change", "original-error", "共同根因", "重构", "相邻回归"]) assert.ok(text.includes(expected), expected);
  assert.equal(task.flowEvents.length, 2);
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
