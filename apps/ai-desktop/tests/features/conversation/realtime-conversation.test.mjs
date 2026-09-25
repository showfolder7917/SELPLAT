import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/conversation/model/realtime-conversation.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const realtime = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("临时消息使用可见时间线最大顺序号加一，不会因内部消息过滤后的编号空洞插到旧回复上方", () => {
  const visibleMessages = [
    { sequenceNumber: 0 },
    { sequenceNumber: 1 },
    { sequenceNumber: 4 },
    { sequenceNumber: 7 },
  ];

  assert.equal(realtime.nextRealtimeConversationSequence(visibleMessages), 8);
});

test("持久消息接管同编号临时消息，其他消息继续按真实顺序排列", () => {
  const pending = {
    messageId: "customer-2",
    sequenceNumber: 8,
    replyToMessageId: null,
    status: "sending",
    createdAt: "2026-09-19T00:00:08.000Z",
  };
  const persisted = [
    { messageId: "assistant-1", sequenceNumber: 7, replyToMessageId: "customer-1", status: "completed", createdAt: "2026-09-19T00:00:07.000Z" },
    { ...pending, sequenceNumber: 10, status: "completed" },
  ];

  assert.deepEqual(
    realtime.mergeRealtimeConversationTimeline(persisted, [pending]).map((message) => [message.messageId, message.sequenceNumber, message.status]),
    [["assistant-1", 7, "completed"], ["customer-2", 10, "completed"]],
  );
});

test("人物消息已经交给服务后显示已发送，只有失败才显示发送失败", () => {
  assert.equal(realtime.personaConversationDeliveryLabel("sending"), "已发送");
  assert.equal(realtime.personaConversationDeliveryLabel("completed"), "已发送");
  assert.equal(realtime.personaConversationDeliveryLabel("failed"), "发送失败");
  assert.equal(realtime.personaConversationDeliveryLabel("sending", "ja"), "送信済み");
  assert.equal(realtime.personaConversationDeliveryLabel("failed", "ja"), "送信失敗");
  assert.equal(realtime.personaConversationDeliveryLabel("sending", "en"), "Sent");
  assert.equal(realtime.personaConversationDeliveryLabel("failed", "en"), "Send failed");
});
