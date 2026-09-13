import type { PersonaConversationMessageOutDto, PersonaConversationOutDto, PersonaConversationWindowOutDto, ReadPersonaConversationWindowInDto, SendPersonaConversationMessageInDto } from "../../../contracts/services/personas/conversation/index.js";
import type { ScreenshotCompletedEventOutDto } from "../../../contracts/services/support/platform/attachments/index.js";
import type { EvolutionStateOutDto } from "../../../contracts/services/evolution/index.js";
import type { CollaborationStateOutDto, CollaborationTimelineSnapshotOutDto, DesktopOperatingModeValue } from "../../../contracts/services/workflow/index.js";

type IsolatedAcceptanceScenario = "empty-task-group" | "failure-recovery-timeline" | "inspection-lifecycle-timeline" | "user-language-detail-timeline" | "recovery-action-lifecycle" | "persona-conversation-lifecycle" | "persona-conversation-with-task-handoff";

const scenarioTaskId = "acceptance-failure-recovery-task";
const scenarioTopicId = "acceptance-failure-recovery-topic";
const scenarioProposalId = "acceptance-failure-recovery-proposal";
const hanli = { memberId: "han-li", displayName: "韩立" };
const linghu = { memberId: "linghu-laozu", displayName: "令狐老祖" };

/**
 * 为独立验收窗口保存最小、非持久化运行态。
 *
 * 该会话只覆盖登记的 webContents；正式窗口仍读取和写入正式协作状态。
 */
export class AcceptanceEmptyTaskGroupSession {
  #scenarios = new Map<number, IsolatedAcceptanceScenario>();
  #selectedMembers = new Map<number, string>();
  #operatingModes = new Map<number, DesktopOperatingModeValue>();
  #recoveryLifecycleStarted = new Set<number>();
  #personaConversations = new Map<number, Map<string, PersonaConversationOutDto>>();
  #taskHandoffs = new Map<number, CollaborationTimelineSnapshotOutDto>();
  #failedEarlierReads = new Set<string>();
  #personaScreenshotSequences = new Map<number, number>();

  register(webContentsId: number, sceneKind: IsolatedAcceptanceScenario = "empty-task-group", taskHandoff?: CollaborationTimelineSnapshotOutDto): void {
    this.#scenarios.set(webContentsId, sceneKind);
    this.#selectedMembers.set(webContentsId, "han-li");
    this.#operatingModes.set(webContentsId, "collaboration");
    this.#recoveryLifecycleStarted.delete(webContentsId);
    this.#failedEarlierReads.delete(String(webContentsId));
    this.#personaScreenshotSequences.delete(webContentsId);
    if (sceneKind === "persona-conversation-lifecycle" || sceneKind === "persona-conversation-with-task-handoff") this.#personaConversations.set(webContentsId, personaConversationFixture());
    // 复合场景只保存准备瞬间已筛选的任务交接快照，后续正式任务变化不能进入验收窗口。
    if (sceneKind === "persona-conversation-with-task-handoff" && taskHandoff?.groups.length) this.#taskHandoffs.set(webContentsId, structuredClone(taskHandoff));
  }

  remove(webContentsId: number): void {
    this.#scenarios.delete(webContentsId);
    this.#selectedMembers.delete(webContentsId);
    this.#operatingModes.delete(webContentsId);
    this.#recoveryLifecycleStarted.delete(webContentsId);
    this.#personaConversations.delete(webContentsId);
    this.#taskHandoffs.delete(webContentsId);
    this.#failedEarlierReads.delete(String(webContentsId));
    this.#personaScreenshotSequences.delete(webContentsId);
  }

  isActive(webContentsId: number): boolean {
    return this.#scenarios.has(webContentsId);
  }

  /** 仅人物会话验收场景接收内存截图完成事件，正式窗口仍使用真实截图能力。 */
  isPersonaConversationLifecycle(webContentsId: number): boolean {
    const scene = this.#scenarios.get(webContentsId);
    return scene === "persona-conversation-lifecycle" || scene === "persona-conversation-with-task-handoff";
  }

  /** 生成只在隔离窗口内可见的 PNG 附件回执，供既有 composer 回调验证附件保持。 */
  createPersonaConversationScreenshot(webContentsId: number): ScreenshotCompletedEventOutDto {
    if (!this.isPersonaConversationLifecycle(webContentsId)) {
      throw new Error("当前独立验收场景不允许生成会话截图附件。");
    }
    const sequence = (this.#personaScreenshotSequences.get(webContentsId) || 0) + 1;
    this.#personaScreenshotSequences.set(webContentsId, sequence);
    const createdAt = new Date().toISOString();
    const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
    return {
      attachment: { id, name: `acceptance-persona-screenshot-${sequence}.png`, filePath: "", sizeBytes: 68, createdAt },
      // 1×1 PNG 只供当前 renderer 预览；它不进入正式附件存储或文件系统。
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0rAAAAABJRU5ErkJggg==",
      hasAnnotations: false,
    };
  }

  collaborationState(webContentsId: number, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    return {
      ...actual,
      mode: this.#operatingModes.get(webContentsId) || "collaboration",
      selectedMemberId: this.#selectedMembers.get(webContentsId) || "han-li",
      // 独立验收只能查看真实成员入口，不能读取或改变正式任务与集成批次。
      tasks: [],
      integrationBatches: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /** 模式只属于该验收窗口的导航状态，不写入正式协作 Store。 */
  setMode(webContentsId: number, mode: DesktopOperatingModeValue, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    if (mode !== "single-conversation" && mode !== "collaboration") throw new Error("无效的桌面运行模式。");
    this.#operatingModes.set(webContentsId, mode);
    return this.collaborationState(webContentsId, actual);
  }

  selectMember(webContentsId: number, memberId: string, actual: CollaborationStateOutDto): CollaborationStateOutDto {
    if (!actual.members.some((member) => member.memberId === memberId)) throw new Error("独立验收会话不包含该协作成员。");
    this.#selectedMembers.set(webContentsId, memberId);
    return this.collaborationState(webContentsId, actual);
  }

  timeline(webContentsId?: number): CollaborationTimelineSnapshotOutDto {
    const handoff = webContentsId === undefined ? undefined : this.#taskHandoffs.get(webContentsId);
    if (handoff) return structuredClone(handoff);
    if (webContentsId !== undefined && this.#scenarios.get(webContentsId) === "failure-recovery-timeline") return failureRecoveryTimeline();
    if (webContentsId !== undefined && this.#scenarios.get(webContentsId) === "inspection-lifecycle-timeline") return inspectionLifecycleTimeline();
    if (webContentsId !== undefined && this.#scenarios.get(webContentsId) === "user-language-detail-timeline") return userLanguageDetailTimeline();
    if (webContentsId !== undefined && this.#scenarios.get(webContentsId) === "recovery-action-lifecycle") return recoveryActionLifecycleTimeline(this.#recoveryLifecycleStarted.has(webContentsId));
    return { version: 1, groups: [], updatedAt: new Date().toISOString() };
  }

  /** 仅独立恢复验收场景可推进一次内存时间线，绝不调用正式任务恢复。 */
  continueRecoveryLifecycle(webContentsId: number, taskId: string): CollaborationTimelineSnapshotOutDto {
    if (this.#scenarios.get(webContentsId) !== "recovery-action-lifecycle" || taskId !== scenarioTaskId) {
      throw new Error("当前独立验收场景不允许继续此任务。");
    }
    if (this.#recoveryLifecycleStarted.has(webContentsId)) {
      throw new Error("独立恢复验收已经开始，不能重复继续。");
    }
    this.#recoveryLifecycleStarted.add(webContentsId);
    return this.timeline(webContentsId);
  }

  evolutionState(actual: EvolutionStateOutDto): EvolutionStateOutDto {
    return { ...actual, activeTopicId: null, topics: [], proposals: [], deliberations: [], archiveRecords: [], oneShotConfirmation: null, oneShotRun: null, currentTopicStage: undefined, updatedAt: new Date().toISOString() };
  }

  conversation(webContentsId: number, personaId: string, actual: PersonaConversationOutDto): PersonaConversationOutDto {
    const fixture = this.#personaConversations.get(webContentsId)?.get(personaId);
    if (fixture) return { ...fixture, messages: fixture.messages.slice(-60) };
    return { ...actual, ownerPersonaId: personaId, conversationId: null, messages: [], activity: undefined, contextReadStats: undefined, updatedAt: new Date().toISOString() };
  }

  /** 人物会话场景只从内存读取固定窗口；首次补载失败后保留原入口供真实点击重试。 */
  conversationWindow(webContentsId: number, personaId: string, request: ReadPersonaConversationWindowInDto = {}): PersonaConversationWindowOutDto {
    const fixture = this.#personaConversations.get(webContentsId)?.get(personaId);
    if (!fixture) return { ownerPersonaId: personaId, conversationId: null, selectedModel: null, messages: [], hasEarlier: false, updatedAt: new Date(0).toISOString() };
    const before = request.beforeSequenceNumber;
    const failureKey = `${webContentsId}:${personaId}`;
    if (Number.isInteger(before) && !this.#failedEarlierReads.has(failureKey)) {
      this.#failedEarlierReads.add(failureKey);
      throw new Error("验收场景模拟补载失败，请使用原读取入口重试。");
    }
    const boundary = Number.isInteger(before) ? Number(before) : Number.MAX_SAFE_INTEGER;
    const messages = fixture.messages.filter((message) => message.sequenceNumber < boundary).slice(-60);
    const earliest = messages[0]?.sequenceNumber;
    return { ...fixture, messages, hasEarlier: earliest !== undefined && fixture.messages.some((message) => message.sequenceNumber < earliest) };
  }

  /** 受控验收消息只追加到窗口私有会话，用于核对草稿、附件和人物切换，不接触正式会话。 */
  sendPersonaConversationMessage(webContentsId: number, personaId: string, request: SendPersonaConversationMessageInDto): PersonaConversationOutDto {
    const conversations = this.#personaConversations.get(webContentsId);
    const conversation = conversations?.get(personaId);
    if (!conversations || !conversation) throw new Error("当前独立验收场景不允许发送人物会话消息。");
    const clientMessageId = request.clientMessageId?.trim();
    if (!clientMessageId) throw new Error("人物会话验收消息缺少稳定消息标识。");
    const now = new Date().toISOString();
    const nextSequence = conversation.messages.length;
    const user: PersonaConversationMessageOutDto = {
      messageId: clientMessageId, sequenceNumber: nextSequence, speakerType: "user", speakerPersonaId: null,
      content: request.message, replyToMessageId: null, deliveryStatus: "completed", attachmentIds: request.attachmentIds || [], createdAt: now, completedAt: now,
    };
    const reply: PersonaConversationMessageOutDto = {
      messageId: `${clientMessageId}:reply`, sequenceNumber: nextSequence + 1, speakerType: "persona", speakerPersonaId: personaId,
      content: "验收场景已收到当前人物消息。", replyToMessageId: user.messageId, deliveryStatus: "completed", attachmentIds: [], createdAt: now, completedAt: now,
    };
    const next = { ...conversation, messages: [...conversation.messages, user, reply], updatedAt: now };
    conversations.set(personaId, next);
    return { ...next, messages: next.messages.slice(-60) };
  }

  rejectMutation(): never {
    throw new Error("独立验收会话为只读，不能修改正式协作数据或人物会话。");
  }
}

/** 为人物会话验收提供稳定、可分页且不落盘的消息集合。 */
function personaConversationFixture(): Map<string, PersonaConversationOutDto> {
  const createdAt = new Date().toISOString();
  const create = (personaId: string, count: number): PersonaConversationOutDto => ({
    ownerPersonaId: personaId,
    conversationId: `acceptance-${personaId}-conversation`,
    selectedModel: null,
    createdAt,
    updatedAt: createdAt,
    messages: Array.from({ length: count }, (_, sequenceNumber): PersonaConversationMessageOutDto => ({
      messageId: `acceptance-${personaId}-message-${sequenceNumber + 1}`,
      sequenceNumber,
      speakerType: sequenceNumber % 2 === 0 ? "user" : "persona",
      speakerPersonaId: sequenceNumber % 2 === 0 ? null : personaId,
      content: `验收历史消息 ${sequenceNumber + 1}`,
      replyToMessageId: sequenceNumber % 2 === 0 ? null : `acceptance-${personaId}-message-${sequenceNumber}`,
      deliveryStatus: "completed",
      attachmentIds: [],
      createdAt,
      completedAt: createdAt,
    })),
  });
  return new Map([["han-li", create("han-li", 66)], ["nangong-wan", create("nangong-wan", 4)]]);
}

/** 巡检验收场景在同一只读专题内保留普通、自动恢复和用户处理三类事实。 */
function inspectionLifecycleTimeline(): CollaborationTimelineSnapshotOutDto {
  const now = new Date().toISOString();
  const node = (nodeId: string, status: "completed" | "waiting", action: string, summary: string, content: string, detail: string, detailRole: "result-evidence" | "recovery-conditions", eventType = "inspection.lifecycle") => ({
    nodeId, taskId: scenarioTaskId, eventType, kind: "repair" as const, actor: linghu, recipients: [], status, action, summary, content, detailRole, detail,
    contentRole: "repair-output" as const, startedAt: now, completedAt: status === "waiting" ? null : now, durationMs: 0, automaticOpen: status === "waiting", manualApprovalProposalId: null,
  });
  return {
    version: 1, updatedAt: now, groups: [{
      groupId: scenarioTopicId, topicId: scenarioTopicId, proposalId: scenarioProposalId, title: "巡检记录与任务卡分层验收场景", status: "blocked",
      summary: "普通巡检、自动恢复与用户处理记录均保留在同一专题", executingCount: 0, verifyingCount: 0, waitingCount: 1, completedCount: 2,
      startedAt: now, updatedAt: now, durationMs: 0, nextStep: `${hanli.displayName} · 确认恢复条件`, failureNextStep: "确认恢复条件后继续执行", nextOwner: hanli,
      nodes: [
        node("inspection:normal", "completed", "完成例行巡检", "未发现需要处理的问题", "令狐完成例行核查，没有创建额外任务卡。", "巡检结论：当前任务状态正常。\n影响：无需创建恢复或等待节点。", "result-evidence"),
        node("inspection:auto-recovered", "completed", "自动恢复已完成", "临时连接异常已自动恢复", "令狐按既有授权恢复连接，原专题继续执行。", "问题：临时连接中断。\n恢复：已自动重新建立连接。\n验证：恢复后巡检通过。", "result-evidence"),
        // 需要用户确认的等待事实复用正式恢复契约，使任务卡只为该节点显示继续入口。
        node("inspection:user-action", "waiting", "等待用户确认恢复条件", "需要用户确认后继续", "当前恢复涉及业务范围，令狐保留等待事实而不自动修改任务。", "问题：恢复范围需要确认。\n影响：原任务暂停等待用户处理。\n恢复条件：确认范围后可继续执行。", "recovery-conditions", "customer.action_required"),
      ],
    }],
  };
}

/** 失败恢复场景只投影可审计事实；它不创建任务、不提交恢复，也不读取正式专题。 */
function failureRecoveryTimeline(): CollaborationTimelineSnapshotOutDto {
  const now = new Date().toISOString();
  const recoveryAction = "等待恢复操作";
  const node = (nodeId: string, eventType: string, kind: "verification" | "repair", status: "completed" | "waiting" | "failed", action: string, summary: string, content: string, detail: string, detailRole: "verification-evidence" | "result-evidence" | "recovery-conditions") => ({
    nodeId, taskId: scenarioTaskId, eventType, kind, actor: kind === "repair" ? linghu : hanli, recipients: [], status, action, summary, content, detailRole, detail,
    contentRole: kind === "repair" ? "repair-output" as const : "verification-output" as const, startedAt: now, completedAt: status === "waiting" ? null : now, durationMs: 0, automaticOpen: status !== "completed", manualApprovalProposalId: null,
  });
  return {
    version: 1, updatedAt: now, groups: [{
      groupId: scenarioTopicId, topicId: scenarioTopicId, proposalId: scenarioProposalId, title: "失败与恢复详情验收场景", status: "blocked",
      summary: "等待核对失败详情与恢复条件", executingCount: 0, verifyingCount: 0, waitingCount: 1, completedCount: 2,
      startedAt: now, updatedAt: now, durationMs: 0, nextStep: `${linghu.displayName} · ${recoveryAction}`, failureNextStep: "确认恢复条件后继续执行", nextOwner: linghu,
      nodes: [
        node("acceptance:failure", "unified_test.failed", "verification", "failed", "统一测试发现失败", "候选差异检查失败", "本批候选发现 trailing whitespace。", "失败原因：candidate.txt:1: trailing whitespace\n位置：候选差异检查\n影响：统一测试未通过，候选不能发布。", "verification-evidence"),
        node("acceptance:investigation", "unified_test.repair_investigated", "repair", "completed", "调查失败根因", "已完成根因调查", "令狐已定位异常输出未被保留。", "调查：Git 校验的 stdout 未进入统一错误。\n修复：统一 Git 入口保留 stdout、stderr 与命令上下文。\n测试：候选差异回归测试通过。", "result-evidence"),
        node("acceptance:recovery", "task.interrupted", "repair", "waiting", recoveryAction, "等待继续执行", "恢复入口仅用于验证可达性。", "恢复标识：等待令狐继续执行。\n恢复条件：确认修复结果后重新统一测试。\n本场景为只读，不会提交恢复或修改正式任务。", "recovery-conditions"),
      ],
    }],
  };
}

/** 用户语言与技术详情验收场景同时保留自动处理与客户待办两个独立的只读专题。 */
function userLanguageDetailTimeline(): CollaborationTimelineSnapshotOutDto {
  const now = new Date().toISOString();
  const node = (nodeId: string, eventType: string, kind: "verification" | "repair", status: "completed" | "waiting" | "failed", action: string, summary: string, content: string, detail: string, detailRole: "verification-evidence" | "result-evidence" | "recovery-conditions") => ({
    nodeId, taskId: scenarioTaskId, eventType, kind, actor: kind === "repair" ? linghu : hanli, recipients: [], status, action, summary, content, detailRole, detail,
    contentRole: kind === "repair" ? "repair-output" as const : "verification-output" as const, startedAt: now, completedAt: status === "waiting" ? null : now, durationMs: 0, automaticOpen: status !== "completed", manualApprovalProposalId: null,
  });
  return {
    version: 1, updatedAt: now, groups: [{
      groupId: scenarioTopicId, topicId: scenarioTopicId, proposalId: scenarioProposalId, title: "任务卡用户语言与技术详情分层验收场景", status: "blocked",
      summary: "失败证据、修复经过和客户待办均保留在同一专题", executingCount: 0, verifyingCount: 0, waitingCount: 1, completedCount: 2,
      startedAt: now, updatedAt: now, durationMs: 0, nextStep: `${hanli.displayName} · 确认恢复条件`, failureNextStep: "确认范围后继续执行", nextOwner: hanli,
      nodes: [
        node("acceptance:initial-self-test", "self_test.failed", "verification", "failed", "第1次自测未通过", "发现需要处理的问题", "韩立记录了首次自测的失败事实。", "测试日志：第1次自测未通过\n路径：tests/services/workflow/task-card.test.mjs\n失败证据：详情层缺少完整操作清单。", "verification-evidence"),
        node("acceptance:repair", "unified_test.repair_completed", "repair", "completed", "完成详情分层修复", "已完成修复与复测", "令狐保留用户摘要，并把完整过程放入详情层。", "修复经过：主区只显示用户短摘要。\n完整操作清单：检查投影、调整详情分层、运行针对性回归。\n验证：相关测试通过。", "result-evidence"),
        node("acceptance:customer-action", "customer.action_required", "repair", "waiting", "等待用户确认恢复条件", "需要用户确认后继续", "当前恢复涉及业务范围，令狐保留等待事实而不自动修改任务。", "问题：恢复范围需要确认。\n影响：原任务暂停等待用户处理。\n恢复条件：确认范围后可继续执行。", "recovery-conditions"),
      ],
    }, {
      // 自动处理中专题不混入客户等待事实，确保用户语言与真实状态一致。
      groupId: `${scenarioTopicId}:automatic-processing`, topicId: `${scenarioTopicId}:automatic-processing`, proposalId: scenarioProposalId,
      title: "自动处理状态验收场景", status: "running", summary: "令狐正在自动处理，无需用户操作", executingCount: 1, verifyingCount: 0, waitingCount: 0, completedCount: 0,
      startedAt: now, updatedAt: now, durationMs: 0, nextStep: `${linghu.displayName} · 自动处理完成后同步结果`, failureNextStep: "等待自动处理结果", nextOwner: linghu,
      nodes: [{
        nodeId: "acceptance:automatic-processing", taskId: `${scenarioTaskId}:automatic-processing`, eventType: "repair.automatic_processing", kind: "repair" as const,
        actor: linghu, recipients: [], status: "current" as const, action: "正在自动处理", summary: "正在自动处理中，暂不需要你操作。",
        content: "令狐正在按既有授权处理，不需要用户确认。", contentRole: "repair-output" as const, detailRole: "result-evidence" as const,
        detail: "当前处理：正在自动执行已授权的修复步骤。\n用户操作：当前无需你操作。\n后续：处理完成后会同步结果。",
        startedAt: now, completedAt: null, durationMs: 0, automaticOpen: true, manualApprovalProposalId: null,
      }],
    }],
  };
}

/** 恢复入口验收场景只在窗口内模拟一次等待到恢复中的投影转换。 */
function recoveryActionLifecycleTimeline(recoveryStarted: boolean): CollaborationTimelineSnapshotOutDto {
  const now = new Date().toISOString();
  const waitingStatus = recoveryStarted ? "completed" as const : "waiting" as const;
  return {
    version: 1, updatedAt: now, groups: [{
      groupId: scenarioTopicId, topicId: scenarioTopicId, proposalId: scenarioProposalId, title: "恢复入口唯一性验收场景",
      status: recoveryStarted ? "running" : "blocked", summary: recoveryStarted ? "恢复请求已进入自动处理中" : "等待用户确认恢复条件",
      executingCount: recoveryStarted ? 1 : 0, verifyingCount: 0, waitingCount: recoveryStarted ? 0 : 1, completedCount: recoveryStarted ? 2 : 1,
      startedAt: now, updatedAt: now, durationMs: 0, nextStep: recoveryStarted ? "令狐老祖 · 正在恢复原任务" : "韩立 · 确认恢复条件", failureNextStep: "确认恢复条件后继续执行", nextOwner: recoveryStarted ? linghu : hanli,
      nodes: [
        { nodeId: "acceptance:recovery-history", taskId: scenarioTaskId, eventType: "task.interrupted", kind: "repair" as const, actor: linghu, recipients: [], status: "completed" as const, action: "历史恢复记录", summary: "此前恢复已结束", content: "历史节点只用于核对没有重复入口。", contentRole: "repair-output" as const, detailRole: "result-evidence" as const, detail: "历史恢复已经完成。", startedAt: now, completedAt: now, durationMs: 0, automaticOpen: false, manualApprovalProposalId: null },
        { nodeId: "acceptance:recovery-current", taskId: scenarioTaskId, eventType: "customer.action_required", kind: "repair" as const, actor: linghu, recipients: [], status: waitingStatus, action: "等待用户确认恢复条件", summary: recoveryStarted ? "恢复请求已提交" : "需要用户确认后继续", content: "本场景只验证恢复入口与状态收口，不修改正式任务。", contentRole: "repair-output" as const, detailRole: "recovery-conditions" as const, detail: "恢复条件：确认后继续。", startedAt: now, completedAt: recoveryStarted ? now : null, durationMs: 0, automaticOpen: !recoveryStarted, manualApprovalProposalId: null },
        ...(recoveryStarted ? [{ nodeId: "acceptance:recovery-started", taskId: scenarioTaskId, eventType: "task.recovery_requested", kind: "repair" as const, actor: linghu, recipients: [], status: "current" as const, action: "正在恢复原任务", summary: "正在自动处理中，暂不需要你操作。", content: "恢复已开始。", contentRole: "repair-output" as const, detailRole: "result-evidence" as const, detail: "恢复请求已经开始执行。", startedAt: now, completedAt: null, durationMs: 0, automaticOpen: true, manualApprovalProposalId: null }] : []),
      ],
    }],
  };
}
