import { useEffect, useRef } from "react";
import type { CollaborationMemberOutDto, CollaborationTimelineSnapshotOutDto, EvolutionStateOutDto, LinghuAutomationStateOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import { MarkdownMessage } from "../../conversation/components/MarkdownMessage";
import { SelUiConversation } from "../../conversation/components/SelUiConversation";
import { SelUiDisclosure } from "../../../theme/SelUiDisclosure";
import { LinghuAutomationPanel } from "../../linghu";
import { collaborationMemberStateLabel } from "../model/collaboration-formatters";

/** 人物只展示权威时间线中与自己有关的真实发言和交接，不复制任务或伪造用户消息。 */
export function CollaborationMemberPage({ member, timeline, liveTextByNodeId, locale, linghuAutomation, nangongEvolution, onLinghuState }: {
  member: CollaborationMemberOutDto | null;
  timeline: CollaborationTimelineSnapshotOutDto | null;
  liveTextByNodeId: Record<string, string>;
  locale: LocaleValue;
  linghuAutomation: LinghuAutomationStateOutDto | null;
  nangongEvolution: EvolutionStateOutDto | null;
  onLinghuState(state: LinghuAutomationStateOutDto): void;
}) {
  const tail = useRef<HTMLDivElement>(null);
  // 完成任务保留到下一次分配；同任务修复仍使用同一个任务 ID，不因阶段变化清屏。
  const relatedNodes = (timeline?.groups || []).flatMap((group) => group.nodes).filter((node) => node.taskId && (node.actor.memberId === member?.memberId || node.recipients.some((recipient) => recipient.memberId === member?.memberId)));
  const latestTaskId = member?.currentTaskId || relatedNodes.filter((node) => node.kind === "distribution").sort((left, right) => left.startedAt.localeCompare(right.startedAt)).at(-1)?.taskId || relatedNodes.at(-1)?.taskId;
  const groups = (timeline?.groups || []).map((group) => ({ ...group,
    nodes: group.nodes.filter((node) => node.actor.memberId === member?.memberId
      || node.recipients.some((recipient) => recipient.memberId === member?.memberId))
      .filter((node) => member?.memberId === "linghu-ancestor"
        ? !linghuAutomation?.displayConversationStartedAt || node.startedAt >= linghuAutomation.displayConversationStartedAt
        : node.taskId === latestTaskId || (node.taskId === null && node.kind === "distribution" && group.nodes.some((item) => item.taskId === latestTaskId))),
  })).filter((group) => group.nodes.length);
  const lastNode = groups.flatMap((group) => group.nodes).at(-1);
  const latestText = lastNode ? liveTextByNodeId[lastNode.nodeId] || lastNode.content : "";
  useEffect(() => { if (tail.current?.getClientRects().length) tail.current.scrollIntoView({ block: "nearest" }); }, [lastNode?.nodeId, latestText]);
  if (!member) return <section className="collaboration-member-page">请选择人物。</section>;
  return <section className="collaboration-member-page">
    <header><div><span className={`member-presence ${member.state}`} /><div>
      <h1>{member.displayName}</h1><p>{collaborationMemberStateLabel(member, locale, timeline, nangongEvolution)}</p>
    </div></div>{member.memberId === "linghu-ancestor" && linghuAutomation
      && <LinghuAutomationPanel state={linghuAutomation} locale={locale} onState={onLinghuState} />}</header>
    <SelUiConversation id={`selConversationWorker${Array.from(member.memberId).map(char => char.codePointAt(0)!.toString(16).padStart(6, "0")).join("")}Id`} composer={null} onSubmit={() => undefined}
      timeline={<section className="selconversation-timeline" aria-label={`${member.displayName}任务会话`}>
        {!groups.length && <p role="status">当前空闲，收到任务后会在这里显示交接和执行进展。</p>}
        {groups.map((group) => <section key={group.groupId} aria-label={group.title}>
          <p className="selconversation-context-stats">{group.title}</p>
          {group.nodes.map((node) => <article key={node.nodeId} className="selconversation-message" data-role="persona">
            <header>{node.actor.displayName}{node.recipients.length > 0
              ? ` → ${node.recipients.map((person) => person.displayName).join("、")}` : ""} · {node.action}</header>
            <div className="selconversation-message-body">
              <MarkdownMessage text={(node.status === "current" && liveTextByNodeId[node.nodeId]) || node.content || node.summary} />
              {node.detail && <SelUiDisclosure idPrefix="person-task-evidence" open={false} trigger={<span>技术详情</span>}>
                <MarkdownMessage text={node.detail} />
              </SelUiDisclosure>}
            </div>
          </article>)}
        </section>)}
        <div ref={tail} />
      </section>} />
  </section>;
}
