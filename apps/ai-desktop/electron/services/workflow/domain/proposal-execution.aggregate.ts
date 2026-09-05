// 从 Evolution 契约读取提案事实，领域聚合不直接访问 Evolution Store。
import type { EvolutionProposalOutDto } from "../../../../contracts/services/evolution/index.js";
// 从 Workflow 契约读取协作任务事实，聚合只解释已经持久化的执行关系。
import type { CollaborationTaskOutDto } from "../../../../contracts/services/workflow/index.js";
// 复用单任务聚合的状态语义，避免提案流程再次复制任务状态字符串。
import { CollaborationTaskAggregate } from "./collaboration-task.aggregate.js";

/** 提案执行阶段允许回写 Evolution 的稳定状态集合。 */
export type ProposalExecutionStatus = "executing" | "verifying" | "pending-acceptance" | "blocked";

/** 创建提案执行聚合根时需要的全部权威事实。 */
export interface ProposalExecutionAggregateState {
  /** 当前需要核对执行状态的 Evolution 提案。 */
  proposal: EvolutionProposalOutDto;
  /** Workflow 当前保存的全部任务；聚合会自行筛选本提案关联任务。 */
  collaborationTasks: CollaborationTaskOutDto[];
}

/** 提案执行聚合一次计算得到的完整只读结论。 */
export interface ProposalExecutionView {
  /** 原提案分发时登记的任务标识，顺序与分发计划保持一致。 */
  originalTaskIds: string[];
  /** 每条原任务链当前真正生效的任务，修复任务可以替代失败任务。 */
  effectiveTasks: CollaborationTaskOutDto[];
  /** 没有原任务或有效替代任务的标识；存在时必须阻塞而不能猜测成功。 */
  missingTaskIds: string[];
  /** 是否至少一条当前有效任务处于失败或取消状态。 */
  blocked: boolean;
  /** 是否所有当前有效任务都已经交回南宫婉。 */
  allReturned: boolean;
  /** 是否所有当前有效任务都已经完成集成。 */
  completed: boolean;
  /** 是否至少一条当前有效任务处于验证或集成阶段。 */
  verifying: boolean;
  /** 应回写到 Evolution 提案的下一状态。 */
  nextStatus: ProposalExecutionStatus;
  /** 面向人物和界面的稳定业务说明。 */
  summary: string;
}

/**
 * 提案执行聚合根。
 *
 * 该实体把提案、原任务和令狐修复任务视为一条可恢复执行链；
 * 修复任务成功后会成为当前有效任务，避免应用重启仍只读取失败的原任务。
 */
export class ProposalExecutionAggregate {
  /** 当前提案的冻结快照，用于锁定本轮执行关系。 */
  readonly #proposal: EvolutionProposalOutDto;
  /** 与当前提案有关的任务聚合，包含原任务和明确关联的修复任务。 */
  readonly #tasks: CollaborationTaskAggregate[];

  /** 使用提案和 Workflow 任务快照创建聚合根，不执行持久化或任务分发。 */
  constructor(state: ProposalExecutionAggregateState) {
    // 深拷贝提案，防止状态核对期间 distributedTaskIds 被异步改变。
    this.#proposal = structuredClone(state.proposal);
    // 只接收原分发任务或显式携带相同提案标识的后续修复任务。
    this.#tasks = state.collaborationTasks
      .filter((task) => this.#belongsToProposal(task))
      .map((task) => new CollaborationTaskAggregate({ task }));
  }

  /** 返回完整执行视图，Runtime 只消费结论而不重复组合零散布尔值。 */
  view(): ProposalExecutionView {
    // 原任务标识必须使用提案持久事实，不根据当前任务列表反向补造。
    const originalTaskIds = [...this.#proposal.distributedTaskIds];
    // 每个原任务沿 replacementForTaskId 链寻找最新有效执行任务。
    const effectiveTasks = originalTaskIds
      .map((taskId) => this.#resolveEffectiveTask(taskId))
      .filter((task): task is CollaborationTaskAggregate => task !== null);
    // 没有解析到有效任务的原标识必须作为缺失事实保留。
    const effectiveRootIds = new Set(effectiveTasks.map((task) => this.#rootTaskId(task)));
    // 逐项核对原分发标识，不能用任务数量相等代替身份校验。
    const missingTaskIds = originalTaskIds.filter((taskId) => !effectiveRootIds.has(taskId));
    // 任务记录缺失或者当前有效任务失败都会阻塞提案。
    const blocked = missingTaskIds.length > 0 || effectiveTasks.some((task) => task.blocksProposal());
    // 空任务集合不能被 Array.every 误判为全部交回。
    const allReturned = effectiveTasks.length > 0 && effectiveTasks.every((task) => task.isReturnedToNangong());
    // 空任务集合同样不能被误判为全部完成。
    const completed = effectiveTasks.length > 0 && effectiveTasks.every((task) => task.isIntegrated());
    // 任一有效任务处于验证阶段时，提案应展示真实验证状态。
    const verifying = effectiveTasks.some((task) => task.isVerifying());
    // 使用清晰分支决定唯一提案状态，避免嵌套三元表达式隐藏优先级。
    let nextStatus: ProposalExecutionStatus = "executing";
    // 阻塞优先于所有后续成功或验证状态。
    if (blocked) {
      // 缺失和失败都必须等待恢复事实。
      nextStatus = "blocked";
    } else if (completed) {
      // 所有有效任务集成后才允许韩立验收。
      nextStatus = "pending-acceptance";
    } else if (verifying || allReturned) {
      // 交回、测试和集成过程统一归入验证阶段。
      nextStatus = "verifying";
    }
    // 根据同一执行视图生成状态说明，避免调用方拼装互相矛盾的文案。
    const summary = this.#summary(nextStatus, missingTaskIds);
    // 返回可序列化的稳定视图，供 Runtime 和测试共同消费。
    return {
      // 保留原始分发顺序，方便页面和审计回链。
      originalTaskIds,
      // 返回任务副本，调用方不能修改聚合内部状态。
      effectiveTasks: effectiveTasks.map((task) => task.snapshot()),
      // 返回新的数组，防止调用方改变缺失记录。
      missingTaskIds: [...missingTaskIds],
      // 输出本轮统一计算得到的阻塞结论。
      blocked,
      // 输出本轮统一计算得到的交回结论。
      allReturned,
      // 输出本轮统一计算得到的完成结论。
      completed,
      // 输出本轮统一计算得到的验证结论。
      verifying,
      // 输出唯一下一状态。
      nextStatus,
      // 输出与状态一致的业务说明。
      summary,
    };
  }

  /** 判断一条 Workflow 任务是否属于当前提案的执行链。 */
  #belongsToProposal(task: CollaborationTaskOutDto): boolean {
    // 原始分发任务由 distributedTaskIds 建立权威关系。
    if (this.#proposal.distributedTaskIds.includes(task.taskId)) {
      // 原任务直接属于当前提案。
      return true;
    }
    // 后续修复任务必须显式携带同一提案标识，不能按标题猜测。
    return task.evolutionProposalId === this.#proposal.proposalId;
  }

  /** 从一条原任务开始沿明确替代关系寻找当前有效任务。 */
  #resolveEffectiveTask(originalTaskId: string): CollaborationTaskAggregate | null {
    // 优先查找原任务自身，正常执行链不需要修复替代。
    let current = this.#findTask(originalTaskId);
    // 即使旧原任务记录缺失，也允许显式 replacementForTaskId 修复任务接管。
    let currentTaskId = originalTaskId;
    // 记录已经访问的标识，损坏数据形成环时必须停止而不是死循环。
    const visitedTaskIds = new Set<string>();
    // 一条替代链可能经历多轮修复，因此循环直到没有下一替代任务。
    while (!visitedTaskIds.has(currentTaskId)) {
      // 标记当前节点已经访问。
      visitedTaskIds.add(currentTaskId);
      // 查找所有明确替代当前任务的候选，并选择最后形成的一条事实。
      const replacement = this.#latestReplacementFor(currentTaskId);
      // 没有替代任务时，当前任务就是有效任务。
      if (!replacement) {
        // 原任务也不存在时继续尝试受控旧数据兼容。
        if (!current) {
          // 旧修复任务没有 replacementForTaskId 时只能在唯一未决原任务场景接管。
          return this.#legacyProposalRepair(originalTaskId);
        }
        // 升级前的失败原任务可能已经由同提案令狐修复任务完成，但尚无显式替代字段。
        if (current.blocksProposal()) {
          // 只在唯一原任务且修复已经集成时接受兼容替代。
          const legacyRepair = this.#legacyProposalRepair(originalTaskId);
          // 找到可信旧修复事实时返回修复任务。
          if (legacyRepair) {
            // 旧失败任务不再覆盖已经完成的修复事实。
            return legacyRepair;
          }
        }
        // 返回已经解析到的当前任务。
        return current;
      }
      // 新修复任务成为当前有效任务。
      current = replacement;
      // 下一轮继续检查修复任务是否又被后续修复替代。
      currentTaskId = replacement.taskId();
    }
    // 替代关系形成循环代表持久事实损坏，按缺失处理并阻断提案。
    return null;
  }

  /** 查找指定稳定任务标识对应的任务聚合。 */
  #findTask(taskId: string): CollaborationTaskAggregate | null {
    // 逐项比较稳定标识，禁止使用标题或数组位置代替身份。
    for (const task of this.#tasks) {
      // 标识完全相等时返回该任务。
      if (task.taskId() === taskId) {
        // 返回已冻结的聚合对象。
        return task;
      }
    }
    // 没有持久记录时明确返回 null。
    return null;
  }

  /** 取得明确替代某任务的最新修复任务。 */
  #latestReplacementFor(taskId: string): CollaborationTaskAggregate | null {
    // 收集所有显式指向当前任务的替代事实。
    const replacements = this.#tasks.filter((task) => task.replacementForTaskId() === taskId);
    // 没有候选时当前任务仍然生效。
    if (replacements.length === 0) {
      // 返回空值表示替代链结束。
      return null;
    }
    // 按真实创建时间排序，最后形成的修复事实优先。
    replacements.sort((left, right) => left.snapshot().createdAt.localeCompare(right.snapshot().createdAt));
    // 返回最后一条修复任务。
    return replacements.at(-1) || null;
  }

  /** 为升级前没有显式替代字段的单任务提案恢复一次已集成修复事实。 */
  #legacyProposalRepair(originalTaskId: string): CollaborationTaskAggregate | null {
    // 只有单任务提案能唯一确定旧修复任务替代对象，多任务场景禁止猜测。
    if (this.#proposal.distributedTaskIds.length !== 1) {
      // 多任务提案保持缺失并进入阻塞。
      return null;
    }
    // 当前检查的标识必须就是唯一原任务。
    if (this.#proposal.distributedTaskIds[0] !== originalTaskId) {
      // 不相关标识不能使用兼容逻辑。
      return null;
    }
    // 只接受同提案、令狐自动来源且已经集成的旧修复任务。
    const candidates = this.#tasks.filter((task) => {
      // 读取一次任务副本，保持判断清晰。
      const snapshot = task.snapshot();
      // 普通执行任务不能冒充旧修复结果。
      if (snapshot.automationSource !== "linghu-safeguard") {
        // 继续寻找真正的令狐修复任务。
        return false;
      }
      // 未集成修复不能解除原任务缺失。
      return task.isIntegrated();
    });
    // 没有满足条件的旧修复事实时维持阻塞。
    if (candidates.length === 0) {
      // 返回空值让视图保留 missingTaskIds。
      return null;
    }
    // 选择最后集成形成的修复任务。
    candidates.sort((left, right) => left.snapshot().createdAt.localeCompare(right.snapshot().createdAt));
    // 返回受控兼容结果。
    return candidates.at(-1) || null;
  }

  /** 追溯当前有效任务所属的原始分发任务标识。 */
  #rootTaskId(task: CollaborationTaskAggregate): string {
    // 从当前任务开始向前读取 replacementForTaskId。
    let currentTaskId = task.taskId();
    // 防止损坏替代链循环。
    const visitedTaskIds = new Set<string>();
    // 逐级返回直到命中原提案分发任务。
    while (!visitedTaskIds.has(currentTaskId)) {
      // 记录当前标识已经处理。
      visitedTaskIds.add(currentTaskId);
      // 原分发标识就是本链根节点。
      if (this.#proposal.distributedTaskIds.includes(currentTaskId)) {
        // 返回可核对的原任务标识。
        return currentTaskId;
      }
      // 查找当前任务对象以读取它替代的上游任务。
      const current = this.#findTask(currentTaskId);
      // 旧兼容修复没有替代字段时，只能归到唯一原任务。
      if (!current?.replacementForTaskId() && this.#proposal.distributedTaskIds.length === 1) {
        // 返回唯一原任务标识。
        return this.#proposal.distributedTaskIds[0];
      }
      // 无法继续追溯时返回当前标识，随后会被 missingTaskIds 识别。
      if (!current?.replacementForTaskId()) {
        // 保留未知根标识而不伪造关系。
        return currentTaskId;
      }
      // 移动到明确的上游任务。
      currentTaskId = current.replacementForTaskId()!;
    }
    // 环形数据返回当前标识并由缺失门禁阻断。
    return currentTaskId;
  }

  /** 根据唯一下一状态生成一致的业务摘要。 */
  #summary(status: ProposalExecutionStatus, missingTaskIds: string[]): string {
    // 缺失任务需要保留具体标识供令狐调查。
    if (missingTaskIds.length > 0) {
      // 返回可读且可定位的缺失说明。
      return `关联任务记录缺失：${missingTaskIds.join("、")}。`;
    }
    // 阻塞说明只表达恢复需要，不冒充失败已经解决。
    if (status === "blocked") {
      // 返回稳定阻塞摘要。
      return "至少一个当前有效任务阻塞，等待恢复条件。";
    }
    // 完成集成后明确进入韩立验收，而不是重新分发。
    if (status === "pending-acceptance") {
      // 返回验收等待摘要。
      return "全部当前有效任务已经完成，等待韩立按真实用户路径验收结果。";
    }
    // 验证阶段覆盖交回、测试、集成和重启确认。
    if (status === "verifying") {
      // 返回验证中摘要。
      return "当前有效任务正在执行统一测试、集成或重启验证。";
    }
    // 其他正常非终态均属于执行中。
    return "当前有效任务正在执行。";
  }
}
