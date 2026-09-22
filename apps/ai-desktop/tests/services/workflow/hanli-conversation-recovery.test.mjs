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

test("韩立会话把线程恢复写入同一业务会话并通知窗口刷新", () => {
  assert.match(ports, /readThreadRecovery\(\): SendMessageOutDto\["threadRecovery"\]/);
  assert.match(runtime, /readThreadRecovery: \(\) => hanLiCodex!\.lastThreadRecovery\(\)/);
  assert.match(service, /await this\.#recordThreadRecovery\(conversationId, response\.threadRecovery\)/);
  assert.match(service, /catch \(error\) \{[\s\S]*?chat\.readThreadRecovery\(\)/);
  assert.match(service, /recordPersonaConversationRecovery/);
  assert.match(service, /onPersonaConversationChanged\?\.\(saved\)/);
});

test("打开韩立会话前准备恢复，并仅写入仍活动的同一业务会话", () => {
  assert.match(service, /async prepareRecovery\(\)[\s\S]*?const linkedSession = await memory\.readPersonaConversationCodexThread\("han-li", conversation\.conversationId\)[\s\S]*?if \(!linkedSession\) return conversation/);
  assert.match(service, /linkedSession[\s\S]*?chat\.recoverConversationSession\(linkedSession\)/);
  assert.match(service, /const current = await memory\.readPersonaConversation\("han-li"\)[\s\S]*?current\.conversationId !== conversation\.conversationId[\s\S]*?activateRecoveredConversationSession/);
  assert.match(service, /#recordThreadRecovery\(conversation\.conversationId, recovery\)/);
  assert.match(runtime, /recoverConversationSession: \(session\) => hanLiCodex!\.recoverConversationSession\(session, workspaces\.read\(\), settings\.read\(\)\.locale\)/);
  assert.match(runtime, /activateRecoveredConversationSession: \(threadId\) => hanLiCodex!\.activateRecoveredConversationSession\(threadId, workspaces\.read\(\), settings\.read\(\)\.locale\)/);
  assert.doesNotMatch(service.match(/async prepareRecovery\(\)[\s\S]*?\n  }\n\n  /)?.[0] || "", /chat\.send/);
});

test("韩立完成回合后把实际 Codex 线程绑定到同一业务会话", () => {
  assert.match(service, /const session = chat\.activeConversationSession\(\)[\s\S]*?response\.threadId \|\| session\.threadId/);
  assert.match(service, /await memory\.linkPersonaConversationCodexThread\(\{[\s\S]*?conversationId[\s\S]*?workspaceSignature: session\.workspaceSignature/);
  assert.match(memoryPort, /readPersonaConversationCodexThread[\s\S]*?linkPersonaConversationCodexThread/);
});

test("页面显式准备恢复后才读取只读窗口", () => {
  assert.match(ipc, /desktop:prepare-persona-conversation-recovery[\s\S]*?prepareConversationRecovery/);
  assert.match(preload, /preparePersonaConversationRecovery: \(personaId: string\) => invoke\("desktop:prepare-persona-conversation-recovery"/);
  assert.match(model, /personaId === "han-li"[\s\S]*?preparePersonaConversationRecovery\(personaId\)[\s\S]*?prepareRecovery\.then\(\(\) => readPersonaConversationWindow/);
});
