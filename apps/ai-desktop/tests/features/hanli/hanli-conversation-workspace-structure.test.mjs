import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const view = read("../../../src/features/hanli/components/HanliConversationWorkspace.tsx");
const types = read("../../../src/features/hanli/components/HanliConversationWorkspace.types.ts");
const controller = read("../../../src/features/hanli/components/useHanliConversationWorkspace.ts");
const custodySwitch = read("../../../src/features/hanli/components/HanliConversationWorkspace/HanliCustodySwitch.tsx");

test("韩立会话页面按数据结构、控制 Hook 和 View 分离职责", () => {
  assert.match(types, /韩立会话页面的数据结构定义/);
  assert.match(types, /export interface HanliConversationWorkspaceProps/);
  assert.match(controller, /韩立会话页面的控制 Hook/);
  assert.match(controller, /window\.desktop\?\.sendPersonaConversationMessage/);
  assert.match(view, /韩立会话页面的 View/);
  assert.match(view, /useHanliConversationWorkspace\(props\)/);
  assert.doesNotMatch(view, /window\.desktop\?\.sendPersonaConversationMessage/);
});

test("韩立 View 明确标注实际页面的会话、问答、附件和输入操作区域", () => {
  assert.match(view, /点击 Developer 左侧人物树中的“韩立”/);
  assert.match(view, /会话区：页面上半部分/);
  assert.match(view, /客户问答区：按发生顺序/);
  assert.match(view, /待发送附件区：显示客户本轮/);
  assert.match(view, /文字输入区：接收客户问题/);
  assert.match(view, /底部操作区：左侧放辅助工具/);
});

test("韩立数据结构和控制 Hook 为新手保留逐项业务说明", () => {
  for (const field of ["runtime", "conversation", "attachments", "workspaces", "locale", "newConversationBusy", "error", "onConversation", "onAttachments", "onScreenshot", "onPaste", "onError"]) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(types, new RegExp(`/\\*\\*[\\s\\S]*?\\*/\\s*${escapedField}(?:\\??:|\\()`));
  }
  assert.match(controller, /text 保存输入框中尚未发送的文字/);
  assert.match(controller, /桌面 API 通过 IPC 把客户原文、截图、工作区和语言交给韩立后端/);
  assert.match(controller, /返回 View 渲染和响应交互所需的最小页面模型/);
});

test("自动托管作为韩立会话专属子模块并使用新手可读结构", () => {
  assert.match(view, /\.\/HanliConversationWorkspace\/HanliCustodySwitch/);
  assert.match(custodySwitch, /韩立会话页面中的“自动托管”子模块/);
  assert.match(custodySwitch, /async function toggleCustody/);
  assert.doesNotMatch(custodySwitch, /onClick=\{async/);
});

test("韩立页面模块的注释先写中文业务名称", () => {
  for (const source of [view, types, controller, custodySwitch]) {
    assert.doesNotMatch(source, /^\s*\/\/\s*[A-Za-z][A-Za-z0-9_.-]*\s/gm);
    assert.doesNotMatch(source, /^\s*\/\*\*\s*[A-Za-z]/gm);
  }
});
