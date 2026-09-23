import type { CurrentTopicStageOutDto, EvolutionStateOutDto } from "../../../../contracts/services/evolution/index.js";
import { readCurrentTopicRecovery } from "./current-topic-read-recovery.js";

/** 尚未确立可执行提案时的唯一阶段；建立、研讨和确认不参与交付判定。 */
export function projectTopicPreparationStage(evolution: EvolutionStateOutDto, hasProposal: boolean): CurrentTopicStageOutDto | null {
  const run = evolution.oneShotRun;
  const independent = run?.topicEstablishmentMode === "independent-switch" && !run.topicId && !run.proposalId;
  if (independent && run.status === "blocked") return stage({
    status: "topic-establishment-failed", title: "新专题建立失败",
    summary: run.blockingReason || "新专题尚未建立，旧专题仍只保留审计记录。",
    remaining: run.blockingReason || "建立新专题时出现未完成步骤。", waitingFor: "系统恢复处理",
    nextAction: "保留建立失败证据并处理当前失败原因。", updatedAt: run.updatedAt,
  });

  const activeProposalRun = Boolean(run?.topicId && run.proposalId && run.status !== "completed");
  if (!activeProposalRun && hasPendingConfirmation(evolution)) {
    return stage({ status: "awaiting-confirmation", title: "等待用户确认",
      summary: "南宫婉已经给出本轮范围说明，等待用户确认。", remaining: "等待用户确认范围说明。",
      waitingFor: "用户确认", nextAction: "确认当前范围说明后继续。", userAction: "confirmation",
      updatedAt: confirmationUpdatedAt(evolution) });
  }

  const deliberation = !activeProposalRun
    ? [...evolution.deliberations].reverse().find((item) => item.status === "questioning" && item.topicId === null) || null
    : null;
  if (deliberation) return stage({
    status: "deliberating", title: "南宫婉正在内部研讨",
    summary: "韩立已确认当前问题，南宫婉正在与韩立核实范围和影响。",
    remaining: "等待本轮内部研讨形成可执行范围。", waitingFor: "南宫婉内部研讨",
    nextAction: "系统会继续当前研讨；形成可执行范围后再显示确认。", updatedAt: deliberation.updatedAt,
  });

  if (independent && run.status === "running") return stage({
    status: "establishing-topic", title: "正在建立新专题",
    summary: "旧专题已经退出当前区，系统正在继续研讨并建立新的独立专题。",
    remaining: "等待新的专题及其提案建立。", waitingFor: "系统正在处理",
    nextAction: "系统将继续当前研讨；建立完成后显示新的专题卡。", updatedAt: run.updatedAt,
  });
  if (hasProposal) return null;
  return stage({ status: "not-run", title: "暂无修复任务",
    summary: "当前没有可展示的专题提案。", remaining: "", waitingFor: "南宫婉",
    nextAction: "等待形成可执行专题。", updatedAt: evolution.updatedAt,
  });
}

function stage(input: {
  status: CurrentTopicStageOutDto["status"]; title: string; summary: string; remaining: string;
  waitingFor: string; nextAction: string; updatedAt: string; userAction?: CurrentTopicStageOutDto["userAction"];
}): CurrentTopicStageOutDto {
  const userAction = input.userAction || "none";
  return {
    topicId: null, proposalId: null, status: input.status, title: input.title, summary: input.summary,
    repairContent: "", remaining: input.remaining, waitingFor: input.waitingFor, nextAction: input.nextAction,
    userAction, resumeOneShotRunId: null,
    readRecovery: readCurrentTopicRecovery(userAction, input.waitingFor, input.nextAction, input.updatedAt),
    effectiveTaskIds: [], missingTaskIds: [], latestAcceptance: null,
    hostStartupAcceptance: { launchId: null, handler: null, startedAt: null, commandStatus: "missing", exitCode: null,
      healthStatus: "missing", healthSummary: null, evidenceReadable: false, evidenceReferences: [], launcherSource: null,
      healthResponse: null, status: "unverified", reason: "尚未记录当前专题的 Host 启动验收依据。" },
    deliveryEvidence: { candidate: null, unifiedTest: "missing", release: "missing", restartHealth: "missing", acceptance: "missing" },
    updatedAt: input.updatedAt,
  };
}

function hasPendingConfirmation(evolution: EvolutionStateOutDto): boolean {
  const pendingDeliberation = evolution.deliberations.some((item) => item.status === "ready-to-establish"
    && Boolean(item.rounds.at(-1)?.confirmation) && !item.rounds.at(-1)?.confirmation?.reply);
  return pendingDeliberation || evolution.oneShotConfirmation?.status === "awaiting-user-confirmation";
}

function confirmationUpdatedAt(evolution: EvolutionStateOutDto): string {
  return evolution.oneShotConfirmation?.createdAt || evolution.deliberations.flatMap((item) => item.rounds).at(-1)?.confirmation?.offeredAt || evolution.updatedAt;
}
