import type { EventCenterTimeline } from "../../services/support/capabilities/event-center/index.js";
import type { CollaborationMemoryPort } from "../../../contracts/services/support/capabilities/event-center/index.js";
import type { PersonaConversationOutDto } from "../../../contracts/services/personas/conversation/index.js";
import type { createHanliRuntime } from "../../services/personas/hanli/index.js";
import type { LinghuRuntime } from "../../services/personas/linghu/index.js";
import {
  createPersonaCapabilityRegistry,
  createPersonaWorkflowRuntime,
  createWorkflowSupervisor,
  createCheckpointCoordinator,
  type CollaborationWorkflowFacade,
  type PersonaEvolutionRuntime,
  type WorkflowRepositoryPort,
} from "../../services/workflow/index.js";

export interface PersonaBootstrapOptions {
  personaEvolution: PersonaEvolutionRuntime;
  hanliRuntime: ReturnType<typeof createHanliRuntime>;
  collaboration: CollaborationWorkflowFacade;
  collaborationTimeline: EventCenterTimeline | null;
  workflowRepository: WorkflowRepositoryPort | null;
  linghuRuntime: LinghuRuntime;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
  memory?: CollaborationMemoryPort | null;
  onConversationChanged?(conversation: PersonaConversationOutDto): void;
}

/** 连接人物公开能力、Evolution/Workflow Facade 和持久化监督器。 */
export function createPersonaApplicationContext(options: PersonaBootstrapOptions) {
  const personaWorkflowRuntime = createPersonaWorkflowRuntime(options.personaEvolution);
  const linghuRuntime = options.linghuRuntime;
  const linghuAutomation = linghuRuntime.facade;
  const nangongRuntime = options.personaEvolution.nangongRuntime;
  const personaRegistry = createPersonaCapabilityRegistry();
  personaRegistry.register({ memberId: nangongRuntime.memberId, displayName: "南宫婉", runtime: nangongRuntime, capabilities: ["investigation", "proposal-authoring"] });
  personaRegistry.register({ memberId: options.hanliRuntime.memberId, displayName: "韩立", runtime: options.hanliRuntime, capabilities: ["deliberation", "proposal-review", "acceptance"] });
  personaRegistry.register({ memberId: linghuRuntime.memberId, displayName: "令狐老祖", runtime: linghuRuntime, capabilities: ["flow-guard", "unified-test"] });
  personaRegistry.requireCapability("proposal-review");
  personaRegistry.requireCapability("unified-test");

  const repository = options.workflowRepository;
  const checkpoints = repository ? createCheckpointCoordinator({
    evolution: () => options.personaEvolution.state(), collaboration: () => options.collaboration.state(),
    pending: () => repository.listWorkflowBlockages(1000),
    save: (id, state) => repository.saveCheckpoint(id, state), resolve: (id, reason) => repository.resolveException(id, reason),
    resume: (id) => options.personaEvolution.resumeOneShotRun(id),
    handleTask: (id, stalled) => linghuAutomation.handleTaskCheckpoint(id, stalled), submitRepair: (request) => linghuAutomation.submitCheckpointRepair(request),
  }, {
    memory: options.memory || null, changed: (conversation) => options.onConversationChanged?.(conversation),
    topic: (id) => { const topic = options.personaEvolution.state().topics.find((item) => item.topicId === id); return topic ? { title: topic.title, createdAt: topic.createdAt, completed: topic.status === "completed" } : null; },
    publish: (event) => options.collaborationTimeline?.appendTimelineEvent(event),
    name: (id) => options.collaboration.state().members.find((member) => member.memberId === id)?.displayName || id,
  }) : null;
  const workflowSupervisor = options.workflowRepository ? createWorkflowSupervisor({
    repository: options.workflowRepository,
    readers: {
      collaboration: () => options.collaboration.state(),
      evolution: () => options.personaEvolution.state(),
      linghu: () => linghuAutomation.state(),
    },
    projectCollaborationTimeline: (state) => options.collaborationTimeline?.appendTaskFlowEvents(state, state.tasks.map((task) => task.taskId)),
    onStalledTasks: async (taskIds) => {
      options.recordEvent("workflow.stalled_tasks_detected", { taskIds, count: taskIds.length });
    },
    onUnhandledExceptions: (events) => checkpoints!.process(events),
  }) : null;

  return {
    personaWorkflowRuntime,
    nangongRuntime,
    linghuRuntime,
    linghuAutomation,
    personaRegistry,
    workflowSupervisor,
  };
}
