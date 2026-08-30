import { spawn } from "node:child_process";
import path from "node:path";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";
import { acquireManagedDependencyLease, releaseManagedDependencyLease } from "./integration-verifier.js";
import { TestResourceCoordinatorFacade } from "./test-resource-coordinator-facade.js";
import { resolveVerifiedDeveloperExecutable } from "./verified-package-release.js";

const FIXED_UNIFIED_SCRIPTS = ["test:interaction", "test:collaboration", "test:managed", "package:mac:developer", "verify:mac:developer"] as const;

/** 测试漏点模块只通过固定 npm 脚本执行正式构建与统一回归，禁止把动态命令交给自动执行文案。 */
export class LinghuUnifiedTestRunner {
  readonly #sourceProjectRoot: string;
  readonly #applicationName: string;
  readonly #recordEvent: (type: string, details: Record<string, unknown>) => void;
  readonly #testResources: TestResourceCoordinatorFacade;
  readonly #buildRoot: string;

  constructor(projectRoot: string, applicationName: string, buildRoot: string, recordEvent: (type: string, details: Record<string, unknown>) => void, testResources: TestResourceCoordinatorFacade) {
    this.#sourceProjectRoot = path.resolve(projectRoot);
    this.#applicationName = applicationName;
    this.#buildRoot = path.resolve(buildRoot);
    this.#recordEvent = recordEvent;
    this.#testResources = testResources;
  }

  async run(candidateProjectRoot = this.#sourceProjectRoot): Promise<string> {
    const resolvedProjectRoot = path.resolve(candidateProjectRoot);
    const desktopRoot = path.join(resolvedProjectRoot, "apps", this.#applicationName);
    const buildRoot = resolvedProjectRoot === this.#sourceProjectRoot
      ? this.#buildRoot
      : resolveApplicationDataPaths({ selplatRoot: resolvedProjectRoot, applicationName: this.#applicationName }).buildRoot;
    const runId = `linghu-unified-${Date.now()}`;
    const dependencyLease = resolvedProjectRoot === this.#sourceProjectRoot
      ? null
      : await acquireManagedDependencyLease(resolvedProjectRoot, this.#sourceProjectRoot, this.#applicationName, runId);
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...dependencyLease?.environment,
      // 候选 worktree 的依赖链接已由外层按锁文件核验；内层所有 npm 脚本只能借用，不能再次迁移或接管。
      AI_DESKTOP_TEST_TASK_ID: runId,
      // 候选包最终会提升并脱离临时 worktree，开发版元数据必须指回持续存在的源工程和归档日志根。
      SELPLAT_ROOT: this.#sourceProjectRoot,
      GIT_TERMINAL_PROMPT: "0",
    };
    delete environment.ELECTRON_RUN_AS_NODE;
    delete environment.NODE_OPTIONS;
    delete environment.NODE_INSPECT_RESUME_ON_START;
    delete environment.VSCODE_INSPECTOR_OPTIONS;
    return this.#testResources.run({
      runId,
      taskId: null,
      initiatorMemberId: "linghu-ancestor",
      kind: "linghu-unified-test",
      port: 4197,
      buildRoot,
    }, async () => { for (const script of FIXED_UNIFIED_SCRIPTS) {
      this.#recordEvent("linghu.unified_test.started", { script, candidateProjectRoot: resolvedProjectRoot });
      try {
        await runNpmScript(desktopRoot, script, environment);
        this.#recordEvent("linghu.unified_test.completed", { script, candidateProjectRoot: resolvedProjectRoot });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.#recordEvent("linghu.unified_test.failed", { script, detail });
        throw error;
      }
    }
      return resolveVerifiedDeveloperExecutable(buildRoot);
    }).finally(() => {
      releaseManagedDependencyLease(dependencyLease);
    });
  }
}

function runNpmScript(cwd: string, script: string, environment: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
      cwd,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-16_000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => child.kill(), 20 * 60_000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${script} 失败（${signal ? `信号 ${signal}` : `退出码 ${code ?? "unknown"}`}）：${output.trim().slice(-4_000)}`));
    });
  });
}
