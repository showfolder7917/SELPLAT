import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_NAME = "ai-desktop";
const FAILURE_MARKER = "ENOTDIR: not a directory, rmdir";
const STAGING_MARKER = `${path.sep}package${path.sep}activation-staging-`;

/**
 * 受控发布执行者在旧宿主已提升候选、但尚未切换到候选源码时使用此入口。
 * 它不写发布状态、不重新打包，也不启动任意包；候选包内的恢复工具仍是唯一执行恢复的入口。
 */
export function requestRuntimeActivationRecovery({ projectRoot, releaseBatchId, candidateSha, replacePid, execute = execFileSync }) {
  const request = validateRequest({ projectRoot, releaseBatchId, candidateSha, replacePid });
  execute(request.recoveryTool, [
    `--selplat-root=${request.projectRoot}`,
    `--release-batch=${request.releaseBatchId}`,
    `--runtime-sha=${request.candidateSha}`,
    `--replace-pid=${request.replacePid}`,
  ], { stdio: "inherit" });
  return request;
}

export function validateRequest({ projectRoot, releaseBatchId, candidateSha, replacePid }) {
  const root = String(projectRoot || "").trim();
  if (!path.isAbsolute(root) || !existsSync(path.join(root, "settings.gradle"))) {
    throw new Error("恢复控制器要求指向已选 SELPLAT 工程根。");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(String(releaseBatchId || ""))) throw new Error("发布批次 ID 格式无效。");
  if (!/^[0-9a-f]{40,64}$/i.test(String(candidateSha || ""))) throw new Error("候选 SHA 格式无效。");
  if (!/^[1-9][0-9]*$/.test(String(replacePid || ""))) throw new Error("待替换进程 ID 格式无效。");

  const normalizedRoot = path.resolve(root);
  const documentPath = findArchivedBatchDocument(normalizedRoot, releaseBatchId);
  const document = JSON.parse(readFileSync(documentPath, "utf8"));
  const activationRoot = path.join(normalizedRoot, "build", APP_NAME, "package", "activation", `${releaseBatchId}-runtime`);
  const manifestPath = path.join(activationRoot, "ai-desktop-runtime-source.json");
  const manifest = readJson(manifestPath, "候选运行包来源清单");
  const recoveryTool = path.join(activationRoot, "AI Desktop.app", "Contents", "Resources", "runtime-activation-recovery.command");
  const executable = path.join(activationRoot, "AI Desktop.app", "Contents", "MacOS", "AI Desktop");

  if (document.releaseBatchId !== releaseBatchId
    || document.state !== "failed"
    || document.candidateSha !== candidateSha
    || document.runtimeActivation?.state !== "preparing"
    || document.runtimeActivation?.candidateSha !== candidateSha
    || !isStagingCleanupFailure(document.failureReason)
    || manifest.sourceSha !== candidateSha) {
    throw new Error("归档批次、候选 SHA、来源清单或暂存清理失败事实不匹配。");
  }
  assertRegularExecutable(recoveryTool, "候选包恢复工具");
  assertRegularExecutable(executable, "候选应用可执行文件");

  return { projectRoot: normalizedRoot, releaseBatchId, candidateSha, replacePid: String(replacePid), documentPath, activationRoot, recoveryTool, executable };
}

function findArchivedBatchDocument(projectRoot, releaseBatchId) {
  const archiveRoot = path.join(projectRoot, "log", APP_NAME, "归档日志", "发布归档");
  if (!existsSync(archiveRoot)) throw new Error("发布归档不存在，拒绝恢复。");
  const matches = readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(archiveRoot, entry.name, releaseBatchId, "发布批次文档.json"))
    .filter((candidate) => existsSync(candidate));
  if (matches.length !== 1) throw new Error("恢复必须命中唯一归档发布批次。");
  return matches[0];
}

function readJson(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`${label}不存在：${filePath}`);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`${label}不可读：${filePath}`);
  }
}

function assertRegularExecutable(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`${label}不存在：${filePath}`);
  if (lstatSync(filePath).isSymbolicLink() || !lstatSync(filePath).isFile() || (statSync(filePath).mode & 0o111) === 0) {
    throw new Error(`${label}必须是可执行普通文件：${filePath}`);
  }
}

function isStagingCleanupFailure(reason) {
  return typeof reason === "string" && reason.includes(FAILURE_MARKER) && reason.includes(STAGING_MARKER);
}

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || !["selplat-root", "release-batch", "candidate-sha", "replace-pid"].includes(match[1]) || values.has(match[1])) {
      throw new Error("参数必须且只能包含 --selplat-root、--release-batch、--candidate-sha、--replace-pid。");
    }
    values.set(match[1], match[2]);
  }
  if (values.size !== 4) throw new Error("恢复控制器缺少必需参数。");
  return {
    projectRoot: values.get("selplat-root"),
    releaseBatchId: values.get("release-batch"),
    candidateSha: values.get("candidate-sha"),
    replacePid: values.get("replace-pid"),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const request = requestRuntimeActivationRecovery(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ status: "recovery-tool-invoked", releaseBatchId: request.releaseBatchId, candidateSha: request.candidateSha, recoveryTool: request.recoveryTool })}\n`);
}
