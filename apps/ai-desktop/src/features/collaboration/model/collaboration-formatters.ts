/**
 * 协作页面显示文本转换器。
 *
 * 主进程只提供稳定状态码和原始时间；本文件负责把它们转换成中文或日文。
 * 这里不修改任务状态，也不参与人物调度。
 */

import type {
  // 协作成员：读取人物当前状态、阶段和更新时间。
  CollaborationMemberOutDto,
  // 协作总状态：复用其中的任务状态联合类型，确保文案不会漏掉新状态。
  CollaborationStateOutDto,
  // 协作任务：格式化计划、执行记录和真实执行人。
  CollaborationTaskOutDto,
  // 界面语言：在中文和日文文案之间选择。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";

/** 人物状态显示输入：只接受协作状态存储已发布的成员快照。 */
export type CollaborationMemberDisplayModelInput = {
  /** 当前需要显示状态的协作成员；首次同步或读取失败时允许为空。 */
  member: CollaborationMemberOutDto | null;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 协作状态存储的读取结果；页面不能把旧时间线当成当前成员状态。 */
  status?: "syncing" | "ready" | "unavailable";
};

type MemberState = CollaborationMemberOutDto["state"];
type TaskState = CollaborationStateOutDto["tasks"][number]["state"];

/** 普通成员状态的中文文案。 */
const CHINESE_MEMBER_STATE_LABELS: Record<MemberState, string> = {
  idle: "空闲",
  conversation: "会话中",
  assigned: "已分配",
  working: "正在执行",
  retiring: "正在关闭连接",
  recovering: "等待恢复",
  draining: "等待退出",
  offline: "离线",
};

/** 普通成员状态的日文文案。 */
const JAPANESE_MEMBER_STATE_LABELS: Record<MemberState, string> = {
  idle: "待機",
  conversation: "会話中",
  assigned: "割当済み",
  working: "実行中",
  retiring: "接続終了中",
  recovering: "復旧待ち",
  draining: "終了待ち",
  offline: "オフライン",
};

/** 协作任务状态的中文文案。 */
const CHINESE_TASK_STATE_LABELS: Record<TaskState, string> = {
  "queued-executor": "等待执行人",
  "preparing-worktree": "准备独立版本",
  analyzing: "技术分析",
  executing: "执行修改",
  "repairing-execution": "令狐修复执行问题",
  "returned-to-nangong": "已返回南宫婉",
  "ready-for-integration": "本轮已封存",
  "queued-integration": "已进入测试批次",
  integrating: "正在集成",
  "unified-testing": "令狐老祖正在统一测试",
  "awaiting-restart": "等待重启确认",
  "test-failed": "统一测试失败",
  integrated: "统一测试通过",
  blocked: "已阻塞",
  recovering: "等待恢复",
  cancelled: "已取消",
};

/** 协作任务状态的日文文案。 */
const JAPANESE_TASK_STATE_LABELS: Record<TaskState, string> = {
  "queued-executor": "実行者待ち",
  "preparing-worktree": "独立版を準備",
  analyzing: "技術分析",
  executing: "変更実行中",
  "repairing-execution": "令狐が実行問題を修復中",
  "returned-to-nangong": "南宮婉へ返却済み",
  "ready-for-integration": "ラウンド確定済み",
  "queued-integration": "テストキュー",
  integrating: "統合中",
  "unified-testing": "令狐が統合テスト中",
  "awaiting-restart": "再起動確認待ち",
  "test-failed": "統合テスト失敗",
  integrated: "統合テスト合格",
  blocked: "ブロック",
  recovering: "復旧待ち",
  cancelled: "キャンセル",
};

/** 工作中人物存在细分阶段时，优先展示比“正在执行”更具体的中文文案。 */
function memberPhaseLabel(member: CollaborationMemberOutDto): string | null {
  if (member.state !== "working" || !member.phase) return null;

  const labels = {
    analyzing: "技术分析中",
    planning: "整理方案中",
    implementing: "执行修改中",
    verifying: "自检中",
    finalizing: "整理结果中",
    ready: "等待下一步",
    blocked: "已阻塞",
    failed: "处理失败",
  };
  return labels[member.phase];
}

/** 左侧人物栏与人物页共用的当前状态模型，只读取成员状态、任务编号和阶段。 */
export function collaborationMemberDisplayModel(
  input: CollaborationMemberDisplayModelInput,
): { presence: MemberState; label: string } {
  const { member, locale, status = "ready" } = input;
  // 成员快照尚未取得或读取失败时，不从历史节点推测人物仍在处理什么。
  if (!member) {
    const label = status === "unavailable"
      ? locale === "ja" ? "状態は未更新です" : "状态暂未更新"
      : locale === "ja" ? "同期中" : "正在同步";
    return { presence: "offline", label };
  }
  // 没有当前任务时，历史时间线、研讨或会话活动均不能把成员重新投影为忙碌。
  const presence = member.currentTaskId ? member.state : "idle";
  // 阶段只属于当前在途任务；空闲成员不能继续显示上一轮的阶段。
  const phaseLabel = member.currentTaskId ? memberPhaseLabel(member) : null;
  const label = phaseLabel || (locale === "ja"
    ? JAPANESE_MEMBER_STATE_LABELS[presence]
    : CHINESE_MEMBER_STATE_LABELS[presence]);
  return { presence, label };
}

/** 把协作任务状态码转换成当前界面语言的客户文案。 */
export function collaborationTaskStateLabel(state: TaskState, locale: LocaleValue): string {
  return locale === "ja" ? JAPANESE_TASK_STATE_LABELS[state] : CHINESE_TASK_STATE_LABELS[state];
}

/** 从任务执行记录中提取去重后的真实执行人姓名，并保留首次出现顺序。 */
export function collaborationExecutorNames(task: CollaborationTaskOutDto): string[] {
  const namesByMemberId = task.executionRecords.map((record) => {
    return [record.executor.memberId, record.executor.displayName] as const;
  });
  return [...new Map(namesByMemberId).values()];
}

/** 把任务计划状态转换成当前界面语言。 */
export function collaborationPlanStatusLabel(
  status: CollaborationTaskOutDto["plans"][number]["status"],
  locale: LocaleValue,
): string {
  const chinese = { "ready-for-execution": "技术分析完成" } as const;
  const japanese = { "ready-for-execution": "技術分析完了" } as const;
  return locale === "ja" ? japanese[status] : chinese[status];
}

/** 把单次执行记录状态转换成当前界面语言。 */
export function collaborationExecutionStatusLabel(
  status: CollaborationTaskOutDto["executionRecords"][number]["status"],
  locale: LocaleValue,
): string {
  const chinese = {
    assigned: "已分配",
    analyzing: "分析中",
    executing: "执行中",
    "code-verified": "代码已验证",
    transferred: "已转交",
    blocked: "已阻塞",
    cancelled: "已取消",
  } as const;
  const japanese = {
    assigned: "割当済み",
    analyzing: "分析中",
    executing: "実行中",
    "code-verified": "コード検証済み",
    transferred: "引継ぎ済み",
    blocked: "ブロック",
    cancelled: "キャンセル",
  } as const;
  return locale === "ja" ? japanese[status] : chinese[status];
}

/** 把 ISO 时间转换成带日期和秒的本地显示文本。 */
export function formatCollaborationTime(value: string | null, locale: LocaleValue): string {
  if (!value) return locale === "ja" ? "進行中" : "进行中";

  const parsedTime = new Date(value);
  if (Number.isNaN(parsedTime.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsedTime);
}

/** 把开始和完成时间转换成“天、小时、分钟、秒”的业务耗时。 */
export function formatCollaborationDuration(
  startedAt: string,
  completedAt: string | null,
  locale: LocaleValue,
): string {
  if (!completedAt) return locale === "ja" ? "進行中" : "进行中";

  const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
  if (!Number.isFinite(durationMs)) return "—";

  const totalSeconds = Math.floor(durationMs / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const chineseUnits = [
    days > 0 ? `${days}天` : "",
    hours > 0 ? `${hours}小时` : "",
    minutes > 0 ? `${minutes}分钟` : "",
    `${seconds}秒`,
  ];
  const japaneseUnits = [
    days > 0 ? `${days}日` : "",
    hours > 0 ? `${hours}時間` : "",
    minutes > 0 ? `${minutes}分` : "",
    `${seconds}秒`,
  ];

  const units = locale === "ja" ? japaneseUnits : chineseUnits;
  return units.filter(Boolean).join(" ");
}
