/**
 * 任务协作群的纯显示转换函数。
 * 这些函数不读取 React 状态，也不写入后端，便于新手单独理解和测试。
 */

import type {
  // 时间线专题：生成专题状态和耗时文案。
  CollaborationTimelineGroupOutDto,
  // 时间线节点：筛选恢复入口并生成节点显示信息。
  CollaborationTimelineNodeOutDto,
  // 界面语言：选择中文或日文文案。
  LocaleValue,
} from "../../../../../contracts/system/desktop/index";

/** 专题头部当前活动的显示事实，人数和姓名始终来自同一组当前节点。 */
export type GroupActivityPresentation = {
  /** 当前仍在处理专题的去重人物名称。 */
  activeOwnerLabels: string[];
  /** 专题状态文案；真实验收时明确显示验收人物。 */
  statusLabel: string;
};

/** 从当前节点生成专题头部活动事实，避免人数统计与人物名称使用不同来源。 */
export function groupActivityPresentation(
  group: CollaborationTimelineGroupOutDto,
  locale: LocaleValue,
): GroupActivityPresentation {
  const activeOwnerLabels = new Map<string, string>();
  let acceptanceNode: CollaborationTimelineNodeOutDto | undefined;

  for (const node of group.nodes) {
    if (node.status !== "current" || node.actor.memberId === "system") continue;
    const isAcceptance = node.kind === "verification" && node.nodeId.startsWith("acceptance:");
    if (isAcceptance) acceptanceNode = node;

    let roleLabel = "";
    if (isAcceptance) roleLabel = locale === "ja" ? "（受入確認）" : "（验收）";
    else if (node.kind === "verification") roleLabel = locale === "ja" ? "（検証）" : "（验证）";
    activeOwnerLabels.set(node.actor.memberId, `${node.actor.displayName}${roleLabel}`);
  }

  const statusLabel = group.status === "verifying" && acceptanceNode
    ? locale === "ja" ? `${acceptanceNode.actor.displayName}が受入確認中` : `${acceptanceNode.actor.displayName}验收中`
    : groupStatusLabel(group.status, locale);
  return { activeOwnerLabels: [...activeOwnerLabels.values()], statusLabel };
}

/** 任务卡主区域固定展示的四项用户信息。 */
export type TaskGroupPrimaryPresentation = {
  /** 当前正在发生的事项。 */
  matter: string;
  /** 当前处理人及其状态。 */
  ownerAndStatus: string;
  /** 用户是否需要执行操作。 */
  customerAction: string;
  /** 紧接着会发生的用户可读步骤。 */
  nextAction: string;
};

/**
 * 将专题权威状态转换成卡片主区域的四项用户语言。
 * 不解释技术流程，不读取或改写时间线事实。
 */
export function taskGroupPrimaryPresentation(
  group: CollaborationTimelineGroupOutDto,
  locale: LocaleValue,
): TaskGroupPrimaryPresentation {
  const activity = groupActivityPresentation(group, locale);
  const nextOwner = group.nextOwner?.displayName;
  // 历史专题只陈述已保存的时间线事实；当前操作只能由当前专题投影提供。
  const automaticallyProcessing = ["waiting-approval", "running", "verifying"].includes(group.status);
  if (locale === "ja") {
    return {
      matter: compactTimelineText(group.summary),
      ownerAndStatus: nextOwner ? `${nextOwner}：${activity.statusLabel}` : activity.statusLabel,
      customerAction: automaticallyProcessing ? "自動処理中です。お客様の操作は不要です。" : "お客様の操作は不要です。",
      nextAction: group.nextStep,
    };
  }
  return {
    matter: compactTimelineText(group.summary),
    ownerAndStatus: nextOwner ? `${nextOwner} · ${activity.statusLabel}` : activity.statusLabel,
    customerAction: automaticallyProcessing ? "正在自动处理中，暂不需要你操作。" : "当前无需你操作。",
    nextAction: group.nextStep,
  };
}

/** 兼容旧重复恢复数据：同一恢复状态段只显示最后一条等待记录。 */
export function visibleTimelineNodes(nodes: CollaborationTimelineNodeOutDto[]): CollaborationTimelineNodeOutDto[] {
  return nodes.filter((node, index) => {
    const isWaitingInterruption = node.taskId
      && node.eventType === "task.interrupted"
      && node.status === "waiting";
    if (!isWaitingInterruption) return true;

    const nextSameTask = nodes.slice(index + 1).find((candidate) => candidate.taskId === node.taskId);
    const nextIsSameWaitingState = nextSameTask?.eventType === "task.interrupted"
      && nextSameTask.status === "waiting";
    return !nextIsSameWaitingState;
  });
}

/** 页面只隐藏临时候选工作树根，原始数据库证据本身保持不变。 */
export function presentTimelineText(value: string): string {
  const candidateRootPattern = /(?:[A-Za-z]:)?[\\/][^\n"'`]*?[\\/]collaboration[\\/]worktrees[\\/](?:release[\\/][^\\/\s"'`]+|tasks[\\/][^\\/\s"'`]+[\\/]r\d+)(?=[\\/])/gu;
  return value.replace(candidateRootPattern, "[候选源码]");
}

/** 节点头部最多列出前三位收件人，其余只显示总人数。 */
export function recipientLabel(node: CollaborationTimelineNodeOutDto): string {
  const visibleNames = node.recipients.slice(0, 3).map((item) => item.displayName).join("、");
  const remainingCount = node.recipients.length - 3;
  const remainingLabel = remainingCount > 0 ? ` 等 ${node.recipients.length} 人` : "";
  return `→ ${visibleNames}${remainingLabel}`;
}

/** 把节点摘要压成单行，并限制在 120 个字符内。 */
export function compactTimelineText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}

/** 把专题状态转换成当前界面语言。 */
export function groupStatusLabel(
  status: CollaborationTimelineGroupOutDto["status"],
  locale: LocaleValue,
): string {
  const chinese: Record<CollaborationTimelineGroupOutDto["status"], string> = {
    "waiting-approval": "等待审批",
    running: "进行中",
    verifying: "验证中",
    blocked: "已阻塞",
    completed: "已完成",
    cancelled: "已取消",
  };
  const japanese: Record<CollaborationTimelineGroupOutDto["status"], string> = {
    "waiting-approval": "承認待ち",
    running: "進行中",
    verifying: "検証中",
    blocked: "停止",
    completed: "完了",
    cancelled: "取消",
  };
  return locale === "ja" ? japanese[status] : chinese[status];
}

/** 把节点状态转换成当前界面语言。 */
export function nodeStatusLabel(
  status: CollaborationTimelineNodeOutDto["status"],
  locale: LocaleValue,
): string {
  const chinese = { completed: "已完成", current: "进行中", waiting: "等待中", failed: "未通过" } as const;
  const japanese = { completed: "完了", current: "進行中", waiting: "待機", failed: "失敗" } as const;
  return locale === "ja" ? japanese[status] : chinese[status];
}

/** 把毫秒转换成页面使用的小时、分钟和秒。 */
export function formatTimelineDuration(durationMs: number, locale: LocaleValue): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return locale === "ja" ? `${hours}時間${minutes}分` : `${hours}小时${minutes}分`;
  }
  return `${minutes}分${seconds}秒`;
}

/** 根据节点状态计算静态或实时耗时文案。 */
export function nodeDurationLabel(
  node: CollaborationTimelineNodeOutDto,
  locale: LocaleValue,
  nowMs: number,
): string {
  let prefix = locale === "ja" ? "処理済み" : "已处理";
  if (node.status === "completed") prefix = locale === "ja" ? "処理時間" : "处理耗时";
  if (node.kind === "verification") prefix = locale === "ja" ? "検証済み" : "已验证";
  if (node.status === "waiting") prefix = locale === "ja" ? "待機" : "已等待";

  const nodeFinished = node.status === "completed" || node.status === "failed";
  const durationMs = node.completedAt || nodeFinished
    ? node.durationMs
    : Math.max(node.durationMs, nowMs - Date.parse(node.startedAt));
  return `${prefix} ${formatTimelineDuration(durationMs, locale)}`;
}

/** 根据详情的业务角色选择展开按钮文案。 */
export function detailLabel(node: CollaborationTimelineNodeOutDto, locale: LocaleValue): string {
  const chinese: Record<CollaborationTimelineNodeOutDto["detailRole"], string> = {
    none: "详情",
    "application-evidence": "申请依据",
    "approval-scope": "审批说明",
    "task-breakdown": "任务明细",
    "acceptance-criteria": "分析依据与验收条件",
    "changed-files": "执行变更",
    "verification-evidence": "验证详情",
    "recovery-conditions": "阻塞与恢复条件",
    "result-evidence": "结果依据",
  };
  const japanese: Record<CollaborationTimelineNodeOutDto["detailRole"], string> = {
    none: "詳細",
    "application-evidence": "申請根拠",
    "approval-scope": "承認説明",
    "task-breakdown": "タスク詳細",
    "acceptance-criteria": "分析根拠と受入条件",
    "changed-files": "実行変更",
    "verification-evidence": "検証詳細",
    "recovery-conditions": "停止と復旧条件",
    "result-evidence": "結果根拠",
  };
  return locale === "ja" ? japanese[node.detailRole] : chinese[node.detailRole];
}
