import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("application-private contracts are domain modules outside shared", () => {
  assert.equal(existsSync(path.join(appRoot, "shared")), false);
  for (const contract of [
    "base.ts",
    "workspace.ts",
    "codex-stream.ts",
    "conversation.ts",
    "codex.ts",
    "settings.ts",
    "screenshot.ts",
    "audit.ts",
    "desktop-api.ts",
    "nangong-evolution.ts",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "contracts", contract)), true, contract);
  }
  assert.doesNotMatch(source("contracts/collaboration.ts"), /from ["']\.\/desktop(?:\.js)?["']/);
  assert.match(source("contracts/desktop.ts"), /export \* from "\.\/desktop-api\.js"/);
});

test("renderer feature logic is no longer owned by the developer shell", () => {
  const developerApp = source("src/variants/developer/DeveloperApp.tsx");
  assert.doesNotMatch(developerApp, /function applyCodexStreamEvent/);
  assert.doesNotMatch(developerApp, /function readStoredChat/);
  assert.match(developerApp, /features\/conversation\/model\/chat-message/);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/geometry/annotation-geometry.ts")), true);
  assert.equal(existsSync(path.join(appRoot, "src/features/screenshot/canvas/annotation-renderer.ts")), true);
});

test("main-process orchestration delegates IPC and pure collaboration parsing", () => {
  const ipcSource = source("electron/ipc/register-desktop-ipc.ts");
  assert.match(ipcSource, /registerSettingsIpc\(/);
  assert.match(ipcSource, /registerWorkspaceIpc\(/);
  assert.match(ipcSource, /registerCollaborationIpc\(/);
  assert.match(source("electron/services/codex-service.ts"), /codex\/stream-event-mapper/);
  assert.match(source("electron/services/collaboration/collaboration-codex-sessions.ts"), /review\/review-decision-parser/);
  assert.match(source("electron/services/collaboration/collaboration-coordinator.ts"), /result\/result-summary/);
  assert.match(source("electron/ipc/domains/register-collaboration-ipc.ts"), /NangongEvolutionFacade/);
  assert.match(source("electron/services/collaboration/nangong-evolution-facade.ts"), /evolutionProposalId/);
});
