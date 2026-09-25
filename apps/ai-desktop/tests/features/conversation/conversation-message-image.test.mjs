import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const entry = read("../../../src/features/conversation/index.ts");
const messageImage = read("../../../src/features/conversation/components/ConversationMessageImage.tsx");
const fixedUiText = read("../../../contracts/foundation/i18n/fixed-ui-text.ts");
const codexTimeline = read("../../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline.tsx");
const hanli = read("../../../src/features/hanli/components/HanliConversationWorkspace.tsx");
const nangong = read("../../../src/features/nangong/components/NangongConversationWorkspace.tsx");

test("三类已发送消息附件只通过 conversation 公开图片组件接入大图预览", () => {
  assert.match(entry, /export \{ ConversationMessageImage \}/);
  assert.match(messageImage, /@selplat\/sel-ui\/components\/image-preview/);
  assert.match(messageImage, /api\.open\(/);
  assert.match(messageImage, /fixedUiText\(locale, "conversationImagePreview"\)/);
  assert.match(messageImage, /fixedUiText\(locale, "conversationOpenImage"\)/);
  assert.match(messageImage, /fixedUiText\(locale, "conversationImage"\)/);
  assert.match(messageImage, /fixedUiText\(locale, "conversationImagePreviewUnavailable"\)/);
  assert.match(fixedUiText, /conversationImagePreview: "图片预览"/);
  assert.match(fixedUiText, /conversationImagePreview: "画像プレビュー"/);
  assert.match(fixedUiText, /conversationImagePreview: "Image preview"/);
  assert.match(fixedUiText, /conversationImagePreviewUnavailable: "图片预览暂不可用。"/);
  assert.match(fixedUiText, /conversationImagePreviewUnavailable: "画像プレビューは現在利用できません。"/);
  assert.match(fixedUiText, /conversationImagePreviewUnavailable: "Image preview is currently unavailable\."/);
  for (const source of [codexTimeline, hanli, nangong]) {
    assert.match(source, /ConversationMessageImage[\s\S]*locale=/);
  }
});

test("待发送附件的预览与移除链路不被大图预览组件替换", () => {
  assert.match(hanli, /attachments\.map\(\(attachment\) => <figure/);
  assert.match(nangong, /attachments\.map\(\(attachment\) => <figure/);
});
