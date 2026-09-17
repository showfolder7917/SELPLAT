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
const conversationContractIndex = read("contracts/services/personas/conversation/index.ts");
const collaborationMemoryPort = read("contracts/services/support/capabilities/event-center/port/collaboration-memory.port.ts");
const repository = read("electron/services/support/capabilities/conversation/internal/persona-conversation.repository.ts");
const migration = read("db/sql/migration-1025-add-persona-conversation-model.sql");
const messageTypeMigration = read("db/sql/migration-1027-add-persona-conversation-message-type.sql");
const customerDisplayMigration = read("db/sql/migration-1029-add-persona-customer-display-message.sql");
const customerDisplayVersionMigration = read("db/sql/migration-1030-version-persona-customer-display-message.sql");
const loadOrder = read("db/sql/load-order.txt");
const runtime = read("electron/system/bootstrap/application-runtime.ts");
const codex = read("electron/services/support/platform/codex/codex.facade.ts");
const hook = read("src/features/conversation/model/usePersonaConversation.ts");
const modelCatalog = read("src/foundation/model-catalog.ts");
const hanli = read("src/features/hanli/components/HanliConversationWorkspace.tsx");
const hanliService = read("electron/services/personas/hanli/internal/conversation/hanli-conversation.service.ts");
const hanliAggregate = read("electron/services/personas/hanli/domain/hanli-conversation.aggregate.ts");
const hanliMethodContext = read("electron/services/personas/hanli/internal/conversation/hanli-method-context.ts");
const nangong = read("src/features/nangong/components/NangongConversationWorkspace.tsx");
const nangongService = read("electron/services/personas/nangong/internal/conversation/nangong-conversation.service.ts");
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

test("人物会话消息以持久化类型投影，恢复记录不再依赖 ID 前后缀", () => {
  const projector = read("src/features/conversation/model/realtime-conversation.ts");
  const inquiry = read("electron/services/personas/hanli/internal/conversation/hanli-inquiry.service.ts");
  assert.match(conversationContract, /PersonaConversationMessageTypeValue = "customer-visible" \| "internal-recovery" \| "internal-deliberation"/);
  assert.match(messageTypeMigration, /ADD COLUMN messageType TEXT NOT NULL DEFAULT 'customer-visible'/);
  assert.match(messageTypeMigration, /messageType = 'internal-recovery'/);
  assert.match(projector, /message\.messageType === "customer-visible"/);
  assert.match(projector, /message\.messageType === "internal-deliberation"/);
  assert.doesNotMatch(projector, /startsWith\("internal:"\)|endsWith\(":assessment"\)/);
  assert.match(inquiry, /appendPersonaRecoveryCheckpoint/);
  assert.match(inquiry, /appendPersonaCustomerMessage/);
  assert.doesNotMatch(inquiry, /:assessment/);
  assert.doesNotMatch(read("electron/services/personas/hanli/internal/conversation/hanli-inquiry-checkpoint.ts"), /messageId\.startsWith/);
});

test("工作流重复进展只能原位更新既有内部消息", () => {
  const memory = read("electron/services/support/capabilities/event-center/internal/projection/collaboration-memory.service.ts");
  const writer = read("electron/services/support/capabilities/conversation/internal/persona-conversation-message.writer.ts");
  assert.match(collaborationMemoryPort, /updatePersonaInternalProgress\(input: \{[\s\S]*?messageId: string;[\s\S]*?updatedAt: string;[\s\S]*?\}\): PersonaConversationOutDto/);
  assert.match(memory, /updatePersonaInternalProgress\(input:[\s\S]*?existing\.messageType !== "internal-deliberation"[\s\S]*?不能原位更新/);
  assert.match(memory, /writePersonaConversationMessage\([\s\S]*?"update"/);
  assert.match(writer, /existing\?\.sequenceNumber \?\? Number\(maximum\.value\) \+ 1/);
});

test("客户显示正文由唯一派生端口供应，页面、后续上下文和当前观点不能回退原始混合正文", () => {
  assert.match(customerDisplayMigration, /CREATE TABLE AiDesktopPersonaCustomerDisplayMessage/);
  assert.match(customerDisplayMigration, /displayState TEXT NOT NULL CHECK \(displayState IN \('ready', 'excluded', 'missing', 'failed'\)\)/);
  assert.match(loadOrder, /migration-1029-add-persona-customer-display-message\.sql/);
  assert.match(loadOrder, /migration-1030-version-persona-customer-display-message\.sql/);
  assert.match(customerDisplayVersionMigration, /ADD COLUMN derivationVersion INTEGER NOT NULL DEFAULT 1/);
  assert.match(repository, /readCustomerDisplayWindow\(/);
  assert.match(repository, /readCustomerDisplay\(/);
  assert.match(repository, /retryCustomerDisplayMessage\(/);
  assert.doesNotMatch(repository, /readWindow\(/);
  assert.match(repository, /PERSONA_CUSTOMER_DISPLAY_DERIVATION_VERSION/);
  assert.match(repository, /writePersonaCustomerDisplayMessage/);
  assert.match(runtime, /readPersonaCustomerDisplayWindow\(personaId, request\)/);
  assert.match(hanliService, /readPersonaCustomerDisplayConversation\("han-li", conversation\.conversationId\)/);
  assert.match(hanliService, /buildHanliRecentConversation\(customerDisplayConversation\.messages\)/);
  assert.match(hanliAggregate, /customerDisplayMessages: PersonaConversationMessageOutDto\[\]/);
  assert.match(hanliAggregate, /this\.#customerDisplayMessages/);
  assert.match(hanliAggregate, /currentMessage\.customerDisplayState !== "ready"/);
  assert.match(hanliMethodContext, /message\.customerDisplayState === "ready"/);
  assert.match(hook, /客户显示消息窗口读取能力尚未就绪/);
  assert.doesNotMatch(hook, /const conversation = await desktop\.getPersonaConversation\(personaId\)/);
  assert.match(hook, /新建人物会话后无法读取客户显示消息/);
  assert.match(hook, /保存人物对话模型后无法读取客户显示消息/);
  assert.doesNotMatch(hook, /setConversation\(value\)/);
  assert.match(hanli, /customerDisplayState === "missing"/);
  assert.match(hanli, /重新读取/);
  assert.match(hook, /retryingCustomerDisplayMessageIds/);
  assert.match(hook, /retryingCustomerDisplayMessageIdsRef\.current\.has\(sourceMessageId\)/);
  assert.match(hanli, /disabled=\{controller\.retryingCustomerDisplayMessageIds\.has\(message\.messageId\)\}/);
  assert.match(hanli, /aria-busy=\{controller\.retryingCustomerDisplayMessageIds\.has\(message\.messageId\)\}/);
});

test("新建人物会话以显示代际拒绝迟到窗口，并仅在南宫婉页面提供专用重试", () => {
  const nangongView = read("src/features/nangong/components/NangongConversationWorkspace.tsx");
  assert.match(hook, /conversationDisplay = useRef\(\{ generation: 0, targetConversationId: null as string \| null \}\)/);
  assert.match(hook, /function beginConversationDisplayGeneration\(targetConversationId: string \| null\)/);
  assert.match(hook, /function acceptsConversationWindow\([\s\S]*?generation[\s\S]*?expectedConversationId[\s\S]*?window: PersonaConversationWindowOutDto/);
  assert.match(hook, /const generation = beginConversationDisplayGeneration\(null\);/);
  assert.match(hook, /conversationDisplay\.current = \{ generation, targetConversationId: value\.conversationId \};/);
  assert.match(hook, /if \(!acceptsConversationWindow\(generation, value\.conversationId, customerDisplay\)\) return;/);
  assert.match(hook, /const \[newConversationError, setNewConversationError\] = useState\(""\)/);
  assert.match(hook, /setNewConversationError\(readableDesktopError\(reason, "无法新建人物会话。"\)\)/);
  assert.match(hook, /newConversationError, error, setError, startNewConversation/);
  assert.match(nangongView, /props\.runtime\.newConversationError/);
  assert.match(nangongView, /重新建立南宫婉对话/);
  assert.match(nangongView, /props\.runtime\.startNewConversation\(\)/);
});

test("内部研讨正文与技术证据使用不同内容角色，且证据只在南宫婉页面折叠显示", () => {
  const projector = read("src/features/conversation/model/realtime-conversation.ts");
  const nangongController = read("src/features/nangong/components/useNangongConversationWorkspace.ts");
  const nangongView = read("src/features/nangong/components/NangongConversationWorkspace.tsx");
  const memory = read("electron/services/support/capabilities/event-center/internal/projection/collaboration-memory.service.ts");
  assert.match(conversationContract, /PersonaConversationContentRoleValue = "conversation" \| "technical-evidence"/);
  assert.match(conversationContractIndex, /PersonaConversationContentRoleValue/);
  assert.match(collaborationMemoryPort, /appendPersonaInternalMessage\(input: \{[\s\S]*?contentRole\?: PersonaConversationContentRoleValue[\s\S]*?\}\): PersonaConversationOutDto/);
  assert.match(loadOrder, /migration-1028-add-persona-conversation-content-role\.sql/);
  assert.match(nangongController, /\(message\.contentRole \|\| "conversation"\) === "conversation"/);
  assert.match(nangongController, /item\.contentRole === "technical-evidence"/);
  assert.match(nangongView, /SelUiDisclosure/);
  assert.match(memory, /contentRole: "technical-evidence"/);
  assert.match(projector, /message\.messageType === "internal-deliberation"/);
});

test("人物普通发送失败后保留稳定客户消息编号并提供同编号重试", () => {
  const hanliController = read("src/features/hanli/components/useHanliConversationWorkspace.ts");
  const nangongController = read("src/features/nangong/components/useNangongConversationWorkspace.ts");
  const hanliView = read("src/features/hanli/components/HanliConversationWorkspace.tsx");
  const nangongView = read("src/features/nangong/components/NangongConversationWorkspace.tsx");
  assert.match(hanliController, /async function retrySend\(\)/);
  assert.match(hanliController, /await send\(pending\)/);
  assert.match(nangongController, /async function retrySend\(\)/);
  assert.match(nangongController, /await sendChat\(undefined, outgoingMessage\)/);
  assert.match(hanliView, /重试发送/);
  assert.match(nangongView, /重试发送/);
});

test("韩立和南宫婉各自从会话头读取模型并将实际模型传给 Harness", () => {
  assert.match(runtime, /hanLiCodex!\.send\([\s\S]*?, selectedModel\)/);
  assert.match(runtime, /nangongCodex!\.send\([\s\S]*?, selectedModel\)/);
  assert.match(nangongService, /await this\.#memory\.readPersonaConversation\("nangong-wan", state\.conversation\.conversationId\)/);
  assert.match(nangongService, /memoryConversation\?\.selectedModel \|\| null/);
  assert.match(runtime, /nangongConversationWithSelectedModel/);
  assert.match(runtime, /collaborationMemory\.syncEvolutionState\(nextState\)/);
  assert.match(runtime, /const activeConversation = await collaborationMemory\.readPersonaConversation\("nangong-wan"\)/);
  assert.match(runtime, /activeConversation\.conversationId !== conversation\.conversationId/);
  assert.match(codex, /const effectiveModel = await this\.#assertModelSettingsSupported\(modelSettings, selectedModel\)/);
  assert.match(codex, /selectedModel\?\.trim\(\) \|\| settings\.defaultModel/);
  assert.match(codex, /effort: modelSettings\.reasoningEffort/);
  assert.match(codex, /serviceTier: modelSettings\.serviceTier/);
});

test("只有韩立和南宫婉输入区使用官方模型目录", () => {
  assert.match(hook, /loadOfficialModelCatalog\(\)/);
  assert.match(modelCatalog, /getOptionalCodexDesktopApi\(\)/);
  assert.match(modelCatalog, /desktop\.getCodexModels\(\)/);
  assert.match(hanli, /modelCatalog/);
  assert.match(hanli, /selectModel/);
  assert.match(hanli, /<HanliCustodySwitch[\s\S]*selconversation-model-picker/);
  assert.match(hanli, /跟随默认模型/);
  assert.doesNotMatch(hanli, /当前会话模型：|使用设置页默认模型|未知/);
  assert.match(nangong, /modelCatalog/);
  assert.match(nangong, /selectModel/);
  assert.match(nangong, /selconversation-tools[\s\S]*selconversation-model-picker/);
  assert.match(nangong, /重新读取模型/);
  assert.doesNotMatch(nangong, /当前会话模型：|使用设置页默认模型|未知/);
  assert.match(codex, /stringValue\(model\.slug\)/);
  assert.match(codex, /stringValue\(model\.display_name\)/);
  assert.match(codex, /model\.supported_reasoning_levels/);
  assert.match(harnessRule, /hanli_and_nangong_persona_conversation_selected_model_override/);
  assert.doesNotMatch(linghu, /selectedModel/);
});
