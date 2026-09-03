import type { LocaleValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { useEvolutionRuntime } from "../../evolution/model/useEvolutionRuntime";
import type { usePersonaConversation } from "../../conversation/model/usePersonaConversation";
import type { useScreenshotCapture } from "../../screenshot/model/useScreenshotCapture";
import { useSelUi } from "../../../theme/SelUiProvider";
import { evolutionMutationRequest } from "../../evolution/model/evolution-runtime";
import type { useCollaborationWorkspace } from "../model/useCollaborationWorkspace";
import { CollaborationMemberPage } from "./CollaborationMemberPage";
import { CollaborationTaskDetail } from "./CollaborationTaskDetail";
import { TaskCollaborationGroup } from "./TaskCollaborationGroup";

type CollaborationController = ReturnType<typeof useCollaborationWorkspace>;
type EvolutionController = ReturnType<typeof useEvolutionRuntime>;
type NangongController = ReturnType<typeof usePersonaConversation>;
type ScreenshotController = ReturnType<typeof useScreenshotCapture>;

type CollaborationWorkspaceFeatureProps = {
  locale: LocaleValue;
  workspaces: WorkspaceStateOutDto | null;
  controller: CollaborationController;
  evolution: EvolutionController;
  nangong: NangongController;
  screenshot: ScreenshotController;
};

function readableDesktopError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}

/** 协作工作区拥有成员、任务群和任务详情路由及其人工业务动作。 */
export function CollaborationWorkspaceFeature({ locale, workspaces, controller, evolution, nangong, screenshot }: CollaborationWorkspaceFeatureProps) {
  const selUi = useSelUi();
  const {
    panel, setPanel, setSelectedTaskId, selectedMember, selectedMemberTasks,
    selectedTask, selectedTaskMember, streams, timeline, timelineStreams, linghuAutomation, setLinghuAutomation,
    updateMember, deleteMember, continueTask, cancelTask, refreshTimeline, error, setError,
  } = controller;

  const renameMember = async () => {
    if (!selectedMember) return;
    const displayName = (await selUi.prompt({ title: locale === "ja" ? "メンバー名を変更" : "修改人物名称", label: locale === "ja" ? "新しいメンバー名" : "新的人物名称", defaultValue: selectedMember.displayName }))?.trim();
    if (!displayName || displayName === selectedMember.displayName) return;
    await updateMember(selectedMember.memberId, { displayName });
  };

  const removeMember = async () => {
    if (!selectedMember?.protected || !selectedMember) {
      if (!selectedMember) return;
      const confirmed = await selUi.confirm({ title: locale === "ja" ? "メンバーを削除" : "删除人物", message: locale === "ja" ? `${selectedMember.displayName}を削除しますか？` : `确定删除“${selectedMember.displayName}”吗？`, target: selectedMember.displayName, tone: "danger" });
      if (confirmed) await deleteMember(selectedMember.memberId);
    }
  };

  const manuallyApproveTimelineProposal = async (proposalId: string, title: string, content: string) => {
    if (!evolution.state) return;
    const result = await selUi.approval({ title, subtitle: "专题任务 · 等待韩立审批", content });
    if (!result) return;
    setError("");
    try {
      await evolution.decideProposal(proposalId, { mutation: evolutionMutationRequest(evolution.state), decision: result.decision, advice: result.reason, feedbackTarget: "proposal-content" });
      await refreshTimeline();
    } catch (error) {
      setError(readableDesktopError(error, "提交人工审批失败。"));
    }
  };

  if (panel === "task-group") return <>{error && <div className="composer-error" role="alert">{error}</div>}<TaskCollaborationGroup tasks={controller.state?.tasks || []} onOpenTask={(taskId) => { setSelectedTaskId(taskId); setPanel("task-detail"); }} snapshot={timeline} liveTextByNodeId={Object.fromEntries(Object.entries(timelineStreams).map(([nodeId, output]) => [nodeId, output.message.text]))} locale={locale} onManualApproval={(proposalId, title, content) => void manuallyApproveTimelineProposal(proposalId, title, content)} onContinueTask={async (taskId) => { await continueTask(taskId); }} /></>;
  if (panel === "task-detail" && selectedTask && selectedTaskMember) return <CollaborationTaskDetail task={selectedTask} member={selectedTaskMember} liveOutput={streams[selectedTask.taskId] || null} automation={linghuAutomation} locale={locale} onBack={() => { setSelectedTaskId(null); setPanel("task-group"); }} />;
  return <>{error && <div className="composer-error" role="alert">{error}</div>}<CollaborationMemberPage timeline={timeline} member={selectedMember} tasks={selectedMemberTasks} streams={streams} locale={locale} linghuAutomation={linghuAutomation} nangongEvolution={evolution.state} nangongAttachments={nangong.attachments} workspaces={workspaces} onLinghuState={setLinghuAutomation} onNangongState={evolution.setState} onNangongAttachments={nangong.setAttachments} onNangongScreenshot={(hidden) => void screenshot.startScreenshot(hidden, "nangong")} onNangongPaste={(files) => void screenshot.pasteClipboardImages(files, "nangong")} onError={setError} onRename={() => void renameMember()} onDelete={() => void removeMember()} onContinue={(taskId) => void continueTask(taskId)} onCancel={(taskId) => void cancelTask(taskId)} onOpen={(taskId) => { setSelectedTaskId(taskId); setPanel("task-detail"); }} /></>;
}
