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
  assert.equal(isolated.selectedMemberId, "han-li");
  assert.deepEqual(isolated.tasks, []);
  assert.deepEqual(isolated.integrationBatches, []);
  assert.deepEqual(session.timeline().groups, []);
  assert.equal(session.evolutionState({ topics: ["formal"], proposals: ["formal"], deliberations: ["formal"], archiveRecords: ["formal"] }).activeTopicId, null);
  assert.throws(() => session.rejectMutation(), /只读/);
  assert.deepEqual(session.selectMember(42, "nangong-wan", collaborationState).tasks, []);
  session.remove(42);
  assert.equal(session.isActive(42), false);
});

test("空状态条件只创建非持久化验收窗口，并在验收后关闭", () => {
  const desktopIpcSource = readFileSync("electron/system/ipc/register-desktop-ipc.ts", "utf8");
  const collaborationIpcSource = readFileSync("electron/system/ipc/domains/register-collaboration-ipc.ts", "utf8");
  const runtimeSource = readFileSync("electron/system/bootstrap/application-runtime.ts", "utf8");
  const preloadSource = readFileSync("electron/system/preload/preload.cts", "utf8");
  assert.match(desktopIpcSource, /任务协作群/u);
  assert.match(desktopIpcSource, /空状态\|无专题任务\|找韩立说需求/u);
  assert.match(desktopIpcSource, /task-collaboration-empty\(-action\)\?/);
  assert.match(desktopIpcSource, /partition: "hanli-empty-task-group-acceptance"/);
  assert.match(desktopIpcSource, /additionalArguments: \["--hanli-empty-task-group-acceptance"\]/);
  assert.match(desktopIpcSource, /acceptanceEmptyTaskGroupSession\.remove/);
  assert.match(desktopIpcSource, /acceptanceEmptyTaskGroupSession: AcceptanceEmptyTaskGroupSession/);
  assert.match(collaborationIpcSource, /rejectIsolatedMutation/);
  assert.match(runtimeSource, /const acceptanceEmptyTaskGroupSession = new AcceptanceEmptyTaskGroupSession\(\)/);
  assert.match(runtimeSource, /acceptanceEmptyTaskGroupSession\.isActive\(window\.webContents\.id\)/);
  assert.match(runtimeSource, /acceptanceEmptyTaskGroupSession\.collaborationState\(window\.webContents\.id, state\)/);
  assert.match(runtimeSource, /taskIds: isolated \? \[\] : taskIds/);
  assert.match(source, /独立空状态验收会话为只读/);
  assert.match(source, /tasks: \[\]/);
  assert.match(preloadSource, /readOnlyAcceptanceWindow/);
  assert.match(preloadSource, /sendPersonaConversationMessage/);
  assert.match(preloadSource, /独立空状态验收窗口为只读/);
});
