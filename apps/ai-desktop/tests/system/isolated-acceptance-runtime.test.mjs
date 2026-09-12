import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { prepareIsolatedAcceptanceRuntime } from "../../scripts/prepare-isolated-acceptance-runtime.mjs";

for (const fails of [false, true]) {
  test(fails ? "依赖准备失败不返回可启动工程" : "导出后在隔离工程运行既有准备入口，不继承外层租约", () => {
    const root = mkdtempSync(path.join(tmpdir(), "isolated-runtime-test-"));
    const previousLease = process.env.AI_DESKTOP_DEPENDENCY_LEASE_ID;
    try {
      const source = path.join(root, "source");
      const scripts = path.join(source, "apps/ai-desktop/scripts");
      mkdirSync(scripts, { recursive: true });
      // 用真实子进程记录调用边界，避免测试触发网络安装。
      writeFileSync(path.join(scripts, "run-with-dependencies.mjs"), `
        import { writeFileSync } from "node:fs";
        writeFileSync("prepared.json", JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2), lease: process.env.AI_DESKTOP_DEPENDENCY_LEASE_ID }));
        process.exit(${fails ? 17 : 0});
      `);
      const git = (...args) => execFileSync("git", args, { cwd: source, stdio: "pipe" });
      git("init", "-b", "main"); git("add", ".");
      git("-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "source");
      const project = path.join(root, "isolated/project");
      process.env.AI_DESKTOP_DEPENDENCY_LEASE_ID = "unrelated-outer-lease";
      if (fails) assert.throws(() => prepareIsolatedAcceptanceRuntime(source, project));
      else assert.equal(prepareIsolatedAcceptanceRuntime(source, project).projectRoot, project);
      const actual = JSON.parse(readFileSync(path.join(project, "apps/ai-desktop/prepared.json"), "utf8"));
      assert.equal(actual.cwd, path.join(project, "apps/ai-desktop"));
      assert.deepEqual(actual.args, ["node", "--version"]);
      assert.equal(actual.lease, "");
      assert.equal(existsSync(path.join(source, "apps/ai-desktop/prepared.json")), false);
    } finally {
      if (previousLease === undefined) delete process.env.AI_DESKTOP_DEPENDENCY_LEASE_ID;
      else process.env.AI_DESKTOP_DEPENDENCY_LEASE_ID = previousLease;
      rmSync(root, { recursive: true, force: true });
    }
  });
}
