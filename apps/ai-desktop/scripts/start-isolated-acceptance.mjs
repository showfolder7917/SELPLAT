import { chmodSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prepareIsolatedAcceptanceProject } from "./prepare-isolated-acceptance-project.mjs";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const formalProjectRoot = path.resolve(applicationRoot, "..", "..");
// 正式用户目录必须来自实际运行实例，不能以不存在的默认缓存目录代替保护范围。
const protectedUserDataArgument = process.env.AI_DESKTOP_ACCEPTANCE_PROTECTED_USER_DATA_ROOT;
if (!protectedUserDataArgument || !path.isAbsolute(protectedUserDataArgument) || !existsSync(protectedUserDataArgument)) {
  throw new Error("请通过 AI_DESKTOP_ACCEPTANCE_PROTECTED_USER_DATA_ROOT 提供实际正式用户目录。");
}
const formalUserDataRoot = path.resolve(protectedUserDataArgument);
const applicationPath = process.env.AI_DESKTOP_ACCEPTANCE_APP;
if (!applicationPath || !existsSync(applicationPath)) throw new Error("请通过 AI_DESKTOP_ACCEPTANCE_APP 提供已打包的 AI Desktop.app。");

const acceptanceParent = process.env.AI_DESKTOP_ACCEPTANCE_ROOT || path.join("/private/tmp", "ai-desktop-acceptance");
mkdirSync(acceptanceParent, { recursive: true });
const acceptanceRoot = mkdtempSync(path.join(acceptanceParent, "run-"));
chmodSync(acceptanceRoot, 0o700);
const projectRoot = path.join(acceptanceRoot, "project");
const userDataRoot = path.join(acceptanceRoot, "user-data");
// 完整源码含 ai-memory-paths.json；正式数据库与运行状态未纳入 Git，不进入副本。
const { sourceSha } = prepareIsolatedAcceptanceProject(formalProjectRoot, projectRoot);

const executable = path.join(applicationPath, "Contents", "MacOS", "AI Desktop");
const child = spawn(executable, [
  `--selplat-root=${projectRoot}`,
  `--ai-desktop-runtime-sha=${sourceSha}`,
  `--ai-desktop-user-data-dir=${userDataRoot}`,
  `--ai-desktop-acceptance-isolation-root=${acceptanceRoot}`,
  `--ai-desktop-acceptance-protected-project-root=${formalProjectRoot}`,
  `--ai-desktop-acceptance-protected-user-data-root=${formalUserDataRoot}`,
], { cwd: applicationRoot, stdio: "inherit", shell: false });
child.once("error", (error) => { throw error; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
