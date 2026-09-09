/**
 * Developer 右侧工作区中的普通协作成员页面。
 * 页面只展示权威时间线里与该人物有关的真实发言和交接，不复制任务或伪造用户消息。
 */

// React 生命周期：有新节点或新文本时把会话滚动到末尾。
import { useEffect } from "react";
// React DOM 引用：定位人物会话末尾的空锚点。
import { useRef } from "react";

import type {
  // 协作成员：提供人物身份、姓名、状态和当前任务。
  CollaborationMemberOutDto,
  // 协作时间线：筛选该人物参与的真实节点。
  CollaborationTimelineSnapshotOutDto,
  // 演化状态：细化南宫婉当前研讨状态。
  EvolutionStateOutDto,
  // 令狐自动化状态：令狐人物页显示自动保障面板和可见会话边界。
  LinghuAutomationStateOutDto,
  // 界面语言：人物状态文案选择中文或日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import {
  // Markdown 正文：安全展示人物交接内容和技术详情。
  MarkdownMessage,
  // 统一会话外壳：让人物进度沿用正式会话的滚动和排版。
  SelUiConversation,
} from "../../conversation";
import {
  // 折叠控件：技术详情默认收起，需要时再展开。
  SelUiDisclosure,
} from "../../../theme/SelUiDisclosure";
import {
  // 令狐自动化面板：显示和控制令狐的自动保障开关。
  LinghuAutomationPanel,
} from "../../linghu";
import {
  // 人物状态文案：综合权威状态、时间线和研讨进度。
  collaborationMemberStateLabel,
} from "../model/collaboration-formatters";

type CollaborationMemberPageProps = {
  /** 当前选中的协作成员；状态尚未加载时为 null。 */
  member: CollaborationMemberOutDto | null;
  /** 主进程从 SQLite 投影出的权威协作时间线。 */
  timeline: CollaborationTimelineSnapshotOutDto | null;
  /** 当前时间线节点尚未完成的实时正文。 */
  liveTextByNodeId: Record<string, string>;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 令狐自动保障状态；其他人物不会展示对应面板。 */
  linghuAutomation: LinghuAutomationStateOutDto | null;
  /** 南宫婉与韩立共同使用的专题研讨状态。 */
  nangongEvolution: EvolutionStateOutDto | null;
  /** 令狐面板写操作完成后，把主进程返回的新状态交回控制器。 */
  onLinghuState: (state: LinghuAutomationStateOutDto) => void;
};

type TimelineGroup = NonNullable<CollaborationTimelineSnapshotOutDto>["groups"][number];

/** 找出人物参与的全部节点，包括本人发言和接收他人交接。 */
function findRelatedNodes(member: CollaborationMemberOutDto, timeline: CollaborationTimelineSnapshotOutDto | null) {
  return (timeline?.groups || []).flatMap((group) => group.nodes).filter((node) => {
    if (!node.taskId) return false;
    if (node.actor.memberId === member.memberId) return true;
    return node.recipients.some((recipient) => recipient.memberId === member.memberId);
  });
}

/** 确定人物页面当前应保留的任务；完成任务会一直显示到下一次真实分配。 */
function findLatestTaskId(member: CollaborationMemberOutDto, timeline: CollaborationTimelineSnapshotOutDto | null): string | undefined {
  if (member.currentTaskId) return member.currentTaskId;

  const relatedNodes = findRelatedNodes(member, timeline);
  const latestDistribution = relatedNodes
    .filter((node) => node.kind === "distribution")
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
    .at(-1);

  return latestDistribution?.taskId || relatedNodes.at(-1)?.taskId || undefined;
}

/** 按人物和当前任务筛选页面真正需要展示的时间线分组。 */
function buildVisibleGroups(
  member: CollaborationMemberOutDto,
  timeline: CollaborationTimelineSnapshotOutDto | null,
  linghuAutomation: LinghuAutomationStateOutDto | null,
): TimelineGroup[] {
  const latestTaskId = findLatestTaskId(member, timeline);

  return (timeline?.groups || []).map((group) => {
    const memberNodes = group.nodes.filter((node) => {
      if (node.actor.memberId === member.memberId) return true;
      return node.recipients.some((recipient) => recipient.memberId === member.memberId);
    });

    const visibleNodes = memberNodes.filter((node) => {
      if (member.memberId === "linghu-ancestor") {
        const visibleSince = linghuAutomation?.displayConversationStartedAt;
        return !visibleSince || node.startedAt >= visibleSince;
      }

      if (node.taskId === latestTaskId) return true;
      const isSharedDistribution = node.taskId === null && node.kind === "distribution";
      const groupContainsLatestTask = group.nodes.some((item) => item.taskId === latestTaskId);
      return isSharedDistribution && groupContainsLatestTask;
    });

    return { ...group, nodes: visibleNodes };
  }).filter((group) => group.nodes.length > 0);
}

/** 将任意人物标识转换成稳定的 HTML id，避免姓名或特殊字符破坏选择器。 */
function memberConversationId(memberId: string): string {
  const encodedMemberId = Array.from(memberId)
    .map((character) => character.codePointAt(0)!.toString(16).padStart(6, "0"))
    .join("");
  return `selConversationWorker${encodedMemberId}Id`;
}

/** 普通协作人物的真实任务进度页面。 */
export function CollaborationMemberPage({
  member,
  timeline,
  liveTextByNodeId,
  locale,
  linghuAutomation,
  nangongEvolution,
  onLinghuState,
}: CollaborationMemberPageProps) {
  // 会话末尾锚点：实时正文变化时只滚动人物页面内部区域。
  const conversationTail = useRef<HTMLDivElement>(null);
  const visibleGroups = member ? buildVisibleGroups(member, timeline, linghuAutomation) : [];
  const latestNode = visibleGroups.flatMap((group) => group.nodes).at(-1);
  const latestText = latestNode
    ? liveTextByNodeId[latestNode.nodeId] || latestNode.content
    : "";
  useEffect(() => {
    const tailIsVisible = conversationTail.current?.getClientRects().length;
    if (tailIsVisible) conversationTail.current?.scrollIntoView({ block: "nearest" });
  }, [latestNode?.nodeId, latestText]);

  if (!member) {
    return <section className="collaboration-member-page">请选择人物。</section>;
  }

  const memberStateLabel = collaborationMemberStateLabel(
    member,
    locale,
    timeline,
    nangongEvolution,
  );
  const visibleLinghuAutomation = member.memberId === "linghu-ancestor"
    ? linghuAutomation
    : null;

  return (
    <section className="collaboration-member-page">
      {/* 人物标题：展示权威占用状态；令狐额外拥有自动保障控制面板。 */}
      <header>
        <div>
          <span className={`member-presence ${member.state}`} />
          <div>
            <h1>{member.displayName}</h1>
            <p>{memberStateLabel}</p>
          </div>
        </div>
        {visibleLinghuAutomation && (
          <LinghuAutomationPanel
            state={visibleLinghuAutomation}
            locale={locale}
            onState={onLinghuState}
          />
        )}
      </header>

      {/* 人物任务会话：没有输入框，只按发生顺序展示真实交接。 */}
      <SelUiConversation
        id={memberConversationId(member.memberId)}
        composer={null}
        onSubmit={() => undefined}
        timeline={(
          <section className="selconversation-timeline" aria-label={`${member.displayName}任务会话`}>
            {visibleGroups.length === 0 && (
              <p role="status">当前空闲，收到任务后会在这里显示交接和执行进展。</p>
            )}

            {visibleGroups.map((group) => (
              <section key={group.groupId} aria-label={group.title}>
                <p className="selconversation-context-stats">{group.title}</p>
                {group.nodes.map((node) => {
                  const recipientNames = node.recipients.map((person) => person.displayName).join("、");
                  const handoffLabel = recipientNames ? ` → ${recipientNames}` : "";
                  const visibleText = node.status === "current"
                    ? liveTextByNodeId[node.nodeId] || node.content || node.summary
                    : node.content || node.summary;

                  return (
                    <article key={node.nodeId} className="selconversation-message" data-role="persona">
                      <header>
                        {node.actor.displayName}{handoffLabel} · {node.action}
                      </header>
                      <div className="selconversation-message-body">
                        <MarkdownMessage text={visibleText} />
                        {node.detail && (
                          <SelUiDisclosure
                            idPrefix="person-task-evidence"
                            open={false}
                            trigger={<span>技术详情</span>}
                          >
                            <MarkdownMessage text={node.detail} />
                          </SelUiDisclosure>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
            <div ref={conversationTail} />
          </section>
        )}
      />
    </section>
  );
}
