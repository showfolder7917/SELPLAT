import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const entry = read("../../../src/features/conversation/index.ts");
const messageImage = read("../../../src/features/conversation/components/ConversationMessageImage.tsx");
const codexTimeline = read("../../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline.tsx");
const hanli = read("../../../src/features/hanli/components/HanliConversationWorkspace.tsx");
const nangong = read("../../../src/features/nangong/components/NangongConversationWorkspace.tsx");

test("三类已发送消息附件只通过 conversation 公开图片组件接入大图预览", () => {
  assert.match(entry, /export \{ ConversationMessageImage \}/);
  assert.match(messageImage, /@selplat\/sel-ui\/components\/image-preview/);
  assert.match(messageImage, /api\.open\(/);
  for (const source of [codexTimeline, hanli, nangong]) {
    assert.match(source, /ConversationMessageImage/);
  }
});

test("待发送附件的预览与移除链路不被大图预览组件替换", () => {
  assert.match(hanli, /attachments\.map\(\(attachment\) => <figure/);
  assert.match(nangong, /attachments\.map\(\(attachment\) => <figure/);
});
