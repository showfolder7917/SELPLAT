import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 从已提交版本准备可调查、可建立任务工作树的独立工程。
 * 只导出 Git 管理的源码；不复制正式数据库、未提交文件、远端或模型凭据。
 */
export function prepareIsolatedAcceptanceProject(sourceRoot, projectRoot) {
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim();
  const archive = execFileSync("git", ["archive", "--format=tar", sourceSha], { cwd: sourceRoot, maxBuffer: 128 * 1024 * 1024 });
  // 目标必须是本轮新目录，禁止覆盖已经存在的正式或测试工程。
  mkdirSync(path.dirname(projectRoot), { recursive: true });
  mkdirSync(projectRoot);
  execFileSync("tar", ["-xf", "-", "-C", projectRoot], { input: archive, stdio: ["pipe", "pipe", "pipe"] });
  // 新仓库只保留此次源码基线，后续任务可创建工作树且不能推回正式仓库。
  execFileSync("git", ["init", "-b", "main"], { cwd: projectRoot, stdio: "pipe" });
  execFileSync("git", ["add", "."], { cwd: projectRoot, stdio: "pipe" });
  execFileSync("git", ["-c", "user.name=AI Desktop Acceptance", "-c", "user.email=acceptance@localhost", "commit", "-m", `Isolated acceptance source ${sourceSha}`], { cwd: projectRoot, stdio: "pipe" });
  return { sourceSha, projectRoot };
}
