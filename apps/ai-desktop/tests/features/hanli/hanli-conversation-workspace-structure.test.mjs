import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const view = read("../../../src/features/hanli/components/HanliConversationWorkspace.tsx");
const fixedUiText = read("../../../contracts/foundation/i18n/fixed-ui-text.ts");
const types = read("../../../src/features/hanli/components/HanliConversationWorkspace.types.ts");
const controller = read("../../../src/features/hanli/components/useHanliConversationWorkspace.ts");
const custodySwitch = read("../../../src/features/hanli/components/HanliConversationWorkspace/HanliCustodySwitch.tsx");

test("韩立会话页面按数据结构、控制 Hook 和 View 分离职责", () => {
  assert.match(types, /韩立会话页面的数据结构定义/);
  assert.match(types, /export interface HanliConversationWorkspaceProps/);
  assert.match(controller, /韩立会话页面的控制 Hook/);
  assert.match(controller, /getOptionalCollaborationDesktopApi\(\)\?\.sendPersonaConversationMessage/);
  assert.doesNotMatch(controller, /window\.desktop\?\./);
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
  for (const field of ["runtime", "conversation", "attachments", "workspaces", "locale", "newConversationBusy", "error", "onConversation", "onAttachments", "onScreenshot", "onPaste", "onError", "isCurrentPage"]) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(types, new RegExp(`/\\*\\*[\\s\\S]*?\\*/\\s*${escapedField}(?:\\??:|\\()`));
  }
  assert.match(controller, /待发送文字（text）保存输入框中尚未发送的内容/);
  assert.match(controller, /本轮消息资料：后端保存消息、读取截图并建立工程上下文所需的完整输入/);
  assert.match(controller, /返回 View 渲染和响应交互所需的最小页面模型/);
});

test("韩立会话成为当前页时把焦点交给需求输入框", () => {
  assert.match(view, /const messageInputRef = useRef<HTMLTextAreaElement>\(null\)/);
  assert.match(view, /if \(props\.isCurrentPage\) messageInputRef\.current\?\.focus\(\)/);
  assert.match(view, /\}, \[props\.isCurrentPage\]\)/);
  assert.match(view, /<textarea[\s\S]*ref=\{messageInputRef\}/);
});

test("韩立空会话按首次使用顺序说明目标、材料和确认边界", () => {
  for (const key of ["hanliEmptyGoal", "hanliEmptyEvidence", "hanliEmptyBoundary"]) assert.match(view, new RegExp(`fixedUiText\\(props\\.locale, "${key}"\\)`));
  assert.match(fixedUiText, /hanliEmptyGoal: "你可以提出问题、目标，或想实现的功能。"/);
  assert.match(fixedUiText, /hanliEmptyGoal: "質問、目標、または実現したい機能を伝えてください。"/);
  assert.match(fixedUiText, /hanliEmptyGoal: "Share a question, goal, or feature you want to build\."/);
  assert.match(view, /空状态说明：按首次使用顺序说明目标、直接材料和原有确认边界/);
});

test("自动托管作为韩立会话专属子模块并使用新手可读结构", () => {
  assert.match(view, /\.\/HanliConversationWorkspace\/HanliCustodySwitch/);
  assert.match(view, /<HanliCustodySwitch locale=\{props\.locale\} onError=\{onError\}/);
  assert.match(custodySwitch, /韩立会话页面中的“自动托管”子模块/);
  assert.match(custodySwitch, /locale: LocaleValue/);
  assert.match(custodySwitch, /async function toggleCustody/);
  assert.doesNotMatch(custodySwitch, /onClick=\{async/);
});

test("韩立会话固定文本由统一资源解析，恢复摘要和消息正文保持原值", () => {
  for (const key of ["hanliContextReadStats", "hanliRecoveryRetrying", "hanliRecoveryRetry", "personaUserHeader", "personaCustomerDisplayReloading", "personaCustomerDisplayReload", "hanliCustody", "hanliCustodyHint"]) {
    assert.match(`${view}\n${custodySwitch}`, new RegExp(`fixedUiText\\([^\\n]*?"${key}"`));
  }
  assert.match(view, /conversation\.recovery\.summary/);
  assert.match(view, /<MarkdownMessage text=\{message\.content\}/);
  assert.match(custodySwitch, /error instanceof Error \? error\.message/);
  assert.match(fixedUiText, /hanliContextReadStats: "本轮读取：方法资料 \{method\}/);
  assert.match(fixedUiText, /hanliContextReadStats: "今回の読み取り：メソッド資料 \{method\}/);
  assert.match(fixedUiText, /hanliContextReadStats: "This turn read: method material \{method\}/);
  assert.doesNotMatch(custodySwitch, /aria-label="自动托管"|<span>自动托管<\/span>/);
});

test("韩立页面模块的注释先写中文业务名称", () => {
  for (const source of [view, types, controller, custodySwitch]) {
    assert.doesNotMatch(source, /^\s*\/\/\s*[A-Za-z][A-Za-z0-9_.-]*\s/gm);
    assert.doesNotMatch(source, /^\s*\/\*\*\s*[A-Za-z]/gm);
  }
});
