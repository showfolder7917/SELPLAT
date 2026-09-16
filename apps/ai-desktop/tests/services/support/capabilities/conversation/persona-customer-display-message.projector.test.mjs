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

test("内部字段位于正文开头时保持不可显示状态，不能把混合原文回退到客户页面", () => {
  const failed = derivePersonaCustomerDisplayMessage({ messageType: "customer-visible", content: "contentRole：technical-evidence\n用户目标：内部目标" });
  assert.deepEqual(failed, { state: "failed", content: null, failureReason: "客户显示正文派生失败，请重新读取。" });
});

test("旧 hanli-design 按稳定来源身份只迁移首段，不把设计说明和语料元数据带回客户页面", () => {
  const legacy = derivePersonaCustomerDisplayMessage({
    messageId: "hanli-design:request-1",
    messageType: "customer-visible",
    speakerType: "persona",
    content: [
      "我会保持本轮只读：先加载工程约束，再整理明确说明。",
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
    content: "我会保持本轮只读：先加载工程约束，再整理明确说明。",
    failureReason: null,
  });
  assert.doesNotMatch(legacy.content, /contentRole|持久化|SELPLAT_CORPUS_META|用户原话|交给南宫婉核实/u);
});
