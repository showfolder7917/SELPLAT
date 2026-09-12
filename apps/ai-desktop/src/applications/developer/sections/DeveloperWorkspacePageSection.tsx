import { CollaborationWorkspaceFeature } from "../../../features/collaboration";
import { CodexConversationWorkspace } from "../../../features/conversation";
import { HanliConversationWorkspace } from "../../../features/hanli";
import { NangongConversationWorkspace } from "../../../features/nangong";
import { DeveloperWorkspaceTabAction } from "../components/DeveloperWorkspaceTabAction";
import type { DeveloperWorkspacePageViewModel } from "../model/createDeveloperWorkspaceRouterViewModel";

type DeveloperWorkspacePageSectionProps = {
  /** 页签显示模型已经包含目标 Feature、页面输入和新建会话动作。 */
  viewModel: DeveloperWorkspacePageViewModel;
};

/**
 * 一个工作区页签的可见区域。
 *
 * 本 Section 只选择公开 Feature 并连接已经转换好的页面输入，不调用 Desktop API。
 */
export function DeveloperWorkspacePageSection({ viewModel }: DeveloperWorkspacePageSectionProps) {
  let content;
  if (viewModel.kind === "main") {
    content = (
      <CodexConversationWorkspace
        locale={viewModel.locale}
        sandboxMode={viewModel.sandboxMode}
        controller={viewModel.codex}
        screenshot={viewModel.screenshot}
        collaboration={viewModel.collaboration}
      />
    );
  } else if (viewModel.kind === "hanli") {
    const { hanli } = viewModel;
    content = (
      <HanliConversationWorkspace
        runtime={hanli}
        key={hanli.conversation.conversationId || "new-hanli-conversation"}
        conversation={hanli.conversation}
        attachments={hanli.attachments}
        workspaces={viewModel.workspaces}
        locale={viewModel.locale}
        newConversationBusy={hanli.newConversationBusy}
        error={hanli.error}
        onConversation={hanli.setConversation}
        onAttachments={hanli.setAttachments}
        onScreenshot={(hidden) => void viewModel.screenshot.startScreenshot(hidden, "hanli")}
        onPaste={(files) => void viewModel.screenshot.pasteClipboardImages(files, "hanli")}
        onError={hanli.setError}
        isCurrentPage={viewModel.isCurrentPage}
      />
    );
  } else if (viewModel.kind === "nangong") {
    const { nangong } = viewModel;
    content = (
      <NangongConversationWorkspace
        runtime={nangong}
        key={nangong.conversation.conversationId || "new-nangong-conversation"}
        state={viewModel.state}
        approval={viewModel.approval}
        conversation={nangong.conversation}
        attachments={nangong.attachments}
        workspaces={viewModel.workspaces}
        locale={viewModel.locale}
        newConversationBusy={nangong.newConversationBusy}
        error={nangong.error}
        onState={viewModel.onState}
        onConversation={nangong.setConversation}
        onAttachments={nangong.setAttachments}
        onScreenshot={(hidden) => void viewModel.screenshot.startScreenshot(hidden, "nangong")}
        onPaste={(files) => void viewModel.screenshot.pasteClipboardImages(files, "nangong")}
        onError={nangong.setError}
      />
    );
  } else {
    content = (
      <CollaborationWorkspaceFeature
        locale={viewModel.locale}
        controller={viewModel.collaboration}
        evolution={viewModel.evolution}
      />
    );
  }

  return (
    <>
      {/* 页签动作和页面内容固定分成两个可见区域，便于从上向下阅读。 */}
      <div className="developer-page-actions">
        {viewModel.tabAction.visible && (
          <DeveloperWorkspaceTabAction
            label={viewModel.tabAction.label}
            disabled={viewModel.tabAction.disabled}
            busy={viewModel.tabAction.busy}
            onClick={viewModel.tabAction.onClick}
          />
        )}
      </div>
      {content}
    </>
  );
}
