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

test("韩立会话把线程恢复写入同一业务会话并通知窗口刷新", () => {
  assert.match(ports, /readThreadRecovery\(\): SendMessageOutDto\["threadRecovery"\]/);
  assert.match(runtime, /readThreadRecovery: \(\) => hanLiCodex!\.lastThreadRecovery\(\)/);
  assert.match(service, /await this\.#recordThreadRecovery\(conversationId, response\.threadRecovery\)/);
  assert.match(service, /catch \(error\) \{[\s\S]*?chat\.readThreadRecovery\(\)/);
  assert.match(service, /recordPersonaConversationRecovery/);
  assert.match(service, /onPersonaConversationChanged\?\.\(saved\)/);
});
