import assert from "node:assert/strict";
import test from "node:test";
import { HanliInquiryService, parseInquiryFindings } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/hanli-inquiry.service.js";
import { parseHanliConversationResponse } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/hanli-conversation.parser.js";

const findings = { status: "verified", summary: "源码已修改，尚未发布", evidence: [{ source: "task-1 / file.ts:12", detail: "修改存在，发布记录不存在" }], unknowns: ["当前运行版本"] };
function fixture(investigate, explain = async () => ({ text: "简单说，源码虽然已经修改，但你当前使用的版本还没有确认更新。建议先完成发布并确认运行版本，再判断问题是否解决。" })) {
  const messages = [], order = [];
  const memory = {
    readPersonaConversation: (_owner, id) => ({ conversationId: id, messages: [...messages] }),
    registerPersonaRound: (round) => { messages.push({ messageId: round.userMessageId, content: round.userContent }, { messageId: round.personaMessageId, content: round.personaContent }); return memory.readPersonaConversation("han-li", round.conversationId); },
    appendPersonaInternalMessage: (message) => { if (!messages.some((item) => item.messageId === message.messageId)) messages.push(message); order.push(message.messageId); return memory.readPersonaConversation("han-li", message.conversationId); },
  };
  const service = new HanliInquiryService({
    memory,
    prompts: { render: (id, variables) => { assert.equal(id, "hanli.inquiry-response"); return JSON.stringify(variables); } },
    conversation: { send: (nextRequest, prompt) => {
      const variables = JSON.parse(prompt);
      assert.deepEqual(nextRequest.attachmentIds, []);
      assert.equal(JSON.parse(variables.findingsJson).summary, findings.summary);
      order.push("explained");
      return explain(nextRequest, variables);
    } },
    recordEvent: () => {},
    investigateWithNangong: (...args) => { order.push("dispatched"); return investigate(...args); },
  });
  return { service, messages, order };
}
const request = { message: "现在完成了吗", clientMessageId: "u1", attachmentIds: ["shot1"] };
const topic = { title: "进度核实", type: "核实", userIntent: request.message, tags: ["进度"], summary: "核实当前进度", switchTopic: false };

test("真实派发后才等待，调查返回后主动答复，内部问答保留关联", async () => {
  let resolve;
  const f = fixture(() => new Promise((done) => { resolve = done; }));
  const pending = f.service.run(request, "original", request.message, topic);
  assert.equal(f.service.run(request, "original", request.message, topic), pending);
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
  await f.service.run(request, "original", request.message, topic);
  assert.equal(f.order.filter((item) => item === "dispatched").length, 1);
});
test("韩立解释失败时保留内部证据但不向用户倾倒技术报告", async () => {
  const f = fixture(async () => JSON.stringify(findings), async () => { throw new Error("解释服务暂时不可用"); });
  const result = await f.service.run(request, "original", request.message, topic);
  const internal = f.messages.find((item) => item.messageId === "internal:inquiry:u1:answer");
  assert.match(internal.content, /file.ts:12/);
  assert.doesNotMatch(result.messages.at(-1).content, /file.ts:12/);
  assert.match(result.messages.at(-1).content, /没有成功把技术结果整理成清楚的解决方案/);
});
test("调用失败和不合格调查不得变成完成结论", async () => {
  for (const invoke of [async () => { throw new Error("服务断线"); }, async () => "已经完成", async () => JSON.stringify({ ...findings, evidence: [] })]) {
    const f = fixture(invoke);
    const result = await f.service.run(request, "original", request.message, topic);
    assert.match(result.messages.at(-1).content, /核实未完成/);
    assert.equal(f.messages.some((item) => item.speakerPersonaId === "nangong-wan"), false);
  }
});
test("允许明确未知但禁止无证据的已核实", () => {
  assert.throws(() => parseInquiryFindings(JSON.stringify({ ...findings, evidence: [] })));
  assert.equal(parseInquiryFindings(JSON.stringify({ ...findings, status: "unknown", evidence: [] })).status, "unknown");
});
test("语义路由字段与可见回复分离", () => {
  const parsed = parseHanliConversationResponse(`先核实\nHANLI_TOPIC_META=${JSON.stringify({ ...topic, verificationQuestion: "核查task-1的实际完成阶段" })}`);
  assert.equal(parsed.verificationQuestion, "核查task-1的实际完成阶段");
  assert.equal(parsed.reply, "先核实");
});
