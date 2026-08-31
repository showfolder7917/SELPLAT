// 令狐状态事件类型用于约束组合根的持久化、审计和页面广播回调。
import type { LinghuAutomationStateEventOutDto } from "../../../../../contracts/collaboration/linghu/index.js";
// 测试资源协调器作为运行时装配端口传入，Runner 仍由令狐内部创建。
import type { TestResourceCoordinatorFacade } from "../../test-resource-coordinator-facade.js";
// 主进程运行时由唯一 Facade 和唯一 Store 组成，调用方不再分别装配内部文件。
import { LinghuAutomationFacade, type LinghuAutomationFacadeOptions } from "../linghu-automation.facade.js";
import { LinghuAutomationStore } from "./linghu-automation.store.js";
import { LinghuUnifiedTestRunner } from "./linghu-unified-test.runner.js";

/** 令狐内部统一测试执行器所需的稳定运行环境。 */
export interface LinghuUnifiedTestRuntimeOptions {
  // 源工程根用于依赖租约和默认测试目标。
  sourceProjectRoot: string;
  // 应用名用于定位候选工程中的 apps 子目录。
  applicationName: string;
  // 构建根属于稳定工作区，不写入候选工作树。
  buildRoot: string;
  // 资源协调器串行管理 Electron、端口和构建目录。
  testResources: TestResourceCoordinatorFacade;
  // 测试通过后的应用重启动作仍由 Electron 组合根执行。
  onVerified(executable: string): void | Promise<void>;
}

/** 创建令狐运行时需要的外部能力；内部 Store 和 Runner 不允许由调用方传入。 */
export interface CreateLinghuRuntimeOptions extends Omit<LinghuAutomationFacadeOptions, "store" | "runUnifiedTestAndRestart"> {
  // 状态文件必须由应用路径解析器生成，令狐模块不猜测工程根或用户目录。
  stateFilePath: string;
  // 统一测试环境只提供构造数据，具体 Runner 由令狐运行时创建并隐藏。
  unifiedTest: LinghuUnifiedTestRuntimeOptions;
  // 每次原子提交后通知事件中心、数据库投影和 Renderer。
  onStateChanged(event: LinghuAutomationStateEventOutDto): void;
}

/** 令狐运行时只公开业务 Facade 和必要的生命周期能力，不泄露 Store 或 Runner。 */
export interface LinghuRuntime {
  // `facade` 是检测、恢复、文案和启停操作的唯一外部入口。
  facade: LinghuAutomationFacade;
  // 版本集成通过运行时执行候选统一测试，调用方看不到具体 Runner。
  runUnifiedTests(candidateProjectRoot?: string): Promise<string>;
  // 清空测试数据是受控生命周期能力，不返回 Store。
  clearTestData(): number;
  // 清空后断言由内部 Store 执行，外部只接收成功或异常。
  assertTestDataCleared(): void;
}

/**
 * 在令狐模块内部完成 Store、Facade 和状态订阅装配。
 *
 * 真实传参示例：传入 `collaborationRoot/linghu-automation.json`、Coordinator、测试环境和事件回调。
 * 真实返回示例：`{ facade, runUnifiedTests, clearTestData, assertTestDataCleared }`。
 * 异常或副作用示例：构造 Store 会读取或创建状态文件；状态提交会调用 `onStateChanged`。
 */
export function createLinghuRuntime(options: CreateLinghuRuntimeOptions): LinghuRuntime {
  // Store 独占令狐状态文件，避免 main.ts 与其他服务自行读写 JSON。
  const store = new LinghuAutomationStore(options.stateFilePath);
  // Runner 在令狐边界内创建，main 和其他业务模块不能直接实例化或配置其内部脚本。
  const unifiedTests = new LinghuUnifiedTestRunner(
    options.unifiedTest.sourceProjectRoot,
    options.unifiedTest.applicationName,
    options.unifiedTest.buildRoot,
    options.recordEvent,
    options.unifiedTest.testResources,
  );
  // Facade 接收 Store 和所有外部端口，内部仍保持唯一自动保障入口。
  const facade = new LinghuAutomationFacade({
    store,
    collaboration: options.collaboration,
    readWorkspaceState: options.readWorkspaceState,
    locale: options.locale,
    recordEvent: options.recordEvent,
    readTestResourceState: options.readTestResourceState,
    runUnifiedTestAndRestart: async (onVerified) => {
      // 只有固定统一测试全部通过后才更新令狐报告并通知组合根执行重启。
      const executable = await unifiedTests.run();
      onVerified();
      await options.unifiedTest.onVerified(executable);
    },
    submitRepairProposal: options.submitRepairProposal,
    readEvolutionState: options.readEvolutionState,
    reviseReturnedProposal: options.reviseReturnedProposal,
  });
  // 所有状态变化通过一个订阅出口返回组合根，避免调用方在多个位置重复监听。
  // 订阅与 Electron 主进程同生命周期，退出时由进程统一释放，不建立无调用方的局部销毁入口。
  facade.subscribe(options.onStateChanged);
  // 返回受控能力闭包；Store 与 Runner 对象不会越过令狐模块边界。
  return {
    facade,
    runUnifiedTests: (candidateProjectRoot) => unifiedTests.run(candidateProjectRoot),
    clearTestData: () => store.clearTestData(),
    assertTestDataCleared: () => store.assertTestDataCleared(),
  };
}
