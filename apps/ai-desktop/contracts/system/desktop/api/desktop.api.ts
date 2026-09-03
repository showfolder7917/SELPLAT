/**
 * preload 向 Renderer 暴露的桌面能力白名单。
 *
 * 生产者：Electron preload，通过 contextBridge 实现本接口。
 * 消费者：Renderer 各业务 Feature。
 * 数据方向：renderer <-> preload <-> main。
 * 本接口只组合已登记能力，不允许暴露 ipcRenderer、文件系统或任意命令执行对象。
 */
import type { WindowActionValue, WorkspacePermissionValue } from "../../../foundation/index.js";
import type { DesktopEnvironmentOutDto } from "../dto/desktop-environment.out.dto.js";
import type { CodexApprovalOutDto, CodexHarnessStatusOutDto, CodexLoginResponseOutDto, CodexModelCatalogOutDto, CodexStreamEventOutDto, CodexUserInputRequestOutDto, ResolveCodexApprovalOutDto, ResolveCodexUserInputInDto } from "../../../services/support/platform/codex/index.js";
import type { TrustedCommandInfoOutDto } from "../../../services/support/platform/security/index.js";
import type { AutomaticTestPreflightResultOutDto } from "../../../services/support/capabilities/testing/index.js";
import type { ApprovalGovernanceRecordOutDto, CollaborationStateOutDto, CollaborationStateEventOutDto, CollaborationStreamEventOutDto, CollaborationTimelineChangedEventOutDto, CollaborationTimelineSnapshotOutDto, ConfigurePersonaWorkflowInDto, CreateCollaborationMemberInDto, DesktopOperatingModeValue, PersonaWorkflowActionInDto, SubmitCollaborationTaskInDto, UpdateCollaborationMemberInDto } from "../../../services/workflow/index.js";
import type { AuditLogInfoOutDto, RendererExceptionInDto } from "../../../services/support/capabilities/event-center/index.js";
import type { CodexSessionInfoOutDto, ConversationDispatchStateOutDto, EnqueueMessageInDto, SendMessageInDto, SendMessageOutDto } from "../../../services/support/capabilities/conversation/index.js";
import type { TestDataResetResultOutDto } from "../../../services/support/application/index.js";
import type { AiMemoryDatabaseStatusOutDto, CorpusSemanticBackfillStatusOutDto } from "../../../services/support/platform/persistence/index.js";
import type { CreateLinghuRepairProposalOutDto, CreateLinghuStartupPromptInDto, LinghuAutomationStateEventOutDto, LinghuAutomationStateOutDto, UpdateLinghuStartupPromptInDto } from "../../../services/personas/linghu/index.js";
import type { EvolutionMutationInDto, EvolutionStateEventOutDto, EvolutionStateOutDto, EvolutionTopicDossierOutDto } from "../../../services/evolution/index.js";
import type { DecideHanliProposalInDto, DecideHanliResultInDto, HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto } from "../../../services/personas/hanli/index.js";
import type { PersonaConversationOutDto, SendPersonaConversationMessageInDto } from "../../../services/personas/conversation/index.js";
import type { ConvertNangongConversationToTopicInDto, CreateNangongProposalInDto, CreateNangongTopicInDto, GenerateNangongTopicDraftInDto, NangongTopicDraftOutDto, ReviseNangongProposalInDto, UpdateNangongTopicInDto } from "../../../services/personas/nangong/index.js";
import type { DesktopSettingsOutDto, UpdateDesktopSettingsInDto } from "../../../services/support/platform/settings/index.js";
import type { ScreenCaptureOutDto, ScreenCaptureFrameInDto, ScreenCaptureFrameOutDto, ScreenCapturePreparationOutDto, ScreenCaptureInDto, ScreenshotAnnotationWindowInDto, ScreenshotAttachmentOutDto, ScreenshotAttachmentPreviewOutDto, ScreenshotCompletedEventOutDto, ScreenshotSaveInDto, TempDirectoryInfoOutDto } from "../../../services/support/platform/attachments/index.js";
import type { WorkspaceEntryOutDto, WorkspaceStateOutDto } from "../../../services/support/platform/workspace/index.js";
import type { ResolvedRuntimeRuleOutDto, RuleBundleStatusOutDto, RuntimeRuleOutDto } from "../../../services/support/capabilities/rules/index.js";

/** 定义 preload 向渲染层公开的完整白名单；各领域数据结构保留在独立契约文件。 */
export interface DesktopApi {
  /** 读取内置规则包和客户覆盖的当前健康状态。示例：无覆盖时返回 builtinRuleCount 大于零、overlayRuleCount 为零；只读且不产生文件副作用。 */
  getRuleBundleStatus(): Promise<RuleBundleStatusOutDto>;
  /** 列出当前用户的有效规则。示例：source 表示源码规则树或本地规则工作区；只读且不会返回 core、common 或其他用户。 */
  listEffectiveRules(): Promise<RuntimeRuleOutDto[]>;
  /** 按稳定逻辑 ID 查询最终规则。示例：resolveEffectiveRule("AI_DESKTOP_ARCHITECTURE_BOUNDARY_RULES")；未命中返回 rule=null，不抛出文件系统细节。 */
  resolveEffectiveRule(logicalId: string): Promise<ResolvedRuntimeRuleOutDto>;
  /** 读取平台、版本、工程根等只读运行环境信息。 */
  getEnvironment(): Promise<DesktopEnvironmentOutDto>;
  /** 读取 AI Memory 数据库初始化状态，不触发重建。 */
  getAiMemoryDatabaseStatus(): Promise<AiMemoryDatabaseStatusOutDto>;
  /** 清除应用内部测试业务数据并安排受控重启。示例：确认后返回 cleared=true；清理失败时拒绝 Promise，登录、设置、规则和工程文件不受影响。 */
  clearTestData(): Promise<TestDataResetResultOutDto>;
  /** 读取 Codex 历史 AI 摘要补齐进度，不返回原始会话正文。 */
  getCorpusSemanticBackfillStatus(): Promise<CorpusSemanticBackfillStatusOutDto>;
  /** 从最近完整 Codex 回合启动语义补齐；重复调用运行中的任务只返回当前进度。 */
  startCorpusSemanticBackfill(limit?: number): Promise<CorpusSemanticBackfillStatusOutDto>;
  /** 读取当前桌面设置快照。 */
  getSettings(): Promise<DesktopSettingsOutDto>;
  /** 合并并持久化允许修改的桌面设置字段。 */
  updateSettings(settings: UpdateDesktopSettingsInDto): Promise<DesktopSettingsOutDto>;
  /** 读取已登记工作区和当前主工作区。 */
  getWorkspaces(): Promise<WorkspaceStateOutDto>;
  /** 打开系统目录选择器并登记选中的工作区。 */
  addWorkspace(): Promise<WorkspaceStateOutDto>;
  /** 修改指定工作区的只读或写入权限。 */
  updateWorkspacePermission(id: string, permission: WorkspacePermissionValue): Promise<WorkspaceStateOutDto>;
  /** 把指定工作区设为主工作区。 */
  setPrimaryWorkspace(id: string): Promise<WorkspaceStateOutDto>;
  /** 从登记列表移除工作区，不删除磁盘目录。 */
  removeWorkspace(id: string): Promise<WorkspaceStateOutDto>;
  /** 列出工作区首层安全目录项，不递归读取内容。 */
  listWorkspaceEntries(id: string): Promise<WorkspaceEntryOutDto[]>;
  /** 读取官方 Codex Harness 的连接、认证和运行版本。 */
  getCodexStatus(): Promise<CodexHarnessStatusOutDto>;
  /** 读取 Harness 当前可选模型目录。 */
  getCodexModels(): Promise<CodexModelCatalogOutDto>;
  /** 读取当前持久化的 Codex 线程标识。 */
  getActiveCodexSession(): Promise<CodexSessionInfoOutDto>;
  /** 启动官方 ChatGPT 浏览器登录流程，不向 Renderer 返回令牌。 */
  loginWithChatGPT(): Promise<CodexLoginResponseOutDto>;
  /** 清除 AI Desktop Harness 登录状态。 */
  logoutCodex(): Promise<CodexHarnessStatusOutDto>;
  /** 读取主会话和协同会话待处理审批。 */
  getCodexApprovals(): Promise<CodexApprovalOutDto[]>;
  /** 读取审批治理审计记录。 */
  getApprovalGovernance(): Promise<ApprovalGovernanceRecordOutDto[]>;
  /** 对指定请求作出允许或拒绝决定。 */
  resolveCodexApproval(requestId: number, decision: "accept" | "decline"): Promise<ResolveCodexApprovalOutDto>;
  /** 读取可信命令数量等脱敏信息。 */
  getTrustedCommandInfo(): Promise<TrustedCommandInfoOutDto>;
  /** 清空已保存的可信命令授权。 */
  clearTrustedCommands(): Promise<TrustedCommandInfoOutDto>;
  /** 检查统一测试所需环境，只返回结构化检查结果。 */
  prepareAutomaticTesting(): Promise<AutomaticTestPreflightResultOutDto>;
  /** 读取 Harness 正在等待用户回答的问题。 */
  getCodexUserInputs(): Promise<CodexUserInputRequestOutDto[]>;
  /** 向 Harness 回答一个已登记用户问题。 */
  resolveCodexUserInput(request: ResolveCodexUserInputInDto): Promise<void>;
  /** 结束当前线程并创建全新会话上下文。 */
  newChat(): Promise<void>;
  /** 由主进程校验协议后使用系统浏览器打开网址。 */
  openExternalUrl(url: string): Promise<void>;
  /** 检查截图权限和可用屏幕来源。 */
  prepareScreenCapture(): Promise<ScreenCapturePreparationOutDto>;
  /** 打开操作系统屏幕录制权限设置。 */
  openScreenRecordingSettings(): Promise<void>;
  /** 保存恢复意图并重启应用以刷新录屏权限。 */
  restartForScreenRecordingPermission(): Promise<void>;
  /** 获取一帧受控屏幕捕获；权限不足返回空或阻断结果。 */
  captureScreen(request?: ScreenCaptureInDto): Promise<ScreenCaptureOutDto | null>;
  /** 记录截图阶段诊断，不携带原始像素。 */
  notifyScreenCaptureStage(stage: string, detail?: string): Promise<void>;
  /** 订阅主进程的冻结帧请求，返回取消订阅函数。 */
  onScreenCaptureFrameRequested(listener: (request: ScreenCaptureFrameInDto) => void): () => void;
  /** 把隔离截图窗口生成的帧结果交回主进程。 */
  submitScreenCaptureFrameResult(result: ScreenCaptureFrameOutDto): Promise<void>;
  /** 显示独立截图窗口。 */
  showScreenshotWindow(): Promise<void>;
  /** 订阅截图编辑状态重置信号。 */
  onScreenCaptureReset(listener: () => void): () => void;
  /** 从选区阶段进入标注阶段。 */
  enterScreenshotAnnotation(request: ScreenshotAnnotationWindowInDto): Promise<void>;
  /** 从标注阶段返回截图选区。 */
  returnScreenshotSelection(): Promise<void>;
  /** 结束当前截图编辑会话。 */
  endScreenshotEditing(): Promise<void>;
  /** 保存截图并返回主进程签发的附件元数据。 */
  saveScreenshot(request: ScreenshotSaveInDto): Promise<ScreenshotAttachmentOutDto>;
  /** 按已签发附件 ID 恢复人物历史中的 PNG 预览；不可读取项返回明确业务状态。 */
  readAttachmentPreviews(attachmentIds: string[]): Promise<ScreenshotAttachmentPreviewOutDto[]>;
  /** 订阅已完成截图附件，返回取消订阅函数。 */
  onScreenshotCompleted(listener: (event: ScreenshotCompletedEventOutDto) => void): () => void;
  /** 读取临时目录文件数量和容量摘要。 */
  getTempDirectoryInfo(): Promise<TempDirectoryInfoOutDto>;
  /** 使用系统文件管理器打开应用临时目录。 */
  openTempDirectory(): Promise<void>;
  /** 清理应用管理范围内的临时文件并返回新摘要。 */
  clearTempFiles(): Promise<TempDirectoryInfoOutDto>;
  /** 读取业务审计目录和最近任务摘要。 */
  getAuditLogInfo(): Promise<AuditLogInfoOutDto>;
  /** 使用系统文件管理器打开审计目录。 */
  openAuditLogDirectory(): Promise<void>;
  /** 读取协同成员、任务、审批和集成状态快照。 */
  getCollaborationState(): Promise<CollaborationStateOutDto>;
  /** 读取主进程生成的追加式专题任务卡时间线；旧四阶段页面不得反向写入该投影。 */
  getCollaborationTimeline(): Promise<CollaborationTimelineSnapshotOutDto>;
  /** 订阅 SQLite 成功提交后的时间线变更通知。 */
  onCollaborationTimelineChanged(listener: (event: CollaborationTimelineChangedEventOutDto) => void): () => void;
  /** 在单会话与协同模式之间切换并持久化状态。 */
  setDesktopOperatingMode(mode: DesktopOperatingModeValue): Promise<CollaborationStateOutDto>;
  /** 切换 Renderer 当前查看的协同成员。 */
  selectCollaborationMember(memberId: string): Promise<CollaborationStateOutDto>;
  /** 创建一个通过主进程校验的协同成员。 */
  createCollaborationMember(request: CreateCollaborationMemberInDto): Promise<CollaborationStateOutDto>;
  /** 更新指定成员的可修改身份配置。 */
  updateCollaborationMember(memberId: string, request: UpdateCollaborationMemberInDto): Promise<CollaborationStateOutDto>;
  /** 删除可移除成员；运行中或系统成员会被主进程拒绝。 */
  deleteCollaborationMember(memberId: string): Promise<CollaborationStateOutDto>;
  /** 提交协同任务并返回包含新任务的状态。 */
  submitCollaborationTask(request: SubmitCollaborationTaskInDto): Promise<CollaborationStateOutDto>;
  /** 从允许恢复的阶段继续指定协同任务。 */
  continueCollaborationTask(taskId: string): Promise<CollaborationStateOutDto>;
  /** 请求取消指定协同任务。 */
  cancelCollaborationTask(taskId: string): Promise<CollaborationStateOutDto>;
  /** 订阅协同状态变化，监听函数接收结构化原因和任务 ID。 */
  onCollaborationState(listener: (event: CollaborationStateEventOutDto) => void): () => void;
  /** 订阅协同成员的筛选后 Codex 流事件。 */
  onCollaborationStream(listener: (event: CollaborationStreamEventOutDto) => void): () => void;
  /** 读取令狐自动化的健康检查和恢复状态。 */
  getLinghuAutomationState(): Promise<LinghuAutomationStateOutDto>;
  /** 启用或暂停令狐自动化轮询。 */
  setLinghuAutomationEnabled(enabled: boolean): Promise<LinghuAutomationStateOutDto>;
  /** 新增令狐启动提示配置。 */
  createLinghuStartupPrompt(request: CreateLinghuStartupPromptInDto): Promise<LinghuAutomationStateOutDto>;
  /** 修改指定令狐启动提示。 */
  updateLinghuStartupPrompt(promptId: string, request: UpdateLinghuStartupPromptInDto): Promise<LinghuAutomationStateOutDto>;
  /** 删除非系统锁定的令狐启动提示。 */
  deleteLinghuStartupPrompt(promptId: string): Promise<LinghuAutomationStateOutDto>;
  /** 选择令狐后续自动检查使用的启动提示。 */
  selectLinghuStartupPrompt(promptId: string): Promise<LinghuAutomationStateOutDto>;
  /** 订阅令狐自动化状态事件。 */
  onLinghuAutomationState(listener: (event: LinghuAutomationStateEventOutDto) => void): () => void;
  /** 读取专题、提案、审批和自动化运行状态。 */
  getEvolutionState(): Promise<EvolutionStateOutDto>;
  /** 读取指定专题的来源、对话、审批和执行档案。 */
  getEvolutionTopicDossier(topicId: string): Promise<EvolutionTopicDossierOutDto>;
  /** 读取韩立当前固定人物会话。 */
  getPersonaConversation(personaId: string): Promise<PersonaConversationOutDto>;
  /** 订阅人物会话持久消息变化；内部研讨每新增一条消息都会返回同一权威会话快照。 */
  onPersonaConversationChanged(listener: (conversation: PersonaConversationOutDto) => void): () => void;
  /** 向韩立发送自由讨论消息；韩立只读取语义记忆并进行只读分析。 */
  sendPersonaConversationMessage(personaId: string, request: SendPersonaConversationMessageInDto): Promise<PersonaConversationOutDto>;
  /** 关闭韩立当前固定线程并建立空白自由对话。 */
  newPersonaConversation(personaId: string): Promise<PersonaConversationOutDto>;
  /** 从已确认输入建立新专题。 */
  createEvolutionTopic(request: CreateNangongTopicInDto): Promise<EvolutionStateOutDto>;
  /** 更新演化自动化时间、次数等受控配置。 */
  configureEvolutionAutomation(request: ConfigurePersonaWorkflowInDto): Promise<EvolutionStateOutDto>;
  /** 启动、暂停、恢复或停止演化自动化。 */
  controlEvolutionAutomation(action: PersonaWorkflowActionInDto): Promise<EvolutionStateOutDto>;
  /** 从已持久化卡点恢复同一专题和提案链。 */
  resumeEvolutionOneShot(): Promise<EvolutionStateOutDto>;
  /** 向南宫调查会话发送消息并记录来源。 */
  /** 清空当前南宫会话并创建新会话。 */
  /** 根据冻结对话生成专题草案，不直接创建专题。 */
  generateNangongTopicDraft(request: GenerateNangongTopicDraftInDto): Promise<NangongTopicDraftOutDto>;
  /** 经用户确认后把南宫会话转换为正式专题。 */
  convertNangongConversationToTopic(request: ConvertNangongConversationToTopicInDto): Promise<EvolutionStateOutDto>;
  /** 为指定专题提交演化提案。 */
  createEvolutionProposal(topicId: string, request: CreateNangongProposalInDto): Promise<EvolutionStateOutDto>;
  /** 更新专题允许修改的元数据。 */
  updateEvolutionTopic(topicId: string, request: UpdateNangongTopicInDto): Promise<EvolutionStateOutDto>;
  /** 由令狐异常证据创建修复提案。 */
  createLinghuRepairProposal(request: CreateLinghuRepairProposalOutDto): Promise<EvolutionStateOutDto>;
  /** 审批或退回提案方向。 */
  decideEvolutionProposal(proposalId: string, request: DecideHanliProposalInDto): Promise<EvolutionStateOutDto>;
  /** 验收或退回提案执行结果。 */
  decideEvolutionResult(proposalId: string, request: DecideHanliResultInDto): Promise<EvolutionStateOutDto>;
  /** 由韩立依据当前专题事实生成并持久化真实界面验收计划。 */
  generateHanLiAcceptancePlan(proposalId: string): Promise<HanliAcceptancePlanOutDto>;
  /** 在当前 AI Desktop 主窗口执行计划中的受控真实操作并保存截图证据。 */
  executeHanLiAcceptancePlan(planId: string): Promise<HanliAcceptanceRunOutDto>;
  /** 根据审批意见修订指定提案。 */
  reviseEvolutionProposal(proposalId: string, request: ReviseNangongProposalInDto): Promise<EvolutionStateOutDto>;
  /** 在允许自动审批时执行韩立审批。 */
  autoApproveEvolutionProposal(proposalId: string, request: EvolutionMutationInDto): Promise<EvolutionStateOutDto>;
  /** 把已审批提案分发为受控协同任务。 */
  dispatchEvolutionProposal(proposalId: string, request: EvolutionMutationInDto): Promise<EvolutionStateOutDto>;
  /** 订阅演化状态变化，返回取消订阅函数。 */
  onEvolutionState(listener: (event: EvolutionStateEventOutDto) => void): () => void;
  /** 读取主会话当前执行项、等待队列和恢复状态。 */
  getConversationDispatchState(): Promise<ConversationDispatchStateOutDto>;
  /** 在已有任务执行时把消息加入等待队列。 */
  enqueueMessage(request: EnqueueMessageInDto): Promise<ConversationDispatchStateOutDto>;
  /** 把排队消息标记为下一轮补充输入。 */
  supplementQueuedMessage(itemId: string): Promise<ConversationDispatchStateOutDto>;
  /** 丢弃指定排队消息。 */
  discardQueuedMessage(itemId: string): Promise<ConversationDispatchStateOutDto>;
  /** 恢复上次非正常中断的会话任务。 */
  recoverConversationTask(): Promise<ConversationDispatchStateOutDto>;
  /** 明确放弃上次会话恢复记录。 */
  discardConversationRecovery(): Promise<ConversationDispatchStateOutDto>;
  /** 订阅主会话队列状态。 */
  onConversationDispatchState(listener: (state: ConversationDispatchStateOutDto) => void): () => void;
  /** 发送一轮主会话消息；附件只用主进程签发 ID 引用。 */
  sendMessage(request: SendMessageInDto): Promise<SendMessageOutDto>;
  /** 订阅当前窗口发起任务的筛选后流事件。 */
  onCodexStreamEvent(listener: (event: CodexStreamEventOutDto) => void): () => void;
  /** 请求取消当前主会话执行，返回是否找到活动任务。 */
  cancel(): Promise<boolean>;
  /** 单向上报 Renderer 异常；详细堆栈只进入本地审计。 */
  reportRendererException(report: RendererExceptionInDto): void;
  /** 发送最小化、最大化或关闭窗口动作。 */
  windowControl(action: WindowActionValue): void;
}
