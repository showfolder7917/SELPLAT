/** 协同、令狐自动化与南宫演化桥接；领域命令只传递结构化数据。 */
import { invoke, subscribe } from "../ipc-client.cjs";

export function collaborationBridge() {
  return {
    getCollaborationState: () => invoke("desktop:get-collaboration-state"),
    getCollaborationTimeline: () => invoke("desktop:get-collaboration-timeline"),
    onCollaborationTimelineChanged: (listener: (event: unknown) => void) => subscribe("desktop:collaboration-timeline-changed", listener),
    setDesktopOperatingMode: (mode: string) => invoke("desktop:set-operating-mode", mode),
    selectCollaborationMember: (memberId: string) => invoke("desktop:select-collaboration-member", memberId),
    submitCollaborationTask: (request: unknown) => invoke("desktop:submit-collaboration-task", request),
    continueCollaborationTask: (taskId: string) => invoke("desktop:continue-collaboration-task", taskId),
    cancelCollaborationTask: (taskId: string) => invoke("desktop:cancel-collaboration-task", taskId),
    onCollaborationState: (listener: (event: unknown) => void) => subscribe("desktop:collaboration-state", listener),
    onCollaborationStream: (listener: (event: unknown) => void) => subscribe("desktop:collaboration-stream", listener),
    getLinghuAutomationState: () => invoke("desktop:get-linghu-automation-state"),
    setLinghuAutomationEnabled: (enabled: boolean) => invoke("desktop:set-linghu-automation-enabled", enabled),
    newLinghuDisplayConversation: () => invoke("desktop:new-linghu-display-conversation"),
    onLinghuAutomationState: (listener: (event: unknown) => void) => subscribe("desktop:linghu-automation-state", listener),
    getEvolutionState: () => invoke("desktop:get-nangong-evolution-state"),
    getEvolutionTopicDossier: (topicId: string) => invoke("desktop:get-evolution-topic-dossier", topicId),
    // 页面只传人物 ID；增加新人物时 preload 不需要再增加方法。
    getPersonaConversation: (personaId: string) => invoke("desktop:get-persona-conversation", personaId),
    onPersonaConversationChanged: (listener: (conversation: unknown) => void) => subscribe("desktop:persona-conversation-changed", listener),
    sendPersonaConversationMessage: (personaId: string, request: unknown) => invoke("desktop:send-persona-conversation-message", personaId, request),
    newPersonaConversation: (personaId: string) => invoke("desktop:new-persona-conversation", personaId),
    generateNangongTopicDraft: (request: unknown) => invoke("desktop:generate-nangong-topic-draft", request),
    convertNangongConversationToTopic: (request: unknown) => invoke("desktop:convert-nangong-conversation-to-topic", request),
    createEvolutionTopic: (request: unknown) => invoke("desktop:create-evolution-topic", request),
    updateEvolutionTopic: (topicId: string, request: unknown) => invoke("desktop:update-evolution-topic", topicId, request),
    configureEvolutionAutomation: (request: unknown) => invoke("desktop:configure-evolution-automation", request),
    controlEvolutionAutomation: (action: string) => invoke("desktop:control-evolution-automation", action),
    resumeEvolutionOneShot: (runId: string) => invoke("desktop:resume-nangong-one-shot-evolution", runId),
    createEvolutionProposal: (topicId: string, request: unknown) => invoke("desktop:create-evolution-proposal", topicId, request),
    decideEvolutionProposal: (proposalId: string, request: unknown) => invoke("desktop:decide-evolution-proposal", proposalId, request),
    decideEvolutionResult: (proposalId: string, request: unknown) => invoke("desktop:decide-evolution-result", proposalId, request),
    reviseEvolutionProposal: (proposalId: string, request: unknown) => invoke("desktop:revise-evolution-proposal", proposalId, request),
    autoApproveEvolutionProposal: (proposalId: string, request: unknown) => invoke("desktop:auto-approve-evolution-proposal", proposalId, request),
    dispatchEvolutionProposal: (proposalId: string, request: unknown) => invoke("desktop:dispatch-evolution-proposal", proposalId, request),
    onEvolutionState: (listener: (event: unknown) => void) => subscribe("desktop:evolution-state", listener),
  };
}
