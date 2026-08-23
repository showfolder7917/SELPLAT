import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { resolveApplicationDataPaths } from "@selplat/node-common-core/path";
import { resolveLockSpecificDependencyPaths } from "@selplat/node-common-core/lifecycle";
import { ensureIntegrationDependencies } from "./integration-verifier.js";
import { TestResourceCoordinatorFacade } from "./test-resource-coordinator-facade.js";
import { resolveVerifiedDeveloperExecutable } from "./verified-package-release.js";

const FIXED_UNIFIED_SCRIPTS = ["test:interaction", "test:collaboration", "test:managed", "package:mac:developer", "verify:mac:developer"] as const;

/** 测试漏点模块只通过固定 npm 脚本执行正式构建与统一回归，禁止把动态命令交给自动执行文案。 */
export class LinghuUnifiedTestRunner {
  readonly #sourceProjectRoot: string;
  readonly #applicationName: string;
  readonly #desktopRoot: string;
  readonly #recordEvent: (type: string, details: Record<string, unknown>) => void;
  readonly #testResources: TestResourceCoordinatorFacade;
  readonly #buildRoot: string;

  constructor(projectRoot: string, applicationName: string, buildRoot: string, recordEvent: (type: string, details: Record<string, unknown>) => void, testResources: TestResourceCoordinatorFacade) {
    this.#sourceProjectRoot = path.resolve(projectRoot);
    this.#applicationName = applicationName;
    this.#desktopRoot = path.join(this.#sourceProjectRoot, "apps", applicationName);
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
    const dependencyMode = await this.#ensureCandidateDependencies(desktopRoot, resolvedProjectRoot);
    return this.#testResources.run({
      runId: `linghu-unified-${Date.now()}`,
      taskId: null,
      initiatorMemberId: "linghu-ancestor",
      kind: "linghu-unified-test",
      port: 4197,
      buildRoot,
    }, async () => { for (const script of FIXED_UNIFIED_SCRIPTS) {
      this.#recordEvent("linghu.unified_test.started", { script, candidateProjectRoot: resolvedProjectRoot });
      try {
        await runNpmScript(desktopRoot, script);
        this.#recordEvent("linghu.unified_test.completed", { script, candidateProjectRoot: resolvedProjectRoot });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.#recordEvent("linghu.unified_test.failed", { script, detail });
        throw error;
      }
    }
      return resolveVerifiedDeveloperExecutable(buildRoot);
    }).finally(() => {
      if (dependencyMode === "linked") {
        const dependencyLink = path.join(desktopRoot, "node_modules");
        if (existsSync(dependencyLink)) unlinkSync(dependencyLink);
      }
    });
  }

  async #ensureCandidateDependencies(candidateDesktopRoot: string, candidateProjectRoot: string): Promise<"ready" | "linked" | "installed"> {
    if (candidateProjectRoot === this.#sourceProjectRoot) return "ready";
    const sourceDesktopRoot = this.#desktopRoot;
    const sourcePaths = resolveApplicationDataPaths({ selplatRoot: this.#sourceProjectRoot, applicationName: this.#applicationName });
    const sourceModules = resolveLockSpecificDependencyPaths(sourcePaths.dependencyCacheRoot, readFileSync(path.join(sourceDesktopRoot, "package-lock.json"))).nodeModulesRoot;
    return ensureIntegrationDependencies(candidateDesktopRoot, sourceModules, path.join(sourceDesktopRoot, "package-lock.json"), path.join(sourcePaths.cacheRoot, "npm"));
  }
}

function runNpmScript(cwd: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
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
