import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationDurationLog } from "../dist-electron/electron/services/collaboration/collaboration-duration-log.js";
import { nextReviewAction } from "../dist-electron/electron/services/collaboration/collaboration-coordinator.js";
import { parseCollaborationReviewDecision, resolveCollaborationReviewDecision } from "../dist-electron/electron/services/collaboration/collaboration-codex-sessions.js";
import { ensureIntegrationDependencies } from "../dist-electron/electron/services/collaboration/integration-verifier.js";
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

test("审核结论兼容标签、Markdown 旧格式和明确中文表达，但拒绝冲突或正文猜测", () => {
  assert.deepEqual(parseCollaborationReviewDecision("审核完成。\n<review_decision>PASSED</review_decision>"), {
    decision: "passed",
    decisionSource: "tag",
  });
  assert.deepEqual(parseCollaborationReviewDecision("```text\n**DECISION: REJECTED**\n```"), {
    decision: "rejected",
    decisionSource: "legacy-marker",
  });
  assert.deepEqual(parseCollaborationReviewDecision("### 审核意见\n审核结论：通过"), {
    decision: "passed",
    decisionSource: "explicit-chinese",
  });
  assert.equal(parseCollaborationReviewDecision("方案通过类型检查，但仍需补测试。"), null);
  assert.equal(parseCollaborationReviewDecision("<review_decision>PASSED</review_decision>\n<review_decision>REJECTED</review_decision>"), null);
});

test("审核正文无法识别时只补取一次结论并保留原正文", async () => {
  let clarificationCount = 0;
  const clarified = await resolveCollaborationReviewDecision("方案覆盖完整，建议通过。", async () => {
    clarificationCount += 1;
    return "<review_decision>PASSED</review_decision>";
  });
  assert.equal(clarificationCount, 1);
  assert.equal(clarified.outcome, "decided");
  assert.equal(clarified.decision, "passed");
  assert.equal(clarified.decisionSource, "clarification");
  assert.equal(clarified.feedback, "方案覆盖完整，建议通过。");

  const unresolved = await resolveCollaborationReviewDecision("已有完整审核正文。", async () => "仍然没有结构化结论");
  assert.equal(unresolved.outcome, "decision-unrecognized");
  assert.equal(unresolved.rawOutput, "已有完整审核正文。");
  assert.match(unresolved.error, /正文已生成/);
});

test("审核满足最低需求即通过且第三次驳回先最终修正再强制执行", () => {
  assert.equal(nextReviewAction("passed", 0), "execute");
  assert.equal(nextReviewAction("rejected", 1), "optimize-and-review");
  assert.equal(nextReviewAction("rejected", 2), "optimize-and-review");
  assert.equal(nextReviewAction("rejected", 3), "optimize-and-execute");
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  assert.match(sessions, /满足最低需求必须通过/);
  assert.match(sessions, /禁止据此扩大问题或驳回/);
});

test("集成工作区锁文件一致时自动复用主工作区依赖", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-dependencies-"));
  const candidate = path.join(directory, "candidate");
  const source = path.join(directory, "source");
  try {
    mkdirSync(path.join(candidate), { recursive: true });
    mkdirSync(path.join(source, "node_modules", ".bin"), { recursive: true });
    writeFileSync(path.join(candidate, "package-lock.json"), "same-lock", "utf8");
    writeFileSync(path.join(source, "package-lock.json"), "same-lock", "utf8");
    writeFileSync(path.join(source, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "ready", "utf8");
    assert.equal(await ensureIntegrationDependencies(candidate, source), "linked");
    assert.equal(readFileSync(path.join(candidate, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "utf8"), "ready");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("旧协同状态加载时补齐审核尝试历史", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-review-migration-"));
  const filePath = path.join(directory, "state.json");
  try {
    const store = new CollaborationStore(filePath);
    const task = store.submitTask({
      title: "审核迁移",
      problemStatement: "旧任务没有审核尝试字段",
      confirmedIntent: "旧任务重启后应自动补齐审核尝试历史。",
      workspaceState,
      locale: "zh-CN",
    });
    const persisted = JSON.parse(readFileSync(filePath, "utf8"));
    delete persisted.tasks.find((candidate) => candidate.taskId === task.taskId).reviewAttempts;
    writeFileSync(filePath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
    assert.deepEqual(new CollaborationStore(filePath).task(task.taskId).reviewAttempts, []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("协同编排保持独立连接、异人审核、三次上限、心跳和即时就绪集成契约", () => {
  const coordinator = readFileSync(new URL("../electron/services/collaboration/collaboration-coordinator.ts", import.meta.url), "utf8");
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const workspaces = readFileSync(new URL("../electron/services/collaboration/version-workspace-manager.ts", import.meta.url), "utf8");
  const integrationVerifier = readFileSync(new URL("../electron/services/collaboration/integration-verifier.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
  assert.match(sessions, /new CodexService/);
  assert.match(sessions, /codexHome: this\.#options\.codexHome/);
  assert.match(sessions, /serviceName: "selplat_ai_desktop_collaboration"/);
  assert.match(sessions, /migrateLegacySession: true/);
  assert.match(sessions, /role: "executor" \| "reviewer"/);
  assert.match(coordinator, /member\.memberId !== task\.executorMemberId/);
  assert.match(coordinator, /optimize-and-execute/);
  assert.match(coordinator, /member\.heartbeat/);
  assert.match(coordinator, /state === "ready-for-integration"/);
  assert.doesNotMatch(coordinator, /setTimeout\([^)]*integration/i);
  assert.match(workspaces, /codex\/collab/);
  assert.match(workspaces, /codex\/collab\/integration-g\$\{generation\}/);
  assert.doesNotMatch(workspaces, /codex\/collab\/integration\/g\$\{generation\}/);
  assert.match(workspaces, /resultSha/);
  assert.match(integrationVerifier, /dependencyMode === "linked"/);
  assert.match(integrationVerifier, /unlinkSync\(path\.join\(desktopRoot, "node_modules"\)\)/);
  assert.match(ui, /reviewAttempts\.some/);
  assert.match(ui, /审核正文已保存，结论未确认/);
  assert.doesNotMatch(ui, /CollaborationMemberPage[\s\S]*durationMs/);
});
