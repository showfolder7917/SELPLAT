import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertWorkspaceDataPath, resolveSelectedWorkspaceRoot } from "./selected-workspace-root.mjs";

const targetVersion = "0.149.0";
const candidateVersion = "0.154.0";
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceProjectRoot = path.resolve(appRoot, "../..");
const projectRoot = resolveSelectedWorkspaceRoot(sourceProjectRoot);
const [confirmation, evidenceFlag, evidenceDirectory] = process.argv.slice(2);

if (confirmation !== "--confirm-rollback-to-0.149.0" || evidenceFlag !== "--failure-evidence-dir" || !evidenceDirectory) {
  throw new Error("回退必须显式提供 --confirm-rollback-to-0.149.0 --failure-evidence-dir <失败证据目录>。");
}
const evidenceRoot = assertWorkspaceDataPath(projectRoot, path.resolve(evidenceDirectory));
if (!existsSync(evidenceRoot) || !statSync(evidenceRoot).isDirectory()) throw new Error("回退前必须保留可读取的失败证据目录。");

const fileReplacements = [
  ["electron/services/support/platform/codex/internal/codex-runtime.resolver.ts", [
    ['CODEX_TARGET_VERSION = "0.154.0"', 'CODEX_TARGET_VERSION = "0.149.0"'],
    ["HP/vJCH/t2hB9Kg6hotN9UglClJ6/z584fal5lEP14C9gNAgAQS4/kTQC7l5V+BA3TqwDPwINSjul28cX8AYXg==", "GsZJbzBWiD48RETrO8VHGAQNgfSrUVxItXZFeD87wswatPi0+lKuQo8Dx4nMYmOZhZrVtwr3al/feRrZxnDV8Q=="],
    ["2aqz+72Hop8PF2RYglQ4JnGjm3OlRIrTykJIT0hyLeUgM6NCFy09RgTmqRCoWliKQZjEn9jjZqUEp7QujAj77g==", "H+mMgW3Nhc5QzGWEklCoFqACuOc0cVpgPkPQRw0LShoK7P5664T6BRnyl1yzT6orKPKv49cXry7DIWWZ19SanQ=="],
    ["KmTCB6ST484zeYlPpKP/K5P/gRaYmt6TihVD+zotoe6O9q0JSBP+FYvCz4A/zZXR7xDOHURTSjHp0sD8wWS0YQ==", "fAXPpvIob+11RNZJS9CVVTsKb+V4Hw3woGFPj42D7fU2wBJUKI2jfAc4fLJNtrpwRecLeW601mtkMHOSIbWuuA=="],
    ["a4FI3A8sGtwGrOqltrPbrS2hajrHQG591EwmRfiRoLMb10VxdBtUGW4gu6IJVYENiYGA7k3P4jlRHEoCZU/s9Q==", "uZXaN9JPxu0/jjnqqJeTd4kRYPnjVZK3MiVndfG1mHhEaoDKL7ScWHfPqvAEOjwsSDEmQSlMfUkmvYp/CHciYw=="],
    ["CRUmZnE0Y/a8aLMrrA681EytOGaPaF659wJAiI4I3hsbQjaeYBSPV7PkCjy4Qn5LR/fmwIUORVH+6JaBNQL+tw==", "pUd8MzuwtqT5DhM1NUE1gETWIZ9fkDA1XB7tt9YNIi/peUgLuziQgZd7o0bNON4cNzgbil1YUN1qDTgQm0g3pg=="],
    ["Stg2KEJPIKVqPPR1wCverGOR4ey3RR3cvakR07w7FNKQUMzmHaOZomRsP2bR1qOT/67yHsks9rB+MCMfIWXcRA==", "qKbwSOOO/fdhQ5MlXE2fts6taPxRPZ/zqeC+eqHD72hLRymV9rFCUbUxOCquognUPRPvS/2/kRCV0UVhoDd3yQ=="],
  ]],
  ["scripts/verify-mac-developer-app.mjs", [['targetCodexVersion = "0.154.0"', 'targetCodexVersion = "0.149.0"']]],
  ["tests/services/support/platform/codex/codex-runtime.test.mjs", [['CODEX_TARGET_VERSION, "0.154.0"', 'CODEX_TARGET_VERSION, "0.149.0"']]],
  ["tests/interaction/isolated-preload.cjs", [['version: "0.154.0"', 'version: "0.149.0"']]],
  ["tests/features/collaboration/managed-task-executor-contract.test.mjs", [['0\\.154\\.0', '0\\.149\\.0']]],
  ["ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop协作与自动化规则.md", [["exact_target_0_154_0", "exact_target_0_149_0"]]],
  ["ruleengine/rules/local/XUNAN/selplat/应用/ai-desktop/rule/RUL_AIDesktop演化持久化与发布规则.md", [["0.154.0-win32-x64", "0.149.0-win32-x64"]]],
];

const rollbackWrites = fileReplacements.map(([relativePath, replacements]) => {
  const filePath = path.join(appRoot, relativePath);
  let content = readFileSync(filePath, "utf8");
  for (const [before, after] of replacements) {
    if (!content.includes(before)) throw new Error(`回退前版本事实不匹配：${relativePath}`);
    content = content.replace(before, after);
  }
  return [filePath, content];
});

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npm, ["install", "--package-lock-only", "--ignore-scripts", "--save-exact", `@openai/codex@${targetVersion}`, `@openai/codex-darwin-arm64@npm:@openai/codex@${targetVersion}-darwin-arm64`, `@openai/codex-darwin-x64@npm:@openai/codex@${targetVersion}-darwin-x64`, `@openai/codex-win32-x64@npm:@openai/codex@${targetVersion}-win32-x64`], {
  cwd: appRoot,
  env: { ...process.env, NPM_CONFIG_CACHE: path.join(sourceProjectRoot, "cache", "ai-desktop", "npm") },
  stdio: "inherit",
});
for (const [filePath, content] of rollbackWrites) writeFileSync(filePath, content, "utf8");
console.log(`已从 ${candidateVersion} 回退到 ${targetVersion}；失败证据保留在：${evidenceRoot}`);
