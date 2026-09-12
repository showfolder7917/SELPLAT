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

test("独立空状态验收会话只遮蔽登记窗口的任务投影并拒绝写入", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(42);
  const isolated = session.collaborationState(42, collaborationState);
  assert.equal(session.isActive(42), true);
  assert.equal(isolated.mode, "collaboration");
  assert.equal(isolated.selectedMemberId, "han-li");
  assert.deepEqual(isolated.tasks, []);
  assert.deepEqual(isolated.integrationBatches, []);
  assert.deepEqual(session.timeline().groups, []);
  assert.equal(session.evolutionState({ topics: ["formal"], proposals: ["formal"], deliberations: ["formal"], archiveRecords: ["formal"] }).activeTopicId, null);
  assert.throws(() => session.rejectMutation(), /只读/);
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
  const sceneSource = readFileSync("electron/system/ipc/acceptance-scene-window.ts", "utf8");
  assert.match(desktopIpcSource, /linghuAutomation\.planAcceptanceScene\(goal\)/);
  assert.doesNotMatch(desktopIpcSource, /requiresEmptyTaskGroup/);
  assert.match(desktopIpcSource, /prepareAcceptanceSceneWindow/);
  assert.match(sceneSource, /--hanli-empty-task-group-acceptance/);
  assert.match(sceneSource, /failure-recovery-timeline/);
  assert.match(desktopIpcSource, /acceptanceEmptyTaskGroupSession: AcceptanceEmptyTaskGroupSession/);
  assert.match(collaborationIpcSource, /rejectIsolatedMutation/);
  assert.match(runtimeSource, /const acceptanceEmptyTaskGroupSession = new AcceptanceEmptyTaskGroupSession\(\)/);
  assert.match(runtimeSource, /acceptanceEmptyTaskGroupSession\.isActive\(window\.webContents\.id\)/);
  assert.match(runtimeSource, /acceptanceEmptyTaskGroupSession\.collaborationState\(window\.webContents\.id, state\)/);
  assert.match(runtimeSource, /taskIds: isolated \? \[\] : taskIds/);
  assert.match(source, /独立验收会话为只读/);
  assert.match(source, /tasks: \[\]/);
  assert.match(source, /失败原因：candidate\.txt:1: trailing whitespace/);
  assert.match(preloadSource, /readOnlyAcceptanceWindow/);
  assert.match(preloadSource, /sendPersonaConversationMessage/);
  assert.match(preloadSource, /独立空状态验收窗口为只读/);
});


test("失败恢复验收场景只投影完整历史事实和只读恢复入口", () => {
  const session = new AcceptanceEmptyTaskGroupSession();
  session.register(43, "failure-recovery-timeline");
  const [group] = session.timeline(43).groups;
  assert.equal(group.status, "blocked");
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
