import type { CollaborationMemberOutDto, CollaborationRequirementPlanOutDto, CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";
import type { CodexStreamEventOutDto } from "../../../../contracts/services/support/platform/codex/index.js";
import type { ExecutorExecutionResultOutDto, ExecutorSessionFactoryPort, ExecutorSessionPort } from "../../../../contracts/services/personas/executor/index.js";

/** 通用执行人应用入口，统一管理所有普通执行人的任务会话和生命周期。 */
export class ExecutorFacade {
  readonly #sessions = new Map<string, ExecutorSessionPort>();

  constructor(private readonly factory: ExecutorSessionFactoryPort) {}

  async open(task: CollaborationTaskOutDto, member: CollaborationMemberOutDto): Promise<ExecutorSessionPort> {
    await this.close(task.taskId);
    const session = await this.factory.createExecutor(task, member);
    this.#sessions.set(task.taskId, session);
    return session;
  }

  /** 令狐等特殊人物借用通用执行能力时创建不进入普通任务缓存的临时会话。 */
  createTransient(task: CollaborationTaskOutDto, member: CollaborationMemberOutDto): Promise<ExecutorSessionPort> {
    return this.factory.createExecutor(task, member);
  }

  session(taskId: string): ExecutorSessionPort | undefined { return this.#sessions.get(taskId); }
  isAlive(taskId: string): boolean { return this.#sessions.get(taskId)?.isAlive() === true; }

  analyze(task: CollaborationTaskOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<string> {
    return this.#require(task.taskId).analyze(task, emit);
  }

  execute(task: CollaborationTaskOutDto, plan: CollaborationRequirementPlanOutDto, emit: (event: CodexStreamEventOutDto) => void): Promise<ExecutorExecutionResultOutDto> {
    return this.#require(task.taskId).execute(task, plan, emit);
  }

  async close(taskId: string): Promise<void> {
    const session = this.#sessions.get(taskId);
    this.#sessions.delete(taskId);
    await session?.dispose();
  }

  async closeAll(): Promise<void> {
    const sessions = [...this.#sessions.values()];
    this.#sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.dispose()));
  }

  #require(taskId: string): ExecutorSessionPort {
    const session = this.#sessions.get(taskId);
    if (!session) throw new Error(`执行人任务会话不存在：${taskId}`);
    return session;
  }
}

export interface ExecutorRuntime { readonly facade: ExecutorFacade; stop(): Promise<void>; }

/** 所有动态成员共用一个 Executor Runtime；成员身份由任务分配时传入。 */
export function createExecutorRuntime(factory: ExecutorSessionFactoryPort): ExecutorRuntime {
  const facade = new ExecutorFacade(factory);
  return { facade, stop: () => facade.closeAll() };
}
