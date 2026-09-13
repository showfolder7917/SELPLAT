import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { transform } from "esbuild";

const source = readFileSync("electron/system/ipc/workspace-acceptance-fixture.ts", "utf8");
const transformed = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { WorkspaceAcceptanceFixture } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

test("验收工作区夹具只交付一次，并在验收结束撤销登记和目录", () => {
  // 依赖包装器会把 TMPDIR 指向只读共享缓存；夹具本身接收应用 temp 根，因此测试显式使用 Darwin 可写系统临时目录。
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-fixture-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: (id, relativePath) => ({ workspaceId: id, relativePath, entries: relativePath === "empty" ? [] : [{ name: "README.md", relativePath: `${relativePath ? `${relativePath}/` : ""}README.md`, kind: "file" }] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    fixture.reserve();
    const directory = fixture.takeDirectory();
    assert.ok(directory);
    assert.equal(fixture.takeDirectory(), null);
    assert.match(readFileSync(path.join(directory, "README.md"), "utf8"), /验收工作区/);
    roots.push({ id: "fixture-root", path: directory });
    fixture.cleanup();
    assert.equal(roots.length, 0);
    assert.equal(existsSync(directory), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("场景夹具只为已登记临时根提供延迟、一次失败与空目录响应", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-scenario-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: (id, relativePath) => ({ workspaceId: id, relativePath, entries: relativePath === "empty" ? [] : [{ name: "README.md", relativePath: `${relativePath}/README.md`, kind: "file" }] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    fixture.reserve("scenarios");
    const directory = fixture.takeDirectory();
    assert.ok(directory);
    assert.equal(existsSync(path.join(directory, "工作区资源浏览-窄窗口超长目录名称验证-保持树和主查看区边界稳定")), true);
    roots.push({ id: "fixture-root", path: directory });
    fixture.registerWorkspace(directory, { primaryId: "fixture-root", roots: [...roots] });

    const delayed = fixture.readDirectory("fixture-root", "slow-a");
    assert.equal(delayed?.scenario, "delayed");
    assert.deepEqual(await delayed?.result, { workspaceId: "fixture-root", relativePath: "slow-a", entries: [{ name: "README.md", relativePath: "slow-a/README.md", kind: "file" }] });

    const firstRetry = fixture.readDirectory("fixture-root", "retry-once");
    assert.equal(firstRetry?.scenario, "retry-once");
    await assert.rejects(firstRetry?.result, /模拟目录读取失败/);
    assert.equal(fixture.readDirectory("fixture-root", "retry-once"), null);
    assert.equal(fixture.readDirectory("unregistered-root", "slow-a"), null);
    assert.equal(fixture.readDirectory("fixture-root", "empty"), null);
    fixture.cleanup();
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
