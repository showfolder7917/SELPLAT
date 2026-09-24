/**
 * Developer 左侧栏中的“任务”导航区域。
 *
 * 用户在这里切换单会话或协同模式，并选择任务协作群或具体人物；
 * 右侧页面统一由 workspace/DeveloperWorkspaceRouter.tsx 决定。
 */

import {
  // 向下箭头表示左侧任务区域已经展开。
  ChevronDown16Regular,
  // 向右箭头表示左侧任务区域已经收起。
  ChevronRight16Regular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";

import { fixedUiText } from "../../../../contracts/foundation";
import type {
  // 最近任务摘要供单会话导航显示最后一次普通任务。
  AuditTaskSummaryOutDto,
  // 界面语言决定左侧导航使用中文还是日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import type { EvolutionStateOutDto } from "../../../../contracts/services/evolution/dto/evolution-state.out.dto";
import type { PersonaConversationActivityOutDto } from "../../../../contracts/services/personas/conversation/dto/persona-conversation-activity.out.dto";
import type {
  // 协作控制器提供模式、人物和任务群页面操作。
  useCollaborationWorkspace,
} from "../../../features/collaboration";
import { CollaborationTaskNavigation } from "./CollaborationTaskNavigation";
import { OperatingModeSwitch } from "./OperatingModeSwitch";
import { SingleConversationTaskSummary } from "./SingleConversationTaskSummary";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;

type TaskExplorerFeatureProps = {
  /** 左侧任务区域是否展开。 */
  expanded: boolean;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 单会话模式最近一次审计任务。 */
  auditTask: AuditTaskSummaryOutDto | null;
  /** 协作状态和跨进程业务操作的唯一控制器。 */
  controller: CollaborationController;
  /** 调查阶段的权威运行状态只用于左侧人物状态展示。 */
  evolutionState: EvolutionStateOutDto | null;
  /** 韩立自由讨论中的排查阶段，专题建立前也必须投影到人物栏。 */
  hanliInquiryActivity: PersonaConversationActivityOutDto | undefined;
  /** 韩立把当前核实交给南宫婉时，同时投影受托人物状态。 */
  hanliDelegatedResponderPersonaId: string | null;
  /** 展开或收起左侧任务区域。 */
  onToggle: () => void;
};

/** 左侧任务导航组合模式开关、单会话摘要和协同入口，不渲染右侧业务页面。 */
export function TaskExplorerFeature({
  expanded,
  locale,
  auditTask,
  controller,
  evolutionState,
  hanliInquiryActivity,
  hanliDelegatedResponderPersonaId,
  onToggle,
}: TaskExplorerFeatureProps) {
  // 当前运行模式来自导航状态，模式切换与页面切换来自业务操作组。
  const { collaborationMode } = controller.navigation;
  const { setOperatingMode, setPanel } = controller.actions;

  /** 切换运行模式后统一回到人物页，避免保留不适用于新模式的任务群选择。 */
  const changeMode = async (mode: "single-conversation" | "collaboration") => {
    const nextState = await setOperatingMode(mode);
    if (nextState) setPanel("member");
  };

  /** 模式按钮只启动明确的异步切换方法，不把业务流程压进 JSX。 */
  const requestModeChange = (mode: "single-conversation" | "collaboration") => {
    void changeMode(mode);
  };

  const toggleAction = fixedUiText(locale, expanded ? "taskCollapse" : "taskExpand");
  const sectionName = fixedUiText(locale, "taskSection");

  let navigationContent: ReactNode;
  if (collaborationMode) {
    navigationContent = (
      <CollaborationTaskNavigation
        controller={controller}
        locale={locale}
        evolutionState={evolutionState}
        hanliInquiryActivity={hanliInquiryActivity}
        hanliDelegatedResponderPersonaId={hanliDelegatedResponderPersonaId}
      />
    );
  } else {
    navigationContent = (
      <SingleConversationTaskSummary
        auditTask={auditTask}
        locale={locale}
      />
    );
  }

  return (
    <section className={`explorer-pane tasks-pane ${expanded ? "expanded" : "collapsed"}`}>
      <div className="dev-section-title tasks">
        <button
          className="section-toggle"
          aria-expanded={expanded}
          aria-controls="developer-task-list"
          aria-label={`${toggleAction}${sectionName}`}
          onClick={onToggle}
        >
          {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
          <span>{fixedUiText(locale, "taskSectionHeading")}</span>
        </button>
      </div>

      {expanded && (
        <div id="developer-task-list" className="task-list">
          <OperatingModeSwitch
            collaborationMode={collaborationMode}
            locale={locale}
            onModeChange={requestModeChange}
          />
          {navigationContent}
        </div>
      )}
    </section>
  );
}
