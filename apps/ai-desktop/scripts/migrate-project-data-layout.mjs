import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot, resolveArchiveMonth } from "@selplat/node-common-core/path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(appRoot, "../..");
const applicationName = resolveApplicationNameFromSourceRoot(appRoot);
const paths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName });
const legacyLogRoot = path.join(projectRoot, "log", applicationName);

ensureCanonicalRoots();
migrateTemporaryData();
migrateExecutionArchives();
migrateDiagnosticArchives();
migrateCollaborationArchives();
migrateTestArchives();
migrateEmptyArchiveKinds();
removeEmptyLegacyDirectories(legacyLogRoot, new Set(["归档日志"]));
console.log(`Project data layout is canonical for ${applicationName}.`);

function ensureCanonicalRoots() {
  for (const target of [
    paths.pendingExecutionRoot, paths.pendingTestRoot, paths.runningExecutionRoot, paths.runningTestRoot,
    ...["截图", "测试证据", "下载解压", "数据转换", "进程通信", "其他"].map((name) => path.join(paths.temporaryMaterialsRoot, name)),
    paths.executionArchiveRoot, paths.testArchiveRoot, paths.collaborationArchiveRoot,
    paths.approvalArchiveRoot, paths.diagnosticArchiveRoot,
  ]) mkdirSync(target, { recursive: true });
}

function migrateTemporaryData() {
  for (const entry of readdirSync(paths.tempRoot, { withFileTypes: true })) {
    if (entry.name === "执行日志" || entry.name === "临时材料") continue;
    const source = path.join(paths.tempRoot, entry.name);
    if (entry.name === "待执行" || entry.name === "运行中") {
      migrateLegacyExecutionRoot(source, entry.name === "待执行" ? path.join(paths.executionLogRoot, "待执行") : path.join(paths.executionLogRoot, "运行中"));
      continue;
    }
    moveWithoutOverwrite(source, path.join(paths.temporaryMaterialsRoot, classifyTemporaryEntry(entry.name), "历史迁移", entry.name));
  }
}

function migrateLegacyExecutionRoot(sourceRoot, destinationRoot) {
  if (!existsSync(sourceRoot)) return;
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    if (entry.name === "执行" || entry.name === "测试") {
      if (entry.name === "测试" && existsSync(path.join(source, "测试文档.md"))) {
        const runId = `layout_migration_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
        const runRoot = path.join(destinationRoot, "测试", runId);
        mkdirSync(runRoot, { recursive: true });
        moveWithoutOverwrite(path.join(source, "测试文档.md"), path.join(runRoot, "测试文档.current.md"));
      }
      mergeDirectory(source, path.join(destinationRoot, entry.name));
    } else {
      moveWithoutOverwrite(source, path.join(paths.temporaryMaterialsRoot, "其他", "历史迁移", entry.name));
    }
  }
  removeIfEmpty(sourceRoot);
}

function classifyTemporaryEntry(name) {
  if (/screen|shot|截图|accordion|typography|clipboard|button|streaming|flow|selection|confirm/i.test(name)) return "截图";
  if (/test|playwright|interaction|evidence|测试|证据/i.test(name)) return "测试证据";
  if (/download|extract|archive/i.test(name)) return "下载解压";
  if (/schema|transform|convert/i.test(name)) return "数据转换";
  if (/ipc|socket|pipe|process/i.test(name)) return "进程通信";
  return "其他";
}

function migrateExecutionArchives() {
  const legacyRoot = path.join(legacyLogRoot, "执行归档");
  if (!existsSync(legacyRoot)) return;
  for (const name of readdirSync(legacyRoot)) {
    const source = path.join(legacyRoot, name);
    if (!statSync(source).isFile() || !name.endsWith(".json")) continue;
    const summary = safeJson(source);
    const taskId = safeId(typeof summary?.taskId === "string" ? summary.taskId : name.slice(0, -5));
    const month = resolveArchiveMonth(typeof summary?.startedAt === "string" ? summary.startedAt : inferDate(name));
    const targetRoot = path.join(paths.executionArchiveRoot, month, taskId);
    mkdirSync(targetRoot, { recursive: true });
    moveWithoutOverwrite(source, path.join(targetRoot, "摘要.json"));
    ensureFile(path.join(targetRoot, "事件.jsonl"), "");
    ensureFile(path.join(targetRoot, "产物清单.json"), `${JSON.stringify({ taskId, artifacts: [] }, null, 2)}\n`);
  }
}

function migrateDiagnosticArchives() {
  const legacyRoot = path.join(legacyLogRoot, "诊断归档");
  if (!existsSync(legacyRoot)) return;
  for (const name of readdirSync(legacyRoot)) {
    const source = path.join(legacyRoot, name);
    if (!statSync(source).isFile()) continue;
    const month = resolveArchiveMonth(inferDate(name));
    const target = path.join(paths.diagnosticArchiveRoot, month, name.includes("error") ? "错误诊断.jsonl" : "运行诊断.jsonl");
    mkdirSync(path.dirname(target), { recursive: true });
    appendFileSync(target, readFileSync(source));
    rmSync(source);
  }
}

function migrateCollaborationArchives() {
  const legacyRoot = path.join(legacyLogRoot, "协同归档");
  if (!existsSync(legacyRoot)) return;
  for (const name of readdirSync(legacyRoot)) {
    const source = path.join(legacyRoot, name);
    if (statSync(source).isDirectory()) {
      if (name === "reports") {
        const target = path.join(paths.collaborationArchiveRoot, resolveArchiveMonth(new Date().toISOString()), "system", "集成报告");
        mergeDirectory(source, target);
      }
      continue;
    }
    if (!name.endsWith(".jsonl")) continue;
    for (const line of readFileSync(source, "utf8").split("\n").filter(Boolean)) {
      let event;
      try { event = JSON.parse(line); } catch { event = {}; }
      const taskId = safeId(typeof event.taskId === "string" ? event.taskId : "legacy");
      const occurredAt = event.startedAt || event.occurredAt || inferDate(name);
      const targetRoot = path.join(paths.collaborationArchiveRoot, resolveArchiveMonth(String(occurredAt)), taskId);
      mkdirSync(targetRoot, { recursive: true });
      appendFileSync(path.join(targetRoot, "流程事件.jsonl"), `${line}\n`, "utf8");
    }
    rmSync(source);
  }
}

function migrateTestArchives() {
  const legacyRoot = path.join(legacyLogRoot, "测试归档");
  if (!existsSync(legacyRoot)) return;
  for (const source of listFiles(legacyRoot)) {
    if (!source.endsWith(".md")) continue;
    const name = path.basename(source);
    const month = resolveArchiveMonth(inferDate(name));
    const runId = safeId(name.replace(/\.md$/i, ""));
    const targetRoot = path.join(paths.testArchiveRoot, month, runId);
    mkdirSync(targetRoot, { recursive: true });
    moveWithoutOverwrite(source, path.join(targetRoot, "测试结果.md"));
    ensureFile(path.join(targetRoot, "测试事件.jsonl"), "");
    ensureFile(path.join(targetRoot, "失败证据清单.json"), `${JSON.stringify({ runId, evidence: [] }, null, 2)}\n`);
  }
}

function migrateEmptyArchiveKinds() {
  for (const name of ["审批归档"]) {
    const legacyRoot = path.join(legacyLogRoot, name);
    if (existsSync(legacyRoot)) mergeDirectory(legacyRoot, path.join(paths.archiveLogRoot, name));
  }
}

function mergeDirectory(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) moveWithoutOverwrite(path.join(source, entry), path.join(destination, entry));
  removeIfEmpty(source);
}

function moveWithoutOverwrite(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(path.dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    if (statSync(source).isDirectory() && statSync(destination).isDirectory()) return mergeDirectory(source, destination);
    const parsed = path.parse(destination);
    destination = path.join(parsed.dir, `${parsed.name}_migrated_${Date.now()}${parsed.ext}`);
  }
  try { renameSync(source, destination); }
  catch {
    if (statSync(source).isDirectory()) throw new Error(`Cannot move directory across devices: ${source}`);
    copyFileSync(source, destination);
    rmSync(source);
  }
}

function removeEmptyLegacyDirectories(root, keep = new Set()) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || keep.has(entry.name)) continue;
    removeEmptyLegacyDirectories(path.join(root, entry.name));
    removeIfEmpty(path.join(root, entry.name));
  }
}

function removeIfEmpty(target) {
  if (existsSync(target) && statSync(target).isDirectory() && readdirSync(target).length === 0) rmdirSync(target);
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? listFiles(path.join(root, entry.name)) : [path.join(root, entry.name)]);
}

function ensureFile(target, content) {
  if (!existsSync(target)) writeFileSync(target, content, "utf8");
}

function safeJson(target) {
  try { return JSON.parse(readFileSync(target, "utf8")); } catch { return null; }
}

function safeId(value) {
  const normalized = String(value).replaceAll(/[^a-zA-Z0-9_-]/g, "_").replaceAll(/_+/g, "_").slice(0, 180);
  return normalized || "legacy";
}

function inferDate(value) {
  const match = String(value).match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z` : new Date().toISOString();
}
