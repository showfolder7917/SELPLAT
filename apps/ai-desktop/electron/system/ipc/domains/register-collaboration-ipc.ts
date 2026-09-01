import type { CreateCollaborationMemberInDto, DesktopOperatingModeValue, SubmitCollaborationTaskInDto, UpdateCollaborationMemberInDto } from "../../../../contracts/services/workflow/index.js";
import type { CreateLinghuRepairProposalOutDto, CreateLinghuStartupPromptInDto, UpdateLinghuStartupPromptInDto } from "../../../../contracts/services/personas/linghu/index.js";
import type {
  EvolutionMutationInDto,
  QueryEvolutionWorkbenchInDto,
  SaveEvolutionWorkbenchPreferenceInDto,
} from "../../../../contracts/services/evolution/index.js";
import type { DecideHanliProposalInDto, DecideHanliResultInDto } from "../../../../contracts/services/personas/hanli/index.js";
import type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  CreateNangongTopicInDto,
  GenerateNangongTopicDraftInDto,
  ReviseNangongProposalInDto,
  SendNangongConversationMessageInDto,
  UpdateNangongTopicInDto,
} from "../../../../contracts/services/personas/nangong/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../../contracts/services/workflow/index.js";
import type { CollaborationWorkflowFacade as CollaborationCoordinator } from "../../../services/workflow/index.js";
import type { LinghuAutomationFacade } from "../../../services/personas/linghu/index.js";
import type { NangongFacade } from "../../../services/personas/nangong/index.js";
import type { HanliFacade } from "../../../services/personas/hanli/index.js";
import type { EvolutionFacade } from "../../../services/evolution/index.js";
import type { PersonaWorkflowFacade } from "../../../services/workflow/index.js";
import type { EventCenterFacade, EventCenterTimeline as CollaborationTimelineFacade } from "../../../services/support/capabilities/event-center/index.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";

/** 协同领域集中登记人物、任务和令狐自动保障通道，总注册器不再感知每个业务动作。 */
export function registerCollaborationIpc(
  collaboration: CollaborationCoordinator,
  linghuAutomation: LinghuAutomationFacade,
  nangong: NangongFacade,
  hanli: HanliFacade,
  evolution: EvolutionFacade,
  personaWorkflow: PersonaWorkflowFacade,
  eventCenter: EventCenterFacade,
  collaborationTimeline: CollaborationTimelineFacade | null,
): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2]): void => registerEventCenterIpcHandler(eventCenter, channel, handler, "business");
  handle("desktop:get-collaboration-state", () => collaboration.state());
  // 任务协作群只读取 SQLite 不可变事件；数据库不可用时抛给 EventCenter，禁止退回 JSON 快照拼接旧实现。
  handle("desktop:get-collaboration-timeline", () => {
    if (!collaborationTimeline) throw new Error("任务协作群数据库不可用，已阻断旧快照时间线回退。");
    return collaborationTimeline.getTimelineSnapshot();
  });
  handle("desktop:set-operating-mode", (_event, mode: DesktopOperatingModeValue) => collaboration.setMode(mode));
  handle("desktop:select-collaboration-member", (_event, memberId: string) => collaboration.selectMember(memberId));
  handle("desktop:create-collaboration-member", (_event, request: CreateCollaborationMemberInDto) => collaboration.createMember(request));
  handle("desktop:update-collaboration-member", (_event, memberId: string, request: UpdateCollaborationMemberInDto) => collaboration.updateMember(memberId, request));
  handle("desktop:delete-collaboration-member", (_event, memberId: string) => collaboration.deleteMember(memberId));
  handle("desktop:submit-collaboration-task", (_event, request: SubmitCollaborationTaskInDto) => collaboration.submitTask(request));
  handle("desktop:continue-collaboration-task", (_event, taskId: string) => collaboration.continueTask(taskId));
  handle("desktop:cancel-collaboration-task", (_event, taskId: string) => collaboration.cancelTask(taskId));
  handle("desktop:get-linghu-automation-state", () => linghuAutomation.state());
  handle("desktop:set-linghu-automation-enabled", (_event, enabled: boolean) => linghuAutomation.setEnabled(enabled === true));
  handle("desktop:create-linghu-startup-prompt", (_event, request: CreateLinghuStartupPromptInDto) => linghuAutomation.createPrompt(request));
  handle("desktop:update-linghu-startup-prompt", (_event, promptId: string, request: UpdateLinghuStartupPromptInDto) => linghuAutomation.updatePrompt(promptId, request));
  handle("desktop:delete-linghu-startup-prompt", (_event, promptId: string) => linghuAutomation.deletePrompt(promptId));
  handle("desktop:select-linghu-startup-prompt", (_event, promptId: string) => linghuAutomation.selectPrompt(promptId));
  handle("desktop:get-nangong-evolution-state", () => evolution.state());
  handle("desktop:get-evolution-topic-dossier", (_event, topicId: string) => evolution.dossier(topicId));
  handle("desktop:query-evolution-workbench", (_event, request: QueryEvolutionWorkbenchInDto) => evolution.queryWorkbench(request));
  handle("desktop:get-evolution-workbench-preference", (_event, perspective: "nangong" | "hanli", nodeId: string) => evolution.getWorkbenchPreference(perspective, nodeId));
  handle("desktop:save-evolution-workbench-preference", (_event, request: SaveEvolutionWorkbenchPreferenceInDto) => evolution.saveWorkbenchPreference(request));
  handle("desktop:advance-han-li-deliberation", () => hanli.advanceDeliberation());
  handle("desktop:send-nangong-conversation-message", (_event, request: SendNangongConversationMessageInDto) => nangong.sendConversationMessage(request));
  handle("desktop:new-nangong-conversation", () => nangong.newConversation());
  handle("desktop:generate-nangong-topic-draft", (_event, request: GenerateNangongTopicDraftInDto) => nangong.generateTopicDraft(request));
  handle("desktop:convert-nangong-conversation-to-topic", (_event, request: ConvertNangongConversationToTopicInDto) => nangong.convertConversationToTopic(request));
  handle("desktop:create-evolution-topic", (_event, request: CreateNangongTopicInDto) => evolution.createTopic(request));
  handle("desktop:update-evolution-topic", (_event, topicId: string, request: UpdateNangongTopicInDto) => nangong.updateTopic(topicId, request));
  handle("desktop:set-nangong-automation", (_event, kind: "evolution" | "nangong-approval" | "linghu-approval" | "execution", enabled: boolean) => personaWorkflow.setAutomation(kind, enabled === true));
  handle("desktop:configure-evolution-automation", (_event, request: ConfigurePersonaWorkflowInDto) => personaWorkflow.configureAutomation(request));
  handle("desktop:control-evolution-automation", (_event, action: PersonaWorkflowActionInDto) => personaWorkflow.controlAutomation(action));
  handle("desktop:resume-nangong-one-shot-evolution", () => personaWorkflow.resumeOneShotRun());
  handle("desktop:create-evolution-proposal", (_event, topicId: string, request: CreateNangongProposalInDto) => nangong.createProposal(topicId, request));
  handle("desktop:create-linghu-repair-proposal", (_event, request: CreateLinghuRepairProposalOutDto) => evolution.createLinghuRepairProposal(request));
  handle("desktop:decide-evolution-proposal", (_event, proposalId: string, request: DecideHanliProposalInDto) => hanli.decideProposal(proposalId, request));
  handle("desktop:decide-evolution-result", (_event, proposalId: string, request: DecideHanliResultInDto) => hanli.decideResult(proposalId, request));
  handle("desktop:generate-han-li-acceptance-plan", (_event, proposalId: string) => hanli.generateAcceptancePlan(proposalId));
  handle("desktop:revise-evolution-proposal", (_event, proposalId: string, request: ReviseNangongProposalInDto) => nangong.reviseProposal(proposalId, request));
  handle("desktop:auto-approve-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => hanli.autoApprove(proposalId, request));
  handle("desktop:dispatch-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => nangong.distributeProposal(proposalId, request));
}
