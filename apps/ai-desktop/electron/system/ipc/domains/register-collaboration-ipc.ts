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
import type { ConfigurePersonaWorkflowInDto, PersonaWorkflowActionInDto, RequestSupplementalAcceptanceInDto } from "../../../../contracts/services/workflow/index.js";
import type { CollaborationWorkflowFacade as CollaborationCoordinator, CollaborationInteractionPerformancePort, CollaborationNavigationPreferencePort } from "../../../services/workflow/index.js";
import type { LinghuAutomationFacade } from "../../../services/personas/linghu/index.js";
import type { NangongFacade } from "../../../services/personas/nangong/index.js";
import type { HanliFacade } from "../../../services/personas/hanli/index.js";
import type { PersonaConversationFacade } from "../../../services/personas/conversation/index.js";
import type { EvolutionFacade } from "../../../services/evolution/index.js";
import type { PersonaWorkflowFacade } from "../../../services/workflow/index.js";
import type { EventCenterFacade, EventCenterTimeline as CollaborationTimelineFacade } from "../../../services/support/capabilities/event-center/index.js";
import { registerEventCenterIpcHandler } from "../event-center-ipc.js";
import type { HanliTaskCollaborationScenario } from "../../../services/personas/hanli/internal/acceptance/hanli-task-collaboration-scenario.js";

/** 协同领域集中登记人物、任务和令狐自动保障通道，总注册器不再感知每个业务动作。 */
export function registerCollaborationIpc(
  collaboration: CollaborationCoordinator,
  navigationPreference: CollaborationNavigationPreferencePort,
  interactionPerformance: CollaborationInteractionPerformancePort,
  linghuAutomation: LinghuAutomationFacade,
  nangong: NangongFacade,
  hanli: HanliFacade,
  personaConversations: PersonaConversationFacade,
  evolution: EvolutionFacade,
  personaWorkflow: PersonaWorkflowFacade,
  eventCenter: EventCenterFacade,
  collaborationTimeline: CollaborationTimelineFacade | null,
  refreshWorkflowCheckpoints?: () => Promise<void>,
  hanliTaskScenario?: HanliTaskCollaborationScenario,
): void {
  const handle = <Arguments extends unknown[]>(channel: string, handler: Parameters<typeof registerEventCenterIpcHandler<Arguments>>[2]): void => registerEventCenterIpcHandler(eventCenter, channel, handler, "business");
  handle("desktop:get-collaboration-state", async () => collaboration.state());
  // 任务协作群只读取 SQLite 不可变事件；数据库不可用时抛给 EventCenter，禁止退回 JSON 快照拼接旧实现。
  handle("desktop:get-collaboration-timeline", (event) => {
    if (!collaborationTimeline) throw new Error("任务协作群数据库不可用，已阻断旧快照时间线回退。");
    return hanliTaskScenario?.timelineFor(event.sender.id, collaborationTimeline.getTimelineSnapshot()) || collaborationTimeline.getTimelineSnapshot();
  });
  handle("desktop:get-collaboration-timeline-groups", (event, groupIds: string[]) => {
    if (!collaborationTimeline) throw new Error("任务协作群数据库不可用，已阻断旧快照时间线回退。");
    const ids = Array.isArray(groupIds) ? groupIds.filter((value): value is string => typeof value === "string") : [];
    return hanliTaskScenario?.timelineGroupsFor(event.sender.id, ids, collaborationTimeline.getTimelineSnapshot()) || collaborationTimeline.getTimelineGroups(ids);
  });
  handle("desktop:get-collaboration-timeline-projection-status", () => collaborationTimeline?.getProjectionStatus() || { status: "ready", message: "", taskId: null, operation: "none" });
  handle("desktop:retry-collaboration-timeline-projection", () => {
    if (!collaborationTimeline) throw new Error("任务协作群数据库不可用，无法重试进度更新。");
    collaborationTimeline.retryProjection();
  });
  handle("desktop:get-collaboration-navigation-preference", () => navigationPreference.restore(collaboration.state().members));
  handle("desktop:save-collaboration-navigation-preference", (_event, memberId: string) => {
    if (typeof memberId !== "string") throw new Error("人物标识无效，无法保存查看位置。");
    navigationPreference.save(memberId, collaboration.state().members);
  });
  handle("desktop:record-collaboration-interaction-performance", (_event, sample: { operation?: unknown; durationMs?: unknown; datasetId?: unknown; scenarioId?: unknown; phase?: unknown; details?: unknown }) => {
    if (typeof sample?.operation !== "string" || typeof sample.datasetId !== "string" || typeof sample.scenarioId !== "string" || typeof sample.durationMs !== "number" || (sample.phase !== "baseline" && sample.phase !== "candidate")) return;
    const details = sample.details && typeof sample.details === "object" && !Array.isArray(sample.details) ? sample.details as Record<string, string | number | boolean | null> : undefined;
    interactionPerformance.record({ operation: sample.operation, durationMs: sample.durationMs, datasetId: sample.datasetId, scenarioId: sample.scenarioId, phase: sample.phase, details });
  });
  handle("desktop:get-collaboration-interaction-performance-comparison", (_event, datasetId: string, scenarioId: string) => {
    if (typeof datasetId !== "string" || typeof scenarioId !== "string") throw new Error("性能比较请求缺少数据集或操作场景。 ");
    return interactionPerformance.comparison(datasetId, scenarioId);
  });
  handle("desktop:set-operating-mode", (_event, mode: DesktopOperatingModeValue) => collaboration.setMode(mode));
  handle("desktop:submit-collaboration-task", (_event, request: SubmitCollaborationTaskInDto) => collaboration.submitTask(request).state);
  handle("desktop:continue-collaboration-task", (event, taskId: string) => {
    const scenarioResult = hanliTaskScenario?.confirm(event.sender.id, taskId);
    if (scenarioResult) return scenarioResult;
    if (hanliTaskScenario?.isActiveFor(event.sender.id)) {
      throw new Error("韩立隔离验收场景只接受当前页面签发的确认入口。");
    }
    return collaboration.continueTask(taskId);
  });
  handle("desktop:cancel-collaboration-task", (_event, taskId: string) => collaboration.cancelTask(taskId));
  handle("desktop:get-linghu-automation-state", () => linghuAutomation.state());
  handle("desktop:set-linghu-automation-enabled", (_event, enabled: boolean) => linghuAutomation.setEnabled(enabled === true));
  handle("desktop:new-linghu-display-conversation", () => linghuAutomation.newDisplayConversation());
  handle("desktop:get-nangong-evolution-state", (event) => hanliTaskScenario?.stateFor(event.sender.id, evolution.state()) || evolution.state());
  handle("desktop:get-nangong-evolution-read-recovery", () => evolution.readRecovery());
  handle("desktop:get-evolution-topic-dossier", (_event, topicId: string) => evolution.dossier(topicId));
  // 人物会话统一通过读取、发送、新建和模型选择四类入口访问；新人物只需注册处理器。
  handle("desktop:get-persona-conversation", (_event, personaId: string) => personaConversations.conversation(personaId));
  handle("desktop:prepare-persona-conversation-recovery", (_event, personaId: string, request?: Pick<ReadPersonaConversationWindowInDto, "conversationId">) => personaConversations.prepareConversationRecovery(personaId, request));
  handle("desktop:get-persona-conversation-window", (_event, personaId: string, request?: ReadPersonaConversationWindowInDto) => personaConversations.conversationWindow(personaId, request || {}));
  handle("desktop:retry-persona-customer-display-message", (_event, personaId: string, conversationId: string, sourceMessageId: string) => personaConversations.retryCustomerDisplayMessage(personaId, conversationId, sourceMessageId));
  handle("desktop:send-persona-conversation-message", (_event, personaId: string, request: SendPersonaConversationMessageInDto) => personaConversations.send(personaId, request));
  handle("desktop:new-persona-conversation", (_event, personaId: string) => personaConversations.newConversation(personaId));
  handle("desktop:select-persona-conversation-model", (_event, personaId: string, selectedModel: string | null) => personaConversations.selectModel(personaId, selectedModel));
  handle("desktop:generate-nangong-topic-draft", (_event, request: GenerateNangongTopicDraftInDto) => nangong.generateTopicDraft(request));
  handle("desktop:convert-nangong-conversation-to-topic", (_event, request: ConvertNangongConversationToTopicInDto) => nangong.convertConversationToTopic(request));
  handle("desktop:create-evolution-topic", (_event, request: CreateNangongTopicInDto) => evolution.createTopic(request));
  handle("desktop:update-evolution-topic", (_event, topicId: string, request: UpdateNangongTopicInDto) => nangong.updateTopic(topicId, request));
  handle("desktop:configure-evolution-automation", (_event, request: ConfigurePersonaWorkflowInDto) => personaWorkflow.configureAutomation(request));
  handle("desktop:control-evolution-automation", (_event, action: PersonaWorkflowActionInDto) => personaWorkflow.controlAutomation(action));
  handle("desktop:resume-nangong-one-shot-evolution", async (event, request: RequestSupplementalAcceptanceInDto) => {
    if (!request || typeof request.topicId !== "string" || typeof request.proposalId !== "string" || typeof request.runId !== "string") {
      throw new Error("补验请求缺少原专题、当前提案或原运行标识，请刷新任务状态。");
    }
    const resumed = await personaWorkflow.requestSupplementalAcceptance(request);
    // 用户点击恢复后立即唤醒统一卡点入口；不能再等待下一轮后台巡检才把真实阻塞交给令狐。
    await refreshWorkflowCheckpoints?.();
    return resumed;
  });
  handle("desktop:retire-stale-evolution-topic", async (_event, request: { topicId?: unknown; proposalId?: unknown }) => {
    if (!request || typeof request.topicId !== "string" || typeof request.proposalId !== "string") {
      throw new Error("退役旧任务卡缺少专题或提案标识，请刷新后重试。");
    }
    const before = evolution.state();
    if (before.activeTopicId === request.topicId || before.oneShotRun?.topicId === request.topicId) {
      throw new Error("当前专题不能作为旧卡退役，请继续既定人物流程。");
    }
    const proposalIds = before.proposals.filter((item) => item.topicId === request.topicId).map((item) => item.proposalId);
    for (const proposalId of proposalIds) {
      while (await collaboration.archiveStaleTopicTask(proposalId, "用户已通过任务卡退役旧任务链；旧执行和工作树仅保留审计。")) {
        // 同一提案可能留下多个人物任务；逐一封存直到没有活动任务。
      }
    }
    const retiredReason = "旧任务卡已退出当前专题；旧提案、旧执行与工作树仅保留审计，不得恢复。";
    const retired = evolution.retireStaleTopic(request.topicId, request.proposalId, retiredReason);
    // 演化状态与任务时间线是两个独立读模型；同一次受控退役必须给时间线追加终态事实，
    // 否则旧审批节点仍会把卡片投影为活动态，并再次暴露退役按钮。
    if (collaborationTimeline) {
      const group = collaborationTimeline.getTimelineSnapshot().groups.find((item) => item.topicId === request.topicId);
      if (group) {
        const occurredAt = new Date().toISOString();
        const sourceFactKey = `topic-retired:${request.topicId}`;
        collaborationTimeline.appendTimelineEvent({
          eventId: sourceFactKey,
          eventType: "topic.retired",
          group: {
            groupId: group.groupId,
            topicId: request.topicId,
            proposalId: request.proposalId,
            title: group.title,
            status: "cancelled",
            summary: retiredReason,
            startedAt: group.startedAt,
            updatedAt: occurredAt,
          },
          fact: {
            nodeId: sourceFactKey,
            taskId: null,
            proposalId: request.proposalId,
            sourceFactKey,
            occurredAt,
            kind: "result",
            actor: { memberId: "system", displayName: "系统" },
            recipients: [],
            status: "completed",
            action: "旧任务卡已退役",
            summary: retiredReason,
            contentRole: "status",
            content: retiredReason,
            detailRole: "none",
            detail: "",
            startedAt: occurredAt,
            completedAt: occurredAt,
            automaticOpen: false,
            manualApprovalProposalId: null,
          },
        });
      }
    }
    return retired;
  });
  handle("desktop:create-evolution-proposal", (_event, topicId: string, request: CreateNangongProposalInDto) => nangong.createProposal(topicId, request));
  handle("desktop:decide-evolution-proposal", (_event, proposalId: string, request: DecideHanliProposalInDto) => hanli.decideProposal(proposalId, request));
  handle("desktop:decide-evolution-result", (_event, proposalId: string, request: DecideHanliResultInDto) => hanli.decideResult(proposalId, request));
  handle("desktop:revise-evolution-proposal", (_event, proposalId: string, request: ReviseNangongProposalInDto) => nangong.reviseProposal(proposalId, request));
  handle("desktop:auto-approve-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => hanli.autoApprove(proposalId, request));
  handle("desktop:dispatch-evolution-proposal", (_event, proposalId: string, request: EvolutionMutationInDto) => nangong.distributeProposal(proposalId, request));
}
