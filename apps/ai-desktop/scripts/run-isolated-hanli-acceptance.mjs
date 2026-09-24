import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(applicationRoot, "../..");

/** 只有同一专题的最终决定和逐项通过记录均已持久化，才允许结束测试实例。 */
export function acceptedHanliRunId(state, topicId) {
  const topic = state?.topics?.find((item) => item.topicId === topicId);
  if (topic?.status !== "completed") return null;
  for (const proposal of state.proposals || []) {
    if (proposal.topicId !== topicId || proposal.status !== "completed" || !proposal.finalConclusionRecordId) continue;
    const conclusion = (state.archiveRecords || []).find((record) => record.recordId === proposal.finalConclusionRecordId
      && record.topicId === topicId && record.proposalId === proposal.proposalId && record.eventType === "proposal.result_decided");
    const runId = conclusion?.payload?.finalConclusion?.acceptanceRunId;
    const conclusionResults = conclusion?.payload?.finalConclusion?.conditionResults;
    if (!runId || !Array.isArray(conclusionResults) || !conclusionResults.length
      || conclusionResults.some((result) => result.status !== "passed")) continue;
    const accepted = (state.archiveRecords || []).find((record) => record.topicId === topicId
      && record.proposalId === proposal.proposalId && record.eventType === "acceptance.result_checked"
      && record.payload?.acceptanceRun?.runId === runId);
    const run = accepted?.payload?.acceptanceRun;
    const expectedIds = proposal.acceptancePlan?.conditions?.map((condition) => condition.conditionId) || [];
    if (run?.status !== "passed" || run.sourceReview?.status !== "passed" || !expectedIds.length
      || conclusionResults.length !== expectedIds.length
      || run.planId !== proposal.acceptancePlan.planId || run.acceptanceRoundId !== proposal.acceptancePlan.currentRoundId
      || expectedIds.some((id) => run.stepResults?.filter((step) => step.checkId === id && step.status === "passed").length !== 1)) continue;
    return runId;
  }
  return null;
}

/** 隔离根必须是当前工程 cache/ai-desktop 下的独立真实目录，不能指向正式工作区或符号链接。 */
export function resolveIsolatedAcceptancePaths(sourceRoot, candidateRoot) {
  const source = realpathSync(sourceRoot);
  const candidate = path.resolve(candidateRoot);
  if (realpathSync(candidate) !== candidate) throw new Error("隔离验收根目录不能通过符号链接指向其他目录。");
  const cacheRoot = path.join(source, "cache", "ai-desktop");
  const relative = path.relative(cacheRoot, candidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("隔离验收实例必须位于当前工程 cache/ai-desktop 下，不能使用正式工程根。");
  }
  const executable = path.join(candidate, "build", "ai-desktop", "acceptance", "AI Desktop.app", "Contents", "MacOS", "AI Desktop");
  if (!existsSync(executable)) throw new Error("隔离验收应用不存在，请先生成并校验独立测试包。");
  const databasePath = path.join(source, "apps", "ai-desktop", "db", "workflow-control.sqlite3");
  if (!existsSync(databasePath)) throw new Error("正式专题数据库不存在，不能把测试实例误判为已验收。");
  return { executable, sandboxRoot: candidate, userDataRoot: path.join(candidate, "cache", "ai-desktop", "user-data"), databasePath };
}

/** 启动者仅持有自己创建的子进程；正式韩立持久化结论通过后向该子进程发送正常退出信号。 */
export function superviseIsolatedAcceptance({ executable, sandboxRoot, userDataRoot, topicId, readAcceptedRunId, spawnProcess = spawn, pollIntervalMs = 1_000 }) {
  const child = spawnProcess(executable, [
    `--selplat-root=${sandboxRoot}`, "--ai-desktop-variant=developer", `--ai-desktop-user-data-dir=${userDataRoot}`,
  ], { cwd: sandboxRoot, stdio: "inherit", env: { ...process.env, SELPLAT_ROOT: sandboxRoot } });
  return new Promise((resolve, reject) => {
    let timer;
    let acceptedRunId = null;
    let finished = false;
    const stop = (error, value) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      if (error) reject(error);
      else resolve(value);
    };
    const interrupt = () => child.kill("SIGTERM");
    const check = () => {
      if (finished || acceptedRunId) return;
      try {
        const runId = readAcceptedRunId(topicId);
        if (!runId) return;
        acceptedRunId = runId;
        if (!child.kill("SIGTERM")) stop(new Error("韩立验收已通过，但无法确认隔离测试实例已收到退出信号。"));
      } catch (error) {
        acceptedRunId = null;
        console.error(`无法核验韩立验收结果，隔离实例保持运行：${error instanceof Error ? error.message : String(error)}`);
      }
    };
    child.once("error", (error) => stop(error));
    child.once("exit", (code, signal) => {
      if (acceptedRunId) stop(null, { acceptedRunId, code, signal });
      else stop(new Error(`隔离测试实例在韩立正式验收通过前退出：code=${code}, signal=${signal}`));
    });
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    timer = setInterval(check, pollIntervalMs);
    check();
  });
}

async function main() {
  if (process.platform !== "darwin") throw new Error("当前隔离验收启动器仅支持 macOS AI Desktop.app。");
  const sandboxArgument = process.argv.find((argument) => argument.startsWith("--sandbox-root="));
  const topicArgument = process.argv.find((argument) => argument.startsWith("--topic-id="));
  const topicId = topicArgument?.slice("--topic-id=".length) || "";
  if (!sandboxArgument || !/^[a-zA-Z0-9._-]+$/.test(topicId)) {
    throw new Error("请提供 --sandbox-root=<隔离工程绝对路径> 和 --topic-id=<正式专题 ID>。");
  }
  const paths = resolveIsolatedAcceptancePaths(projectRoot, sandboxArgument.slice("--sandbox-root=".length));
  const database = new DatabaseSync(paths.databasePath, { readOnly: true });
  try {
    const readState = () => {
      const row = database.prepare("SELECT stateJson FROM AiDesktopEvolutionState WHERE singletonId = 1").get();
      if (!row) throw new Error("正式专题状态尚未建立。");
      return JSON.parse(row.stateJson);
    };
    if (!readState().topics?.some((topic) => topic.topicId === topicId)) throw new Error("正式专题 ID 不存在，拒绝启动无归属的隔离测试实例。");
    const readAcceptedRunId = (id) => acceptedHanliRunId(readState(), id);
    if (readAcceptedRunId(topicId)) {
      console.log("韩立已完成该专题验收，无需再启动隔离测试实例。");
      return;
    }
    const result = await superviseIsolatedAcceptance({ ...paths, topicId, readAcceptedRunId });
    console.log(`韩立验收 ${result.acceptedRunId} 已通过；本次单独启动的隔离测试实例已退出。`);
  } finally {
    database.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
