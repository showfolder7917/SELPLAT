import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 测试资源读取器：从本测试文件定位到对话功能的真实源码。
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
// 主页面 View：只应负责文案选择和可见区域组装。
const view = read("../../../src/features/conversation/components/CodexConversationWorkspace.tsx");
// 主页面数据结构：应逐项说明应用层传入的公开边界。
const types = read("../../../src/features/conversation/components/CodexConversationWorkspace.types.ts");
// 消息时间线子模块：独立拥有消息和托管操作的视图组装。
const timeline = read("../../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline.tsx");
// 会话编辑区子模块：独立拥有附件、队列、输入和工具栏组装。
const composer = read("../../../src/features/conversation/components/CodexConversationWorkspace/CodexConversationComposer.tsx");

test("Codex 会话页按 View、数据结构和专属可见区域分开职责", () => {
  assert.match(types, /Codex 会话页面的数据结构定义/);
  assert.match(types, /export interface CodexConversationWorkspaceProps/);
  assert.match(view, /Codex 会话页面的 View/);
  assert.match(view, /CodexConversationTimeline/);
  assert.match(view, /CodexConversationComposer/);
  assert.doesNotMatch(view, /messages\.map|<textarea/);
});

test("Codex 会话子模块使用具名操作而不在 JSX 中压缩异步流程", () => {
  assert.match(timeline, /async function advanceManagedStage/);
  assert.match(timeline, /function chooseUserInputAnswer/);
  assert.match(composer, /function submitConversation/);
  assert.match(composer, /function recoverInterruptedTask/);
  assert.match(composer, /function captureScreenWithoutDesktop/);
  assert.doesNotMatch(timeline, /onClick=\{async/);
  assert.doesNotMatch(composer, /onClick=\{async/);
});

test("Codex 会话整棵页面模块的注释先说明中文业务名称", () => {
  for (const source of [view, types, timeline, composer]) {
    assert.doesNotMatch(source, /^\s*\/\/\s*[A-Za-z][A-Za-z0-9_.-]*\s/gm);
    assert.doesNotMatch(source, /^\s*\/\*\*\s*[A-Za-z]/gm);
  }
});
