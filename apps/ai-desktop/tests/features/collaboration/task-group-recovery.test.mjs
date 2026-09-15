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
const { TaskGroupRecovery, canResumeOneShotForGroup } = compiled.exports;
const selectorResult = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup/timeline-display.ts", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", write: false,
});
const selectorCompiled = { exports: {} };
new Function("require", "module", "exports", selectorResult.outputFiles[0].text)(createRequire(import.meta.url), selectorCompiled, selectorCompiled.exports);
const { currentTaskGroupPresentation, latestActiveRecoveryAction, taskGroupPrimaryPresentation } = selectorCompiled.exports;

function primaryPresentation({ status = "running", recoveryAction = null, oneShotRecoveryRequired = false } = {}) {
  return taskGroupPrimaryPresentation({
    summary: "令狐老祖正在处理验证结果。",
    status,
    nodes: [],
    nextOwner: { displayName: "令狐老祖" },
    nextStep: "完成后会同步结果。",
  }, "zh", recoveryAction, oneShotRecoveryRequired);
}
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

test("任务恢复中节点不让专题级入口重复显示", () => {
  const html = render({ nodes: [
    { taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
    { taskId: "task-a", status: "current", eventType: "task.recovery_requested" },
  ] });
  assert.equal(html, "");
});

test("恢复选择器将当前恢复请求投影为禁用入口，后续事实才会清除入口", () => {
  assert.deepEqual(latestActiveRecoveryAction([
    { nodeId: "customer-wait", taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
  ]), { nodeId: "customer-wait", taskId: "task-a", customerAction: true, pending: false, submitted: false });
  assert.deepEqual(latestActiveRecoveryAction([
    { nodeId: "customer-wait", taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
    { nodeId: "recovery-running", taskId: "task-a", status: "current", eventType: "task.recovery_requested" },
  ]), { nodeId: "recovery-running", taskId: "task-a", customerAction: false, pending: false, submitted: true });
  assert.equal(latestActiveRecoveryAction([
    { nodeId: "customer-wait", taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
    { nodeId: "recovery-completed", taskId: "task-a", status: "completed", eventType: "task.recovery_requested" },
  ]), null);
  assert.deepEqual(latestActiveRecoveryAction([
    { nodeId: "interrupted-wait", taskId: "task-a", status: "waiting", eventType: "task.interrupted" },
  ]), { nodeId: "interrupted-wait", taskId: "task-a", customerAction: false, pending: false, submitted: false });
  assert.deepEqual(latestActiveRecoveryAction([
    { nodeId: "history-wait", taskId: "task-a", status: "waiting", eventType: "customer.action_required" },
    { nodeId: "current-wait", taskId: "task-a", status: "waiting", eventType: "task.interrupted" },
  ]), { nodeId: "current-wait", taskId: "task-a", customerAction: false, pending: false, submitted: false });
});

test("自动处理明确告知用户暂不需要操作，客户待办保持原有提示", () => {
  assert.equal(primaryPresentation().customerAction, "正在自动处理中，暂不需要你操作。");
  assert.equal(primaryPresentation({ status: "verifying" }).customerAction, "正在自动处理中，暂不需要你操作。");
  assert.equal(primaryPresentation({ status: "completed" }).customerAction, "当前无需你操作。");
  assert.equal(primaryPresentation({
    status: "blocked",
    recoveryAction: { taskId: "task-a", customerAction: true, pending: false },
  }).customerAction, "需要你完成一项操作。");
  const pendingRecovery = primaryPresentation({
    recoveryAction: { taskId: "task-a", customerAction: false, pending: true },
  });
  assert.equal(pendingRecovery.customerAction, "正在恢复中，请勿重复操作。");
  assert.equal(pendingRecovery.nextAction, "等待当前恢复处理完成。");
  const oneShot = primaryPresentation({ status: "blocked", oneShotRecoveryRequired: true });
  assert.equal(oneShot.customerAction, "需要你完成一项操作。");
  assert.equal(oneShot.nextAction, "查看卡点原因后点击“从卡点继续”。");
});

test("专题已经恢复运行时不显示旧一次性运行的恢复入口", () => {
  assert.equal(render({ groupStatus: "running" }), "");
  assert.equal(render({ groupStatus: "verifying" }), "");
  assert.equal(render({ groupStatus: "completed" }), "");
});

test("业务已完成时不再显示二次复核恢复入口", () => {
  assert.equal(render({ proposalStatus: "completed", resumeMode: "standard" }), "");
  assert.equal(render({ pending: true, proposalStatus: "completed", resumeMode: null, runStatus: "running", groupStatus: "completed" }), "");
});

test("审批阶段发生运行卡点时显示真实阻塞状态和恢复入口", () => {
  assert.match(render({ proposalStatus: "pending-approval" }), /从卡点继续/);
  const group = { topicId: "topic-a", proposalId: "proposal-a", status: "waiting-approval" };
  const run = { topicId: "topic-a", proposalId: "proposal-a", status: "blocked", resumeMode: "standard" };
  const presented = currentTaskGroupPresentation(group, run);
  assert.equal(presented.status, "blocked");
  assert.equal(canResumeOneShotForGroup(presented, {
    oneShotRun: run,
    proposals: [{ proposalId: "proposal-a", status: "pending-approval" }],
    automationRuntime: { status: "running" },
  }), true);
});
