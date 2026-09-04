import type { DesktopOperatingModeValue, SubmitCollaborationTaskInDto } from "../../../../contracts/services/workflow/index.js";
import type { EvolutionMutationInDto } from "../../../../contracts/services/evolution/index.js";
import type { DecideHanliProposalInDto, DecideHanliResultInDto } from "../../../../contracts/services/personas/hanli/index.js";
import type { SendPersonaConversationMessageInDto } from "../../../../contracts/services/personas/conversation/index.js";
import type {
  ConvertNangongConversationToTopicInDto,
  CreateNangongProposalInDto,
  CreateNangongTopicInDto,
  GenerateNangongTopicDraftInDto,
  ReviseNangongProposalInDto,
  UpdateNangongTopicInDto,
} from "../../../../contracts/services/personas/nangong/index.js";
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto } from "../../../../contracts/services/workflow/index.js";
import type { CollaborationWorkflowFacade as CollaborationCoordinator } from "../../../services/workflow/index.js";
import type { LinghuAutomationFacade } from "../../../services/personas/linghu/index.js";
import type { NangongFacade } from "../../../services/personas/nangong/index.js";
import type { HanliFacade } from "../../../services/personas/hanli/index.js";
import type { PersonaConversationFacade } from "../../../services/personas/conversation/index.js";
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
  personaConversations: PersonaConversationFacade,
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
  handle("desktop:submit-collaboration-task", (_event, request: SubmitCollaborationTaskInDto) => collaboration.submitTask(request));
  handle("desktop:continue-collaboration-task", (_event, taskId: string) => collaboration.continueTask(taskId));
  handle("desktop:cancel-collaboration-task", (_event, taskId: string) => collaboration.cancelTask(taskId));
  handle("desktop:get-linghu-automation-state", () => linghuAutomation.state());
  handle("desktop:set-linghu-automation-enabled", (_event, enabled: boolean) => linghuAutomation.setEnabled(enabled === true));
  handle("desktop:new-linghu-display-conversation", () => linghuAutomation.newDisplayConversation());
  handle("desktop:get-nangong-evolution-state", () => evolution.state());
  handle("desktop:get-evolution-topic-dossier", (_event, topicId: string) => evolution.dossier(topicId));
  // 人物会话只有这三个跨进程入口。以后增加人物时注册处理器即可，不再增加人物专用 channel。
  handle("desktop:get-persona-conversation", (_event, personaId: string) => personaConversations.conversation(personaId));
  handle("desktop:send-persona-conversation-message", (_event, personaId: string, request: SendPersonaConversationMessageInDto) => personaConversations.send(personaId, request));
  handle("desktop:new-persona-conversation", (_event, personaId: string) => personaConversations.newConversation(personaId));
  handle("desktop:generate-nangong-topic-draft", (_event, request: GenerateNangongTopicDraftInDto) => nangong.generateTopicDraft(request));
  handle("desktop:convert-nangong-conversation-to-topic", (_event, request: ConvertNangongConversationToTopicInDto) => nangong.convertConversationToTopic(request));
  handle("desktop:create-evolution-topic", (_event, request: CreateNangongTopicInDto) => evolution.createTopic(request));
  handle("desktop:update-evolution-topic", (_event, topicId: string, request: UpdateNangongTopicInDto) => nangong.updateTopic(topicId, request));
  handle("desktop:configure-evolution-automation", (_event, request: ConfigurePersonaWorkflowInDto) => personaWorkflow.configureAutomation(request));
  handle("desktop:control-evolution-automation", (_event, action: PersonaWorkflowActionInDto) => personaWorkflow.controlAutomation(action));
  handle("desktop:resume-nangong-one-shot-evolution", (_event, runId: string) => {
    if (typeof runId !== "string" || !runId.trim()) throw new Error("恢复请求缺少运行标识，请刷新任务状态。");
    return personaWorkflow.resumeOneShotRun(runId);
  });
  handle("desktop:create-evolution-proposal", (_event, topicId: string, request: CreateNangongProposalInDto) => nangong.createProposal(topicId, request));
  handle("desktop:decide-evolution-proposal", (_event, proposalId: string, request: DecideHanliProposalInDto) => hanli.decideProposal(proposalId, request));
  handle("desktop:decide-evolution-result", (_event, proposalId: string, request: DecideHanliResultInDto) => hanli.decideResult(proposalId, request));
  handle("desktop:revise-evolution-proposal", (_event, proposalId: string, request: ReviseNangongProposalInDto) => nangong.reviseProposal(proposalId, request));
  handle("desktop:auto-approve-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => hanli.autoApprove(proposalId, request));
  handle("desktop:dispatch-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => nangong.distributeProposal(proposalId, request));
}
