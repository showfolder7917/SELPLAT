import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const documentPath = path.join(appRoot, "测试文档.md");
const lockPath = path.join(appRoot, ".测试文档.lock.json");
const archiveRoot = path.join(appRoot, "测试文档归档");
const staleAfterMs = 10 * 60 * 1_000;
const allowedStandaloneScripts = new Set(["typecheck", "build:developer", "verify:mac:developer"]);
const allowedTestScripts = new Set([
  "test:sites",
  "test:screenshot",
  "test:stream",
  "test:workspace",
  "test:audit",
  "test:dispatch",
  "test:explorer",
  "test:interaction",
  "test:managed",
  "test:trust",
]);
const argumentsMap = readArguments(process.argv.slice(2));
const executor = argumentsMap.executor || `${process.env.USER || "unknown"}@${os.hostname()}`;
const task = argumentsMap.task || "AI Desktop 统一测试";
const thread = argumentsMap.thread || "current";

if (argumentsMap.command === "status") {
  printStatus();
  process.exit(0);
}

if (!existsSync(documentPath)) {
  console.error("未找到共享测试文档：测试文档.md");
  process.exit(1);
}

const token = `${process.pid}-${Date.now()}`;
let currentItem = "准备读取共享测试文档";
acquireLock({ executor, task, thread, token });
const heartbeat = setInterval(() => writeLock({ executor, task, thread, token, currentItem }), 5_000);

try {
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

  let failed = 0;
  for (const item of testItems) {
    currentItem = `npm run ${item.script}`;
    writeLock({ executor, task, thread, token, currentItem });
    const startedAt = new Date().toISOString();
    const result = spawnSync("npm", ["run", item.script], { cwd: appRoot, encoding: "utf8", stdio: "inherit" });
    const passed = result.status === 0;
    if (!passed) failed += 1;
    lines[item.index] = `${item.source.replace("- [ ]", passed ? "- [x]" : "- [!] ")} — 结果：${passed ? "通过" : `失败（退出码 ${result.status ?? "unknown"}）`}；执行者：${executor}；开始：${startedAt}；结束：${new Date().toISOString()}`;
    writeFileSync(documentPath, lines.join("\n"), "utf8");
  }

  currentItem = "归档测试文档";
  writeLock({ executor, task, thread, token, currentItem });
  mkdirSync(archiveRoot, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultLabel = failed === 0 ? "通过" : "失败";
  const archivePath = path.join(archiveRoot, `测试文档.${timestamp}.${resultLabel}.md`);
  renameSync(documentPath, archivePath);
  console.log(`统一测试${resultLabel}，测试文档已归档：${archivePath}`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  clearInterval(heartbeat);
  releaseOwnLock(token);
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
  if (!lock) return console.log("共享测试文档当前无人执行。");
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
