import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { prepareIsolatedAcceptanceProject } from "../../scripts/prepare-isolated-acceptance-project.mjs";

// 真正建立工作树验证独立源码可用，不以启动器字符串断言代替实际执行。
test("完整源码副本可建工作树且不携带正式运行文件或远端，拒绝覆盖已存在副本", () => {
  const root = mkdtempSync(path.join(tmpdir(), "isolated-project-test-"));
  try {
    const source = path.join(root, "formal");
    mkdirSync(source);
    const git = (...args) => execFileSync("git", args, { cwd: source, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    git("init", "-b", "main");
    mkdirSync(path.join(source, "apps/ai-desktop/src"), { recursive: true });
    writeFileSync(path.join(source, "apps/ai-desktop/src/page.ts"), "export const title = 'page';\n");
    git("add", ".");
    git("-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "source");
    writeFileSync(path.join(source, "events.sqlite3"), "formal runtime only");
    const target = path.join(root, "isolated/project");
    const result = prepareIsolatedAcceptanceProject(source, target);
    assert.equal(result.sourceSha, git("rev-parse", "HEAD").trim());
    assert.ok(existsSync(path.join(target, "apps/ai-desktop/src/page.ts")));
    assert.equal(existsSync(path.join(target, "events.sqlite3")), false);
    assert.equal(execFileSync("git", ["remote"], { cwd: target, encoding: "utf8" }).trim(), "");
    execFileSync("git", ["worktree", "add", "--detach", path.join(root, "task-worktree")], { cwd: target, stdio: "pipe" });
    assert.ok(existsSync(path.join(root, "task-worktree/apps/ai-desktop/src/page.ts")));
    assert.throws(() => prepareIsolatedAcceptanceProject(source, target), /EEXIST/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
