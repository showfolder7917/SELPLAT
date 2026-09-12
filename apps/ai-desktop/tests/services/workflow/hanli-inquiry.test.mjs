import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HanliInquiryService } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/conversation/hanli-inquiry.service.js";
import { nangongInquiryResult, nangongInquiryWithCorrection } from "../../../../../build/ai-desktop/electron/electron/services/personas/nangong/index.js";
import { parseHanliConversationResponse } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/conversation/hanli-conversation.parser.js";
import { HanliConversationService } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/conversation/hanli-conversation.service.js";

import { buildHanliRecentConversation } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/conversation/hanli-method-context.js";

const conversationPrompt = readFileSync(new URL("../../../prompts/personas/hanli/conversation.md", import.meta.url), "utf8");
const inquiryResponsePrompt = readFileSync(new URL("../../../prompts/personas/hanli/inquiry-response.md", import.meta.url), "utf8");
const customerQuestion = "长消息超过一屏后是否还会跑到输入框下面，这个问题是否已经修复";
const findings = { status: "verified", answeredQuestion: customerQuestion, summary: "源码已修改，尚未发布", evidence: [{ source: "task-1 / file.ts:12", detail: "修改存在，发布记录不存在" }], unknowns: ["当前运行版本"] };
const understanding = { status: "ready", understoodGoal: "确认长消息滚动问题是否修复", verificationTarget: "消息时间线与输入框的滚动位置", expectedAnswer: "当前代码和运行版本是否已修复", ambiguities: [], investigationQuestion: "核对消息时间线滚动实现、相关测试和当前运行版本" };
const request = { message: customerQuestion, clientMessageId: "u1", attachmentIds: ["shot1"], locale: "zh-CN",
  workspaceState: { roots: [{ id: "root-1", path: "/workspace", name: "workspace", writable: true }], primaryId: "root-1" } };
const topic = { title: "进度核实", type: "核实", userIntent: request.message, tags: ["进度"], summary: "核实当前进度", switchTopic: false };
const conclude = { answeredQuestion: customerQuestion, action: "conclude", reason: "可以说明源码与运行验证的区别", nextQuestion: "", missingEvidence: ["当前运行版本"] };
const resultMessage = (conversation) => conversation.messages.find((message) => message.messageId === "inquiry:u1:result");
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture(investigate, explain = async () => ({ text: "源码已经修改，但当前运行版本尚未确认。建议先确认运行版本再复验。" }), assess = async () => conclude) {
  const messages = [], order = [], discussionContexts = [], events = [], activities = [];
  const snapshot = (id = "original") => ({ ownerPersonaId: "han-li", selectedModel: "selected-model", conversationId: id, messages: structuredClone(messages), updatedAt: new Date().toISOString() });
  const append = (message) => {
    if (!messages.some((item) => item.messageId === message.messageId)) messages.push({
      speakerType: "persona", sequenceNumber: messages.length, deliveryStatus: "completed",
      replyToMessageId: null, ...structuredClone(message),
    });
  };
  const memory = {
    readPersonaConversation: (_owner, id) => snapshot(id),
    registerPersonaRound: (round) => {
      append({ messageId: round.userMessageId, speakerType: "user", content: round.userContent, attachmentIds: round.attachmentIds });
      append({ messageId: round.personaMessageId, speakerPersonaId: "han-li", content: round.personaContent });
      return snapshot(round.conversationId);
    },
    appendPersonaInternalMessage: (message) => { append(message); order.push(message.messageId); return snapshot(message.conversationId); },
    recordRequirementDiscussionContext: (context) => { discussionContexts.push(structuredClone(context)); order.push("discussion-context-recorded"); },
  };
  const options = {
    memory,
    prompts: { render: (id, variables) => JSON.stringify({ id, variables }) },
    conversation: { send: (nextRequest, prompt, selectedModel) => {
      const { id, variables } = JSON.parse(prompt);
      assert.deepEqual(nextRequest.attachmentIds, []);
      assert.equal(selectedModel, "selected-model");
      if (id === "hanli.inquiry-assessment") {
        order.push("assessed");
        return Promise.resolve(assess(variables)).then((value) => ({ text: JSON.stringify(value) }));
      }
      assert.equal(id, "hanli.inquiry-response");
      order.push("explained");
      return explain(nextRequest, variables);
    } },
    onPersonaConversationChanged: (value) => { if (value.activity) activities.push(structuredClone(value.activity)); },
    recordEvent: (type, details) => events.push({ type, details }),
    investigateWithNangong: (...args) => { order.push("dispatched"); return investigate(...args); },
  };
  return { service: new HanliInquiryService(options), createService: () => new HanliInquiryService(options),
    messages, memory, order, discussionContexts, events, activities };
}

test("真实调查、独立判断、解释依次推进；并发和完成重试保持同一消息", async () => {
  let resolve, acquire;
  const f = fixture((inquiry, input, onAcquired) => {
    assert.equal(inquiry.customerQuestion, customerQuestion);
    assert.equal(inquiry.verificationTarget, understanding.verificationTarget);
    assert.deepEqual(input.attachmentIds, ["shot1"]);
    acquire = onAcquired;
    return new Promise((done) => { resolve = done; });
  });
  const pending = f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(f.service.run(request, "original", customerQuestion, understanding, topic), pending);
  await tick();
  assert.equal(f.activities.at(-1).phase, "queued");
  acquire();
  assert.equal(f.activities.at(-1).phase, "investigating");
  assert.equal(f.activities.at(-1).status, "running");
  resolve(findings);
  const result = await pending;
  assert.equal(result.activity.status, "completed");
  assert.match(resultMessage(result).content, /建议先确认运行版本/);
  assert.equal(f.messages.filter((item) => item.messageId === "u1").length, 1);
  assert.deepEqual(f.messages.find((item) => item.messageId === "internal:inquiry:u1:question").attachmentIds, ["shot1"]);
  assert.ok(f.order.indexOf("assessed") < f.order.indexOf("explained"));
  assert.ok(f.activities.some((item) => item.phase === "assessing"));
  assert.ok(f.activities.some((item) => item.phase === "explaining"));
  assert.equal(f.discussionContexts.length, 1);
  await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(f.order.filter((item) => item === "dispatched").length, 1);
});

test("证据不足时韩立主动补查，原问题、截图和前轮依据完整传递", async () => {
  let investigations = 0, assessments = 0;
  const f = fixture(async (inquiry, input, acquired) => {
    acquired();
    investigations += 1;
    assert.equal(inquiry.customerQuestion, customerQuestion);
    assert.deepEqual(input.attachmentIds, ["shot1"]);
    if (investigations === 2) {
      assert.equal(inquiry.investigationQuestion, "核对当前进程加载版本和该页面滚动触发事件");
      assert.deepEqual(inquiry.previousFindings, [findings]);
      return { ...findings, summary: "运行日志确认仍为旧版", evidence: [{ source: "runtime.log:9", detail: "版本未更新" }], unknowns: [] };
    }
    return findings;
  }, async (_request, variables) => {
    assert.equal(JSON.parse(variables.findingsJson).evidence.length, 2);
    return { text: "当前运行版本尚未更新，源码修改还没有在运行程序生效。" };
  }, async () => {
    assessments += 1;
    return assessments === 1 ? { ...conclude, action: "investigate", nextQuestion: "核对当前进程加载版本和该页面滚动触发事件" }
      : { ...conclude, missingEvidence: [] };
  });
  const result = await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(investigations, 2);
  assert.equal(result.activity.round, 2);
  assert.equal(result.activity.status, "completed");
  assert.equal(f.discussionContexts[0].findingStatus, "verified");
});

test("解释失败不生成最终结果；重建服务后只重试解释，保留证据和原请求", async () => {
  let explanations = 0;
  const f = fixture(async () => findings, async () => {
    if (++explanations === 1) throw new Error("解释服务暂时不可用");
    return { text: "依据已经核对，当前运行版本仍未验证。" };
  });
  const failed = await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(failed.activity.phase, "explaining");
  assert.equal(failed.activity.status, "retryable");
  assert.equal(resultMessage(failed), undefined);
  assert.equal(f.events.some((item) => item.type === "hanli.inquiry.completed"), false);
  assert.equal(f.discussionContexts.length, 0);
  const restarted = f.createService();
  const result = await restarted.resume(request, failed);
  assert.equal(result.activity.status, "completed");
  assert.equal(f.order.filter((item) => item === "dispatched").length, 1);
  assert.equal(f.order.filter((item) => item === "assessed").length, 1);
  assert.equal(explanations, 2);
  assert.equal(result.messages.filter((item) => item.messageId === "u1").length, 1);
});

test("评估格式失败保留调查依据，重试只恢复评估", async () => {
  let assessments = 0;
  const f = fixture(async () => findings, undefined, async () => ++assessments === 1 ? { bad: true } : conclude);
  const failed = await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(failed.activity.phase, "assessing");
  assert.equal(failed.activity.status, "retryable");
  const result = await f.createService().resume(request, failed);
  assert.equal(result.activity.status, "completed");
  assert.equal(f.order.filter((item) => item === "dispatched").length, 1);
});

test("调查失败可以重试，空结果和错问题都不能被当成完成", async () => {
  for (const invalid of [null, { ...findings, answeredQuestion: "另一页面" }, { ...findings, evidence: [] }]) {
    let calls = 0;
    const f = fixture(async () => ++calls === 1 ? invalid : findings);
    const failed = await f.service.run(request, "original", customerQuestion, understanding, topic);
    assert.equal(failed.activity.status, "retryable");
    assert.equal(resultMessage(failed), undefined);
    const result = await f.service.resume(request, failed);
    assert.equal(calls, 2);
    assert.equal(result.activity.status, "completed");
  }
});

test("重复补查无新增依据时明确保留限制，不能伪装成成功", async () => {
  const f = fixture(async () => findings, undefined,
    async () => ({ ...conclude, action: "investigate", nextQuestion: understanding.investigationQuestion }));
  const result = await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(result.activity.status, "blocked");
  assert.match(result.activity.summary, /重复/);
  assert.equal(f.order.filter((item) => item === "dispatched").length, 1);
  assert.equal(f.events.some((item) => item.type === "hanli.inquiry.completed"), false);
  assert.ok(f.events.some((item) => item.type === "hanli.inquiry.blocked"));
});

test("自动调查最多三轮，无依据或外部阻碍都不能升级为完成", async () => {
  let ordinal = 0;
  const f = fixture(async () => ({ ...findings, evidence: [{ source: `file:${++ordinal}`, detail: "需要继续核实" }] }),
    undefined, async () => ({ ...conclude, action: "investigate", nextQuestion: `查证新的位置 ${ordinal}` }));
  const result = await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(ordinal, 3);
  assert.equal(result.activity.status, "blocked");
  assert.match(result.activity.summary, /三轮/);
  const empty = fixture(async () => ({ ...findings, status: "unknown", evidence: [] }));
  assert.equal((await empty.service.run(request, "original", customerQuestion, understanding, topic)).activity.status, "blocked");
});

test("重启后的孤儿运行显示中断；改变工作区或原问题不能复用恢复点", async () => {
  const f = fixture(async () => { throw new Error("断线"); });
  const failed = await f.service.run(request, "original", customerQuestion, understanding, topic);
  const checkpoint = f.messages.filter((message) => message.messageId.startsWith("internal:inquiry-checkpoint:")).at(-1);
  const state = JSON.parse(checkpoint.content);
  state.status = "running";
  checkpoint.content = JSON.stringify(state);
  const restarted = f.createService();
  assert.equal(restarted.project(f.memory.readPersonaConversation("han-li", "original")).activity.status, "interrupted");
  assert.throws(() => restarted.resume({ ...request, message: "改成另一个问题" }, failed), /原问题/);
  assert.throws(() => restarted.resume({ ...request, workspaceState: { ...request.workspaceState, primaryId: "other" } }, failed), /原工作区/);
});

test("恢复记录损坏不回退到旧调查阶段", async () => {
  const f = fixture(async () => { throw new Error("断线"); });
  const failed = await f.service.run(request, "original", customerQuestion, understanding, topic);
  failed.messages.filter((message) => message.messageId.startsWith("internal:inquiry-checkpoint:")).at(-1).content = "{}";
  assert.throws(() => f.createService().resume(request, failed), /恢复记录不完整/);
});

test("南宫婉从独立最终消息直返结构化结果而忽略过程说明", () => {
  const result = nangongInquiryResult({
    text: `我会严格按只读范围核实\n${JSON.stringify(findings)}`,
    agentMessages: ["我会严格按只读范围核实", JSON.stringify(findings)], itemCount: 2,
  }, customerQuestion);
  assert.deepEqual(result, findings);
});
test("南宫婉拒绝无证据已核实和不对应客户原问题的结果", () => {
  assert.throws(() => nangongInquiryResult({ text: JSON.stringify({ ...findings, evidence: [] }), itemCount: 1 }, customerQuestion), /未提供可定位/);
  assert.equal(nangongInquiryResult({ text: JSON.stringify({ ...findings, status: "unknown", evidence: [] }), itemCount: 1 }, customerQuestion).status, "unknown");
  assert.throws(() => nangongInquiryResult({ text: JSON.stringify({ ...findings, answeredQuestion: "发送按钮为什么禁用" }), itemCount: 1 }, customerQuestion), /没有对应客户原问题/);
});
test("南宫婉结果不合格时只纠正一次并可返回结构化结果", async () => {
  let corrections = 0;
  const result = await nangongInquiryWithCorrection(
    async () => ({ text: "我会严格按只读范围核实", itemCount: 1 }),
    async (reason) => { corrections += 1; assert.match(reason, /独立、完整/); return { text: JSON.stringify(findings), itemCount: 1 }; },
    customerQuestion,
  );
  assert.deepEqual(result, findings);
  assert.equal(corrections, 1);
});
test("南宫婉第二次仍不合格时明确失败，且传输失败不进行格式纠正", async () => {
  let corrections = 0;
  await assert.rejects(() => nangongInquiryWithCorrection(
    async () => ({ text: "过程说明", itemCount: 1 }),
    async () => { corrections += 1; return { text: "仍然不合格", itemCount: 1 }; },
    customerQuestion,
  ), /连续两次未通过校验/);
  assert.equal(corrections, 1);
  await assert.rejects(() => nangongInquiryWithCorrection(
    async () => { throw new Error("服务断线"); },
    async () => { corrections += 1; return { text: JSON.stringify(findings), itemCount: 1 }; },
    customerQuestion,
  ), /服务断线/);
  assert.equal(corrections, 1);
});
test("结构化理解与可见回复分离，理解不足时保留澄清门禁", () => {
  const parsed = parseHanliConversationResponse(`先核实\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: understanding })}`);
  assert.equal(parsed.inquiry.investigationQuestion, understanding.investigationQuestion);
  assert.equal(parsed.reply, "先核实");
  const clarification = parseHanliConversationResponse(`请确认你指的是当前运行版本还是源码。\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: { ...understanding, status: "clarification-required", ambiguities: ["需要确认源码还是运行版本"], investigationQuestion: undefined } })}`);
  assert.equal(clarification.inquiry.status, "clarification-required");
  assert.deepEqual(clarification.inquiry.ambiguities, ["需要确认源码还是运行版本"]);
});
test("韩立必须解析上下文指代并向客户给出完整准确的交代", () => {
  assert.match(conversationPrompt, /“这个”“这里”“这样改”“修复它”/);
  assert.match(conversationPrompt, /找到它所指的对象、现状问题、期望变化和明确约束/);
  assert.match(conversationPrompt, /禁止只回复“明白”“收到”“我会核实”/);
  assert.match(conversationPrompt, /禁止把“没有、缺少、不能识别”等现状缺陷反写成“去掉、移除、继续隐藏”等修改目标/);
  assert.match(inquiryResponsePrompt, /恢复完整客户目标/);
  assert.match(inquiryResponsePrompt, /禁止把客户描述的现状缺陷反写成期望修改/);
});
test("韩立理解不足时先询问客户，收到澄清后仍以最初问题派发南宫婉", async () => {
  const messages = [];
  let dispatches = 0;
  let conversationCalls = 0;
  let secondRecentConversation = "";
  const snapshot = (updatedAt = "2026-09-05T00:00:00.000Z") => ({ ownerPersonaId: "han-li", conversationId: "clarification-thread", messages: [...messages], updatedAt });
  const memory = {
    readPersonaConversation: () => snapshot(),
    newPersonaConversation: () => snapshot(),
    readHanliSemanticContext: () => ({ concerns: [], trajectories: [], inspectionExperiences: [] }),
    registerPersonaRound: (round) => {
      messages.push(
        { messageId: round.userMessageId, speakerType: "user", speakerPersonaId: null, content: round.userContent, replyToMessageId: null },
        { messageId: round.personaMessageId, speakerType: "persona", speakerPersonaId: "han-li", content: round.personaContent, replyToMessageId: round.userMessageId },
      );
      return snapshot(round.completedAt);
    },
    appendPersonaInternalMessage: (message) => { messages.push({ ...message, speakerType: "persona" }); return snapshot(message.createdAt); },
  };
  const clarification = { ...understanding, status: "clarification-required", ambiguities: ["需要确认源码还是当前运行版本"], investigationQuestion: undefined };
  const service = new HanliConversationService({
    store: { state: () => ({ deliberations: [], automationSettings: {} }) }, memory,
    prompts: { render: (id, variables) => JSON.stringify({ id, variables }) },
    conversation: {
      activeConversationId: () => "provider-thread",
      newChat: async () => {},
      send: async (_nextRequest, prompt) => {
        const rendered = JSON.parse(prompt);
        if (rendered.id === "hanli.inquiry-assessment") return { text: JSON.stringify(conclude) };
        if (rendered.id === "hanli.inquiry-response") return { threadId: "provider-thread", itemCount: 1, text: "当前运行版本尚未核实，建议重启后按原问题复验。" };
        conversationCalls += 1;
        if (conversationCalls === 1) return { threadId: "provider-thread", itemCount: 1, text: `你要确认的是源码已经修改，还是当前运行版本已经生效？\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: clarification })}` };
        assert.equal(rendered.variables.customerQuestionAnchor, customerQuestion);
        secondRecentConversation = rendered.variables.recentConversation;
        return { threadId: "provider-thread", itemCount: 1, text: `我会按最初问题核实当前运行版本。\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: understanding })}` };
      },
    },
    investigateWithNangong: async (inquiry) => { dispatches += 1; assert.equal(inquiry.customerQuestion, customerQuestion); return findings; },
    recordEvent: () => {}, refreshSemanticMemory: () => {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
  });
  const workspaceState = { roots: [{ id: "root-1", path: "/workspace", name: "workspace", writable: true }], primaryId: "root-1" };
  const result = await service.send({ ...request, workspaceState, locale: "zh-CN" });
  assert.equal(dispatches, 0);
  const clarificationMessage = result.messages.find((item) => item.messageId.startsWith("hanli-clarification:"));
  assert.match(clarificationMessage.content, /源码已经修改.*当前运行版本/);
  await service.send({ ...request, clientMessageId: "u2", message: "我问的是当前运行版本", workspaceState, locale: "zh-CN" });
  assert.equal(dispatches, 1);
  assert.doesNotMatch(secondRecentConversation, /clarificationMessageId/);
});

test("韩立形成观点时发布当前中立上下文但不直接启动工作流", async () => {
  const messages = [], recorded = [];
  let starts = 0;
  const prior = {
    contextId: "inquiry-u1", ownerPersonaId: "han-li", conversationId: "discussion-thread", sourceRequestId: "u1",
    customerQuestion, understoodGoal: understanding.understoodGoal, verificationTarget: understanding.verificationTarget,
    expectedAnswer: understanding.expectedAnswer, investigationQuestion: understanding.investigationQuestion,
    findingStatus: "verified", findingSummary: findings.summary, evidence: findings.evidence, unknowns: findings.unknowns,
    customerConclusion: "建议按调查结果修复。", createdAt: "2026-09-05T00:00:00.000Z",
  };
  const snapshot = () => ({ ownerPersonaId: "han-li", conversationId: "discussion-thread", messages: [...messages], updatedAt: "2026-09-05T00:00:01.000Z" });
  const memory = {
    readPersonaConversation: () => snapshot(), newPersonaConversation: () => snapshot(),
    readHanliSemanticContext: () => ({ concerns: [], trajectories: [], inspectionExperiences: [] }),
    readLatestRequirementDiscussionContext: () => prior,
    recordRequirementDiscussionContext: (context) => recorded.push(structuredClone(context)),
    registerPersonaRound: (round) => { messages.push(
      { messageId: round.userMessageId, speakerType: "user", speakerPersonaId: null, content: round.userContent },
      { messageId: round.personaMessageId, speakerType: "persona", speakerPersonaId: "han-li", content: round.personaContent },
    ); return snapshot(); },
  };
  const decision = { ...topic, userIntent: "根据已核实的长消息问题形成修正方案" };
  const service = new HanliConversationService({
    store: { state: () => ({ deliberations: [], automationSettings: {} }) }, memory,
    prompts: { render: (_id, variables) => JSON.stringify(variables) },
    conversation: { activeConversationId: () => "provider-thread", newChat: async () => {}, send: async () => ({ threadId: "provider-thread", itemCount: 1, text: `可以按已核实结果继续确定修正。\nHANLI_TOPIC_META=${JSON.stringify(decision)}` }) },
    startInternalDeliberation: async () => { starts += 1; return { continuous: true }; },
    recordEvent: () => {}, refreshSemanticMemory: () => {}, readStableUserId: () => "XUNAN", readProjectScope: () => "/workspace",
  });
  const workspaceState = { roots: [{ id: "root-1", path: "/workspace", name: "workspace", writable: true }], primaryId: "root-1" };
  await service.send({ message: "按这个调查结果修正", clientMessageId: "u2", attachmentIds: [], workspaceState, locale: "zh-CN" });
  assert.equal(starts, 0);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].customerQuestion, customerQuestion);
  assert.equal(recorded[0].findingSummary, findings.summary);
  assert.equal(recorded[0].understoodGoal, decision.userIntent);
  decision.switchTopic = true;
  await service.send({ message: "改谈设置页面", clientMessageId: "u3", attachmentIds: [], workspaceState, locale: "zh-CN" });
  assert.equal(recorded[1].customerQuestion, "改谈设置页面");
  assert.equal(recorded[1].findingStatus, "unknown");
  assert.deepEqual(recorded[1].evidence, []);
});

test("排查恢复点不进入后续客户对话上下文，也不挤掉真实问答", () => {
  const messages = [{ messageId: "user-1", speakerType: "user", speakerPersonaId: null, content: "滚动条为何跳动" }];
  for (let index = 0; index < 30; index += 1) messages.push({
    messageId: `internal:inquiry-checkpoint:u1:${index}:assessment`, speakerType: "persona",
    speakerPersonaId: "han-li", content: "内部恢复记录不应进入对话",
  });
  const context = buildHanliRecentConversation(messages);
  assert.match(context, /滚动条为何跳动/);
  assert.doesNotMatch(context, /内部恢复记录/);
});


test("托管将韩立设计交给现有研讨指派链，不运行人物内部排障；重复请求幂等", async () => {
  const f = fixture(async () => { throw new Error("不得调用独立排查链"); });
  const contexts = [];
  let starts = 0, calls = 0, currentRun = null;
  f.memory.readHanliSemanticContext = () => ({ concerns: [], trajectories: [], inspectionExperiences: [] });
  f.memory.recordRequirementDiscussionContext = (value) => contexts.push(value);
  const service = new HanliConversationService({
    memory: f.memory,
    store: { state: () => ({ deliberations: [], automationSettings: { automaticCustodyEnabled: true }, oneShotRun: currentRun }) },
    prompts: { render: () => "设计要求" },
    conversation: {
      activeConversationId: () => "provider",
      send: async () => { calls += 1; return { threadId: "provider", text:
        `消息区独立滚动，输入区固定可见，加载和错误状态明确。\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: understanding })}` }; },
    },
    startInternalDeliberation: async () => {
      starts += 1;
      assert.match(contexts.at(-1).customerConclusion, /输入区固定可见/);
      assert.equal(contexts.at(-1).customerQuestion, customerQuestion);
      assert.ok(f.messages.some((item) => item.messageId === "hanli-design:u1"));
      currentRun = { runId: "run", status: "running" };
      return { continuous: true };
    },
    investigateWithNangong: async () => { throw new Error("不得启动另一条调查工作流"); },
    recordEvent: () => {},
  });
  await Promise.all([service.send(request), service.send(request)]);
  await service.send(request);
  assert.equal(starts, 1);
  assert.equal(calls, 1);
  assert.equal(f.messages.filter((item) => item.speakerType === "user").length, 1);
  assert.equal(f.messages.filter((item) => item.messageId === "hanli-control:automatic:u1").length, 1);
});

test("删除韩立托管排障旁路，不保留后台恢复或旧状态兼容入口", () => {
  const inquirySource = readFileSync(new URL("../../../electron/services/personas/hanli/internal/conversation/hanli-inquiry.service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(inquirySource, /recoverAutomatic|waitForRecovery|#recoveryTimer|strategyReview/);
});
