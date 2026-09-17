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

// 单个测试若留下永不完成的 Promise，不能占满统一测试脚本的二十分钟总时限。
// Node 的逐用例时限会保留准确用例名，同时让同轮其余文件继续形成完整失败报告。
const OWNED_TEST_TIMEOUT_MS = 30_000;
const result = spawnSync(process.execPath, ["--test", `--test-timeout=${OWNED_TEST_TIMEOUT_MS}`, ...testFiles], {
  cwd: applicationRoot,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
