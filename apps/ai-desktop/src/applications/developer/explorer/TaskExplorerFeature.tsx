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

import type {
  // 最近任务摘要供单会话导航显示最后一次普通任务。
  AuditTaskSummaryOutDto,
  // 人物演化状态供协同人物导航显示当前研讨状态。
  EvolutionStateOutDto,
  // 界面语言决定左侧导航使用中文还是日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import type {
  // 人物会话活动用于临时覆盖人物的空闲显示状态。
  PersonaConversationActivity,
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
  /** 韩立和南宫婉当前共同研讨状态。 */
  evolution: EvolutionStateOutDto | null;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 单会话模式最近一次审计任务。 */
  auditTask: AuditTaskSummaryOutDto | null;
  /** 每个人物独立会话页面当前正在进行的活动。 */
  personaConversationActivities: Record<string, PersonaConversationActivity | null>;
  /** 协作状态和跨进程业务操作的唯一控制器。 */
  controller: CollaborationController;
  /** 展开或收起左侧任务区域。 */
  onToggle: () => void;
};

/** 左侧任务导航组合模式开关、单会话摘要和协同入口，不渲染右侧业务页面。 */
export function TaskExplorerFeature({
  expanded,
  evolution,
  locale,
  auditTask,
  personaConversationActivities,
  controller,
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

  let toggleAction = locale === "ja" ? "展開" : "展开";
  if (expanded) toggleAction = locale === "ja" ? "折りたたむ" : "折叠";
  const sectionName = locale === "ja" ? "タスク" : "任务";

  let navigationContent: ReactNode;
  if (collaborationMode) {
    navigationContent = (
      <CollaborationTaskNavigation
        controller={controller}
        evolution={evolution}
        locale={locale}
        personaConversationActivities={personaConversationActivities}
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
          <span>{locale === "ja" ? "TASKS" : "任务"}</span>
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
