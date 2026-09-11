import { mkdirSync, readdirSync, statSync, statfsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolveInteractionTestPaths } from "./interaction-test-paths.mjs";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(".");
const projectPaths = resolveInteractionTestPaths();
const taskSegment = (process.env.AI_DESKTOP_TEST_TASK_ID || "standalone")
  .toLowerCase()
  .replaceAll(/[^a-z0-9._-]+/g, "-")
  .replaceAll(/^-+|-+$/g, "")
  .slice(0, 100) || "standalone";
const temporaryRoot = path.join(projectPaths.temporaryMaterialsRoot, "测试证据", "interaction", taskSegment);
mkdirSync(temporaryRoot, { recursive: true });
const runSegment = (process.env.AI_DESKTOP_TEST_RUN_ID || "").replaceAll(/[^a-zA-Z0-9_-]/g, "");
const interactionRoot = path.join(temporaryRoot, runSegment);
mkdirSync(interactionRoot, { recursive: true });
const storageDiagnosticsFile = path.join(interactionRoot, "storage-diagnostics.json");

function directoryUsage(directory) {
  let bytes = 0;
  let files = 0;
  let directories = 0;
  const unreadablePaths = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    try {
      directories += 1;
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          pending.push(entryPath);
          continue;
        }
        if (entry.isFile()) {
          bytes += statSync(entryPath).size;
          files += 1;
        }
      }
    } catch (error) {
      unreadablePaths.push({ path: current, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { bytes, files, directories, unreadablePaths };
}

function storageSnapshot(stage, testProcess = {}) {
  const filesystem = statfsSync(interactionRoot);
  return {
    stage,
    recordedAt: new Date().toISOString(),
    filesystem: {
      blockSize: filesystem.bsize,
      availableBytes: filesystem.bavail * filesystem.bsize,
      freeBytes: filesystem.bfree * filesystem.bsize,
      availableInodes: filesystem.ffree,
      totalInodes: filesystem.files,
    },
    evidenceDirectory: directoryUsage(interactionRoot),
    testProcess,
  };
}

const storageDiagnostics = { before: storageSnapshot("before") };
function persistStorageDiagnostics() {
  try {
    writeFileSync(storageDiagnosticsFile, `${JSON.stringify(storageDiagnostics, null, 2)}\n`, "utf8");
  } catch (error) {
    // 磁盘耗尽时仍把无法写入诊断这一事实输出，避免把基础设施故障误报为页面失败。
    console.error(`无法写入交互测试存储诊断 ${storageDiagnosticsFile}:`, error);
  }
}
persistStorageDiagnostics();

// 每个签发任务的转换缓存、报告和失败截图独立进入工程临时数据域，避免多人分支互相覆盖。
const child = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.interaction.config.ts"], {
  cwd: appRoot,
  env: {
    ...process.env,
    TMPDIR: temporaryRoot,
    TEMP: temporaryRoot,
    TMP: temporaryRoot,
    AI_DESKTOP_TEMP_MATERIALS_ROOT: projectPaths.temporaryMaterialsRoot,
    AI_DESKTOP_ARCHIVE_LOG_ROOT: projectPaths.archiveLogRoot,
  },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error);
  storageDiagnostics.after = storageSnapshot("spawn-error", { error: error.message });
  persistStorageDiagnostics();
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  storageDiagnostics.after = storageSnapshot("after", { code, signal });
  persistStorageDiagnostics();
  process.exitCode = code ?? (signal ? 1 : 0);
});
