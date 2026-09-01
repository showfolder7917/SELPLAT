import type { EvolutionTopicDossierOutDto, LocaleValue } from "../../../../contracts/system/desktop/desktop";
import { EvolutionDisclosure } from "./EvolutionDisclosure";

/** 专题池展示来源对话、研讨和数据库执行时间线，不把原始 JSON 暴露给用户。 */
export function EvolutionTopicDossierView({ dossier }: { dossier: EvolutionTopicDossierOutDto }) {
  const sourceGroups = new Map<string, NonNullable<EvolutionTopicDossierOutDto["deliberation"]>["sourceSnapshots"]>();
  for (const snapshot of dossier.deliberation?.sourceSnapshots || []) {
    const key = `${snapshot.source}:${snapshot.conversationId}`;
    sourceGroups.set(key, [...(sourceGroups.get(key) || []), snapshot]);
  }
  const timeline = [...dossier.archiveRecords, ...dossier.executionRecords].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.sequenceNumber - right.sequenceNumber);
  return <section className="person-rail-section evolution-topic-dossier" aria-label="专题全生命周期原始档案">
    <div className="person-rail-heading"><h3>专题全流程原始档案</h3><span>{timeline.length} 条事件</span></div>
    <EvolutionDisclosure label={`来源对话原文 · ${dossier.deliberation?.sourceSnapshots.length || 0} 条`}>{[...sourceGroups.entries()].map(([group, messages]) => <EvolutionDisclosure key={group} label={`${group} · ${messages.length} 条`}>{messages.sort((left, right) => left.sequenceNumber - right.sequenceNumber).map((message) => <article key={message.snapshotId}><small>{message.originalCreatedAt} · {message.role}{message.responsePhase ? `/${message.responsePhase}` : ""}</small><p>{message.content}</p></article>)}</EvolutionDisclosure>)}</EvolutionDisclosure>
    {dossier.deliberation && <EvolutionDisclosure defaultOpen label={`韩立—南宫婉研讨 · ${dossier.deliberation.rounds.length} 轮`}>{dossier.deliberation.rounds.map((round) => <article key={round.roundId}><strong>第 {round.roundNumber} 轮</strong><p>韩立：{round.question}</p>{round.answer && <p>南宫婉：{round.answer}</p>}{round.assessment && <p>韩立判断：{round.assessment}</p>}</article>)}</EvolutionDisclosure>}
    <EvolutionDisclosure defaultOpen label="实施、测试、发布与验收时间线">{timeline.length ? timeline.map((record) => <article key={`${record.recordId}:${record.sequenceNumber}`}><small>{formatTime(record.occurredAt, dossier.topic.locale)} · {typeof record.payload.actorName === "string" ? record.payload.actorName : actorLabel(record.actor)} · {categoryLabel(record.category)}</small><strong>{record.title}</strong>{archiveSummary(record.payload) && <p>{archiveSummary(record.payload)}</p>}</article>) : <p>专题尚未产生执行记录。</p>}</EvolutionDisclosure>
  </section>;
}

function actorLabel(actor: string): string { return ({ "han-li": "韩立", "nangong-wan": "南宫婉", "linghu-ancestor": "令狐老祖", codex: "Codex", system: "系统", user: "用户" } as Record<string, string>)[actor] || actor; }
function categoryLabel(category: string): string { return ({ source: "来源", deliberation: "研讨", topic: "专题", proposal: "提案", approval: "审批", distribution: "分发", execution: "执行", test: "测试", release: "发布", acceptance: "验收", recovery: "恢复" } as Record<string, string>)[category] || category; }
function archiveSummary(payload: Record<string, unknown>): string {
  const values = [["状态", payload.state], ["阶段", payload.phase], ["运行", payload.runtimeStatus], ["负责人", payload.executorMemberId], ["验收", payload.acceptanceState], ["完成时间", payload.completedAt], ["原因", payload.reason]]
    .filter((entry): entry is [string, string | number | boolean] => ["string", "number", "boolean"].includes(typeof entry[1]) && String(entry[1]).trim().length > 0);
  return values.map(([label, value]) => `${label}：${String(value)}`).join(" · ");
}
function formatTime(value: string, locale: LocaleValue): string { return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
