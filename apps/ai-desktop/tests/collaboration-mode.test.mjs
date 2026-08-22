import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationDurationLog } from "../dist-electron/electron/services/collaboration/collaboration-duration-log.js";
import { CollaborationStore } from "../dist-electron/electron/services/collaboration/collaboration-store.js";

const controlledTempRoot = path.resolve("temp");
mkdirSync(controlledTempRoot, { recursive: true });

const workspaceState = {
  primaryId: "root",
  roots: [{ id: "root", name: "SELPLAT", path: path.resolve("../.."), permission: "workspace-write" }],
};

test("默认人物稳定列出且韩立不能被删除", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-store-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    assert.deepEqual(store.state().members.map((member) => member.displayName), [
      "韩立", "南宫婉", "紫灵", "元瑶", "宋玉", "冰魄仙子", "墨彩环", "墨大夫", "厉飞雨", "张铁", "令狐老祖", "李化元",
    ]);
    assert.throws(() => store.deleteMember("han-li"), /不能删除/);
    const created = store.createMember({ displayName: "银月" });
    const member = created.members.find((candidate) => candidate.displayName === "银月");
    assert.ok(member);
    assert.equal(store.updateMember(member.memberId, { displayName: "银月仙子" }).members.some((candidate) => candidate.displayName === "银月仙子"), true);
    assert.equal(store.deleteMember(member.memberId).members.some((candidate) => candidate.memberId === member.memberId), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("进程中断后任务显式进入恢复态，继续时重新排队且不沿用旧连接租约", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-recovery-"));
  const filePath = path.join(directory, "state.json");
  try {
    const first = new CollaborationStore(filePath);
    const task = first.submitTask({
      title: "恢复任务",
      problemStatement: "模拟执行中关闭应用",
      confirmedIntent: "恢复后显示继续执行，并使用保存的版本工作区重新分配 Codex。",
      workspaceState,
      locale: "zh-CN",
    });
    first.updateTask(task.taskId, "test.executing", (current, state) => {
      const member = state.members.find((candidate) => candidate.memberId === "song-yu");
      member.state = "working";
      member.role = "executor";
      member.currentTaskId = task.taskId;
      current.state = "executing";
      current.executorMemberId = member.memberId;
      current.assignmentId = "expired-assignment";
    });

    const restored = new CollaborationStore(filePath);
    assert.equal(restored.task(task.taskId).state, "recovering");
    const continued = restored.continueTask(task.taskId);
    const continuedTask = continued.tasks.find((candidate) => candidate.taskId === task.taskId);
    assert.equal(continuedTask.state, "queued-executor");
    assert.equal(continuedTask.executorMemberId, "song-yu");
    assert.equal(continuedTask.assignmentId, null);
    assert.equal(continued.members.find((candidate) => candidate.memberId === "song-yu").state, "idle");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("耗时日志按等待原因生成集成批次瓶颈报告", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-log-"));
  try {
    const log = new CollaborationDurationLog(directory);
    const queue = log.startWait("task-a", "executor-queue", "system-wait", "no-idle-executor", "executor-capacity", null);
    log.finish(queue, "completed", { releaseEvent: "executor.assigned" });
    const report = log.writeGenerationReport(1, ["task-a"]);
    assert.equal(report.generation, 1);
    assert.equal(report.taskIds[0], "task-a");
    assert.equal(typeof report.waitDurationMs["system-wait"], "number");
    assert.match(readFileSync(path.join(directory, "collaboration", "reports", "integration-generation-1.json"), "utf8"), /no-idle-executor/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("协同编排保持独立连接、异人审核、三次上限、心跳和即时就绪集成契约", () => {
  const coordinator = readFileSync(new URL("../electron/services/collaboration/collaboration-coordinator.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const workspaces = readFileSync(new URL("../electron/services/collaboration/version-workspace-manager.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
  assert.match(sessions, /new CodexService/);
  assert.match(sessions, /role: "executor" \| "reviewer"/);
  assert.match(coordinator, /member\.memberId !== task\.executorMemberId/);
  assert.match(coordinator, /explicitRejectionCount >= 3/);
  assert.match(coordinator, /member\.heartbeat/);
  assert.match(coordinator, /state === "ready-for-integration"/);
  assert.doesNotMatch(coordinator, /setTimeout\([^)]*integration/i);
  assert.match(workspaces, /codex\/collab/);
  assert.match(workspaces, /resultSha/);
  assert.doesNotMatch(ui, /CollaborationMemberPage[\s\S]*durationMs/);
});
