import type { CurrentTopicAcceptanceOutDto, CurrentTopicStageOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import { isCompleteCustomerActionGuidance, type CollaborationStateOutDto, type CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";
import { ProposalExecutionAggregate } from "./proposal-execution.aggregate.js";
import { decideCurrentTopicOperation } from "./current-topic-operation.decision.js";

/**
 * 把专题、提案、有效任务链和最新真实验收事实收敛为唯一当前阶段。
 * 该投影只读取快照，不写入 Evolution、Workflow 或历史档案。
 */
export function projectCurrentTopicStage(
  evolution: EvolutionStateOutDto,
  collaboration: CollaborationStateOutDto,
): CurrentTopicStageOutDto {
  const run = evolution.oneShotRun;
  const independentEstablishment = run?.topicEstablishmentMode === "independent-switch" && !run.topicId && !run.proposalId;
  if (independentEstablishment && run?.status === "blocked") {
    return {
      topicId: null, proposalId: null, status: "topic-establishment-failed", title: "新专题建立失败",
      summary: run.blockingReason || "新专题尚未建立，旧专题仍只保留审计记录。", repairContent: "", remaining: run.blockingReason || "建立新专题时出现未完成步骤。",
      waitingFor: "系统恢复处理", nextAction: "保留建立失败证据并处理当前失败原因。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "系统恢复处理", "保留建立失败证据并处理当前失败原因。", run.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: run.updatedAt,
    };
  }
  // 已经绑定专题和提案的当前运行拥有交付阶段；后来产生但尚未确立的研讨不能把它覆盖成
  // 无专题的“等待确认”。独立专题切换必须先由状态机显式退役原运行，投影不在这里猜测切换。
  const activeProposalRun = Boolean(evolution.oneShotRun?.topicId && evolution.oneShotRun?.proposalId
    && evolution.oneShotRun.status !== "completed");
  const awaitingConfirmation = !activeProposalRun && hasPendingConfirmation(evolution);
  // questioning 研讨已经写入 Evolution，但尚未形成专题和提案；页面只能通过当前阶段读取这项事实。
  const activeDeliberation = !activeProposalRun
    ? [...evolution.deliberations].reverse().find((item) => item.status === "questioning" && item.topicId === null) || null
    : null;
  const proposalId = evolution.oneShotRun?.proposalId || null;
  const proposal = proposalId ? evolution.proposals.find((item) => item.proposalId === proposalId) || null : null;
  const topic = proposal ? evolution.topics.find((item) => item.topicId === proposal.topicId) || null : null;

  if (awaitingConfirmation) {
    return {
      topicId: null, proposalId: null, status: "awaiting-confirmation", title: "等待用户确认",
      summary: "南宫婉已经给出本轮范围说明，等待用户确认。", repairContent: "", remaining: "等待用户确认范围说明。",
      waitingFor: "用户确认", nextAction: "确认当前范围说明后继续。", userAction: "confirmation",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("confirmation", "用户确认", "确认当前范围说明后继续。", confirmationUpdatedAt(evolution)),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: confirmationUpdatedAt(evolution),
    };
  }

  if (activeDeliberation) {
    return {
      topicId: null, proposalId: null, status: "deliberating", title: "南宫婉正在内部研讨",
      summary: "韩立已确认当前问题，南宫婉正在与韩立核实范围和影响。", repairContent: "", remaining: "等待本轮内部研讨形成可执行范围。",
      waitingFor: "南宫婉内部研讨", nextAction: "系统会继续当前研讨；形成可执行范围后再显示确认。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "南宫婉内部研讨", "系统会继续当前研讨；形成可执行范围后再显示确认。", activeDeliberation.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: activeDeliberation.updatedAt,
    };
  }

  if (independentEstablishment && run?.status === "running") {
    return {
      topicId: null, proposalId: null, status: "establishing-topic", title: "正在建立新专题",
      summary: "旧专题已经退出当前区，系统正在继续研讨并建立新的独立专题。", repairContent: "", remaining: "等待新的专题及其提案建立。",
      waitingFor: "系统正在处理", nextAction: "系统将继续当前研讨；建立完成后显示新的专题卡。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "系统正在处理", "系统将继续当前研讨；建立完成后显示新的专题卡。", run.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: run.updatedAt,
    };
  }

  if (!proposal) {
    return {
      topicId: null, proposalId: null, status: "not-run", title: "暂无修复任务", summary: "当前没有可展示的专题提案。", repairContent: "", remaining: "",
      waitingFor: "南宫婉", nextAction: "等待形成可执行专题。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前交付投影", "系统将自动重新读取当前交付投影。", evolution.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }

  // 已取消链只能作为历史展示，绝不能被当前专题投影重新包装成恢复、审批或验收入口。
  const operation = decideCurrentTopicOperation(evolution, collaboration, {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    runId: evolution.oneShotRun?.runId || null,
  });
  if (operation.kind === "cancelled") {
    return {
      topicId: operation.topicId, proposalId: operation.proposalId, status: "cancelled", title: topic?.title || proposal.title,
      summary: operation.message, repairContent: "", remaining: "", waitingFor: "当前无需操作", nextAction: "本专题已取消", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前无需操作", "本专题已取消", evolution.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }
  if (operation.kind === "unavailable") {
    return {
      topicId: operation.topicId, proposalId: operation.proposalId, status: "not-run", title: "当前专题读取受阻",
      summary: operation.message, repairContent: "", remaining: operation.message, waitingFor: "当前专题状态", nextAction: "重新读取当前专题状态后再决定后续操作。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", "当前专题状态", "重新读取当前专题状态后再决定后续操作。", evolution.updatedAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null, hostStartupAcceptance: emptyHostStartupAcceptance(), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: evolution.updatedAt,
    };
  }

  // 技术恢复不能覆盖原运行的恢复动作：原运行仍被阻塞时，用户必须能够沿既有受控入口重新核查。
  // 但原运行已经在旧失败之后重新进入真实验收时，旧恢复记录只保留审计价值；页面必须展示当前验收，
  // 否则会把已恢复的流程继续显示成“系统恢复处理”，造成负责人、动作和真实运行互相矛盾。
  const technicalRecovery = evolution.technicalRecovery;
  const acceptanceBeforeRecovery = readLatestAcceptance(evolution, proposal);
  const resumedAcceptance = run?.status === "running" && run.phase === "accepting"
    && run.topicId === (topic?.topicId || proposal.topicId)
    && run.proposalId === proposal.proposalId
    && (!acceptanceBeforeRecovery || run.updatedAt > acceptanceBeforeRecovery.occurredAt);
  if (technicalRecovery?.active && technicalRecovery.topicId === (topic?.topicId || proposal.topicId)
    && technicalRecovery.proposalId === proposal.proposalId && !resumedAcceptance) {
    // 部分历史卡点没有绑定一次性运行；仍从当前提案的真实阻塞任务签发同一条受控复核入口。
    const blockingTaskIds = collaboration.tasks.filter((item) => item.evolutionProposalId === proposal.proposalId
      && ["blocked", "test-failed"].includes(item.state))
      .map((item) => item.taskId);
    const recoveryTaskIds = [...new Set([
      ...technicalRecovery.occurrences.map((item) => item.taskId).filter((item): item is string => Boolean(item)),
      ...blockingTaskIds,
    ])];
    // 历史故障记录只用于保留恢复证据；recovering 表示点击已经受理，按钮必须立即撤销，
    // 只有再次形成 blocked 或 test-failed 的新卡点时才能重新签发。
    const blockingTask = collaboration.tasks.find((item) => blockingTaskIds.includes(item.taskId)) || null;
    const guidance = blockingTask?.customerActionGuidance || null;
    const guidanceFiles = guidance?.affectedFiles || [];
    const hasCompleteGuidance = isCompleteCustomerActionGuidance(guidance, technicalRecovery.faultFingerprint, {
      affectedFiles: blockingTask?.integrationFailure?.conflictFiles || [],
      nonFileRecovery: null,
    });
    // 原一次性运行被阻塞本身不代表客户可以恢复。只有当前阻塞任务持有同故障指纹的完整指导，
    // 才能签发任务级确认；否则保持令狐核对中，避免旧运行入口覆盖当前责任。
    const resumeTaskId = hasCompleteGuidance ? blockingTask!.taskId : null;
    const monitoring = technicalRecovery.handoffStatus === "monitoring";
    const unverified = technicalRecovery.handoffStatus === "basis-unverified";
    const failed = technicalRecovery.handoffStatus === "failed";
    const summary = monitoring ? `监控接管复验：同一技术问题已保留 ${technicalRecovery.attemptCount} 轮证据。`
      : unverified ? "次数依据尚未核验。"
        : failed ? "令狐转交未完成。"
          : "令狐老祖处理中。";
    const waitingFor = monitoring ? "监控接管复验" : unverified || failed ? "系统恢复处理" : "令狐老祖";
    return {
      topicId: technicalRecovery.topicId, proposalId: technicalRecovery.proposalId, status: "failed-pending-repair", title: topic?.title || proposal.title,
      summary, repairContent: proposal.content, remaining: technicalRecovery.failureReason || technicalRecovery.occurrences.at(-1)?.reason || "没有待处理技术卡点。",
      waitingFor: resumeTaskId ? "用户确认后由令狐复查" : waitingFor, nextAction: technicalRecovery.nextAction, userAction: resumeTaskId ? "resume" : "none", resumeOneShotRunId: null,
      resumeTaskId, customerActionGuidance: resumeTaskId && guidance ? { affectedFiles: [...guidanceFiles], problem: guidance.problem, reasonCustomerMustAct: guidance.reasonCustomerMustAct, steps: [...guidance.steps], completionCriteria: [...guidance.completionCriteria], resumeLabel: guidance.resumeLabel } : null,
      readRecovery: readRecovery(resumeTaskId ? "resume" : "none", resumeTaskId ? "用户确认后由令狐复查" : waitingFor, technicalRecovery.nextAction, technicalRecovery.updatedAt),
      effectiveTaskIds: recoveryTaskIds, missingTaskIds: [], latestAcceptance: readLatestAcceptance(evolution, proposal),
      hostStartupAcceptance: readHostStartupAcceptance(evolution, proposal), deliveryEvidence: emptyDeliveryEvidence(), updatedAt: technicalRecovery.updatedAt,
    };
  }

  // 监控者独立验收卡没有分发计划，不套用普通代码交付候选门禁；最终通过仍必须读取唯一结论记录。
  const monitorAcceptanceCard = topic !== null && topic.recoveryPoint?.startsWith("monitor-formal-acceptance-")
    && proposal.distributionPlan === null
    && proposal.distributedTaskIds.length === 0
    && run?.topicId === topic.topicId
    && run.proposalId === proposal.proposalId;
  if (monitorAcceptanceCard) {
    const occurredAt = run.completedAt || run.updatedAt;
    const finalConclusion = readFinalConclusion(evolution, proposal);
    const latestAcceptance = readLatestAcceptance(evolution, proposal);
    const hostStartupAcceptance = readHostStartupAcceptance(evolution, proposal);
    const verified = topic.status === "completed" && proposal.status === "completed"
      && finalConclusion !== null && latestAcceptance?.status === "passed";
    const failed = topic.status === "supplement-required" || run.status === "blocked" || latestAcceptance?.status === "failed";
    return {
      topicId: topic.topicId, proposalId: proposal.proposalId,
      status: verified ? "completed" : topic.status === "completed" ? "completed-unverified" : failed ? "failed-pending-repair" : "pending-acceptance", title: topic.title,
      summary: verified ? (proposal.resultSummary || "正式页面验收通过，专题已完成。")
        : topic.status === "completed" ? "完成状态缺少可追溯验收记录，尚未核验。"
          : failed ? "独立页面验收未通过，等待核对失败证据。" : "正式版本已交付，等待独立页面验收。", repairContent: proposal.content,
      remaining: verified ? "" : "缺少当前专题的唯一最终验收结论及通过记录。", waitingFor: verified ? "当前无需操作" : "韩立独立验收",
      nextAction: verified ? "可开始下一专题。" : "核对正式页面验收证据并记录最终结论。", userAction: "none",
      resumeOneShotRunId: null,
      readRecovery: readRecovery("none", verified ? "当前无需操作" : "韩立独立验收", verified ? "可开始下一专题。" : "核对正式页面验收证据并记录最终结论。", occurredAt),
      effectiveTaskIds: [], missingTaskIds: [], latestAcceptance, finalConclusion,
      hostStartupAcceptance, deliveryEvidence: { ...emptyDeliveryEvidence(), acceptance: verified ? "passed" : "missing" }, updatedAt: occurredAt,
    };
  }

  const execution = new ProposalExecutionAggregate({ proposal, collaborationTasks: collaboration.tasks }).view();
  const latestAcceptance = readLatestAcceptance(evolution, proposal);
  const finalConclusion = readFinalConclusion(evolution, proposal);
  const hostStartupAcceptance = readHostStartupAcceptance(evolution, proposal);
  const task = latestEffectiveTask(execution.effectiveTasks);
  const deliveryEvidence = readDeliveryEvidence(execution.effectiveTasks, collaboration, latestAcceptance);
  const deliveryGate = readDeliveryGate(deliveryEvidence);
  const taskNeedsConfirmation = execution.effectiveTasks.some((item) => item.repairRequiresUserConfirmation === true);
  // 只有原流程已进入真实验收，且开始时间晚于上次结果，才展示新一轮验收中。
  const acceptanceStarted = run?.status === "running" && run.phase === "accepting"
    && (!latestAcceptance || run.updatedAt > latestAcceptance.occurredAt);
  // 完成态后的真实复核仍属于当前专题；运行明确阻塞时不得让旧完成事实覆盖恢复入口。
  const runBlocked = run?.status === "blocked"
    && run.topicId === topic?.topicId
    && run.proposalId === proposal.proposalId;
  const failedAcceptance = latestAcceptance?.status === "failed" || latestAcceptance?.status === "blocked";
  let status: CurrentTopicStageOutDto["status"] = "executing";
  if (awaitingConfirmation || taskNeedsConfirmation) status = "awaiting-confirmation";
  else if (runBlocked) status = "failed-pending-repair";
  else if (acceptanceStarted) status = "accepting";
  else if (failedAcceptance) status = "failed-pending-repair";
  else if (proposal.status === "completed") status = finalConclusion ? "completed" : "completed-unverified";
  else if (deliveryGate) status = deliveryGate.status;
  else if (execution.blocked) status = "failed-pending-repair";
  else if (execution.nextStatus === "verifying") status = "verifying";

  const userAction = status === "awaiting-confirmation" ? "confirmation" : status === "failed-pending-repair" && (taskNeedsConfirmation || runBlocked) ? "resume" : "none";
  const updatedAt = [proposal.updatedAt, task?.updatedAt, latestAcceptance?.occurredAt].filter((item): item is string => Boolean(item)).sort().at(-1) || evolution.updatedAt;
  const waitingFor = stageWaitingFor(status, deliveryGate);
  const nextAction = stageNextAction(status, deliveryGate);

  return {
    topicId: topic?.topicId || proposal.topicId,
    proposalId: proposal.proposalId,
    status,
    title: topic?.title || proposal.title,
    summary: stageSummary(status, execution.summary, latestAcceptance, deliveryGate),
    repairContent: task?.resultSummary?.changes || task?.resultSummary?.solvedProblem || task?.snapshot.confirmedIntent || proposal.content,
    remaining: stageRemaining(status, task, execution.missingTaskIds, deliveryGate),
    waitingFor,
    nextAction,
    userAction,
    // 一次性专题阻塞必须携带原运行标识，Renderer 才能调用已有补验恢复入口；任务级卡点继续保持空值。
    resumeOneShotRunId: userAction === "resume" && runBlocked ? run.runId : null,
    resumeTaskId: null,
    customerActionGuidance: null,
    readRecovery: readRecovery(userAction, waitingFor, nextAction, updatedAt),
    effectiveTaskIds: execution.effectiveTasks.map((item) => item.taskId),
    missingTaskIds: execution.missingTaskIds,
    latestAcceptance,
    finalConclusion,
    hostStartupAcceptance,
    deliveryEvidence,
    updatedAt,
  };
}

/** 只接受与完成提案、通过验收运行和完整条件证据绑定的同一快照档案。 */
function readFinalConclusion(evolution: EvolutionStateOutDto, proposal: EvolutionStateOutDto["proposals"][number]): NonNullable<CurrentTopicStageOutDto["finalConclusion"]> | null {
  const recordId = proposal.finalConclusionRecordId;
  if (proposal.status !== "completed" || typeof recordId !== "string" || !recordId) return null;
  const record = evolution.archiveRecords.find((item) => item.recordId === recordId
    && item.eventType === "proposal.result_decided"
    && item.topicId === proposal.topicId
    && item.proposalId === proposal.proposalId);
  const value = record?.payload.finalConclusion;
  if (!record || !value || typeof value !== "object") return null;
  const conclusion = value as {
    recordId?: unknown; handler?: unknown; occurredAt?: unknown; acceptanceRunId?: unknown;
    conditionResults?: unknown; evidenceReferences?: unknown;
  };
  if (conclusion.recordId !== record.recordId || typeof conclusion.handler !== "string" || !conclusion.handler.trim()
    || typeof conclusion.occurredAt !== "string" || typeof conclusion.acceptanceRunId !== "string"
    || !Array.isArray(conclusion.conditionResults) || !conclusion.conditionResults.length
    || !Array.isArray(conclusion.evidenceReferences) || !conclusion.evidenceReferences.length) return null;
  const acceptance = readLatestAcceptance(evolution, proposal);
  if (acceptance?.runId !== conclusion.acceptanceRunId || acceptance.status !== "passed") return null;
  const conditionResults: NonNullable<CurrentTopicStageOutDto["finalConclusion"]>["conditionResults"] = [];
  for (const raw of conclusion.conditionResults) {
    const item = raw as { checkId?: unknown; status?: unknown; evidenceReferences?: unknown };
    if (typeof item.checkId !== "string" || item.status !== "passed"
      || !Array.isArray(item.evidenceReferences) || !item.evidenceReferences.length
      || item.evidenceReferences.some((reference) => typeof reference !== "string" || !reference.trim())) return null;
    conditionResults.push({ checkId: item.checkId, status: item.status, evidenceReferences: [...item.evidenceReferences] });
  }
  if (conclusion.evidenceReferences.some((reference) => typeof reference !== "string" || !reference.trim())) return null;
  const evidenceReferences = conclusion.evidenceReferences as string[];
  return {
    recordId: record.recordId,
    handler: conclusion.handler,
    occurredAt: conclusion.occurredAt,
    acceptanceRunId: conclusion.acceptanceRunId,
    conditionResults,
    evidenceReferences: [...evidenceReferences],
  };
}

function emptyDeliveryEvidence(): CurrentTopicStageOutDto["deliveryEvidence"] {
  return { candidate: null, unifiedTest: "missing", release: "missing", restartHealth: "missing", acceptance: "missing" };
}

function emptyHostStartupAcceptance(reason = "尚未记录当前专题的 Host 启动验收依据。"): CurrentTopicStageOutDto["hostStartupAcceptance"] {
  return { launchId: null, handler: null, startedAt: null, commandStatus: "missing", exitCode: null, healthStatus: "missing", healthSummary: null, evidenceReadable: false, evidenceReferences: [], launcherSource: null, healthResponse: null, status: "unverified", reason };
}

/** 只读取当前专题、当前提案的专用档案；审批、发布和历史记录均不参与。 */
function readHostStartupAcceptance(evolution: EvolutionStateOutDto, proposal: EvolutionStateOutDto["proposals"][number]): CurrentTopicStageOutDto["hostStartupAcceptance"] {
  const record = [...evolution.archiveRecords].reverse().find((item) => item.eventType === "host-startup.evidence-recorded" && item.topicId === proposal.topicId && item.proposalId === proposal.proposalId);
  const raw = record?.payload.hostStartupEvidence;
  if (!raw || typeof raw !== "object") return emptyHostStartupAcceptance();
  const value = raw as { launchId?: unknown; handler?: unknown; startedAt?: unknown; command?: { launchId?: unknown; state?: unknown; exitCode?: unknown }; health?: { launchId?: unknown; success?: unknown; checkedAt?: unknown; summary?: unknown }; evidenceSnapshot?: { launcherSource?: unknown; healthResponse?: unknown }; evidenceReferences?: unknown };
  const launchId = typeof value.launchId === "string" ? value.launchId : null;
  const handler = typeof value.handler === "string" ? value.handler : null;
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : null;
  const commandStatus = value.command?.state === "running" || value.command?.state === "exited"
    ? value.command.state
    : typeof value.command?.exitCode === "number" ? "exited" : "missing";
  const exitCode = typeof value.command?.exitCode === "number" ? value.command.exitCode : null;
  const healthSummary = typeof value.health?.summary === "string" ? value.health.summary : null;
  const healthStatus = value.health?.success === true ? "passed" : value.health?.success === false ? "failed" : "missing";
  const evidenceReferences = Array.isArray(value.evidenceReferences) ? value.evidenceReferences.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  let healthResponseReadable = false;
  if (typeof value.evidenceSnapshot?.healthResponse === "string" && value.evidenceSnapshot.healthResponse === healthSummary) {
    try {
      const response = JSON.parse(value.evidenceSnapshot.healthResponse) as { success?: unknown; data?: { status?: unknown } };
      healthResponseReadable = response.success === true && response.data?.status === "READY";
    } catch { healthResponseReadable = false; }
  }
  const launcherSource = typeof value.evidenceSnapshot?.launcherSource === "string" ? value.evidenceSnapshot.launcherSource : null;
  const healthResponse = typeof value.evidenceSnapshot?.healthResponse === "string" ? value.evidenceSnapshot.healthResponse : null;
  const expectedReferences = launchId ? [`archive://host-startup/${encodeURIComponent(launchId)}/launcherSource`, `archive://host-startup/${encodeURIComponent(launchId)}/healthResponse`] : [];
  // 引用只指向本次不可覆盖档案中的两个字段，避免把当前文件或已关闭的 8080 服务误当成可读历史依据。
  const evidenceReadable = launcherSource?.startsWith("#!/bin/zsh") === true && healthResponseReadable && evidenceReferences.length === expectedReferences.length
    && expectedReferences.every((reference) => evidenceReferences.includes(reference));
  const matchedLaunch = Boolean(launchId && value.command?.launchId === launchId && value.health?.launchId === launchId);
  const commandAccepted = commandStatus === "exited" && exitCode === 0;
  const passed = Boolean(matchedLaunch && handler?.trim() && startedAt && commandAccepted && healthStatus === "passed" && typeof value.health?.checkedAt === "string" && evidenceReadable && evidenceReferences.length);
  return { launchId, handler, startedAt, commandStatus, exitCode, healthStatus, healthSummary, evidenceReadable, evidenceReferences, launcherSource, healthResponse, status: passed ? "passed" : "unverified", reason: passed ? "同一启动标识的退出码、8080 health 和可读证据快照均已核验。" : "Host 启动依据不完整、失败、不可读取或未绑定同一启动标识。" };
}

function readDeliveryEvidence(tasks: CollaborationTaskOutDto[], collaboration: CollaborationStateOutDto, acceptance: CurrentTopicAcceptanceOutDto | null): CurrentTopicStageOutDto["deliveryEvidence"] {
  if (!tasks.length) return { ...emptyDeliveryEvidence(), acceptance: acceptance?.status || "missing" };
  const generations = [...new Set(tasks.map((task) => task.integrationGeneration).filter((value): value is number => value !== null))];
  const generation = generations.length === 1 ? generations[0] : null;
  const batch = generation === null ? null : collaboration.integrationBatches?.find((item) => item.generation === generation) || null;
  const candidate = batch?.integrationSha ? { generation: batch.generation, integrationSha: batch.integrationSha } : null;
  const hasEvent = (task: CollaborationTaskOutDto, type: CollaborationTaskOutDto["flowEvents"][number]["type"]) => task.flowEvents.some((event) => event.type === type && event.status === "completed");
  const unifiedTest = tasks.every((task) => task.unifiedTest?.status === "passed" && hasEvent(task, "unified_test.passed")) ? "passed"
    : tasks.some((task) => task.unifiedTest?.status === "failed") ? "failed" : "missing";
  const release = candidate && tasks.every((task) => hasEvent(task, "release.published")) ? "published" : "missing";
  const restartHealth = release === "published" && tasks.every((task) => hasEvent(task, "release.restart_healthy")) ? "passed" : "missing";
  return { candidate, unifiedTest, release, restartHealth, acceptance: acceptance?.status || "missing" };
}

type DeliveryGate = {
  status: CurrentTopicStageOutDto["status"];
  summary: string;
  remaining: string;
  waitingFor: string;
  nextAction: string;
};

/** 按交付闭环顺序找出第一个未满足事实，避免待验收状态掩盖候选或门禁缺项。 */
function readDeliveryGate(evidence: CurrentTopicStageOutDto["deliveryEvidence"]): DeliveryGate | null {
  if (!evidence.candidate) {
    return { status: "verifying", summary: "当前交付缺少最终候选，不能进入真实验收。", remaining: "缺少最终候选。", waitingFor: "最终候选", nextAction: "生成最终候选，并关联当前有效任务链。" };
  }
  if (evidence.unifiedTest === "failed") {
    return { status: "failed-pending-repair", summary: "最终候选的完整统一测试未通过，不能进入发布或真实验收。", remaining: "完整统一测试未通过。", waitingFor: "原任务恢复处理", nextAction: "保留完整统一测试失败证据并从原恢复点处理。" };
  }
  if (evidence.unifiedTest === "missing") {
    return { status: "verifying", summary: "最终候选缺少完整统一测试结论，不能进入发布或真实验收。", remaining: "缺少完整统一测试结论。", waitingFor: "完整统一测试结论", nextAction: "完成最终候选的完整统一测试，并记录通过或失败结果。" };
  }
  if (evidence.release === "missing") {
    return { status: "awaiting-release", summary: "最终候选已通过完整测试，缺少发布结果。", remaining: "缺少发布结果。", waitingFor: "发布服务", nextAction: "发布最终候选，并记录发布结果。" };
  }
  if (evidence.restartHealth === "missing") {
    return { status: "awaiting-restart-health", summary: "候选验证已完成，等待打包与重启健康检查确认发布结果。", remaining: "缺少重启健康检查结果。", waitingFor: "新版本重启健康检查", nextAction: "完成新版本重启健康检查，并记录结果。" };
  }
  if (evidence.acceptance === "passed") return null;
  if (evidence.acceptance === "running") {
    return { status: "accepting", summary: "韩立已开始本轮结果验收。", remaining: "等待真实验收结果。", waitingFor: "韩立真实验收", nextAction: "等待韩立记录本轮真实验收结果。" };
  }
  return { status: "pending-acceptance", summary: "最终候选已完成测试、发布和重启健康检查，缺少真实验收结果。", remaining: "缺少真实验收结果。", waitingFor: "韩立真实验收", nextAction: "韩立按真实路径验收最终候选，并记录结果。" };
}

function hasPendingConfirmation(evolution: EvolutionStateOutDto): boolean {
  const pendingDeliberation = evolution.deliberations.some((item) => item.status === "ready-to-establish"
    && Boolean(item.rounds.at(-1)?.confirmation) && !item.rounds.at(-1)?.confirmation?.reply);
  return pendingDeliberation || evolution.oneShotConfirmation?.status === "awaiting-user-confirmation";
}

function confirmationUpdatedAt(evolution: EvolutionStateOutDto): string {
  return evolution.oneShotConfirmation?.createdAt || evolution.deliberations.flatMap((item) => item.rounds).at(-1)?.confirmation?.offeredAt || evolution.updatedAt;
}

function readLatestAcceptance(evolution: EvolutionStateOutDto, proposal: EvolutionStateOutDto["proposals"][number]): CurrentTopicAcceptanceOutDto | null {
  const record = evolution.archiveRecords.filter((item) => item.proposalId === proposal.proposalId && item.eventType === "acceptance.result_checked")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  const acceptanceRun = record?.payload.acceptanceRun;
  if (!record || !acceptanceRun || typeof acceptanceRun !== "object") return null;
  const value = acceptanceRun as { runId?: unknown; status?: unknown; planId?: unknown; acceptanceRoundId?: unknown };
  if (typeof value.runId !== "string" || !["running", "passed", "failed", "blocked"].includes(String(value.status))) return null;
  // 新计划链只显示当前验收轮次；旧归档没有计划时保留历史投影，但不能覆盖重开后的待验收状态。
  if (proposal.acceptancePlan && (value.planId !== proposal.acceptancePlan.planId || value.acceptanceRoundId !== proposal.acceptancePlan.currentRoundId)) return null;
  return { runId: value.runId, status: value.status as CurrentTopicAcceptanceOutDto["status"], occurredAt: record.occurredAt };
}

function latestEffectiveTask(tasks: CollaborationTaskOutDto[]): CollaborationTaskOutDto | null {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
}

function stageSummary(status: CurrentTopicStageOutDto["status"], executionSummary: string, acceptance: CurrentTopicAcceptanceOutDto | null, deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.summary;
  if (status === "failed-pending-repair") return acceptance ? `最新真实验收 ${acceptance.runId} 未通过，等待按原恢复点处理。` : executionSummary;
  if (status === "pending-acceptance") return "当前有效任务已经完成，等待韩立选择适用的结果验收方式。";
  if (status === "awaiting-release") return "最终候选已通过完整测试，等待发布结果。";
  if (status === "awaiting-restart-health") return "候选验证已完成，等待重启健康检查确认发布结果。";
  if (status === "accepting") return "韩立已开始本轮结果验收。";
  if (status === "completed") return "韩立结果验收已经通过，专题已完成。";
  if (status === "completed-unverified") return "尚未核验：当前无法确认最终验收通过。";
  return executionSummary;
}

function stageWaitingFor(status: CurrentTopicStageOutDto["status"], deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.waitingFor;
  // 专题已经完成时不再虚构处理中处理人，卡片只说明当前无需操作。
  if (status === "completed") return "当前无需操作";
  if (status === "completed-unverified") return "验收依据";
  if (status === "awaiting-confirmation") return "用户确认";
  if (status === "awaiting-release") return "发布服务";
  if (status === "awaiting-restart-health") return "新版本重启健康检查";
  if (status === "pending-acceptance" || status === "accepting") return "韩立真实验收";
  if (status === "failed-pending-repair") return "原任务恢复处理";
  return "当前任务处理者";
}

function stageNextAction(status: CurrentTopicStageOutDto["status"], deliveryGate: DeliveryGate | null): string {
  if (deliveryGate?.status === status) return deliveryGate.nextAction;
  // 完成结论已闭合，下一步是开始独立的新专题而不是继续当前处理。
  if (status === "completed") return "可开始下一专题。";
  if (status === "completed-unverified") return "系统重新读取权威记录；仍无法取得时由结果验收流程重新记录本轮结论。";
  if (status === "awaiting-confirmation") return "确认当前范围说明后继续。";
  if (status === "awaiting-release") return "发布最终候选，并记录发布结果。";
  if (status === "awaiting-restart-health") return "完成新版本重启健康检查。";
  if (status === "pending-acceptance") return "韩立按真实路径验收最终候选。";
  if (status === "accepting") return "等待韩立记录本轮真实验收结果。";
  if (status === "failed-pending-repair") return "保留失败证据并从原恢复点处理。";
  return "完成当前处理后刷新交付结论。";
}

function stageRemaining(status: CurrentTopicStageOutDto["status"], task: CollaborationTaskOutDto | null, missingTaskIds: string[], deliveryGate: DeliveryGate | null): string {
  if (missingTaskIds.length > 0) return `关联任务记录缺失：${missingTaskIds.join("、")}`;
  if (deliveryGate?.status === status) return deliveryGate.remaining;
  if (status === "failed-pending-repair") return task?.blockingReason || task?.resultSummary?.remaining || "等待处理最新真实验收失败。";
  return task?.resultSummary?.remaining || task?.blockingReason || "";
}

/** 读取恢复只复用档案投影已经声明的用户操作，不因 Renderer 的本地重试次数升级权限。 */
function readRecovery(userAction: CurrentTopicStageOutDto["userAction"], waitingFor: string, nextAction: string, updatedAt: string): CurrentTopicStageOutDto["readRecovery"] {
  const requiresUserAction = userAction !== "none";
  return {
    policyId: `${updatedAt}:${userAction}`,
    waitingFor: requiresUserAction ? waitingFor : "当前交付投影",
    requiresUserAction,
    nextAction: requiresUserAction ? `${nextAction} 完成后重新读取当前交付投影。` : "系统将自动重新读取当前交付投影；读取成功后再显示当前结论。",
  };
}
