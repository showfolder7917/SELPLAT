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
