import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => readFileSync(path.join(appRoot, relativePath), "utf8");
const service = read("electron/services/personas/hanli/internal/conversation/hanli-conversation.service.ts");
const runtime = read("electron/system/bootstrap/application-runtime.ts");
const ports = read("electron/services/personas/hanli/internal/application/hanli-application.ports.ts");
const memoryPort = read("contracts/services/support/capabilities/event-center/port/collaboration-memory.port.ts");
const ipc = read("electron/system/ipc/domains/register-collaboration-ipc.ts");
const preload = read("electron/system/preload/domains/collaboration-bridge.cts");
const model = read("src/features/conversation/model/usePersonaConversation.ts");
const workspace = read("src/features/hanli/components/HanliConversationWorkspace.tsx");
const conversationFacade = read("electron/services/personas/conversation/persona-conversation.facade.ts");
const codex = read("electron/services/support/platform/codex/codex.facade.ts");
const collaborationMemoryMethods = read("electron/services/support/capabilities/event-center/internal/projection/collaboration-memory-methods.ts");
const collaborationMemoryProxy = read("electron/services/support/capabilities/event-center/internal/projection/background-collaboration-memory.proxy.ts");
const collaborationMemoryWorker = read("electron/dao/corpus/internal/background-persistence.worker.ts");

test("韩立会话把线程恢复写入同一业务会话并通知窗口刷新", () => {
  assert.match(ports, /readThreadRecovery\(\): SendMessageOutDto\["threadRecovery"\]/);
  assert.match(runtime, /readThreadRecovery: \(\) => hanliConversationCodex!\.lastThreadRecovery\(\)/);
  assert.match(service, /await this\.#recordThreadRecovery\(conversationId, response\.threadRecovery, request\.clientMessageId\)/);
  assert.match(service, /catch \(error\) \{[\s\S]*?chat\.readThreadRecovery\(\)/);
  assert.match(service, /recordPersonaConversationRecovery/);
  assert.match(service, /onPersonaConversationChanged\?\.\(saved\)/);
});

test("恢复所需的人物记忆方法同时经过主进程代理与后台 Worker", () => {
  for (const method of ["readPersonaConversationCodexThread", "claimPersonaConversationCodexThread", "unlinkPersonaConversationCodexThread", "recordPersonaConversationRecovery"]) {
    assert.match(collaborationMemoryMethods, new RegExp(`"${method}"`));
  }
  assert.match(collaborationMemoryProxy, /isCollaborationMemoryMethod\(property\)/);
  assert.match(collaborationMemoryWorker, /new Set<string>\(collaborationMemoryMethodNames\)/);
  assert.match(collaborationMemoryWorker, /collaborationMemory\[method as keyof typeof collaborationMemory\]/);
});

test("打开韩立会话前准备恢复，并仅写入目标业务会话", () => {
  assert.match(service, /async prepareRecovery\(request\?: Pick<ReadPersonaConversationWindowInDto, "conversationId">\)[\s\S]*?memory\.readPersonaConversation\("han-li", request\?\.conversationId\)[\s\S]*?const linkedSession = await memory\.readPersonaConversationCodexThread\("han-li", conversation\.conversationId\)[\s\S]*?if \(!linkedSession\) \{[\s\S]*?未找到可验证的原线程关联；既有历史保持可读，未将其显示为已恢复。/);
  assert.match(service, /linkedSession[\s\S]*?chat\.recoverConversationSession\(linkedSession\)/);
  assert.match(service, /const saved = await this\.#recordThreadRecovery\(conversation\.conversationId, recovery\)[\s\S]*?const current = await memory\.readPersonaConversation\("han-li"\)[\s\S]*?current\.conversationId === conversation\.conversationId[\s\S]*?activateRecoveredConversationSession[\s\S]*?return saved \|\| conversation/);
  assert.doesNotMatch(service.match(/async prepareRecovery[\s\S]*?\n  }\n\n  /)?.[0] || "", /current\.conversationId !== conversation\.conversationId\) return current/);
  assert.match(runtime, /recoverConversationSession: \(session\) => hanliConversationCodex!\.recoverConversationSession\(session, workspaces\.read\(\), settings\.read\(\)\.locale\)/);
  assert.match(runtime, /activateRecoveredConversationSession: \(threadId\) => hanliConversationCodex!\.activateRecoveredConversationSession\(threadId, workspaces\.read\(\), settings\.read\(\)\.locale\)/);
  assert.doesNotMatch(service.match(/async prepareRecovery\(\)[\s\S]*?\n  }\n\n  /)?.[0] || "", /chat\.send/);
});

test("缺少历史线程关联时不借用人物当前线程", () => {
  const prepareRecovery = service.match(/async prepareRecovery[\s\S]*?\n  }\n\n  /)?.[0] || "";
  assert.match(prepareRecovery, /if \(!linkedSession\)[\s\S]*?verification-incomplete/);
  assert.doesNotMatch(prepareRecovery, /activeConversationSession\(/);
});

test("真正空白且无线程关联的韩立新会话不写入未核验恢复记录", () => {
  const prepareRecovery = service.match(/async prepareRecovery[\s\S]*?\n  }\n\n  /)?.[0] || "";
  assert.match(prepareRecovery, /if \(!linkedSession\) \{[\s\S]*?conversation\.messages\.length === 0\) return conversation[\s\S]*?verification-incomplete/);
});

test("恢复记录保留回合、条目与客户消息关联，并仅由可重试状态开放重试", () => {
  assert.match(service, /affectedMessageId,/);
  assert.match(memoryPort, /affectedMessageId\?: string \| null/);
  assert.match(workspace, /hanli-recovery-\$\{conversation\.recovery\.recoveryId\}/);
  assert.match(workspace, /data-recovery-affected/);
  assert.match(workspace, /conversation\.recovery\.retryable && <button[\s\S]*?重试恢复/);
  assert.match(model, /const retryRecovery = useCallback[\s\S]*?preparePersonaConversationRecovery/);
  assert.match(model, /acceptsConversationWindow\(generation, conversationId, window\)/);
});

test("恢复回执确定窗口目标，订阅与重试不会用旧会话覆盖当前页面", () => {
  assert.match(model, /async function readPreparedRecoveryWindow\([\s\S]*?receipt\?\.conversationId \|\| expectedConversationId/);
  assert.match(model, /expectedConversationId && conversationId !== expectedConversationId/);
  assert.match(model, /prepareRecovery\.then\(\(receipt\) => active[\s\S]*?readPreparedRecoveryWindow\(desktop, currentConversationId, receipt, generation\)/);
  assert.match(model, /targetConversationId = conversationDisplay\.current\.targetConversationId \?\? currentConversationId/);
  assert.match(model, /targetConversationId && value\.conversationId !== targetConversationId\) return;/);
  assert.match(model, /同一人物的其他会话更新不能抢占当前会话的恢复回执/);
  assert.match(model, /const window = await readPreparedRecoveryWindow\(desktop, conversationId, receipt, generation\)/);
});

test("unknown-turn、原线程缺失与普通恢复失败均保留可追溯恢复结论", () => {
  assert.match(codex, /status: "unknown-turn"[\s\S]*?affectedTurnId: startedTurnId/);
  assert.match(service, /catch \(error\) \{[\s\S]*?#recordThreadRecovery\(conversationId, chat\.readThreadRecovery\(\), request\.clientMessageId\)/);
  assert.match(codex, /status: "thread-unavailable"[\s\S]*?既有会话历史仍可阅读/);
  assert.match(codex, /status: "retryable"[\s\S]*?可保留原线程并重试恢复/);
  assert.match(workspace, /data-recovery-affected/);
});

test("韩立在模型发送前认领专属线程，并在失败时只补偿本次创建的线程", () => {
  const threadService = read("electron/services/personas/hanli/internal/conversation/hanli-conversation-thread.service.ts");
  assert.match(service, /this\.#threads\(\)\.run\("han-li", conversationId/);
  assert.doesNotMatch(service, /activeConversationSession\(|linkPersonaConversationCodexThread\(/);
  assert.match(threadService, /startDetachedConversationSession\(\)/);
  assert.match(threadService, /claimPersonaConversationCodexThread/);
  assert.match(threadService, /deleteDetachedConversationSession\(lease\.threadId\)/);
  assert.match(threadService, /unlinkPersonaConversationCodexThread/);
  assert.match(memoryPort, /claimPersonaConversationCodexThread[\s\S]*?unlinkPersonaConversationCodexThread/);
  assert.match(runtime, /let hanliConversationCodex: CodexService/);
  assert.match(runtime, /askHanli: async[\s\S]*?hanLiCodex!\.send/);
  assert.match(runtime, /conversation: \{[\s\S]*?hanliConversationCodex!\.send/);
});

test("页面显式准备恢复后才读取只读窗口", () => {
  assert.match(ipc, /desktop:prepare-persona-conversation-recovery[\s\S]*?request\?: Pick<ReadPersonaConversationWindowInDto, "conversationId">[\s\S]*?prepareConversationRecovery\(personaId, request\)/);
  assert.match(preload, /preparePersonaConversationRecovery: \(personaId: string, request\?: \{ conversationId\?: string \| null \}\) => invoke\("desktop:prepare-persona-conversation-recovery", personaId, request\)/);
  assert.match(model, /personaId === "han-li"[\s\S]*?preparePersonaConversationRecovery\(personaId, \{ conversationId: currentConversationId \}\)[\s\S]*?prepareRecovery\.then\(\(receipt\) => active/);
  assert.match(model, /preparePersonaConversationRecovery\(personaId, \{ conversationId \}\)/);
  assert.match(conversationFacade, /!handler\.prepareConversationRecovery && normalized === "han-li"[\s\S]*?韩立会话恢复处理器尚未就绪/);
});
