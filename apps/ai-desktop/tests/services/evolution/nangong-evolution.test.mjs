import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";

import { controlledTestRoot, projectPaths } from "#test-paths";
import { personaConversationMessage } from "../../support/persona-conversation-message.fixture.mjs";

const passedSourceReview = {
  status: "passed",
  actual: "源码职责集中、依赖清楚并且便于新手阅读。",
  evidenceReferences: ["src/example.ts"],
};

// 回归测试只在内存中转换当前工作树源码，避免把其他候选的生成模块当作本轮验证结果。
async function loadWorkflowSource(entryPoint) {
  const result = await build({ entryPoints: [entryPoint], bundle: true, format: "esm", platform: "node", target: "es2022", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const [
  { PersonaEvolutionRuntime: WorkflowPersonaEvolutionRuntime },
  { EvolutionStateStore },
  { EvolutionFlowPolicy: EvolutionFlowOrchestrator },
  { HanliNangongDeliberationService },
  { createHanliRuntime },
  { HanliConversationService },
  { HanliConversationAggregate },
  { buildHanliMethodContext, buildHanliRecentConversation, HANLI_METHOD_CONTEXT_CHARACTER_BUDGET, HANLI_RECENT_CONVERSATION_CHARACTER_BUDGET },
  { NangongConversationAggregate },
] = await Promise.all([
  loadWorkflowSource("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"),
  loadWorkflowSource("electron/services/evolution/internal/evolution-state.store.ts"),
  loadWorkflowSource("electron/services/workflow/domain/evolution-flow.policy.ts"),
  loadWorkflowSource("electron/services/workflow/internal/evolution/hanli-nangong-deliberation.service.ts"),
  loadWorkflowSource("electron/services/personas/hanli/index.ts"),
  loadWorkflowSource("electron/services/personas/hanli/internal/conversation/hanli-conversation.service.ts"),
  loadWorkflowSource("electron/services/personas/hanli/domain/hanli-conversation.aggregate.ts"),
  loadWorkflowSource("electron/services/personas/hanli/internal/conversation/hanli-method-context.ts"),
  loadWorkflowSource("electron/services/personas/nangong/domain/nangong-conversation.aggregate.ts"),
]);

/**
 * 演进回归直接核验当前工作树的提示词源码，避免把候选源码测试耦合到主工程的旧构建产物。
 * 生产服务仍只能由 PromptLibraryFacade 读取构建后的只读 bundle。
 */
function createSourcePromptLibrary() {
  const promptRoot = new URL("../../../prompts/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", promptRoot), "utf8"));
  const promptsById = new Map(manifest.prompts.map((entry) => {
    assert.equal(typeof entry.id, "string", "提示词必须有稳定 ID。");
    assert.equal(typeof entry.file, "string", `提示词 ${entry.id} 必须登记源码文件。`);
    assert.equal(entry.file.includes(".."), false, `提示词 ${entry.id} 不得逃逸提示词目录。`);
    const content = readFileSync(new URL(entry.file, promptRoot), "utf8").trim();
    const actualVariables = [...new Set([...content.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g)].map((match) => match[1]))].sort();
    assert.deepEqual([...entry.variables].sort(), actualVariables, `提示词 ${entry.id} 的变量声明必须与正文一致。`);
    return [entry.id, { ...entry, content }];
  }));

  function resolveChain(promptId, chain = []) {
    if (chain.includes(promptId)) throw new Error(`提示词 include 循环：${[...chain, promptId].join(" -> ")}`);
    const prompt = promptsById.get(promptId);
    if (!prompt) throw new Error(`提示词不存在：${promptId}`);
    return [...prompt.includes.flatMap((includedId) => resolveChain(includedId, [...chain, promptId])), prompt];
  }

  return {
    render(promptId, variables = {}) {
      const chain = resolveChain(promptId);
      const expected = new Set(chain.flatMap((entry) => entry.variables));
      const supplied = Object.keys(variables);
      const missing = [...expected].filter((name) => !Object.prototype.hasOwnProperty.call(variables, name));
      const unknown = supplied.filter((name) => !expected.has(name));
      if (missing.length || unknown.length) throw new Error(`提示词 ${promptId} 变量不匹配：缺少 ${missing.join(",") || "无"}；未知 ${unknown.join(",") || "无"}`);
      return chain.map((entry) => entry.variables.reduce(
        (content, name) => content.split(`{{${name}}}`).join(String(variables[name])),
        entry.content,
      )).join("\n\n");
    },
    list() {
      return [...promptsById.values()].map(({ content: _content, file: _file, ...descriptor }) => structuredClone(descriptor));
    },
  };
}

const prompts = createSourcePromptLibrary();

// 业务回归继续复用既有测试正文；测试适配器把南宫和韩立动作显式转交各自 Facade，生产 Workflow 不保留人物兼容方法。
class PersonaEvolutionRuntime extends WorkflowPersonaEvolutionRuntime {
  constructor(options) {
    const hanliRuntime = createHanliRuntime({
      store: options.store,
      prompts,
      memory: options.memory || null,
      askHanli: options.hanLi?.send,
      recordEvent: options.recordEvent,
      recordTimelineEvent: options.recordTimelineEvent,
      beginMutation: options.beginMutation,
      completeMutation: options.completeMutation,
      failMutation: options.failMutation,
      readStableUserId: options.readStableUserId || (() => "XUNAN"),
      readProjectScope: options.readProjectScope || (() => projectPaths.projectRoot),
      screenshots: {},
    });
    super({ ...options, collaboration: { state: () => ({ tasks: [], members: [] }), ...options.collaboration }, prompts, hanli: hanliRuntime.facade, isCurrentUserTaskRuleId: options.isCurrentUserTaskRuleId || (() => true) });
    this.hanliRuntime = hanliRuntime;
  }
  sendConversationMessage(...args) { return this.nangongRuntime.facade.sendConversationMessage(...args); }
  newConversation(...args) { return this.nangongRuntime.facade.newConversation(...args); }
  generateTopicDraft(...args) { return this.nangongRuntime.facade.generateTopicDraft(...args); }
  convertConversationToTopic(...args) { return this.nangongRuntime.facade.convertConversationToTopic(...args); }
  createProposal(...args) { return this.nangongRuntime.facade.createProposal(...args); }
  updateTopic(...args) { return this.nangongRuntime.facade.updateTopic(...args); }
  reviseProposal(...args) { return this.nangongRuntime.facade.reviseProposal(...args); }
  investigateAndReviseReturnedProposal(...args) { return this.nangongRuntime.facade.investigateAndReviseReturnedProposal(...args); }
  dispatch(...args) { return this.nangongRuntime.facade.distributeProposal(...args); }
  decideProposal(...args) { return this.hanliRuntime.facade.decideProposal(...args); }
  autoApprove(...args) { return this.hanliRuntime.facade.autoApprove(...args); }
  recordAcceptanceRun(...args) { return this.hanliRuntime.facade.recordAcceptanceRun(...args); }
  decideResult(...args) { return this.hanliRuntime.facade.decideResult(...args); }
}

mkdirSync(controlledTestRoot, { recursive: true });
const workspaceState = { primaryId: "root", roots: [{ id: "root", name: "SELPLAT", path: "/workspace", permission: "workspace-write" }] };
const nangongPromptSource = readFileSync(new URL("../../../prompts/personas/nangong/conversation.md", import.meta.url), "utf8");
const applicationRuntimeSource = readFileSync(new URL("../../../electron/system/bootstrap/application-runtime.ts", import.meta.url), "utf8");
const evolutionFacadeSource = readFileSync(new URL("../../../electron/services/personas/nangong/nangong.facade.ts", import.meta.url), "utf8");
const nangongApplicationSource = readFileSync(new URL("../../../electron/services/personas/nangong/internal/application/nangong-application.service.ts", import.meta.url), "utf8");
const personaEvolutionRuntimeSource = readFileSync(new URL("../../../electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", import.meta.url), "utf8");
const approvalServiceSource = readFileSync(new URL("../../../electron/services/personas/hanli/internal/decision/evolution-approval.service.ts", import.meta.url), "utf8");
const hanliDeliberationSource = readFileSync(new URL("../../../prompts/personas/hanli/proposal-review.md", import.meta.url), "utf8");
const hanliApplicationSource = readFileSync(new URL("../../../electron/services/personas/hanli/internal/application/hanli-application.service.ts", import.meta.url), "utf8");
const hanliConversationPromptSource = readFileSync(new URL("../../../prompts/personas/hanli/conversation.md", import.meta.url), "utf8");
const hanliConversationWorkspaceSource = readFileSync(new URL("../../../src/features/hanli/components/HanliConversationWorkspace.tsx", import.meta.url), "utf8");
const distributionServiceSource = readFileSync(new URL("../../../electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.ts", import.meta.url), "utf8");
const persistedEvolutionStates = new Map();
function evolutionPersistence(key) {
  return {
    load() { const state = persistedEvolutionStates.get(key); return state ? structuredClone(state) : null; },
    loadLatestConversation() { return null; },
    save(state) { persistedEvolutionStates.set(key, structuredClone(state)); },
  };
}
function evolutionStore(key) { return new EvolutionStateStore(evolutionPersistence(key)); }
function readPersistedState(key) { return structuredClone(persistedEvolutionStates.get(key)); }
function writePersistedState(key, state) { persistedEvolutionStates.set(key, structuredClone(state)); }
function topicRequest(title = "协同审批分层") { return { title, goal: "把演化方向审批从执行审核中独立出来", scope: ["AI Desktop"], exclusions: ["其他应用"], evidence: ["现有审核只覆盖执行方案"], acceptanceCriteria: ["提案审批与执行审核具有独立记录"], workspaceState, locale: "zh-CN" }; }
function proposalRequest() { return { type: "代码修正", content: "建立独立演化审批入口，审批通过后返还南宫婉分发。", risks: ["历史记录迁移"], rollbackPlan: "保留旧记录并关闭三项自动开关。" }; }
const conversation = { async send(_request, context) { return { text: `南宫婉调查结论：${context}\nNANGONG_TOPIC_META={"title":"当前调查","type":"事实调查","switchTopic":false,"userIntent":"调查当前问题并形成事实依据","tags":["调查","事实依据"],"summary":"围绕当前问题收集事实并形成可继续分析的依据。"}`, itemCount: 1 }; }, async newChat() {} };
const distributionServices = {
  async planDistribution() { return JSON.stringify({ summary: "改动集中在同一业务流程和文件边界，由一个人独立完成可减少合并成本。", units: [{ title: "完成审批后的专项实施", scope: "在同一业务边界内完成提案要求并验证闭环", acceptanceCriteria: ["提案验收条件全部通过"], expectedFiles: ["apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx"], independentReason: "预计文件高度集中，不拆分可独立修改、回退和验收。" }] }); },
};
// 通过审批的测试替身必须提供本轮设计检查，缺项场景由独立门禁测试覆盖。
function approvedDesignResponse(state, advice) {
  const proposal = state.proposals.at(-1);
  const topic = state.topics.find((item) => item.topicId === proposal.topicId);
  const check = { status: "passed", reason: "本轮方案与用户要求一致", evidence: proposal.evidence.length ? proposal.evidence : topic.evidence, acceptanceCriteria: proposal.acceptanceCriteria };
  return JSON.stringify({ decision: "approved", advice, designReview: { architecture: check, layout: check, userJourney: check } });
}
let mutationSequence = 0;
function mutation(facade) { return { expectedStateVersion: facade.state().updatedAt, idempotencyKey: `nangong-test-${++mutationSequence}` }; }

test("南宫婉会话聚合根把独立 1 映射为确定且幂等的研讨动作", () => {
  const baseState = {
    conversation: { conversationId: "conversation-current", messages: [] },
    oneShotConfirmation: null,
    oneShotRun: null,
  };

  let aggregate = NangongConversationAggregate.restore(baseState);
  assert.equal(aggregate.decideUserMessage("继续说明", null, false).kind, "continue-conversation");
  assert.equal(aggregate.decideUserMessage("1", null, false).kind, "reject-missing-confirmation");

  const confirmedState = {
    ...baseState,
    oneShotConfirmation: {
      invitationMessageId: "invitation-1",
      conversationId: "conversation-current",
    },
  };
  aggregate = NangongConversationAggregate.restore(confirmedState);
  assert.equal(aggregate.decideUserMessage("1", "topic-1", false).kind, "start-confirmed-evolution");

  const runningState = {
    ...confirmedState,
    oneShotRun: {
      runId: "run-1",
      status: "running",
      action: "南宫婉正在调查",
    },
  };
  aggregate = NangongConversationAggregate.restore(runningState);
  assert.equal(aggregate.decideUserMessage("1", "topic-1", true).kind, "report-active-run");
  assert.equal(aggregate.decideUserMessage("1", "topic-1", false).kind, "retire-orphan-and-start");
});

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
  assert.match(hanliDeliberationSource, /审批意见直接面向普通用户/);
  assert.match(hanliDeliberationSource, /先用自然语言说明哪里不完整或为什么可以通过/);
  assert.match(hanliDeliberationSource, /只能引用提案、专题或源码调查中已经存在的事实/);
  assert.match(hanliDeliberationSource, /不得自行发明数量上限、页面规则或验收要求/);
});

test("用户确认后韩立与南宫婉一问一答并在整理条件成熟时确立专题", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-nangong-deliberation-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, automaticCustodyEnabled: true, workspaceState, locale: "zh-CN" });
    store.beginOneShotRun(workspaceState, "zh-CN", "inquiry-1");
    const internalMessages = [];
    const publishedConversations = [];
    const seenPrompts = [];
    const discussionBasis = {
      contextId: "inquiry-1", ownerPersonaId: "han-li", conversationId: "hanli-thread-1", sourceRequestId: "inquiry-1",
      customerQuestion: "自动研讨怎样避免偏离用户需求", understoodGoal: "既保留自由发现又解决真实需求",
      verificationTarget: "内部研讨的问题发现和专题收敛", expectedAnswer: "明确自由探索与范围控制的关系",
      investigationQuestion: "核对当前研讨如何读取资料并形成专题", findingStatus: "verified",
      findingSummary: "已有自由讨论，但缺少新问题关系分类", evidence: [{ source: "deliberation.service.ts", detail: "当前只保存问答与成熟判断" }],
      unknowns: [], customerConclusion: "需要保留自由讨论并增加关系分类。", createdAt: "2026-09-02T00:00:00.500Z",
    };
    const snapshots = [{
      snapshotId: "source:hanli:user-1", deliberationId: "placeholder", source: "hanli", conversationId: "hanli-thread-1",
      sourceMessageId: "user-1", sequenceNumber: 0, role: "user", responsePhase: null,
      content: "希望韩立和南宫婉自动研讨并在成熟后推进。", originalCreatedAt: "2026-09-02T00:00:00.000Z", capturedAt: "2026-09-02T00:00:01.000Z",
    }];
    const hanliReplies = [
      JSON.stringify({ action: "ask", question: "持续运行在没有新问题时应如何处理？", reason: "必须明确不得为了循环而虚构问题" }),
      JSON.stringify({ decision: "establish-topic", assessment: "后台判断不能代替聊天回复。" }),
      JSON.stringify({ decision: "establish-topic", assessment: "目标、范围、证据和验收条件已经明确。", discoveries: [
        { issue: "缺少新问题关系分类", relation: "required-for-goal", reason: "不分类会把相邻问题混入当前修正", evidence: ["当前只保存成熟判断"], suggestedAction: "在当前专题加入关系分类" },
        { issue: "以后支持更多关系展示", relation: "follow-up-opportunity", reason: "不影响本次正确收敛", evidence: [], suggestedAction: "保留为后续候选" },
      ], reply: "那就保留这个边界，没有新证据时不硬找问题。", topic: { title: "持续人物研讨", goal: "让内部研讨成熟后自动推进", scope: ["AI Desktop", "新问题关系分类"], exclusions: ["无用户证据的问题", "后续关系展示"], evidence: ["用户明确要求持续研讨"], acceptanceCriteria: ["一问一答可见且成熟后建立专题"], establishmentReason: "整理条件完整" } }),
      "1",
    ];
    const service = new HanliNangongDeliberationService({
      store, prompts,
      memory: {
        readRequirementDiscussionContext(_owner, _conversationId, sourceRequestId) { return sourceRequestId === "inquiry-1" ? discussionBasis : null; },
        readHanLiEvolutionCorpus(deliberationId) { return snapshots.map((item) => ({ ...item, deliberationId })); },
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories: [], inspectionExperiences: [] }; },
        appendPersonaInternalMessage(message) { internalMessages.push(message); return { ownerPersonaId: message.ownerPersonaId, conversationId: message.conversationId, messages: [], updatedAt: message.createdAt }; },
      },
      askHanli: async (prompt) => { seenPrompts.push(prompt); return hanliReplies.shift(); },
      askNangong: async (prompt) => { seenPrompts.push(prompt); return "没有新问题时保持监测；出现新的用户证据后再继续提问。"; },
      onPersonaConversationChanged: (conversation) => publishedConversations.push(conversation),
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace", readHanliConversationId: () => "hanli-thread-1",
    });
    await assert.rejects(service.advance({ requireProblem: true }), /缺少对南宫婉的回复正文/);
    assert.equal(store.state().topics.length, 0);
    assert.equal(internalMessages.length, 2);
    const result = await service.advance({ requireProblem: true });
    assert.equal(result.activity, "topic-established");
    assert.equal(result.state.deliberations[0].rounds.length, 1);
    assert.equal(result.state.deliberations[0].rounds[0].answer, "没有新问题时保持监测；出现新的用户证据后再继续提问。");
    assert.equal(result.state.topics[0].title, "持续人物研讨");
    assert.deepEqual(internalMessages.map((message) => message.speakerPersonaId), ["han-li", "nangong-wan", "han-li", "nangong-wan", "han-li", "nangong-wan"]);
    assert.equal(publishedConversations.length, 6);
    assert.equal(internalMessages.at(-2).content, "自动托管确认：1");
    assert.equal(result.state.deliberations[0].rounds[0].confirmation.reply, "1");
    assert.equal(internalMessages[2].content, "那就保留这个边界，没有新证据时不硬找问题。");
    assert.ok(internalMessages[2].messageId.endsWith(":reply"));
    assert.ok(internalMessages.every((message) => !message.content.startsWith("判断：")));
    assert.equal(result.state.deliberations[0].rounds[0].assessment, "目标、范围、证据和验收条件已经明确。");
    assert.equal(result.state.deliberations[0].rounds[0].discoveries[0].relation, "required-for-goal");
    assert.equal(result.state.deliberations[0].candidate.discoveries[1].relation, "follow-up-opportunity");
    assert.equal(result.state.deliberations[0].sourceSnapshots[0].responsePhase, "requirement-discussion-context");
    assert.ok(seenPrompts.some((prompt) => prompt.includes(discussionBasis.customerQuestion)));
    assert.ok(seenPrompts.some((prompt) => prompt.includes("required-for-goal")));
    assert.ok(publishedConversations.every((conversation) => conversation.ownerPersonaId === "han-li"));
    assert.match(hanliConversationPromptSource, /独立输入 1 会以当前观点启动/);
    assert.match(hanliConversationPromptSource, /不依赖你是否说出某句固定文案/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动托管由韩立把范围扩展重新判断为当前专题或后续专题", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "deliberation-customer-decision-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, automaticCustodyEnabled: true, workspaceState, locale: "zh-CN" });
    const internalMessages = [];
    const seenPrompts = [];
    const replies = [
      JSON.stringify({ action: "ask", question: "修复当前问题是否必须调整其他页面？", reason: "需要区分必要修复和范围扩展" }),
      JSON.stringify({ decision: "establish-topic", assessment: "当前问题已有方案，但统一改造其他页面需要客户决定。", discoveries: [{
        issue: "统一改造其他页面", relation: "customer-decision-required", reason: "它会扩大本次产品范围", evidence: ["其他页面采用相邻实现"], suggestedAction: "交给客户决定是否另行纳入",
      }], reply: "当前问题可以单独修复，其他页面是否统一改造需要你决定。", topic: {
        title: "修复当前页面", goal: "解决当前页面问题", scope: ["当前页面"], exclusions: ["其他页面统一改造"], evidence: ["当前页面存在真实问题"], acceptanceCriteria: ["当前页面恢复正常"], establishmentReason: "当前修复边界已经明确",
      } }),
      "统一改造其他页面不属于当前专题，留到后续讨论；当前专题只修当前页面。",
      JSON.stringify({ decision: "establish-topic", assessment: "当前专题边界明确，其他页面作为后续机会保留。", discoveries: [{
        issue: "统一改造其他页面", relation: "follow-up-opportunity", reason: "它有价值但不阻塞当前页面修复", evidence: ["其他页面采用相邻实现"], suggestedAction: "当前专题完成后继续讨论并在成熟时建立新专题",
      }], reply: "当前先完成当前页面，其他页面留到下一专题继续讨论。", topic: {
        title: "修复当前页面", goal: "解决当前页面问题", scope: ["当前页面"], exclusions: ["其他页面统一改造"], evidence: ["当前页面存在真实问题"], acceptanceCriteria: ["当前页面恢复正常"], establishmentReason: "当前修复边界已经明确",
      } }),
      "1",
    ];
    const nangongReplies = ["当前页面可单独修复，其他页面只是相邻机会。", "本次只修当前页面；其他页面可留到后续。符合请回复 1。", "同意，其他页面不影响当前修复，可独立形成后续方案。", "本次只修当前页面；后续机会已经单独保留。符合请回复 1。"];
    const service = new HanliNangongDeliberationService({
      store, prompts,
      memory: {
        readRequirementDiscussionContext() { return null; },
        readHanLiEvolutionCorpus(deliberationId) { return [{ snapshotId: "customer-decision-source", deliberationId, source: "hanli", conversationId: "hanli-thread", sourceMessageId: "user-1", sequenceNumber: 0, role: "user", responsePhase: null, content: "先解决当前页面的问题。", originalCreatedAt: "2026-09-05T00:00:00.000Z", capturedAt: "2026-09-05T00:00:01.000Z" }]; },
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories: [], inspectionExperiences: [] }; },
        appendPersonaInternalMessage(message) { internalMessages.push(message); return { ownerPersonaId: message.ownerPersonaId, conversationId: message.conversationId, messages: [], updatedAt: message.createdAt }; },
      },
      askHanli: async (prompt) => { seenPrompts.push(prompt); const reply = replies.shift(); if (!reply) throw new Error("韩立没有完成自动托管范围判断"); return reply; },
      askNangong: async () => nangongReplies.shift(),
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace", readHanliConversationId: () => "hanli-thread",
    });
    const first = await service.advance({ requireProblem: true });
    assert.equal(first.activity, "questioning");
    assert.equal(first.state.topics.length, 0);
    assert.equal(first.state.deliberations[0].rounds.length, 2);
    const result = await service.advance({ requireProblem: true });
    assert.equal(result.activity, "topic-established");
    assert.equal(result.state.topics.length, 1);
    assert.equal(result.state.deliberations[0].candidate.discoveries[0].relation, "follow-up-opportunity");
    assert.equal(internalMessages.some((message) => message.messageId.startsWith("hanli-confirmation:")), false);
    assert.ok(seenPrompts.some((prompt) => prompt.includes("全权代理客户")));
    assert.ok(seenPrompts.some((prompt) => prompt.includes("不得把普通范围判断转回客户")));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动托管关闭时范围扩展仍回到真实客户确认", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "deliberation-custody-off-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, automaticCustodyEnabled: false, workspaceState, locale: "zh-CN" });
    const internalMessages = [];
    const replies = [
      JSON.stringify({ action: "ask", question: "是否同时改造其他页面？", reason: "这会扩大本次范围" }),
      JSON.stringify({ decision: "establish-topic", assessment: "当前方案成熟，但扩展需要客户决定。", discoveries: [{ issue: "改造其他页面", relation: "customer-decision-required", reason: "扩大产品范围", evidence: [], suggestedAction: "询问客户" }], reply: "当前修复已明确，扩展部分请客户决定。", topic: { title: "当前页面修复", goal: "修复当前页面", scope: ["当前页面"], exclusions: ["其他页面"], evidence: ["当前页面问题"], acceptanceCriteria: ["当前页面正常"], establishmentReason: "范围明确" } }),
    ];
    const service = new HanliNangongDeliberationService({
      store, prompts,
      memory: {
        readRequirementDiscussionContext() { return null; },
        readHanLiEvolutionCorpus(deliberationId) { return [{ snapshotId: "custody-off-source", deliberationId, source: "hanli", conversationId: "hanli-thread", sourceMessageId: "user-1", sequenceNumber: 0, role: "user", responsePhase: null, content: "修复当前页面。", originalCreatedAt: "2026-09-05T00:00:00.000Z", capturedAt: "2026-09-05T00:00:01.000Z" }]; },
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories: [], inspectionExperiences: [] }; },
        appendPersonaInternalMessage(message) { internalMessages.push(message); return { ownerPersonaId: message.ownerPersonaId, conversationId: message.conversationId, messages: [], updatedAt: message.createdAt }; },
      },
      askHanli: async () => replies.shift(), askNangong: async (_prompt) => internalMessages.some((item) => item.messageId.endsWith(":answer")) ? "本次修复范围说明，符合请回复 1。" : "其他页面属于范围扩展。",
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace", readHanliConversationId: () => "hanli-thread",
    });
    const result = await service.advance({ requireProblem: true });
    assert.equal(result.activity, "idle");
    assert.equal(result.state.topics.length, 0);
    assert.ok(internalMessages.some((message) => message.messageId.startsWith("hanli-confirmation:")));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("等待真实客户确认时不重复改写一次性运行档案", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "deliberation-confirmation-idle-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, automaticCustodyEnabled: false, workspaceState, locale: "zh-CN" });
    store.beginOneShotRun(workspaceState, "zh-CN");
    store.beginDeliberation("idle-confirmation", [{ sourceMessageId: "user-idle", content: "只修复当前页面。" }], "是否只修复当前页面？", "确认修复范围");
    const roundId = store.state().deliberations[0].rounds[0].roundId;
    const candidate = { title: "当前页面修复", goal: "修复当前页面", scope: ["当前页面"], exclusions: ["其他页面"], evidence: ["用户要求"], acceptanceCriteria: ["当前页面恢复正常"], establishmentReason: "范围明确" };
    store.recordDeliberationAnswer("idle-confirmation", roundId, "只处理当前页面，不扩展范围。");
    store.assessDeliberation("idle-confirmation", roundId, "范围已经明确", null, candidate);
    store.offerDeliberationConfirmation("idle-confirmation", "只修复当前页面，符合请回复 1。");
    const before = store.state();
    const runtime = new PersonaEvolutionRuntime({
      store,
      collaboration: { state() { return { members: [], tasks: [] }; } },
      conversation,
      ...distributionServices,
      recordEvent: () => undefined,
      askHanliDeliberation: async () => { throw new Error("等待客户确认时不应再次询问韩立"); },
      askNangongDeliberation: async () => { throw new Error("确认说明已存在时不应再次询问南宫婉"); },
      memory: {
        readRequirementDiscussionContext() { return null; },
        readHanLiEvolutionCorpus() { return []; },
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories: [], inspectionExperiences: [] }; },
        appendPersonaInternalMessage(message) { return { ownerPersonaId: message.ownerPersonaId, conversationId: message.conversationId, messages: [], updatedAt: message.createdAt }; },
      },
      readStableUserId: () => "XUNAN",
      readProjectScope: () => "/workspace",
      readHanliConversationId: () => "hanli-thread",
    });
    runtime.notifyWorkflowChanged();
    await new Promise((resolve) => setTimeout(resolve, 50));
    runtime.stop();
    const after = store.state();
    assert.equal(after.updatedAt, before.updatedAt);
    assert.equal(after.archiveRecords.length, before.archiveRecords.length);
    assert.equal(after.oneShotRun.action, before.oneShotRun.action);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("相同一次性运行活动不会追加重复档案", () => {
  const key = `one-shot-idempotent-${Date.now()}`;
  const store = evolutionStore(key);
  store.beginOneShotRun(workspaceState, "zh-CN");
  store.updateOneShotRun("preparing-topic", "han-li", "韩立", "等待真实客户确认", null, null);
  const before = store.state();
  store.updateOneShotRun("preparing-topic", "han-li", "韩立", "等待真实客户确认", null, null);
  const after = store.state();
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal(after.archiveRecords.length, before.archiveRecords.length);
});

test("成熟判断不能绕过可见确认；确认持久化且非1重新讨论", () => {
  const key = `confirmation-gate-${Date.now()}`;
  let store = evolutionStore(key);
  store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, workspaceState, locale: "zh-CN" });
  store.beginDeliberation("confirm", [{ sourceMessageId: "user", content: "修复图片重启后消失" }], "用户重启后图片还在吗？", "用户需求");
  const roundId = store.state().deliberations[0].rounds[0].roundId;
  const candidate = { title: "图片恢复", goal: "重启后图片可见", scope: ["会话附件"], exclusions: ["其他功能"], evidence: ["用户反馈"], acceptanceCriteria: ["重启后可见"], establishmentReason: "范围明确" };
  store.recordDeliberationAnswer("confirm", roundId, "需要保存附件并恢复预览。");
  store.assessDeliberation("confirm", roundId, "成熟", null, candidate);
  assert.throws(() => store.establishDeliberationTopic("confirm"), /确认 1/);
  store.offerDeliberationConfirmation("confirm", "只修复图片恢复，重启验证；符合请回复1。");
  store = evolutionStore(key);
  assert.match(store.state().deliberations[0].rounds[0].confirmation.offer, /只修复图片/);
  assert.throws(() => store.establishDeliberationTopic("confirm"), /确认 1/);
  store.replyDeliberationConfirmation("confirm", "那旧图片会不会丢？");
  assert.equal(store.state().topics.length, 0);
  assert.equal(store.state().deliberations[0].status, "questioning");
  const next = store.state().deliberations[0].rounds.at(-1);
  assert.equal(next.question, "那旧图片会不会丢？");
  store.recordDeliberationAnswer("confirm", next.roundId, "保留旧图片。");
  store.assessDeliberation("confirm", next.roundId, "已说明保留旧图片", null, candidate);
  store.offerDeliberationConfirmation("confirm", "保留旧图片，只补恢复，请回复1。");
  store.replyDeliberationConfirmation("confirm", "1");
  store = evolutionStore(key);
  store.controlAutomation("start");
  store.controlAutomation("pause");
  assert.throws(() => store.establishDeliberationTopic("confirm"), /暂停/);
  assert.equal(store.state().topics.length, 0);
  store.controlAutomation("resume");
  assert.equal(store.establishDeliberationTopic("confirm").topics.length, 1);
});

test("客户纠正先由韩立理解并补齐内部问题关系后再交南宫婉", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "customer-correction-deliberation-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, automaticCustodyEnabled: false, workspaceState, locale: "zh-CN" });
    store.beginDeliberation("customer-correction", [{ sourceMessageId: "user", content: "我要拖动后看清整个面板" }], "怎样恢复原来的拖动？", "核实真实使用目的");
    const firstRound = store.state().deliberations[0].rounds[0];
    const candidate = { title: "恢复边缘拖动", goal: "拖动后看清整个面板", scope: ["右边缘拖动"], exclusions: ["新增按钮"], evidence: ["客户明确要拖动查看整体"], acceptanceCriteria: ["右边缘可以直接拖动"], establishmentReason: "目标明确" };
    store.recordDeliberationAnswer("customer-correction", firstRound.roundId, "可以恢复透明边缘拖动区域。");
    store.assessDeliberation("customer-correction", firstRound.roundId, "方案成熟", null, candidate);
    store.offerDeliberationConfirmation("customer-correction", "增加一个右侧手柄按钮，符合请回复1。");
    const messageIds = new Set([
      `internal:${firstRound.roundId}:question`, `internal:${firstRound.roundId}:answer`,
      `internal:${firstRound.roundId}:reply`, `internal:${firstRound.roundId}:offer`,
    ]);
    const internalMessages = [];
    const service = new HanliNangongDeliberationService({
      store, prompts,
      memory: {
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories: [], inspectionExperiences: [] }; },
        appendPersonaInternalMessage(message) {
          if (message.replyToMessageId && !messageIds.has(message.replyToMessageId)) throw new Error("FOREIGN KEY constraint failed");
          messageIds.add(message.messageId); internalMessages.push(message);
          return { ownerPersonaId: message.ownerPersonaId, conversationId: message.conversationId, messages: [], updatedAt: message.createdAt };
        },
      },
      askHanli: async () => JSON.stringify({ action: "discuss-with-nangong", customerReply: "我理解你要的是直接拖动边缘看清整个面板，不是增加按钮。我会按这个目标继续核实。", question: "客户要恢复无感的右边缘直接拖动，以便看清面板整体；请核实如何恢复透明命中区域且不增加按钮。", reason: "需要确认修复真正服务于查看完整面板的目的" }),
      askNangong: async () => "应恢复透明边缘命中区域，不显示按钮。", recordEvent() {},
      readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace", readHanliConversationId: () => "hanli-thread",
    });
    const correction = "不是显示开启，我只想拖动看清面板整体，为什么要按钮？";
    const result = await service.replyToConfirmation(correction);
    assert.match(result.customerReply, /直接拖动边缘看清整个面板/);
    const saved = store.state().deliberations[0];
    assert.equal(saved.rounds[0].confirmation.reply, correction);
    assert.notEqual(saved.rounds[1].question, correction);
    assert.match(saved.rounds[1].question, /透明命中区域/);
    const questionMessage = internalMessages.find((item) => item.messageId === `internal:${saved.rounds[1].roundId}:question`);
    assert.equal(questionMessage.replyToMessageId, `internal:${firstRound.roundId}:offer`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("回复1启动统一自动流程后不因单题轮数上限自行停止", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-nangong-continuous-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: 1, maxCorrectionRounds: 1, workspaceState, locale: "zh-CN" });
    store.beginOneShotRun(workspaceState, "zh-CN");
    const internalMessages = [];
    const seenPrompts = [];
    const replies = [
      JSON.stringify({ action: "ask", question: "还缺少哪项用户证据？", reason: "需要确认真实边界" }),
      JSON.stringify({ decision: "continue", assessment: "当前证据仍不足。", nextQuestion: "用户实际期望哪项结果？", questionReason: "缺少可验收结果" }),
    ];
    const service = new HanliNangongDeliberationService({
      store, prompts,
      memory: {
        readHanLiEvolutionCorpus(deliberationId) { return [{ snapshotId: "continuous-source", deliberationId, source: "hanli", conversationId: "hanli-thread", sourceMessageId: "user-message", sequenceNumber: 0, role: "user", responsePhase: null, content: "请持续找出新问题并修正。", originalCreatedAt: "2026-09-02T00:00:00.000Z", capturedAt: "2026-09-02T00:00:01.000Z" }]; },
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories: [], inspectionExperiences: [] }; },
        appendPersonaInternalMessage(message) { internalMessages.push(message); return { ownerPersonaId: message.ownerPersonaId, conversationId: message.conversationId, messages: [], updatedAt: message.createdAt }; },
      },
      askHanli: async (prompt) => { seenPrompts.push(prompt); return replies.shift(); }, askNangong: async () => "目前还需要更具体的用户结果证据。", recordEvent() {},
      readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace", readHanliConversationId: () => "hanli-thread",
    });
    const result = await service.advance({ requireProblem: false });
    assert.equal(result.activity, "questioning");
    assert.equal(result.state.automationRuntime.status, "running");
    assert.equal(result.state.deliberations[0].status, "questioning");
    assert.equal(result.state.deliberations[0].rounds.length, 2);
    assert.equal(internalMessages.length, 3);
    assert.equal(internalMessages[2].replyToMessageId, internalMessages[1].messageId);
    assert.equal(internalMessages[2].content, "用户实际期望哪项结果？");
    assert.ok(internalMessages.every((message) => !message.messageId.endsWith(":assessment")));
    assert.match(seenPrompts.at(-1), /南宫婉：目前还需要更具体的用户结果证据。/);
    assert.match(seenPrompts.at(-1), /如果她问了你，先回应她/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立会话已有当前观点时收到独立1直接启动内部研讨", async () => {
  let started = 0;
  let externalChatCalls = 0;
  const recordedContexts = [];
  const messages = [personaConversationMessage("customer-visible", { messageId: "hanli-viewpoint", sequenceNumber: 0, speakerType: "persona", speakerPersonaId: "han-li", content: "我的观点是：只保留右侧边框拖拽调宽，并移除左侧拖拽入口。", replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: "2026-09-02T00:00:00.000Z", completedAt: "2026-09-02T00:00:00.000Z" })];
  const memory = {
    readPersonaConversation(ownerPersonaId) { return { ownerPersonaId, conversationId: "hanli-thread-1", messages: structuredClone(messages), updatedAt: messages.at(-1).createdAt }; },
    readPersonaCustomerDisplayConversation(ownerPersonaId) { return { ownerPersonaId, conversationId: "hanli-thread-1", messages: structuredClone(messages), updatedAt: messages.at(-1).createdAt }; },
    registerPersonaRound(input) {
      messages.push(personaConversationMessage("customer-visible", { messageId: input.userMessageId, sequenceNumber: messages.length, speakerType: "user", speakerPersonaId: null, content: input.userContent, replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: input.createdAt, completedAt: input.completedAt }));
      messages.push(personaConversationMessage("customer-visible", { messageId: input.personaMessageId, sequenceNumber: messages.length, speakerType: "persona", speakerPersonaId: input.responderPersonaId, content: input.personaContent, replyToMessageId: input.userMessageId, deliveryStatus: "completed", attachmentIds: [], createdAt: input.completedAt, completedAt: input.completedAt }));
      return { ownerPersonaId: input.ownerPersonaId, conversationId: "hanli-thread-1", messages: structuredClone(messages), updatedAt: input.completedAt };
    },
    readRequirementDiscussionContext() { return null; },
    recordRequirementDiscussionContext(context) { recordedContexts.push(structuredClone(context)); },
  };
  const service = new HanliConversationService({
    store: evolutionStore(path.join(controlledTestRoot, "hanli-confirmation-state")), prompts, memory,
    conversation: { activeConversationId: () => "hanli-thread-1", async send() { externalChatCalls += 1; throw new Error("不应调用普通聊天"); }, async newChat() {} },
    async startInternalDeliberation() {
      assert.equal(recordedContexts.length, 1, "启动异步研讨前必须先保存当前观点");
      started += 1;
      return { continuous: true };
    },
    recordEvent() {}, refreshSemanticMemory() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
  });
  const result = await service.send({ clientMessageId: "confirm-1", message: "1", attachmentIds: [], workspaceState, locale: "zh-CN" });
  assert.equal(started, 1);
  assert.equal(recordedContexts[0].customerConclusion, "我的观点是：只保留右侧边框拖拽调宽，并移除左侧拖拽入口。");
  assert.equal(externalChatCalls, 0);
  assert.equal(result.messages.at(-2).content, "1");
  assert.match(result.messages.at(-1).content, /请你确认，再进入实施/);
});

test("韩立会话没有当前观点时输入1不创建空研讨", async () => {
  let started = 0;
  const messages = [];
  const memory = {
    readPersonaConversation(ownerPersonaId) {
      return { ownerPersonaId, conversationId: "hanli-empty-viewpoint", messages: structuredClone(messages), updatedAt: "2026-09-02T00:00:00.000Z" };
    },
    readPersonaCustomerDisplayConversation(ownerPersonaId) {
      return { ownerPersonaId, conversationId: "hanli-empty-viewpoint", messages: structuredClone(messages), updatedAt: "2026-09-02T00:00:00.000Z" };
    },
    registerPersonaRound(input) {
      messages.push(personaConversationMessage("customer-visible", { messageId: input.userMessageId, sequenceNumber: messages.length, speakerType: "user", speakerPersonaId: null, content: input.userContent, replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: input.createdAt, completedAt: input.completedAt }));
      messages.push(personaConversationMessage("customer-visible", { messageId: input.personaMessageId, sequenceNumber: messages.length, speakerType: "persona", speakerPersonaId: input.responderPersonaId, content: input.personaContent, replyToMessageId: input.userMessageId, deliveryStatus: "completed", attachmentIds: [], createdAt: input.completedAt, completedAt: input.completedAt }));
      return { ownerPersonaId: input.ownerPersonaId, conversationId: "hanli-empty-viewpoint", messages: structuredClone(messages), updatedAt: input.completedAt };
    },
  };
  const service = new HanliConversationService({
    store: { state: () => ({ deliberations: [], oneShotRun: null }) },
    prompts,
    memory,
    conversation: { activeConversationId: () => "hanli-empty-viewpoint", async send() { throw new Error("不应调用普通聊天"); }, async newChat() {} },
    async startInternalDeliberation() { started += 1; return { continuous: true }; },
    recordEvent() {},
    readStableUserId: () => "XUNAN",
    readProjectScope: () => "/workspace",
  });

  const result = await service.send({ clientMessageId: "empty-confirm-1", message: "1", attachmentIds: [], workspaceState, locale: "zh-CN" });

  assert.equal(started, 0);
  assert.match(result.messages.at(-1).content, /还没有形成可供研讨的韩立观点/);
  assert.match(result.messages.at(-1).messageId, /^hanli-control:/);
});

test("韩立会话已有活动研讨时重复输入1只返回原流程", async () => {
  let started = 0;
  const messages = [personaConversationMessage("customer-visible", { messageId: "hanli-viewpoint", sequenceNumber: 0, speakerType: "persona", speakerPersonaId: "han-li", content: "当前观点应先核实运行窗口，再决定修改范围。", replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: "2026-09-02T00:00:00.000Z", completedAt: "2026-09-02T00:00:00.000Z" })];
  const memory = {
    readPersonaConversation(ownerPersonaId) {
      return { ownerPersonaId, conversationId: "hanli-active-deliberation", messages: structuredClone(messages), updatedAt: messages.at(-1).createdAt };
    },
    readPersonaCustomerDisplayConversation(ownerPersonaId) {
      return { ownerPersonaId, conversationId: "hanli-active-deliberation", messages: structuredClone(messages), updatedAt: messages.at(-1).createdAt };
    },
    registerPersonaRound(input) {
      messages.push(personaConversationMessage("customer-visible", { messageId: input.userMessageId, sequenceNumber: messages.length, speakerType: "user", speakerPersonaId: null, content: input.userContent, replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: input.createdAt, completedAt: input.completedAt }));
      messages.push(personaConversationMessage("customer-visible", { messageId: input.personaMessageId, sequenceNumber: messages.length, speakerType: "persona", speakerPersonaId: input.responderPersonaId, content: input.personaContent, replyToMessageId: input.userMessageId, deliveryStatus: "completed", attachmentIds: [], createdAt: input.completedAt, completedAt: input.completedAt }));
      return { ownerPersonaId: input.ownerPersonaId, conversationId: "hanli-active-deliberation", messages: structuredClone(messages), updatedAt: input.completedAt };
    },
  };
  const service = new HanliConversationService({
    store: { state: () => ({ deliberations: [], oneShotRun: { runId: "existing-run", status: "running" } }) },
    prompts,
    memory,
    conversation: { activeConversationId: () => "hanli-active-deliberation", async send() { throw new Error("不应调用普通聊天"); }, async newChat() {} },
    async startInternalDeliberation() { started += 1; return { continuous: true }; },
    recordEvent() {},
    readStableUserId: () => "XUNAN",
    readProjectScope: () => "/workspace",
  });

  const result = await service.send({ clientMessageId: "duplicate-confirm-1", message: "1", attachmentIds: [], workspaceState, locale: "zh-CN" });

  assert.equal(started, 0);
  assert.match(result.messages.at(-1).content, /正在内部研讨中，无需重复启动/);
  assert.match(result.messages.at(-1).content, /调查形成方案后，才会生成任务协作群/);
});

test("同一客户显示投影同时隔离近期对话与当前观点", () => {
  const internalFields = ["用户原话：", "用户目标：", "调查对象：", "期望结果：", "交给南宫婉核实："];
  const legacyMixed = ["安全的历史答复。", ...internalFields.map((field, index) => `${field}内部字段-${index}`)].join("\n\n");
  const createdAt = "2026-09-16T00:00:00.000Z";
  const rawMessages = [
    personaConversationMessage("customer-visible", { messageId: "user", sequenceNumber: 1, speakerType: "user", speakerPersonaId: null, content: "客户问题", replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt, completedAt: createdAt }),
    personaConversationMessage("customer-visible", { messageId: "legacy", sequenceNumber: 2, speakerType: "persona", speakerPersonaId: "han-li", content: legacyMixed, replyToMessageId: "user", deliveryStatus: "completed", attachmentIds: [], createdAt, completedAt: createdAt }),
  ];
  const customerDisplayMessages = [
    { ...rawMessages[0], customerDisplayState: "ready" },
    { ...rawMessages[1], content: "安全的历史答复。", customerDisplayState: "ready" },
    { ...rawMessages[1], messageId: "missing", sequenceNumber: 3, content: "此消息正在准备显示。", customerDisplayState: "missing" },
    { ...rawMessages[1], messageId: "failed", sequenceNumber: 4, content: "此消息暂时无法安全显示。", customerDisplayState: "failed" },
    { ...rawMessages[1], messageId: "internal", sequenceNumber: 5, messageType: "internal-deliberation", content: legacyMixed, customerDisplayState: "excluded" },
  ];
  const recentConversation = buildHanliRecentConversation(customerDisplayMessages);
  assert.match(recentConversation, /客户问题/);
  assert.match(recentConversation, /安全的历史答复/);
  for (const field of internalFields) assert.doesNotMatch(recentConversation, new RegExp(field));

  const aggregate = new HanliConversationAggregate({
    conversation: { ownerPersonaId: "han-li", conversationId: "display-projection", messages: rawMessages, updatedAt: createdAt },
    customerDisplayMessages,
    pendingConfirmationRoundId: null,
    activeDeliberationId: null,
  });
  assert.equal(aggregate.currentViewpoint()?.sourceMessageId, "legacy");
  assert.equal(aggregate.currentViewpoint()?.content, "安全的历史答复。");
});

test("韩立只学习提问调查扩展方法并回显每轮真实读入字数", async () => {
  const trajectories = Array.from({ length: 40 }, (_, index) => ({
    trajectoryId: `trajectory-${index}`, sourceCorpusTopicId: `topic-${index}`, projectScope: "/workspace",
    customerGoal: `不得进入方法上下文的客户目标-${index}`,
    confirmedFacts: [`不得进入方法上下文的证据原文-${index}`], assumptions: ["假设"], conflicts: [],
    informationGaps: ["缺口"], implicitRequirements: ["隐含要求"],
    selectedAction: `先核对第 ${index} 类证据，再决定是否继续调查。`,
    questionAsked: `哪一项信息会实质改变第 ${index} 步的调查方向？`,
    questionReason: "避免在缺少关键证据时提前做结论。",
    resultSummary: `不得进入方法上下文的历史答案-${index}`,
    evolutionDirection: "从新发现的信息缺口扩展下一个可验证问题。", maturityScore: 0.8, updatedAt: "2026-09-03T00:00:00.000Z",
    nodes: [{ requirementNodeId: `node-${index}`, nodeKey: `node-${index}`, parentNodeKey: null, title: "旧业务节点", category: "业务", status: "investigate", statement: `不得进入方法上下文的节点正文-${index}`, critical: true, evidenceMessageIds: [] }],
  }));
  const semanticContext = { stableUserId: "XUNAN", projectScope: "/workspace", concerns: [], trajectories, inspectionExperiences: [] };
  const methodContext = buildHanliMethodContext(semanticContext);
  assert.ok(methodContext.length <= HANLI_METHOD_CONTEXT_CHARACTER_BUDGET);
  assert.match(methodContext, /哪一项信息会实质改变/);
  assert.match(methodContext, /从新发现的信息缺口扩展/);
  assert.doesNotMatch(methodContext, /客户目标|证据原文|历史答案|节点正文/);

  const fullUserMessage = `用户原话-${"甲".repeat(300)}`;
  const recentConversation = buildHanliRecentConversation([
    personaConversationMessage("customer-visible", { speakerType: "user", speakerPersonaId: null, content: fullUserMessage }),
    personaConversationMessage("customer-visible", { speakerType: "persona", speakerPersonaId: "han-li", content: `韩立长回答-${"乙".repeat(300)}` }),
  ]);
  assert.ok(recentConversation.length <= HANLI_RECENT_CONVERSATION_CHARACTER_BUDGET);
  assert.match(recentConversation, new RegExp(fullUserMessage));
  assert.doesNotMatch(recentConversation, /乙{100}/);

  const events = [];
  let sentPrompt = "";
  const service = new HanliConversationService({
    store: evolutionStore(path.join(controlledTestRoot, "hanli-method-context-state")), prompts,
    memory: {
      readPersonaConversation() { return { ownerPersonaId: "han-li", conversationId: null, messages: [], updatedAt: "2026-09-03T00:00:00.000Z" }; },
      readPersonaCustomerDisplayConversation() { return { ownerPersonaId: "han-li", conversationId: null, messages: [], updatedAt: "2026-09-03T00:00:00.000Z" }; },
      newPersonaConversation() { return { ownerPersonaId: "han-li", conversationId: "hanli-method-thread", messages: [], updatedAt: "2026-09-03T00:00:00.000Z" }; },
      readHanliSemanticContext() { return semanticContext; },
      registerPersonaRound(input) { return { ownerPersonaId: "han-li", conversationId: input.conversationId, messages: [], updatedAt: input.completedAt }; },
    },
    conversation: {
      activeConversationId: () => "hanli-provider-thread",
      async send(_request, prompt) {
        sentPrompt = prompt;
        return { threadId: "hanli-provider-thread", itemCount: 1, text: `我会先确认信息缺口。\nHANLI_TOPIC_META={"title":"方法学习","type":"提问方法","switchTopic":false,"userIntent":"优化调查方法","tags":["调查"],"summary":"先确认信息缺口。"}` };
      },
      async newChat() {},
    },
    recordEvent(type, payload) { events.push({ type, payload }); },
    refreshSemanticMemory() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
  });
  const result = await service.send({ clientMessageId: "method-user-1", message: "帮我调查当前问题", attachmentIds: [], workspaceState, locale: "zh-CN" });
  assert.ok(result.contextReadStats.methodCharacters <= HANLI_METHOD_CONTEXT_CHARACTER_BUDGET);
  assert.equal(result.contextReadStats.promptCharacters, sentPrompt.length);
  assert.equal(events.at(-1).payload.contextReadStats.promptCharacters, sentPrompt.length);
  assert.match(sentPrompt, /hanli_method_learning_context/);
  assert.doesNotMatch(sentPrompt, /不得进入方法上下文的客户目标/);
  assert.match(hanliConversationPromptSource, /不得把方法样本当成相似案例/);
  assert.match(hanliConversationWorkspaceSource, /本轮读取：方法资料/);
});

test("审批、编排和分发服务不再互相代替职责", () => {
  const orchestrator = new EvolutionFlowOrchestrator();
  assert.equal(orchestrator.next({ status: "pending-approval", distributedTaskIds: [] }), "await-approval");
  assert.equal(orchestrator.next({ status: "approved", distributedTaskIds: [] }), "dispatch");
  assert.equal(orchestrator.next({ status: "executing", distributedTaskIds: ["task-1"] }), "monitor-execution");
  assert.doesNotMatch(approvalServiceSource, /EvolutionTaskDistributionService|\.submitTask\(|\.dispatch\(/);
  assert.doesNotMatch(distributionServiceSource, /\.decide\(|EvolutionApprovalService/);
  assert.doesNotMatch(evolutionFacadeSource, /#dispatchOnce|#store\.decide\(|createEvolutionApprovalService|EvolutionTaskDistributionService/);
  assert.match(hanliApplicationSource, /new EvolutionApprovalService/);
  assert.match(hanliApplicationSource, /new HanliConversationService/);
  assert.match(hanliApplicationSource, /new HanliDecisionService/);
  assert.doesNotMatch(personaEvolutionRuntimeSource, /createEvolutionApprovalService|createHanliDeliberationPort|#approvals|#hanliDecisions/);
  assert.match(personaEvolutionRuntimeSource, /new EvolutionFlowPolicy/);
  assert.match(personaEvolutionRuntimeSource, /createNangongTaskDistribution/);
  assert.match(personaEvolutionRuntimeSource, /运行态代表用户已经确认统一托管/);
  assert.match(personaEvolutionRuntimeSource, /暂停、停止和人工接管必须冻结当前专题/);
  assert.doesNotMatch(personaEvolutionRuntimeSource, /automaticApprovalQueue|automaticDistributionQueue|automaticNangongApprovalEnabled|automaticLinghuApprovalEnabled|automaticExecutionEnabled/);
  assert.match(nangongApplicationSource, /class NangongApplicationService/);
  assert.doesNotMatch(personaEvolutionRuntimeSource, /parseConversationResponse|revisionInvestigationPrompt/);
});

test("审批服务按发生顺序发布申请、决定和补充事实且不会提前分发", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-approval-events-"));
  try {
    const events = [];
    let submitted = 0;
    const facade = new PersonaEvolutionRuntime({
      store: evolutionStore(path.join(directory, "state.json")),
      collaboration: { state() { return { members: [{ memberId: "nangong-wan", displayName: "南宫婉", enabled: true }], tasks: [] }; }, submitTask() { submitted += 1; return { tasks: [] }; } },
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

test("旧状态四项开关加载后被清除且不再进入公开状态", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-retired-switches-"));
  try {
    const key = path.join(directory, "state.json");
    const legacy = evolutionStore(key).state();
    writePersistedState(key, { ...legacy, automaticEvolutionEnabled: true, automaticNangongApprovalEnabled: false, automaticLinghuApprovalEnabled: true, automaticExecutionEnabled: false });
    const state = evolutionStore(key).state();
    assert.equal("automaticEvolutionEnabled" in state, false);
    assert.equal("automaticNangongApprovalEnabled" in state, false);
    assert.equal("automaticLinghuApprovalEnabled" in state, false);
    assert.equal("automaticExecutionEnabled" in state, false);
    assert.equal("automaticEvolutionEnabled" in readPersistedState(key), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("回复1建立专题运行并同时开启统一持续自动状态", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-state-"));
  try {
    const filePath = path.join(directory, "state.json");
    const store = evolutionStore(filePath);
    let state = store.beginOneShotRun(workspaceState, "zh-CN");
    assert.equal(state.oneShotRun.status, "running");
    assert.equal(state.automationRuntime.status, "running");
    state = store.finishOneShotRun();
    const restored = evolutionStore(filePath).state();
    assert.equal(restored.oneShotRun.status, "completed");
    assert.equal(restored.oneShotRun.phase, "completed");
    assert.equal(restored.automationRuntime.status, "running");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("验收阻塞和暂停从同一提案继续，不重建任务且拒绝重复恢复", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "acceptance-resume-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const runId = store.beginOneShotRun(workspaceState, "zh-CN").oneShotRun.runId;
    const topicId = store.createTopic(topicRequest("恢复验收")).activeTopicId;
    const proposalId = store.createProposal(topicId, proposalRequest(), "nangong-wan", "南宫婉").proposals.at(-1).proposalId;
    store.updateOneShotRun("accepting", "han-li", "韩立", "验收", topicId, proposalId);
    store.markProgress(proposalId, "pending-acceptance", "等待验收");
    store.blockOneShotRun("验收连接失败");
    const before = store.state();
    const resumed = store.resumeOneShotRun();
    assert.equal(resumed.oneShotRun.runId, runId);
    assert.equal(resumed.oneShotRun.phase, "accepting");
    assert.equal(resumed.oneShotRun.actor, "han-li");
    assert.deepEqual(resumed.proposals, before.proposals);
    assert.throws(() => store.resumeOneShotRun(), /没有可原位恢复/);
    store.controlAutomation("pause");
    assert.equal(store.resumeOneShotRun().oneShotRun.phase, "accepting");
    store.finishOneShotRun();
    assert.throws(() => store.resumeOneShotRun(), /没有可原位恢复/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立审批输出异常后从原审批卡点继续", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "approval-resume-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const runId = store.beginOneShotRun(workspaceState, "zh-CN").oneShotRun.runId;
    const topicId = store.createTopic(topicRequest("恢复方向审批")).activeTopicId;
    const proposalId = store.createProposal(topicId, proposalRequest(), "nangong-wan", "南宫婉").proposals.at(-1).proposalId;
    store.updateOneShotRun("approving", "han-li", "韩立", "审批方向", topicId, proposalId);
    store.blockOneShotRun("韩立方向审批结果无法处理");

    const resumed = store.resumeOneShotRun();

    assert.equal(resumed.oneShotRun.runId, runId);
    assert.equal(resumed.oneShotRun.phase, "approving");
    assert.equal(resumed.oneShotRun.actor, "han-li");
    assert.equal(resumed.oneShotRun.topicId, topicId);
    assert.equal(resumed.oneShotRun.proposalId, proposalId);
    assert.equal(resumed.proposals.at(-1).status, "pending-approval");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("专题流程从同一提案卡点原位恢复统一自动运行", () => {
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
    assert.equal(state.automationRuntime.status, "running");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("客户确认的提案范围修订会替换运行使用的验收条件版本", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-scope-revision-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.beginOneShotRun(workspaceState, "zh-CN");
    let state = store.createTopic(topicRequest("范围修订同步"));
    const topicId = state.activeTopicId;
    state = store.createProposal(topicId, proposalRequest(), "nangong-wan", "南宫婉");
    const original = state.proposals.at(-1);
    store.updateOneShotRun("revising", "nangong-wan", "南宫婉", "正在按客户确认范围修订", topicId, original.proposalId);
    store.decide(original.proposalId, "supplement-required", "客户已排除旧验收条件，请提交更新后的条件。", "manual-user", []);

    state = store.revise(original.proposalId, {
      submitterMemberId: original.submitterMemberId,
      content: "保留完成通知、历史记录和人物真实状态，移除已排除的状态更新失败条件。",
      evidence: ["客户范围修订"],
      impactScope: ["验收范围"],
      exclusions: ["后续状态更新失败"],
      risks: ["旧验收目标误入返修"],
      rollbackPlan: "回退本次提案版本。",
      acceptanceCriteria: ["完成通知、历史记录和人物真实状态可验证"],
    }, "南宫婉");

    const revised = state.proposals.at(-1);
    assert.equal(revised.supersedesProposalId, original.proposalId);
    assert.deepEqual(revised.acceptanceCriteria, ["完成通知、历史记录和人物真实状态可验证"]);
    assert.deepEqual(revised.exclusions, ["后续状态更新失败"]);
    assert.equal(state.oneShotRun.proposalId, revised.proposalId);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("已审批提案在首次分发失败后从原卡点继续分发", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "approved-distribution-resume-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.beginOneShotRun(workspaceState, "zh-CN");
    let state = store.createTopic(topicRequest("首次分发失败恢复"));
    const topicId = state.activeTopicId;
    state = store.createProposal(topicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.updateOneShotRun("approving", "han-li", "韩立", "正在审批", topicId, proposalId);
    store.decide(proposalId, "approved", "方向通过，进入任务分发", "automatic-han-li", []);
    store.blockOneShotRun("首次任务分发返回无效结构化结果");

    state = store.resumeOneShotRun();

    assert.equal(state.oneShotRun.runId.startsWith("evolution-one-shot-"), true);
    assert.equal(state.oneShotRun.topicId, topicId);
    assert.equal(state.oneShotRun.proposalId, proposalId);
    assert.equal(state.oneShotRun.status, "running");
    assert.equal(state.oneShotRun.phase, "distributing");
    assert.equal(state.oneShotRun.actor, "nangong-wan");
    assert.match(state.oneShotRun.action, /原分发卡点/);
    assert.equal(state.automationRuntime.status, "running");
    assert.deepEqual(state.proposals.at(-1).distributedTaskIds, []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动控制台转人工后只观察且必须明确恢复才能继续", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-handover-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.controlAutomation("start");
    assert.equal(state.automationRuntime.status, "running");
    state = store.controlAutomation("handover");
    assert.equal(state.automationRuntime.status, "paused");
    assert.match(state.automationRuntime.stopReason, /人工接管.*仅观察/);
    state = store.controlAutomation("resume");
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
    assert.equal(state.version, 9);
    assert.equal("automaticNangongApprovalEnabled" in state, false);
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
    assert.deepEqual(state.automationSettings, { maxRoundsPerTopic: 9, maxCorrectionRounds: 4, automaticCustodyEnabled: false });
    assert.equal(state.automationContext.locale, "ja");
    assert.equal(state.automationContext.workspaceState, null);
    assert.equal(state.automationRuntime.status, "idle");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("演进会话把客户消息和完成后的南宫婉答复标记为客户可见", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-conversation-message-type-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const pending = store.appendConversation("user", "请确认当前实现。", [], {
      messageId: "customer-message-1",
      deliveryStatus: "sending",
    });
    assert.equal(pending.conversation.messages.at(-1).messageType, "customer-visible");

    const completed = store.completeConversationTurn("customer-message-1", "当前实现已经确认。");
    assert.deepEqual(
      completed.conversation.messages.map((message) => message.messageType),
      ["customer-visible", "customer-visible"],
    );
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动审批无人工偏好时退回补充，人工决定形成版本化偏好", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-approval-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation, recordEvent: () => undefined });
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, recordEvent: () => undefined });
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
    const collaboration = { submitTask(request) { submitted = request; return { taskId: "collab-1", state: { tasks: [{ taskId: "collab-1", evolutionProposalId: request.evolutionProposalId }] } }; } };
    const facade = new PersonaEvolutionRuntime({
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

test("分发计划会纠正首轮无效 JSON，并从围栏中的单个有效对象继续", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-retry-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const events = []; let attempts = 0; let submitted = 0;
    const validPlan = JSON.stringify({ summary: "单一文件边界由同一执行人完成。", units: [{ title: "收起临时工作区", scope: "在验收结束后收起当前临时工作区", acceptanceCriteria: ["临时工作区在验收结束后收起"], expectedFiles: ["apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"], independentReason: "状态变更与验收收口不能拆分" }] });
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: (type, details) => events.push({ type, details }),
      collaboration: { submitTask(request) { submitted += 1; return { taskId: "json-retry-task", state: { tasks: [{ taskId: "json-retry-task", evolutionProposalId: request.evolutionProposalId }] } }; } },
      async planDistribution() { attempts += 1; return attempts === 1 ? "计划如下：暂未形成可解析的计划。" : `\`\`\`json\n${validPlan}\n\`\`\``; },
    });
    let state = facade.createTopic(topicRequest("收起临时工作区"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(attempts, 2);
    assert.equal(submitted, 1);
    assert.equal(state.proposals[0].distributionPlan.validation.decision, "passed");
    const retry = events.find((event) => event.type === "nangong.evolution.distribution_format_retry");
    assert.deepEqual(retry.details, { proposalId, attempt: 1, responseLength: "计划如下：暂未形成可解析的计划。".length, candidateCount: 0, hasUnclosedObject: false, formatKind: "missing-object", reason: "AI 返回的结构化判断不是有效 JSON。" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("分发计划格式重试仅记录闭合候选数量而不记录无效对象原文", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-invalid-object-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const events = []; let attempts = 0; let submitted = 0; let retryPrompt = "";
    const rawFailure = "无效对象：{\"summary\": }";
    const validPlan = JSON.stringify({ summary: "单一文件边界由同一执行人完成。", units: [{ title: "收起临时工作区", scope: "在验收结束后收起当前临时工作区", acceptanceCriteria: ["临时工作区在验收结束后收起"], expectedFiles: ["apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"], independentReason: "状态变更与验收收口不能拆分" }] });
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: (type, details) => events.push({ type, details }),
      collaboration: { submitTask(request) { submitted += 1; return { taskId: "json-invalid-object-task", state: { tasks: [{ taskId: "json-invalid-object-task", evolutionProposalId: request.evolutionProposalId }] } }; } },
      async planDistribution(prompt) { attempts += 1; if (attempts === 2) retryPrompt = prompt; return attempts === 1 ? rawFailure : validPlan; },
    });
    let state = facade.createTopic(topicRequest("收起临时工作区"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(attempts, 2);
    assert.equal(submitted, 1);
    const retry = events.find((event) => event.type === "nangong.evolution.distribution_format_retry");
    assert.deepEqual(retry.details, { proposalId, attempt: 1, responseLength: rawFailure.length, candidateCount: 1, hasUnclosedObject: false, formatKind: "invalid-object", reason: "AI 返回的结构化判断不是有效 JSON。" });
    assert.equal(JSON.stringify(events).includes(rawFailure), false);
    assert.match(retryPrompt, /程序上一轮检测到格式错误：/);
    assert.doesNotMatch(retryPrompt, /程序上一轮核对到的确定性冲突：/);
    assert.match(retryPrompt, /提取到 1 个闭合对象但 JSON 语法无效/);
    assert.equal(state.proposals[0].distributionPlan.validation.decision, "passed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("分发计划外层对象未闭合但内部任务对象闭合时仍进入格式重试", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-unclosed-plan-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const events = []; let attempts = 0; let submitted = 0; let retryPrompt = "";
    const validPlan = JSON.stringify({ summary: "单一文件边界由同一执行人完成。", units: [{ title: "收起临时工作区", scope: "在验收结束后收起当前临时工作区", acceptanceCriteria: ["临时工作区在验收结束后收起"], expectedFiles: ["apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"], independentReason: "状态变更与验收收口不能拆分" }] });
    const rawFailure = validPlan.slice(0, -1);
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: (type, details) => events.push({ type, details }),
      collaboration: { submitTask(request) { submitted += 1; return { taskId: "json-unclosed-plan-task", state: { tasks: [{ taskId: "json-unclosed-plan-task", evolutionProposalId: request.evolutionProposalId }] } }; } },
      async planDistribution(prompt) { attempts += 1; if (attempts === 2) retryPrompt = prompt; return attempts === 1 ? rawFailure : validPlan; },
    });
    let state = facade.createTopic(topicRequest("收起临时工作区"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(attempts, 2);
    assert.equal(submitted, 1);
    assert.deepEqual(events.filter((event) => event.type === "nangong.evolution.distribution_format_retry").map((event) => event.details.candidateCount), [1]);
    assert.deepEqual(events.filter((event) => event.type === "nangong.evolution.distribution_format_retry").map((event) => event.details.hasUnclosedObject), [true]);
    assert.match(retryPrompt, /程序上一轮检测到格式错误：/);
    assert.match(retryPrompt, /检测到未闭合 JSON 对象/);
    assert.doesNotMatch(retryPrompt, /闭合对象但 JSON 语法无效/);
    assert.equal(JSON.stringify(events).includes(rawFailure), false);
    assert.equal(state.proposals[0].distributionPlan.validation.decision, "passed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("分发计划忽略说明中的相邻元数据对象并使用完整计划", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-adjacent-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const events = []; let attempts = 0; let submitted = 0;
    const validPlan = JSON.stringify({ summary: "单一文件边界由同一执行人完成。", units: [{ title: "收起临时工作区", scope: "在验收结束后收起当前临时工作区", acceptanceCriteria: ["临时工作区在验收结束后收起"], expectedFiles: ["apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"], independentReason: "状态变更与验收收口不能拆分" }] });
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: (type, details) => events.push({ type, details }),
      collaboration: { submitTask(request) { submitted += 1; return { taskId: "json-adjacent-task", state: { tasks: [{ taskId: "json-adjacent-task", evolutionProposalId: request.evolutionProposalId }] } }; } },
      async planDistribution() { attempts += 1; return `计划说明：{\"trace\":\"metadata\"}\n${validPlan}\n请按该计划执行。`; },
    });
    let state = facade.createTopic(topicRequest("收起临时工作区"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(attempts, 1);
    assert.equal(submitted, 1);
    assert.equal(state.proposals[0].distributionPlan.summary, "单一文件边界由同一执行人完成。");
    assert.equal(events.some((event) => event.type === "nangong.evolution.distribution_format_retry"), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("分发计划字段含转义字符和花括号时仍提取完整对象", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-escaped-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let submitted = 0;
    const scope = "读取结果示例 {\"status\":\"ok\"}；路径 C:\\workspace\\fixture";
    const validPlan = JSON.stringify({ summary: "单一文件边界由同一执行人完成。", units: [{ title: "收起临时工作区", scope, acceptanceCriteria: ["临时工作区在验收结束后收起"], expectedFiles: ["apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"], independentReason: "状态变更与验收收口不能拆分" }] });
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: () => undefined,
      collaboration: { submitTask(request) { submitted += 1; return { taskId: "json-escaped-task", state: { tasks: [{ taskId: "json-escaped-task", evolutionProposalId: request.evolutionProposalId }] } }; } },
      async planDistribution() { return validPlan; },
    });
    let state = facade.createTopic(topicRequest("收起临时工作区"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(submitted, 1);
    assert.equal(state.proposals[0].distributionPlan.units[0].scope, scope);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("分发计划在说明文字包裹 JSON 围栏时仍使用完整计划", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-fenced-prose-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let submitted = 0;
    const validPlan = JSON.stringify({ summary: "单一文件边界由同一执行人完成。", units: [{ title: "收起临时工作区", scope: "在验收结束后收起当前临时工作区", acceptanceCriteria: ["临时工作区在验收结束后收起"], expectedFiles: ["apps/ai-desktop/electron/services/workflow/internal/evolution/persona-evolution.runtime.ts"], independentReason: "状态变更与验收收口不能拆分" }] });
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: () => undefined,
      collaboration: { submitTask(request) { submitted += 1; return { taskId: "json-fenced-prose-task", state: { tasks: [{ taskId: "json-fenced-prose-task", evolutionProposalId: request.evolutionProposalId }] } }; } },
      async planDistribution() { return `计划如下：\n\`\`\`JSON\n${validPlan}\n\`\`\`\n以上为全部计划。`; },
    });
    let state = facade.createTopic(topicRequest("收起临时工作区"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(submitted, 1);
    assert.equal(state.proposals[0].distributionPlan.summary, "单一文件边界由同一执行人完成。");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("分发计划连续两次无效 JSON 时阻断且不记录模型原文", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-json-failure-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const events = []; let attempts = 0; let submitted = 0;
    const rawFailure = "模型原文不得出现在审计中：{\"summary\":\"未闭合";
    const facade = new PersonaEvolutionRuntime({
      store, conversation, recordEvent: (type, details) => events.push({ type, details }),
      collaboration: { submitTask() { submitted += 1; return { tasks: [] }; } },
      async planDistribution() { attempts += 1; return rawFailure; },
    });
    let state = facade.createTopic(topicRequest("连续格式失败"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    await assert.rejects(() => facade.dispatch(proposalId), /AI 返回的结构化判断不是有效 JSON/);
    assert.equal(attempts, 2);
    assert.equal(submitted, 0);
    assert.equal(JSON.stringify(events).includes(rawFailure), false);
    assert.deepEqual(events.filter((event) => event.type === "nangong.evolution.distribution_format_retry").map((event) => event.details.responseLength), [rawFailure.length]);
    assert.deepEqual(events.filter((event) => event.type === "nangong.evolution.distribution_format_failed").map((event) => event.details), [{ proposalId, attempt: 2, responseLength: rawFailure.length, candidateCount: 0, hasUnclosedObject: true, formatKind: "unclosed-object", reason: "AI 返回的结构化判断不是有效 JSON。" }]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("专题工作区缺失时返还执行显示业务错误而不是读取 null.roots", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-dispatch-missing-workspace-"));
  const statePath = path.join(directory, "state.json");
  try {
    const store = evolutionStore(statePath);
    const collaboration = { submitTask() { throw new Error("缺少工作区时不得创建任务"); } };
    const facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest());
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    const persisted = readPersistedState(statePath);
    persisted.topics[0].workspaceState = null;
    writePersistedState(statePath, persisted);
    const restored = new PersonaEvolutionRuntime({ store: evolutionStore(statePath), collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    await assert.rejects(() => restored.dispatch(proposalId), /当前专题缺少可用的实施工作区/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("生产分发会话显式使用专题工作区且令狐不再参与常规分发审核", () => {
  assert.match(applicationRuntimeSource, /planDistribution: async \(prompt, workspaceState, locale, emit\)[\s\S]*nangongDistributionCodex![\s\S]*mergeWorkspaceState\(workspaces\.read\(\), workspaceState\)/);
  assert.doesNotMatch(applicationRuntimeSource, /planDistribution: async[^\n]*automationContext\.workspaceState/);
  assert.doesNotMatch(applicationRuntimeSource, /linghuDistributionAuditCodex|auditDistribution:/);
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
      { title: "修改按钮", scope: "调整同一工具栏按钮", acceptanceCriteria: ["按钮可用"], expectedFiles: ["apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx"], independentReason: "页面改动" },
      { title: "验证按钮", scope: "验证同一工具栏按钮", acceptanceCriteria: ["按钮通过测试"], expectedFiles: ["apps/ai-desktop/src/applications/developer/DeveloperApplication.tsx"], independentReason: "测试改动" },
    ] });
    const facade = new PersonaEvolutionRuntime({
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

test("分发计划中的 core 规则在创建任务前被当前用户目录校验拒绝", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-task-rule-catalog-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let attempts = 0;
    let submittedAtAttempt = null;
    let retryPrompt = "";
    const invalidPlan = JSON.stringify({ summary: "首轮错误引用 core 规则。", units: [{ title: "校验专项规则目录", scope: "为任务分发补充当前用户规则目录校验", acceptanceCriteria: ["未登记规则不得创建任务"], expectedFiles: ["apps/ai-desktop/electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.ts"], taskRuleIds: ["CODE_JS_RULES"], independentReason: "目录校验与分发在同一职责边界" }] });
    const validPlan = JSON.stringify({ summary: "第二轮移除未登记规则。", units: [{ title: "校验专项规则目录", scope: "为任务分发补充当前用户规则目录校验", acceptanceCriteria: ["未登记规则不得创建任务"], expectedFiles: ["apps/ai-desktop/electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.ts"], taskRuleIds: [], independentReason: "目录校验与分发在同一职责边界" }] });
    const facade = new PersonaEvolutionRuntime({
      store,
      conversation,
      recordEvent: () => undefined,
      isCurrentUserTaskRuleId: (logicalId) => logicalId === "XUNAN_REGISTERED_RULE",
      collaboration: {
        submitTask(request) {
          submittedAtAttempt = attempts;
          return { taskId: "task-rule-catalog", state: { tasks: [{ taskId: "task-rule-catalog", evolutionProposalId: request.evolutionProposalId }] } };
        },
      },
      async planDistribution(prompt) {
        attempts += 1;
        if (attempts === 2) retryPrompt = prompt;
        return attempts === 1 ? invalidPlan : validPlan;
      },
    });
    let state = facade.createTopic(topicRequest("当前用户规则目录校验"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    state = await facade.dispatch(proposalId);
    assert.equal(attempts, 2);
    assert.equal(submittedAtAttempt, 2);
    assert.match(retryPrompt, /CODE_JS_RULES/);
    assert.match(retryPrompt, /当前用户未登记的专项规则/);
    assert.deepEqual(state.proposals[0].distributionPlan.units[0].taskRuleIds, []);
    assert.equal(state.proposals[0].distributionPlan.validation.decision, "passed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("已通过的持久化计划在分发前重验当前用户规则目录", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-persisted-task-rule-catalog-"));
  try {
    const statePath = path.join(directory, "state.json");
    const store = evolutionStore(statePath);
    const stalePlan = {
      version: 1,
      summary: "旧计划在当时的规则目录中通过。",
      units: [{ title: "校验专项规则目录", scope: "在分发前重新核验持久化计划的规则 ID", acceptanceCriteria: ["未登记规则不得创建任务"], expectedFiles: ["apps/ai-desktop/electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.ts"], taskRuleIds: ["CODE_JS_RULES"], independentReason: "规则目录在任务快照前必须保持一致" }],
      validation: { decision: "passed", reason: "旧目录校验通过", findings: [], validatedAt: "2026-09-14T00:00:00.000Z" },
      plannedAt: "2026-09-14T00:00:00.000Z",
    };
    const validPlan = JSON.stringify({ summary: "重新规划后移除未登记规则。", units: [{ title: "校验专项规则目录", scope: "在分发前重新核验持久化计划的规则 ID", acceptanceCriteria: ["未登记规则不得创建任务"], expectedFiles: ["apps/ai-desktop/electron/services/personas/nangong/internal/distribution/nangong-task-distribution.service.ts"], taskRuleIds: [], independentReason: "规则目录在任务快照前必须保持一致" }] });
    let attempts = 0;
    let submitted = 0;
    const events = [];
    const facade = new PersonaEvolutionRuntime({
      store,
      conversation,
      recordEvent(type, details) { events.push({ type, details }); },
      isCurrentUserTaskRuleId: () => false,
      collaboration: {
        submitTask(request) {
          submitted += 1;
          assert.deepEqual(request.taskRuleIds, []);
          return { taskId: "persisted-task-rule-catalog", state: { tasks: [{ taskId: "persisted-task-rule-catalog", evolutionProposalId: request.evolutionProposalId }] } };
        },
      },
      async planDistribution() { attempts += 1; return validPlan; },
    });
    let state = facade.createTopic(topicRequest("持久化计划规则目录校验"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    store.saveDistributionPlan(proposalId, stalePlan);

    state = await facade.dispatch(proposalId);
    assert.equal(attempts, 1);
    assert.equal(submitted, 1);
    assert.deepEqual(state.proposals[0].distributionPlan.units[0].taskRuleIds, []);
    assert.equal(state.proposals[0].distributionPlan.validation.decision, "passed");
    assert.deepEqual(events.find((event) => event.type === "nangong.distribution_validation.completed"), {
      type: "nangong.distribution_validation.completed",
      details: {
        proposalId, attempt: 0, decision: "revise", reason: "程序发现任务之间存在确定性冲突。",
        findings: ["任务“校验专项规则目录”声明了当前用户未登记的专项规则：CODE_JS_RULES"],
      },
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("旧分发 audit 字段一次性迁移为程序 validation 且保留专题事实", async () => {
  const key = "nangong-distribution-validation-migration";
  const store = evolutionStore(key);
  const collaboration = { submitTask(request) { return { taskId: "migration-task", state: { tasks: [{ taskId: "migration-task", evolutionProposalId: request.evolutionProposalId }] } }; } };
  const facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
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
        return { taskId: taskIds.at(-1), state: this.state() };
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
    const facade = new PersonaEvolutionRuntime({
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
      submitTask(request) { distributedTaskId = "collab-evolution-completed"; return { taskId: distributedTaskId, state: { tasks: [{ taskId: distributedTaskId, evolutionProposalId: request.evolutionProposalId, state: "integrated" }] } }; },
      state() { return { tasks: distributedTaskId ? [{ taskId: distributedTaskId, state: "integrated" }] : [] }; },
    };
    const facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    store.controlAutomation("start");
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
    assert.equal(state.proposals[0].resultSummary, "全部当前有效任务已经完成，等待韩立按真实用户路径验收结果。");
    assert.equal(state.topics.length, 1);
    state = freezePageAcceptancePlan(store, state, proposalId);
    store.recordAcceptanceRun(computerRun("completed-run", state.topics[0].topicId, proposalId, "passed", "shot-completed", state.proposals[0].acceptancePlan));
    state = facade.decideResult(proposalId, { mutation: mutation(facade), decision: "approved", advice: "真实操作和视觉检查符合目标。" });
    assert.equal(state.proposals[0].status, "completed");
    assert.equal(state.proposals[0].approvals.at(-1).stage, "result");
    state = facade.state();
    assert.equal(state.topics.length, 1);
    assert.equal(state.topics[0].nextTopicId, null);
    assert.equal(state.topics[0].recoveryPoint, "han-li-result-accepted");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test.skip("历史兼容：韩立后台逐轮发问已经退役", async () => {
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
      readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: projectPaths.projectRoot, concerns: [], trajectories: [], inspectionExperiences: [] }; },
      readHanLiEvolutionCorpus(deliberationId) {
        const capturedAt = "2026-08-26T00:00:00.000Z";
        return [
          { snapshotId: `${deliberationId}:nangong:1`, deliberationId, source: "nangong", conversationId: "nangong-1", sourceMessageId: "n-1", sequenceNumber: 0, role: "user", responsePhase: null, content: "专题要保留完整过程。", originalCreatedAt: capturedAt, capturedAt },
          { snapshotId: `${deliberationId}:codex:1`, deliberationId, source: "codex", conversationId: "codex-1", sourceMessageId: "c-1", sequenceNumber: 0, role: "codex", responsePhase: "final_answer", content: "执行日志已经生成。", originalCreatedAt: capturedAt, capturedAt },
        ];
      },
    };
    const facade = new PersonaEvolutionRuntime({
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

test.skip("历史兼容：后台研讨轮次上限已经退役", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "han-li-deliberation-limit-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: 1, maxCorrectionRounds: 3, workspaceState, locale: "zh-CN" });
    const replies = [
      '{"question":"还缺少哪项执行事实？","reason":"现有原文没有证明发布结果"}',
      '{"decision":"continue","assessment":"发布结果仍没有事实证据。","nextQuestion":"发布后实际页面状态是什么？","questionReason":"缺少发布后用户可见结果"}',
    ];
    const facade = new PersonaEvolutionRuntime({
      store, collaboration: {}, conversation, recordEvent: () => undefined,
      memory: {
        readHanliSemanticContext() { return { stableUserId: "XUNAN", projectScope: projectPaths.projectRoot, concerns: [], trajectories: [], inspectionExperiences: [] }; },
        readHanLiEvolutionCorpus(deliberationId) { return [{ snapshotId: "limit-source", deliberationId, source: "codex", conversationId: "thread", sourceMessageId: "message", sequenceNumber: 0, role: "codex", responsePhase: "final_answer", content: "只完成了代码修改。", originalCreatedAt: "2026-08-26T00:00:00.000Z", capturedAt: "2026-08-26T00:00:00.000Z" }]; },
      },
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation, recordEvent: () => undefined });
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: plainConversation, recordEvent: () => undefined });
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: plainConversation, recordEvent: () => undefined });
    await facade.sendConversationMessage({ clientMessageId: "client-message-1", message: "1", workspaceState, locale: "zh-CN" });
    const state = await facade.sendConversationMessage({ clientMessageId: "client-message-2", message: "1", workspaceState, locale: "zh-CN" });
    assert.deepEqual(state.conversation.messages.map((message) => message.sequenceNumber), [0, 1, 2, 3]);
    assert.deepEqual(state.conversation.messages.filter((message) => message.speakerType === "user").map((message) => message.messageId), ["client-message-1", "client-message-2"]);
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
      readPersonaConversation() { return null; },
      syncConversation() { throw new Error("training database unavailable"); },
    };
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: plainConversation, memory, recordEvent: () => undefined, recordFailure: (failure) => failures.push(failure) });
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
    const memory = { buildNangongContext() { return ""; }, readPersonaConversation() { return null; }, syncConversation() { archiveCount += 1; } };
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: failedConversation, memory, recordEvent: () => undefined });
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    await facade.sendConversationMessage({ message: "继续调查", workspaceState, locale: "zh-CN" });
    const state = await facade.sendConversationMessage({ message: "1", workspaceState, locale: "zh-CN" });
    assert.equal(state.topics.length, 0);
    assert.equal(state.oneShotRun, null);
    assert.equal(state.oneShotConfirmation ?? null, null);
    assert.equal(state.conversation.messages.at(-2).inferredIntent, undefined);
    assert.match(state.conversation.messages.at(-1).content, /当前没有等待确认的自动演化/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("已有真实运行时再次回复 1 返回可理解说明而不是发送失败", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-one-shot-live-conflict-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.beginOneShotRun(workspaceState, "zh-CN");
    const invited = store.appendConversation("nangong", "当前事实已经明确，若确认启动请回复 1。", []);
    store.setOneShotConfirmation(invited.conversation.messages.at(-1).messageId);
    const facade = new PersonaEvolutionRuntime({ store, collaboration: { state() { return { members: [], tasks: [] }; } }, conversation, recordEvent: () => undefined });
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
    const facade = new PersonaEvolutionRuntime({
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
        return { taskId: tasks.at(-1).taskId, state: this.state() };
      },
    };
    const readyConversation = {
      async send(request) {
        if (request.message.includes("仅返回 JSON")) return { text: JSON.stringify({ title: "一次性演化课题", goal: "修复当前已确认问题", scope: ["AI Desktop"], evidence: ["用户和南宫婉已确认问题事实"], acceptanceCriteria: ["沿现有流程执行并完成真实验收"] }), itemCount: 1 };
        return { text: "事实、范围和验收条件已经明确。若确认启动持续自动演化，请回复 1。\n<!-- SELPLAT_CORPUS_META {\"title\":\"持续自动演化\",\"type\":\"流程确认\",\"intent\":\"确认当前问题事实与实施范围\",\"tags\":[\"持续流程\",\"演化课题\"],\"summary\":\"事实成熟后邀请用户启动持续自动演化流程。\"} -->", itemCount: 1 };
      },
      async newChat() {},
    };
    const facade = new PersonaEvolutionRuntime({
      store, collaboration, conversation: readyConversation, ...distributionServices, recordEvent: () => undefined,
      hanLi: { async send(_prompt, state) { return approvedDesignResponse(state, "事实、范围、风险、回退和验收条件完整，同意沿既有流程执行。"); } },
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
    assert.equal(state.automationRuntime.status, "running");
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
        return { taskId: tasks.at(-1).taskId, state: this.state() };
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
        return { text: "事实已经成熟。若确认启动持续自动演化，请回复 1。\n<!-- SELPLAT_CORPUS_META {\"title\":\"集成阻塞\",\"type\":\"技术治理\",\"intent\":\"阻止同一失败循环\",\"tags\":[\"集成\",\"去重\"],\"summary\":\"确认集成阻塞事实后启动持续自动流程。\"} -->", itemCount: 1 };
      },
      async newChat() {},
    };
    const facade = new PersonaEvolutionRuntime({
      store, collaboration, conversation: readyConversation, ...distributionServices,
      recordEvent: () => undefined, recordFailure: (failure) => failures.push(failure),
      hanLi: { async send(_prompt, state) { return approvedDesignResponse(state, "事实和验收条件完整。"); } },
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

    const { topicId, proposalId } = state.oneShotRun;
    await assert.rejects(() => facade.requestSupplementalAcceptance({ topicId, proposalId, runId: "stale-run" }), /补验未能关联原专题/);
    assert.equal(recoveryRequests, 0);
    const explicitlyResumed = await facade.requestSupplementalAcceptance({ topicId, proposalId, runId: state.oneShotRun.runId });
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
    assert.equal(failures[1].flowImpact, "blocked");

    tasks[0].state = "blocked";
    tasks[0].phase = "blocked";
    tasks[0].integrationFailure = null;
    tasks[0].blockingReason = "执行人初始化失败：共享依赖缓存不可用";
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    assert.equal(failures.at(-1).operation, "one_shot_task_waiting_for_linghu:blocked");
    assert.equal(failures.at(-1).flowImpact, "blocked");
    assert.equal(failures.at(-1).details.taskId, "blocked-integration-task");
    assert.equal(facade.state().oneShotRun.status, "running");


    tasks[0].state = "cancelled";
    tasks[0].phase = null;
    tasks[0].blockingReason = "任务已取消，等待重新分发。";
    tasks[0].integrationFailure = null;
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    const cancelled = facade.state();
    assert.equal(cancelled.oneShotRun.status, "blocked");
    assert.equal(failures.at(-1).operation, "one_shot_task_blocked:cancelled");
    assert.equal(failures.at(-1).details.taskId, "blocked-integration-task");

    tasks.length = 0;
    const missing = await facade.resumeOneShotRun(cancelled.oneShotRun.runId);
    assert.equal(missing.oneShotRun.status, "blocked");
    assert.equal(failures.at(-1).operation, "one_shot_task_blocked:missing-task-record");
    assert.deepEqual(failures.at(-1).details.missingTaskIds, ["blocked-integration-task"]);
    assert.match(personaEvolutionRuntimeSource, /proposal-task-state-inconsistent/);
    assert.doesNotMatch(personaEvolutionRuntimeSource, /missing-task-record" : "unknown/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("旧提案验收卡点返修完成后沿修订链自动恢复韩立验收", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-recovered-acceptance-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.configureAutomation({ maxRoundsPerTopic: null, maxCorrectionRounds: 5, automaticCustodyEnabled: true, workspaceState, locale: "zh-CN" });
    store.controlAutomation("start");
    store.beginOneShotRun(workspaceState, "zh-CN");
    let state = store.createTopic(topicRequest("恢复后进入韩立验收"));
    const topicId = state.activeTopicId;
    state = store.createProposal(topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    const failedTaskId = "failed-acceptance-task";
    store.updateOneShotRun("testing", "linghu-ancestor", "令狐老祖", "等待本地修改归属恢复", topicId, proposalId);
    store.markDispatched(proposalId, failedTaskId);
    store.markProgress(proposalId, "pending-acceptance", "等待韩立验收");
    state = freezePageAcceptancePlan(store, state, proposalId);
    store.recordAcceptanceRun(computerRun("original-failure-run", topicId, proposalId, "failed", "original-failure-shot", state.proposals[0].acceptancePlan));
    store.decideResult(proposalId, "supplement-required", "真实验收失败，需要返修", "automatic-han-li");
    store.blockOneShotRun("韩立真实应用验收失败");
    state = store.revise(proposalId, {
      submitterMemberId: "nangong-wan", content: "根据验收失败完成结构化返修", evidence: ["原失败证据"],
      impactScope: ["AI Desktop"], risks: ["无"], rollbackPlan: "撤销本次返修", acceptanceCriteria: ["返修后重新验收"],
    }, "南宫婉");
    const correctionProposalId = state.proposals.at(-1).proposalId;
    const taskId = "recovered-integrated-task";
    store.decide(correctionProposalId, "approved", "返修范围明确", "automatic-han-li", []);
    store.markDispatched(correctionProposalId, taskId);
    // 返修完成事实属于新版本；此前真实阻塞仍属于旧版本，重启时必须沿完整修订链继续验收。
    store.markProgress(correctionProposalId, "pending-acceptance", "任务已经完成集成，等待韩立验收");

    const collaboration = {
      state() {
        return {
          members: [],
          tasks: [{
            taskId,
            evolutionProposalId: correctionProposalId,
            evolutionRoundId: correctionProposalId,
            state: "integrated",
            snapshot: { title: "恢复后进入韩立验收" },
            executionRecords: [],
            createdAt: "2026-09-11T00:00:00.000Z",
            updatedAt: "2026-09-11T00:01:00.000Z",
          }],
        };
      },
    };
    let acceptanceRuns = 0;
    const facade = new PersonaEvolutionRuntime({
      store,
      collaboration,
      conversation,
      hanLi: { send: async () => '{"mode":"mixed","pageCriterionIds":["criterion-1"],"findings":[],"sourceReview":{"status":"passed","actual":"职责集中且便于新手阅读","evidenceReferences":["src/example.ts"]}}' },
      recordEvent: () => undefined,
    });
    facade.setComputerAcceptanceSession(async () => {
      acceptanceRuns += 1;
      return computerRun("recovered-acceptance-run", topicId, correctionProposalId, "passed", "recovered-shot", facade.state().proposals.find((proposal) => proposal.proposalId === correctionProposalId).acceptancePlan);
    });

    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    facade.stop();

    state = facade.state();
    assert.equal(acceptanceRuns, 1);
    assert.equal(state.proposals.at(-1).status, "completed");
    assert.equal(state.oneShotRun.status, "completed");
    assert.equal(state.oneShotRun.phase, "completed");

    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    facade.stop();
    assert.equal(acceptanceRuns, 1, "完成后的轮询不得重复执行韩立验收");
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
        return { text: "事实已经成熟。若确认启动持续自动演化，请回复 1。\nNANGONG_TOPIC_META={\"title\":\"异常登记\",\"type\":\"技术治理\",\"switchTopic\":false,\"userIntent\":\"验证失败登记\",\"tags\":[\"异常中心\"],\"summary\":\"邀请启动持续自动流程。\"}", itemCount: 1 };
      },
      async newChat() {},
    };
    const collaboration = { state() { return { members: [{ memberId: "nangong-wan", displayName: "南宫婉", enabled: true, kind: "worker" }], tasks: [] }; } };
    const facade = new PersonaEvolutionRuntime({
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation, recordEvent: () => undefined });
    let state = facade.createTopic(topicRequest("专题群消息回流"));
    const topicId = state.activeTopicId;
    const originalArchiveCount = state.archiveRecords.length;
    state = await facade.sendConversationMessage({ subject: { type: "evolution-topic", id: topicId }, message: "请南宫婉说明当前专题下一步。", workspaceState, locale: "zh-CN" });
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: draftConversation, recordEvent: () => undefined });
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
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: retryingConversation, recordEvent: () => undefined, newConversationRetryDelaysMs: [0, 1, 1] });
    const state = await facade.newConversation();
    assert.equal(attempts, 3);
    assert.equal(state.conversation.messages.length, 0);
    assert.equal(evolutionStore(path.join(directory, "state.json")).state().conversation.messages.length, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立验收失败把复现步骤和截图沿原结果线路返还南宫婉", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-acceptance-failure-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("真实界面失败返还"), acceptanceCriteria: ["最后一个控件可达"] });
    state = store.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待真实检查");
    state = freezePageAcceptancePlan(store, state, proposalId);
    assert.throws(() => store.decideResult(proposalId, "approved", "直接通过"), /正式页面检查和源码审查且全部通过/);
    const legacyRun = computerRun("legacy-run", state.topics[0].topicId, proposalId, "passed", "legacy-shot", state.proposals[0].acceptancePlan);
    for (const step of legacyRun.stepResults) {
      delete step.layoutStatus;
      delete step.layoutActual;
      delete step.layoutScreenshotAttachmentId;
    }
    store.recordAcceptanceRun(legacyRun);
    assert.throws(() => store.decideResult(proposalId, "approved", "沿用旧验收记录"), /正式页面检查和源码审查且全部通过/);
    store.recordAcceptanceRun(computerRun("failure-run", state.topics[0].topicId, proposalId, "failed", "failure-shot", state.proposals[0].acceptancePlan));
    state = store.decideResult(proposalId, "supplement-required", "修复设置侧栏滚动后重新提交");
    assert.equal(state.proposals[0].status, "supplement-required");
    const resultRecord = state.archiveRecords.at(-1);
    assert.equal(resultRecord.eventType, "proposal.result_decided");
    assert.equal(resultRecord.payload.nextOwner, "nangong-wan");
    assert.equal(resultRecord.payload.failureEvidence[0].target, "真实应用界面");
    assert.equal(resultRecord.payload.failureEvidence[0].actual, "滚动位置没有变化");
    assert.equal(resultRecord.payload.failureEvidence[0].expected, "最后一个控件可达");
    assert.deepEqual(resultRecord.payload.failureEvidence[0].screenshotAttachmentIds, ["failure-shot"]);
    assert.equal(resultRecord.payload.failureEvidence[0].reproductionOperations.length, 2);
    state = store.revise(proposalId, { submitterMemberId: state.proposals[0].submitterMemberId, content: "修复设置侧栏高度与滚动容器，确保窄窗口下最后一个控件可达。", evidence: ["失败截图与滚动位置记录"], impactScope: ["设置侧栏"], risks: ["小窗口布局变化"], rollbackPlan: "回退侧栏滚动容器变更", acceptanceCriteria: ["最后一个控件可滚动到达"] }, "南宫婉");
    const correction = state.proposals.at(-1);
    store.markProgress(correction.proposalId, "pending-acceptance", "修复完成，等待复验");
    state = freezePageAcceptancePlan(store, state, correction.proposalId);
    store.recordAcceptanceRun(computerRun("retest-run", state.topics[0].topicId, correction.proposalId, "passed", "retest-shot", state.proposals.at(-1).acceptancePlan));
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

test("冻结验收计划后才审查计划持久化条件", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-frozen-plan-review-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({
      ...topicRequest("冻结计划后核对持久化"),
      acceptanceCriteria: ["页面预览可见", "计划已持久化并可读取条件编号"],
    });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const promptsSeen = [];
    const replies = [
      JSON.stringify({
        mode: "mixed",
        pageCriterionIds: ["criterion-1"],
        findings: [{ criterionId: "criterion-2", status: "failed", actual: "当前专题记录的 acceptancePlan 为 null。", evidenceReferences: ["首次分类尚未冻结计划"] }],
        sourceReview: passedSourceReview,
      }),
      `补充说明 {not-json}，请采用第二个对象。\n\n\`\`\`json\n${JSON.stringify({ mode: "unsupported" })}\n${JSON.stringify({
        mode: "mixed",
        pageCriterionIds: ["criterion-1"],
        findings: [{ criterionId: "criterion-2", status: "passed", actual: "当前专题记录已保存 acceptancePlan，条件编号和证据类型可读取，包含\\\"转义引号\\\"。", evidenceReferences: ["acceptance.plan_frozen"] }],
        sourceReview: passedSourceReview,
      })}\n\`\`\``,
    ];
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanli: async (prompt) => { promptsSeen.push(prompt); return replies.shift(); },
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    const result = await hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" });
    assert.equal(promptsSeen.length, 2, "代码符合性结论必须在计划冻结后重新审查");
    assert.match(promptsSeen[0], /"acceptancePlan":null/);
    assert.match(promptsSeen[1], new RegExp(result.plan.planId));
    assert.equal(result.review.mode, "mixed");
    assert.equal(result.review.stepResults[0].status, "passed");
    assert.match(result.review.stepResults[0].actual, /已保存 acceptancePlan/);
    assert.equal(store.state().proposals.at(-1).acceptancePlan.planId, result.plan.planId);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("页面条件覆盖全部原要求时仍同时完成源码结构审查", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-mixed-routing-retry-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({
      ...topicRequest("混合验收严格子集重试"),
      acceptanceCriteria: ["页面预览可见", "代码证据可读取"],
    });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const accepted = JSON.stringify({ mode: "mixed", pageCriterionIds: ["criterion-1", "criterion-2"], findings: [], sourceReview: passedSourceReview });
    const replies = [accepted, accepted];
    const promptsSeen = [];
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanli: async (prompt) => { promptsSeen.push(prompt); return replies.shift(); },
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    const result = await hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" });
    assert.equal(promptsSeen.length, 2);
    assert.equal(result.review.mode, "mixed");
    assert.deepEqual(result.plan.conditions.map((condition) => condition.evidenceType), ["page-experience", "page-experience"]);
    assert.equal(result.review.sourceReview.status, "passed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("旧计划把发送消息误列为页面条件时退役旧计划并重新冻结当前计划", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-acceptance-plan-v2-retire-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({
      ...topicRequest("正式页面验收不发送消息"),
      acceptanceCriteria: ["新建韩立对话并发送消息后，客户正文不出现内部事实"],
    });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const openedAt = new Date().toISOString();
    store.saveAcceptancePlan(proposalId, {
      version: 1,
      planId: "legacy-plan",
      topicId: state.activeTopicId,
      proposalId,
      proposalVersion: state.proposals.at(-1).version,
      conditions: [{
        conditionId: "criterion-1",
        criterion: "新建韩立对话并发送消息后，客户正文不出现内部事实",
        evidenceType: "page-experience",
        completionRequirement: "旧版要求韩立发送后截图",
      }],
      rounds: [{ roundId: "legacy-round", roundNumber: 1, reopenedFromRecordId: null, reopenReason: null, reopenSourceRecordId: null, openedAt }],
      currentRoundId: "legacy-round",
      createdAt: openedAt,
    });
    const response = JSON.stringify({
      mode: "code-conformance",
      findings: [{ criterionId: "criterion-1", status: "passed", actual: "发送与恢复由令狐门禁负责，韩立只读核对正文和事实包边界。", evidenceReferences: ["electron/services/personas/hanli/internal/conversation/hanli-conversation.service.ts"] }],
      sourceReview: passedSourceReview,
    });
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanliResultAcceptance: async () => response,
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    const result = await hanli.reviewResultAcceptance(proposalId, { resultSummary: "令狐门禁已经完成" });
    assert.equal(result.plan.version, 2);
    assert.notEqual(result.plan.planId, "legacy-plan");
    assert.notEqual(result.plan.currentRoundId, "legacy-round");
    assert.equal(result.plan.conditions[0].evidenceType, "code-conformance");
    assert.equal(result.review.mode, "code-conformance");
    const records = store.state().archiveRecords;
    assert.ok(records.some((record) => record.eventType === "acceptance.legacy_plan_retired" && record.payload.retiredPlanId === "legacy-plan"));
    assert.ok(records.some((record) => record.eventType === "acceptance.plan_frozen" && record.payload.planId === result.plan.planId));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("已有验收结果的旧计划只能保留历史且禁止恢复或重建", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-acceptance-plan-recorded-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("保留既有验收结果"), acceptanceCriteria: ["正式页面结果可见"] });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const openedAt = new Date().toISOString();
    const legacyPlan = {
      version: 1,
      planId: "recorded-plan",
      topicId: state.activeTopicId,
      proposalId,
      proposalVersion: state.proposals.at(-1).version,
      conditions: [{ conditionId: "criterion-1", criterion: "正式页面结果可见", evidenceType: "page-experience", completionRequirement: "截图通过" }],
      rounds: [{ roundId: "recorded-round", roundNumber: 1, reopenedFromRecordId: null, reopenReason: null, reopenSourceRecordId: null, openedAt }],
      currentRoundId: "recorded-round",
      createdAt: openedAt,
    };
    store.saveAcceptancePlan(proposalId, legacyPlan);
    store.recordAcceptanceRun(computerRun("recorded-run", state.activeTopicId, proposalId, "passed", "recorded-shot", legacyPlan));
    assert.throws(() => store.retireLegacyAcceptancePlan(proposalId), /禁止恢复或重建/);
    assert.equal(store.state().proposals.find((proposal) => proposal.proposalId === proposalId).acceptancePlan.planId, "recorded-plan");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立把未知结果验收类型纠正为代码符合性审查后继续冻结计划", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-result-mode-retry-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("结果类型重试"), acceptanceCriteria: ["代码证据可读取"] });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const accepted = JSON.stringify({
      mode: "code-conformance",
      findings: [{ criterionId: "criterion-1", status: "passed", actual: "代码证据已可读取。", evidenceReferences: ["tests/result-acceptance.test.mjs"] }],
      sourceReview: passedSourceReview,
    });
    const replies = [JSON.stringify({ mode: "unknown" }), accepted, accepted];
    const promptsSeen = [];
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanli: async (prompt) => { promptsSeen.push(prompt); return replies.shift(); },
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    const result = await hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" });
    assert.equal(promptsSeen.length, 3);
    assert.match(promptsSeen[1], /mode 只能是 code-conformance 或 mixed/);
    assert.equal(result.review.mode, "code-conformance");
    assert.deepEqual(result.plan.conditions.map((condition) => condition.evidenceType), ["code-conformance"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立结果验收使用专用模型端口，不复用提案判断端口", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-result-acceptance-port-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("结果验收专用端口"), acceptanceCriteria: ["代码证据可读取"] });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const accepted = JSON.stringify({
      mode: "code-conformance",
      findings: [{ criterionId: "criterion-1", status: "passed", actual: "代码证据已可读取。", evidenceReferences: ["tests/result-acceptance.test.mjs"] }],
      sourceReview: passedSourceReview,
    });
    let proposalCalls = 0;
    let acceptanceCalls = 0;
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanli: async () => { proposalCalls += 1; throw new Error("结果验收不得复用提案判断端口"); },
      askHanliResultAcceptance: async () => { acceptanceCalls += 1; return accepted; },
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    const result = await hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" });
    assert.equal(proposalCalls, 0);
    assert.equal(acceptanceCalls, 2, "首次分类和冻结计划后的代码复核均应走专用端口");
    assert.equal(result.review.mode, "code-conformance");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立结果验收失败只记录候选协议形状", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-result-acceptance-diagnostic-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("结果验收失败摘要"), acceptanceCriteria: ["代码证据可读取"] });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanliResultAcceptance: async () => JSON.stringify({ mode: "unexpected-mode", customerEvidence: "不得出现在诊断中" }),
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    await assert.rejects(
      () => hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" }),
      (error) => {
        assert.match(error.message, /结构化候选摘要：count=1; mode=unsupported,pageCriterionIds=missing,findings=missing/);
        assert.doesNotMatch(error.message, /unexpected-mode|不得出现在诊断中/);
        return true;
      },
    );
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立按页面编号失效原因纠正 mixed 分区后继续冻结计划", async () => {
  const cases = [
    { name: "缺失", value: { mode: "mixed", findings: [] }, hint: /必须是非空数组/ },
    { name: "非字符串", value: { mode: "mixed", pageCriterionIds: ["criterion-1", 1], findings: [] }, hint: /移除非字符串项/ },
    { name: "重复", value: { mode: "mixed", pageCriterionIds: ["criterion-1", "criterion-1"], findings: [] }, hint: /重复项/ },
    { name: "越界", value: { mode: "mixed", pageCriterionIds: ["criterion-1", "criterion-99"], findings: [] }, hint: /当前条件外编号/ },
  ];
  for (const testCase of cases) {
    const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-mixed-page-ids-retry-"));
    try {
      const store = evolutionStore(path.join(directory, "state.json"));
      let state = store.createTopic({
        ...topicRequest(`混合页面编号重试：${testCase.name}`),
        acceptanceCriteria: ["页面预览可见", "代码证据可读取"],
      });
      state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
      const proposalId = state.proposals.at(-1).proposalId;
      store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
      const accepted = JSON.stringify({
        mode: "mixed",
        pageCriterionIds: ["criterion-1"],
        findings: [{ criterionId: "criterion-2", status: "passed", actual: "代码证据已可读取。", evidenceReferences: ["tests/result-acceptance.test.mjs"] }],
        sourceReview: passedSourceReview,
      });
      const replies = [JSON.stringify(testCase.value), accepted, accepted];
      const promptsSeen = [];
      const hanli = createHanliRuntime({
        store, prompts, memory: null, screenshots: {},
        askHanli: async (prompt) => { promptsSeen.push(prompt); return replies.shift(); },
        recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
      }).facade;
      const result = await hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" });
      assert.equal(promptsSeen.length, 3, `${testCase.name} 应在一次重试后冻结计划`);
      assert.match(promptsSeen[0], /"criterionCatalog":\[{"criterionId":"criterion-1","criterion":"页面预览可见"}/);
      assert.match(promptsSeen[1], testCase.hint);
      assert.match(promptsSeen[1], /"criterionCatalog":\[{"criterionId":"criterion-1","criterion":"页面预览可见"}/);
      assert.equal(result.review.mode, "mixed");
      assert.deepEqual(result.plan.conditions.map((condition) => condition.evidenceType), ["page-experience", "code-conformance"]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

test("韩立结果验收只以顶层对象保留嵌套 findings 的真实校验错误", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-result-acceptance-top-level-json-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({
      ...topicRequest("顶层结果对象边界"),
      acceptanceCriteria: ["代码条件一", "代码条件二", "代码条件三", "代码条件四", "代码条件五"],
    });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    const response = JSON.stringify({
      mode: "code-conformance",
      findings: [
        { criterionId: "criterion-1", status: "passed", actual: "条件一已核对。", evidenceReferences: ["tests/one"] },
        { criterionId: "criterion-2", status: "passed", actual: "条件二已核对。", evidenceReferences: ["tests/two"] },
        { criterionId: "criterion-3", status: "passed", actual: "条件三已核对。", evidenceReferences: ["tests/three"] },
        { criterionId: "criterion-4", status: "passed", actual: "条件四已核对。", evidenceReferences: ["tests/four"] },
        { criterionId: "criterion-4", status: "passed", actual: "重复项不能替代条件五。", evidenceReferences: ["tests/four-repeat"] },
      ],
      sourceReview: passedSourceReview,
    });
    let attempts = 0;
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanliResultAcceptance: async () => { attempts += 1; return response; },
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    await assert.rejects(
      () => hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" }),
      (error) => {
        assert.match(error.message, /韩立源码审查缺少 criterion-5 的明确结论或源码依据/);
        assert.match(error.message, /结构化候选摘要：count=1; mode=supported,pageCriterionIds=missing,findings=array:5/);
        assert.doesNotMatch(error.message, /韩立没有返回有效的结果验收类型和逐项结论/);
        return true;
      },
    );
    assert.equal(attempts, 3);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("韩立结果验收拒绝未闭合的 JSON 对象并保留三次重试", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-unclosed-result-json-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("未闭合结果对象"), acceptanceCriteria: ["计划可读取"] });
    state = store.createProposal(state.activeTopicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    let attempts = 0;
    const hanli = createHanliRuntime({
      store, prompts, memory: null, screenshots: {},
      askHanli: async () => { attempts += 1; return "说明文字 {\"mode\":\"mixed\""; },
      recordEvent() {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
    }).facade;
    await assert.rejects(
      () => hanli.reviewResultAcceptance(proposalId, { resultSummary: "候选已准备验收" }),
      /韩立连续 3 次未返回有效的结果验收判断：AI 返回的结构化判断不是有效 JSON。/,
    );
    assert.equal(attempts, 3);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("冻结审查计划不再保存已退役的文件清单", () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "frozen-review-plan-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    let state = store.createTopic({ ...topicRequest("冻结页面检查"), acceptanceCriteria: ["文本预览可见"] });
    state = store.createProposal(state.activeTopicId, proposalRequest());
    const proposalId = state.proposals.at(-1).proposalId;
    store.markProgress(proposalId, "pending-acceptance", "等待页面与源码审查");
    state = freezePageAcceptancePlan(store, state, proposalId);
    assert.equal("materials" in state.proposals.at(-1).acceptancePlan, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("自动韩立验收失败保留原提案并进入范围内令狐修复卡点", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "hanli-acceptance-repair-checkpoint-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const runId = store.beginOneShotRun(workspaceState, "zh-CN").oneShotRun.runId;
    let state = store.createTopic(topicRequest("验收失败原点修复"));
    const topicId = state.activeTopicId;
    state = store.createProposal(topicId, proposalRequest(), "nangong-wan", "南宫婉");
    const proposalId = state.proposals.at(-1).proposalId;
    const originalCriterion = state.proposals.at(-1).acceptanceCriteria[0];
    store.updateOneShotRun("accepting", "han-li", "韩立", "正在验收具体条件", topicId, proposalId);
    store.markProgress(proposalId, "pending-acceptance", "等待韩立结果验收");
    store.blockOneShotRun("准备从原验收点恢复");
    const failures = [];
    const facade = new PersonaEvolutionRuntime({
      store,
      collaboration: { state() { return { tasks: [], members: [] }; } },
      conversation,
      hanLi: { send: async () => '{"mode":"mixed","pageCriterionIds":["criterion-1"],"findings":[],"sourceReview":{"status":"passed","actual":"职责集中且便于新手阅读","evidenceReferences":["src/example.ts"]}}' },
      recordEvent: () => undefined,
      recordFailure: (failure) => failures.push(failure),
    });
    let acceptanceRuns = 0;
    facade.setComputerAcceptanceSession(async () => {
      acceptanceRuns += 1;
      return {
        ...computerRun("failed-current-run", topicId, proposalId, "failed", "failure-shot", facade.state().proposals.find((proposal) => proposal.proposalId === proposalId).acceptancePlan),
        criteria: [originalCriterion],
        stepResults: computerRun("failed-current-run", topicId, proposalId, "failed", "failure-shot", facade.state().proposals.find((proposal) => proposal.proposalId === proposalId).acceptancePlan).stepResults.map(step => step.operation.type === "judgement" ? { ...step, layoutStatus: "blocked", layoutActual: "当前正式页面未提供布局验收能力" } : step),
      };
    });
    state = await facade.resumeOneShotRun(runId);
    assert.equal(state.oneShotRun.status, "blocked");
    assert.equal(state.proposals.at(-1).proposalId, proposalId);
    assert.equal(state.proposals.at(-1).status, "pending-acceptance");
    assert.equal(state.proposals.length, 1);
    assert.equal(failures.length, 1, JSON.stringify(failures.map((failure) => ({ operation: failure.operation, error: String(failure.error) }))));
    assert.equal(failures.at(-1).operation, "repair_failed_hanli_acceptance");
    assert.equal(failures.at(-1).flowImpact, "blocked");
    assert.equal(failures.at(-1).details.acceptanceFailureScope.decision, "within-original-acceptance");
    assert.match(failures.at(-1).details.acceptanceFailureScope.summary, /实际结果：滚动位置没有变化/);
    assert.equal(failures.at(-1).details.acceptanceBlockedSteps.length, 1);
    assert.equal(failures.at(-1).details.acceptanceBlockedSteps[0].layoutActual, "当前正式页面未提供布局验收能力");
    assert.match(state.oneShotRun.blockingReason, /本轮仍未验证的条件/);
    assert.match(state.oneShotRun.blockingReason, /滚动位置没有变化/);
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    facade.stop();
    assert.equal(acceptanceRuns, 1, "真实验收失败仍需沿修复卡点处理，轮询不得自动重试验收");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

function computerRun(runId, topicId, proposalId, status, shot, plan) {
 const now = new Date().toISOString();
 return { version: 3, mode: "page-experience", runId, topicId, proposalId, planId: plan.planId, acceptanceRoundId: plan.currentRoundId, criteria: plan.conditions.map((condition) => condition.criterion), sourceReview: { status, actual: status === "failed" ? "源码结构不符合要求" : "源码职责集中且便于新手阅读", evidenceReferences: ["src/example.ts"] }, status, windowTitle: "AI Desktop", initialBounds: { x:0,y:0,width:1000,height:800 }, finalBounds: { x:0,y:0,width:1000,height:800 }, interactionSteps: [
 { checkId: "interaction", evidenceMode: "page-experience", operationIndex: 0, operation: { type: "scroll", x:100,y:100,deltaY:600,reason:"检查滚动" }, status:"passed", actual:"已发送滚动输入", layoutStatus:"passed", layoutActual:"布局无异常", layoutScreenshotAttachmentId:shot, screenshotAttachmentId:shot, occurredAt:now }
 ], stepResults: [
 ...plan.conditions.map((condition, index) => ({ checkId: condition.conditionId, evidenceMode: condition.evidenceType, operationIndex: index + 1, operation: { type:"judgement",criterionId:condition.conditionId }, status, actual:status==="failed"?"滚动位置没有变化":"末项可达", layoutStatus:"passed", layoutActual:"末项布局可见且无遮挡", layoutScreenshotAttachmentId:shot, screenshotAttachmentId:shot, occurredAt:now }))
 ], evidenceAttachmentIds:[shot], startedAt:now, completedAt:now };
}

function freezePageAcceptancePlan(store, state, proposalId) {
 const proposal = state.proposals.find((item) => item.proposalId === proposalId);
 const now = new Date().toISOString();
 const planId = `test-page-plan-${proposalId}`;
 const roundId = `test-page-round-${proposalId}`;
 return store.saveAcceptancePlan(proposalId, {
   version: 1,
   planId,
   topicId: proposal.topicId,
   proposalId,
   proposalVersion: proposal.version,
   conditions: proposal.acceptanceCriteria.map((criterion, index) => ({
     conditionId: `criterion-${index + 1}`,
     criterion,
     evidenceType: "page-experience",
     completionRequirement: "真实页面截图和布局判断",
   })),
   rounds: [{ roundId, roundNumber: 1, reopenedFromRecordId: null, reopenReason: null, reopenSourceRecordId: null, openedAt: now }],
   currentRoundId: roundId,
   createdAt: now,
 });
}

test("南宫婉线程删除最终失败时保留原页面消息", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-new-conversation-failed-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    store.appendConversation("user", "删除失败时必须保留");
    const failingConversation = { async send() { return { text: "unused", itemCount: 1 }; }, async newChat() { throw new Error("thread already has an active writer"); } };
    const facade = new PersonaEvolutionRuntime({ store, collaboration: {}, conversation: failingConversation, recordEvent: () => undefined, newConversationRetryDelaysMs: [0, 1, 1] });
    await assert.rejects(() => facade.newConversation(), /active writer/);
    assert.equal(facade.state().conversation.messages[0].content, "删除失败时必须保留");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("令狐专属提案接口退役但南宫业务提案仍须审批后派发", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "linghu-approval-"));
  try {
    const store = evolutionStore(path.join(directory, "state.json")); let submitted;
    const collaboration = { submitTask(request) { submitted = request; return { taskId: "linghu-task", state: { tasks: [{ taskId: "linghu-task", evolutionProposalId: request.evolutionProposalId }] } }; }, state() { return { tasks: [] }; } };
    const facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
    assert.equal(facade.createLinghuRepairProposal, undefined);
    assert.equal(store.createLinghuRepairProposal, undefined);
    let state = facade.createTopic(topicRequest("明确的业务提案"));
    state = facade.createProposal(state.topics.at(-1).topicId, proposalRequest());
    const proposal = state.proposals.at(-1);
    assert.equal(proposal.submitterMemberId, "nangong-wan");
    state = facade.decideProposal(proposal.proposalId, { mutation: mutation(facade), decision: "approved", advice: "人工确认令狐方向" });
    state = await facade.dispatch(proposal.proposalId);
    assert.equal(submitted.initiatorMemberId, "nangong-wan");
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
      submitTask(request) { submitted = request; return { taskId: "self-upgrade-task", state: { tasks: [{ taskId: "self-upgrade-task", evolutionProposalId: request.evolutionProposalId }] } }; },
      state() { return { members, tasks: [] }; },
    };
    const facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, ...distributionServices, recordEvent: () => undefined });
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
    const members = [{ memberId: "nangong-wan", displayName: "南宫婉", enabled: true, kind: "worker" }];
    const collaboration = { state() { return { members, tasks: [] }; } };
    const facade = new PersonaEvolutionRuntime({
      store, collaboration, conversation, recordEvent: () => undefined,
      async investigateRevision() {
        return JSON.stringify({
          content: "只读检查确认南宫婉提案生成器缺少文件位置、修正动作和预期结果字段，修订自身生成规则并补齐三项结构。",
          evidence: ["apps/ai-desktop/electron/services/personas/linghu/linghu-automation.facade.ts 的提案生成路径未形成文件位置、修正动作和预期结果三项结构"],
          impactScope: ["南宫婉提案生成规则"], exclusions: ["不修改演化方向审批线路"], risks: ["字段过严可能阻断旧输入，使用明确缺项提示缓解"],
          rollbackPlan: "仅回退南宫婉提案结构校验和提示改动，保留审批及任务状态。", acceptanceCriteria: ["新提案明确包含问题文件、修正动作和可观察预期结果"],
        });
      },
    });
    store.controlAutomation("start");
    assert.equal(facade.createLinghuRepairProposal, undefined);
    assert.equal(store.createLinghuRepairProposal, undefined);
    let state = facade.createTopic(topicRequest("明确的业务提案"));
    state = facade.createProposal(state.topics.at(-1).topicId, proposalRequest());
    const original = state.proposals.at(-1);
    facade.decideProposal(original.proposalId, { mutation: mutation(facade), decision: "supplement-required", advice: "写明哪里有问题、修改哪里和预期结果。", feedbackTarget: "submitter-capability", capabilityScope: "修正方案具体性" });
    facade.start(); await new Promise((resolve) => setTimeout(resolve, 20)); facade.stop();
    state = facade.state();
    const revisions = state.proposals.filter((proposal) => proposal.supersedesProposalId === original.proposalId);
    assert.equal(revisions.length, 1); assert.equal(revisions[0].submitterMemberId, "nangong-wan");
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
    const facade = new PersonaEvolutionRuntime({
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

for (const mode of ["explicit", "background"]) {
  test(`新研讨调查中不能接管历史专题：${mode}`, async () => {
    const key = `new-deliberation-keeps-scope-${mode}`;
    let store = evolutionStore(key);
    store.configureAutomation({ maxRoundsPerTopic: 5, maxCorrectionRounds: 5, workspaceState, locale: "zh-CN" });
    store.beginDeliberation("old-deliberation", [{ content: "旧需求", source: "codex", role: "user", capturedAt: "2026-01-01T00:00:00.000Z" }], "旧问题", "旧需求");
    const snapshot = readPersistedState(key);
    snapshot.deliberations[0].status = "established";
    snapshot.deliberations[0].topicId = "old-topic";
    snapshot.deliberations[0].createdAt = "2026-01-01T00:00:00.000Z";
    writePersistedState(key, snapshot);
    store = evolutionStore(key);
    store.controlAutomation("start");
    const facade = new PersonaEvolutionRuntime({
      store, collaboration: { state: () => ({ tasks: [], members: [] }) }, conversation,
      recordEvent() {},
      askHanliDeliberation: async () => JSON.stringify({ decision: "continue", assessment: "需要核实隔离环境", nextQuestion: "如何隔离正式记录？", questionReason: "不改正式数据" }),
      askNangongDeliberation: async () => "当前正式页面有任务，需要隔离测试环境。",
    });
    try {
      if (mode === "explicit") facade.startHanliNangongDeliberation(workspaceState, "zh-CN");
      store.beginDeliberation("new-deliberation", [{ content: "测试空状态但保留正式记录", source: "codex", role: "user", capturedAt: new Date().toISOString() }], "怎样测试空状态？", "客户新确认的需求");
      facade.start();
      await new Promise((resolve) => setTimeout(resolve, 40));
      const state = facade.state();
      assert.ok(state.deliberations.at(-1).rounds.length >= 2, "新研讨已收到真实推进结果");
      assert.equal(state.oneShotRun.status, "running");
      assert.equal(state.oneShotRun.phase, "preparing-topic");
      assert.equal(state.oneShotRun.topicId, null, "不得把旧专题放进新运行");
      assert.equal(state.oneShotRun.proposalId, null);
      assert.equal(state.proposals.length, 0, "调查未完成不能生成执行提案");
    } finally { facade.stop(); }
  });
}

test("韩立独立1恢复阻塞中的当前研讨而不是只返回已有研讨", async () => {
  let started = 0;
  const resumed = [];
  const messages = [personaConversationMessage("customer-visible", { messageId: "hanli-viewpoint", sequenceNumber: 0, speakerType: "persona", speakerPersonaId: "han-li", content: "当前观点应先核实运行窗口，再决定修改范围。", replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: "2026-09-02T00:00:00.000Z", completedAt: "2026-09-02T00:00:00.000Z" })];
  const memory = {
    readPersonaConversation(ownerPersonaId) {
      return { ownerPersonaId, conversationId: "hanli-active-deliberation", messages: structuredClone(messages), updatedAt: messages.at(-1).createdAt };
    },
    readPersonaCustomerDisplayConversation(ownerPersonaId) {
      return { ownerPersonaId, conversationId: "hanli-active-deliberation", messages: structuredClone(messages), updatedAt: messages.at(-1).createdAt };
    },
    registerPersonaRound(input) {
      messages.push(personaConversationMessage("customer-visible", { messageId: input.userMessageId, sequenceNumber: messages.length, speakerType: "user", speakerPersonaId: null, content: input.userContent, replyToMessageId: null, deliveryStatus: "completed", attachmentIds: [], createdAt: input.createdAt, completedAt: input.completedAt }));
      messages.push(personaConversationMessage("customer-visible", { messageId: input.personaMessageId, sequenceNumber: messages.length, speakerType: "persona", speakerPersonaId: input.responderPersonaId, content: input.personaContent, replyToMessageId: input.userMessageId, deliveryStatus: "completed", attachmentIds: [], createdAt: input.completedAt, completedAt: input.completedAt }));
      return { ownerPersonaId: input.ownerPersonaId, conversationId: "hanli-active-deliberation", messages: structuredClone(messages), updatedAt: input.completedAt };
    },
  };
  const service = new HanliConversationService({
    store: { state: () => ({ deliberations: [{ deliberationId: "pending-discussion", status: "questioning", topicId: null, createdAt: "2026-09-02T01:00:00.000Z" }], oneShotRun: { runId: "existing-run", status: "blocked", startedAt: "2026-09-02T00:00:00.000Z" } }) },
    prompts,
    memory,
    conversation: { activeConversationId: () => "hanli-active-deliberation", async send() { throw new Error("不应调用普通聊天"); }, async newChat() {} },
    async startInternalDeliberation() { started += 1; return { continuous: true }; },
    async resumeInternalDeliberation(id) { resumed.push(id); },
    recordEvent() {},
    readStableUserId: () => "XUNAN",
    readProjectScope: () => "/workspace",
  });

  const result = await service.send({ clientMessageId: "duplicate-confirm-1", message: "1", attachmentIds: [], workspaceState, locale: "zh-CN" });

  assert.equal(started, 0);
  assert.deepEqual(resumed, ["pending-discussion"]);
  assert.match(result.messages.at(-1).content, /已继续原有研讨/);
});

test("恢复当前未完成研讨保留运行与轮次，拒绝跨运行历史研讨", () => {
  const key = "resume-pending-original-run";
  const store = evolutionStore(key);
  store.configureAutomation({ maxRoundsPerTopic: 5, maxCorrectionRounds: 5, workspaceState, locale: "zh-CN" });
  store.beginOneShotRun(workspaceState, "zh-CN");
  store.beginDeliberation("pending", [{ content: "隔离环境任务验收", source: "codex", role: "user", capturedAt: new Date().toISOString() }], "如何隔离测试任务？", "不影响正式记录");
  store.updateOneShotRun("accepting", "han-li", "韩立", "错误绑定的旧验收", "old-topic", "old-proposal");
  store.blockOneShotRun("原研讨等待继续");
  const before = store.state();
  const resumed = store.resumePendingDeliberation("pending");
  assert.equal(resumed.oneShotRun.runId, before.oneShotRun.runId);
  assert.equal(resumed.oneShotRun.startedAt, before.oneShotRun.startedAt);
  assert.deepEqual(resumed.deliberations, before.deliberations);
  assert.equal(resumed.oneShotRun.topicId, null);
  assert.equal(resumed.oneShotRun.proposalId, null);
  assert.equal(resumed.oneShotRun.phase, "preparing-topic");
  assert.equal(resumed.automationSettings.automaticCustodyEnabled, false);
  assert.equal(resumed.topics.length, 0);
  assert.throws(() => store.resumePendingDeliberation("pending"), /没有可原位继续/);
  store.blockOneShotRun("等待继续");
  const legacy = readPersistedState(key);
  legacy.deliberations[0].createdAt = "2020-01-01T00:00:00.000Z";
  writePersistedState(key, legacy);
  assert.throws(() => evolutionStore(key).resumePendingDeliberation("pending"), /没有可原位继续/);
});


test("任务创建回执不会把历史保障任务登记为新分发任务", async () => {
  const directory = mkdtempSync(path.join(controlledTestRoot, "nangong-task-receipt-"));
  let facade;
  try {
    const store = evolutionStore(path.join(directory, "state.json"));
    const tasks = [];
    const collaboration = {
      state() { return { members: [], tasks: structuredClone(tasks) }; },
      submitTask(request) {
        const task = { ...request, taskId: "new-approved-task", state: "executing", snapshot: { title: request.title } };
        tasks.push(task);
        // 回执状态故意把旧任务放在新任务前后，消费方不能依赖列表顺序。
        return { taskId: task.taskId, state: { tasks: [tasks[0], task, tasks[1]] } };
      },
    };
    facade = new PersonaEvolutionRuntime({ store, collaboration, conversation, ...distributionServices, recordEvent() {} });
    let state = facade.createTopic(topicRequest("准确关联新任务"));
    state = facade.createProposal(state.topics[0].topicId, proposalRequest());
    const proposalId = state.proposals[0].proposalId;
    facade.decideProposal(proposalId, { mutation: mutation(facade), decision: "approved", advice: "通过" });
    tasks.push(
      { taskId: "old-repair-1", evolutionProposalId: proposalId, state: "integrated", snapshot: { title: "旧保障一" } },
      { taskId: "old-repair-2", evolutionProposalId: proposalId, state: "integrated", snapshot: { title: "旧保障二" } },
    );
    state = await facade.dispatch(proposalId);
    assert.deepEqual(state.proposals[0].distributedTaskIds, ["new-approved-task"]);
    assert.equal(state.proposals[0].status, "executing");

    // 模拟旧版本已持久保存错误关联；新运行时必须依据创建审批事实恢复，不能重新创建任务。
    const oldState = store.state();
    oldState.proposals[0].distributedTaskIds = ["old-repair-1"];
    oldState.proposals[0].status = "pending-acceptance";
    writePersistedState(path.join(directory, "state.json"), oldState);
    const restoredStore = evolutionStore(path.join(directory, "state.json"));
    facade.stop();
    facade = new PersonaEvolutionRuntime({ store: restoredStore, collaboration, conversation, ...distributionServices, recordEvent() {} });
    facade.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    facade.stop();
    const restored = facade.state();
    assert.deepEqual(restored.proposals[0].distributedTaskIds, ["new-approved-task"]);
    assert.equal(restored.proposals[0].status, "executing", "未集成的实际任务必须阻止提前验收");
    assert.equal(tasks.length, 3, "恢复只纠正关联，不重建任务或删除历史任务");
    assert.ok(restored.archiveRecords.some((record) => record.eventType === "proposal.distribution_reconciled"));
  } finally { facade?.stop(); rmSync(directory, { recursive: true, force: true }); }
});
