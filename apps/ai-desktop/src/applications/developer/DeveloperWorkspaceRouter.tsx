import { useState } from "react";

import { SelUiWorkspaceTabs } from "../../theme/SelUiWorkspaceTabs";
import {
  // 新建会话按钮使用旋转箭头；busy 时同一图标会播放旋转动画。
  ArrowClockwise24Regular,
} from "@fluentui/react-icons";
import type {
  // LocaleValue 限制当前界面只能使用 DesktopApi 支持的中文或日文区域值。
  LocaleValue,
  // WorkspaceStateOutDto 是已经登记的工作区快照，人物会话发送时必须携带它。
  WorkspaceStateOutDto,
} from "../../../contracts/system/desktop/index";
// CollaborationWorkspaceFeature 显示普通协作成员、任务群或任务详情。
import { CollaborationWorkspaceFeature } from "../../features/collaboration";
// useCollaborationWorkspace 的返回类型描述当前协作模式、选中成员和协作页面。
import type { useCollaborationWorkspace } from "../../features/collaboration";
// CodexConversationWorkspace 是单会话模式下完整的主 Codex 对话页面。
import { CodexConversationWorkspace } from "../../features/conversation";
// useCodexWorkspace 的返回类型提供主会话状态和“新建任务”等公开动作。
import type { useCodexWorkspace } from "../../features/conversation";
// useEvolutionRuntime 的返回类型是韩立和南宫共同消费的唯一 Evolution 状态。
import type { useEvolutionRuntime } from "../../features/evolution";
// HanliConversationWorkspace 显示用户与韩立的独立自由讨论页面。
import { HanliConversationWorkspace } from "../../features/hanli";
// usePersonaConversation 的返回类型统一提供人物会话、附件、错误和新建动作。
import type { usePersonaConversation } from "../../features/conversation";
// NangongConversationWorkspace 显示南宫婉会话和专题整理入口。
import { NangongConversationWorkspace } from "../../features/nangong";
// useScreenshotCapture 的返回类型提供截图和粘贴图片能力，但不持有各会话附件。
import type { useScreenshotCapture } from "../../features/screenshot";

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

/** 协作工作区模型：缩短后续辅助方法的参数声明。 */
type CollaborationWorkspace = ReturnType<typeof useCollaborationWorkspace>;

/**
 * 页签标识：根据当前模式生成稳定的主会话、任务群或成员页签键。
 * 传参示例：选中韩立成员时传入当前协作模型。
 * 返回示例：`member:han-li`。
 * 异常或副作用：成员信息尚未加载时回退到韩立键，不修改协作状态。
 */
function workspaceTabId(collaboration: CollaborationWorkspace): string {
  if (!collaboration.collaborationMode) return "main";
  if (collaboration.panel === "task-group") return "group";
  return `member:${collaboration.selectedMember?.memberId || "han-li"}`;
}

/** 页签标题：把稳定键转成客户可读文字，成员页优先显示真实姓名。 */
function workspaceTabTitle(tabId: string, collaboration: CollaborationWorkspace): string {
  if (tabId === "main") return "Codex Chat";
  if (tabId === "group") return "任务协作群";
  return collaboration.selectedMember?.displayName || "韩立";
}

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
  // 令狐的新建展示会话沿用页签动作的等待反馈，防止用户重复创建可见边界。
  const [linghuNewConversationBusy, setLinghuNewConversationBusy] = useState(false);
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
  // 令狐仍使用协作成员页的正式会话外壳；这里只决定是否显示统一页签动作。
  const showLinghu = Boolean(
    collaboration.collaborationMode
    && collaboration.panel === "member"
    && collaboration.selectedMember?.memberId === "linghu-ancestor",
  );
  const startLinghuDisplayConversation = async () => {
    if (linghuNewConversationBusy) return;
    if (!window.desktop) {
      collaboration.setError("请在桌面应用中操作");
      return;
    }
    setLinghuNewConversationBusy(true);
    collaboration.setError("");
    try {
      // 后端只推进令狐页面的可见消息边界，不触碰巡检、任务或恢复状态。
      collaboration.setLinghuAutomation(await window.desktop.newLinghuDisplayConversation());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "无法新建会话";
      collaboration.setError(message.replace(/^Error invoking remote method '[^']+':\s*/, ""));
    } finally {
      setLinghuNewConversationBusy(false);
    }
  };
  // 工作区内容按明确的路由优先级选择，避免让新手追踪多层三元表达式。
  let workspaceContent;
  if (showMainConversation) {
    workspaceContent = (
      <CodexConversationWorkspace
        locale={locale}
        sandboxMode={sandboxMode}
        controller={codex}
        screenshot={screenshot}
        collaboration={collaboration}
      />
    );
  } else if (showHanli) {
    workspaceContent = (
      <HanliConversationWorkspace
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
    );
  } else if (showNangong && evolution.state) {
    workspaceContent = (
      <NangongConversationWorkspace
        runtime={nangong}
        key={nangong.conversation.conversationId || "new-nangong-conversation"}
        state={evolution.state}
        approval={codex.interaction.approval}
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
    );
  } else {
    workspaceContent = (
      <CollaborationWorkspaceFeature
        locale={locale}
        workspaces={workspaces}
        controller={collaboration}
        evolution={evolution}
        nangong={nangong}
        screenshot={screenshot}
      />
    );
  }
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

      {/* 令狐的新建只切换当前页面展示边界，入口和外观与其他人物页签保持一致。 */}
      {showLinghu && <button
        type="button"
        className="tab-new-task"
        data-sel-tooltip={locale === "ja" ? "令狐老祖の会話を新しく作り直す" : "重新建立令狐老祖对话"}
        data-sel-tooltip-mode="always"
        aria-label={locale === "ja" ? "令狐老祖の会話を新しく作り直す" : "重新建立令狐老祖对话"}
        disabled={linghuNewConversationBusy}
        onClick={() => void startLinghuDisplayConversation()}
      >
        <ArrowClockwise24Regular className={linghuNewConversationBusy ? "screenshot-spinner" : undefined} />
      </button>}

      {/* 关闭图标目前维持既有页签外观，不绑定额外业务动作。 */}

    </div>

    {/* 实际工作区：已在上方用显式分支选好，此处只负责放入布局。 */}
    {workspaceContent}
  </>;
}

/** 工作区页签路由：每个稳定路由拥有独立页面，切换页签不修改任务事实。 */
export function DeveloperWorkspaceRouter(props: DeveloperWorkspaceRouterProps) {
  const collaboration = props.collaboration;
  const tabId = workspaceTabId(collaboration);
  const tabTitle = workspaceTabTitle(tabId, collaboration);
  const requestedTab = collaboration.state ? { id: tabId, label: tabTitle } : null;

  /** 页签切换：只更新操作模式或当前面板，不改动任务内容。 */
  function activateWorkspaceTab(key: string) {
    if (key === "main") {
      if (collaboration.collaborationMode) {
        void collaboration.setOperatingMode("single-conversation");
      }
      return;
    }
    if (!collaboration.collaborationMode) {
      void collaboration.setOperatingMode("collaboration");
    }
    if (key === "group") {
      collaboration.syncPanel("task-group");
      return;
    }
    collaboration.syncPanel("member");
    const memberId = key.slice("member:".length);
    if (collaboration.selectedMember?.memberId !== memberId) {
      void collaboration.selectMember(memberId);
    }
  }

  /** 页签页面：为目标页签派生独立的只读协作视图。 */
  function renderWorkspacePage(key: string) {
    const memberId = key.slice("member:".length);
    const selectedMember = collaboration.state?.members.find((item) => item.memberId === memberId)
      || collaboration.selectedMember;
    const selectedMemberTasks = collaboration.state?.tasks.filter((task) => {
      if (collaboration.terminalStates.has(task.state)) return false;
      if (task.executorMemberId === selectedMember?.memberId) return true;
      if (task.initiator?.memberId === selectedMember?.memberId) return true;
      return task.executionRecords.some((record) => record.executor.memberId === selectedMember?.memberId);
    }) || [];
    const panel = key === "group" ? "task-group" : "member";
    const collaborationView = {
      ...collaboration,
      collaborationMode: key !== "main",
      panel: panel as typeof collaboration.panel,
      selectedMember,
      selectedMemberTasks,
    };
    return <DeveloperWorkspacePage {...props} collaboration={collaborationView} />;
  }

  return (
    <SelUiWorkspaceTabs
      request={requestedTab}
      revision={collaboration.navigationRevision}
      onActivate={activateWorkspaceTab}
      renderPage={renderWorkspacePage}
    />
  );
}
