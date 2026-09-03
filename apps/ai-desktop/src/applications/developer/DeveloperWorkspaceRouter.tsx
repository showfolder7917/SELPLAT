import { SelUiWorkspaceTabs } from "../../theme/SelUiWorkspaceTabs";
import {
  // 新建会话按钮使用旋转箭头；busy 时同一图标会播放旋转动画。
  ArrowClockwise24Regular,
  // 页签右侧保留与现有桌面外观一致的关闭图标。
  // 页签左侧使用提示图标，表示当前区域是人物或 Codex 对话工作区。
} from "@fluentui/react-icons";
import type {
  // LocaleValue 限制当前界面只能使用 DesktopApi 支持的中文或日文区域值。
  LocaleValue,
  // WorkspaceStateOutDto 是已经登记的工作区快照，人物会话发送时必须携带它。
  WorkspaceStateOutDto,
} from "../../../contracts/system/desktop/index";
// CollaborationWorkspaceFeature 显示普通协作成员、任务群或任务详情。
import { CollaborationWorkspaceFeature } from "../../features/collaboration/components/CollaborationWorkspaceFeature";
// useCollaborationWorkspace 的返回类型描述当前协作模式、选中成员和协作页面。
import type { useCollaborationWorkspace } from "../../features/collaboration/model/useCollaborationWorkspace";
// CodexConversationWorkspace 是单会话模式下完整的主 Codex 对话页面。
import { CodexConversationWorkspace } from "../../features/conversation/components/CodexConversationWorkspace";
// useCodexWorkspace 的返回类型提供主会话状态和“新建任务”等公开动作。
import type { useCodexWorkspace } from "../../features/conversation/model/useCodexWorkspace";
// useEvolutionRuntime 的返回类型是韩立和南宫共同消费的唯一 Evolution 状态。
import type { useEvolutionRuntime } from "../../features/evolution/model/useEvolutionRuntime";
// HanliConversationWorkspace 显示用户与韩立的独立自由讨论页面。
import { HanliConversationWorkspace } from "../../features/hanli/components/HanliConversationWorkspace";
// usePersonaConversation 的返回类型统一提供人物会话、附件、错误和新建动作。
import type { usePersonaConversation } from "../../features/conversation/model/usePersonaConversation";
// NangongConversationWorkspace 显示南宫婉会话和专题整理入口。
import { NangongConversationWorkspace } from "../../features/nangong/components/NangongConversationWorkspace";
// useScreenshotCapture 的返回类型提供截图和粘贴图片能力，但不持有各会话附件。
import type { useScreenshotCapture } from "../../features/screenshot/model/useScreenshotCapture";

/** Application 传给工作区路由的公开 Feature 模型；路由只读状态并选择页面。 */
type DeveloperWorkspaceRouterProps = {
  // locale 决定页签和按钮显示中文还是日文，不参与业务状态判断。
  locale: LocaleValue;
  // sandboxMode 原样传给主 Codex 会话，用于显示当前执行沙箱。
  sandboxMode: "read-only" | "workspace-write";
  // workspaces 可能仍在初始化；人物会话会在它为空时阻止发送。
  workspaces: WorkspaceStateOutDto | null;
  // collaboration 是协作 Feature 的唯一控制器，路由通过它判断模式和成员。
  collaboration: ReturnType<typeof useCollaborationWorkspace>;
  // codex 是主会话 Feature 的控制器，路由不直接修改它的消息列表。
  codex: ReturnType<typeof useCodexWorkspace>;
  // evolution 保存人物共同状态，供人物会话和协作流程共享。
  evolution: ReturnType<typeof useEvolutionRuntime>;
  // hanli 只保存韩立自己的会话、附件和操作状态。
  hanli: ReturnType<typeof usePersonaConversation>;
  // nangong 只保存南宫婉自己的附件和操作状态，共同状态仍来自 evolution。
  nangong: ReturnType<typeof usePersonaConversation>;
  // screenshot 接受明确人物目标，把签发后的图片返回给对应会话所有者。
  screenshot: ReturnType<typeof useScreenshotCapture>;
};

/** Developer 工作区路由只选择公开 Feature，不实现人物、协作或主会话内部流程。 */
function DeveloperWorkspacePage({
  // 当前界面语言。
  locale,
  // 主 Codex 会话展示的沙箱模式。
  sandboxMode,
  // 已登记工作区快照。
  workspaces,
  // 协作页面和当前成员状态。
  collaboration,
  // 主 Codex 会话控制器。
  codex,
  // 韩立、南宫共同使用的演化状态。
  evolution,
  // 韩立自己的会话控制器。
  hanli,
  // 南宫婉自己的会话控制器。
  nangong,
  // 三个会话共同复用的截图能力。
  screenshot,
}: DeveloperWorkspaceRouterProps) {
  // 未进入协同模式时，工作区固定显示主 Codex 会话。
  const showMainConversation = !collaboration.collaborationMode;
  // 协同模式选择韩立成员页时，切换到韩立独立会话页面。
  const showHanli = Boolean(
    collaboration.collaborationMode
    && collaboration.panel === "member"
    && collaboration.selectedMember?.memberId === "han-li",
  );
  // 南宫婉页面依赖共同 Evolution 状态；状态尚未加载时不能渲染不完整页面。
  const showNangong = Boolean(
    collaboration.collaborationMode
    && collaboration.panel === "member"
    && collaboration.selectedMember?.memberId === "nangong-wan"
    && evolution.state,
  );
  // 页签标题跟随当前协作子页面；成员页优先显示真实人物名称。
  // Fragment 允许页签、错误条和实际工作区作为同一个路由结果返回。
  return <>
    {/* 页签只表达当前路由和全局入口，不承载会话内部业务。 */}
    <div className="developer-page-actions">
      {/* 固定图标帮助用户识别这里是对话/任务工作区。 */}


      {/* 主 Codex 页签的新建按钮只重置主会话，不影响人物会话。 */}
      {showMainConversation && <button
        type="button"
        className="tab-new-task"
        data-sel-tooltip={locale === "ja" ? "Codex セッションを新しく作り直す" : "重新建立一个 Codex 会话"}
        data-sel-tooltip-mode="always"
        aria-label={locale === "ja" ? "Codex セッションを新しく作り直す" : "重新建立一个 Codex 会话"}
        onClick={() => void codex.startNewTask()}
      >
        <ArrowClockwise24Regular />
      </button>}

      {/* 韩立页签的新建按钮调用韩立自己的线程重置动作。 */}
      {showHanli && <button
        type="button"
        className="tab-new-task"
        data-sel-tooltip="重新建立韩立对话"
        data-sel-tooltip-mode="always"
        aria-label="重新建立韩立对话"
        disabled={hanli.newConversationBusy || hanli.sending}
        onClick={() => void hanli.startNewConversation()}
      >
        <ArrowClockwise24Regular className={hanli.newConversationBusy ? "screenshot-spinner" : undefined} />
      </button>}

      {/* 南宫婉页签的新建按钮只重置南宫会话，公共 Evolution 状态由服务返回后更新。 */}
      {showNangong && <button
        type="button"
        className="tab-new-task"
        data-sel-tooltip={locale === "ja" ? "南宮婉の会話を新しく作り直す" : "重新建立南宫婉对话"}
        data-sel-tooltip-mode="always"
        aria-label={locale === "ja" ? "南宮婉の会話を新しく作り直す" : "重新建立南宫婉对话"}
        disabled={nangong.newConversationBusy || nangong.sending}
        onClick={() => void nangong.startNewConversation()}
      >
        <ArrowClockwise24Regular className={nangong.newConversationBusy ? "screenshot-spinner" : undefined} />
      </button>}

      {/* 关闭图标目前维持既有页签外观，不绑定额外业务动作。 */}

    </div>

    {/* 路由优先级：主 Codex → 韩立 → 南宫婉 → 其他协作页面。 */}
    {showMainConversation
      // 单会话模式把主会话、截图和协作引用交给 Codex Feature 自己处理。
      ? <CodexConversationWorkspace
        locale={locale}
        sandboxMode={sandboxMode}
        controller={codex}
        screenshot={screenshot}
        collaboration={collaboration}
      />
      : showHanli
        // 韩立使用自己的会话和附件；截图结果通过目标 hanli 返回给它。
        ? <HanliConversationWorkspace
          runtime={hanli}
          key={hanli.conversation.conversationId || "new-hanli-conversation"}
          conversation={hanli.conversation}
          attachments={hanli.attachments}
          workspaces={workspaces}
          locale={locale}
          newConversationBusy={hanli.newConversationBusy}
          error={hanli.error}
          onConversation={hanli.setConversation}
          onAttachments={hanli.setAttachments}
          onScreenshot={(hidden) => void screenshot.startScreenshot(hidden, "hanli")}
          onPaste={(files) => void screenshot.pasteClipboardImages(files, "hanli")}
          onError={hanli.setError}
        />
        : showNangong && evolution.state
          // 南宫婉拥有自己的统一人物会话；专题、提案等共同流程状态仍由 Evolution 提供。
          ? <NangongConversationWorkspace
            runtime={nangong}
            key={nangong.conversation.conversationId || "new-nangong-conversation"}
            state={evolution.state}
            conversation={nangong.conversation}
            attachments={nangong.attachments}
            workspaces={workspaces}
            locale={locale}
            newConversationBusy={nangong.newConversationBusy}
            error={nangong.error}
            onState={evolution.setState}
            onConversation={nangong.setConversation}
            onAttachments={nangong.setAttachments}
            onScreenshot={(hidden) => void screenshot.startScreenshot(hidden, "nangong")}
            onPaste={(files) => void screenshot.pasteClipboardImages(files, "nangong")}
            onError={nangong.setError}
          />
          // 其余成员页、任务群和任务详情统一由 Collaboration Feature 决定。
          : <CollaborationWorkspaceFeature
            locale={locale}
            workspaces={workspaces}
            controller={collaboration}
            evolution={evolution}
            nangong={nangong}
            screenshot={screenshot}
          />}
  </>;
}

/** Each stable route has its own mounted page; selecting or closing a tab never mutates a task. */
export function DeveloperWorkspaceRouter(props: DeveloperWorkspaceRouterProps) {
  const c = props.collaboration;
  const id = !c.collaborationMode ? "main" : c.panel === "task-group" ? "group" : c.panel === "task-detail" && c.selectedTaskId ? `task:${c.selectedTaskId}` : `member:${c.selectedMember?.memberId || "han-li"}`;
  const title = id === "main" ? "Codex Chat" : id === "group" ? "任务协作群" : id.startsWith("task:") ? c.selectedTask?.snapshot.title || "任务详情" : c.selectedMember?.displayName || "韩立";
  return <SelUiWorkspaceTabs request={c.state ? { id, label: title } : null} revision={c.navigationRevision}
    onActivate={(key) => {
      if (key === "main") { if (c.collaborationMode) void c.setOperatingMode("single-conversation"); return; }
      if (!c.collaborationMode) void c.setOperatingMode("collaboration");
      if (key === "group") c.syncPanel("task-group");
      else if (key.startsWith("task:")) { c.setSelectedTaskId(key.slice(5)); c.syncPanel("task-detail"); }
      else { c.syncPanel("member"); const memberId = key.slice(7); if (c.selectedMember?.memberId !== memberId) void c.selectMember(memberId); }
    }}
    renderPage={(key) => {
      const member = c.state?.members.find((item) => item.memberId === key.slice(7)) || c.selectedMember;
      const task = c.state?.tasks.find((item) => item.taskId === key.slice(5)) || null;
      const view = { ...c, collaborationMode: key !== "main", panel: (key === "group" ? "task-group" : key.startsWith("task:") ? "task-detail" : "member") as typeof c.panel,
        selectedMember: member, selectedTask: task, selectedTaskId: task?.taskId || null,
        selectedTaskMember: c.state?.members.find((item) => item.memberId === (task?.executorMemberId || task?.initiator?.memberId)) || member,
        selectedMemberTasks: c.state?.tasks.filter((item) => !c.terminalStates.has(item.state) && (item.executorMemberId === member?.memberId || item.initiator?.memberId === member?.memberId || item.executionRecords.some((record) => record.executor.memberId === member?.memberId))) || [],
      };
      return <DeveloperWorkspacePage {...props} collaboration={view} />;
    }} />;
}
