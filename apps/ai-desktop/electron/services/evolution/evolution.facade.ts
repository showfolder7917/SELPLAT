// Evolution 门面文件集中提供共同业务数据的装配入口，不把 Repository 或 Store 实现公开给人物和 IPC。
import type { DatabasePort } from "../support/platform/persistence/index.js";
import type { CreateLinghuRepairProposalOutDto } from "../../../contracts/collaboration/linghu/index.js";
import type { EvolutionTopicDossier, EvolutionWorkbenchPage, EvolutionWorkbenchPreference, EvolutionStateOutDto, QueryEvolutionWorkbenchRequest, SaveEvolutionWorkbenchPreferenceRequest } from "../../../contracts/collaboration/evolution/index.js";
import type { CreateNangongTopicInDto } from "../../../contracts/collaboration/nangong/index.js";
import { EvolutionMutationCoordinator } from "./internal/evolution-mutation.coordinator.js";
import { EvolutionStateRepository } from "./internal/evolution-state.repository.js";
import { EvolutionStateStore } from "./internal/evolution-state.store.js";

// Evolution Port 保留人物 Facade 实际使用的状态读写方法，底层 SQLite 与缓存策略仍属于 internal。
export type EvolutionStatePort = EvolutionStateStore;
// 变更协调端口负责同一专题的互斥和幂等，人物模块不接触锁的保存细节。
export type EvolutionMutationPort = EvolutionMutationCoordinator;

// 组合根创建唯一 Evolution 状态所有者；数据库不可用时 Repository 保持原安全降级语义。
export function createEvolutionState(database: DatabasePort | null): EvolutionStatePort {
  return new EvolutionStateStore(new EvolutionStateRepository(database));
}

// 南宫人物入口通过该工厂取得协调器，避免跨模块直接构造 internal 类。
export function createEvolutionMutationCoordinator(
  ...arguments_: ConstructorParameters<typeof EvolutionMutationCoordinator>
): EvolutionMutationPort {
  return new EvolutionMutationCoordinator(...arguments_);
}

// 工作台增量是 Evolution 对 Renderer 的稳定事实，不包含数据库连接或 Store 引用。
export { buildEvolutionWorkbenchChange } from "./internal/evolution-workbench-change.assembler.js";

/** Evolution Facade 使用的最小应用端口，只包含共同状态和共享工作台能力。 */
export interface EvolutionApplicationPort {
  state(): EvolutionStateOutDto;
  dossier(topicId: string): EvolutionTopicDossier;
  queryWorkbench(request: QueryEvolutionWorkbenchRequest): EvolutionWorkbenchPage;
  getWorkbenchPreference(perspective: "nangong" | "hanli", nodeId: string): EvolutionWorkbenchPreference | null;
  saveWorkbenchPreference(request: SaveEvolutionWorkbenchPreferenceRequest): EvolutionWorkbenchPreference;
  createTopic(request: CreateNangongTopicInDto): EvolutionStateOutDto;
  createLinghuRepairProposal(request: CreateLinghuRepairProposalOutDto): EvolutionStateOutDto;
  subscribe(listener: Parameters<EvolutionStatePort["subscribe"]>[0]): () => void;
}

/** Evolution 唯一公开门面；它不判断某个人物下一步应该做什么。 */
export class EvolutionFacade {
  readonly #application: EvolutionApplicationPort;
  /** 注入共同状态端口；构造过程不会创建第二份 Store。 */
  constructor(application: EvolutionApplicationPort) { this.#application = application; }
  /** 返回共同状态副本，调用方不能绕过 Store 修改内部对象。 */
  state() { return this.#application.state(); }
  /** 返回指定专题的共同档案，其中可以包含多个人物留下的事实。 */
  dossier(topicId: string) { return this.#application.dossier(topicId); }
  /** 查询共享工作台分页结果；查询不会改变人物状态。 */
  queryWorkbench(request: QueryEvolutionWorkbenchRequest) { return this.#application.queryWorkbench(request); }
  /** 读取人物视角的界面偏好；偏好不等同人物业务判断。 */
  getWorkbenchPreference(perspective: "nangong" | "hanli", nodeId: string) { return this.#application.getWorkbenchPreference(perspective, nodeId); }
  /** 保存共享工作台显示偏好，并返回数据库确认后的记录。 */
  saveWorkbenchPreference(request: SaveEvolutionWorkbenchPreferenceRequest) { return this.#application.saveWorkbenchPreference(request); }
  /** 创建共同专题；来源人物由请求事实记录，不改变状态所有权。 */
  createTopic(request: CreateNangongTopicInDto) { return this.#application.createTopic(request); }
  /** 接收令狐修正提案；令狐不能直接调用南宫或韩立内部服务。 */
  createLinghuRepairProposal(request: CreateLinghuRepairProposalOutDto) { return this.#application.createLinghuRepairProposal(request); }
  /** 订阅共同状态原子提交；返回函数用于取消订阅。 */
  subscribe(listener: Parameters<EvolutionStatePort["subscribe"]>[0]) { return this.#application.subscribe(listener); }
}

/** Evolution Runtime 只公开 Facade；共同 Store 仍由更早创建的唯一应用端口持有。 */
export interface EvolutionRuntime { readonly facade: EvolutionFacade; }
/** 创建共享 Evolution Runtime，不复制或迁移当前状态。 */
export function createEvolutionRuntime(application: EvolutionApplicationPort): EvolutionRuntime {
  return { facade: new EvolutionFacade(application) };
}
