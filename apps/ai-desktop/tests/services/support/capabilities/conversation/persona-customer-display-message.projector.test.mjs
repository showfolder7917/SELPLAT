import assert from "node:assert/strict";
import test from "node:test";

import { derivePersonaCustomerDisplayMessage } from "../../../../../electron/services/support/capabilities/conversation/internal/persona-customer-display-message.projector.ts";

const internalFields = ["用户原话：", "用户目标：", "调查对象：", "期望结果：", "交给南宫婉核实："];
const legacyMixedMessage = [
  "我已找到可以继续核实的入口。",
  ...internalFields.map((field, index) => `${field}内部事实-${index + 1}`),
].join("\n\n");

test("客户显示派生只保留旧混合消息的自然答复，并排除内部流程内容", () => {
  const legacy = derivePersonaCustomerDisplayMessage({ messageType: "customer-visible", content: legacyMixedMessage });
  assert.deepEqual(legacy, { state: "ready", content: "我已找到可以继续核实的入口。", failureReason: null });
  for (const field of internalFields) assert.doesNotMatch(legacy.content, new RegExp(field));

  const internal = derivePersonaCustomerDisplayMessage({ messageType: "internal-deliberation", content: legacyMixedMessage });
  assert.deepEqual(internal, { state: "excluded", content: null, failureReason: null });
});

test("空白或无法安全派生的客户正文保持失败位置，不能回退原文", () => {
  const failed = derivePersonaCustomerDisplayMessage({ messageType: "customer-visible", content: "  " });
  assert.equal(failed.state, "failed");
  assert.equal(failed.content, null);
  assert.match(failed.failureReason || "", /无法安全读取/);
});

test("紧凑历史字段和 contentRole 标注也只保留字段前的自然答复", () => {
  const compact = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    content: "我会继续核实滚动问题。\n用户原话：内部原话\n用户目标：内部目标\n调查对象：内部对象\ncontentRole 标注：technical-evidence",
  });
  assert.deepEqual(compact, { state: "ready", content: "我会继续核实滚动问题。", failureReason: null });
  assert.doesNotMatch(compact.content, /用户原话|用户目标|调查对象|contentRole/u);
});

test("Markdown 字段组从人物旧回复中剥离，用户原话包含相同字段时保持完整", () => {
  const legacy = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    speakerType: "persona",
    content: [
      "我会继续核实消息显示。",
      "### **用户原话**",
      "内部原话",
      "- **用户目标**：内部目标",
      "- 调查对象：内部对象",
      "【期望结果】内部结果",
      "contentRole 标注：technical-evidence；持久化、恢复、页面投影仅供内部使用。",
    ].join("\n"),
  });
  assert.deepEqual(legacy, { state: "ready", content: "我会继续核实消息显示。", failureReason: null });
  assert.doesNotMatch(legacy.content, /用户原话|用户目标|调查对象|期望结果|contentRole|持久化|恢复|页面投影/u);

  const userContent = "我想确认用户原话、用户目标和调查对象在页面投影中的显示方式。";
  const user = derivePersonaCustomerDisplayMessage({ messageType: "customer-visible", speakerType: "user", content: userContent });
  assert.deepEqual(user, { state: "ready", content: userContent, failureReason: null });
});

test("无法可靠截取的人物技术长文保持失败位置，不能因当前写入或历史读取显示整段内部说明", () => {
  const legacyTechnicalProse = [
    "我会先按既有流程核对历史记录。",
    "用户原话、目标、调查对象和期望结果已经整理，交给南宫婉核实。",
    "contentRole、持久化、恢复和页面投影仅供内部协作使用。",
  ].join("\n\n");
  const failed = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    speakerType: "persona",
    content: legacyTechnicalProse,
  });
  assert.deepEqual(failed, { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" });
});

test("人物实现短文命中多个受控技术标记时保持失败位置", () => {
  const failed = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    speakerType: "persona",
    content: "contentRole、持久化、恢复和页面投影仅供内部协作使用。",
  });
  assert.deepEqual(failed, { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" });
});

test("人物协作说明命中多个稳定概念时保持失败位置，用户原话仍保持完整", () => {
  const collaborationProse = [
    "原始消息、内部事实和审计依据仅供协作核对。",
    "保存结构、内容归类、恢复读取到时间线投影属于内部实现。",
    "发送、新建会话、制造数据和恢复任务属于工作流处理。",
  ].join("\n\n");
  const persona = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    speakerType: "persona",
    content: collaborationProse,
  });
  assert.deepEqual(persona, { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" });

  const user = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    speakerType: "user",
    content: collaborationProse,
  });
  assert.deepEqual(user, { state: "ready", content: collaborationProse, failureReason: null });
});

test("hanli-design 首段只有内部处理标记时排除记录，不能显示失败占位或泄露正文", () => {
  const internalProcessReply = "本轮只读、工程约束、产品目标、调查边界和验收路径属于内部处理。";
  const persona = derivePersonaCustomerDisplayMessage({
    messageId: "hanli-design:internal-process-reply",
    messageType: "customer-visible",
    speakerType: "persona",
    content: [
      internalProcessReply,
      "后续设计说明和审计字段只保留在原始记录。",
    ].join("\n\n"),
  });
  assert.deepEqual(persona, { state: "excluded", content: null, failureReason: null });

  const user = derivePersonaCustomerDisplayMessage({
    messageType: "customer-visible",
    speakerType: "user",
    content: internalProcessReply,
  });
  assert.deepEqual(user, { state: "ready", content: internalProcessReply, failureReason: null });
});

test("内部字段位于正文开头时保持不可显示状态，不能把混合原文回退到客户页面", () => {
  const failed = derivePersonaCustomerDisplayMessage({ messageType: "customer-visible", content: "contentRole：technical-evidence\n用户目标：内部目标" });
  assert.deepEqual(failed, { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" });
});

test("旧 hanli-design 按稳定来源身份只迁移首段的客户结论", () => {
  const legacy = derivePersonaCustomerDisplayMessage({
    messageId: "hanli-design:request-1",
    messageType: "customer-visible",
    speakerType: "persona",
    content: [
      "我会保持本轮只读：先加载工程约束，再整理调查边界。\n要解决的是客户正文与内部事实混流，不是历史残留显示。",
      "完整路径需要讨论 contentRole、持久化、恢复和页面投影。",
      '<!-- SELPLAT_CORPUS_META {"title":"内部语料"} -->',
      "用户原话：内部原话",
      "用户目标：内部目标",
      "调查对象：内部对象",
      "期望结果：内部结果",
      "交给南宫婉核实：内部调查",
    ].join("\n\n"),
  });
  assert.deepEqual(legacy, {
    state: "ready",
    content: "要解决的是客户正文与内部事实混流，不是历史残留显示。",
    failureReason: null,
  });
  assert.doesNotMatch(legacy.content, /本轮只读|工程约束|调查边界|contentRole|持久化|SELPLAT_CORPUS_META|用户原话|交给南宫婉核实/u);
});

test("旧 hanli-reply 只在后续段落命中稳定治理边界时迁移客户首段", () => {
  const customerReply = "这次要治理的是旧消息留下的内部内容，不是重新验证新回复是否还会混入。客户时间线应只显示当时面向客户的自然答复；原始消息、内部事实和审计依据仍完整保留在内部记录中，供追溯和既有协作使用。";
  const mixed = derivePersonaCustomerDisplayMessage({
    messageId: "hanli-reply:legacy-request",
    messageType: "customer-visible",
    speakerType: "persona",
    content: [
      customerReply,
      "页面实现需要核对保存结构、内容归类、恢复读取和时间线投影。",
      "发送、新建会话、制造数据和恢复任务属于工程验证范围。",
    ].join("\n\n"),
  });
  assert.deepEqual(mixed, { state: "ready", content: customerReply, failureReason: null });

  const ordinary = "第一段是客户说明。\n\n第二段继续解释使用方式。";
  assert.deepEqual(derivePersonaCustomerDisplayMessage({
    messageId: "hanli-reply:current-request",
    messageType: "customer-visible",
    speakerType: "persona",
    content: ordinary,
  }), { state: "ready", content: ordinary, failureReason: null });
});
