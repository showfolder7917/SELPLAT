import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { NangongEvolutionFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/nangong-evolution-facade.js";
import { NangongEvolutionStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/nangong-evolution-store.js";
import { controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });
const workspaceState = { primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: "/workspace", permission: "workspace-write" }] };
const nangongPromptSource = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
function topicRequest(title = "协同审批分层") { return { title, goal: "把演化方向审批从执行审核中独立出来", scope: ["AI Desktop"], exclusions: ["其他应用"], evidence: ["现有审核只覆盖执行方案"], acceptanceCriteria: ["提案审批与执行审核具有独立记录"], workspaceState, locale: "zh-CN" }; }
function proposalRequest() { return { type: "代码修正", content: "建立独立演化审批入口，审批通过后返还南宫婉分发。", risks: ["历史记录迁移"], rollbackPlan: "保留旧记录并关闭三项自动开关。" }; }
const conversation = { async send(_request, context) { return { text: `我了解到您的想法是：调查当前问题。如果我理解有偏差，您可以直接纠正我。\n\n南宫婉调查结论：${context}\nNANGONG_TOPIC_META={"title":"当前调查","type":"事实调查","switchTopic":false,"userIntent":"调查当前问题并形成事实依据"}`, itemCount: 1 }; }, async newChat() {} };
const distributionServices = {
  async planDistribution() { return JSON.stringify({ summary: "改动集中在同一业务流程和文件边界，由一个人独立完成可减少合并成本。", units: [{ title: "完成审批后的专项实施", scope: "在同一业务边界内完成提案要求并验证闭环", acceptanceCriteria: ["提案验收条件全部通过"], expectedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"], independentReason: "预计文件高度集中，不拆分可独立修改、回退和验收。" }] }); },
  async auditDistribution() { return JSON.stringify({ decision: "passed", reason: "单任务没有文件重叠，职责、回退和验收边界完整。", findings: [] }); },
};

test("南宫婉会话提示固定自然表达与只读调查边界", () => {
  assert.match(nangongPromptSource, /语气克制、温和、有判断/);
  assert.match(nangongPromptSource, /作为南宫婉性格的一部分/);
  assert.match(nangongPromptSource, /不能机械复制固定句子或擅自扩大用户意图/);
  assert.match(nangongPromptSource, /短问题直接短答/);
  assert.match(nangongPromptSource, /不使用“结论：”“建议：”“1、2、3”/);
  assert.match(nangongPromptSource, /不把推断或用户陈述说成既定事实/);
  assert.match(nangongPromptSource, /不得声称已形成正式课题、已提交审批或将开始修改/);
  assert.match(nangongPromptSource, /我了解到您的想法是/);
  assert.match(nangongPromptSource, /如果我理解有偏差，您可以直接纠正我/);
  assert.match(nangongPromptSource, /userIntent/);
});

test("自动演化、两个来源审批和自动分发四项开关独立持久化", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-switches-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    store.setAutomation("evolution", true); store.setAutomation("nangong-approval", true);
    const state = new NangongEvolutionStore(path.join(directory, "state.json")).state();
    assert.equal(state.automaticEvolutionEnabled, true); assert.equal(state.automaticNangongApprovalEnabled, true); assert.equal(state.automaticLinghuApprovalEnabled, false); assert.equal(state.automaticExecutionEnabled, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动审批无人工偏好时退回补充，人工决定形成版本化偏好", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-approval-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest()); state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposal = state.proposals[0]; state = facade.autoApprove(proposal.proposalId);
    assert.equal(state.proposals[0].status, "supplement-required");
    state = facade.decideProposal(proposal.proposalId, { decision: "approved", advice: "人工确认方向正确" });
    assert.equal(state.preferenceSnapshotVersion, 1);
    state = facade.createTopic(topicRequest("相同类型第二课题")); state = facade.createProposal(state.topics.at(-1).topicId, proposalRequest());
    state = facade.autoApprove(state.proposals.at(-1).proposalId);
    assert.equal(state.proposals.at(-1).status, "approved"); assert.equal(state.proposals.at(-1).approvals.at(-1).referencedApprovalIds.length, 1);
    state = facade.decideProposal(state.proposals.at(-1).proposalId, { decision: "rejected", advice: "用户纠正自动结论" });
    assert.equal(state.proposals.at(-1).status, "rejected"); assert.equal(state.preferenceSnapshotVersion, 2);
    assert.equal(state.proposals.at(-1).approvals.at(-1).source, "manual-user");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("审批通过后才由南宫婉分发并固定 proposalId", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json")); let submitted; let planningWorkspace; let auditWorkspace;
    const collaboration = { submitTask(request) { submitted = request; return { tasks: [{ taskId: "collab-1", evolutionProposalId: request.evolutionProposalId }] }; } };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation, recordEvent: () => undefined,
      async planDistribution(_prompt, receivedWorkspace) { planningWorkspace = receivedWorkspace; return distributionServices.planDistribution(); },
      async auditDistribution(_prompt, receivedWorkspace) { auditWorkspace = receivedWorkspace; return distributionServices.auditDistribution(); },
    });
    let state = facade.createTopic(topicRequest()); state = facade.createProposal(state.topics[0].topicId, proposalRequest()); const proposalId = state.proposals[0].proposalId;
    assert.equal(state.automationContext.workspaceState, null, "手动返还不应要求先配置自动演化工作区");
    await assert.rejects(() => facade.dispatch(proposalId), /只有审批通过/);
    facade.decideProposal(proposalId, { decision: "approved", advice: "通过" }); state = await facade.dispatch(proposalId);
    assert.deepEqual(planningWorkspace, workspaceState); assert.deepEqual(auditWorkspace, workspaceState);
    assert.deepEqual(submitted.workspaceState, workspaceState);
    assert.equal(submitted.initiatorMemberId, "nangong-wan"); assert.equal(submitted.evolutionProposalId, proposalId);
    assert.equal(submitted.evolutionRoundId, proposalId); assert.equal(submitted.mergeStrategy, "ATOMIC_GROUP"); assert.equal(submitted.atomicGroupId, proposalId);
    assert.deepEqual(submitted.dependencyTaskIds, []); assert.deepEqual(state.proposals[0].distributedTaskIds, ["collab-1"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("专题工作区缺失时返还执行显示业务错误而不是读取 null.roots", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-missing-workspace-"));
  const statePath = path.join(directory, "state.json");
  try {
    const store = new NangongEvolutionStore(statePath);
    const collaboration = { submitTask() { throw new Error("缺少工作区时不得创建任务"); } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest());
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { decision: "approved", advice: "通过" });
    const persisted = JSON.parse(readFileSync(statePath, "utf8"));
    persisted.topics[0].workspaceState = null;
    writeFileSync(statePath, JSON.stringify(persisted), "utf8");
    const restored = new NangongEvolutionFacade({ store: new NangongEvolutionStore(statePath), collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    await assert.rejects(() => restored.dispatch(proposalId), /当前专题缺少可用的实施工作区/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("生产分发会话显式使用专题工作区而不是自动演化上下文", () => {
  assert.match(nangongPromptSource, /planDistribution: async \(prompt, workspaceState, locale\)[\s\S]*nangongDistributionCodex![\s\S]*workspaceState/);
  assert.match(nangongPromptSource, /auditDistribution: async \(prompt, workspaceState, locale\)[\s\S]*linghuDistributionAuditCodex![\s\S]*workspaceState/);
  assert.doesNotMatch(nangongPromptSource, /planDistribution: async[^\n]*automationContext\.workspaceState/);
  assert.doesNotMatch(nangongPromptSource, /auditDistribution: async[^\n]*automationContext\.workspaceState/);
});

test("预计修改文件重叠时令狐阻止多人重复分发", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-overlap-audit-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    let submitted = 0;
    const collaboration = { submitTask() { submitted += 1; return { tasks: [] }; } };
    const overlappingPlan = JSON.stringify({ summary: "错误地按影响范围拆成两个任务。", units: [
      { title: "修改按钮", scope: "调整同一工具栏按钮", acceptanceCriteria: ["按钮可用"], expectedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"], independentReason: "页面改动" },
      { title: "验证按钮", scope: "验证同一工具栏按钮", acceptanceCriteria: ["按钮通过测试"], expectedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"], independentReason: "测试改动" },
    ] });
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation, recordEvent: () => undefined,
      async planDistribution() { return overlappingPlan; },
      async auditDistribution() { return JSON.stringify({ decision: "passed", reason: "模型误判为可并行", findings: [] }); },
    });
    let state = facade.createTopic(topicRequest("单按钮样式修正"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { decision: "approved", advice: "方向通过" });
    await assert.rejects(() => facade.dispatch(proposalId), /阻止分发/);
    assert.equal(submitted, 0);
    assert.equal(facade.state().proposals[0].distributionPlan.audit.decision, "revise");
    assert.match(facade.state().proposals[0].distributionPlan.audit.findings.join("；"), /同时属于/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("全部执行结果返回南宫婉后才封存同一轮并一次性交给令狐", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-round-collection-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    // 双任务夹具明确覆盖“部分返回继续等待、全部返回后仅触发一次”的业务边界。
    const taskStates = new Map([["round-task-1", "returned-to-nangong"], ["round-task-2", "executing"]]);
    const taskIds = []; let proposalId = null; const sealed = [];
    const collaboration = {
      submitTask(request) {
        proposalId = request.evolutionProposalId;
        taskIds.push(`round-task-${taskIds.length + 1}`);
        return this.state();
      },
      state() {
        return { tasks: taskIds.map((taskId) => ({ taskId, evolutionProposalId: proposalId, evolutionRoundId: proposalId, state: taskStates.get(taskId) })) };
      },
      sealEvolutionRound(receivedProposalId, receivedTaskIds) {
        sealed.push({ receivedProposalId, taskIds: receivedTaskIds });
        for (const taskId of receivedTaskIds) taskStates.set(taskId, "ready-for-integration");
        return this.state();
      },
    };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation, recordEvent: () => undefined,
      async planDistribution() { return JSON.stringify({ summary: "两个文件边界可独立执行，但必须整轮返回后统一测试。", units: [
        { title: "任务一", scope: "修改文件一", acceptanceCriteria: ["文件一通过"], expectedFiles: ["apps/ai-desktop/one.ts"], independentReason: "文件边界独立" },
        { title: "任务二", scope: "修改文件二", acceptanceCriteria: ["文件二通过"], expectedFiles: ["apps/ai-desktop/two.ts"], independentReason: "文件边界独立" },
      ] }); },
      async auditDistribution() { return JSON.stringify({ decision: "passed", reason: "两个任务文件与职责均不重叠。", findings: [] }); },
    });
    let state = facade.createTopic(topicRequest("南宫婉轮次收集"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { decision: "approved", advice: "批准整轮收集" });
    await facade.dispatch(proposalId);
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    assert.deepEqual(sealed, [], "仅部分任务返回时不得封存或启动统一测试");
    assert.equal(facade.state().proposals[0].status, "verifying", "已有结果返回时可显示验证中，但仍必须等待本轮其他任务");
    taskStates.set("round-task-2", "returned-to-nangong");
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    assert.deepEqual(sealed, [{ receivedProposalId: proposalId, taskIds: ["round-task-1", "round-task-2"] }]);
    assert.equal(facade.state().proposals[0].status, "verifying");
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    assert.equal(sealed.length, 1, "重复巡检不得再次封存同一轮或重复触发统一测试");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉提案从人工审批、任务分发推进到韩立验收后才完成且不复制旧专题", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-completed-flow-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    let distributedTaskId = null;
    const collaboration = {
      submitTask(request) { distributedTaskId = "collab-evolution-completed"; return { tasks: [{ taskId: distributedTaskId, evolutionProposalId: request.evolutionProposalId, state: "integrated" }] }; },
      state() { return { tasks: distributedTaskId ? [{ taskId: distributedTaskId, state: "integrated" }] : [] }; },
    };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    store.setAutomation("evolution", true);
    let state = facade.createTopic(topicRequest("完整演化闭环"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    state = facade.decideProposal(proposalId, { decision: "supplement-required", advice: "补充完成记录验收依据" });
    assert.equal(state.proposals[0].approvals.at(-1).source, "manual-user");
    state = facade.decideProposal(proposalId, { decision: "approved", advice: "事实完整，批准执行" });
    state = await facade.dispatch(proposalId);
    assert.deepEqual(state.proposals[0].distributedTaskIds, [distributedTaskId]);
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    state = facade.state();
    assert.equal(state.proposals[0].status, "pending-acceptance");
    assert.equal(state.proposals[0].resultSummary, "全部关联任务已经完成，等待韩立按真实用户路径验收结果。");
    assert.equal(state.topics.length, 1);
    state = facade.decideResult(proposalId, { decision: "approved", advice: "真实操作和视觉检查符合目标。" });
    assert.equal(state.proposals[0].status, "completed");
    assert.equal(state.proposals[0].approvals.at(-1).stage, "result");
    state = facade.state();
    assert.equal(state.topics.length, 1);
    assert.equal(state.topics[0].nextTopicId, null);
    assert.equal(state.topics[0].recoveryPoint, "han-li-result-accepted");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立综合南宫婉和 Codex 完整会话后逐轮发问，确立后才通知南宫婉登记专题池", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "han-li-deliberation-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: 5, maxCorrectionRounds: 5, workspaceState, locale: "zh-CN" });
    const hanLiReplies = [
      '{"question":"现有审批记录在哪一步丢失原始执行证据？","reason":"必须先确认断点才能确定专项边界"}',
      '{"decision":"continue","assessment":"已经确认执行记录不完整，但还不知道验收如何关联。","nextQuestion":"验收记录应怎样关联到执行任务？","questionReason":"需要补齐从执行到验收的追溯关系"}',
      '{"decision":"establish-topic","assessment":"来源、断点和验收链已经明确。","topic":{"title":"专题全生命周期原始档案","goal":"从来源对话到验收保留完整原始记录","scope":["AI Desktop"],"exclusions":["其他应用"],"evidence":["南宫婉与 Codex 原始会话均显示执行证据缺少专题关联"],"acceptanceCriteria":["专题页面可从头查看全部原始记录"],"establishmentReason":"两轮研讨已经确认问题边界和验收方法"}}',
    ];
    const memory = {
      readHanLiEvolutionCorpus(deliberationId) {
        const capturedAt = "2026-08-26T00:00:00.000Z";
        return [
          { snapshotId: `${deliberationId}:nangong:1`, deliberationId, source: "nangong", conversationId: "nangong-1", sourceMessageId: "n-1", sequenceNumber: 0, role: "user", responsePhase: null, content: "专题要保留完整过程。", originalCreatedAt: capturedAt, capturedAt },
          { snapshotId: `${deliberationId}:codex:1`, deliberationId, source: "codex", conversationId: "codex-1", sourceMessageId: "c-1", sequenceNumber: 0, role: "codex", responsePhase: "final_answer", content: "执行日志已经生成。", originalCreatedAt: capturedAt, capturedAt },
        ];
      },
    };
    const facade = new NangongEvolutionFacade({
      store, collaboration: {}, conversation, memory, recordEvent: () => undefined,
      hanLi: { async send() { return hanLiReplies.shift(); } },
      nangongDeliberation: { async send(question) { return `南宫婉针对韩立问题回答：${question}`; } },
    });
    let state = await facade.advanceHanLiDeliberation();
    assert.equal(state.topics.length, 0);
    assert.equal(state.deliberations[0].rounds.length, 2);
    assert.equal(state.deliberations[0].rounds[0].decision, "continue");
    state = await facade.advanceHanLiDeliberation();
    assert.equal(state.deliberations[0].status, "established");
    assert.equal(state.topics.length, 1);
    assert.equal(state.topics[0].deliberationId, state.deliberations[0].deliberationId);
    assert.equal(state.deliberations[0].sourceSnapshots[0].content, "专题要保留完整过程。");
    assert.ok(state.archiveRecords.some((item) => item.eventType === "topic.established_from_deliberation"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("研讨达到配置上限但证据仍不足时保留缺口并阻断，不机械生成专题", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "han-li-deliberation-limit-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: 1, maxCorrectionRounds: 3, workspaceState, locale: "zh-CN" });
    const replies = [
      '{"question":"还缺少哪项执行事实？","reason":"现有原文没有证明发布结果"}',
      '{"decision":"continue","assessment":"发布结果仍没有事实证据。","nextQuestion":"发布后实际页面状态是什么？","questionReason":"缺少发布后用户可见结果"}',
    ];
    const facade = new NangongEvolutionFacade({
      store, collaboration: {}, conversation, recordEvent: () => undefined,
      memory: { readHanLiEvolutionCorpus(deliberationId) { return [{ snapshotId: "limit-source", deliberationId, source: "codex", conversationId: "thread", sourceMessageId: "message", sequenceNumber: 0, role: "codex", responsePhase: "final_answer", content: "只完成了代码修改。", originalCreatedAt: "2026-08-26T00:00:00.000Z", capturedAt: "2026-08-26T00:00:00.000Z" }]; } },
      hanLi: { async send() { return replies.shift(); } },
      nangongDeliberation: { async send() { return "目前没有发布后的页面证据。"; } },
    });
    const state = await facade.advanceHanLiDeliberation();
    assert.equal(state.topics.length, 0);
    assert.equal(state.deliberations[0].status, "blocked");
    assert.equal(state.deliberations[0].rounds[0].decision, "blocked");
    assert.equal(state.automationRuntime.status, "blocked");
    assert.match(state.automationRuntime.stopReason, /缺少发布后用户可见结果/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉对话持久化并冻结为正式课题快照", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-conversation-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = await facade.sendConversationMessage({ message: "调查令狐持续修正 Bug", attachmentIds: ["screenshot-1"], workspaceState, locale: "zh-CN" });
    assert.equal(state.conversation.messages.length, 2);
    assert.deepEqual(state.conversation.messages[0].attachmentIds, ["screenshot-1"]);
    assert.equal(state.conversation.messages[0].inferredIntent, "调查当前问题并形成事实依据");
    assert.doesNotMatch(state.conversation.messages[1].content, /NANGONG_TOPIC_META/);
    assert.throws(() => facade.convertConversationToTopic({ title: "未确认转换", goal: "不能自动变成正式课题", scope: ["AI Desktop"], acceptanceCriteria: ["用户明确确认"], workspaceState, locale: "zh-CN" }), /用户明确确认/);
    state = facade.convertConversationToTopic({ confirmedByUser: true, title: "令狐持续修正演化", goal: "修正 Bug 并维持稳定运行", scope: ["AI Desktop"], evidence: ["用户确认：令狐持续修正需要先审批", "南宫婉调查：现有修正方案尚未进入统一审批"], acceptanceCriteria: ["修正方案先审批"], workspaceState, locale: "zh-CN" });
    assert.equal(state.topics.at(-1).sourceConversationMessageIds.length, 2);
    assert.deepEqual(state.topics.at(-1).evidence, ["用户确认：令狐持续修正需要先审批", "南宫婉调查：现有修正方案尚未进入统一审批"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉根据当前对话生成五项可编辑草稿但不直接保存课题", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-topic-draft-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    const draftConversation = {
      async send(request) {
        if (request.message.includes("仅返回 JSON")) return { text: JSON.stringify({ title: "令狐持续修正演化", goal: "保持 Bug 修复链稳定运行", scope: ["AI Desktop"], evidence: ["用户陈述：草稿需要从当前对话生成", "南宫婉调查：修正方案需要审批"], acceptanceCriteria: ["五项内容可编辑后再保存"] }), itemCount: 1 };
        return { text: "南宫婉调查：修正方案需要先进入审批。", itemCount: 1 };
      },
      async newChat() {},
    };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: draftConversation, recordEvent: () => undefined });
    await facade.sendConversationMessage({ message: "根据当前对话生成草稿", workspaceState, locale: "zh-CN" });
    const draft = await facade.generateTopicDraft({ workspaceState, locale: "zh-CN" });
    assert.deepEqual(draft, { title: "令狐持续修正演化", goal: "保持 Bug 修复链稳定运行", scope: ["AI Desktop"], evidence: ["用户陈述：草稿需要从当前对话生成", "南宫婉调查：修正方案需要审批"], acceptanceCriteria: ["五项内容可编辑后再保存"] });
    assert.equal(facade.state().topics.length, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉新建对话等待活动写入者释放后才清空持久消息", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-new-conversation-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    store.appendConversation("user", "必须在旧线程删除成功后再清空");
    let attempts = 0;
    const retryingConversation = {
      async send() { return { text: "unused", itemCount: 1 }; },
      async newChat() {
        attempts += 1;
        if (attempts < 3) throw new Error("thread already has an active writer");
      },
    };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: retryingConversation, recordEvent: () => undefined, newConversationRetryDelaysMs: [0, 1, 1] });
    const state = await facade.newConversation();
    assert.equal(attempts, 3);
    assert.equal(state.conversation.messages.length, 0);
    assert.equal(new NangongEvolutionStore(path.join(directory, "state.json")).state().conversation.messages.length, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉线程删除最终失败时保留原页面消息", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-new-conversation-failed-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    store.appendConversation("user", "删除失败时必须保留");
    const failingConversation = { async send() { return { text: "unused", itemCount: 1 }; }, async newChat() { throw new Error("thread already has an active writer"); } };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: failingConversation, recordEvent: () => undefined, newConversationRetryDelaysMs: [0, 1, 1] });
    await assert.rejects(() => facade.newConversation(), /active writer/);
    assert.equal(facade.state().conversation.messages[0].content, "删除失败时必须保留");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐修正与南宫提案使用独立自动审批开关并返还原提交人", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "linghu-approval-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json")); let submitted;
    const collaboration = { submitTask(request) { submitted = request; return { tasks: [{ taskId: "linghu-task", evolutionProposalId: request.evolutionProposalId }] }; }, state() { return { tasks: [] }; } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    store.setAutomation("linghu-approval", true);
    let state = facade.createLinghuRepairProposal({ title: "修正持续运行 Bug", content: "依据停点事实修正恢复逻辑", evidence: ["任务停在 test-failed"], impactScope: ["令狐恢复流程"], risks: ["重复恢复"], rollbackPlan: "恢复旧恢复点", acceptanceCriteria: ["任务恢复且不重复"], workspaceState, locale: "zh-CN" });
    const proposal = state.proposals.at(-1);
    assert.equal(proposal.submitterMemberId, "linghu-ancestor");
    state = facade.decideProposal(proposal.proposalId, { decision: "approved", advice: "人工确认令狐方向" });
    state = await facade.dispatch(proposal.proposalId);
    assert.equal(submitted.initiatorMemberId, "linghu-ancestor"); assert.equal(submitted.preferredExecutorMemberId, "linghu-ancestor");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("所有人物共用自身能力升级修订链并在任务中固定审批依据", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "member-self-upgrade-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json")); let submitted;
    const members = [
      { memberId: "nangong-wan", displayName: "南宫婉", enabled: true, kind: "worker" },
      { memberId: "custom-member", displayName: "自定义人物", enabled: true, kind: "worker" },
    ];
    const collaboration = {
      submitTask(request) { submitted = request; return { tasks: [{ taskId: "self-upgrade-task", evolutionProposalId: request.evolutionProposalId }] }; },
      state() { return { members, tasks: [] }; },
    };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest("人物提交能力升级"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const original = state.proposals[0];
    state = facade.decideProposal(original.proposalId, {
      decision: "supplement-required",
      advice: "提交内容不具体：写明问题位置、修正动作和预期结果。",
      feedbackTarget: "submitter-capability",
      capabilityScope: "事实调查与具体提案表达",
    });
    const feedbackApprovalId = state.proposals[0].approvals.at(-1).approvalId;
    state = facade.reviseProposal(original.proposalId, {
      submitterMemberId: "nangong-wan",
      content: "升级南宫婉自身提案模板，强制列出问题位置、修正动作和预期结果。",
      evidence: ["原提案未说明修改位置"], impactScope: ["南宫婉提案生成规则"], risks: ["旧提案兼容"],
      rollbackPlan: "保留旧模板并允许按版本回退。", acceptanceCriteria: ["新提案包含问题位置、修正动作和预期结果"],
    });
    const revised = state.proposals.at(-1);
    assert.equal(revised.version, 2); assert.equal(revised.purpose, "self-capability-upgrade");
    assert.equal(revised.targetMemberId, "nangong-wan"); assert.equal(revised.supersedesProposalId, original.proposalId);
    assert.equal(revised.revisionFeedbackApprovalId, feedbackApprovalId);
    assert.throws(() => facade.reviseProposal(original.proposalId, { submitterMemberId: "custom-member" }), /原提交人/);
    state = facade.decideProposal(revised.proposalId, { decision: "approved", advice: "方案具体，批准升级自身逻辑。" });
    const approvedRevision = state.proposals.find((proposal) => proposal.proposalId === revised.proposalId);
    state = await facade.dispatch(revised.proposalId);
    assert.equal(submitted.preferredExecutorMemberId, "nangong-wan");
    assert.equal(submitted.selfUpgradeTargetMemberId, "nangong-wan");
    assert.equal(submitted.selfUpgradeCapabilityScope, "事实调查与具体提案表达");
    assert.equal(submitted.sourceEvolutionApprovalId, approvedRevision.approvals.at(-1).approvalId);
    assert.match(submitted.confirmedIntent, /必须修改该人物自身使用的规则、提示、工作流或实现/);
    assert.deepEqual(state.proposals.at(-1).distributedTaskIds, ["self-upgrade-task"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动演化开启后原人物依据退回意见只重新提交一个自身升级版本", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "automatic-self-revision-"));
  try {
    const store = new NangongEvolutionStore(path.join(directory, "state.json"));
    const members = [{ memberId: "linghu-ancestor", displayName: "令狐老祖", enabled: true, kind: "worker" }];
    const collaboration = { state() { return { members, tasks: [] }; } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, recordEvent: () => undefined });
    store.setAutomation("evolution", true);
    let state = facade.createLinghuRepairProposal({ title: "令狐提交具体性修正", content: "修正持续任务提交内容", evidence: ["提交内容缺少位置"], impactScope: ["令狐提案流程"], risks: ["模板兼容"], rollbackPlan: "保留旧模板", acceptanceCriteria: ["内容可审批"], workspaceState, locale: "zh-CN" });
    const original = state.proposals.at(-1);
    facade.decideProposal(original.proposalId, { decision: "supplement-required", advice: "写明哪里有问题、修改哪里和预期结果。", feedbackTarget: "submitter-capability", capabilityScope: "修正方案具体性" });
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    state = facade.state();
    const revisions = state.proposals.filter((proposal) => proposal.supersedesProposalId === original.proposalId);
    assert.equal(revisions.length, 1); assert.equal(revisions[0].submitterMemberId, "linghu-ancestor");
    assert.equal(revisions[0].purpose, "self-capability-upgrade"); assert.match(revisions[0].content, /写明哪里有问题/);
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    assert.equal(facade.state().proposals.filter((proposal) => proposal.supersedesProposalId === original.proposalId).length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
