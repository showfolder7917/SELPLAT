import { spawn } from "node:child_process";
import path from "node:path";
import { TestExecutionGate } from "./test-execution-gate.js";

const FIXED_UNIFIED_SCRIPTS = ["test:interaction", "test:collaboration", "test:managed", "package:mac:developer", "verify:mac:developer"] as const;

/** 第四保障模块只通过固定 npm 脚本执行正式构建与统一回归，禁止把动态命令交给自动执行文案。 */
export class LinghuUnifiedTestRunner {
  readonly #desktopRoot: string;
  readonly #recordEvent: (type: string, details: Record<string, unknown>) => void;
  readonly #gate: TestExecutionGate;

  constructor(projectRoot: string, applicationName: string, recordEvent: (type: string, details: Record<string, unknown>) => void, gate = new TestExecutionGate()) {
    this.#desktopRoot = path.join(path.resolve(projectRoot), "apps", applicationName);
    this.#recordEvent = recordEvent;
    this.#gate = gate;
  }

  async run(): Promise<void> {
    return this.#gate.run(async () => { for (const script of FIXED_UNIFIED_SCRIPTS) {
      this.#recordEvent("linghu.unified_test.started", { script });
      try {
        await runNpmScript(this.#desktopRoot, script);
        this.#recordEvent("linghu.unified_test.completed", { script });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.#recordEvent("linghu.unified_test.failed", { script, detail });
        throw error;
      }
    } });
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
