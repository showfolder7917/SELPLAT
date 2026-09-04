import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const sourceUrl = new URL("../src/components/conversation/selConversation.js", import.meta.url);

test("只读会话不要求输入框，可销毁重挂；可输入会话仍校验输入和中文组合键", async () => {
  let api;
  class Element { querySelector() { return null; } }
  class Input extends Element {
    listeners = new Map();
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name) { this.listeners.delete(name); }
  }
  const window = { sel: { register(_name, value) { api = value; } } };
  runInNewContext(await readFile(sourceUrl, "utf8"), { window, HTMLElement: Element, HTMLTextAreaElement: Input, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  const host = new Element();
  const readonly = api.mount(host, { id: "selConversationTaskHistoryId", readOnly: true });
  assert.throws(() => api.mount(host, { id: "selConversationTaskHistoryId", readOnly: true }), /already exists/);
  readonly.destroy();
  api.mount(host, { id: "selConversationTaskHistoryId", readOnly: true }).destroy();
  assert.throws(() => api.mount(host, { id: "selConversationInputId" }), /textarea/);
  const input = new Input();
  const events = [];
  host.dispatchEvent = event => events.push(event);
  const interactive = api.mount(host, { id: "selConversationInputId", input });
  const enter = { key: "Enter", preventDefault() {} };
  input.listeners.get("compositionstart")();
  input.listeners.get("keydown")(enter);
  assert.equal(events.length, 0);
  input.listeners.get("compositionend")();
  input.listeners.get("keydown")(enter);
  assert.equal(events.length, 1);
  interactive.destroy();
  assert.equal(input.listeners.size, 0);
});

test("selConversation 统一阻止输入法候选确认触发发送", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /compositionstart/);
  assert.match(source, /compositionend/);
  assert.match(source, /event\.isComposing === true/);
  assert.match(source, /event\.keyCode === 229/);
  assert.match(source, /event\.shiftKey !== true/);
  assert.match(source, /selConversation:submit/);
});
