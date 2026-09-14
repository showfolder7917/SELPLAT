import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { WorkspaceStore } from "../../../../../../../build/ai-desktop/electron/electron/services/support/platform/workspace/internal/workspace.store.js";
import { WorkspaceFacade } from "../../../../../../../build/ai-desktop/electron/electron/services/support/platform/workspace/workspace.facade.js";
import { createSandboxPolicy } from "../../../../../../../build/ai-desktop/electron/electron/services/support/platform/codex/codex.facade.js";
import { controlledTestRoot } from "#test-paths";

test("workspace profiles validate, deduplicate, persist, and enforce lifecycle constraints", () => {
  const managedTempRoot = controlledTestRoot;
  mkdirSync(managedTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(managedTempRoot, "workspace-store-test-"));
  try {
    const primaryPath = path.join(fixture, "primary");
    const additionalPath = path.join(fixture, "additional");
    mkdirSync(primaryPath);
    mkdirSync(additionalPath);

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

test("统一文件入口只预览文本并受控打开 PPT/PPTX", async () => {
  const managedTempRoot = controlledTestRoot;
  mkdirSync(managedTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(managedTempRoot, "workspace-file-open-test-"));
  try {
    const projectPath = path.join(fixture, "project");
    mkdirSync(projectPath);
    writeFileSync(path.join(projectPath, "readme.md"), "已确认的文本内容", "utf8");
    writeFileSync(path.join(projectPath, "roadmap.PPTX"), "presentation", "utf8");
    const openedFiles = [];
    const facade = new WorkspaceFacade(path.join(fixture, "workspace-profiles.json"), projectPath, async (filePath) => {
      openedFiles.push(filePath);
    });
    const workspaceId = facade.read().primaryId;

    assert.deepEqual(await facade.openFile(workspaceId, "readme.md"), {
      kind: "preview", workspaceId, relativePath: "readme.md", content: "已确认的文本内容",
    });
    assert.deepEqual(await facade.openFile(workspaceId, "roadmap.PPTX"), {
      kind: "system-opened", workspaceId, relativePath: "roadmap.PPTX",
    });
    assert.deepEqual(openedFiles, [path.join(projectPath, "roadmap.PPTX")]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("系统默认应用失败只返回受控提示，不返回系统路径或错误", async () => {
  const managedTempRoot = controlledTestRoot;
  mkdirSync(managedTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(managedTempRoot, "workspace-file-open-failure-test-"));
  try {
    const projectPath = path.join(fixture, "project");
    mkdirSync(projectPath);
    writeFileSync(path.join(projectPath, "roadmap.ppt"), "presentation", "utf8");
    const facade = new WorkspaceFacade(path.join(fixture, "workspace-profiles.json"), projectPath, async () => {
      throw new Error("/private/path/system-detail");
    });
    const workspaceId = facade.read().primaryId;
    assert.deepEqual(await facade.openFile(workspaceId, "roadmap.ppt"), {
      kind: "system-open-failed", workspaceId, relativePath: "roadmap.ppt", message: "无法使用系统默认应用打开该演示文稿。",
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("统一文件入口在调用系统能力前拒绝越界路径和目录", async () => {
  const managedTempRoot = controlledTestRoot;
  mkdirSync(managedTempRoot, { recursive: true });
  const fixture = mkdtempSync(path.join(managedTempRoot, "workspace-file-open-boundary-test-"));
  try {
    const projectPath = path.join(fixture, "project");
    mkdirSync(projectPath);
    mkdirSync(path.join(projectPath, "folder"));
    let openCount = 0;
    const facade = new WorkspaceFacade(path.join(fixture, "workspace-profiles.json"), projectPath, async () => {
      openCount += 1;
    });
    const workspaceId = facade.read().primaryId;
    await assert.rejects(facade.openFile(workspaceId, "../outside.pptx"), /不允许的层级/);
    await assert.rejects(facade.openFile(workspaceId, "folder"), /不是普通文件/);
    assert.equal(openCount, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
