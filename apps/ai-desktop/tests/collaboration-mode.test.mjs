import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CollaborationDurationLog } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-duration-log.js";
import { createCollaborationResultSummary, nextReviewAction } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-coordinator.js";
import { parseCollaborationReviewDecision, resolveCollaborationReviewDecision } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-codex-sessions.js";
import { ensureIntegrationDependencies } from "../../../build/ai-desktop/electron/electron/services/collaboration/integration-verifier.js";
import { CollaborationStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/collaboration-store.js";
import { LinghuAutomationFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/linghu-automation-facade.js";
import { LinghuAutomationStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/linghu-automation-store.js";
import { ManagedTaskExecutor } from "../../../build/ai-desktop/electron/electron/services/managed-task-executor.js";
import { controlledTestRoot, projectRoot } from "./test-paths.mjs";

const controlledTempRoot = controlledTestRoot;
mkdirSync(controlledTempRoot, { recursive: true });
const developerSource = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const coordinatorSource = readFileSync(new URL("../electron/services/collaboration/collaboration-coordinator.ts", import.meta.url), "utf8");
const collaborationContractSource = readFileSync(new URL("../shared/contracts/collaboration.ts", import.meta.url), "utf8");

test("会话卡片绑定真实协作任务并完整显示修复回流与统一测试状态", () => {
  assert.match(developerSource, /collaborationTaskId/);
  assert.match(developerSource, /CollaborationStatusChain/);
  assert.match(developerSource, /task-fact-strip.*task\.initiator\?\.displayName/s);
  assert.match(developerSource, /review-failed[\s\S]*重新审批/);
  assert.match(developerSource, /test-failed[\s\S]*重新测试/);
  assert.match(collaborationContractSource, /repairing-review/);
  assert.match(collaborationContractSource, /repairing-execution/);
  assert.match(collaborationContractSource, /unified-testing/);
  assert.match(coordinatorSource, /review\.repair_completed[\s\S]*preferredReviewerMemberId/);
  assert.match(coordinatorSource, /execution\.repair_completed[\s\S]*preferredExecutorMemberId/);
  assert.match(coordinatorSource, /令狐老祖正在统一测试/);
  assert.match(coordinatorSource, /unified_test\.passed/);
  assert.match(coordinatorSource, /unified_test\.failed/);
});

const workspaceState = {
  primaryId: "root",
  roots: [{ id: "root", name: "SELPLAT", path: projectRoot, permission: "workspace-write" }],
};

test("默认人物稳定列出且韩立不能被删除", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-store-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    assert.deepEqual(store.state().members.map((member) => member.displayName), [
      "韩立", "南宫婉", "令狐老祖", "紫灵", "元瑶", "宋玉", "冰魄仙子", "墨彩环", "墨大夫", "厉飞雨", "张铁", "李化元",
    ]);
    assert.throws(() => store.deleteMember("han-li"), /不能删除/);
    assert.throws(() => store.deleteMember("linghu-ancestor"), /不能删除/);
    const created = store.createMember({ displayName: "银月" });
    const member = created.members.find((candidate) => candidate.displayName === "银月");
    assert.ok(member);
    assert.equal(store.updateMember(member.memberId, { displayName: "银月仙子" }).members.some((candidate) => candidate.displayName === "银月仙子"), true);
    assert.equal(store.deleteMember(member.memberId).members.some((candidate) => candidate.memberId === member.memberId), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐老祖自动保障通过单一 Facade 发起任务并持久恢复启动文案", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-automation-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    const submitted = [];
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => {
        submitted.push(request);
        collaborationStore.submitTask(request);
        return collaborationStore.state();
      },
      continueTask: (taskId) => collaborationStore.continueTask(taskId),
    };
    const storePath = path.join(directory, "linghu.json");
    const automationStore = new LinghuAutomationStore(storePath);
    let restartCount = 0;
    const facade = new LinghuAutomationFacade({
      store: automationStore,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      runUnifiedTestAndRestart: async (onVerified) => { restartCount += 1; onVerified(); },
    });
    automationStore.setEnabled(true);
    await facade.checkNow();
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].initiatorMemberId, "linghu-ancestor");
    assert.equal(submitted[0].preferredExecutorMemberId, "linghu-ancestor");
    assert.equal(submitted[0].automationSource, "linghu-safeguard");
    assert.match(submitted[0].confirmedIntent, /最后一道屏障/);
    assert.match(submitted[0].confirmedIntent, /当前独立模块/);
    assert.equal(facade.state().activeTaskId, collaborationStore.state().tasks[0].taskId);
    await facade.checkNow();
    assert.equal(submitted.length, 1, "活动模块尚未完成时30秒检测不得重复派发");
    assert.equal(facade.state().flowSnapshots.length, 1);
    assert.equal(facade.state().flowSnapshots[0].sourceTaskId, facade.state().activeTaskId);
    assert.deepEqual(facade.state().flowSnapshots[0].completionConditions, ["任务完成代码级验证", "集成候选验证通过", "结果进入 integrated 终态"]);
    assert.ok(facade.state().detectionCursor);

    const created = facade.createPrompt({ title: "客户易用性巡检", content: "从客户一看就懂的角度持续检查页面。" });
    const prompt = created.prompts.find((candidate) => candidate.title === "客户易用性巡检");
    assert.ok(prompt);
    facade.updatePrompt(prompt.promptId, { enabled: false });
    assert.equal(facade.state().prompts.find((candidate) => candidate.promptId === prompt.promptId).enabled, false);
    const restored = new LinghuAutomationStore(storePath).state();
    assert.equal(restored.enabled, true);
    assert.equal(restored.activeTaskId, facade.state().activeTaskId);
    assert.equal(restored.pollIntervalMs, 30_000);
    facade.deletePrompt(prompt.promptId);
    assert.equal(facade.state().prompts.some((candidate) => candidate.promptId === prompt.promptId), false);

    const expectedModules = ["log-diagnosis", "architecture-recovery", "unified-test-restart", "flow-completion"];
    for (const expectedModule of expectedModules) {
      const activeTaskId = facade.state().activeTaskId;
      collaborationStore.updateTask(activeTaskId, "test.integrated", (task) => {
        task.state = "integrated";
        task.completedAt = new Date().toISOString();
        task.finalResult = "模块完成反馈";
      });
      await facade.checkNow();
      assert.equal(facade.state().currentModule, expectedModule);
    }
    assert.equal(facade.state().cycle, 2);
    assert.equal(restartCount, 1);
    assert.equal(submitted.length, 5, "每个模块完成后只派发一个下一模块任务");
    assert.equal(facade.state().lastModuleReport.module, "unified-test-restart");
    assert.equal(facade.state().lastModuleReport.tests.status, "passed");
    assert.equal(facade.state().lastModuleReport.restartRecovery.status, "passed");
    assert.equal(facade.state().lastModuleReport.tasks[0].executorMemberId, "linghu-ancestor");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐自动状态损坏时从最近有效备份恢复开启开关和检测恢复点", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-backup-recovery-"));
  const storePath = path.join(directory, "linghu.json");
  try {
    const store = new LinghuAutomationStore(storePath);
    store.setEnabled(true);
    store.updateRuntime("test.checkpoint", (state) => {
      state.detectionCursor = "2026-08-23T10:00:00.000Z";
      state.recoveryCheckpoint = "active-task:TASK-1:flow-completion";
    });
    writeFileSync(storePath, "{损坏状态", "utf8");
    const restored = new LinghuAutomationStore(storePath).state();
    assert.equal(restored.enabled, true);
    assert.equal(restored.detectionCursor, "2026-08-23T10:00:00.000Z");
    assert.equal(restored.recoveryCheckpoint, "active-task:TASK-1:flow-completion");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐自动状态主文件和备份均损坏时安全关闭并等待用户重新开启", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-state-rebuild-"));
  const storePath = path.join(directory, "linghu.json");
  try {
    const store = new LinghuAutomationStore(storePath);
    store.setEnabled(true);
    writeFileSync(storePath, "{主文件损坏", "utf8");
    writeFileSync(`${storePath}.bak`, "{备份损坏", "utf8");
    const rebuilt = new LinghuAutomationStore(storePath).state();
    assert.equal(rebuilt.enabled, false);
    assert.match(rebuilt.blockingReason, /已安全关闭/);
    assert.equal(rebuilt.currentModule, "flow-completion");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐对同一故障指纹最多执行三次恢复副作用但继续检测", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-recovery-limit-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    let recoveryRequests = 0;
    const collaboration = {
      state: () => collaborationStore.state(),
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => {
        collaborationStore.submitTask(request);
        return collaborationStore.state();
      },
      continueTask: () => { recoveryRequests += 1; },
      recoverTask: () => { throw new Error("阻塞任务应走 continueTask 恢复入口"); },
    };
    const automationStore = new LinghuAutomationStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({
      store: automationStore,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      runUnifiedTestAndRestart: async () => undefined,
    });
    automationStore.setEnabled(true);
    await facade.checkNow();
    collaborationStore.updateTask(facade.state().activeTaskId, "test.blocked", (task) => {
      task.state = "blocked";
      task.blockingReason = "固定基础设施故障";
    });
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    await facade.checkNow();
    assert.equal(recoveryRequests, 3);
    assert.equal(facade.state().enabled, true);
    assert.match(facade.state().blockingReason, /检测仍保持运行/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐活动任务记录缺失时保留恢复点并派发同模块替代任务", async () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "linghu-missing-task-"));
  try {
    const collaborationStore = new CollaborationStore(path.join(directory, "collaboration.json"));
    collaborationStore.setMode("collaboration");
    let hiddenTaskId = null;
    const collaboration = {
      state: () => {
        const state = collaborationStore.state();
        state.tasks = state.tasks.filter((task) => task.taskId !== hiddenTaskId);
        return state;
      },
      setMode: (mode) => collaborationStore.setMode(mode),
      submitTask: (request) => {
        collaborationStore.submitTask(request);
        return collaboration.state();
      },
      continueTask: (taskId) => collaborationStore.continueTask(taskId),
      recoverTask: () => { throw new Error("本场景不应进入停点恢复"); },
    };
    const automationStore = new LinghuAutomationStore(path.join(directory, "linghu.json"));
    const facade = new LinghuAutomationFacade({
      store: automationStore,
      collaboration,
      readWorkspaceState: () => workspaceState,
      locale: () => "zh-CN",
      recordEvent: () => undefined,
      runUnifiedTestAndRestart: async () => undefined,
    });
    automationStore.setEnabled(true);
    await facade.checkNow();
    hiddenTaskId = facade.state().activeTaskId;
    await facade.checkNow();
    assert.notEqual(facade.state().activeTaskId, hiddenTaskId);
    assert.match(facade.state().recoveryCheckpoint, /replacement-task:missing-task:/);
    assert.equal(collaborationStore.state().tasks.length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("令狐第四模块只运行固定统一测试并在恢复点持久化后受控重启", () => {
  const runner = readFileSync(new URL("../electron/services/collaboration/linghu-unified-test-runner.ts", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../electron/services/collaboration/linghu-automation-facade.ts", import.meta.url), "utf8");
  const main = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
  assert.match(runner, /\["test:interaction", "test:collaboration", "test:managed", "package:mac:developer", "verify:mac:developer"\]/);
  assert.doesNotMatch(runner, /confirmedIntent|prompt\.content/);
  assert.match(facade, /#completeModule[\s\S]*await this\.#runUnifiedTestAndRestart\(\(\) =>/);
  assert.match(facade, /automation\.unified_test_failed[\s\S]*currentModule = "flow-completion"/);
  assert.match(main, /await linghuUnifiedTests\.run\(\)[\s\S]*onVerified\(\)[\s\S]*resolveVerifiedDeveloperExecutable[\s\S]*app\.relaunch\(\{ execPath: executable[\s\S]*app\.exit\(0\)/);
  assert.match(facade, /automaticFlowSnapshots[\s\S]*faultFingerprint[\s\S]*moduleCompletionReport/);
});

test("令狐自动保障用户层规则登记全量检测、故障指纹、损坏恢复与固定报告", () => {
  const rule = readFileSync(new URL("../../rule-engine/backend/src/main/resources/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop官方Harness接入规则.md", import.meta.url), "utf8");
  assert.match(rule, /rule_version = 5\.59\.0/);
  assert.match(rule, /linghu_automation_flow_snapshot_contract/);
  assert.match(rule, /linghu_automation_recovery_fingerprint_contract/);
  assert.match(rule, /linghu_automation_state_recovery_contract/);
  assert.match(rule, /linghu_module_completion_report_contract/);
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
    assert.equal(task.initiator.displayName, "韩立");
    assert.equal(task.startedAt, task.createdAt);
    assert.equal(task.flowEvents[0].type, "task.submitted");
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

test("协同任务冻结真实发起人快照，两类自动发起都不回退成韩立", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-initiator-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({
      title: "自动发起任务",
      problemStatement: "自动流程需要显示真实发起人物",
      confirmedIntent: "由南宫婉发起并保留发起人快照。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "nangong-wan",
    });
    assert.deepEqual(task.initiator, { memberId: "nangong-wan", displayName: "南宫婉" });
    assert.deepEqual(task.flowEvents[0].actor, task.initiator);
    const repairTask = store.submitTask({
      title: "自动错误修复任务",
      problemStatement: "自动修复流程需要显示真实发起人物",
      confirmedIntent: "由令狐老祖发起并保留发起人快照。",
      workspaceState,
      locale: "zh-CN",
      initiatorMemberId: "linghu-ancestor",
    });
    assert.deepEqual(repairTask.initiator, { memberId: "linghu-ancestor", displayName: "令狐老祖" });
    assert.deepEqual(repairTask.flowEvents[0].actor, repairTask.initiator);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("人物页按阶段标注真实操作者并在阻塞后保留执行证据与恢复入口", () => {
  assert.match(developerSource, /task\.plans\.map[\s\S]*plan\.ownerDisplayName/);
  assert.match(developerSource, /task\.reviewAttempts\.map[\s\S]*attempt\.reviewerDisplayName/);
  assert.match(developerSource, /task\.executionRecords\.map[\s\S]*record\.executor\.displayName/);
  assert.match(developerSource, /task-fact-strip[\s\S]*task\.initiator\?\.displayName/);
  assert.match(developerSource, /\["recovering", "blocked", "review-failed", "test-failed"\]\.includes\(currentTask\.state\)/);
  assert.match(developerSource, /record\.changedFiles/);
  assert.match(coordinatorSource, /execution\.diff_updated/);
  assert.match(coordinatorSource, /execution\.changedFiles = changedFiles/);
});

test("执行结果标题被转换为可直接归档的结构化摘要", () => {
  const directory = mkdtempSync(path.join(controlledTempRoot, "collaboration-summary-"));
  try {
    const store = new CollaborationStore(path.join(directory, "state.json"));
    const task = store.submitTask({ title: "结果摘要", problemStatement: "旧结果只能翻日志查看", confirmedIntent: "执行列表首先展示任务价值。", workspaceState, locale: "zh-CN" });
    const summary = createCollaborationResultSummary(task, [
      "## 最终执行结果", "新增独立执行列表。", "## 原来存在的问题", "完成记录散落在人物页。",
      "## 本次解决的问题", "完成任务统一归档。", "## 具体修正或改变", "增加结构化结果与流转记录。",
      "## 完成状态", "代码级验证完成。", "## 遗留内容", "无",
    ].join("\n"));
    assert.equal(summary.finalResult, "新增独立执行列表。");
    assert.equal(summary.originalProblem, "完成记录散落在人物页。");
    assert.equal(summary.solvedProblem, "完成任务统一归档。");
    assert.equal(summary.changes, "增加结构化结果与流转记录。");
    assert.equal(summary.remaining, "无");
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
    assert.match(readFileSync(path.join(directory, new Date().toISOString().slice(0, 7), "system", "集成报告", "integration-generation-1.json"), "utf8"), /no-idle-executor/);
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
    assert.equal(await ensureIntegrationDependencies(candidate, path.join(source, "node_modules"), path.join(source, "package-lock.json")), "linked");
    assert.equal(readFileSync(path.join(candidate, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"), "utf8"), "ready");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("协同执行人修改源码后由桌面内部验证分支而不再发起 Codex Playwright 回合", async () => {
  const executor = new ManagedTaskExecutor();
  let turnCount = 0;
  let desktopValidationCount = 0;
  const events = [];
  const result = await executor.run({
    mode: "task-managed",
    message: "修改当前任务分支",
    restartRequired: false,
    emit: (event) => events.push(event),
    runTurn: async (_message, emit) => {
      turnCount += 1;
      emit({
        type: "activity",
        turnId: "task-turn",
        activity: {
          id: "change-1",
          itemType: "fileChange",
          phase: "completed",
          status: "completed",
          summary: "apps/ai-desktop/src/example.ts",
          detail: null,
        },
      });
      return { text: "源码修改完成", itemCount: 1 };
    },
    runCodeValidation: async () => { desktopValidationCount += 1; },
  });
  assert.equal(turnCount, 1);
  assert.equal(desktopValidationCount, 1);
  assert.equal(result.managedStatus, "code-verified");
  assert.equal(events.some((event) => event.managedExecution?.message.includes("当前任务分支隔离 Playwright 已通过")), true);
});

test("协同固定测试按签发 worktree 执行并隔离任务缓存和输出", () => {
  const runner = readFileSync(new URL("../electron/services/collaboration/task-worktree-test-runner.ts", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const sessions = readFileSync(new URL("../electron/services/collaboration/collaboration-codex-sessions.ts", import.meta.url), "utf8");
  const codex = readFileSync(new URL("../electron/services/codex-service.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../playwright.interaction.config.ts", import.meta.url), "utf8");
  assert.match(runner, /worktreeRoot/);
  assert.match(runner, /test-cache|PLAYWRIGHT_BROWSERS_PATH/);
  assert.match(runner, /AI_DESKTOP_TEST_TASK_ID/);
  assert.match(runner, /npm run/);
  assert.match(runner, /dependencyMode === "linked" && existsSync\(dependencyLink\)/);
  assert.equal(manifest.scripts["test:interaction"], "npm run build:developer && node scripts/run-with-dependencies.mjs node scripts/run-interaction-tests.mjs");
  assert.match(runner, /expected: "npm run build:developer && node scripts\/run-with-dependencies\.mjs node scripts\/run-interaction-tests\.mjs"/);
  assert.match(sessions, /runCodeValidation/);
  assert.match(sessions, /validationOwner: "desktop"/);
  assert.match(codex, /isDesktopOwnedValidationCommand/);
  assert.match(codex, /无需 Agent 申请 Playwright 权限/);
  assert.match(config, /AI_DESKTOP_TEST_TASK_ID/);
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
  assert.match(integrationVerifier, /existsSync\(dependencyLink\).*unlinkSync\(dependencyLink\)/);
  assert.match(ui, /reviewAttempts\.some/);
  assert.match(ui, /"decision-unrecognized": "结论未识别"/);
  const memberPageSource = ui.slice(ui.indexOf("function CollaborationMemberPage"), ui.indexOf("function collaborationMemberStateLabel"));
  assert.doesNotMatch(memberPageSource, /durationMs|总耗时/);
  assert.match(ui, /CollaborationExecutionList/);
  assert.match(ui, /任务结果摘要/);
});
