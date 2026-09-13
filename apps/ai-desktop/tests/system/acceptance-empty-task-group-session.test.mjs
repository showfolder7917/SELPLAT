import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transform } from "esbuild";

const source = readFileSync("electron/system/ipc/acceptance-empty-task-group-session.ts", "utf8");
const transformed = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { AcceptanceEmptyTaskGroupSession } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

const collaborationState = {
  version: 1,
  mode: "collaboration",
  selectedMemberId: "nangong-wan",
  members: [{ memberId: "han-li" }, { memberId: "nangong-wan" }],
  tasks: [{ taskId: "formal-task" }],
  integrationBatches: [{ batchId: "formal-batch" }],
  nextIntegrationGeneration: 2,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("独立空状态验收会话遮蔽正式任务并只允许窗口私有人物消息", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(42);
  const isolated = session.collaborationState(42, collaborationState);
  assert.equal(session.isActive(42), true);
  assert.doesNotThrow(() => session.assertIpcAllowed(42, "desktop:get-collaboration-state"));
  assert.doesNotThrow(() => session.assertIpcAllowed(42, "desktop:send-persona-conversation-message"));
  assert.throws(() => session.assertIpcAllowed(42, "desktop:submit-collaboration-task"), /持久状态/);
  assert.doesNotThrow(() => session.assertIpcAllowed(999, "desktop:submit-collaboration-task"), "正式窗口不受验收策略影响");
  assert.equal(isolated.mode, "collaboration");
  assert.equal(isolated.selectedMemberId, "han-li");
  assert.deepEqual(isolated.tasks, []);
  assert.deepEqual(isolated.integrationBatches, []);
  assert.deepEqual(session.timeline().groups, []);
  assert.equal(session.evolutionState({ topics: ["formal"], proposals: ["formal"], deliberations: ["formal"], archiveRecords: ["formal"] }).activeTopicId, null);
  assert.throws(() => session.rejectMutation(), /只读/);
  const sent = session.sendPersonaConversationMessage(42, "han-li", {
    clientMessageId: "empty-scene-message",
    message: "空状态入口验收",
    attachmentIds: [],
    workspaceState: { roots: [], primaryId: null },
    locale: "zh-CN",
  });
  assert.equal(sent.messages.at(-2).content, "空状态入口验收");
  assert.equal(session.timeline(42).groups.length, 0, "窗口私有消息不能创建或改变正式任务投影");
  assert.deepEqual(session.selectMember(42, "nangong-wan", collaborationState).tasks, []);
  const singleConversation = session.setMode(42, "single-conversation", collaborationState);
  assert.equal(singleConversation.mode, "single-conversation");
  assert.equal(collaborationState.mode, "collaboration", "验收导航不能修改正式协作状态");
  session.remove(42);
  assert.equal(session.isActive(42), false);
});

test("空状态条件只创建非持久化验收窗口，并在验收后关闭", () => {
  const desktopIpcSource = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
  const collaborationIpcSource = readFileSync("electron/system/ipc/domains/register-collaboration-ipc.ts", "utf8");
  const runtimeSource = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  const preloadSource = readFileSync("electron/system/preload/preload.cts", "utf8");
  const eventCenterIpcSource = readFileSync("electron/system/ipc/event-center-ipc.ts", "utf8");
  const sceneSource = readFileSync("electron/system/ipc/acceptance-scene-window.ts", "utf8");
  const sceneSessionSource = readFileSync("electron/system/ipc/hanli-acceptance-scene-session.ts", "utf8");
  assert.match(desktopIpcSource, /planAcceptanceScene\(goal\)/);
  assert.doesNotMatch(desktopIpcSource, /requiresEmptyTaskGroup/);
  assert.match(desktopIpcSource, /runHanliAcceptanceSceneSession/);
  assert.match(sceneSessionSource, /prepareAcceptanceSceneWindow/);
  assert.match(sceneSource, /--hanli-empty-task-group-acceptance/);
  assert.match(sceneSource, /failure-recovery-timeline/);
  assert.match(sceneSource, /user-language-detail-timeline/);
  assert.match(desktopIpcSource, /acceptanceEmptyTaskGroupSession: AcceptanceEmptyTaskGroupSession/);
  assert.match(collaborationIpcSource, /rejectIsolatedMutation/);
  assert.match(collaborationIpcSource, /continueRecoveryLifecycle[\s\S]*collaborationState\(event\.sender\.id, collaboration\.state\(\)\)[\s\S]*collaboration-timeline-changed[\s\S]*return isolated/);
  assert.doesNotMatch(collaborationIpcSource, /continueRecoveryLifecycle[\s\S]*return timeline/);
  assert.match(runtimeSource, /const acceptanceEmptyTaskGroupSession = new AcceptanceEmptyTaskGroupSession\(\)/);
  assert.match(runtimeSource, /acceptanceEmptyTaskGroupSession\.isActive\(window\.webContents\.id\)/);
  assert.match(runtimeSource, /acceptanceEmptyTaskGroupSession\.collaborationState\(window\.webContents\.id, state\)/);
  assert.match(runtimeSource, /taskIds: isolated \? \[\] : taskIds/);
  assert.match(source, /独立验收会话为只读/);
  assert.match(source, /tasks: \[\]/);
  assert.match(source, /失败原因：candidate\.txt:1: trailing whitespace/);
  assert.doesNotMatch(preloadSource, /readOnlyAcceptanceWindow|acceptanceMutationNames|isolatedAcceptanceBridge/);
  assert.match(preloadSource, /主进程持有可信 webContents/);
  assert.match(eventCenterIpcSource, /desktopIpcAuthorizationPolicy\(event, channel\)/);
  assert.match(desktopIpcSource, /installDesktopIpcAuthorizationPolicy/);
});


test("失败恢复验收场景只投影完整历史事实和只读恢复入口", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(43, "failure-recovery-timeline");
  const [group] = session.timeline(43).groups;
  assert.equal(group.status, "blocked");
  assert.equal(group.nextStep, "令狐老祖 · 等待恢复操作");
  assert.doesNotMatch(group.nextStep, /失败原因|调查：|修复：|测试：/);
  assert.equal(group.nodes.length, 3);
  assert.match(group.nodes[0].detail, /失败原因/);
  assert.match(group.nodes[1].detail, /调查：/);
  assert.match(group.nodes[1].detail, /修复：/);
  assert.match(group.nodes[1].detail, /测试：/);
  assert.equal(group.nodes[2].eventType, "task.interrupted");
  assert.equal(group.nodes[2].status, "waiting");
  assert.match(group.nodes[2].detail, /恢复标识/);
  assert.throws(() => session.rejectMutation(), /只读/);
});

test("巡检生命周期验收场景在同一专题保留三类只读记录", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(44, "inspection-lifecycle-timeline");
  const [group] = session.timeline(44).groups;
  assert.equal(group.title, "巡检记录与任务卡分层验收场景");
  assert.equal(group.nextStep, "韩立 · 确认恢复条件");
  assert.deepEqual(group.nodes.map((node) => node.action), ["完成例行巡检", "自动恢复已完成", "等待用户确认恢复条件"]);
  assert.match(group.nodes[0].detail, /无需创建恢复或等待节点/);
  assert.match(group.nodes[1].detail, /已自动重新建立连接/);
  assert.equal(group.nodes[2].eventType, "customer.action_required");
  assert.match(group.nodes[2].detail, /确认范围后可继续执行/);
  assert.throws(() => session.rejectMutation(), /只读/);
});

test("用户语言与技术详情场景分开保留客户待办和自动处理事实", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(45, "user-language-detail-timeline");
  const [group, automaticGroup] = session.timeline(45).groups;
  assert.equal(group.title, "任务卡用户语言与技术详情分层验收场景");
  assert.equal(group.nextStep, "韩立 · 确认恢复条件");
  assert.equal(group.nodes[0].action, "第1次自测未通过");
  assert.match(group.nodes[0].detail, /测试日志/);
  assert.match(group.nodes[1].detail, /完整操作清单/);
  assert.equal(group.nodes[2].eventType, "customer.action_required");
  assert.match(group.nodes[2].detail, /确认范围后可继续执行/);
  assert.equal(automaticGroup.status, "running");
  assert.equal(automaticGroup.nodes[0].status, "current");
  assert.equal(automaticGroup.nodes[0].summary, "正在自动处理中，暂不需要你操作。");
  assert.throws(() => session.rejectMutation(), /只读/);
});

test("恢复入口生命周期场景只在内存中收口当前等待并投影自动恢复", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(46, "recovery-action-lifecycle");
  const [before] = session.timeline(46).groups;
  assert.deepEqual(before.nodes.map((node) => [node.nodeId, node.status]), [
    ["acceptance:recovery-history", "completed"],
    ["acceptance:recovery-current", "waiting"],
  ]);
  const after = session.continueRecoveryLifecycle(46, "acceptance-failure-recovery-task");
  assert.deepEqual(after.groups[0].nodes.map((node) => [node.nodeId, node.status]), [
    ["acceptance:recovery-history", "completed"],
    ["acceptance:recovery-current", "completed"],
    ["acceptance:recovery-started", "current"],
  ]);
  assert.throws(() => session.continueRecoveryLifecycle(46, "acceptance-failure-recovery-task"), /不能重复继续/);
  assert.throws(() => session.continueRecoveryLifecycle(46, "formal-task"), /不允许继续此任务/);
  assert.throws(() => session.rejectMutation(), /只读/);
});
