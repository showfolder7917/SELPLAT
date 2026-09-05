/** 当前真实人物可以登记的稳定能力；新增人物只登记自己实际实现的能力。 */
export type PersonaCapability =
  // 调查代码、数据和运行事实。
  | "investigation"
  // 根据调查事实编写提案。
  | "proposal-authoring"
  // 参与人物内部研讨。
  | "deliberation"
  // 审核实施提案。
  | "proposal-review"
  // 按真实用户路径验收结果。
  | "acceptance"
  // 监督流程并守住恢复边界。
  | "flow-guard"
  // 执行统一测试和失败复查。
  | "unified-test";

/** 单个人物向 Workflow 登记的稳定身份、生命周期和能力。 */
export interface PersonaRegistration {
  /** 人物稳定标识，持久化和事件关联都使用该值。 */
  readonly memberId: string;
  /** 人物面向用户显示的名称。 */
  readonly displayName: string;
  /** 人物自身运行时生命周期；Registry 不读取其内部 Store。 */
  readonly runtime: { start(): void; stop(): void };
  /** 人物已经真实实现的能力集合。 */
  readonly capabilities: readonly PersonaCapability[];
}

/**
 * Workflow 人物能力领域注册表。
 *
 * Workflow 按能力寻找人物，不在多个服务中反复判断固定 memberId；
 * 同一独占能力出现多个实现时立即阻断，避免随机选择审批人或测试负责人。
 */
export class PersonaCapabilityRegistry {
  /** 按稳定人物标识保存登记事实，重复标识不得覆盖。 */
  readonly #registrations = new Map<string, PersonaRegistration>();

  /** 登记一个人物及其真实能力。 */
  register(registration: PersonaRegistration): void {
    // 重复人物标识会破坏生命周期和能力唯一性。
    if (this.#registrations.has(registration.memberId)) {
      // 明确抛错而不是覆盖先前人物。
      throw new Error(`人物 ${registration.memberId} 已经登记。`);
    }
    // 保存人物登记事实。
    this.#registrations.set(registration.memberId, registration);
  }

  /** 按稳定人物标识读取登记；不存在时返回 null。 */
  find(memberId: string): PersonaRegistration | null {
    // Map 返回 undefined 时转换为公开空值 null。
    return this.#registrations.get(memberId) || null;
  }

  /** 按独占能力取得唯一人物。 */
  requireCapability(capability: PersonaCapability): PersonaRegistration {
    // 收集所有明确登记该能力的人物。
    const candidates = [...this.#registrations.values()].filter((item) => item.capabilities.includes(capability));
    // 独占能力缺失或重复都会使流程所有者不确定。
    if (candidates.length !== 1) {
      // 报告真实候选数量，禁止随机选择。
      throw new Error(`能力 ${capability} 需要唯一人物，当前登记 ${candidates.length} 个。`);
    }
    // 返回唯一登记人物。
    return candidates[0];
  }

  /** 启动全部已登记人物运行时。 */
  startAll(): void {
    // 按登记顺序启动，人物仍维护各自内部状态。
    for (const registration of this.#registrations.values()) {
      // 调用人物公开生命周期入口。
      registration.runtime.start();
    }
  }

  /** 停止全部已登记人物运行时。 */
  stopAll(): void {
    // 停止人物不会删除共同 Evolution 或 Workflow 数据。
    for (const registration of this.#registrations.values()) {
      // 调用人物公开停止入口。
      registration.runtime.stop();
    }
  }
}
