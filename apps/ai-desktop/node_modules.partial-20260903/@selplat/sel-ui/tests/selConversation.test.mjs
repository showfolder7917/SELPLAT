import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/components/conversation/selConversation.js", import.meta.url);

test("selConversation 统一阻止输入法候选确认触发发送", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /compositionstart/);
  assert.match(source, /compositionend/);
  assert.match(source, /event\.isComposing === true/);
  assert.match(source, /event\.keyCode === 229/);
  assert.match(source, /event\.shiftKey !== true/);
  assert.match(source, /selConversation:submit/);
});
