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

/** 人物页面显示状态：只描述页面当前需要展示的数据。 */
type CollaborationMemberPagePresentation = {
  /** 当前时间线节点尚未完成的实时正文。 */
  liveTextByNodeId: Record<string, string>;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 令狐自动保障状态；其他人物不会展示对应面板。 */
  linghuAutomation: LinghuAutomationStateOutDto | null;
  /** 南宫婉与韩立共同使用的专题研讨状态。 */
  nangongEvolution: EvolutionStateOutDto | null;
};

/** 人物页面模型：把人物、时间线、显示状态和操作归成一个入口。 */
export type CollaborationMemberPageModel = {
  /** 当前选中的协作成员；状态尚未加载时为 null。 */
  member: CollaborationMemberOutDto | null;
  /** 主进程从 SQLite 投影出的权威协作时间线。 */
  timeline: CollaborationTimelineSnapshotOutDto | null;
  /** 页面语言、实时正文和人物专项状态。 */
  presentation: CollaborationMemberPagePresentation;
  /** 人物页面允许触发的业务操作。 */
  actions: {
    /** 令狐面板写操作完成后，把主进程返回的新状态交回控制器。 */
    onLinghuState: (state: LinghuAutomationStateOutDto) => void;
  };
};

/** 人物页面组件只接收一份具名模型。 */
type CollaborationMemberPageProps = {
  /** 已经按业务职责归组的人物页面模型。 */
  model: CollaborationMemberPageModel;
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
  input: {
    /** 当前需要筛选时间线的协作成员。 */
    member: CollaborationMemberOutDto;
    /** 主进程提供的完整权威时间线。 */
    timeline: CollaborationTimelineSnapshotOutDto | null;
    /** 令狐页面当前允许显示的会话时间边界。 */
    linghuAutomation: LinghuAutomationStateOutDto | null;
  },
): TimelineGroup[] {
  // 具名输入让三个相邻对象的用途在调用处保持可见。
  const { member, timeline, linghuAutomation } = input;
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

/** 人物时间线中的一条真实交接或执行消息。 */
function CollaborationMemberTimelineNode({
  node,
  liveTextByNodeId,
}: {
  /** 当前需要展示的人物时间线节点。 */
  node: TimelineGroup["nodes"][number];
  /** 按节点保存的实时正文，只覆盖仍在执行的当前节点。 */
  liveTextByNodeId: Record<string, string>;
}) {
  // 接收人姓名按后端顺序合并，空列表表示当前动作没有交接目标。
  const recipientNames = node.recipients.map((person) => person.displayName).join("、");
  // 交接标签只在存在接收人时显示箭头和姓名。
  const handoffLabel = recipientNames ? ` → ${recipientNames}` : "";
  // 当前节点优先显示实时正文，历史节点固定显示数据库正文或摘要。
  const visibleText = node.status === "current"
    ? liveTextByNodeId[node.nodeId] || node.content || node.summary
    : node.content || node.summary;

  return (
    // 人物消息根节点保留时间线节点标识，便于页面定位真实消息来源。
    <article className="selconversation-message" data-role="persona" data-timeline-node-id={node.nodeId}>
      {/* 消息身份区：按执行者、接收人和真实动作说明本次交接。 */}
      <header>
        {node.actor.displayName}{handoffLabel} · {node.action}
      </header>
      {/* 消息正文区：显示业务正文，并在存在证据时提供技术详情。 */}
      <div className="selconversation-message-body">
        {/* 可见正文使用统一 Markdown 组件，保持协作页面排版一致。 */}
        <MarkdownMessage text={visibleText} />
        {/* 技术详情没有内容时不渲染空折叠入口。 */}
        {node.detail && (
          <SelUiDisclosure
            idPrefix="person-task-evidence"
            open={false}
            trigger={<span>技术详情</span>}
          >
            {/* 技术证据同样使用统一 Markdown 组件安全展示。 */}
            <MarkdownMessage text={node.detail} />
          </SelUiDisclosure>
        )}
      </div>
    </article>
  );
}

/** 普通协作人物的真实任务进度页面。 */
export function CollaborationMemberPage({ model }: CollaborationMemberPageProps) {
  // 人物和时间线是页面展示真实协作记录的权威业务数据。
  const { member, timeline } = model;
  // 显示状态集中提供语言、实时正文以及人物专项运行状态。
  const { liveTextByNodeId, locale, linghuAutomation, nangongEvolution } = model.presentation;
  // 人物操作组当前只开放令狐状态写回，后续动作仍有明确归属位置。
  const { onLinghuState } = model.actions;
  // 会话末尾锚点：实时正文变化时只滚动人物页面内部区域。
  const conversationTail = useRef<HTMLDivElement>(null);
  // 可见专题只保留当前人物真实参与且仍属于当前展示边界的节点。
  const visibleGroups = member ? buildVisibleGroups({ member, timeline, linghuAutomation }) : [];
  // 最新节点用于判断自动滚动目标和当前实时正文。
  const latestNode = visibleGroups.flatMap((group) => group.nodes).at(-1);
  // 最新正文变化时也需要触发滚动，即使节点标识没有变化。
  const latestText = latestNode
    ? liveTextByNodeId[latestNode.nodeId] || latestNode.content
    : "";
  useEffect(() => {
    // 只有页面末尾锚点确实可见于布局时才执行内部滚动。
    const tailIsVisible = conversationTail.current?.getClientRects().length;
    // 滚动限制在最近位置，避免人物页更新时跳动整个 Developer 工作区。
    if (tailIsVisible) conversationTail.current?.scrollIntoView({ block: "nearest" });
  }, [latestNode?.nodeId, latestText]);

  if (!member) {
    return <section className="collaboration-member-page">请选择人物。</section>;
  }

  const memberStateLabel = collaborationMemberStateLabel({
    member,
    locale,
    timeline,
    evolution: nangongEvolution,
  });
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
                {/* 专题节点列表：每个节点交给独立组件计算交接标签和可见正文。 */}
                {group.nodes.map((node) => (
                  <CollaborationMemberTimelineNode
                    key={node.nodeId}
                    node={node}
                    liveTextByNodeId={liveTextByNodeId}
                  />
                ))}
              </section>
            ))}
            <div ref={conversationTail} />
          </section>
        )}
      />
    </section>
  );
}
