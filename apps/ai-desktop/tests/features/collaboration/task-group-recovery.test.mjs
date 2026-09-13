import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 渲染真实恢复组件，验证长回执不挤占首屏且原证据仍能展开。
const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/collaboration/components/TaskGroupRecovery.tsx", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", jsx: "automatic", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { TaskGroupRecovery } = compiled.exports;
const selectorResult = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup/timeline-display.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const selectorCompiled = { exports: {} };
new Function("require", "module", "exports", selectorResult.outputFiles[0].text)(createRequire(import.meta.url), selectorCompiled, selectorCompiled.exports);
const { currentTaskGroupPresentation, latestActiveRecoveryAction } = selectorCompiled.exports;
function render({ reason = "等待重新验证", pending = false, feedback = null, topicId = "topic-a", nodes = [], groupStatus = "blocked", proposalStatus = "blocked", resumeMode = "standard", runStatus = "blocked" } = {}) {
  const group = { topicId: "topic-a", proposalId: "proposal-a", nodes, status: groupStatus };
  const evolution = {
    state: { oneShotRun: { runId: "run-original", topicId, proposalId: "proposal-a", status: runStatus, blockingReason: reason, resumeMode },
      proposals: [{ proposalId: "proposal-a", status: proposalStatus }], automationRuntime: { status: "paused" } },
    resumingRunId: pending ? "run-original" : null, resumeFeedback: feedback,
  };
  return renderToStaticMarkup(createElement(TaskGroupRecovery, { group, evolution, locale: "zh" }));
}

test("千字阻塞回执首屏仅显示摘要，完整证据默认折叠且未丢失", () => {
  const reason = "验收未通过。" + "实际窗口只读，未生成测试任务。".repeat(100) + "证据末尾";
  const html = render({ reason });
  assert.ok(html.match(/<p>(.*?)<\/p>/s)[1].length <= 121);
  assert.match(html, /查看完整原因与证据/);
  assert.match(html, /data-sel-disclosure-content="true" hidden=""/);
  assert.ok(html.includes(`<pre>${reason}</pre>`));
});

test("短阻塞原因无需额外折叠，其他专题不显示此运行恢复信息", () => {
  assert.match(render(), /<p>等待重新验证<\/p>/);
  assert.doesNotMatch(render(), /查看完整原因与证据/);
  assert.equal(render({ topicId: "another-topic" }), "");
});

test("恢复处理中禁用按钮并隐藏旧原因，失败反馈保留警告与完整详情", () => {
  const pending = render({ pending: true });
  assert.match(pending, /disabled=""/);
  assert.match(pending, /正在恢复原任务/);
  assert.doesNotMatch(pending, /等待重新验证/);
  const failure = render({ feedback: { runId: "run-original", error: true, message: "恢复仍受阻。".repeat(100) } });
  assert.match(failure, /role="alert"/);
  assert.match(failure, /查看完整原因与证据/);
  assert.doesNotMatch(failure, /等待重新验证/);
});

test("任务节点已有精确恢复入口时不再显示专题级重复按钮", () => {
  const interrupted = render({ nodes: [{
    taskId: "task-a",
    status: "waiting",
    eventType: "task.interrupted",
  }] });
  assert.equal(interrupted, "");

  const customerAction = render({ nodes: [{
    taskId: "task-a",
    status: "waiting",
    eventType: "customer.action_required",
  }] });
  assert.equal(customerAction, "");
});

test("同一任务出现更新节点后旧等待节点不再压住专题恢复入口", () => {
  const html = render({ nodes: [
    { taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
    { taskId: "task-a", status: "current", eventType: "task.recovery_requested" },
  ] });
  assert.match(html, /从卡点继续/);
});

test("恢复选择器只认同一任务的最新事实", () => {
  assert.deepEqual(latestActiveRecoveryAction([
    { taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
  ]), { taskId: "task-a", customerAction: true });
  assert.equal(latestActiveRecoveryAction([
    { taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
    { taskId: "task-a", status: "current", eventType: "task.recovery_requested" },
  ]), null);
  assert.deepEqual(latestActiveRecoveryAction([
    { taskId: "task-a", status: "waiting", eventType: "task.interrupted" },
  ]), { taskId: "task-a", customerAction: false });
});

test("专题已经恢复运行时不显示旧一次性运行的恢复入口", () => {
  assert.equal(render({ groupStatus: "running" }), "");
  assert.equal(render({ groupStatus: "verifying" }), "");
  assert.equal(render({ groupStatus: "completed" }), "");
});

test("业务已完成时只有正式登记的完成态复核卡点显示恢复入口", () => {
  assert.match(render({ proposalStatus: "completed", resumeMode: "post-completion-review" }), /从卡点继续/);
  assert.equal(render({ proposalStatus: "completed", resumeMode: "standard" }), "");
  assert.equal(render({ pending: true, proposalStatus: "completed", resumeMode: null, runStatus: "running", groupStatus: "completed" }), "");
});

test("审批阶段发生运行卡点时显示真实阻塞状态和恢复入口", () => {
  assert.match(render({ proposalStatus: "pending-approval" }), /从卡点继续/);
  const group = { topicId: "topic-a", proposalId: "proposal-a", status: "waiting-approval" };
  const run = { topicId: "topic-a", proposalId: "proposal-a", status: "blocked", resumeMode: "standard" };
  assert.equal(currentTaskGroupPresentation(group, run).status, "blocked");
});
