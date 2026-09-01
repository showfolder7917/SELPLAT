import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(appRoot, relativePath), "utf8");
// 聚合公开入口及其领域协议正文，既验证唯一出口，也验证实际字段归属。
const contracts = [
  read("contracts/foundation/base.ts"),
  read("contracts/platform/settings/index.ts"),
  read("contracts/platform/settings/settings.ts"),
  read("contracts/platform/codex/index.ts"),
  read("contracts/platform/codex/codex.ts"),
].join("\n");
const store = read("electron/services/support/platform/settings/internal/settings.store.ts");
const service = read("electron/services/support/platform/codex/codex.facade.ts");
const collaboration = read("electron/services/support/capabilities/conversation/internal/collaboration-codex-sessions.ts");
const developer = read("src/variants/developer/DeveloperApp.tsx");
const interactionPreload = read("tests/interaction/isolated-preload.cjs");
const packageManifest = read("package.json");
const testDocumentRunner = read("scripts/test-document-runner.mjs");
const ruleIndex = read("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/RULE_INDEX.md");
const harnessRule = [
  read("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop官方Harness接入规则.md"),
  read("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktopHarness工作区与运行时规则.md"),
  read("ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop协作与自动化规则.md"),
].join("\n");

test("全局设置持久化模型、推理强度和速度且不提供会话覆盖字段", () => {
  assert.match(contracts, /defaultModel: string \| null/);
  assert.match(contracts, /reasoningEffort: ReasoningEffort \| null/);
  assert.match(contracts, /serviceTier: ModelServiceTier/);
  assert.match(store, /defaultModel: patch\.defaultModel/);
  assert.match(store, /DEFAULT_AI_DESKTOP_MODEL = "gpt-5\.6-terra"/);
  assert.match(store, /validModel\(value\.defaultModel\) \|\| DEFAULT_AI_DESKTOP_MODEL/);
  assert.doesNotMatch(contracts, /sessionModel|conversationModel/);
});

test("Codex 桌面语料入库必须由显式开关控制并默认关闭", () => {
  assert.match(contracts, /codexAppCorpusIngestionEnabled: boolean/);
  assert.match(store, /codexAppCorpusIngestionEnabled: false/);
  assert.match(store, /value\.codexAppCorpusIngestionEnabled === true/);
  assert.match(store, /typeof patch\.codexAppCorpusIngestionEnabled === "boolean"/);
  assert.match(developer, /Codex 聊天训练入库/);
  assert.match(developer, /aria-pressed=\{codexAppCorpusIngestionEnabled\}/);
});

test("模型目录来自官方 app-server 并按模型能力渲染推理强度和速度", () => {
  assert.match(service, /#request\("model\/list", \{ includeHidden: false \}\)/);
  assert.match(service, /supportedReasoningEfforts/);
  assert.match(service, /supportedServiceTiers/);
  assert.match(service, /serviceTiers/);
  assert.match(service, /additionalSpeedTiers/);
  assert.match(service, /supportsFastMode === true/);
  assert.match(contracts, /supportedServiceTiers: ModelServiceTier\[\]/);
  assert.match(developer, /modelCatalog\.models\.map/);
  assert.match(developer, /supportedEfforts\.map/);
  assert.match(developer, /fastServiceTierSupported/);
  assert.match(developer, /const nextServiceTier = model\?\.supportedServiceTiers\?\.includes\(serviceTier\) \? serviceTier : "default"/);
  assert.match(developer, /selectedModel\?\.supportedServiceTiers\?\.includes\("fast"\) === true/);
  assert.match(interactionPreload, /supportedServiceTiers: \["default", "fast"\]/);
});

test("每轮主会话与协同连接读取同一份全局模型设置", () => {
  assert.match(service, /const modelSettings = this\.#options\.readSettings\(\)/);
  assert.match(service, /serviceTier: modelSettings\.serviceTier/);
  assert.match(service, /#assertModelSettingsSupported\(modelSettings\)/);
  assert.match(service, /不支持快速处理/);
  assert.match(collaboration, /readSettings: this\.#options\.readSettings/);
});

test("已确认的全局模型行为进入应用约束和当前用户规则索引链", () => {
  assert.match(harnessRule, /harness_global_model_settings_contract/);
  assert.match(harnessRule, /harness_default_model_contract = initialize_and_migrate_legacy_empty_default_to_gpt_5_6_terra/);
  assert.match(ruleIndex, /RUL_AIDesktop官方Harness接入规则\.md/);
});

test("模型设置静态核验使用应用包脚本且可纳入统一测试", () => {
  assert.match(packageManifest, /"test:model-settings": "node --test tests\/model-settings-contract\.test\.mjs"/);
  assert.match(testDocumentRunner, /"test:model-settings"/);
});
