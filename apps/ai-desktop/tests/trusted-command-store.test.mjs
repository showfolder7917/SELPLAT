import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { TrustedCommandStore } from "../electron/services/platform/security/internal/trusted-command.store.ts";
import { controlledTestRoot } from "./test-paths.mjs";

const controlledTempRoot = controlledTestRoot;
mkdirSync(controlledTempRoot, { recursive: true });

test("允许项目命令后自动信任，脚本变化或高风险命令仍要求审批", () => {
  const projectRoot = mkdtempSync(path.join(controlledTempRoot, "trusted-command-test-"));
  try {
    const appRoot = path.join(projectRoot, "apps", "sample");
    mkdirSync(appRoot, { recursive: true });
    const manifestPath = path.join(appRoot, "package.json");
    writeFileSync(manifestPath, JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
    const workspace = { primaryId: "root", roots: [{ id: "root", name: "project", path: projectRoot, permission: "workspace-write" }] };
    const store = new TrustedCommandStore(path.join(projectRoot, "user-data", "trusted-project-commands.json"));
    const command = '/bin/zsh -lc "npm run test"';

    assert.equal(store.isTrusted(command, appRoot, workspace).trusted, false);
    assert.equal(store.trust(command, appRoot, workspace).trusted, true);
    assert.equal(store.isTrusted(command, appRoot, workspace).trusted, true);
    assert.equal(store.count(), 1);

    assert.equal(store.trustAutomaticTestDocument(appRoot, workspace).trusted, false);
    assert.equal(store.isTrusted("npm run test:document", appRoot, workspace).trusted, false);
    writeFileSync(manifestPath, JSON.stringify({ scripts: { test: "node --test", "test:document": "node scripts/test-document-runner.mjs" } }), "utf8");
    assert.equal(store.trustAutomaticTestDocument(appRoot, workspace).trusted, true);
    assert.equal(store.isTrusted("npm run test:document", appRoot, workspace).trusted, true);
    assert.equal(store.isTrusted("/bin/zsh -lc 'npm run test:document'", appRoot, workspace).trusted, true);
    assert.equal(store.isTrusted("/bin/zsh -lc 'npm run test:document -- --task=dynamic'", appRoot, workspace).trusted, false);
    assert.equal(store.isTrusted("/bin/zsh -lc 'npm run test:document && npm run start'", appRoot, workspace).trusted, false);

    writeFileSync(manifestPath, JSON.stringify({ scripts: { test: "node --test --test-reporter=spec" } }), "utf8");
    assert.equal(store.isTrusted(command, appRoot, workspace).trusted, false);
    assert.equal(store.canTrust("sudo npm run test", appRoot, workspace), false);
    assert.equal(store.canTrust("rm -rf temp", appRoot, workspace), false);
    assert.equal(store.canTrust('/bin/zsh -lc "rm -rf temp"', appRoot, workspace), false);
    assert.equal(store.canTrust('powershell -Command "Remove-Item temp -Recurse"', appRoot, workspace), false);

    store.clear();
    assert.equal(store.count(), 0);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
