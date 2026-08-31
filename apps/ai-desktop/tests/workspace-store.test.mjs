import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { WorkspaceStore } from "../../../build/ai-desktop/electron/electron/services/platform/workspace/internal/workspace.store.js";
import { createSandboxPolicy } from "../../../build/ai-desktop/electron/electron/services/platform/codex/codex.facade.js";
import { controlledTestRoot } from "./test-paths.mjs";

test("workspace profiles validate, deduplicate, persist, and enforce lifecycle constraints", () => {
  const managedTempRoot = controlledTestRoot;
  mkdirSync(managedTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(managedTempRoot, "workspace-store-test-"));
  try {
    const primaryPath = path.join(fixture, "primary");
    const additionalPath = path.join(fixture, "additional");
    mkdirSync(primaryPath);
    mkdirSync(additionalPath);
    mkdirSync(path.join(additionalPath, "folder"));

    const configPath = path.join(fixture, "workspace-profiles.json");
    const store = new WorkspaceStore(configPath, primaryPath);
    const initial = store.read();
    assert.equal(initial.roots.length, 1);
    assert.equal(initial.roots[0].permission, "workspace-write");

    const added = store.add(additionalPath);
    assert.equal(added.roots.length, 2);
    assert.equal(store.add(additionalPath).roots.length, 2);
    const additional = added.roots.find((root) => root.path === additionalPath);
    assert.ok(additional);
    assert.equal(additional.permission, "workspace-write");

    const readOnly = store.updatePermission(additional.id, "read-only");
    assert.equal(readOnly.roots.find((root) => root.id === additional.id)?.permission, "read-only");
    const writable = store.updatePermission(additional.id, "workspace-write");
    assert.equal(writable.roots.find((root) => root.id === additional.id)?.permission, "workspace-write");
    assert.equal(store.setPrimary(additional.id).primaryId, additional.id);
    assert.deepEqual(store.listEntries(additional.id), [{ name: "folder", kind: "directory" }]);

    const reloaded = new WorkspaceStore(configPath, primaryPath).read();
    assert.equal(reloaded.primaryId, additional.id);
    assert.equal(reloaded.roots.length, 2);
    const removed = store.remove(additional.id);
    assert.equal(removed.roots.length, 1);
    assert.throws(() => store.remove(removed.primaryId), /At least one workspace/);
    assert.throws(() => store.add(path.parse(primaryPath).root), /cannot be registered/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("sandbox policy never turns an empty writable-root set into implicit cwd write access", () => {
  const state = {
    primaryId: "primary",
    roots: [
      { id: "primary", name: "primary", path: "/workspace/primary", permission: "read-only" },
      { id: "extra", name: "extra", path: "/workspace/extra", permission: "read-only" },
    ],
  };
  assert.deepEqual(createSandboxPolicy("workspace-write", state), { type: "readOnly", networkAccess: false });
  state.roots[1].permission = "workspace-write";
  assert.deepEqual(createSandboxPolicy("workspace-write", state), {
    type: "workspaceWrite",
    writableRoots: ["/workspace/extra"],
    networkAccess: false,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  });
});

test("legacy read-only workspace profiles migrate once to the writable default", () => {
  const managedTempRoot = controlledTestRoot;
  mkdirSync(managedTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(managedTempRoot, "workspace-migration-test-"));
  try {
    const projectPath = path.join(fixture, "project");
    mkdirSync(projectPath);
    const configPath = path.join(fixture, "workspace-profiles.json");
    writeFileSync(configPath, JSON.stringify({
      primaryId: "legacy",
      roots: [{ id: "legacy", name: "project", path: projectPath, permission: "read-only" }],
    }), "utf8");

    const store = new WorkspaceStore(configPath, projectPath);
    const migrated = store.read();
    assert.equal(migrated.roots[0].permission, "workspace-write");
    assert.equal(JSON.parse(readFileSync(configPath, "utf8")).permissionDefaultsVersion, 1);

    store.updatePermission(migrated.roots[0].id, "read-only");
    assert.equal(new WorkspaceStore(configPath, projectPath).read().roots[0].permission, "read-only");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
