import assert from "node:assert/strict";
import test from "node:test";
import { HanliInquiryService, parseInquiryFindings } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/hanli-inquiry.service.js";
import { parseHanliConversationResponse } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/hanli-conversation.parser.js";
import { HanliConversationService } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/hanli-conversation.service.js";

const customerQuestion = "长消息超过一屏后是否还会跑到输入框下面，这个问题是否已经修复";
const findings = { status: "verified", answeredQuestion: customerQuestion, summary: "源码已修改，尚未发布", evidence: [{ source: "task-1 / file.ts:12", detail: "修改存在，发布记录不存在" }], unknowns: ["当前运行版本"] };
const understanding = { status: "ready", understoodGoal: "确认长消息滚动问题是否修复", verificationTarget: "消息时间线与输入框的滚动位置", expectedAnswer: "当前代码和运行版本是否已修复", ambiguities: [], investigationQuestion: "核对消息时间线滚动实现、相关测试和当前运行版本" };
function fixture(investigate, explain = async () => ({ text: "简单说，源码虽然已经修改，但你当前使用的版本还没有确认更新。建议先完成发布并确认运行版本，再判断问题是否解决。" })) {
  const messages = [], order = [], discussionContexts = [];
  const memory = {
    readPersonaConversation: (_owner, id) => ({ conversationId: id, messages: [...messages] }),
    registerPersonaRound: (round) => { messages.push({ messageId: round.userMessageId, content: round.userContent }, { messageId: round.personaMessageId, content: round.personaContent }); return memory.readPersonaConversation("han-li", round.conversationId); },
    appendPersonaInternalMessage: (message) => { if (!messages.some((item) => item.messageId === message.messageId)) messages.push(message); order.push(message.messageId); return memory.readPersonaConversation("han-li", message.conversationId); },
    recordRequirementDiscussionContext: (context) => { discussionContexts.push(structuredClone(context)); order.push("discussion-context-recorded"); },
  };
  const service = new HanliInquiryService({
    memory,
    prompts: { render: (id, variables) => { assert.equal(id, "hanli.inquiry-response"); return JSON.stringify(variables); } },
    conversation: { send: (nextRequest, prompt) => {
      const variables = JSON.parse(prompt);
      assert.deepEqual(nextRequest.attachmentIds, []);
      assert.equal(variables.customerQuestion, customerQuestion);
      assert.equal(JSON.parse(variables.findingsJson).summary, findings.summary);
      order.push("explained");
      return explain(nextRequest, variables);
    } },
    recordEvent: () => {},
    investigateWithNangong: (...args) => { order.push("dispatched"); return investigate(...args); },
  });
  return { service, messages, order, discussionContexts };
}
const request = { message: customerQuestion, clientMessageId: "u1", attachmentIds: ["shot1"] };
const topic = { title: "进度核实", type: "核实", userIntent: request.message, tags: ["进度"], summary: "核实当前进度", switchTopic: false };

test("真实派发后才等待，调查返回后主动答复，内部问答保留关联", async () => {
  let resolve;
  const f = fixture((inquiry) => {
    assert.equal(inquiry.customerQuestion, customerQuestion);
    assert.equal(inquiry.verificationTarget, understanding.verificationTarget);
    assert.equal(inquiry.investigationQuestion, understanding.investigationQuestion);
    return new Promise((done) => { resolve = done; });
  });
  const pending = f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(f.service.run(request, "original", customerQuestion, understanding, topic), pending);
  assert.ok(f.order.indexOf("dispatched") < f.order.indexOf("inquiry:u1:waiting"));
  assert.equal(f.messages.some((item) => item.messageId === "inquiry:u1:result"), false);
  resolve(JSON.stringify(findings));
  const result = await pending;
  assert.equal(result.conversationId, "original");
  const answer = f.messages.find((item) => item.messageId === "internal:inquiry:u1:answer");
  assert.equal(answer.speakerPersonaId, "nangong-wan");
  assert.equal(answer.replyToMessageId, "internal:inquiry:u1:question");
  assert.doesNotMatch(result.messages.at(-1).content, /file.ts:12/);
  assert.match(result.messages.at(-1).content, /建议先完成发布/);
  assert.equal(result.messages.at(-1).speakerPersonaId, "han-li");
  assert.ok(f.order.indexOf("internal:inquiry:u1:answer") < f.order.indexOf("explained"));
  const question = f.messages.find((item) => item.messageId === "internal:inquiry:u1:question");
  assert.match(question.content, new RegExp(customerQuestion));
  assert.match(question.content, /调查范围/);
  assert.equal(f.discussionContexts.length, 1);
  assert.equal(f.discussionContexts[0].customerQuestion, customerQuestion);
  assert.equal(f.discussionContexts[0].findingSummary, findings.summary);
  assert.match(f.discussionContexts[0].customerConclusion, /建议先完成发布/);
  assert.ok(f.order.indexOf("internal:inquiry:u1:answer") < f.order.indexOf("discussion-context-recorded"));
  await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.equal(f.order.filter((item) => item === "dispatched").length, 1);
});
test("韩立解释失败时保留内部证据但不向用户倾倒技术报告", async () => {
  const f = fixture(async () => JSON.stringify(findings), async () => { throw new Error("解释服务暂时不可用"); });
  const result = await f.service.run(request, "original", customerQuestion, understanding, topic);
  const internal = f.messages.find((item) => item.messageId === "internal:inquiry:u1:answer");
  assert.match(internal.content, /file.ts:12/);
  assert.doesNotMatch(result.messages.at(-1).content, /file.ts:12/);
  assert.match(result.messages.at(-1).content, /没有成功把技术结果整理成清楚的解决方案/);
});
test("调用失败和不合格调查不得变成完成结论", async () => {
  for (const invoke of [async () => { throw new Error("服务断线"); }, async () => "已经完成", async () => JSON.stringify({ ...findings, evidence: [] })]) {
    const f = fixture(invoke);
    const result = await f.service.run(request, "original", customerQuestion, understanding, topic);
    assert.match(result.messages.at(-1).content, /核实未完成/);
    assert.equal(f.messages.some((item) => item.speakerPersonaId === "nangong-wan"), false);
  }
});
test("允许明确未知但禁止无证据的已核实", () => {
  assert.throws(() => parseInquiryFindings(JSON.stringify({ ...findings, evidence: [] }), customerQuestion));
  assert.equal(parseInquiryFindings(JSON.stringify({ ...findings, status: "unknown", evidence: [] }), customerQuestion).status, "unknown");
});
test("调查结果没有对应客户原问题时不得进入客户解释", async () => {
  const f = fixture(async () => JSON.stringify({ ...findings, answeredQuestion: "发送按钮为什么禁用" }));
  const result = await f.service.run(request, "original", customerQuestion, understanding, topic);
  assert.match(result.messages.at(-1).content, /核实未完成/);
  assert.equal(f.order.includes("explained"), false);
});
test("结构化理解与可见回复分离，理解不足时保留澄清门禁", () => {
  const parsed = parseHanliConversationResponse(`先核实\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: understanding })}`);
  assert.equal(parsed.inquiry.investigationQuestion, understanding.investigationQuestion);
  assert.equal(parsed.reply, "先核实");
  const clarification = parseHanliConversationResponse(`请确认你指的是当前运行版本还是源码。\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: { ...understanding, status: "clarification-required", ambiguities: ["需要确认源码还是运行版本"], investigationQuestion: undefined } })}`);
  assert.equal(clarification.inquiry.status, "clarification-required");
  assert.deepEqual(clarification.inquiry.ambiguities, ["需要确认源码还是运行版本"]);
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
    store: { state: () => ({ deliberations: [] }) }, memory,
    prompts: { render: (id, variables) => JSON.stringify({ id, variables }) },
    conversation: {
      activeConversationId: () => "provider-thread",
      newChat: async () => {},
      send: async (_nextRequest, prompt) => {
        const rendered = JSON.parse(prompt);
        if (rendered.id === "hanli.inquiry-response") return { threadId: "provider-thread", itemCount: 1, text: "当前运行版本尚未核实，建议重启后按原问题复验。" };
        conversationCalls += 1;
        if (conversationCalls === 1) return { threadId: "provider-thread", itemCount: 1, text: `你要确认的是源码已经修改，还是当前运行版本已经生效？\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: clarification })}` };
        assert.equal(rendered.variables.customerQuestionAnchor, customerQuestion);
        secondRecentConversation = rendered.variables.recentConversation;
        return { threadId: "provider-thread", itemCount: 1, text: `我会按最初问题核实当前运行版本。\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, inquiry: understanding })}` };
      },
    },
    investigateWithNangong: async (inquiry) => { dispatches += 1; assert.equal(inquiry.customerQuestion, customerQuestion); return JSON.stringify(findings); },
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

test("韩立邀请内部研讨时发布当前中立上下文但不直接启动工作流", async () => {
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
  const invitation = "若确认由韩立与南宫婉开始内部研讨并持续自动演化，请回复 1。";
  const service = new HanliConversationService({
    store: { state: () => ({ deliberations: [] }) }, memory,
    prompts: { render: (_id, variables) => JSON.stringify(variables) },
    conversation: { activeConversationId: () => "provider-thread", newChat: async () => {}, send: async () => ({ threadId: "provider-thread", itemCount: 1, text: `可以按已核实结果继续确定修正。${invitation}\nHANLI_TOPIC_META=${JSON.stringify(decision)}` }) },
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
});
