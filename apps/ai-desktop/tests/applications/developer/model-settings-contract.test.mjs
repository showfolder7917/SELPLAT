import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => readFileSync(path.join(appRoot, relativePath), "utf8");
const activeStableUserId = readFileSync(path.join(appRoot, "ruleengine/AGENTS.md"), "utf8").match(/当前稳定用户 ID：`([^`]+)`/u)?.[1];
assert.ok(activeStableUserId, "AGENTS.md 必须声明当前稳定用户 ID");
// 聚合公开入口及其领域协议正文，既验证唯一出口，也验证实际字段归属。
const contracts = [
  read("contracts/foundation/value/base.value.ts"),
  read("contracts/services/support/platform/settings/index.ts"),
  read("contracts/services/support/platform/settings/dto/settings.out.dto.ts"),
  read("contracts/services/support/platform/codex/index.ts"),
  read("contracts/services/support/platform/codex/dto/codex.out.dto.ts"),
].join("\n");
const store = read("electron/services/support/platform/settings/internal/settings.store.ts");
const fixedUiText = read("contracts/foundation/i18n/fixed-ui-text.ts");
const migratedFixedUi = [
  read("src/features/conversation/components/StreamDetails.tsx"),
  read("src/features/conversation/components/ManagedStageAction.tsx"),
  read("src/features/screenshot/components/ScreenshotEditor.tsx"),
  read("src/applications/developer/workspace/WorkspaceFilePreview.tsx"),
  read("src/applications/developer/model/useDeveloperApplicationController.ts"),
  read("src/applications/developer/model/createDeveloperViewModel.ts"),
  read("src/features/settings/model/createDeveloperSettingsViewModel.ts"),
  read("src/features/settings/model/settings-formatters.ts"),
  read("src/features/settings/model/useDesktopSettings.ts"),
  read("src/features/settings/components/SettingsFloatingPanel.tsx"),
  read("src/features/settings/model/useDesktopDiagnostics.ts"),
  read("src/applications/developer/explorer/CollaborationTaskNavigation.tsx"),
  read("src/applications/developer/explorer/OperatingModeSwitch.tsx"),
  read("src/applications/developer/explorer/SingleConversationTaskSummary.tsx"),
  read("src/applications/developer/explorer/TaskExplorerFeature.tsx"),
  read("src/applications/developer/explorer/WorkspaceExplorerFeature.tsx"),
  read("src/applications/developer/layout/DeveloperStatusBar.tsx"),
  read("src/applications/developer/model/createDeveloperWorkspaceRouterViewModel.ts"),
  read("src/applications/developer/model/useDeveloperSidebar.ts"),
  read("src/features/conversation/components/CodexConversationWorkspace/CodexConversationTimeline.tsx"),
  read("src/features/conversation/components/ConversationMessageImage.tsx"),
  read("src/features/conversation/model/useCodexWorkspace.ts"),
  read("src/features/conversation/model/useCodexInteractionRequests.ts"),
  read("src/features/conversation/model/useConversationDispatch.ts"),
  read("src/features/conversation/components/CollaborationStatusChain.tsx"),
].join("\n");
const collaborationFormatters = read("src/features/collaboration/model/collaboration-formatters.ts");
const service = read("electron/services/support/platform/codex/codex.facade.ts");
const collaboration = read("electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts");
const developer = [
  read("src/applications/developer/DeveloperApplication.tsx"),
  read("src/features/settings/components/DeveloperSettingsFeature.tsx"),
  read("src/features/settings/components/DeveloperSettingsView.tsx"),
  read("src/features/settings/model/createDeveloperSettingsViewModel.ts"),
  read("src/features/settings/model/useDesktopSettings.ts"),
].join("\n");
const interactionPreload = read("tests/interaction/isolated-preload.cjs");
const packageManifest = read("package.json");
const testDocumentRunner = read("scripts/test-document-runner.mjs");
const ruleIndex = read(`ruleengine/rules/local/${activeStableUserId}/selplat/应用/ai-desktop/RULE_INDEX.md`);
const harnessRule = [
  read(`ruleengine/rules/local/${activeStableUserId}/selplat/应用/ai-desktop/template/RUL_AIDesktopHarness工作区与运行时规则/requirements.md`),
  read(`ruleengine/rules/local/${activeStableUserId}/selplat/应用/ai-desktop/template/RUL_AIDesktop协作与自动化规则/requirements.md`),
].join("\n");

test("全局设置持久化默认模型、推理强度和速度，人物会话字段不进入设置协议", () => {
  assert.match(contracts, /"ja", "zh-CN", "en"/);
  assert.match(contracts, /defaultModel: string \| null/);
  assert.match(contracts, /reasoningEffort: ReasoningEffortValue \| null/);
  assert.match(contracts, /serviceTier: ModelServiceTierValue/);
  assert.match(store, /defaultModel: patch\.defaultModel/);
  assert.match(store, /DEFAULT_AI_DESKTOP_MODEL = "gpt-5\.6-terra"/);
  assert.match(store, /validModel\(value\.defaultModel\) \|\| DEFAULT_AI_DESKTOP_MODEL/);
  assert.doesNotMatch(contracts, /selectedModel/);
});

test("语言设置以独立状态保存并在读取失败时保留 Renderer 初始语言", () => {
  assert.match(developer, /localeSaving/);
  assert.match(developer, /localeSaveError/);
  assert.match(developer, /settingsReadRecovered/);
  assert.match(developer, /result\.source === "recovered"/);
  assert.match(fixedUiText, /fixedUiText/);
  assert.match(developer, /\.then\(\(settings\) => \{ applySettings\(settings\); setPendingLocale\(null\); \}\)/);
  assert.doesNotMatch(developer, /setLocale\(nextLocale\)/);
});

test("迁移范围内的固定界面只通过统一资源解析，不保留局部语言词典", () => {
  assert.match(migratedFixedUi, /fixedUiText/);
  assert.doesNotMatch(migratedFixedUi, /editorLabels|firstLabels|repeatLabels|const japanese|const chinese/);
  assert.doesNotMatch(migratedFixedUi, /locale === "ja" \? "ja" : "zh-CN"/);
  assert.match(fixedUiText, /CONTROLLED_MISSING_TEXT = "缺少固定界面文案"/);
  assert.match(fixedUiText, /resolveFixedUiText/);
  assert.doesNotMatch(migratedFixedUi, /developerApplicationLabels|testDataResetCopy/);
  assert.doesNotMatch(migratedFixedUi, /locale === "ja"/);
  assert.match(migratedFixedUi, /conversationAssistantHeader/);
  assert.match(migratedFixedUi, /conversationImagePreview/);
  assert.match(migratedFixedUi, /conversationCodexUnavailable/);
  assert.match(migratedFixedUi, /conversationWorkspaceMissing/);
  assert.match(migratedFixedUi, /conversationDiscardFailed/);
  assert.match(migratedFixedUi, /conversationLoginUnavailable/);
  assert.match(migratedFixedUi, /conversationClarificationSubmitFailed/);
  assert.match(migratedFixedUi, /conversationSupplementTaskFailed/);
  assert.match(migratedFixedUi, /conversationRecoverTaskFailed/);
  assert.match(migratedFixedUi, /error instanceof Error \? error\.message : fixedUiText/);
  assert.match(collaborationFormatters, /fixedUiText/);
  assert.match(collaborationFormatters, /collaborationTaskStateLabel[\s\S]*taskKeys/);
  assert.match(collaborationFormatters, /collaborationInProgress/);
  assert.doesNotMatch(collaborationFormatters, /CHINESE_|JAPANESE_|chineseLabels|japaneseLabels/);
  assert.match(fixedUiText, /collaborationInProgress: "进行中"/);
  assert.match(fixedUiText, /testDataClearFailed: "清空测试数据失败。"/);
  assert.match(fixedUiText, /testDataRestartFailed: "无法启动应用重启。"/);
});

test("Codex 桌面语料入库必须由显式开关控制并默认关闭", () => {
  assert.match(contracts, /codexAppCorpusIngestionEnabled: boolean/);
  assert.match(store, /codexAppCorpusIngestionEnabled: false/);
  assert.match(store, /value\.codexAppCorpusIngestionEnabled === true/);
  assert.match(store, /typeof patch\.codexAppCorpusIngestionEnabled === "boolean"/);
  assert.match(fixedUiText, /corpusTitle: "Codex 聊天训练入库"/);
  assert.match(developer, /ingestionEnabled: settings\.codexAppCorpusIngestionEnabled/);
  assert.match(developer, /aria-pressed=\{corpus\.ingestionEnabled\}/);
});

test("模型目录来自官方 app-server 并按模型能力渲染推理强度和速度", () => {
  assert.match(service, /#request\("model\/list", \{/);
  assert.match(service, /includeHidden: false/);
  assert.match(service, /model\.supported_reasoning_levels/);
  assert.match(service, /model\.service_tiers/);
  assert.match(service, /model\.additional_speed_tiers/);
  assert.match(service, /model\.display_name/);
  assert.match(service, /model\.slug/);
  assert.match(service, /supportedReasoningEfforts/);
  assert.match(service, /supportedServiceTiers/);
  assert.match(service, /serviceTiers/);
  assert.match(service, /additionalSpeedTiers/);
  assert.match(service, /supportsFastMode === true/);
  assert.match(contracts, /supportedServiceTiers: ModelServiceTierValue\[\]/);
  assert.match(developer, /model\.models\.map/);
  assert.match(developer, /supportedEfforts\.map/);
  assert.match(developer, /fastServiceTierSupported/);
  assert.match(developer, /modelCatalogStatus/);
  assert.match(fixedUiText, /modelCatalogAstraPresent: "已出现"/);
  assert.match(fixedUiText, /modelCatalogAstraMissing: "未出现"/);
  assert.match(fixedUiText, /modelCatalogFailed: "无法读取模型列表/);
  assert.match(developer, /const nextServiceTier = model\?\.supportedServiceTiers\?\.includes\(serviceTier\) \? serviceTier : "default"/);
  assert.match(developer, /selectedModel\?\.supportedServiceTiers\?\.includes\("fast"\) === true/);
  assert.match(interactionPreload, /supportedServiceTiers: \["default", "fast"\]/);
  assert.match(interactionPreload, /gpt-6-astra/);
  assert.match(interactionPreload, /setInteractionModelCatalogFailure/);
});

test("每轮主会话与协同连接读取同一份全局模型设置", () => {
  assert.match(service, /const modelSettings = this\.#options\.readSettings\(\)/);
  assert.match(service, /serviceTier: modelSettings\.serviceTier/);
  assert.match(service, /#assertModelSettingsSupported\(modelSettings, selectedModel\)/);
  assert.match(service, /不支持快速处理/);
  assert.match(collaboration, /readSettings: this\.#options\.readSettings/);
});

test("已确认的全局模型行为进入应用约束和当前用户规则索引链", () => {
  assert.match(harnessRule, /harness_global_model_settings_contract/);
  assert.match(harnessRule, /harness_default_model_contract = initialize_and_migrate_legacy_empty_default_to_gpt_5_6_terra/);
  assert.match(ruleIndex, /RUL_AIDesktop官方Harness接入规则\.md/);
});

test("模型设置静态核验使用应用包脚本且可纳入统一测试", () => {
  assert.match(packageManifest, /"test:model-settings": "node --test tests\/applications\/developer\/model-settings-contract\.test\.mjs"/);
  assert.match(testDocumentRunner, /"test:model-settings"/);
});
