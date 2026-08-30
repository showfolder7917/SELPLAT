import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { NangongEvolutionFacade } from "../../../build/ai-desktop/electron/electron/services/collaboration/nangong-evolution-facade.js";
import { NangongEvolutionStore } from "../../../build/ai-desktop/electron/electron/services/collaboration/nangong-evolution-store.js";
import { EvolutionFlowOrchestrator } from "../../../build/ai-desktop/electron/electron/services/collaboration/evolution-flow-orchestrator.js";
import { HanLiRealAppAcceptanceExecutor } from "../../../build/ai-desktop/electron/electron/services/collaboration/hanli-real-app-acceptance-executor.js";
import { controlledTestRoot } from "./test-paths.mjs";

mkdirSync(controlledTestRoot, { recursive: true });
const workspaceState = { primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: "/workspace", permission: "workspace-write" }] };
const nangongPromptSource = readFileSync(new URL("../electron/main.ts", import.meta.url), "utf8");
const evolutionFacadeSource = readFileSync(new URL("../electron/services/collaboration/nangong-evolution-facade.ts", import.meta.url), "utf8");
const approvalServiceSource = readFileSync(new URL("../electron/services/collaboration/evolution-approval-service.ts", import.meta.url), "utf8");
const distributionServiceSource = readFileSync(new URL("../electron/services/collaboration/evolution-task-distribution-service.ts", import.meta.url), "utf8");
const persistedEvolutionStates = new Map();
function evolutionPersistence(key) {
  return {
    load() { const state = persistedEvolutionStates.get(key); return state ? structuredClone(state) : null; },
    loadLatestConversation() { return null; },
    save(state) { persistedEvolutionStates.set(key, structuredClone(state)); },
  };
}
function evolutionStore(key) { return new NangongEvolutionStore(evolutionPersistence(key)); }
function readPersistedState(key) { return structuredClone(persistedEvolutionStates.get(key)); }
function writePersistedState(key, state) { persistedEvolutionStates.set(key, structuredClone(state)); }
function topicRequest(title = "协同审批分层") { return { title, goal: "把演化方向审批从执行审核中独立出来", scope: ["AI Desktop"], exclusions: ["其他应用"], evidence: ["现有审核只覆盖执行方案"], acceptanceCriteria: ["提案审批与执行审核具有独立记录"], workspaceState, locale: "zh-CN" }; }
function proposalRequest() { return { type: "代码修正", content: "建立独立演化审批入口，审批通过后返还南宫婉分发。", risks: ["历史记录迁移"], rollbackPlan: "保留旧记录并关闭三项自动开关。" }; }
const conversation = { async send(_request, context) { return { text: `南宫婉调查结论：${context}\nNANGONG_TOPIC_META={"title":"当前调查","type":"事实调查","switchTopic":false,"userIntent":"调查当前问题并形成事实依据","tags":["调查","事实依据"],"summary":"围绕当前问题收集事实并形成可继续分析的依据。"}`, itemCount: 1 }; }, async newChat() {} };
const distributionServices = {
  async planDistribution() { return JSON.stringify({ summary: "改动集中在同一业务流程和文件边界，由一个人独立完成可减少合并成本。", units: [{ title: "完成审批后的专项实施", scope: "在同一业务边界内完成提案要求并验证闭环", acceptanceCriteria: ["提案验收条件全部通过"], expectedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"], independentReason: "预计文件高度集中，不拆分可独立修改、回退和验收。" }] }); },
};
let mutationSequence = 0;
function mutation(facade) { return { expectedStateVersion: facade.state().updatedAt, idempotencyKey: `nangong-test-${++mutationSequence}` }; }

test("南宫婉会话直接回答且内部意图不冒充用户原话", () => {
  assert.match(nangongPromptSource, /语气克制、温和、有判断/);
  assert.match(nangongPromptSource, /不要复述、改写或冒充用户原话/);
  assert.match(nangongPromptSource, /短问题直接短答/);
  assert.match(nangongPromptSource, /不使用“结论：”“建议：”“1、2、3”/);
  assert.match(nangongPromptSource, /不把推断或用户陈述说成既定事实/);
  assert.match(nangongPromptSource, /不得声称已形成正式课题、已提交审批或将开始修改/);
  assert.doesNotMatch(nangongPromptSource, /先用“我了解到您的想法是/);
  assert.doesNotMatch(nangongPromptSource, /如果我理解有偏差/);
  assert.match(nangongPromptSource, /userIntent/);
  assert.match(nangongPromptSource, /不得提示用户回复 1 直接修改源码/);
  assert.match(nangongPromptSource, /可恢复的等待确认状态/);
  assert.doesNotMatch(nangongPromptSource, /oneShotReady/);
});

test("韩立审批意见面向普通用户且不得发明产品约束", () => {
  assert.match(evolutionFacadeSource, /审批意见直接面向普通用户/);
  assert.match(evolutionFacadeSource, /先用自然语言说明哪里不完整或为什么可以通过/);
  assert.match(evolutionFacadeSource, /只能引用提案、专题或源码调查中已经存在的事实/);
  assert.match(evolutionFacadeSource, /不得自行发明数量上限、页面规则或验收要求/);
});

test("审批、编排和分发服务不再互相代替职责", () => {
  const orchestrator = new EvolutionFlowOrchestrator();
  assert.equal(orchestrator.next({ status: "pending-approval", distributedTaskIds: [] }), "await-approval");
  assert.equal(orchestrator.next({ status: "approved", distributedTaskIds: [] }), "dispatch");
  assert.equal(orchestrator.next({ status: "executing", distributedTaskIds: ["task-1"] }), "monitor-execution");
  assert.doesNotMatch(approvalServiceSource, /EvolutionTaskDistributionService|\.submitTask\(|\.dispatch\(/);
  assert.doesNotMatch(distributionServiceSource, /\.decide\(|EvolutionApprovalService/);
  assert.doesNotMatch(evolutionFacadeSource, /#dispatchOnce|#store\.decide\(/);
  assert.match(evolutionFacadeSource, /EvolutionApprovalService/);
  assert.match(evolutionFacadeSource, /EvolutionFlowOrchestrator/);
  assert.match(evolutionFacadeSource, /EvolutionTaskDistributionService/);
});

test("审批服务按发生顺序发布申请、决定和补充事实且不会提前分发", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-approval-events-"));
  try {
    const events = [];
    let submitted = 0;
    const facade = new NangongEvolutionFacade({
      store: evolutionStore(path.join(directory, "state.json")),
      collaboration: { state() { return { members: [{ memberId: "nangong-wan", enabled: true }], tasks: [] }; }, submitTask() { submitted += 1; return { tasks: [] }; } },
      conversation,
      ...distributionServices,
      recordEvent: () => undefined,
      recordTimelineEvent: (event) => events.push(event),
    });
    let state = facade.createTopic(topicRequest("审批事件顺序"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const originalId = state.proposals[0].proposalId;
    state = facade.decideProposal(originalId, { mutation: mutation(facade), decision: "supplement-required", advice: "补充具体影响范围" });
    state = facade.reviseProposal(originalId, {
      mutation: mutation(facade), submitterMemberId: "nangong-wan", content: "已补充具体影响范围", evidence: ["组件与文件范围"],
      impactScope: ["AI Desktop"], risks: ["无"], rollbackPlan: "撤销新版本", acceptanceCriteria: ["范围明确"],
    });
    assert.deepEqual(events.map((event) => event.fact.action), [
      "审批申请", "审批申请", "审批退回补充", "等待手动补充审批材料", "补充后再次申请", "补充材料已重新提交",
    ]);
    assert.equal(events[0].fact.actor.displayName, "南宫婉");
    assert.equal(events[0].fact.recipients[0].displayName, "韩立");
    assert.equal(events[2].fact.actor.displayName, "韩立");
    assert.equal(events[2].fact.recipients[0].displayName, "南宫婉");
    assert.equal(events[2].fact.contentRole, "approval-reason");
    assert.equal(events[3].fact.contentRole, "status");
    assert.doesNotMatch(events[3].fact.content, /补充具体影响范围/);
    assert.equal(events[4].fact.contentRole, "approval-content");
    assert.equal(events[5].fact.contentRole, "analysis-output");
    assert.match(events[5].fact.content, /组件与文件范围/);
    assert.equal(events.filter((event) => event.fact.content === "补充具体影响范围").length, 1);
    assert.equal(events.some((event) => event.fact.kind === "distribution"), false);
    assert.equal(submitted, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动演化、两个来源审批和自动分发四项开关独立持久化", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-switches-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.setAutomation("evolution", true); store.setAutomation("nangong-approval", true);
    const state = evolutionStore(path.join(directory, "state.json")).state();
    assert.equal(state.automaticEvolutionEnabled, true); assert.equal(state.automaticNangongApprovalEnabled, true); assert.equal(state.automaticLinghuApprovalEnabled, false); assert.equal(state.automaticExecutionEnabled, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("一次性完整流程独立持久化且不改写四个长期自动开关", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-state-"));
  try {
    const filePath = path.join(directory, "state.json");
    const store = evolutionStore(filePath);
    store.setAutomation("evolution", true);
    store.setAutomation("linghu-approval", true);
    const before = store.state();
    let state = store.beginOneShotRun(workspaceState, "zh-CN");
    assert.deepEqual([
      state.automaticEvolutionEnabled,
      state.automaticNangongApprovalEnabled,
      state.automaticLinghuApprovalEnabled,
      state.automaticExecutionEnabled,
    ], [before.automaticEvolutionEnabled, before.automaticNangongApprovalEnabled, before.automaticLinghuApprovalEnabled, before.automaticExecutionEnabled]);
    assert.equal(state.oneShotRun.status, "running");
    state = store.finishOneShotRun();
    const restored = evolutionStore(filePath).state();
    assert.equal(restored.oneShotRun.status, "completed");
    assert.equal(restored.oneShotRun.phase, "completed");
    assert.equal(restored.automaticEvolutionEnabled, true);
    assert.equal(restored.automaticLinghuApprovalEnabled, true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("一次性流程从同一专题提案卡点原位恢复且不打开长期自动开关", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-resume-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.beginOneShotRun(workspaceState, "zh-CN");
    let state = store.createTopic(topicRequest("原位恢复专题"));
    const topicId = state.activeTopicId;
    state = store.createProposal(topicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.updateOneShotRun("approving", "han-li", "韩立", "正在审批", topicId, proposalId);
    store.decide(proposalId, "supplement-required", "补充实查证据", "automatic-han-li", []);
    store.blockOneShotRun("等待重新调查");
    state = store.resumeOneShotRun();
    assert.equal(state.oneShotRun.runId.startsWith("evolution-one-shot-"), true);
    assert.equal(state.oneShotRun.topicId, topicId);
    assert.equal(state.oneShotRun.proposalId, proposalId);
    assert.equal(state.oneShotRun.status, "running");
    assert.equal(state.oneShotRun.phase, "revising");
    assert.match(state.oneShotRun.action, /重新调查/);
    assert.deepEqual([state.automaticEvolutionEnabled, state.automaticNangongApprovalEnabled, state.automaticLinghuApprovalEnabled, state.automaticExecutionEnabled], [false, false, false, false]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动控制台转人工后只观察且必须明确恢复才能继续", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-handover-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.controlAutomation("start");
    assert.equal(state.automaticEvolutionEnabled, true);
    state = store.controlAutomation("handover");
    assert.equal(state.automaticEvolutionEnabled, false);
    assert.equal(state.automationRuntime.status, "paused");
    assert.match(state.automationRuntime.stopReason, /人工接管.*仅观察/);
    state = store.controlAutomation("resume");
    assert.equal(state.automaticEvolutionEnabled, true);
    assert.equal(state.automationRuntime.status, "running");
    assert.equal(state.automationRuntime.stopReason, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("专题状态只读取当前版本并拒绝旧版本兼容补造", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-current-state-only-"));
  try {
    const filePath = path.join(directory, "state.json");
    writePersistedState(filePath, { version: 7, automaticApprovalEnabled: true, topics: [], proposals: [] });
    const state = evolutionStore(filePath).state();
    assert.equal(state.version, 8);
    assert.equal(state.automaticNangongApprovalEnabled, false);
    assert.deepEqual(state.topics, []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("专题提交同时发布可校验前后版本的工作台增量事实", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-workbench-change-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let observed = null;
    store.subscribe((state, reason, topicId, proposalId, previousState) => { observed = { state, reason, topicId, proposalId, previousState }; });
    const current = store.createTopic(topicRequest("实时专题状态"));
    assert.equal(observed.reason, "topic.created");
    assert.equal(observed.previousState.topics.length, 0);
    assert.equal(observed.state.topics.length, 1);
    assert.equal(observed.topicId, current.activeTopicId);
    assert.equal(observed.proposalId, null);
    assert.equal(observed.previousState.updatedAt.length > 0, true);
    assert.equal(observed.state.updatedAt, current.updatedAt);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("清空测试数据删除专题运行历史并保留人物对话、自动化配置和语言", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-clear-test-data-"));
  try {
    const filePath = path.join(directory, "state.json");
    const store = evolutionStore(filePath);
    store.configureAutomation({ maxRoundsPerTopic: 9, maxCorrectionRounds: 4, locale: "ja", workspaceState });
    store.appendConversation("user", "这是用于韩立训练的用户原话。", []);
    store.appendConversation("nangong", "这是南宫婉对用户原话的回答。", []);
    let state = store.createTopic(topicRequest());
    store.createProposal(state.topics[0].topicId, proposalRequest());
    assert.ok(store.clearTestData() >= 2);
    state = evolutionStore(filePath).state();
    assert.equal(state.topics.length, 0);
    assert.equal(state.proposals.length, 0);
    assert.deepEqual(state.conversation.messages.map((message) => message.content), ["这是用于韩立训练的用户原话。", "这是南宫婉对用户原话的回答。"]);
    assert.deepEqual(state.automationSettings, { maxRoundsPerTopic: 9, maxCorrectionRounds: 4 });
    assert.equal(state.automationContext.locale, "ja");
    assert.equal(state.automationContext.workspaceState, null);
    assert.equal(state.automaticEvolutionEnabled, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动审批无人工偏好时退回补充，人工决定形成版本化偏好", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-approval-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest()); state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposal = state.proposals[0]; state = facade.autoApprove(proposal.proposalId);
    assert.equal(state.proposals[0].status, "supplement-required");
    state = facade.decideProposal(proposal.proposalId, { mutation: mutation(facade), decision: "approved", advice: "人工确认方向正确" });
    assert.equal(state.preferenceSnapshotVersion, 1);
    state = facade.createTopic(topicRequest("相同类型第二课题")); state = facade.createProposal(state.topics.at(-1).topicId, proposalRequest());
    state = facade.autoApprove(state.proposals.at(-1).proposalId);
    assert.equal(state.proposals.at(-1).status, "approved"); assert.equal(state.proposals.at(-1).approvals.at(-1).referencedApprovalIds.length, 1);
    state = facade.decideProposal(state.proposals.at(-1).proposalId, { mutation: mutation(facade), decision: "rejected", advice: "用户纠正自动结论" });
    assert.equal(state.proposals.at(-1).status, "rejected"); assert.equal(state.preferenceSnapshotVersion, 2);
    assert.equal(state.proposals.at(-1).approvals.at(-1).source, "manual-user");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("审批、验收与返修统一使用专题版本和幂等写入口", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-mutation-coordinator-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const collaboration = { state() { return { members: [{ memberId: "nangong-wan", displayName: "南宫婉", enabled: true, kind: "worker" }], tasks: [] }; } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest("统一专题写入口"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    const approvalMutation = mutation(facade);
    state = facade.decideProposal(proposalId, { mutation: approvalMutation, decision: "supplement-required", advice: "补齐验证事实" });
    assert.equal(state.proposals[0].approvals.length, 1);
    state = facade.decideProposal(proposalId, { mutation: approvalMutation, decision: "supplement-required", advice: "不应重复写入" });
    assert.equal(state.proposals[0].approvals.length, 1, "已完成幂等键不得重复形成审批记录");
    assert.throws(() => facade.reviseProposal(proposalId, {
      mutation: { expectedStateVersion: "stale-version", idempotencyKey: "stale-revision" },
      submitterMemberId: "nangong-wan", content: "补齐验证事实", evidence: ["新增事实"], impactScope: ["AI Desktop"], risks: ["无"], rollbackPlan: "撤销新版本", acceptanceCriteria: ["审批记录只生成一次"],
    }), /状态已更新/);
    state = facade.reviseProposal(proposalId, {
      mutation: mutation(facade), submitterMemberId: "nangong-wan", content: "补齐验证事实", evidence: ["新增事实"], impactScope: ["AI Desktop"], risks: ["无"], rollbackPlan: "撤销新版本", acceptanceCriteria: ["审批记录只生成一次"],
    });
    assert.equal(state.proposals.length, 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("审批通过后才由南宫婉分发并固定 proposalId", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json")); let submitted; let planningWorkspace;
    const collaboration = { submitTask(request) { submitted = request; return { tasks: [{ taskId: "collab-1", evolutionProposalId: request.evolutionProposalId }] }; } };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation, recordEvent: () => undefined,
      async planDistribution(_prompt, receivedWorkspace) { planningWorkspace = receivedWorkspace; return distributionServices.planDistribution(); },
    });
    let state = facade.createTopic(topicRequest()); state = facade.createProposal(state.topics[0].topicId, proposalRequest()); const proposalId = state.proposals[0].proposalId;
    assert.equal(state.automationContext.workspaceState, null, "手动返还不应要求先配置自动演化工作区");
    await assert.rejects(() => facade.dispatch(proposalId), /只有审批通过/);
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" }); state = await facade.dispatch(proposalId);
    assert.deepEqual(planningWorkspace, workspaceState);
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
    const store = evolutionStore(statePath);
    const collaboration = { submitTask() { throw new Error("缺少工作区时不得创建任务"); } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest());
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    const persisted = readPersistedState(statePath);
    persisted.topics[0].workspaceState = null;
    writePersistedState(statePath, persisted);
    const restored = new NangongEvolutionFacade({ store: evolutionStore(statePath), collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    await assert.rejects(() => restored.dispatch(proposalId), /当前专题缺少可用的实施工作区/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("生产分发会话显式使用专题工作区且令狐不再参与常规分发审核", () => {
  assert.match(nangongPromptSource, /planDistribution: async \(prompt, workspaceState, locale, emit\)[\s\S]*nangongDistributionCodex![\s\S]*mergeWorkspaceState\(workspaces\.read\(\), workspaceState\)/);
  assert.doesNotMatch(nangongPromptSource, /planDistribution: async[^\n]*automationContext\.workspaceState/);
  assert.doesNotMatch(nangongPromptSource, /linghuDistributionAuditCodex|auditDistribution:/);
  assert.match(distributionServiceSource, /validateDistributionPlan/);
  assert.match(distributionServiceSource, /nangong\.distribution_validation\.completed/);
});

test("预计修改文件重叠时程序阻止多人重复分发", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-overlap-audit-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let submitted = 0;
    const collaboration = { submitTask() { submitted += 1; return { tasks: [] }; } };
    const overlappingPlan = JSON.stringify({ summary: "错误地按影响范围拆成两个任务。", units: [
      { title: "修改按钮", scope: "调整同一工具栏按钮", acceptanceCriteria: ["按钮可用"], expectedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"], independentReason: "页面改动" },
      { title: "验证按钮", scope: "验证同一工具栏按钮", acceptanceCriteria: ["按钮通过测试"], expectedFiles: ["apps/ai-desktop/src/variants/developer/DeveloperApp.tsx"], independentReason: "测试改动" },
    ] });
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation, recordEvent: () => undefined,
      async planDistribution() { return overlappingPlan; },
    });
    let state = facade.createTopic(topicRequest("单按钮样式修正"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "方向通过" });
    await assert.rejects(() => facade.dispatch(proposalId), /阻止分发/);
    assert.equal(submitted, 0);
    assert.equal(facade.state().proposals[0].distributionPlan.validation.decision, "revise");
    assert.match(facade.state().proposals[0].distributionPlan.validation.findings.join("；"), /同时属于/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("旧分发 audit 字段一次性迁移为程序 validation 且保留专题事实", async () => {
  const key = "nangong-distribution-validation-migration";
  const store = evolutionStore(key);
  const collaboration = { submitTask(request) { return { tasks: [{ taskId: "migration-task", evolutionProposalId: request.evolutionProposalId }] }; } };
  const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
  let state = facade.createTopic(topicRequest("分发校验迁移"));
  state = facade.createProposal(state.topics[0].topicId, proposalRequest());
  const proposalId = state.proposals[0].proposalId;
  facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
  await facade.dispatch(proposalId);
  const legacy = readPersistedState(key);
  const validation = legacy.proposals[0].distributionPlan.validation;
  legacy.proposals[0].distributionPlan.audit = { ...validation, auditedAt: validation.validatedAt };
  delete legacy.proposals[0].distributionPlan.validation;
  writePersistedState(key, legacy);
  const restored = evolutionStore(key).state();
  assert.equal(restored.topics[0].title, "分发校验迁移");
  assert.equal(restored.proposals[0].distributionPlan.validation.decision, "passed");
  assert.equal("audit" in readPersistedState(key).proposals[0].distributionPlan, false);
});

test("全部执行结果返回南宫婉后才封存同一轮并一次性交给令狐", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-round-collection-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
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
    });
    let state = facade.createTopic(topicRequest("南宫婉轮次收集"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "批准整轮收集" });
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
    const store = evolutionStore(path.join(directory, "state.json"));
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
    state = facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "supplement-required", advice: "补充完成记录验收依据" });
    assert.equal(state.proposals[0].approvals.at(-1).source, "manual-user");
    state = facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "事实完整，批准执行" });
    state = await facade.dispatch(proposalId);
    assert.deepEqual(state.proposals[0].distributedTaskIds, [distributedTaskId]);
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    state = facade.state();
    assert.equal(state.proposals[0].status, "pending-acceptance");
    assert.equal(state.proposals[0].resultSummary, "全部关联任务已经完成，等待韩立按真实用户路径验收结果。");
    assert.equal(state.topics.length, 1);
    const acceptancePlan = { version: 1, planId: "completed-plan", topicId: state.topics[0].topicId, proposalId, summary: "检查完成结果", concerns: ["真实操作"], checks: [{ checkId: "completed-check", category: "交互", target: "专题工作台", action: "检查结果", expected: "真实界面符合目标", evidenceRequired: "截图", operations: [{ type: "capture", label: "完成结果" }] }], generatedAt: new Date().toISOString() };
    store.recordAcceptancePlan(acceptancePlan);
    store.recordAcceptanceRun({ version: 1, runId: "completed-run", planId: acceptancePlan.planId, topicId: acceptancePlan.topicId, proposalId, status: "passed", windowTitle: "专题工作台", initialBounds: { x: 0, y: 0, width: 1320, height: 880 }, finalBounds: { x: 0, y: 0, width: 1320, height: 880 }, stepResults: [{ checkId: "completed-check", operationIndex: 0, operation: { type: "capture", label: "完成结果" }, status: "passed", actual: "截图已保存", screenshotAttachmentId: "shot-completed", occurredAt: new Date().toISOString() }], evidenceAttachmentIds: ["shot-completed"], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    state = facade.decideResult(proposalId, { mutation: mutation(facade), decision: "approved", advice: "真实操作和视觉检查符合目标。" });
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
    const store = evolutionStore(path.join(directory, "state.json"));
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
    const store = evolutionStore(path.join(directory, "state.json"));
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
    const store = evolutionStore(path.join(directory, "state.json"));
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

test("南宫婉缺少回合元数据时仍保留完整回复且不伪装成发送失败", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-missing-meta-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const plainConversation = { async send() { return { text: "我已看到这个问题，会先继续核对事实。", itemCount: 1 }; }, async newChat() {} };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: plainConversation, recordEvent: () => undefined });
    const state = await facade.sendConversationMessage({ message: "继续调查", workspaceState, locale: "zh-CN" });
    assert.equal(state.conversation.messages.length, 2);
    assert.equal(state.conversation.messages[1].content, "我已看到这个问题，会先继续核对事实。");
    assert.equal(state.conversation.messages[0].inferredIntent, undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("人物实时会话按稳定消息标识和回复关系向下追加且允许重复正文", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-realtime-timeline-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const plainConversation = { async send() { return { text: "收到。", itemCount: 1 }; }, async newChat() {} };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: plainConversation, recordEvent: () => undefined });
    await facade.sendConversationMessage({ clientMessageId: "client-message-1", message: "1", workspaceState, locale: "zh-CN" });
    const state = await facade.sendConversationMessage({ clientMessageId: "client-message-2", message: "1", workspaceState, locale: "zh-CN" });
    assert.deepEqual(state.conversation.messages.map((message) => message.sequenceNumber), [0, 1, 2, 3]);
    assert.deepEqual(state.conversation.messages.filter((message) => message.role === "user").map((message) => message.messageId), ["client-message-1", "client-message-2"]);
    assert.equal(state.conversation.messages[1].replyToMessageId, "client-message-1");
    assert.equal(state.conversation.messages[3].replyToMessageId, "client-message-2");
    assert.ok(state.conversation.messages.every((message) => message.deliveryStatus === "completed"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("训练归档失败进入统一异常旁路且不把已完成聊天标记为发送失败", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-training-archive-failure-"));
  try {
    const failures = [];
    const store = evolutionStore(path.join(directory, "state.json"));
    const plainConversation = { async send() { return { text: "聊天回复已经完成。", itemCount: 1 }; }, async newChat() {} };
    const memory = {
      buildNangongContext() { return "当前运行态上下文"; },
      syncConversation() { throw new Error("training database unavailable"); },
    };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: plainConversation, memory, recordEvent: () => undefined, recordFailure: (failure) => failures.push(failure) });
    const state = await facade.sendConversationMessage({ clientMessageId: "client-training-failure", message: "先完成聊天", workspaceState, locale: "zh-CN" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.conversation.messages[0].deliveryStatus, "completed");
    assert.equal(state.conversation.messages[1].content, "聊天回复已经完成。");
    assert.equal(failures.length, 1);
    assert.equal(failures[0].operation, "archive_completed_conversation_round");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("人物回复失败只原位标记用户消息且不产生训练归档", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-realtime-failure-"));
  try {
    let archiveCount = 0;
    const store = evolutionStore(path.join(directory, "state.json"));
    const failedConversation = { async send() { throw new Error("conversation unavailable"); }, async newChat() {} };
    const memory = { buildNangongContext() { return ""; }, syncConversation() { archiveCount += 1; } };
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation: failedConversation, memory, recordEvent: () => undefined });
    await assert.rejects(() => facade.sendConversationMessage({ clientMessageId: "client-send-failure", message: "不要丢失原文", workspaceState, locale: "zh-CN" }), /conversation unavailable/);
    const state = facade.state();
    assert.equal(state.conversation.messages.length, 1);
    assert.equal(state.conversation.messages[0].messageId, "client-send-failure");
    assert.equal(state.conversation.messages[0].deliveryStatus, "failed");
    assert.equal(archiveCount, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("没有南宫婉明确邀请时回复 1 不启动流程或直接修改源码", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-not-ready-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    await facade.sendConversationMessage({ message: "继续调查", workspaceState, locale: "zh-CN" });
    const state = await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    assert.equal(state.topics.length, 0);
    assert.equal(state.oneShotRun, null);
    assert.equal(state.oneShotConfirmation ?? null, null);
    assert.equal(state.conversation.messages.at(-2).inferredIntent, undefined);
    assert.match(state.conversation.messages.at(-1).content, /当前没有等待确认的一次性演化/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("已有真实运行时再次回复 1 返回可理解说明而不是发送失败", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-live-conflict-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.beginOneShotRun(workspaceState, "zh-CN");
    const invited = store.appendConversation("nangong", "当前事实已经明确，若确认启动请回复 1。", []);
    store.setOneShotConfirmation(invited.conversation.messages.at(-1).messageId);
    const facade = new NangongEvolutionFacade({ store, collaboration: { state() { return { members: [], tasks: [] }; } }, conversation, recordEvent: () => undefined });
    const state = await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    assert.equal(state.oneShotRun.status, "running");
    assert.equal(state.oneShotRun.phase, "preparing-topic");
    assert.match(state.conversation.messages.at(-1).content, /上一轮演化任务仍在处理/);
    assert.match(state.conversation.messages.at(-1).content, /任务协作群/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("数据库遗留运行没有真实执行人时自动结束旧状态并继续本次确认", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-orphan-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.beginOneShotRun(workspaceState, "zh-CN");
    store.updateOneShotRun("executing", "mo-caihuan", "墨彩环", "正在执行已分发任务", null, null);
    const invited = store.appendConversation("nangong", "当前事实已经明确，若确认启动请回复 1。", []);
    store.setOneShotConfirmation(invited.conversation.messages.at(-1).messageId);
    const events = [];
    const facade = new NangongEvolutionFacade({
      store,
      collaboration: { state() { return { members: [], tasks: [] }; } },
      conversation,
      recordEvent: (eventType, payload) => events.push({ eventType, payload }),
    });
    const state = await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    assert.equal(events.some((event) => event.eventType === "nangong.evolution.orphan_run_retired"), true);
    assert.equal(state.archiveRecords.some((record) => record.eventType === "one-shot.orphan-retired"), true);
    assert.notEqual(state.oneShotRun.action, "正在执行已分发任务");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉明确邀请后回复 1 整理课题并连续推进到真实协作执行", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-start-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const tasks = [];
    const collaboration = {
      state() { return { members: [{ memberId: "mo-caihuan", displayName: "墨彩环", enabled: true, kind: "worker" }, { memberId: "doctor-mo", displayName: "墨大夫", enabled: true, kind: "worker" }], tasks }; },
      submitTask(request) {
        tasks.push({ taskId: "one-shot-task", evolutionProposalId: request.evolutionProposalId, state: "executing", phase: "implementing", executorMemberId: "mo-caihuan", currentHandler: { memberId: "doctor-mo", displayName: "墨大夫" }, originalExecutor: { memberId: "doctor-mo", displayName: "墨大夫" }, snapshot: { title: request.title }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return this.state();
      },
    };
    const readyConversation = {
      async send(request) {
        if (request.message.includes("仅返回 JSON")) return { text: JSON.stringify({ title: "一次性演化课题", goal: "修复当前已确认问题", scope: ["AI Desktop"], evidence: ["用户和南宫婉已确认问题事实"], acceptanceCriteria: ["沿现有流程执行并完成真实验收"] }), itemCount: 1 };
        return { text: "事实、范围和验收条件已经明确。若确认启动本轮完整演化，请回复 1。\n<!-- SELPLAT_CORPUS_META {\"title\":\"一次性演化\",\"type\":\"流程确认\",\"intent\":\"确认当前问题事实与实施范围\",\"tags\":[\"一次性流程\",\"演化课题\"],\"summary\":\"事实成熟后邀请用户启动一次完整演化流程。\"} -->", itemCount: 1 };
      },
      async newChat() {},
    };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation: readyConversation, ...distributionServices, recordEvent: () => undefined,
      hanLi: { async send() { return JSON.stringify({ decision: "approved", advice: "事实、范围、风险、回退和验收条件完整，同意沿既有流程执行。" }); } },
    });
    const invited = await facade.sendConversationMessage({ message: "请确认现在是否可以进入完整流程", workspaceState, locale: "zh-CN" });
    assert.equal(invited.oneShotConfirmation.status, "awaiting-user-confirmation");
    assert.equal(invited.oneShotConfirmation.invitationMessageId, invited.conversation.messages.at(-1).messageId);
    assert.equal(evolutionStore(path.join(directory, "state.json")).state().oneShotConfirmation.status, "awaiting-user-confirmation");
    const state = await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    assert.equal(state.oneShotConfirmation, null);
    assert.equal(state.topics.length, 1);
    assert.equal(state.proposals.length, 1);
    assert.equal(state.proposals[0].approvals.at(-1).source, "automatic-han-li");
    assert.deepEqual(state.proposals[0].distributedTaskIds, ["one-shot-task"]);
    assert.equal(state.oneShotRun.status, "running");
    assert.equal(state.oneShotRun.phase, "executing");
    assert.equal(state.oneShotRun.actorName, "墨彩环");
    const activity = [...state.archiveRecords].reverse().find((record) => record.eventType === "one-shot.activity");
    assert.equal(activity.actor, "codex");
    assert.equal(activity.payload.actorName, "墨彩环");
    assert.deepEqual([state.automaticEvolutionEnabled, state.automaticNangongApprovalEnabled, state.automaticLinghuApprovalEnabled, state.automaticExecutionEnabled], [false, false, false, false]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("一次性流程遇到同一集成归属阻塞时只登记停点且不直接重试", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-integration-blocked-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const failures = [];
    let recoveryRequests = 0;
    const tasks = [];
    const collaboration = {
      state() { return { members: [{ memberId: "mo-caihuan", displayName: "墨彩环", enabled: true, kind: "worker" }], tasks }; },
      submitTask(request) {
        const detail = "合并前本地修改归属门禁阻塞：apps/ai-desktop/electron/main.ts 未登记到任何待集成任务";
        tasks.push({
          taskId: "blocked-integration-task", evolutionProposalId: request.evolutionProposalId, state: "blocked", phase: "verifying",
          executorMemberId: "mo-caihuan", currentHandler: { memberId: "linghu-ancestor", displayName: "令狐老祖" }, originalExecutor: { memberId: "mo-caihuan", displayName: "墨彩环" },
          snapshot: { title: request.title }, blockingReason: detail, recoveryTargetState: "ready-for-integration",
          integrationFailure: { kind: "local-change-ownership", detail, conflictFiles: ["apps/ai-desktop/electron/main.ts"], baseSha: "base", resultSha: "result", generation: 1, occurredAt: new Date().toISOString() },
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        return this.state();
      },
      async recoverTask(taskId) {
        recoveryRequests += 1;
        const task = tasks.find((item) => item.taskId === taskId);
        task.state = "ready-for-integration";
        task.phase = "verifying";
        task.blockingReason = null;
        task.integrationFailure = null;
        task.updatedAt = new Date().toISOString();
        return this.state();
      },
    };
    const readyConversation = {
      async send(request) {
        if (request.message.includes("仅返回 JSON")) return { text: JSON.stringify({ title: "集成阻塞课题", goal: "验证相同失败不重复执行", scope: ["AI Desktop"], evidence: ["已确认本地修改没有任务归属"], acceptanceCriteria: ["同一事实只登记一次并保留恢复点"] }), itemCount: 1 };
        return { text: "事实已经成熟。若确认启动本轮完整演化，请回复 1。\n<!-- SELPLAT_CORPUS_META {\"title\":\"集成阻塞\",\"type\":\"技术治理\",\"intent\":\"阻止同一失败循环\",\"tags\":[\"集成\",\"去重\"],\"summary\":\"确认集成阻塞事实后启动一次性流程。\"} -->", itemCount: 1 };
      },
      async newChat() {},
    };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation: readyConversation, ...distributionServices,
      recordEvent: () => undefined, recordFailure: (failure) => failures.push(failure),
      hanLi: { async send() { return JSON.stringify({ decision: "approved", advice: "事实和验收条件完整。" }); } },
    });
    await facade.sendConversationMessage({ message: "请确认进入本轮流程", workspaceState, locale: "zh-CN" });
    await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    const state = facade.state();
    assert.equal(state.oneShotRun.status, "blocked");
    assert.equal(recoveryRequests, 0);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].operation, "one_shot_task_blocked:local-change-ownership");
    assert.equal(failures[0].details.executorMemberId, "mo-caihuan");
    assert.match(state.oneShotRun.blockingReason, /墨彩环负责/);
    assert.match(state.oneShotRun.blockingReason, /版本集成阶段/);
    assert.match(state.oneShotRun.blockingReason, /main\.ts 未登记/);

    const explicitlyResumed = await facade.resumeOneShotRun();
    assert.equal(recoveryRequests, 1);
    assert.equal(explicitlyResumed.oneShotRun.status, "running");

    tasks[0].state = "test-failed";
    tasks[0].blockingReason = "统一测试失败：按钮忙碌态断言不通过";
    tasks[0].integrationFailure = { ...tasks[0].integrationFailure, kind: "verification", detail: tasks[0].blockingReason, conflictFiles: [] };
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    const waitingForLinghu = facade.state();
    assert.equal(waitingForLinghu.oneShotRun.status, "running");
    assert.equal(waitingForLinghu.oneShotRun.phase, "testing");
    assert.equal(waitingForLinghu.oneShotRun.actorName, "令狐老祖");
    assert.match(waitingForLinghu.oneShotRun.action, /统一测试失败/);
    assert.equal(recoveryRequests, 1);
    assert.equal(failures.length, 2);
    assert.equal(failures[1].operation, "one_shot_task_waiting_for_linghu:verification");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("一次性流程捕获的 AI JSON 解析失败仍登记为技术异常并保留恢复点", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-technical-failure-"));
  try {
    const failures = [];
    const store = evolutionStore(path.join(directory, "state.json"));
    const readyConversation = {
      async send(request) {
        if (request.message.includes("仅返回 JSON")) return { text: JSON.stringify({ title: "异常登记课题", goal: "验证失败登记", scope: ["AI Desktop"], evidence: ["已确认复现事实"], acceptanceCriteria: ["失败进入统一异常中心"] }), itemCount: 1 };
        return { text: "事实已经成熟。若确认启动本轮完整演化，请回复 1。\nNANGONG_TOPIC_META={\"title\":\"异常登记\",\"type\":\"技术治理\",\"switchTopic\":false,\"userIntent\":\"验证失败登记\",\"tags\":[\"异常中心\"],\"summary\":\"邀请启动一次性流程。\"}", itemCount: 1 };
      },
      async newChat() {},
    };
    const collaboration = { state() { return { members: [{ memberId: "nangong-wan", displayName: "南宫婉", enabled: true, kind: "worker" }], tasks: [] }; } };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation: readyConversation, recordEvent: () => undefined,
      recordFailure: (failure) => failures.push(failure),
      hanLi: { async send() { return '{"decision":"approved","advice":"缺少结束引号}'; } },
    });
    await facade.sendConversationMessage({ message: "确认进入流程", workspaceState, locale: "zh-CN" });
    const state = await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    assert.equal(state.oneShotRun.status, "blocked");
    assert.equal(failures.length, 1);
    assert.equal(failures[0].kind, "technical");
    assert.equal(failures[0].operation, "review_one_shot_proposal");
    assert.equal(failures[0].correlationId, state.activeTopicId);
    assert.match(failures[0].fingerprint, /nangong-one-shot:.*:review_one_shot_proposal/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("专题群人物消息复用南宫婉会话并只向专题档案写入短预览", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-topic-group-message-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const facade = new NangongEvolutionFacade({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest("专题群消息回流"));
    const topicId = state.activeTopicId;
    const originalArchiveCount = state.archiveRecords.length;
    state = await facade.sendConversationMessage({ topicId, message: "请南宫婉说明当前专题下一步。", workspaceState, locale: "zh-CN" });
    assert.equal(state.conversation.messages.at(-2).content, "请南宫婉说明当前专题下一步。");
    assert.equal(state.archiveRecords.length, originalArchiveCount + 1);
    const groupRecord = state.archiveRecords.at(-1);
    assert.equal(groupRecord.topicId, topicId);
    assert.equal(groupRecord.eventType, "conversation.topic_group_replied");
    assert.equal(groupRecord.category, "source");
    assert.equal(groupRecord.payload.userPreview, "请南宫婉说明当前专题下一步。");
    assert.match(groupRecord.payload.nangongPreview, /南宫婉调查结论/);
    assert.equal(groupRecord.payload.nextOwner, "han-li");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉根据当前对话生成五项可编辑草稿但不直接保存课题", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-topic-draft-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const draftConversation = {
      async send(request) {
        if (request.message.includes("仅返回 JSON")) return { text: JSON.stringify({ title: "令狐持续修正演化", goal: "保持 Bug 修复链稳定运行", scope: ["AI Desktop"], evidence: ["用户陈述：草稿需要从当前对话生成", "南宫婉调查：修正方案需要审批"], acceptanceCriteria: ["五项内容可编辑后再保存"] }), itemCount: 1 };
        return { text: "南宫婉调查：修正方案需要先进入审批。\nNANGONG_TOPIC_META={\"title\":\"修正方案审批\",\"type\":\"事实调查\",\"switchTopic\":false,\"userIntent\":\"根据当前对话生成可编辑课题草稿\",\"tags\":[\"课题草稿\",\"审批\"],\"summary\":\"先调查修正方案的审批边界，再由用户确认草稿。\"}", itemCount: 1 };
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
    const store = evolutionStore(path.join(directory, "state.json"));
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
    assert.equal(evolutionStore(path.join(directory, "state.json")).state().conversation.messages.length, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立验收计划由专题语义生成并只登记为待执行档案", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-acceptance-plan-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let receivedPrompt = "";
    const facade = new NangongEvolutionFacade({
      store, collaboration: {}, conversation, recordEvent: () => undefined,
      async planAcceptance(prompt) {
        receivedPrompt = prompt;
        return JSON.stringify({
          summary: "确认侧栏在真实窗口内可完整操作。",
          concerns: ["侧栏内容不能被截断", "最后一个按钮必须可达"],
          checks: [
            { category: "滚动可达性", target: "连接与执行设置侧栏", action: "缩小窗口后滚动到侧栏底部并查看最后一个按钮", expected: "滚动能力可发现且末项可达", evidenceRequired: "缩小窗口和滚动到底部后的截图", operations: [{ type: "resize-window", width: 980, height: 680 }, { type: "scroll", target: "连接与执行设置", direction: "down", amount: 900 }, { type: "capture", label: "侧栏底部" }] },
            { category: "状态反馈", target: "一键清空测试数据按钮", action: "确认按钮在真实设置页可见但不自动触发破坏动作", expected: "按钮文字清晰且保持未触发", evidenceRequired: "按钮可见截图", operations: [{ type: "inspect-text", text: "一键清空测试数据" }, { type: "capture", label: "危险操作保持未触发" }] },
          ],
        });
      },
    });
    let state = facade.createTopic(topicRequest("设置侧栏滚动验收"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    store.markProgress(proposalId, "pending-acceptance", "实现与定向测试完成，等待真实界面验收。");
    const plan = await facade.generateAcceptancePlan(proposalId);
    state = facade.state();
    assert.match(receivedPrompt, /设置侧栏滚动验收/);
    assert.match(receivedPrompt, /表格分页与滚动/);
    assert.equal(plan.checks.length, 2);
    assert.equal(plan.checks[0].operations[0].type, "resize-window");
    assert.equal(state.proposals[0].status, "pending-acceptance");
    const record = state.archiveRecords.at(-1);
    assert.equal(record.eventType, "acceptance.plan_generated");
    assert.equal(record.category, "acceptance");
    assert.equal(record.actor, "han-li");
    assert.equal(record.payload.status, "planned");
    assert.equal(record.payload.acceptancePlan.planId, plan.planId);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("真实应用验收执行器只执行白名单操作并阻止业务写按钮", async () => {
  let bounds = { x: 10, y: 20, width: 1320, height: 880 };
  let screenshots = 0;
  const sentKeys = [];
  const targetWindow = {
    isDestroyed: () => false, show() {}, focus() {}, getBounds: () => ({ ...bounds }), setBounds(next) { bounds = { ...next }; }, getTitle: () => "AI Desktop · 专题演化工作台",
    webContents: {
      async executeJavaScript(source) {
        if (source.includes('})({ type: "click"')) return { clicked: true, description: "已点击：专题执行群" };
        if (source.includes('})({ type: "scroll"')) return { moved: true, description: "滚动位置 0 → 600，最大 1200。" };
        if (source.includes('})({ type: "focus"')) return true;
        return true;
      },
      sendInputEvent(event) { sentKeys.push(event); },
      async capturePage() { return { toPNG: () => Buffer.from("png") }; },
    },
  };
  const executor = new HanLiRealAppAcceptanceExecutor({ async save() { screenshots += 1; return { id: `shot-${screenshots}`, name: "shot.png", filePath: "/evidence/shot.png", sizeBytes: 3, createdAt: new Date().toISOString() }; } });
  const plan = { version: 1, planId: "plan-1", topicId: "topic-1", proposalId: "proposal-1", summary: "真实检查", concerns: ["滚动"], generatedAt: new Date().toISOString(), checks: [{ checkId: "check-1", category: "真实交互", target: "专题工作台", action: "缩放、导航和截图", expected: "可操作", evidenceRequired: "截图", operations: [{ type: "focus-window" }, { type: "resize-window", width: 980, height: 680 }, { type: "click", target: "专题执行群" }, { type: "scroll", target: "真实界面验收计划", direction: "down", amount: 600 }, { type: "press-key", key: "PageDown" }, { type: "inspect-text", text: "真实界面验收计划" }, { type: "capture", label: "检查结果" }, { type: "click", target: "验收通过" }] }] };
  const run = await executor.execute(plan, targetWindow);
  assert.equal(run.status, "blocked");
  assert.match(run.stepResults.at(-1).actual, /禁止自动点击/);
  assert.equal(run.stepResults.filter((item) => item.status === "passed").length, 7);
  assert.equal(run.evidenceAttachmentIds.length, 1);
  assert.equal(screenshots, 2);
  assert.equal(sentKeys.length, 2);
  assert.deepEqual(bounds, { x: 10, y: 20, width: 1320, height: 880 });
});

test("韩立验收失败把复现步骤和截图沿原结果线路返还南宫婉", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-acceptance-failure-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic(topicRequest("真实界面失败返还"));
    state = store.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待真实检查");
    assert.throws(() => store.decideResult(proposalId, "approved", "直接通过"), /必须先完成真实应用检查/);
    const plan = { version: 1, planId: "failure-plan", topicId: state.topics[0].topicId, proposalId, summary: "检查滚动", concerns: ["末项可达"], checks: [{ checkId: "scroll-check", category: "可达性", target: "设置侧栏", action: "缩小窗口并滚动", expected: "最后一个控件可达", evidenceRequired: "截图", operations: [{ type: "resize-window", width: 980, height: 680 }, { type: "scroll", target: "设置侧栏", direction: "down", amount: 600 }] }], generatedAt: new Date().toISOString() };
    store.recordAcceptancePlan(plan);
    store.recordAcceptanceRun({ version: 1, runId: "failure-run", planId: plan.planId, topicId: plan.topicId, proposalId, status: "failed", windowTitle: "专题工作台", initialBounds: { x: 0, y: 0, width: 1320, height: 880 }, finalBounds: { x: 0, y: 0, width: 1320, height: 880 }, stepResults: [{ checkId: "scroll-check", operationIndex: 0, operation: plan.checks[0].operations[0], status: "passed", actual: "窗口已缩小", screenshotAttachmentId: null, occurredAt: new Date().toISOString() }, { checkId: "scroll-check", operationIndex: 1, operation: plan.checks[0].operations[1], status: "failed", actual: "滚动位置没有变化", screenshotAttachmentId: "failure-shot", occurredAt: new Date().toISOString() }], evidenceAttachmentIds: ["failure-shot"], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    state = store.decideResult(proposalId, "supplement-required", "修复设置侧栏滚动后重新提交");
    assert.equal(state.proposals[0].status, "supplement-required");
    const resultRecord = state.archiveRecords.at(-1);
    assert.equal(resultRecord.eventType, "proposal.result_decided");
    assert.equal(resultRecord.payload.nextOwner, "nangong-wan");
    assert.equal(resultRecord.payload.failureEvidence[0].target, "设置侧栏");
    assert.equal(resultRecord.payload.failureEvidence[0].actual, "滚动位置没有变化");
    assert.equal(resultRecord.payload.failureEvidence[0].expected, "最后一个控件可达");
    assert.deepEqual(resultRecord.payload.failureEvidence[0].screenshotAttachmentIds, ["failure-shot"]);
    assert.equal(resultRecord.payload.failureEvidence[0].reproductionOperations.length, 2);
    state = store.revise(proposalId, { submitterMemberId: state.proposals[0].submitterMemberId, content: "修复设置侧栏高度与滚动容器，确保窄窗口下最后一个控件可达。", evidence: ["失败截图与滚动位置记录"], impactScope: ["设置侧栏"], risks: ["小窗口布局变化"], rollbackPlan: "回退侧栏滚动容器变更", acceptanceCriteria: ["最后一个控件可滚动到达"] }, "南宫婉");
    const correction = state.proposals.at(-1);
    store.markProgress(correction.proposalId, "pending-acceptance", "修复完成，等待复验");
    const retestPlan = { ...plan, planId: "retest-plan", proposalId: correction.proposalId, generatedAt: new Date().toISOString() };
    store.recordAcceptancePlan(retestPlan);
    store.recordAcceptanceRun({ version: 1, runId: "retest-run", planId: retestPlan.planId, topicId: retestPlan.topicId, proposalId: correction.proposalId, status: "passed", windowTitle: "专题工作台", initialBounds: { x: 0, y: 0, width: 1320, height: 880 }, finalBounds: { x: 0, y: 0, width: 1320, height: 880 }, stepResults: [{ checkId: "scroll-check", operationIndex: 1, operation: retestPlan.checks[0].operations[1], status: "passed", actual: "滚动位置 0 → 600", screenshotAttachmentId: "retest-shot", occurredAt: new Date().toISOString() }], evidenceAttachmentIds: ["retest-shot"], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    state = store.decideResult(correction.proposalId, "approved", "复验通过");
    const candidate = state.archiveRecords.at(-1).payload.experienceCandidate;
    assert.equal(candidate.status, "candidate");
    assert.equal(candidate.failedProposalId, proposalId);
    assert.equal(candidate.correctionProposalId, correction.proposalId);
    assert.equal(candidate.failedRunId, "failure-run");
    assert.equal(candidate.passedRetestRunId, "retest-run");
    assert.deepEqual(candidate.sourceFailureEvidenceIds, [resultRecord.payload.failureEvidence[0].evidenceId]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("南宫婉线程删除最终失败时保留原页面消息", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-new-conversation-failed-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
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
    const store = evolutionStore(path.join(directory, "state.json")); let submitted;
    const collaboration = { submitTask(request) { submitted = request; return { tasks: [{ taskId: "linghu-task", evolutionProposalId: request.evolutionProposalId }] }; }, state() { return { tasks: [] }; } };
    const facade = new NangongEvolutionFacade({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    store.setAutomation("linghu-approval", true);
    let state = facade.createLinghuRepairProposal({ title: "修正持续运行 Bug", content: "依据停点事实修正恢复逻辑", evidence: ["任务停在 test-failed"], impactScope: ["令狐恢复流程"], risks: ["重复恢复"], rollbackPlan: "恢复旧恢复点", acceptanceCriteria: ["任务恢复且不重复"], workspaceState, locale: "zh-CN" });
    const proposal = state.proposals.at(-1);
    assert.equal(proposal.submitterMemberId, "linghu-ancestor");
    state = facade.decideProposal(proposal.proposalId, { mutation: mutation(facade), decision: "approved", advice: "人工确认令狐方向" });
    state = await facade.dispatch(proposal.proposalId);
    assert.equal(submitted.initiatorMemberId, "linghu-ancestor"); assert.equal(submitted.preferredExecutorMemberId, "linghu-ancestor");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("所有人物共用自身能力升级修订链并在任务中固定审批依据", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "member-self-upgrade-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json")); let submitted;
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
      mutation: mutation(facade),
      decision: "supplement-required",
      advice: "提交内容不具体：写明问题位置、修正动作和预期结果。",
      feedbackTarget: "submitter-capability",
      capabilityScope: "事实调查与具体提案表达",
    });
    const feedbackApprovalId = state.proposals[0].approvals.at(-1).approvalId;
    state = facade.reviseProposal(original.proposalId, {
      mutation: mutation(facade),
      submitterMemberId: "nangong-wan",
      content: "升级南宫婉自身提案模板，强制列出问题位置、修正动作和预期结果。",
      evidence: ["原提案未说明修改位置"], impactScope: ["南宫婉提案生成规则"], risks: ["旧提案兼容"],
      rollbackPlan: "保留旧模板并允许按版本回退。", acceptanceCriteria: ["新提案包含问题位置、修正动作和预期结果"],
    });
    const revised = state.proposals.at(-1);
    assert.equal(revised.version, 2); assert.equal(revised.purpose, "self-capability-upgrade");
    assert.equal(revised.targetMemberId, "nangong-wan"); assert.equal(revised.supersedesProposalId, original.proposalId);
    assert.equal(revised.revisionFeedbackApprovalId, feedbackApprovalId);
    assert.throws(() => facade.reviseProposal(original.proposalId, { mutation: mutation(facade), submitterMemberId: "custom-member" }), /原提交人/);
    state = facade.decideProposal(revised.proposalId, { mutation: mutation(facade), decision: "approved", advice: "方案具体，批准升级自身逻辑。" });
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
    const store = evolutionStore(path.join(directory, "state.json"));
    const members = [{ memberId: "linghu-ancestor", displayName: "令狐老祖", enabled: true, kind: "worker" }];
    const collaboration = { state() { return { members, tasks: [] }; } };
    const facade = new NangongEvolutionFacade({
      store, collaboration, conversation, recordEvent: () => undefined,
      async investigateRevision() {
        return JSON.stringify({
          content: "只读检查确认令狐提案生成器缺少文件位置、修正动作和预期结果字段，修订自身生成规则并补齐三项结构。",
          evidence: ["apps/ai-desktop/electron/services/collaboration/linghu-automation-facade.ts 的提案生成路径未形成文件位置、修正动作和预期结果三项结构"],
          impactScope: ["令狐提案生成规则"], exclusions: ["不修改演化方向审批线路"], risks: ["字段过严可能阻断旧输入，使用明确缺项提示缓解"],
          rollbackPlan: "仅回退令狐提案结构校验和提示改动，保留审批及任务状态。", acceptanceCriteria: ["新提案明确包含问题文件、修正动作和可观察预期结果"],
        });
      },
    });
    store.setAutomation("evolution", true);
    let state = facade.createLinghuRepairProposal({ title: "令狐提交具体性修正", content: "修正持续任务提交内容", evidence: ["提交内容缺少位置"], impactScope: ["令狐提案流程"], risks: ["模板兼容"], rollbackPlan: "保留旧模板", acceptanceCriteria: ["内容可审批"], workspaceState, locale: "zh-CN" });
    const original = state.proposals.at(-1);
    facade.decideProposal(original.proposalId, { mutation: mutation(facade), decision: "supplement-required", advice: "写明哪里有问题、修改哪里和预期结果。", feedbackTarget: "submitter-capability", capabilityScope: "修正方案具体性" });
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    state = facade.state();
    const revisions = state.proposals.filter((proposal) => proposal.supersedesProposalId === original.proposalId);
    assert.equal(revisions.length, 1); assert.equal(revisions[0].submitterMemberId, "linghu-ancestor");
    assert.equal(revisions[0].purpose, "self-capability-upgrade"); assert.match(revisions[0].content, /只读检查确认/);
    assert.doesNotMatch(revisions[0].content, /根据审批意见修订/);
    assert.equal(revisions[0].evidence.some((item) => item.startsWith("人工审批事实")), false);
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    assert.equal(facade.state().proposals.filter((proposal) => proposal.supersedesProposalId === original.proposalId).length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("返修调查没有新增可核验事实时不创建提案版本", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "revision-without-evidence-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const members = [{ memberId: "nangong-wan", displayName: "南宫婉", enabled: true, kind: "worker" }];
    const facade = new NangongEvolutionFacade({
      store, collaboration: { state() { return { members, tasks: [] }; } }, conversation, recordEvent: () => undefined,
      async investigateRevision() { return JSON.stringify({ content: "仍需继续调查", evidence: [], impactScope: ["待确认范围"], exclusions: ["未知"], risks: ["证据不足"], rollbackPlan: "尚无改动，无需回退。", acceptanceCriteria: ["取得实际证据"] }); },
    });
    let state = facade.createTopic(topicRequest("无新增事实不重提"));
    state = facade.createProposal(state.activeTopicId, proposalRequest());
    const proposal = state.proposals.at(-1);
    facade.decideProposal(proposal.proposalId, { mutation: mutation(facade), decision: "supplement-required", advice: "补充实际组件和状态证据" });
    state = await facade.investigateAndReviseReturnedProposal(proposal.proposalId);
    assert.equal(state.proposals.length, 1);
    assert.equal(state.proposals[0].status, "supplement-required");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
