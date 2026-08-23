import { spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot, resolveArchiveMonth } from "@selplat/node-common-core/path";
import { validateSafeIdentifier } from "@selplat/node-common-core/validation";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(appRoot, "../..");
const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
const pendingRoot = projectPaths.pendingTestRoot;
const runningRoot = projectPaths.runningTestRoot;
const lockPath = path.join(runningRoot, "执行锁.json");
const archiveRoot = projectPaths.testArchiveRoot;
const staleAfterMs = 10 * 60 * 1_000;
const allowedStandaloneScripts = new Set([
  "typecheck",
  "build:developer",
  "migrate:data-layout",
  "package:mac:developer",
  "verify:mac:developer",
  "verify:package-content",
]);
const allowedTestScripts = new Set([
  "test:common",
  "test:sites",
  "test:screenshot",
  "test:stream",
  "test:workspace",
  "test:audit",
  "test:dispatch",
  "test:collaboration",
  "test:explorer",
  "test:interaction",
  "test:managed",
  "test:trust",
  "test:codex-runtime",
]);
const argumentsMap = readArguments(process.argv.slice(2));
const executor = argumentsMap.executor || `${process.env.USER || "unknown"}@${os.hostname()}`;
const task = argumentsMap.task || "AI Desktop 统一测试";
const thread = argumentsMap.thread || "current";

if (argumentsMap.command === "status") {
  printStatus();
  process.exit(0);
}

const token = `${process.pid}-${Date.now()}`;
let currentItem = "准备读取共享测试文档";
mkdirSync(pendingRoot, { recursive: true });
mkdirSync(runningRoot, { recursive: true });
acquireLock({ executor, task, thread, token });
const heartbeat = setInterval(() => writeLock({ executor, task, thread, token, currentItem }), 5_000);

try {
  const { runId, runRoot, documentPath } = selectRun();
  const original = readFileSync(documentPath, "utf8");
  const lines = original.split("\n");
  const testItems = lines.flatMap((line, index) => {
    const match = line.match(/^- \[ \] `npm run ([a-zA-Z0-9:_-]+)` — 预期：(.+)$/);
    return match ? [{ index, script: match[1], expectation: match[2], source: line }] : [];
  });
  if (testItems.length === 0) throw new Error("测试文档中没有可执行的待测项。请使用：- [ ] `npm run 脚本名` — 预期：说明");
  const blockedItems = testItems.filter((item) => !isAllowedTestScript(item.script));
  if (blockedItems.length > 0) {
    throw new Error(`共享测试文档包含未授权脚本：${blockedItems.map((item) => item.script).join("、")}。自动测试只允许已登记的静态检查、开发构建、应用验证和测试脚本。`);
  }

  const eventPath = path.join(runRoot, "测试事件.jsonl");
  let failed = 0;
  for (const item of testItems) {
    currentItem = `npm run ${item.script}`;
    writeLock({ executor, task, thread, token, currentItem });
    const startedAt = new Date().toISOString();
    appendFileSync(eventPath, `${JSON.stringify({ type: "test.started", runId, script: item.script, startedAt, executor })}\n`, "utf8");
    const result = spawnSync("npm", ["run", item.script], { cwd: appRoot, encoding: "utf8", stdio: "inherit" });
    const completedAt = new Date().toISOString();
    const passed = result.status === 0;
    if (!passed) failed += 1;
    appendFileSync(eventPath, `${JSON.stringify({ type: "test.finished", runId, script: item.script, completedAt, passed, exitCode: result.status })}\n`, "utf8");
    lines[item.index] = `${item.source.replace("- [ ]", passed ? "- [x]" : "- [!] ")} — 结果：${passed ? "通过" : `失败（退出码 ${result.status ?? "unknown"}）`}；执行者：${executor}；开始：${startedAt}；结束：${completedAt}`;
    writeFileSync(documentPath, lines.join("\n"), "utf8");
  }

  currentItem = "归档测试文档";
  writeLock({ executor, task, thread, token, currentItem });
  const now = new Date();
  const monthlyArchiveRoot = path.join(archiveRoot, resolveArchiveMonth(now.toISOString()));
  const resultLabel = failed === 0 ? "通过" : "失败";
  renameSync(documentPath, path.join(runRoot, "测试结果.md"));
  writeFileSync(path.join(runRoot, "失败证据清单.json"), `${JSON.stringify({ runId, result: resultLabel, evidence: [] }, null, 2)}\n`, "utf8");
  const archivePath = path.join(monthlyArchiveRoot, runId);
  if (existsSync(archivePath)) throw new Error(`测试归档已存在，运行中材料已保留：${archivePath}`);
  mkdirSync(monthlyArchiveRoot, { recursive: true });
  renameSync(runRoot, archivePath);
  if (!existsSync(path.join(archivePath, "测试结果.md"))) throw new Error(`测试归档完整性检查失败：${archivePath}`);
  console.log(`统一测试${resultLabel}，测试运行已归档：${archivePath}`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  clearInterval(heartbeat);
  releaseOwnLock(token);
}

function selectRun() {
  const runningIds = listRunIds(runningRoot);
  if (runningIds.length > 1) throw new Error(`运行中存在多个测试批次，无法确定唯一批次：${runningIds.join("、")}`);
  let runId = runningIds[0];
  if (!runId) {
    const pendingIds = listRunIds(pendingRoot);
    if (pendingIds.length !== 1) {
      throw new Error(pendingIds.length === 0
        ? `没有待执行测试批次：${pendingRoot}`
        : `待执行目录存在多个测试批次，请先保留唯一批次：${pendingIds.join("、")}`);
    }
    runId = pendingIds[0];
    renameSync(path.join(pendingRoot, runId), path.join(runningRoot, runId));
  }
  const runRoot = path.join(runningRoot, runId);
  const documentPath = path.join(runRoot, `测试文档.${thread}.md`);
  if (!existsSync(documentPath)) throw new Error(`测试批次缺少当前线程测试文档：${documentPath}`);
  return { runId, runRoot, documentPath };
}

function listRunIds(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => validateSafeIdentifier(entry.name, "runId"))
    .filter((runId) => readdirSync(path.join(root, runId)).some((name) => name.startsWith("测试文档.") && name.endsWith(".md")))
    .sort();
}

function acquireLock(details) {
  for (;;) {
    try {
      const descriptor = openSync(lockPath, "wx");
      closeSync(descriptor);
      writeLock(details);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const lock = readLock();
      if (lock && !isStale(lock)) {
        console.error(`共享测试正在被 ${lock.executor} 执行；任务：${lock.task}；线程：${lock.thread}；当前项：${lock.currentItem}；开始时间：${lock.startedAt}`);
        process.exit(2);
      }
      rmSync(lockPath, { force: true });
      console.warn(`已恢复过期测试锁：${lock?.executor || "未知执行者"}`);
    }
  }
}

function writeLock(details) {
  const previous = readLock();
  writeFileSync(lockPath, `${JSON.stringify({
    executor: details.executor,
    task: details.task,
    thread: details.thread,
    pid: process.pid,
    host: os.hostname(),
    token: details.token,
    startedAt: previous?.token === details.token ? previous.startedAt : new Date().toISOString(),
    currentItem: details.currentItem || currentItem,
    heartbeatAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
}

function readLock() {
  try { return JSON.parse(readFileSync(lockPath, "utf8")); } catch { return null; }
}

function isStale(lock) {
  const heartbeatAt = Date.parse(lock.heartbeatAt || lock.startedAt || "");
  if (!Number.isFinite(heartbeatAt) || Date.now() - heartbeatAt > staleAfterMs) return true;
  if (lock.host !== os.hostname() || !Number.isInteger(lock.pid)) return false;
  try { process.kill(lock.pid, 0); return false; } catch { return true; }
}

function releaseOwnLock(expectedToken) {
  if (readLock()?.token === expectedToken) rmSync(lockPath, { force: true });
}

function printStatus() {
  const lock = readLock();
  if (!lock) {
    const runningIds = listRunIds(runningRoot);
    if (runningIds.length > 0) return console.log(`共享测试当前无人执行，发现可恢复的运行中批次：${runningIds.join("、")}`);
    const pendingIds = listRunIds(pendingRoot);
    if (pendingIds.length > 0) return console.log(`共享测试等待执行：${pendingIds.join("、")}`);
    return console.log("共享测试当前无人执行，也没有待执行文档。");
  }
  if (isStale(lock)) return console.log(`发现可恢复的过期测试锁，原执行者：${lock.executor || "未知"}。`);
  console.log(`共享测试正在被 ${lock.executor} 执行；任务：${lock.task}；线程：${lock.thread}；当前项：${lock.currentItem}；心跳：${lock.heartbeatAt}`);
}

function readArguments(values) {
  const result = { command: values[0] === "status" ? "status" : "run" };
  for (let index = result.command === "status" ? 1 : 0; index < values.length; index += 1) {
    const match = values[index].match(/^--(executor|task|thread)=(.+)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

/** 共享文档是自动执行控制面，只允许验证类脚本，禁止借固定入口启动、发布或递归调用自身。 */
function isAllowedTestScript(script) {
  return allowedStandaloneScripts.has(script) || allowedTestScripts.has(script);
}
