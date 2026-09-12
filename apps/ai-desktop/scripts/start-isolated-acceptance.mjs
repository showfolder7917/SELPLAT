import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const formalProjectRoot = path.resolve(applicationRoot, "..", "..");
const formalUserDataRoot = path.resolve(process.env.AI_DESKTOP_ACCEPTANCE_PROTECTED_USER_DATA_ROOT
  || path.join(formalProjectRoot, "cache", "ai-desktop", "user-data"));
const applicationPath = process.env.AI_DESKTOP_ACCEPTANCE_APP;
if (!applicationPath || !existsSync(applicationPath)) throw new Error("请通过 AI_DESKTOP_ACCEPTANCE_APP 提供已打包的 AI Desktop.app。");

const acceptanceParent = process.env.AI_DESKTOP_ACCEPTANCE_ROOT || path.join("/private/tmp", "ai-desktop-acceptance");
mkdirSync(acceptanceParent, { recursive: true });
const acceptanceRoot = mkdtempSync(path.join(acceptanceParent, "run-"));
const projectRoot = path.join(acceptanceRoot, "project");
const userDataRoot = path.join(acceptanceRoot, "user-data");
const databaseRoot = path.join(projectRoot, "apps", "ai-desktop", "db");
mkdirSync(databaseRoot, { recursive: true });
writeFileSync(path.join(projectRoot, "settings.gradle"), "rootProject.name = 'ai-desktop-acceptance'\n", "utf8");
cpSync(path.join(applicationRoot, "package.json"), path.join(projectRoot, "apps", "ai-desktop", "package.json"));
cpSync(path.join(applicationRoot, "db", "ai-memory-paths.json"), path.join(databaseRoot, "ai-memory-paths.json"));

const executable = path.join(applicationPath, "Contents", "MacOS", "AI Desktop");
const child = spawn(executable, [
  `--selplat-root=${projectRoot}`,
  `--ai-desktop-user-data-dir=${userDataRoot}`,
  `--ai-desktop-acceptance-isolation-root=${acceptanceRoot}`,
  `--ai-desktop-acceptance-protected-project-root=${formalProjectRoot}`,
  `--ai-desktop-acceptance-protected-user-data-root=${formalUserDataRoot}`,
], { cwd: applicationRoot, stdio: "inherit", shell: false });
child.once("error", (error) => { throw error; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
