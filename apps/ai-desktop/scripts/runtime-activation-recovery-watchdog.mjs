import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requestRuntimeActivationRecovery, validateRequest } from "./recover-runtime-activation.mjs";

const POLL_INTERVAL_MS = 200;
const WATCH_TIMEOUT_MS = 60_000;

/**
 * 候选包健康检查完成后由其验证脚本脱离旧宿主启动。
 * 仅观察一个仍在运行的 preparing 批次；状态归档后仍由现有控制器和包内工具执行接管。
 */
export async function watchRuntimeActivationFailure({ projectRoot, now = Date.now, sleep = defaultSleep, inspectProcess = inspectProcessTree, validate = validateRequest, recover = requestRuntimeActivationRecovery, receipt = writeReceipt }) {
  const pending = findSinglePreparingBatch(projectRoot);
  if (!pending) return { status: "not-scheduled" };
  const replacePid = findDesktopAncestor(process.ppid, inspectProcess);
  if (!replacePid) return { status: "host-not-found", releaseBatchId: pending.releaseBatchId };
  const deadline = now() + WATCH_TIMEOUT_MS;
  let lastError = null;
  while (now() < deadline) {
    try {
      const request = validate({ projectRoot, releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha, replacePid });
      receipt(request, "invoking", null);
      recover({ projectRoot, releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha, replacePid });
      receipt(request, "invoked", null);
      return { status: "invoked", releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
  return { status: "timed-out", releaseBatchId: pending.releaseBatchId, detail: lastError };
}

export function findSinglePreparingBatch(projectRoot) {
  const runningRoot = path.join(path.resolve(projectRoot), "OPTION", "temp", "ai-desktop", "执行日志", "运行中", "执行");
  if (!existsSync(runningRoot)) return null;
  const matches = readdirSync(runningRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(runningRoot, entry.name, "发布批次文档.json"))
    .filter((documentPath) => existsSync(documentPath))
    .map((documentPath) => ({ documentPath, document: JSON.parse(readFileSync(documentPath, "utf8")) }))
    .filter(({ document }) => document.state === "activating"
      && document.runtimeActivation?.state === "preparing"
      && /^[A-Za-z0-9._-]+$/.test(document.releaseBatchId || "")
      && /^[0-9a-f]{40,64}$/i.test(document.candidateSha || "")
      && document.runtimeActivation.candidateSha === document.candidateSha);
  return matches.length === 1 ? {
    releaseBatchId: matches[0].document.releaseBatchId,
    candidateSha: matches[0].document.candidateSha,
  } : null;
}

export function findDesktopAncestor(startPid, inspectProcess) {
  let pid = Number(startPid);
  for (let depth = 0; Number.isInteger(pid) && pid > 1 && depth < 24; depth += 1) {
    const processInfo = inspectProcess(pid);
    if (!processInfo) return null;
    if (processInfo.command.includes("AI Desktop.app/Contents/MacOS/AI Desktop")) return String(pid);
    pid = processInfo.parentPid;
  }
  return null;
}

function inspectProcess(pid) {
  try {
    const output = execFileSync("ps", ["-o", "ppid=,command=", "-p", String(pid)], { encoding: "utf8" }).trim();
    const match = /^(\d+)\s+(.+)$/u.exec(output);
    return match ? { parentPid: Number(match[1]), command: match[2] } : null;
  } catch {
    return null;
  }
}

function writeReceipt(request, status, detail) {
  const destination = path.join(request.activationRoot, "runtime-activation-recovery-watchdog.receipt.json");
  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ status, detail, releaseBatchId: request.releaseBatchId, candidateSha: request.candidateSha, occurredAt: new Date().toISOString() })}\n`, "utf8");
  renameSync(temporary, destination);
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseArguments(argv) {
  if (argv.length !== 1 || !argv[0].startsWith("--selplat-root=")) throw new Error("观察者只接受 --selplat-root=<工程根>。");
  return { projectRoot: argv[0].slice("--selplat-root=".length) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  watchRuntimeActivationFailure(parseArguments(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
