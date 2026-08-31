/** 当前真实人物可以登记的稳定能力；新增人物只登记自己实际实现的能力。 */
export type PersonaCapability = "investigation" | "proposal-authoring" | "deliberation" | "proposal-review" | "acceptance" | "flow-guard" | "unified-test";

/** 每个人物登记稳定身份、生命周期和能力，不登记内部 Store 或 Service。 */
export interface PersonaRegistration {
  readonly memberId: string;
  readonly displayName: string;
  readonly runtime: { start(): void; stop(): void };
  readonly capabilities: readonly PersonaCapability[];
}

/**
 * Workflow 内部人物能力注册表。
 *
 * 业务作用：Workflow 按能力寻找人物，不再在多个文件不断追加 memberId 判断。
 * 同一独占能力出现多个实现时立即阻断，避免随机选择审批人或测试负责人。
 */
export class PersonaCapabilityRegistry {
  readonly #registrations = new Map<string, PersonaRegistration>();

  /** 登记一个人物；重复 memberId 会抛错，防止后注册对象覆盖真实人物。 */
  register(registration: PersonaRegistration): void {
    if (this.#registrations.has(registration.memberId)) throw new Error(`人物 ${registration.memberId} 已经登记。`);
    this.#registrations.set(registration.memberId, registration);
  }

  /** 按人物 ID 读取登记；找不到时返回 null，调用方可给出业务提示。 */
  find(memberId: string): PersonaRegistration | null { return this.#registrations.get(memberId) || null; }

  /** 按独占能力取得人物；没有或出现多个实现都明确失败。 */
  requireCapability(capability: PersonaCapability): PersonaRegistration {
    const candidates = [...this.#registrations.values()].filter((item) => item.capabilities.includes(capability));
    if (candidates.length !== 1) throw new Error(`能力 ${capability} 需要唯一人物，当前登记 ${candidates.length} 个。`);
    return candidates[0];
  }

  /** 启动全部已登记人物；每个人物仍维护自己的生命周期。 */
  startAll(): void { for (const item of this.#registrations.values()) item.runtime.start(); }
  /** 停止全部已登记人物；共同 Evolution 数据不会因此被删除。 */
  stopAll(): void { for (const item of this.#registrations.values()) item.runtime.stop(); }
}
