import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => readFileSync(path.join(appRoot, relativePath), "utf8");
const activeStableUserId = read("ruleengine/AGENTS.md").match(/当前稳定用户 ID：`([^`]+)`/u)?.[1];
assert.ok(activeStableUserId, "AGENTS.md 必须声明当前稳定用户 ID");

const conversationContract = read("contracts/services/personas/conversation/dto/persona-conversation.out.dto.ts");
const repository = read("electron/services/support/capabilities/conversation/internal/persona-conversation.repository.ts");
const migration = read("db/sql/migration-1025-add-persona-conversation-model.sql");
const loadOrder = read("db/sql/load-order.txt");
const runtime = read("electron/system/bootstrap/application-runtime.ts");
const codex = read("electron/services/support/platform/codex/codex.facade.ts");
const hook = read("src/features/conversation/model/usePersonaConversation.ts");
const hanli = read("src/features/hanli/components/HanliConversationWorkspace.tsx");
const nangong = read("src/features/nangong/components/NangongConversationWorkspace.tsx");
const linghu = read("src/features/linghu/components/LinghuAutomationPanel.tsx");
const harnessRule = read(`ruleengine/rules/local/${activeStableUserId}/selplat/应用/ai-desktop/rule/RUL_AIDesktop协作与自动化规则.md`);

test("人物会话头以可空 selectedModel 保存并迁移既有数据", () => {
  assert.match(conversationContract, /selectedModel\?: string \| null/);
  assert.match(migration, /ALTER TABLE AiDesktopPersonaConversation ADD COLUMN selectedModel TEXT/);
  assert.match(loadOrder, /migration-1025-add-persona-conversation-model\.sql/);
  assert.match(repository, /SELECT conversationId, selectedModel, createdAt, updatedAt/);
  assert.match(repository, /selectedModel=COALESCE\(excluded\.selectedModel, AiDesktopPersonaConversation\.selectedModel\)/);
  assert.match(repository, /selectModel\(ownerPersonaId: string, conversationId: string, selectedModel: string \| null\)/);
});

test("韩立和南宫婉各自从会话头读取模型并将实际模型传给 Harness", () => {
  assert.match(runtime, /hanLiCodex!\.send\([\s\S]*?, selectedModel\)/);
  assert.match(runtime, /nangongCodex!\.send\([\s\S]*?, selectedModel\)/);
  assert.match(runtime, /readPersonaConversation\("nangong-wan", conversationId\)\.selectedModel/);
  assert.match(runtime, /nangongConversationWithSelectedModel/);
  assert.match(codex, /const effectiveModel = await this\.#assertModelSettingsSupported\(modelSettings, selectedModel\)/);
  assert.match(codex, /selectedModel\?\.trim\(\) \|\| settings\.defaultModel/);
  assert.match(codex, /effort: modelSettings\.reasoningEffort/);
  assert.match(codex, /serviceTier: modelSettings\.serviceTier/);
});

test("只有韩立和南宫婉输入区使用官方模型目录", () => {
  assert.match(hook, /getOptionalCodexDesktopApi\(\)/);
  assert.match(hook, /codex\.getCodexModels\(\)/);
  assert.match(hanli, /modelCatalog/);
  assert.match(hanli, /selectModel/);
  assert.match(hanli, /当前会话模型：\{selectedModelLabel\}/);
  assert.match(nangong, /modelCatalog/);
  assert.match(nangong, /selectModel/);
  assert.match(nangong, /当前会话模型：\{selectedModelLabel\}/);
  assert.match(harnessRule, /hanli_and_nangong_persona_conversation_selected_model_override/);
  assert.doesNotMatch(linghu, /selectedModel/);
});
