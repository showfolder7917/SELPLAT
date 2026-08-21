import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { WorkspaceStore } from "../dist-electron/electron/services/workspace-store.js";

test("workspace profiles validate, deduplicate, persist, and enforce lifecycle constraints", () => {
  const managedTempRoot = path.resolve(process.cwd(), "../../OPTION/temp/ai-desktop");
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
    assert.equal(initial.roots[0].permission, "read-only");

    const added = store.add(additionalPath);
    assert.equal(added.roots.length, 2);
    assert.equal(store.add(additionalPath).roots.length, 2);
    const additional = added.roots.find((root) => root.path === additionalPath);
    assert.ok(additional);

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
