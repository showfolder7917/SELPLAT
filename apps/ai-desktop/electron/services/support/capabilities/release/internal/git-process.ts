import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DARWIN_SYSTEM_GIT = "/usr/bin/git";

export interface GitExecutionOptions {
  timeout?: number;
  maxBuffer?: number;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

/** macOS 从桌面进程启动时 PATH 可能不含系统目录，优先使用已验证的系统 Git。 */
export function resolveGitCommand(platform = process.platform, fileExists: (file: string) => boolean = existsSync): string {
  return platform === "darwin" && fileExists(DARWIN_SYSTEM_GIT) ? DARWIN_SYSTEM_GIT : "git";
}

/** 保留 Git 校验输出；ENOENT 额外带出 PATH，避免两类失败都被压缩成无法行动的一行错误。 */
export function describeGitFailure(error: unknown, command: string, cwd: string, environment: NodeJS.ProcessEnv): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const stderr = childOutput(error, "stderr");
  const stdout = childOutput(error, "stdout");
  const detail = (stderr || stdout || message).slice(-2_000);
  const pathDetail = code === "ENOENT" ? `；PATH=${environment.PATH || "<missing>"}` : "";
  return new Error(`Git 命令失败：command=${command}；cwd=${cwd}${pathDetail}；${detail}`);
}

/** 发布路径唯一的 Git 子进程入口，统一处理非交互环境和 macOS 可执行文件解析。 */
export async function executeGit(args: readonly string[], cwd: string, options: GitExecutionOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const command = resolveGitCommand(options.platform);
  const environment = { ...process.env, ...options.environment, GIT_TERMINAL_PROMPT: "0" };
  try {
    const result = await execFileAsync(command, [...args], {
      cwd,
      timeout: options.timeout ?? 120_000,
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
      env: environment,
    });
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  } catch (error) {
    throw describeGitFailure(error, command, cwd, environment);
  }
}

function childOutput(error: unknown, key: "stdout" | "stderr"): string {
  if (!error || typeof error !== "object" || !(key in error)) return "";
  const value = (error as Record<string, unknown>)[key];
  if (typeof value === "string") return value.trim();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8").trim();
  return "";
}
