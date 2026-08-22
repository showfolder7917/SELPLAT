import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 集成批次只运行代码级组合检查；正式构建和当前应用重启仍属于用户明确触发的测试托管。 */
export async function verifyCollaborationIntegration(rootPath: string, taskIds: string[]): Promise<void> {
  const commitCount = Math.max(4, taskIds.length * 3);
  await run("git", ["log", "--check", "--oneline", "-n", String(commitCount)], rootPath);
  const desktopRoot = path.join(rootPath, "apps", "ai-desktop");
  if (existsSync(path.join(desktopRoot, "package.json"))) {
    await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "typecheck"], desktopRoot);
  }
}

async function run(command: string, args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync(command, args, {
      cwd,
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim().slice(-2_000)
      : error instanceof Error ? error.message : String(error);
    throw new Error(`协同组合检查失败：${detail}`);
  }
}
