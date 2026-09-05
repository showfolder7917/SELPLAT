import { Branch24Regular, ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";

import type { AuditTaskSummaryOutDto, EvolutionStateOutDto, LocaleValue } from "../../../../contracts/system/desktop/index";
import { auditStatusText } from "../../settings/model/settings-formatters";
import { collaborationMemberPresenceState, collaborationMemberStateLabel, type PersonaConversationActivity } from "../model/collaboration-formatters";
import type { useCollaborationWorkspace } from "../model/useCollaborationWorkspace";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;

type CollaborationExplorerFeatureProps = {
  expanded: boolean;
  evolution: EvolutionStateOutDto | null;
  locale: LocaleValue;
  auditTask: AuditTaskSummaryOutDto | null;
  personaConversationActivities: Record<string, PersonaConversationActivity | null>;
  controller: CollaborationController;
  onToggle: () => void;
};

/** 协作 Explorer 拥有运行模式、成员选择与任务入口，Application 不再计算成员列表或任务计数。 */
export function CollaborationExplorerFeature({ expanded, evolution, locale, auditTask, personaConversationActivities, controller, onToggle }: CollaborationExplorerFeatureProps) {
  const {
    state, timeline, panel, setPanel, collaborationMode,
    setOperatingMode, selectMember,
  } = controller;

  const changeMode = async (mode: "single-conversation" | "collaboration") => {
    const next = await setOperatingMode(mode);
    if (next) setPanel("member");
  };

  const selectCollaborationMember = async (memberId: string) => {
    const next = await selectMember(memberId);
    if (!next) return;
    setPanel("member");
  };

  return <section className={`explorer-pane tasks-pane ${expanded ? "expanded" : "collapsed"}`}>
    <div className="dev-section-title tasks"><button className="section-toggle" aria-expanded={expanded} aria-controls="developer-task-list" aria-label={`${expanded ? (locale === "ja" ? "折りたたむ" : "折叠") : (locale === "ja" ? "展開" : "展开")}${locale === "ja" ? "タスク" : "任务"}`} onClick={onToggle}>{expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{locale === "ja" ? "TASKS" : "任务"}</span></button></div>
    {expanded && <div id="developer-task-list" className="task-list">
      <div className="operating-mode-switch" role="group" aria-label={locale === "ja" ? "実行モード" : "运行模式"}><button type="button" className={!collaborationMode ? "active" : ""} aria-pressed={!collaborationMode} onClick={() => void changeMode("single-conversation")}>{locale === "ja" ? "単一会話" : "单会话"}</button><button type="button" className={collaborationMode ? "active" : ""} aria-pressed={collaborationMode} onClick={() => void changeMode("collaboration")}>{locale === "ja" ? "協同" : "协同模式"}</button></div>
      {collaborationMode
        ? <><button type="button" className={`collaboration-task-group-entry ${panel === "task-group" ? "selected" : ""}`} aria-pressed={panel === "task-group"} onClick={() => { setPanel("task-group"); }}><span><Branch24Regular />{locale === "ja" ? "タスク協同グループ" : "任务协作群"}</span><strong>{timeline?.groups.length || 0}</strong></button><div className="collaboration-member-list">{state?.members.map((member) => {
          const conversationActivity = personaConversationActivities[member.memberId];
          return <button type="button" key={member.memberId} className={`collaboration-member ${panel === "member" && member.memberId === state.selectedMemberId ? "selected" : ""}`} aria-pressed={panel === "member" && member.memberId === state.selectedMemberId} onClick={() => void selectCollaborationMember(member.memberId)}><span><i className={collaborationMemberPresenceState(member, conversationActivity)} />{member.displayName}</span><small>{collaborationMemberStateLabel(member, locale, timeline, evolution, conversationActivity)}</small></button>;
        })}</div></>
        : auditTask
          ? <div className="task-summary" title={auditTask.request}><strong>{auditTask.request || (locale === "ja" ? "新しいタスク" : "新建任务")}</strong><span>{auditStatusText(auditTask.status, locale)}</span></div>
          : <span className="task-empty">{locale === "ja" ? "タスク履歴はまだありません" : "暂无任务记录"}</span>}
    </div>}
  </section>;
}
