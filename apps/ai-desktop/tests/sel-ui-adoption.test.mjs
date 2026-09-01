import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (url) => readFileSync(new URL(url, import.meta.url), "utf8");
const packageManifest = JSON.parse(read("../package.json"));
const selUiManifest = JSON.parse(read("../../../shared/frontend/sel-ui/package.json"));
const selUiRegistry = JSON.parse(read("../../../shared/frontend/sel-ui/src/components/component-registry.json"));
const themeAdapter = read("../src/theme/selUiTheme.ts");
const entry = read("../src/main.tsx");
const developerStyles = read("../src/variants/developer/developer.css");
const developerApp = read("../src/variants/developer/DeveloperApp.tsx");
const evolutionGrids = [read("../src/features/evolution/components/EvolutionDatabaseGrid.tsx"), read("../src/features/evolution/components/EvolutionProposalGrid.tsx")].join("\n");
const evolutionDisclosure = read("../src/features/evolution/components/EvolutionDisclosure.tsx");
const evolutionDossier = read("../src/features/evolution/components/EvolutionTopicDossierView.tsx");
const desktopChrome = read("../src/features/shell/components/DesktopChrome.tsx");
const desktopIpc = read("../electron/system/ipc/register-desktop-ipc.ts");
const electronMain = read("../electron/system/bootstrap/application-runtime.ts");
const preload = [
  read("../electron/system/preload/preload.cts"),
  read("../electron/system/preload/domains/collaboration-bridge.cts"),
].join("\n");
const screenshotEditor = read("../src/features/screenshot/components/ScreenshotEditor.tsx");
const selUiProvider = read("../src/theme/SelUiProvider.tsx");
const selUiConversation = read("../src/features/conversation/components/SelUiConversation.tsx");
const realtimeConversation = read("../src/features/conversation/model/realtime-conversation.ts");
const conversationControl = read("../../../shared/frontend/sel-ui/src/components/conversation/selConversation.js");
const selGrid = read("../../../shared/frontend/sel-ui/src/components/grid/selGrid.js");
const selTree = read("../../../shared/frontend/sel-ui/src/components/tree/selTree.js");
const evolutionTree = read("../src/features/evolution/components/EvolutionTreeNavigation.tsx");
const evolutionWorkspace = read("../src/features/evolution/components/EvolutionControlWorkspace.tsx");
const evolutionTopicGroup = read("../src/features/evolution/components/EvolutionTopicGroupView.tsx");
const selSearch = read("../../../shared/frontend/sel-ui/src/components/search/selSearch.js");
const selWindow = read("../../../shared/frontend/sel-ui/src/components/window/selWindow.js");
const themeContract = read("../../../shared/frontend/sel-ui/src/theme/contract/selThemeContract.css");
const sharedTokens = read("../../../shared/frontend/sel-ui/src/theme/selThemeTokens.css");
const dependencyCache = read("../scripts/dependency-cache.mjs");
const dependencyPreparation = read("../scripts/ensure-dependency-cache.mjs");
const dependencyRunner = read("../scripts/run-with-dependencies.mjs");
const developerTheme = [
  read("../../../shared/frontend/sel-ui/src/theme/packs/developer-workbench/theme.css"),
  read("../../../shared/frontend/sel-ui/src/theme/packs/developer-workbench/modes/dark.css"),
  read("../../../shared/frontend/sel-ui/src/theme/packs/developer-workbench/modes/light.css"),
].join("\n");

test("AI Desktop 通过正式 Node 出口接入同一 SEL UI 源码", () => {
  assert.equal(selUiManifest.name, "@selplat/sel-ui");
  assert.equal(packageManifest.devDependencies["@selplat/sel-ui"], "file:../../shared/frontend/sel-ui");
  assert.equal(packageManifest.dependencies["@selplat/sel-ui"], undefined);
  for (const exportedPath of [
    "./theme/tokens",
    "./theme/contract",
    "./theme/states",
    "./theme/typography",
    "./theme/developer-workbench",
    "./theme/developer-workbench/dark",
    "./theme/developer-workbench/light",
  ]) {
    assert.ok(selUiManifest.exports[exportedPath], `缺少正式出口 ${exportedPath}`);
    assert.equal(selUiManifest.exports[exportedPath].types, "./src/theme/css.d.ts");
  }
  assert.match(themeAdapter, /@selplat\/sel-ui\/theme\/developer-workbench/);
  assert.ok(themeAdapter.indexOf('@selplat/sel-ui/theme/tokens') < themeAdapter.indexOf('@selplat/sel-ui/theme/contract'));
  assert.doesNotMatch(themeAdapter, /shared\/frontend\/sel-ui|\.\.\/\.\.\/\.\.\/shared/);
});

test("SELUI 中央登记的全部控件自动发布正式脚本和样式出口", () => {
  for (const component of selUiRegistry.components) {
    const exportName = component.id.replace(/^sel/, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    if (component.scripts.length) assert.ok(selUiManifest.exports[`./components/${exportName}`], `${component.id} 缺少脚本出口`);
    if (component.styles.length) assert.ok(selUiManifest.exports[`./components/${exportName}/styles`], `${component.id} 缺少样式出口`);
  }
  assert.equal(selUiManifest.scripts.prepare, "npm run sync:component-exports");
});

test("独立专题演化窗口通过 SELUI Tree 与 Grid 正式出口装配", () => {
  for (const exportedPath of [
    "@selplat/sel-ui/components/tooltip",
    "@selplat/sel-ui/components/tree",
    "@selplat/sel-ui/components/grid",
    "@selplat/sel-ui/components/search",
    "@selplat/sel-ui/components/disclosure",
  ]) assert.match(developerApp, new RegExp(exportedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(developerApp, /splitPane\.mount|PersonWorkspaceSplitPane/);
  assert.match(evolutionGrids, /grid\.create/);
  assert.match(evolutionGrids, /grid\.mount/);
  assert.match(evolutionGrids, /selGrid:selectionChange/);
  assert.match(evolutionGrids, /selGrid:queryChange/);
  assert.match(evolutionGrids, /selGrid:sortChange/);
  assert.match(evolutionGrids, /nodeId: `\$\{nodeId\}::sort`/);
  assert.match(evolutionGrids, /nodeId: `\$\{nodeId\}::columns`/);
  assert.match(evolutionGrids, /selGrid:columnResizeChange/);
  assert.match(evolutionGrids, /mode: "REMOTE"/);
  assert.match(selGrid, /selGrid:sortChange/);
  assert.match(selTree, /selTree:expandedChange/);
  assert.match(evolutionTree, /selTree:expandedChange/);
  assert.match(evolutionWorkspace, /nodeId: "__tree__"/);
  assert.match(selGrid, /data-sel-grid-role="search-host"/);
  assert.match(selGrid, /components\.search\?\.mount/);
  assert.match(selSearch, /function selSearchDestroy/);
  assert.match(entry, /evolution-workspace/);
  assert.match(developerApp, /EvolutionWorkspaceWindowApp/);
  assert.match(developerStyles, /\.evolution-window-shell/);
  assert.match(developerStyles, /\.evolution-proposal-grid-host/);
  assert.doesNotMatch(developerApp, /<aside className="dev-context">/);
});

test("南宫婉与韩立复用唯一独立专题演化窗口", () => {
  assert.match(preload, /desktop:open-evolution-workspace/);
  assert.match(preload, /desktop:evolution-workspace-location/);
  assert.match(desktopIpc, /let evolutionWorkspaceWindow: BrowserWindow \| null = null/);
  assert.match(desktopIpc, /evolutionWorkspaceWindow\.webContents\.send\("desktop:evolution-workspace-location"/);
  assert.match(desktopIpc, /evolutionWorkspaceWindow\.focus\(\)/);
  assert.match(desktopIpc, /evolutionWorkspaceLocationQuery\(location\)/);
  assert.match(electronMain, /let mainApplicationWindow: BrowserWindow \| null/);
  assert.doesNotMatch(electronMain, /BrowserWindow\.getAllWindows\(\)\.length === 0/);
  assert.match(developerApp, /openEvolutionWorkspace\(defaultEvolutionWorkspaceLocation\(evolutionWorkspacePerspective\)\)/);
  assert.doesNotMatch(developerStyles, /person-workspace-split-host|person-workspace-side-region/);
});

test("专题档案展开区只使用正式 SELUI Disclosure", () => {
  assert.ok(selUiManifest.exports["./components/disclosure"]);
  assert.ok(selUiManifest.exports["./components/disclosure/styles"]);
  assert.match(evolutionDisclosure, /components\?\.disclosure/);
  assert.match(evolutionDisclosure, /disclosure\.mount/);
  assert.match(evolutionDossier, /EvolutionDisclosure/);
  assert.doesNotMatch(evolutionDossier, /<(?:details|summary)\b/);
});

test("专题执行群只读聚合 SQLite 档案并跳回既有业务页面", () => {
  assert.match(evolutionWorkspace, /manual-group/);
  assert.match(evolutionWorkspace, /EvolutionTopicGroupView/);
  assert.match(evolutionTopicGroup, /getEvolutionTopicDossier/);
  assert.match(evolutionTopicGroup, /查看来源与研讨/);
  assert.match(evolutionTopicGroup, /查看审批/);
  assert.match(evolutionTopicGroup, /查看提案与任务/);
  assert.match(evolutionTopicGroup, /查看发布与验收/);
  assert.match(evolutionTopicGroup, /getEvolutionWorkbenchPreference/);
  assert.match(evolutionTopicGroup, /saveEvolutionWorkbenchPreference/);
  assert.match(evolutionTopicGroup, /全部标为已读/);
  assert.match(evolutionTopicGroup, /重新核对数据库/);
  assert.match(evolutionTopicGroup, /按人物筛选专题群/);
  assert.match(evolutionTopicGroup, /按类型筛选专题群/);
  assert.match(evolutionTopicGroup, /sendNangongConversationMessage/);
  assert.match(evolutionTopicGroup, /topicId: topic\.topicId/);
  assert.match(evolutionTopicGroup, /完整原话保存在人物对话库/);
  assert.doesNotMatch(evolutionTopicGroup, /decideEvolutionProposal|dispatchEvolutionProposal|controlEvolutionAutomation|createEvolutionProposal/);
});

test("确认、输入和提示交互只通过 SELUI 公共组件", () => {
  assert.match(entry, /<SelUiProvider>/);
  assert.match(selUiProvider, /@selplat\/sel-ui\/components\/confirm-dialog/);
  assert.match(selUiProvider, /@selplat\/sel-ui\/components\/window/);
  assert.match(developerApp, /tooltip\.attach/);
  assert.match(developerApp, /data-sel-tooltip/);
  assert.match(screenshotEditor, /useSelUi/);
  for (const source of [developerApp, screenshotEditor]) assert.doesNotMatch(source, /window\.(?:confirm|prompt)\(/);
  assert.doesNotMatch(developerApp, /data-tooltip/);
  assert.doesNotMatch(developerStyles, /content:\s*attr\(data-tooltip\)|\[data-tooltip\]/);
  assert.match(selWindow, /selWindow:close/);
  assert.match(selWindow, /destroy:\s*\(\)\s*=>/);
  assert.match(selUiProvider, /if \(pendingApprovalRef\.current\)[\s\S]*controller\.open\(\);[\s\S]*return pendingApprovalRef\.current\.promise/);
});

test("韩立与南宫婉共用 SELUI 对话和表单视觉", () => {
  assert.ok(selUiManifest.exports["./components/conversation"]);
  assert.ok(selUiManifest.exports["./components/conversation/styles"]);
  assert.ok(selUiManifest.exports["./components/form/styles"]);
  assert.match(selUiConversation, /api\.mount\(root/);
  assert.match(developerApp, /selConversationHanLiId/);
  assert.match(developerApp, /selConversationNangongWanId/);
  assert.match(conversationControl, /compositionstart/);
  assert.match(conversationControl, /event\.isComposing === true/);
  assert.match(conversationControl, /event\.keyCode === 229/);
  assert.doesNotMatch(developerApp, /onKeyDown=\{onKeyDown\}|event\.key === "Enter" && !event\.shiftKey/);
  assert.doesNotMatch(developerApp, /evolution-inline-editor|evolution-approval-editor/);
  assert.doesNotMatch(developerStyles, /\.dev-chat|\.dev-message|\.dev-composer|\.nangong-topic-draft-action|\.nangong-convert-action/);
  assert.match(realtimeConversation, /mergeRealtimeConversationTimeline/);
  assert.match(developerApp, /clientMessageId/);
  assert.match(developerApp, /mergeRealtimeConversationTimeline/);
  assert.doesNotMatch(developerApp, /outgoingPersistedMessageId|message\.messageId !== outgoingPersistedMessageId/);
});

test("锁文件依赖缓存迁移后重建本地公共包链接", () => {
  assert.match(dependencyCache, /export function repairLocalPackageLinks/);
  assert.match(dependencyCache, /metadata\?\.link !== true/);
  assert.match(dependencyCache, /targetRelative\.startsWith/);
  assert.match(dependencyPreparation, /repairLocalPackageLinks\(details\)/);
  const ordinaryAttachment = dependencyCache.slice(dependencyCache.indexOf("export function attachDependencyCache"), dependencyCache.indexOf("export function detachOwnedDependencyCache"));
  assert.doesNotMatch(ordinaryAttachment, /repairLocalPackageLinks/);
  assert.match(ordinaryAttachment, /createDependencyLink\(details\.dependencyRoot, details\.linkPath\)/);
  assert.match(dependencyRunner, /node-common-core[\s\S]*build-node-common\.mjs[\s\S]*sync-node-common-runtime\.mjs/);
});

test("React 首次渲染前应用 Developer 的 SEL UI 主题状态", () => {
  assert.match(themeAdapter, /developer-workbench/);
  assert.doesNotMatch(themeAdapter, /plain-minimal/);
  assert.match(themeAdapter, /root\.dataset\.selTheme = state\.theme/);
  assert.match(themeAdapter, /root\.dataset\.selMode = state\.mode/);
  assert.ok(entry.indexOf("applySelUiTheme()") < entry.indexOf("createRoot("));
});

test("Developer Workbench 主题只维护视觉令牌，不侵入应用布局", () => {
  assert.match(developerTheme, /data-sel-theme="developer-workbench"/);
  for (const token of [
    "--sel-theme-workbench-canvas",
    "--sel-theme-workbench-sidebar",
    "--sel-theme-workbench-surface",
    "--sel-theme-workbench-text",
    "--sel-theme-workbench-accent",
    "--sel-theme-workbench-overlay",
  ]) assert.match(developerTheme, new RegExp(`${token}:`));
  assert.doesNotMatch(developerTheme, /\.dev-/);
});

test("应用样式只保留布局，颜色与可读字号统一消费 SEL UI 令牌", () => {
  const rawColor = /#[0-9a-f]{3,8}\b|rgba?\(/i;
  const pixelText = /font-size:\s*[0-9]+px|font:\s*[0-9]+px\//;
  for (const [name, source] of [["developer", developerStyles]]) {
    assert.doesNotMatch(source, rawColor, `${name} 仍含应用私有颜色`);
    assert.doesNotMatch(source, pixelText, `${name} 仍含像素文字字号`);
    assert.match(source, /var\(--sel-theme-/);
  }
  assert.doesNotMatch(developerStyles, /--(?:line|panel|panel-2|cyan|violet)\s*:/);
});

test("登录主操作完整消费 SEL UI 令牌并保留可读文字节点", () => {
  assert.match(themeContract, /selThemeTokens\.css\?v=20260823-action-control-1/);
  assert.match(sharedTokens, /--sel-theme-action-height:\s*32px/);
  assert.match(sharedTokens, /--sel-theme-action-padding-inline:\s*13px/);
  const accountRule = developerStyles.match(/\.chatgpt-login-action, \.dev-account button[\s\S]*?\.status-card\.offline/)?.[0] || "";
  for (const token of [
    "--sel-theme-action-height",
    "--sel-theme-action-padding-inline",
    "--sel-theme-radius-control",
    "--sel-theme-font-size-body",
    "--sel-theme-font-weight-semibold",
    "--sel-theme-line-height-body",
    "--sel-theme-text-on-accent",
  ]) assert.match(accountRule, new RegExp(`var\\(${token}\\)`), `登录按钮缺少 ${token}`);
  assert.doesNotMatch(accountRule, /min-height:\s*32px|padding:\s*0 13px|border-radius:\s*6px|font-weight:\s*650/);
  assert.match(desktopChrome, /className="chatgpt-login-action primary"[\s\S]*?<span>\{label\}<\/span>/);
  assert.match(developerApp, /<ChatGPTLoginAction label=\{text\.signIn\}/);
});
