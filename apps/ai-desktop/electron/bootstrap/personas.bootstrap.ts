import type { EventCenterTimeline } from "../services/capabilities/event-center/index.js";
import type { createHanliRuntime } from "../services/personas/hanli/index.js";
import type { LinghuRuntime } from "../services/personas/linghu/index.js";
import {
  createPersonaCapabilityRegistry,
  createPersonaWorkflowRuntime,
  createWorkflowSupervisor,
  type CollaborationWorkflowFacade,
  type PersonaEvolutionRuntime,
  type WorkflowRepositoryPort,
} from "../services/workflow/index.js";

export interface PersonaBootstrapOptions {
  personaEvolution: PersonaEvolutionRuntime;
  hanliRuntime: ReturnType<typeof createHanliRuntime>;
  collaboration: CollaborationWorkflowFacade;
  collaborationTimeline: EventCenterTimeline | null;
  workflowRepository: WorkflowRepositoryPort | null;
  linghuRuntime: LinghuRuntime;
  recordEvent(type: string, details: Record<string, unknown>, taskId?: string): void;
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
      await linghuAutomation.checkNow();
    },
    onUnhandledExceptions: (events) => linghuAutomation.handleUnifiedExceptions(events),
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
