import type { LocaleValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import type { useEvolutionRuntime } from "../../evolution";
import type { usePersonaConversation } from "../../conversation";
import type { useScreenshotCapture } from "../../screenshot";
import { useSelUi } from "../../../theme/SelUiProvider";
import { evolutionMutationRequest } from "../../evolution";
import type { useCollaborationWorkspace } from "../model/useCollaborationWorkspace";
import { CollaborationMemberPage } from "./CollaborationMemberPage";
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
    panel, selectedMember,
    timeline, timelineStreams, linghuAutomation, setLinghuAutomation,
    continueTask, refreshTimeline, error, setError,
  } = controller;

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

  if (panel === "task-group") return <>{error && <div className="composer-error" role="alert">{error}</div>}<TaskCollaborationGroup evolution={evolution} snapshot={timeline} liveTextByNodeId={Object.fromEntries(Object.entries(timelineStreams).map(([nodeId, output]) => [nodeId, output.message.text]))} locale={locale} onManualApproval={(proposalId, title, content) => void manuallyApproveTimelineProposal(proposalId, title, content)} onContinueTask={async (taskId) => { await continueTask(taskId); }} /></>;
  return <>{error && <div className="composer-error" role="alert">{error}</div>}<CollaborationMemberPage timeline={timeline} member={selectedMember} liveTextByNodeId={Object.fromEntries(Object.entries(timelineStreams).map(([id, value]) => [id, value.message.text]))} locale={locale} linghuAutomation={linghuAutomation} nangongEvolution={evolution.state} onLinghuState={setLinghuAutomation} /></>;
}
