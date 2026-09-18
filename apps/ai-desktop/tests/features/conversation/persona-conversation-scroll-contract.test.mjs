import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const hook = read("../../../src/features/conversation/model/usePersonaConversationTailFollow.ts");
const hanli = read("../../../src/features/hanli/components/HanliConversationWorkspace.tsx");
const hanliController = read("../../../src/features/hanli/components/useHanliConversationWorkspace.ts");
const nangong = read("../../../src/features/nangong/components/NangongConversationWorkspace.tsx");
const nangongController = read("../../../src/features/nangong/components/useNangongConversationWorkspace.ts");
const styles = read("../../../src/applications/styles/desktop-applications.css");
const sharedStyles = read("../../../../../shared/frontend/sel-ui/src/components/conversation/selConversation.css");
const shell = read("../../../src/features/conversation/components/SelUiConversation.tsx");
const personaConversation = read("../../../src/features/conversation/model/usePersonaConversation.ts");
const taskNavigation = read("../../../src/applications/developer/explorer/CollaborationTaskNavigation.tsx");

test("可输入人物会话仅在用户停留底部时跟随新增消息", () => {
  assert.match(hook, /scrollHeight - timeline\.scrollTop - timeline\.clientHeight/);
  assert.match(hook, /followsTailRef\.current = remaining <= BOTTOM_TOLERANCE_PX/);
  assert.match(hanli, /useHanliConversationWorkspace\(props\)/);
  assert.match(hanliController, /latestMessage = messages\.at\(-1\)[\s\S]*usePersonaConversationTailFollow\(timelineIdentity\)/);
  assert.match(nangongController, /latestVisibleMessage = visibleMessages\.at\(-1\)[\s\S]*usePersonaConversationTailFollow\(timelineIdentity\)/);
  assert.doesNotMatch(hanliController, /messages\.map\(\(message\) => `\$\{message\.messageId\}:\$\{message\.deliveryStatus\}:\$\{message\.content\}`/);
  assert.doesNotMatch(nangongController, /visibleMessages\.map\(\(message\) => `\$\{message\.messageId\}:\$\{message\.status\}:\$\{message\.content\}`/);
  assert.match(hook, /const shouldFollowTail = followsTailRef\.current;/);
  assert.match(hook, /React 提交节点后立即对齐一次[\s\S]*timeline\.scrollTo\(\{ top: timeline\.scrollHeight \}\);[\s\S]*requestAnimationFrame[\s\S]*timeline\.scrollTo\(\{ top: timeline\.scrollHeight \}\);/);
});

test("韩立会话使用页面专属网格行隔离时间线和输入区，不修改共享 SELUI 会话选择器", () => {
  assert.match(hanli, /className="hanli-conversation-workspace"/);
  assert.match(styles, /\.hanli-conversation-workspace \{ position: relative; flex: 1 1 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; \}/);
  assert.match(styles, /\.hanli-conversation-workspace > \.selconversation-root \{ position: relative; flex: 1 1 0; min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax\(0, 1fr\) auto; overflow: hidden; \}/);
  assert.match(styles, /\.hanli-person-chat \{ grid-row: 1; min-height: 0; \}/);
  assert.match(styles, /\.hanli-conversation-workspace \.hanli-person-composer \{ position: static; grid-row: 2;/);
  assert.match(styles, /@media \(max-width: 1180px\) \{ \.hanli-conversation-workspace \.hanli-person-composer \{ margin-right: 28px; margin-left: 28px; \} \}/);
  assert.match(styles, /@media \(max-width: 720px\) \{ \.hanli-conversation-workspace \.hanli-person-composer \{ margin-right: 20px; margin-left: 20px; \} \}/);
  assert.match(styles, /\.nangong-person-chat \{ flex: 1 1 0; min-height: 0; \}/);
  assert.match(sharedStyles, /\.selconversation-root \{ position: relative; min-width: 0; min-height: 0; display: contents; \}/);
  assert.match(sharedStyles, /\.selconversation-timeline \{ min-height: 0; overflow-x: hidden; overflow-y: auto;/);
});

test("浮层输入区按高度留白，布局流输入区只保留时间线收尾间距", () => {
  assert.match(sharedStyles, /var\(--selconversation-composer-reserve, 160px\)/);
  assert.match(shell, /new ResizeObserver\(notifyGeometry\)/);
  assert.match(shell, /getBoundingClientRect\(\)\.height/);
  assert.match(shell, /window\.getComputedStyle\(composerElement\)\.position === "absolute"/);
  assert.match(shell, /const reserve = isOverlay \? Math\.ceil\(composerElement\.getBoundingClientRect\(\)\.height\) \+ 48 : 38;/);
  assert.match(shell, /selConversation:geometry/);
  assert.match(hook, /addEventListener\("selConversation:geometry", followGeometryChange\)/);
  assert.match(hook, /const shouldFollowTail = followsTailRef\.current;[\s\S]*if \(!shouldFollowTail\) return;/);
});

test("共享浮层仍使用动态底部内边距，韩立输入区改由独立网格行占位", () => {
  assert.match(styles, /韩立页给时间线和输入区分配独立网格行/);
  assert.match(sharedStyles, /padding: 38px max\(36px, 8vw\) var\(--selconversation-composer-reserve, 160px\)/);
  assert.doesNotMatch(styles, /margin-bottom: var\(--selconversation-composer-reserve, 160px\)/);
});

test("韩立核实消息生命周期保留在会话内，不覆盖协作人物当前状态", () => {
  assert.match(personaConversation, /delegatedResponderPersonaId/);
  assert.match(personaConversation, /inquiryActivity\?\.status === "running"/);
  assert.match(personaConversation, /inquiryActivity\.phase === "investigating"/);
  assert.doesNotMatch(personaConversation, /inquiry:\(\.\+\):progress/);
  assert.doesNotMatch(taskNavigation, /conversationActivity|personaConversationActivities/);
});
