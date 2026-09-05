// 从 Workflow 公开契约读取任务和人物快照，领域层不依赖具体 JSON Store。
import type {
  CollaborationMemberOutDto,
  CollaborationTaskOutDto,
} from "../../../../contracts/services/workflow/index.js";

/** 创建协作任务聚合根时需要冻结的权威业务事实。 */
export interface CollaborationTaskAggregateState {
  /** 当前单个协作任务的持久快照；聚合根不会直接写入磁盘。 */
  task: CollaborationTaskOutDto;
}

/**
 * 单个协作任务聚合根。
 *
 * 该实体统一解释任务是否阻塞、是否验证、是否完成以及是否仍有真实执行人；
 * Store 只保存聚合结果，Runtime 和页面不再各自维护一套状态数组判断。
 */
export class CollaborationTaskAggregate {
  /** 构造时冻结的任务快照，防止一次流程判断期间被异步写动作改变。 */
  readonly #task: CollaborationTaskOutDto;

  /** 使用一份持久任务快照创建聚合根，不在构造阶段产生任何副作用。 */
  constructor(state: CollaborationTaskAggregateState) {
    // 深拷贝任务，保证领域判断始终针对同一个版本的事实。
    this.#task = structuredClone(state.task);
  }

  /** 返回任务稳定标识，供提案聚合建立原任务与修复任务关系。 */
  taskId(): string {
    // 标识直接来自持久任务，不根据标题或时间推断。
    return this.#task.taskId;
  }

  /** 返回任务完整副本，应用服务可据此发布事件但不能修改聚合内部状态。 */
  snapshot(): CollaborationTaskOutDto {
    // 返回深拷贝，禁止调用方绕过聚合判断修改嵌套执行记录。
    return structuredClone(this.#task);
  }

  /** 返回本任务明确替代的原任务；普通任务和旧数据返回 null。 */
  replacementForTaskId(): string | null {
    // 兼容旧持久数据中尚不存在替代字段的情况。
    return this.#task.replacementForTaskId || null;
  }

  /** 判断任务是否会阻止提案继续进入验收。 */
  blocksProposal(): boolean {
    // 阻塞、取消和统一测试失败都代表当前有效执行链尚未完成。
    return ["blocked", "cancelled", "test-failed"].includes(this.#task.state);
  }

  /** 判断执行人是否已经把结果交回南宫婉等待集成。 */
  isReturnedToNangong(): boolean {
    // 只有权威任务状态可以结束执行阶段，不能读取页面文字推断。
    return this.#task.state === "returned-to-nangong";
  }

  /** 判断任务是否已经完成统一测试、集成和发布候选确认。 */
  isIntegrated(): boolean {
    // integrated 是协作任务唯一成功终态。
    return this.#task.state === "integrated";
  }

  /** 判断任务是否处于交回之后、最终集成之前的验证阶段。 */
  isVerifying(): boolean {
    // 验证阶段集合由 Workflow 领域统一维护，调用方不再复制字符串数组。
    return [
      "returned-to-nangong",
      "ready-for-integration",
      "queued-integration",
      "integrating",
      "unified-testing",
      "awaiting-restart",
    ].includes(this.#task.state);
  }

  /** 判断当前状态是否允许客户或恢复服务发起继续动作。 */
  canRequestRecovery(): boolean {
    // 只有明确恢复态、阻塞态或测试失败态允许继续，历史节点不得重复推进。
    return ["recovering", "blocked", "test-failed"].includes(this.#task.state);
  }

  /** 判断任务是否仍由一名处于工作态的人物真实占用。 */
  hasLiveOwner(members: CollaborationMemberOutDto[]): boolean {
    // 人物必须明确持有当前任务，单独的历史时间线节点不能表示仍在工作。
    for (const member of members) {
      // 其他任务的占用事实与当前聚合无关。
      if (member.currentTaskId !== this.#task.taskId) {
        // 继续检查下一名人物。
        continue;
      }
      // 空闲和离线人物不构成真实执行占用。
      if (member.state === "idle" || member.state === "offline") {
        // 找到旧引用后仍继续检查，兼容迁移数据中的重复成员记录。
        continue;
      }
      // 找到一名真实工作人物即可确认当前任务仍有活动所有者。
      return true;
    }
    // 没有任何工作人物持有任务时返回 false。
    return false;
  }
}
