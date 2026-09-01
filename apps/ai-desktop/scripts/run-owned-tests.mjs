import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = path.join(applicationRoot, "tests");

/** 递归收集所有者目录中的 Node 测试；传参为空，返回按路径排序的完整测试文件清单，读取失败时直接抛出并阻断统一测试。 */
function collectOwnedTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectOwnedTests(entryPath);
    return entry.name.endsWith(".test.mjs") ? [entryPath] : [];
  }).sort();
}

const testFiles = collectOwnedTests(testsRoot);
if (testFiles.length === 0) throw new Error(`No owned tests found under ${testsRoot}`);

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: applicationRoot,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
