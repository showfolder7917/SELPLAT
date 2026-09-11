/**
 * 协同、人物与演化跨进程 API 的唯一领域视图。
 *
 * 调用链：Renderer collaboration/persona/evolution features -> collaboration desktop adapter
 * -> collaboration preload bridge -> collaboration IPC -> Workflow、Persona 与 Evolution Facade。
 */
import type { DesktopApi } from "../desktop.api.js";

/** 协同领域方法始终从同名 Renderer、preload 和 IPC 入口顺序追踪。 */
export const COLLABORATION_DESKTOP_API_METHODS = [
  "getCollaborationState",
  "getCollaborationTimeline",
  "onCollaborationTimelineChanged",
  "setDesktopOperatingMode",
  "selectCollaborationMember",
  "submitCollaborationTask",
  "continueCollaborationTask",
  "cancelCollaborationTask",
  "onCollaborationState",
  "onCollaborationStream",
  "getLinghuAutomationState",
  "setLinghuAutomationEnabled",
  "newLinghuDisplayConversation",
  "onLinghuAutomationState",
  "getEvolutionState",
  "getEvolutionTopicDossier",
  "getPersonaConversation",
  "onPersonaConversationChanged",
  "sendPersonaConversationMessage",
  "newPersonaConversation",
  "selectPersonaConversationModel",
  "createEvolutionTopic",
  "configureEvolutionAutomation",
  "controlEvolutionAutomation",
  "resumeEvolutionOneShot",
  "generateNangongTopicDraft",
  "convertNangongConversationToTopic",
  "createEvolutionProposal",
  "updateEvolutionTopic",
  "decideEvolutionProposal",
  "decideEvolutionResult",
  "reviseEvolutionProposal",
  "autoApproveEvolutionProposal",
  "dispatchEvolutionProposal",
  "onEvolutionState",
] as const satisfies readonly (keyof DesktopApi)[];

/** Renderer 协同、人物和演化模块共享的最小跨进程视图。 */
export type CollaborationDesktopApi = Pick<DesktopApi, (typeof COLLABORATION_DESKTOP_API_METHODS)[number]>;
