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
    "collaboration-memory.ts",
    "workflow.ts",
  ]) {
    assert.equal(existsSync(path.join(appRoot, "contracts", contract)), true, contract);
  }
  assert.doesNotMatch(source("contracts/collaboration.ts"), /from ["']\.\/desktop(?:\.js)?["']/);
  assert.match(source("contracts/desktop.ts"), /export \* from "\.\/desktop-api\.js"/);
});

test("all Electron IPC domains and renderer failures use the unified event boundary", () => {
  const helper = source("electron/ipc/event-center-ipc.ts");
  const desktopIpc = source("electron/ipc/register-desktop-ipc.ts");
  for (const domain of [
    "electron/ipc/domains/register-collaboration-ipc.ts",
    "electron/ipc/domains/register-settings-ipc.ts",
    "electron/ipc/domains/register-workspace-ipc.ts",
  ]) assert.match(source(domain), /registerEventCenterIpcHandler/);
  assert.match(helper, /ipcMain\.handle\(channel/);
  assert.doesNotMatch(desktopIpc, /ipcMain\.handle\(/);
  assert.match(desktopIpc, /desktop:renderer-exception/);
  assert.match(source("src/main.tsx"), /unhandledrejection/);
  assert.match(source("src/main.tsx"), /RendererErrorBoundary/);
  assert.match(source("electron/preload.cts"), /reportRendererException/);
});

test("Nangong memory keeps source, preview, free topic semantics and visible user intent", () => {
  const memory = source("electron/services/event-center/collaboration-memory-service.ts");
  const migration = source("db/sql/migration-0003-event-handling-and-collaboration-memory.sql");
  const archiveMigration = source("db/sql/migration-0004-codex-conversation-archive.sql");
  const backfill = source("scripts/backfill-codex-conversation.mjs");
  const main = source("electron/main.ts");
  const app = source("src/variants/developer/DeveloperApp.tsx");
  assert.match(migration, /content TEXT NOT NULL/);
  assert.match(migration, /contentPreview TEXT NOT NULL/);
  assert.match(migration, /inferredIntent TEXT/);
  assert.match(migration, /topicType TEXT NOT NULL/);
  assert.match(archiveMigration, /AiDesktopConversationArchiveMessage/);
  assert.match(archiveMigration, /contentRetention IN \('exact', 'preview-80'\)/);
  assert.match(backfill, /role === "user" \? rawContent : preview\(rawContent\)/);
  assert.match(backfill, /isPlatformContext/);
  assert.match(memory, /characters\.slice\(0, 80\)/);
  assert.match(memory, /AI登记的用户意图/);
  assert.match(main, /我了解到您的想法是/);
  assert.match(main, /NANGONG_TOPIC_META=.*userIntent/);
  assert.match(app, /我了解到您的想法是/);
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
