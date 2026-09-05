import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const hook = read("../../../src/features/conversation/model/usePersonaConversationTailFollow.ts");
const hanli = read("../../../src/features/hanli/components/HanliConversationWorkspace.tsx");
const nangong = read("../../../src/features/nangong/components/NangongConversationWorkspace.tsx");
const styles = read("../../../src/applications/styles/desktop-applications.css");
const sharedStyles = read("../../../../../shared/frontend/sel-ui/src/components/conversation/selConversation.css");
const shell = read("../../../src/features/conversation/components/SelUiConversation.tsx");
const personaConversation = read("../../../src/features/conversation/model/usePersonaConversation.ts");
const developer = read("../../../src/applications/developer/DeveloperApplication.tsx");

test("可输入人物会话仅在用户停留底部时跟随新增消息", () => {
  assert.match(hook, /scrollHeight - timeline\.scrollTop - timeline\.clientHeight/);
  assert.match(hook, /followsTailRef\.current = remaining <= BOTTOM_TOLERANCE_PX/);
  assert.match(hook, /if \(followsTailRef\.current\) timeline\.scrollTo/);
  assert.match(hanli, /usePersonaConversationTailFollow\(/);
  assert.match(nangong, /usePersonaConversationTailFollow\(/);
});

test("人物会话使用页面专属高度约束，不修改共享 SELUI 会话选择器", () => {
  assert.match(styles, /\.hanli-person-chat, \.nangong-person-chat \{ flex: 1 1 0; min-height: 0; \}/);
  assert.match(sharedStyles, /\.selconversation-timeline \{ min-height: 0; overflow-x: hidden; overflow-y: auto;/);
});

test("输入框和消息高度变化后动态留白并仅在尾部继续跟随", () => {
  assert.match(sharedStyles, /var\(--selconversation-composer-reserve, 160px\)/);
  assert.match(shell, /new ResizeObserver\(notifyGeometry\)/);
  assert.match(shell, /getBoundingClientRect\(\)\.height/);
  assert.match(shell, /selConversation:geometry/);
  assert.match(hook, /addEventListener\("selConversation:geometry", followGeometryChange\)/);
  assert.match(hook, /if \(!followsTailRef\.current\) return/);
});

test("韩立核实消息生命周期驱动南宫婉真实核实状态", () => {
  assert.match(personaConversation, /delegatedResponderPersonaId/);
  assert.match(personaConversation, /inquiry:\(\.\+\):progress/);
  assert.match(personaConversation, /inquiry:\$\{match\[1\]\}:result/);
  assert.match(developer, /hanli\.delegatedResponderPersonaId === "nangong-wan" \? "investigating"/);
});
