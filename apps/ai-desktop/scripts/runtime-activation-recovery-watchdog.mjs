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
export async function watchRuntimeActivationFailure({ projectRoot, replacePid, receiptPath, now = Date.now, sleep = defaultSleep, validate = validateRequest, recover = requestRuntimeActivationRecovery, receipt = writeReceipt }) {
  const pending = findSinglePreparingBatch(projectRoot);
  if (!pending) return { status: "not-scheduled" };
  if (!/^[1-9][0-9]*$/.test(String(replacePid || ""))) return { status: "invalid-host", releaseBatchId: pending.releaseBatchId };
  const observer = { projectRoot, receiptPath, releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha, replacePid: String(replacePid) };
  receipt(observer, "watching", null);
  const deadline = now() + WATCH_TIMEOUT_MS;
  let lastError = null;
  while (now() < deadline) {
    try {
      const request = validate({ projectRoot, releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha, replacePid });
      receipt({ ...observer, activationRoot: request.activationRoot }, "invoking", null);
      recover({ projectRoot, releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha, replacePid });
      receipt({ ...observer, activationRoot: request.activationRoot }, "invoked", null);
      return { status: "invoked", releaseBatchId: pending.releaseBatchId, candidateSha: pending.candidateSha };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
  receipt(observer, "timed-out", lastError);
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

function writeReceipt(request, status, detail) {
  const destination = request.receiptPath || path.join(request.activationRoot, "runtime-activation-recovery-watchdog.receipt.json");
  const allowedRoot = path.join(path.resolve(request.projectRoot), "OPTION", "temp", "ai-desktop", "临时材料", "发布激活恢复观察");
  if (!path.resolve(destination).startsWith(`${allowedRoot}${path.sep}`)) return;
  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ status, detail, releaseBatchId: request.releaseBatchId, candidateSha: request.candidateSha, occurredAt: new Date().toISOString() })}\n`, "utf8");
  renameSync(temporary, destination);
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || !["selplat-root", "replace-pid", "receipt-path"].includes(match[1]) || values.has(match[1])) {
      throw new Error("观察者参数必须且只能包含 --selplat-root、--replace-pid、--receipt-path。");
    }
    values.set(match[1], match[2]);
  }
  if (values.size !== 3) throw new Error("观察者缺少必需参数。");
  return { projectRoot: values.get("selplat-root"), replacePid: values.get("replace-pid"), receiptPath: values.get("receipt-path") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  watchRuntimeActivationFailure(parseArguments(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
