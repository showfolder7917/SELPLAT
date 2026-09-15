// 子进程 API 执行固定 npm 脚本；不接受启动文案或页面传入的动态命令。
import { spawn } from "node:child_process";
// path 统一解析源工程、候选工作树和应用目录，兼容 Windows 与 macOS。
import path from "node:path";
// 依赖租约让候选工作树安全借用源工程锁哈希缓存，并在结束后释放。
import {
  acquireManagedDependencyLease,
  releaseManagedDependencyLease,
  resolveVerifiedDeveloperExecutable,
  verifyAcceptancePlanCapabilities,
} from "../../release/index.js";
// 测试资源协调器串行管理 Electron、端口和构建目录，避免并行任务互相破坏。
import { TestResourceCoordinatorFacade } from "../test-resource-coordinator.facade.js";
import type { ManagedExecutionVerificationEvidenceOutDto } from "../../../../../../contracts/services/support/platform/codex/index.js";
// 只有经过验证的 Developer 可执行文件才能进入重启与发布流程。

// 固定清单阻止令狐文案扩大测试范围或注入任意 shell 命令。
// 全量测试先于交互和发布；单个领域测试不能替代全部测试收集器。
const FIXED_VALIDATION_SCRIPTS = ["test", "test:interaction", "test:collaboration", "test:managed"] as const;
// 发布链存在产物依赖，只有全部独立验证通过后才允许依次打包、核对内容并验证可执行版本。
const FIXED_RELEASE_SCRIPTS = ["package:mac:developer", "verify:package-content", "verify:mac:developer"] as const;
// 仅接受开发包预检写出的固定记录，避免把任意命令中的 ENOSPC 文本误判为等待授权。
const DEVELOPER_PACKAGE_CAPACITY_BLOCKED_MARKER = "AI_DESKTOP_PACKAGE_CAPACITY_BLOCKED:";
const UNIFIED_TEST_CAPACITY_BLOCKED_ERROR_CODE = "unified-test-capacity-blocked";

type DeveloperPackageCapacity = {
  fileBytes: number;
  directoryBytes: number;
  headroomBytes: number;
  requiredBytes: number;
  availableBytes: number;
};

/** 表示候选测试已经执行，但宿主测试编排器无法读取统一工作区中的发布产物。 */
export class UnifiedTestInfrastructureError extends Error {
  // 用户选择的稳定工作区用于解释构建产物本应从哪里读取。
  readonly selectedWorkspaceRoot: string;
  // 构建根用于定位缺失或不可读的候选包。
  readonly buildRoot: string;

  /** 包装候选包读取异常，同时保留原始路径证据。 */
  constructor(selectedWorkspaceRoot: string, buildRoot: string, cause: unknown) {
    // Error 使用真实 message，未知抛出值转换为字符串保存。
    const detail = cause instanceof Error ? cause.message : String(cause);
    // 父类消息供统一失败记录和页面展示。
    super(`统一测试基础设施无法读取所选工作区产物：${detail}`);
    // 自定义名称让调用方能与普通测试断言失败区分。
    this.name = "UnifiedTestInfrastructureError";
    // 两个路径只用于错误诊断，不参与新的路径解析。
    this.selectedWorkspaceRoot = selectedWorkspaceRoot;
    this.buildRoot = buildRoot;
  }
}

/** 表示容量预检已在构建前安全停止，必须由具有保留策略权限的人员处理空间后再验证。 */
export class UnifiedTestCapacityBlockedError extends Error {
  readonly code = UNIFIED_TEST_CAPACITY_BLOCKED_ERROR_CODE;
  readonly script: string;
  readonly capacity: DeveloperPackageCapacity;

  constructor(script: string, capacity: DeveloperPackageCapacity) {
    const shortfallBytes = capacity.requiredBytes - capacity.availableBytes;
    super(`${script} 等待容量授权：候选卷还缺少 ${shortfallBytes} 字节可用空间。`);
    this.name = "UnifiedTestCapacityBlockedError";
    this.script = script;
    this.capacity = capacity;
  }
}

export interface UnifiedTestScriptFailure {
  script: string;
  detail: string;
}

/** 一轮统一测试收齐全部独立验证失败，令狐据此一次调查共同根因。 */
export class UnifiedTestAggregateError extends Error {
  readonly failures: UnifiedTestScriptFailure[];

  constructor(failures: UnifiedTestScriptFailure[]) {
    const evidence = failures.map((failure, index) => [
      `未通过项 ${index + 1}：npm run ${failure.script}`,
      failure.detail,
    ].join("\n")).join("\n\n");
    super(`统一测试一次发现 ${failures.length} 个未通过项：\n${evidence}`);
    this.name = "UnifiedTestAggregateError";
    this.failures = failures.map((failure) => ({ ...failure }));
  }
}

/** 候选工作树可能经不同模块实例回传异常；仅接受本错误码和完整容量结构，不能退回宽泛 ENOSPC 文本匹配。 */
export function isUnifiedTestCapacityBlockedError(error: unknown): error is UnifiedTestCapacityBlockedError {
  if (error instanceof UnifiedTestCapacityBlockedError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as Partial<UnifiedTestCapacityBlockedError>;
  return candidate.name === "UnifiedTestCapacityBlockedError"
    && candidate.code === UNIFIED_TEST_CAPACITY_BLOCKED_ERROR_CODE
    && typeof candidate.script === "string"
    && isDeveloperPackageCapacity(candidate.capacity);
}

/** 测试漏点模块只通过固定 npm 脚本执行正式构建与统一回归，禁止把动态命令交给自动执行文案。 */
export interface FixedUnifiedTestRunnerOptions {
  sourceProjectRoot: string;
  applicationName: string;
  buildRoot: string;
  recordEvent(type: string, details: Record<string, unknown>): void;
  testResources: TestResourceCoordinatorFacade;
  initiatorMemberId: string;
  eventNamespace: string;
}

/** 固定统一测试完成后交给集成流水线的受控产物与逐脚本验证事实。 */
export interface FixedUnifiedTestRunResult {
  executable: string;
  verificationEvidence: ManagedExecutionVerificationEvidenceOutDto[];
}

export class FixedUnifiedTestRunner {
  // 源工程根是稳定依赖、构建数据和发布元数据的权威来源。
  readonly #sourceProjectRoot: string;
  // 应用名用于在任意候选工作树下定位 apps/<applicationName>。
  readonly #applicationName: string;
  // 事件回调记录每个脚本的开始、完成、失败和基础设施错误。
  readonly #recordEvent: (type: string, details: Record<string, unknown>) => void;
  // 资源协调器保证同一时刻只有一个正式测试或打包任务占用共享资源。
  readonly #testResources: TestResourceCoordinatorFacade;
  // 构建根始终属于用户选择的稳定工作区，不落入临时候选树。
  readonly #buildRoot: string;
  // 发起人物和事件命名空间由业务组合根注入，公共能力不写死具体人物。
  readonly #initiatorMemberId: string;
  readonly #eventNamespace: string;

  /** 保存经过组合根解析的工程信息和外部端口。 */
  constructor(options: FixedUnifiedTestRunnerOptions) {
    // resolve 消除相对片段，后续比较和子进程 cwd 使用稳定绝对路径。
    this.#sourceProjectRoot = path.resolve(options.sourceProjectRoot);
    this.#applicationName = options.applicationName;
    this.#buildRoot = path.resolve(options.buildRoot);
    this.#recordEvent = options.recordEvent;
    this.#testResources = options.testResources;
    this.#initiatorMemberId = options.initiatorMemberId;
    this.#eventNamespace = options.eventNamespace;
  }

  async run(candidateProjectRoot = this.#sourceProjectRoot): Promise<FixedUnifiedTestRunResult> {
    // 没有候选参数时测试源工程；集成流程可以传入独立候选工作树。
    const resolvedProjectRoot = path.resolve(candidateProjectRoot);
    // 应用根由候选工程根和登记应用名组成，禁止固定机器路径。
    const desktopRoot = path.join(resolvedProjectRoot, "apps", this.#applicationName);
    // 候选工作树只提供待测源码；缓存、测试协调、构建、打包和最终验收始终共用用户选择工作区的数据根。
    const buildRoot = this.#buildRoot;
    // 验收能力缺失时不应申请依赖或测试资源，避免无效候选占用共享环境后才被拒绝。
    verifyAcceptancePlanCapabilities(resolvedProjectRoot);
    // 运行 ID 关联资源占用、事件和测试证据。
    const runId = `${this.#eventNamespace}-unified-${Date.now()}`;
    // 源工程直接使用自身依赖；候选树必须先申请受管租约。
    const dependencyLease = resolvedProjectRoot === this.#sourceProjectRoot
      ? null
      : await acquireManagedDependencyLease(resolvedProjectRoot, this.#sourceProjectRoot, this.#applicationName, runId);
    // 子进程环境从当前进程复制，再覆盖受管测试边界字段。
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...dependencyLease?.environment,
      // 候选 worktree 的依赖链接已由外层按锁文件核验；内层所有 npm 脚本只能借用，不能再次迁移或接管。
      AI_DESKTOP_TEST_TASK_ID: runId,
      // 候选包最终会提升并脱离临时 worktree，开发版元数据必须指回持续存在的源工程和归档日志根。
      SELPLAT_ROOT: this.#sourceProjectRoot,
      // 禁止 Git 弹出交互式凭据窗口卡住自动测试。
      GIT_TERMINAL_PROMPT: "0",
    };
    // Electron/VS Code 调试变量可能把 Electron 变成 Node 或附加调试器，正式测试必须移除。
    delete environment.ELECTRON_RUN_AS_NODE;
    delete environment.NODE_OPTIONS;
    delete environment.NODE_INSPECT_RESUME_ON_START;
    delete environment.VSCODE_INSPECTOR_OPTIONS;
    // 所有固定脚本在一次资源租约内串行执行，避免中途被其他任务抢占端口或 build。
    return this.#testResources.run({
      runId,
      taskId: null,
      initiatorMemberId: this.#initiatorMemberId,
      kind: "linghu-unified-test",
      port: 4197,
      buildRoot,
    }, async () => {
      const verificationEvidence: ManagedExecutionVerificationEvidenceOutDto[] = [];
      const validationFailures: UnifiedTestScriptFailure[] = [];
      // 彼此独立的验证全部运行并收齐证据，避免一次只暴露一个漏点而反复返修。
      for (const script of FIXED_VALIDATION_SCRIPTS) {
        // 开始事件先于子进程创建，卡住时仍能定位当前脚本。
        this.#recordEvent(`${this.#eventNamespace}.unified_test.started`, { script, candidateProjectRoot: resolvedProjectRoot });
        try {
          // 子进程只接收固定脚本名和受控环境。
          await runNpmScript(desktopRoot, script, environment);
          // 退出码为零后才记录完成。
          this.#recordEvent(`${this.#eventNamespace}.unified_test.completed`, { script, candidateProjectRoot: resolvedProjectRoot });
          verificationEvidence.push({
            scenario: script,
            command: `npm run ${script}`,
            status: "passed",
            source: "fixed-unified-test-runner",
            completedAt: new Date().toISOString(),
          });
        } catch (error) {
          // 单项失败先登记但不打断其余独立验证；同轮结束后统一交给恢复链。
          const detail = error instanceof Error ? error.message : String(error);
          this.#recordEvent(`${this.#eventNamespace}.unified_test.failed`, { script, detail });
          validationFailures.push({ script, detail });
        }
      }
      if (validationFailures.length > 0) throw new UnifiedTestAggregateError(validationFailures);
      // 发布验证有严格产物依赖，任一失败都必须停止后续发布动作。
      for (const script of FIXED_RELEASE_SCRIPTS) {
        this.#recordEvent(`${this.#eventNamespace}.unified_test.started`, { script, candidateProjectRoot: resolvedProjectRoot });
        try {
          await runNpmScript(desktopRoot, script, environment);
          this.#recordEvent(`${this.#eventNamespace}.unified_test.completed`, { script, candidateProjectRoot: resolvedProjectRoot });
          verificationEvidence.push({
            scenario: script,
            command: `npm run ${script}`,
            status: "passed",
            source: "fixed-unified-test-runner",
            completedAt: new Date().toISOString(),
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.#recordEvent(`${this.#eventNamespace}.unified_test.failed`, { script, detail });
          throw error;
        }
      }
      // 全部脚本通过后验证正式可执行文件确实存在于稳定 build 根。
      try {
        return { executable: resolveVerifiedDeveloperExecutable(buildRoot), verificationEvidence };
      } catch (error) {
        this.#recordEvent(`${this.#eventNamespace}.unified_test.infrastructure_failed`, {
          candidateProjectRoot: resolvedProjectRoot,
          selectedWorkspaceRoot: this.#sourceProjectRoot,
          buildRoot,
          detail: error instanceof Error ? error.message : String(error),
        });
        throw new UnifiedTestInfrastructureError(this.#sourceProjectRoot, buildRoot, error);
      }
    }).finally(() => {
      // 成功、失败或异常都释放候选依赖租约，避免后续任务永久等待。
      releaseManagedDependencyLease(dependencyLease);
    });
  }
}

function runNpmScript(cwd: string, script: string, environment: NodeJS.ProcessEnv): Promise<void> {
  // Promise 把子进程事件转换为上层可等待的成功或失败结果。
  return new Promise((resolve, reject) => {
    // Windows 使用 npm.cmd，其他平台使用 npm；shell=false 阻止额外字符串解释。
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
      cwd,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // 只保留最近 16,000 字符，避免长构建输出无限占用主进程内存。
    let output = "";
    // stdout 与 stderr 使用同一追加器，失败信息保留真实发生顺序的近似尾部。
    const append = (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-16_000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    // 单个脚本超过二十分钟时终止进程，交给令狐失败恢复链处理。
    const timer = setTimeout(() => child.kill(), 20 * 60_000);
    // 进程创建失败时先清理计时器，再返回原始异常。
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    // 退出事件统一解释退出码或信号，并附带最后 4,000 字符证据。
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        const capacity = parseDeveloperPackageCapacityBlocked(output);
        if (capacity) reject(new UnifiedTestCapacityBlockedError(script, capacity));
        else reject(new Error(`${script} 失败（${signal ? `信号 ${signal}` : `退出码 ${code ?? "unknown"}`}）：${output.trim().slice(-4_000)}`));
      }
    });
  });
}

/** 只解析预检输出的最后一条固定标记，避免构建日志中的任意文本改变故障恢复路线。 */
function parseDeveloperPackageCapacityBlocked(output: string): DeveloperPackageCapacity | null {
  const markerIndex = output.lastIndexOf(DEVELOPER_PACKAGE_CAPACITY_BLOCKED_MARKER);
  if (markerIndex < 0) return null;
  const encoded = output.slice(markerIndex + DEVELOPER_PACKAGE_CAPACITY_BLOCKED_MARKER.length).split(/\r?\n/, 1)[0];
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!isDeveloperPackageCapacity(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 容量字段必须是非负安全整数，损坏记录继续按普通脚本失败处理。 */
function isDeveloperPackageCapacity(value: unknown): value is DeveloperPackageCapacity {
  if (!value || typeof value !== "object") return false;
  return ["fileBytes", "directoryBytes", "headroomBytes", "requiredBytes", "availableBytes"]
    .every((field) => Number.isSafeInteger((value as Record<string, unknown>)[field]) && (value as Record<string, number>)[field] >= 0);
}
