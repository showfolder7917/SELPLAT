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
