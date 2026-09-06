import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const view = read("../../../src/features/nangong/components/NangongConversationWorkspace.tsx");
const types = read("../../../src/features/nangong/components/NangongConversationWorkspace.types.ts");
const controller = read("../../../src/features/nangong/components/useNangongConversationWorkspace.ts");
const activity = read("../../../src/features/nangong/components/NangongConversationWorkspace/NangongConversationActivity.tsx");

test("南宫婉页面按参数、控制逻辑、页面结构和专属子模块分层", () => {
  assert.match(types, /南宫婉会话页面的数据结构定义/);
  assert.match(types, /export interface NangongConversationWorkspaceProps/);
  assert.match(controller, /南宫婉会话页面的控制逻辑/);
  assert.match(controller, /window\.desktop\?\.sendPersonaConversationMessage/);
  assert.match(view, /南宫婉会话页面的页面结构/);
  assert.match(view, /useNangongConversationWorkspace\(props\)/);
  assert.doesNotMatch(view, /window\.desktop\?\./);
  assert.match(view, /\.\/NangongConversationWorkspace\/NangongConversationActivity/);
  assert.match(activity, /南宫婉会话页面中的“后台动作”子模块/);
});

test("南宫婉页面的新手说明覆盖真实页面区域和主要控制状态", () => {
  assert.match(view, /后台动作区/);
  assert.match(view, /问答与内部研讨区/);
  assert.match(view, /课题草稿区/);
  assert.match(view, /待发送截图区/);
  assert.match(view, /问答输入区/);
  assert.match(controller, /待发送文字（chatText）保存问答输入框/);
  assert.match(controller, /课题草稿（topicDraft）保存客户确认前/);
  assert.match(controller, /返回页面结构真正需要的数据和具名操作/);
});

test("南宫婉页面模块的注释先写中文业务名称", () => {
  for (const source of [view, types, controller, activity]) {
    assert.doesNotMatch(source, /^\s*\/\/\s*[A-Za-z][A-Za-z0-9_.-]*\s/gm);
    assert.doesNotMatch(source, /^\s*\/\*\*\s*[A-Za-z]/gm);
  }
});
