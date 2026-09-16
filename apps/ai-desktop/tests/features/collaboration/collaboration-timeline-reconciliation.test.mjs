import assert from "node:assert/strict";
import { transform } from "esbuild";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../src/features/collaboration/model/reconcileCollaborationTimeline.ts", import.meta.url), "utf8");
const compiled = await transform(source, {
  loader: "ts",
  format: "esm",
  target: "node22",
});
const { reconcileCollaborationTimeline, reconcileInitialCollaborationTimeline } = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`);

const participant = { memberId: "zi-ling", displayName: "紫灵" };
const node = (overrides = {}) => ({
  nodeId: "node-1", taskId: "task-1", eventType: "execution.started", kind: "execution",
  actor: participant, recipients: [], status: "current", action: "正在修改", summary: "处理中",
  contentRole: "execution-output", content: "内容", detailRole: "changed-files", detail: "",
  startedAt: "2026-09-14T00:00:00.000Z", completedAt: null, durationMs: 1000,
  automaticOpen: false, manualApprovalProposalId: null, ...overrides,
});
const group = (nodes, overrides = {}) => ({
  groupId: "group-1", topicId: "topic-1", proposalId: "proposal-1", title: "性能检查",
  status: "running", summary: "处理中", nodes, executingCount: 1, verifyingCount: 0,
  waitingCount: 0, completedCount: 0, startedAt: "2026-09-14T00:00:00.000Z",
  updatedAt: "2026-09-14T00:00:01.000Z", durationMs: 1000, nextStep: "继续执行",
  failureNextStep: null, nextOwner: participant, ...overrides,
});
const snapshot = (groups, updatedAt = "2026-09-14T00:00:01.000Z") => ({ version: 1, groups, updatedAt });

test("只增长运行耗时时复用完整时间线对象", () => {
  const previous = snapshot([group([node()])]);
  const incoming = snapshot([group([node({ durationMs: 9000 })], { durationMs: 9000 })]);
  const result = reconcileCollaborationTimeline(previous, incoming);
  assert.equal(result, previous);
  assert.equal(result.groups[0].nodes[0], previous.groups[0].nodes[0]);
});

test("当前节点改变时只替换该节点并保留历史节点", () => {
  const history = node({ nodeId: "node-history", status: "completed", completedAt: "2026-09-14T00:00:01.000Z" });
  const current = node();
  const previous = snapshot([group([history, current])]);
  const incoming = snapshot([
    group([
      { ...history, actor: { ...participant }, recipients: [] },
      node({ content: "新内容", durationMs: 2000 }),
    ], { updatedAt: "2026-09-14T00:00:02.000Z", durationMs: 2000 }),
  ], "2026-09-14T00:00:02.000Z");
  const result = reconcileCollaborationTimeline(previous, incoming);
  assert.notEqual(result, previous);
  assert.equal(result.groups[0].nodes[0], history);
  assert.notEqual(result.groups[0].nodes[1], current);
  assert.equal(result.groups[0].nodes[1].content, "新内容");
});

test("已完成节点耗时变化会替换节点", () => {
  const completed = node({ status: "completed", completedAt: "2026-09-14T00:00:01.000Z", durationMs: 1000 });
  const previous = snapshot([group([completed], { status: "completed", executingCount: 0, completedCount: 1 })]);
  const incoming = snapshot([group([{ ...completed, durationMs: 2000 }], { status: "completed", executingCount: 0, completedCount: 1 })]);
  const result = reconcileCollaborationTimeline(previous, incoming);
  assert.notEqual(result.groups[0].nodes[0], completed);
});

test("旧快照未保存下一负责人时可以安全合并", () => {
  const previous = snapshot([group([node()])]);
  const incoming = structuredClone(previous);
  delete previous.groups[0].nextOwner;
  incoming.groups[0].nextOwner = null;

  assert.equal(reconcileCollaborationTimeline(previous, incoming), previous);
});

test("迟到的启动快照不会覆盖读取期间已更新的专题", () => {
  const freshGroup = group([node({ content: "已收到新的专题状态" })], { groupId: "group-fresh", topicId: "topic-fresh", title: "新专题" });
  const previous = snapshot([freshGroup], "2026-09-14T00:00:02.000Z");
  const staleInitialSnapshot = snapshot([], "2026-09-14T00:00:01.000Z");

  const result = reconcileInitialCollaborationTimeline(previous, staleInitialSnapshot, new Set(["group-fresh"]));

  assert.deepEqual(result.groups, [freshGroup]);
});
