import type { DesktopOperatingModeValue, SubmitCollaborationTaskInDto } from "../../../../contracts/services/workflow/index.js";
import type { EvolutionMutationInDto } from "../../../../contracts/services/evolution/index.js";
import type { DecideHanliProposalInDto, DecideHanliResultInDto } from "../../../../contracts/services/personas/hanli/index.js";
import type { ReadPersonaConversationWindowInDto, SendPersonaConversationMessageInDto } from "../../../../contracts/services/personas/conversation/index.js";
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
import type { AcceptanceEmptyTaskGroupSession } from "../acceptance-empty-task-group-session.js";

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
  refreshWorkflowCheckpoints?: () => Promise<void>,
  acceptanceEmptyTaskGroupSession?: AcceptanceEmptyTaskGroupSession,
): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2]): void => registerEventCenterIpcHandler(eventCenter, channel, handler, "business");
  const isIsolatedAcceptance = (webContentsId: number) => acceptanceEmptyTaskGroupSession?.isActive(webContentsId) === true;
  handle("desktop:get-collaboration-state", async (event) => {
    const state = collaboration.state();
    return isIsolatedAcceptance(event.sender.id) ? acceptanceEmptyTaskGroupSession!.readCollaborationState(event.sender.id, state) : state;
  });
  // 任务协作群只读取 SQLite 不可变事件；数据库不可用时抛给 EventCenter，禁止退回 JSON 快照拼接旧实现。
  handle("desktop:get-collaboration-timeline", (event) => {
    if (isIsolatedAcceptance(event.sender.id)) return acceptanceEmptyTaskGroupSession!.timeline(event.sender.id);
    if (!collaborationTimeline) throw new Error("任务协作群数据库不可用，已阻断旧快照时间线回退。");
    return collaborationTimeline.getTimelineSnapshot();
  });
  handle("desktop:set-operating-mode", (event, mode: DesktopOperatingModeValue) => {
    if (!isIsolatedAcceptance(event.sender.id)) return collaboration.setMode(mode);
    const isolated = acceptanceEmptyTaskGroupSession!.setMode(event.sender.id, mode, collaboration.state());
    event.sender.send("desktop:collaboration-state", { state: isolated, reason: "mode.changed", taskIds: [] });
    return isolated;
  });
  handle("desktop:select-collaboration-member", (event, memberId: string) => {
    const state = collaboration.state();
    if (!isIsolatedAcceptance(event.sender.id)) return collaboration.selectMember(memberId);
    const isolated = acceptanceEmptyTaskGroupSession!.selectMember(event.sender.id, memberId, state);
    event.sender.send("desktop:collaboration-state", { state: isolated, reason: "member.selected", taskIds: [] });
    return isolated;
  });
  handle("desktop:submit-collaboration-task", (_event, request: SubmitCollaborationTaskInDto) => collaboration.submitTask(request).state);
  handle("desktop:continue-collaboration-task", (event, taskId: string) => {
    if (isIsolatedAcceptance(event.sender.id)) {
      const timeline = acceptanceEmptyTaskGroupSession!.continueRecoveryLifecycle(event.sender.id, taskId);
      // Renderer 的继续调用契约始终返回协作状态；时间线只能经专用事件刷新。
      const isolated = acceptanceEmptyTaskGroupSession!.collaborationState(event.sender.id, collaboration.state());
      event.sender.send("desktop:collaboration-timeline-changed", timeline);
      return isolated;
    }
    return collaboration.continueTask(taskId);
  });
  handle("desktop:cancel-collaboration-task", (_event, taskId: string) => collaboration.cancelTask(taskId));
  handle("desktop:get-linghu-automation-state", () => linghuAutomation.state());
  handle("desktop:set-linghu-automation-enabled", (_event, enabled: boolean) => linghuAutomation.setEnabled(enabled === true));
  handle("desktop:new-linghu-display-conversation", () => linghuAutomation.newDisplayConversation());
  handle("desktop:get-nangong-evolution-state", (event) => {
    const state = evolution.state();
    return isIsolatedAcceptance(event.sender.id) ? acceptanceEmptyTaskGroupSession!.evolutionState(state) : state;
  });
  handle("desktop:get-evolution-topic-dossier", (_event, topicId: string) => evolution.dossier(topicId));
  // 人物会话统一通过读取、发送、新建和模型选择四类入口访问；新人物只需注册处理器。
  handle("desktop:get-persona-conversation", (event, personaId: string) => {
    const conversation = personaConversations.conversation(personaId);
    return isIsolatedAcceptance(event.sender.id) ? acceptanceEmptyTaskGroupSession!.conversation(event.sender.id, personaId, conversation) : conversation;
  });
  handle("desktop:get-persona-conversation-window", (event, personaId: string, request?: ReadPersonaConversationWindowInDto) => {
    if (isIsolatedAcceptance(event.sender.id)) return acceptanceEmptyTaskGroupSession!.conversationWindow(event.sender.id, personaId, request || {});
    return personaConversations.conversationWindow(personaId, request || {});
  });
  handle("desktop:send-persona-conversation-message", (event, personaId: string, request: SendPersonaConversationMessageInDto) => {
    if (isIsolatedAcceptance(event.sender.id)) return acceptanceEmptyTaskGroupSession!.sendPersonaConversationMessage(event.sender.id, personaId, request);
    return personaConversations.send(personaId, request);
  });
  handle("desktop:new-persona-conversation", (_event, personaId: string) => personaConversations.newConversation(personaId));
  handle("desktop:select-persona-conversation-model", (_event, personaId: string, selectedModel: string | null) => personaConversations.selectModel(personaId, selectedModel));
  handle("desktop:generate-nangong-topic-draft", (_event, request: GenerateNangongTopicDraftInDto) => nangong.generateTopicDraft(request));
  handle("desktop:convert-nangong-conversation-to-topic", (_event, request: ConvertNangongConversationToTopicInDto) => nangong.convertConversationToTopic(request));
  handle("desktop:create-evolution-topic", (_event, request: CreateNangongTopicInDto) => evolution.createTopic(request));
  handle("desktop:update-evolution-topic", (_event, topicId: string, request: UpdateNangongTopicInDto) => nangong.updateTopic(topicId, request));
  handle("desktop:configure-evolution-automation", (_event, request: ConfigurePersonaWorkflowInDto) => personaWorkflow.configureAutomation(request));
  handle("desktop:control-evolution-automation", (_event, action: PersonaWorkflowActionInDto) => personaWorkflow.controlAutomation(action));
  handle("desktop:resume-nangong-one-shot-evolution", async (event, runId: string) => {
    if (typeof runId !== "string" || !runId.trim()) throw new Error("恢复请求缺少运行标识，请刷新任务状态。");
    const resumed = await personaWorkflow.resumeOneShotRun(runId);
    // 用户点击恢复后立即唤醒统一卡点入口；不能再等待下一轮后台巡检才把真实阻塞交给令狐。
    await refreshWorkflowCheckpoints?.();
    return resumed;
  });
  handle("desktop:create-evolution-proposal", (_event, topicId: string, request: CreateNangongProposalInDto) => nangong.createProposal(topicId, request));
  handle("desktop:decide-evolution-proposal", (_event, proposalId: string, request: DecideHanliProposalInDto) => hanli.decideProposal(proposalId, request));
  handle("desktop:decide-evolution-result", (_event, proposalId: string, request: DecideHanliResultInDto) => hanli.decideResult(proposalId, request));
  handle("desktop:revise-evolution-proposal", (_event, proposalId: string, request: ReviseNangongProposalInDto) => nangong.reviseProposal(proposalId, request));
  handle("desktop:auto-approve-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => hanli.autoApprove(proposalId, request));
  handle("desktop:dispatch-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => nangong.distributeProposal(proposalId, request));
}
