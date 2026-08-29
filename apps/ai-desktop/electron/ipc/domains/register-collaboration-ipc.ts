import type { CreateCollaborationMemberRequest, DesktopOperatingMode, SubmitCollaborationTaskRequest, UpdateCollaborationMemberRequest } from "../../../contracts/collaboration/collaboration.js";
import type { CreateLinghuStartupPromptRequest, UpdateLinghuStartupPromptRequest } from "../../../contracts/collaboration/linghu-automation.js";
import type {
  ConfigureEvolutionAutomationRequest,
  ConvertNangongConversationToTopicRequest,
  CreateEvolutionProposalRequest,
  CreateEvolutionTopicRequest,
  CreateLinghuRepairProposalRequest,
  DecideEvolutionProposalRequest,
  DecideEvolutionResultRequest,
  EvolutionAutomationAction,
  EvolutionMutationRequest,
  GenerateNangongTopicDraftRequest,
  QueryEvolutionWorkbenchRequest,
  SaveEvolutionWorkbenchPreferenceRequest,
  ReviseEvolutionProposalRequest,
  SendNangongConversationMessageRequest,
  UpdateEvolutionTopicRequest,
} from "../../../contracts/collaboration/nangong-evolution.js";
import type { CollaborationCoordinator } from "../../services/collaboration/collaboration-coordinator.js";
import type { LinghuAutomationFacade } from "../../services/collaboration/linghu-automation-facade.js";
import type { NangongEvolutionFacade } from "../../services/collaboration/nangong-evolution-facade.js";
import type { EventCenterFacade } from "../../services/event-center/event-center-facade.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";
import { buildCollaborationTimeline } from "../../services/collaboration/collaboration-timeline-projection.js";

/** 协同领域集中登记人物、任务和令狐自动保障通道，总注册器不再感知每个业务动作。 */
export function registerCollaborationIpc(
  collaboration: CollaborationCoordinator,
  linghuAutomation: LinghuAutomationFacade,
  nangongEvolution: NangongEvolutionFacade,
  eventCenter: EventCenterFacade,
): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2]): void => registerEventCenterIpcHandler(eventCenter, channel, handler, "business");
  handle("desktop:get-collaboration-state", () => collaboration.state());
  // 新任务协作群只读取统一投影；IPC 异常继续由 EventCenter 包装并交给令狐监听，不建立旁路 catch 日志。
  handle("desktop:get-collaboration-timeline", () => buildCollaborationTimeline(collaboration.state(), nangongEvolution.state()));
  handle("desktop:set-operating-mode", (_event, mode: DesktopOperatingMode) => collaboration.setMode(mode));
  handle("desktop:select-collaboration-member", (_event, memberId: string) => collaboration.selectMember(memberId));
  handle("desktop:create-collaboration-member", (_event, request: CreateCollaborationMemberRequest) => collaboration.createMember(request));
  handle("desktop:update-collaboration-member", (_event, memberId: string, request: UpdateCollaborationMemberRequest) => collaboration.updateMember(memberId, request));
  handle("desktop:delete-collaboration-member", (_event, memberId: string) => collaboration.deleteMember(memberId));
  handle("desktop:submit-collaboration-task", (_event, request: SubmitCollaborationTaskRequest) => collaboration.submitTask(request));
  handle("desktop:continue-collaboration-task", (_event, taskId: string) => collaboration.continueTask(taskId));
  handle("desktop:cancel-collaboration-task", (_event, taskId: string) => collaboration.cancelTask(taskId));
  handle("desktop:get-linghu-automation-state", () => linghuAutomation.state());
  handle("desktop:set-linghu-automation-enabled", (_event, enabled: boolean) => linghuAutomation.setEnabled(enabled === true));
  handle("desktop:create-linghu-startup-prompt", (_event, request: CreateLinghuStartupPromptRequest) => linghuAutomation.createPrompt(request));
  handle("desktop:update-linghu-startup-prompt", (_event, promptId: string, request: UpdateLinghuStartupPromptRequest) => linghuAutomation.updatePrompt(promptId, request));
  handle("desktop:delete-linghu-startup-prompt", (_event, promptId: string) => linghuAutomation.deletePrompt(promptId));
  handle("desktop:select-linghu-startup-prompt", (_event, promptId: string) => linghuAutomation.selectPrompt(promptId));
  handle("desktop:get-nangong-evolution-state", () => nangongEvolution.state());
  handle("desktop:get-evolution-topic-dossier", (_event, topicId: string) => nangongEvolution.dossier(topicId));
  handle("desktop:query-evolution-workbench", (_event, request: QueryEvolutionWorkbenchRequest) => nangongEvolution.queryWorkbench(request));
  handle("desktop:get-evolution-workbench-preference", (_event, perspective: "nangong" | "hanli", nodeId: string) => nangongEvolution.getWorkbenchPreference(perspective, nodeId));
  handle("desktop:save-evolution-workbench-preference", (_event, request: SaveEvolutionWorkbenchPreferenceRequest) => nangongEvolution.saveWorkbenchPreference(request));
  handle("desktop:advance-han-li-deliberation", () => nangongEvolution.advanceHanLiDeliberation());
  handle("desktop:send-nangong-conversation-message", (_event, request: SendNangongConversationMessageRequest) => nangongEvolution.sendConversationMessage(request));
  handle("desktop:new-nangong-conversation", () => nangongEvolution.newConversation());
  handle("desktop:generate-nangong-topic-draft", (_event, request: GenerateNangongTopicDraftRequest) => nangongEvolution.generateTopicDraft(request));
  handle("desktop:convert-nangong-conversation-to-topic", (_event, request: ConvertNangongConversationToTopicRequest) => nangongEvolution.convertConversationToTopic(request));
  handle("desktop:create-evolution-topic", (_event, request: CreateEvolutionTopicRequest) => nangongEvolution.createTopic(request));
  handle("desktop:update-evolution-topic", (_event, topicId: string, request: UpdateEvolutionTopicRequest) => nangongEvolution.updateTopic(topicId, request));
  handle("desktop:set-nangong-automation", (_event, kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean) => nangongEvolution.setAutomation(kind, enabled === true));
  handle("desktop:configure-evolution-automation", (_event, request: ConfigureEvolutionAutomationRequest) => nangongEvolution.configureAutomation(request));
  handle("desktop:control-evolution-automation", (_event, action: EvolutionAutomationAction) => nangongEvolution.controlAutomation(action));
  handle("desktop:resume-nangong-one-shot-evolution", () => nangongEvolution.resumeOneShotRun());
  handle("desktop:create-evolution-proposal", (_event, topicId: string, request: CreateEvolutionProposalRequest) => nangongEvolution.createProposal(topicId, request));
  handle("desktop:create-linghu-repair-proposal", (_event, request: CreateLinghuRepairProposalRequest) => nangongEvolution.createLinghuRepairProposal(request));
  handle("desktop:decide-evolution-proposal", (_event, proposalId: string, request: DecideEvolutionProposalRequest) => nangongEvolution.decideProposal(proposalId, request));
  handle("desktop:decide-evolution-result", (_event, proposalId: string, request: DecideEvolutionResultRequest) => nangongEvolution.decideResult(proposalId, request));
  handle("desktop:generate-han-li-acceptance-plan", (_event, proposalId: string) => nangongEvolution.generateAcceptancePlan(proposalId));
  handle("desktop:revise-evolution-proposal", (_event, proposalId: string, request: ReviseEvolutionProposalRequest) => nangongEvolution.reviseProposal(proposalId, request));
  handle("desktop:auto-approve-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationRequest) => nangongEvolution.autoApprove(proposalId, request));
  handle("desktop:dispatch-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationRequest) => nangongEvolution.dispatch(proposalId, request));
}
