import type { CollaborationMemberOutDto, CollaborationStateOutDto, CollaborationTaskOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";

export function collaborationMemberStateLabel(member: CollaborationMemberOutDto, locale: LocaleValue): string {
  const chinese: Record<CollaborationMemberOutDto["state"], string> = { idle: "空闲", conversation: "会话中", assigned: "已分配", working: member.phase === "verifying" ? "正在验证" : member.phase === "finalizing" ? "正在收尾" : "正在执行", retiring: "正在关闭连接", recovering: "等待恢复", draining: "等待退出", offline: "离线" };
  const japanese: Record<CollaborationMemberOutDto["state"], string> = { idle: "待機", conversation: "会話中", assigned: "割当済み", working: "実行中", retiring: "接続終了中", recovering: "復旧待ち", draining: "終了待ち", offline: "オフライン" };
  return (locale === "ja" ? japanese : chinese)[member.state];
}
export function collaborationTaskStateLabel(state: CollaborationStateOutDto["tasks"][number]["state"], locale: LocaleValue): string {
  const chinese: Record<CollaborationStateOutDto["tasks"][number]["state"], string> = { "queued-executor": "等待执行人", "preparing-worktree": "准备独立版本", analyzing: "技术分析", executing: "执行修改", "repairing-execution": "令狐修复执行问题", "returned-to-nangong": "已返回南宫婉", "ready-for-integration": "本轮已封存", "queued-integration": "已进入测试批次", integrating: "正在集成", "unified-testing": "令狐老祖正在统一测试", "awaiting-restart": "等待重启确认", "test-failed": "统一测试失败", integrated: "统一测试通过", blocked: "已阻塞", recovering: "等待恢复", cancelled: "已取消" };
  const japanese: Record<CollaborationStateOutDto["tasks"][number]["state"], string> = { "queued-executor": "実行者待ち", "preparing-worktree": "独立版を準備", analyzing: "技術分析", executing: "変更実行中", "repairing-execution": "令狐が実行問題を修復中", "returned-to-nangong": "南宮婉へ返却済み", "ready-for-integration": "ラウンド確定済み", "queued-integration": "テストキュー", integrating: "統合中", "unified-testing": "令狐が統合テスト中", "awaiting-restart": "再起動確認待ち", "test-failed": "統合テスト失敗", integrated: "統合テスト合格", blocked: "ブロック", recovering: "復旧待ち", cancelled: "キャンセル" };
  return (locale === "ja" ? japanese : chinese)[state];
}

export function collaborationExecutorNames(task: CollaborationTaskOutDto): string[] {
  return [...new Map(task.executionRecords.map((record) => [record.executor.memberId, record.executor.displayName])).values()];
}

export function collaborationPlanStatusLabel(status: CollaborationTaskOutDto["plans"][number]["status"], locale: LocaleValue): string {
  const chinese = { "ready-for-execution": "技术分析完成" } as const;
  const japanese = { "ready-for-execution": "技術分析完了" } as const;
  return (locale === "ja" ? japanese : chinese)[status];
}

export function collaborationExecutionStatusLabel(status: CollaborationTaskOutDto["executionRecords"][number]["status"], locale: LocaleValue): string {
  const chinese = { assigned: "已分配", analyzing: "分析中", executing: "执行中", "code-verified": "代码已验证", transferred: "已转交", blocked: "已阻塞", cancelled: "已取消" } as const;
  const japanese = { assigned: "割当済み", analyzing: "分析中", executing: "実行中", "code-verified": "コード検証済み", transferred: "引継ぎ済み", blocked: "ブロック", cancelled: "キャンセル" } as const;
  return (locale === "ja" ? japanese : chinese)[status];
}

export function formatCollaborationTime(value: string | null, locale: LocaleValue): string {
  if (!value) return locale === "ja" ? "進行中" : "进行中";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(parsed);
}

export function formatCollaborationDuration(startedAt: string, completedAt: string | null, locale: LocaleValue): string {
  if (!completedAt) return locale === "ja" ? "進行中" : "进行中";
  const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
  if (!Number.isFinite(durationMs)) return "—";
  const totalSeconds = Math.floor(durationMs / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const units = locale === "ja" ? [days && `${days}日`, hours && `${hours}時間`, minutes && `${minutes}分`, `${seconds}秒`] : [days && `${days}天`, hours && `${hours}小时`, minutes && `${minutes}分钟`, `${seconds}秒`];
  return units.filter(Boolean).join(" ");
}
