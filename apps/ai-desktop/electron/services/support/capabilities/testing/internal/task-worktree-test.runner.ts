import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { CodexStreamEventOutDto } from "../../../../../../contracts/services/support/platform/codex/index.js";
import { acquireManagedDependencyLease, releaseManagedDependencyLease } from "../../release/index.js";
import { TestResourceCoordinatorFacade } from "../test-resource-coordinator.facade.js";

interface TaskWorktreeTestRequest {
  taskId: string;
  worktreeRoot: string;
  emit(event: CodexStreamEventOutDto): void;
}

const TEST_SCRIPTS = [
  { name: "typecheck", expected: "node scripts/run-with-dependencies.mjs tsc -p tsconfig.json --noEmit", timeout: 180_000 },
  // 与签发验证器的精确脚本签名保持一致：先生成隔离渲染与主进程产物，再从锁定依赖缓存运行交互检查。
  { name: "test:interaction", expected: "npm run build:developer && node scripts/run-with-dependencies.mjs node scripts/run-interaction-tests.mjs", timeout: 360_000 },
] as const;

/** 在 AI Desktop 主进程中串行验证各任务签发的 worktree，不把 Playwright 权限交给 Codex。 */
export class TaskWorktreeTestRunner {
  readonly #sourceProjectRoot: string;
  readonly #applicationName: string;
  readonly #cacheRoot: string;
  readonly #recordEvent: (type: string, details: Record<string, unknown>, taskId: string) => void;
  readonly #testResources: TestResourceCoordinatorFacade;

  constructor(
    sourceProjectRoot: string,
    applicationName: string,
    cacheRoot: string,
    recordEvent: (type: string, details: Record<string, unknown>, taskId: string) => void,
    testResources: TestResourceCoordinatorFacade,
  ) {
    this.#sourceProjectRoot = path.resolve(sourceProjectRoot);
    this.#applicationName = safeSegment(applicationName);
    this.#cacheRoot = path.resolve(cacheRoot);
    this.#recordEvent = recordEvent;
    this.#testResources = testResources;
    mkdirSync(this.#cacheRoot, { recursive: true });
  }

  run(request: TaskWorktreeTestRequest): Promise<void> {
    return this.#testResources.run({
      runId: `task-${request.taskId}`,
      taskId: request.taskId,
      initiatorMemberId: "collaboration-task-runner",
      kind: "task-validation",
      port: 4197,
      buildRoot: path.join(path.resolve(request.worktreeRoot), "build", this.#applicationName),
    }, () => this.#runIsolated(request));
  }

  async #runIsolated(request: TaskWorktreeTestRequest): Promise<void> {
    const safeTaskId = safeSegment(request.taskId);
    const desktopRoot = path.join(path.resolve(request.worktreeRoot), "apps", this.#applicationName);
    validateFixedScripts(desktopRoot);
    const dependencyLease = await acquireManagedDependencyLease(
      request.worktreeRoot,
      this.#sourceProjectRoot,
      this.#applicationName,
      `task-validation-${safeTaskId}`,
      path.join(this.#cacheRoot, "npm"),
    );
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...dependencyLease.environment,
      AI_DESKTOP_TEST_TASK_ID: safeTaskId,
      PLAYWRIGHT_BROWSERS_PATH: path.join(this.#cacheRoot, "playwright"),
      npm_config_cache: path.join(this.#cacheRoot, "npm"),
      GIT_TERMINAL_PROMPT: "0",
      // 隔离 Electron 若未建立调试端点，必须把真实启动命令和子进程 stderr 带回签发测试证据，不能只留下外层 hook 超时。
      DEBUG: "pw:browser",
    };
    // 签发验证由 Electron 主进程派生，禁止把宿主的 Node 模式或调试暂停控制带入 npm、Playwright 和隔离 Electron。
    delete environment.ELECTRON_RUN_AS_NODE;
    delete environment.NODE_OPTIONS;
    delete environment.NODE_INSPECT_RESUME_ON_START;
    delete environment.VSCODE_INSPECTOR_OPTIONS;
    this.#recordEvent("collaboration.task_test.started", { worktreeRoot: request.worktreeRoot, dependencyMode: "managed-lease" }, request.taskId);
    try {
      for (const script of TEST_SCRIPTS) {
        const command = `npm run ${script.name}`;
        emitActivity(request.emit, request.taskId, script.name, "started", command, null);
        try {
          const output = await runNpmScript(script.name, desktopRoot, environment, script.timeout);
          emitActivity(request.emit, request.taskId, script.name, "completed", command, output, 0);
          this.#recordEvent("collaboration.task_test.command_completed", { command, worktreeRoot: request.worktreeRoot }, request.taskId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          emitActivity(request.emit, request.taskId, script.name, "completed", command, detail, 1);
          this.#recordEvent("collaboration.task_test.command_failed", { command, worktreeRoot: request.worktreeRoot, detail }, request.taskId);
          throw error;
        }
      }
      this.#recordEvent("collaboration.task_test.completed", { worktreeRoot: request.worktreeRoot }, request.taskId);
    } finally {
      // 锁文件一致时只临时复用主工程依赖，任务验证结束立即移除链接，避免进入分支提交。
      releaseManagedDependencyLease(dependencyLease);
    }
  }
}

function validateFixedScripts(desktopRoot: string): void {
  const manifestPath = path.join(desktopRoot, "package.json");
  if (!existsSync(manifestPath)) throw new Error(`任务 worktree 缺少应用 package.json：${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { scripts?: Record<string, unknown> };
  for (const script of TEST_SCRIPTS) {
    if (manifest.scripts?.[script.name] !== script.expected) {
      throw new Error(`固定测试脚本 ${script.name} 已变化，禁止免审执行；需要人工审核新的脚本定义。`);
    }
  }
}

function runNpmScript(name: string, cwd: string, environment: NodeJS.ProcessEnv, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", name], {
      cwd,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-12_000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => child.kill(), timeout);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim().slice(-4_000));
      else reject(new Error(`${name} 失败（${signal ? `信号 ${signal}` : `退出码 ${code ?? "unknown"}`}）：${output.trim().slice(-4_000)}`));
    });
  });
}

function emitActivity(
  emit: (event: CodexStreamEventOutDto) => void,
  taskId: string,
  scriptName: string,
  phase: "started" | "completed",
  summary: string,
  detail: string | null,
  exitCode?: number,
): void {
  emit({
    type: "activity",
    turnId: `desktop-test:${taskId}`,
    segmentId: `desktop-test:${taskId}:${scriptName}`,
    activity: {
      id: `desktop-test:${taskId}:${scriptName}`,
      itemType: "commandExecution",
      phase,
      status: phase === "started" ? "running" : exitCode === 0 ? "completed" : "failed",
      summary,
      detail,
      ...(exitCode === undefined ? {} : { exitCode }),
    },
  });
}

function safeSegment(value: string): string {
  const normalized = value.toLowerCase().replaceAll(/[^a-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 100);
  if (!normalized) throw new Error("任务 ID 无法用于隔离测试输出。");
  return normalized;
}
