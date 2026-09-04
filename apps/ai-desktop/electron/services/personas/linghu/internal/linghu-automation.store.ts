// UUID 只用于新建启动文案，避免标题重复时发生覆盖。
// 人物状态只依赖 Platform 提供的持久化 Port，不读取路径或调用 Node 文件系统。
import type { AtomicJsonPersistencePort } from "../../../support/platform/persistence/index.js";

// Store 只读取令狐协议类型，具体状态变化仍由本目录的业务实现负责。
import type {
  LinghuAutomationModuleValue,
  LinghuAutomationStateEventOutDto,
  LinghuAutomationStateOutDto,
} from "../../../../../contracts/services/personas/linghu/index.js";

// 监听器只接收提交后的完整快照，不能在回调中修改 Store 内部状态。
type StateListener = (event: LinghuAutomationStateEventOutDto) => void;

// 三个模块的稳定顺序同时被 Facade 和只读分析模块使用。
export const LINGHU_AUTOMATION_MODULES: readonly LinghuAutomationModuleValue[] = [
  "flow-completion",
  "test-coverage",
  "audit-completeness",
];

export const LINGHU_SAFEGUARD_INSTRUCTIONS = `你是令狐老祖，是保障所有人物完成最后流程的最后一道屏障。只要自动执行开关保持开启，检测永远不能停止。

一级最高职责是逐项检查所有人物已经开始但尚未完成的任务，推动其完成审核、执行、集成、统一测试和最终完成。发现流程停住、异常状态、代码错误、测试失败或重启丢失时，必须找出原因，拆分最小修正任务并恢复原流程。明确需要人工业务选择时可以等待处理，但仍要持续检测并保留恢复点，不能关闭自动检测。

第二职责是检查测试漏点。结合任务改动、失败证据和相邻功能判断主路径、边界路径、异常路径与并发路径是否缺少验证；缺失时先补最小回归测试，再执行修正和复测。持续升级自身测试能力，优化排队等待、重复构建和资源占用，但不得牺牲隔离性、审计性或可靠性。

第三职责是检查日志审计完整性。每项关键动作必须能够关联任务、人物、测试批次、进程、端口、构建目录、排队、占用、冲突、释放、超时和最终结果；发现只有错误文字而缺少结构化事实时，必须补齐审计入口和关联字段。

仅执行以上三项职责，暂不进行页面演化评分、主动页面改版或无关架构优化。所有测试资源必须通过单一跨进程 Facade 申请，禁止调用方直接竞争 Playwright、Electron、端口或构建目录。

每个模块结束后输出：循环编号、模块、问题证据、执行任务、执行者、测试结果、审计完整性、资源等待与执行性能、阻塞和下一步建议。`;

/** 原子持久化令狐老祖自动保障开关、循环恢复点。 */
export class LinghuAutomationStore {
  // 持久化 Port 由组合根注入，Store 不知道文件路径、临时文件或备份命名。
  readonly #persistence: AtomicJsonPersistencePort;
  // Set 防止同一监听函数重复登记，并支持精确取消订阅。
  readonly #listeners = new Set<StateListener>();
  // 内存状态只在原子提交成功后替换。
  #state: LinghuAutomationStateOutDto;

  /** 读取已有状态或创建安全关闭的初始状态。 */
  constructor(persistence: AtomicJsonPersistencePort) {
    // 保存受控端口，后续业务提交只能读写 JSON 值。
    this.#persistence = persistence;
    // 从主文件或有效备份恢复当前运行状态。
    this.#state = this.#load();
  }

  /** 返回深复制快照；调用方修改返回值不会污染 Store。 */
  state(): LinghuAutomationStateOutDto {
    // structuredClone 保留嵌套数组和对象的独立性。
    return structuredClone(this.#state);
  }

  /** 订阅状态提交，并返回精确取消函数。 */
  subscribe(listener: StateListener): () => void {
    // 新监听器从下一次提交开始接收事件，不补发可能过期的历史事件。
    this.#listeners.add(listener);
    // 取消函数只删除本次传入的监听器。
    return () => this.#listeners.delete(listener);
  }

  /** 根据用户操作启停自动保障。 */
  setEnabled(enabled: boolean): LinghuAutomationStateOutDto {
    // 开关和阻塞说明在同一次原子提交内更新，避免页面看到矛盾状态。
    return this.#commit(enabled ? "automation.enabled" : "automation.disabled", (state) => {
      state.enabled = enabled;
      state.blockingReason = enabled ? null : "自动巡检已关闭";
      state.nextCheckAt = null;
    });
  }

  updateRuntime(reason: string, update: (state: LinghuAutomationStateOutDto) => void): LinghuAutomationStateOutDto {
    // Facade 的运行状态变化统一复用同一个原子提交管道。
    return this.#commit(reason, update);
  }

  /** 清除令狐运行、恢复和检测历史，保留轮询间隔并安全关闭自动执行；返回被移除的历史项数量。 */
  clearTestData(): number {
    // 清理数量用于测试数据重置结果展示，不包含保留的用户文案。
    const clearedCount = this.#state.flowSnapshots.length + Object.keys(this.#state.recoveryAttemptsByFingerprint).length + (this.#state.lastModuleReport ? 1 : 0);
    // 从安全关闭的初始状态开始，避免遗漏新增加的运行字段。
    const next = createInitialState();
    // 用户设置的间隔和文案不是测试运行数据，必须保留。
    next.pollIntervalMs = this.#state.pollIntervalMs;
    // 先完成磁盘原子写，再替换内存快照并通知监听器。
    this.#write(next);
    this.#state = next;
    const event = { state: this.state(), reason: "test-data.cleared" };
    for (const listener of this.#listeners) listener(event);
    return clearedCount;
  }

  /** 确认令狐自动保障不再持有测试任务、故障指纹或运行快照。 */
  assertTestDataCleared(): void {
    // 同时读取磁盘与内存，防止只清理一侧后错误地安排重启。
    const persisted = validateState(this.#persistence.read());
    if (!persisted) throw new Error("测试数据清空后无法读取令狐自动保障状态，已阻止按成功结果重启。");
    const states = [this.#state, persisted];
    if (states.some((state) => state.activeTaskId !== null
      || state.flowSnapshots.length > 0
      || Object.keys(state.recoveryAttemptsByFingerprint).length > 0
      || state.lastModuleReport !== null)) {
      throw new Error("测试数据清空后仍检测到令狐自动保障运行记录，已阻止按成功结果重启。");
    }
  }

  #commit(reason: string, update: (state: LinghuAutomationStateOutDto) => void): LinghuAutomationStateOutDto {
    // 每次提交先深复制旧状态，更新函数抛错时旧状态保持不变。
    const next = structuredClone(this.#state);
    // 业务更新只能操作草稿，不直接接触当前内存状态。
    update(next);
    // Store 统一刷新更新时间，调用方无需重复维护。
    next.updatedAt = new Date().toISOString();
    // 磁盘成功后才发布新内存状态，避免页面看到未持久化结果。
    this.#write(next);
    this.#state = next;
    const event = { state: this.state(), reason };
    for (const listener of this.#listeners) listener(event);
    return event.state;
  }

  #load(): LinghuAutomationStateOutDto {
    // 记住主文件是否存在，用于区分首次启动和损坏恢复。
    const primaryExisted = this.#persistence.primaryExists();
    // 主文件失败时按顺序尝试 Platform 返回的最近备份。
    for (const candidate of [this.#persistence.read(), this.#persistence.readBackup()]) {
      const value = validateState(candidate);
      if (value) {
        // 写回严格使用当前字段，不携带已退役配置。
        this.#write(value);
        return value;
      }
    }
    // 两份文件都无效时构造完整初始状态。
    const state = createInitialState();
    if (primaryExisted) {
      // 自动状态无法证明用户最后一次选择时必须安全关闭，禁止因损坏自行恢复为开启。
      state.enabled = false;
      state.blockingReason = "自动状态损坏，已安全关闭；请由用户重新开启";
    }
    this.#write(state);
    return state;
  }

  #write(state: LinghuAutomationStateOutDto): void {
    // 原子替换和备份属于 Platform 职责，人物 Store 只提交完整业务状态。
    this.#persistence.write(state);
  }
}

function createInitialState(): LinghuAutomationStateOutDto {
  // 所有初始时间使用同一值，避免刚创建就出现前后顺序差异。
  const now = new Date().toISOString();
  // 初始状态安全关闭，等待用户通过唯一开关授权自动执行。
  return {
    version: 2,
    enabled: false,
    pollIntervalMs: 60_000,
    checking: false,
    nextCheckAt: null,
    displayConversationStartedAt: null,
    cycle: 1,
    currentModule: "flow-completion",
    activeTaskId: null,
    recoveryAttemptCount: 0,
    currentFaultFingerprint: null,
    recoveryAttemptsByFingerprint: {},
    detectionCursor: null,
    flowSnapshots: [],
    testResourceState: null,
    recoveryCheckpoint: null,
    lastDispatchAt: null,
    lastCompletedAt: null,
    lastCheckedAt: null,
    blockingReason: "自动巡检已关闭",
    lastFeedback: null,
    lastModuleReport: null,
    updatedAt: now,
  };
}

function validateState(candidate: unknown): LinghuAutomationStateOutDto | null {
  // Platform 只负责 JSON 读取；人物 Store 仍负责判断内容是否为当前令狐运行状态。
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as LinghuAutomationStateOutDto;
  if (value.version !== 2 || !Array.isArray(value.flowSnapshots)) return null;
  // 只投影当前运行字段，废弃的文案、选中项永远不读、不回写。
  const initial = createInitialState();
  const restored = Object.fromEntries(Object.keys(initial).map((key) => [key, value[key as keyof typeof value] ?? initial[key as keyof typeof initial]])) as unknown as LinghuAutomationStateOutDto;
  // 进程重启后立即重新检查，旧进程的计时与执行标记不能继承。
  return { ...restored, pollIntervalMs: 60_000, checking: false, nextCheckAt: null };
}
