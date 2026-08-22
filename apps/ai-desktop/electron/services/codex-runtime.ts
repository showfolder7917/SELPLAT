import { constants, existsSync, realpathSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

export interface CodexRuntime {
  source: "system" | "bundled";
  command: string;
  argsPrefix: string[];
  displayPath: string;
  version: string;
  electronRunAsNode: boolean;
}

/** 每次连接 Harness 前重新探测本机 Codex；优先选择与当前模型缓存协议匹配的本机版本。 */
export async function resolveCodexRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CodexRuntime> {
  const configuredPath = environment.AI_DESKTOP_CODEX_PATH?.trim();
  if (configuredPath) {
    if (!path.isAbsolute(configuredPath)) {
      throw new Error("AI_DESKTOP_CODEX_PATH must be an absolute path.");
    }
    if (!await isExecutable(configuredPath)) {
      throw new Error(`Configured Codex executable is unavailable: ${configuredPath}`);
    }
    const executablePath = realpathSync(configuredPath);
    return createSystemRuntime(
      executablePath,
      await readCodexVersion(executablePath, [], false, environment),
    );
  }

  const cacheClientVersion = await readCacheClientVersion(environment);
  const systemRuntimes: CodexRuntime[] = [];
  for (const executablePath of await resolveSystemCodexPaths(environment)) {
    try {
      const version = await readCodexVersion(executablePath, [], false, environment);
      const runtime = createSystemRuntime(executablePath, version);
      if (isSameCodexRelease(version, cacheClientVersion)) return runtime;
      systemRuntimes.push(runtime);
    } catch {
      // 单个本机候选不可运行时继续检查其他安装位置。
    }
  }

  const newestSystemRuntime = systemRuntimes.sort(compareCodexRuntimeVersion)[0];
  if (newestSystemRuntime) return newestSystemRuntime;

  const require = createRequire(import.meta.url);
  const codexEntry = require.resolve("@openai/codex/bin/codex.js");
  return {
    source: "bundled",
    command: process.execPath,
    argsPrefix: [codexEntry],
    displayPath: codexEntry,
    version: await readCodexVersion(process.execPath, [codexEntry], true, environment),
    electronRunAsNode: true,
  };
}

async function resolveSystemCodexPaths(environment: NodeJS.ProcessEnv): Promise<string[]> {
  const candidates: string[] = [];
  if (process.platform === "darwin") {
    candidates.push(
      "/Applications/ChatGPT.app/Contents/Resources/codex",
      "/Applications/Codex.app/Contents/Resources/codex",
    );
  } else if (process.platform === "win32") {
    const localAppData = environment.LOCALAPPDATA?.trim();
    const programFiles = environment.ProgramFiles?.trim();
    if (localAppData) {
      candidates.push(
        path.join(localAppData, "Programs", "ChatGPT", "resources", "codex.exe"),
        path.join(localAppData, "Programs", "Codex", "resources", "codex.exe"),
      );
    }
    if (programFiles) {
      candidates.push(
        path.join(programFiles, "ChatGPT", "resources", "codex.exe"),
        path.join(programFiles, "Codex", "resources", "codex.exe"),
      );
    }
  }
  const names = process.platform === "win32" ? ["codex.exe", "codex.cmd", "codex.bat"] : ["codex"];
  for (const directory of (environment.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      candidates.push(path.resolve(directory, name));
    }
  }

  const executablePaths: string[] = [];
  for (const candidate of candidates) {
    if (!await isExecutable(candidate)) continue;
    const executablePath = realpathSync(candidate);
    if (!executablePaths.includes(executablePath)) executablePaths.push(executablePath);
  }
  return executablePaths;
}

async function isExecutable(filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) return false;
  try {
    await access(filePath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function readCacheClientVersion(environment: NodeJS.ProcessEnv): Promise<string | null> {
  const configuredCodexHome = environment.CODEX_HOME?.trim();
  const codexHome = configuredCodexHome
    ? path.resolve(configuredCodexHome)
    : path.join(homedir(), ".codex");
  try {
    const cache = JSON.parse(
      await readFile(path.join(codexHome, "models_cache.json"), "utf8"),
    ) as { client_version?: unknown };
    return typeof cache.client_version === "string" ? cache.client_version : null;
  } catch {
    return null;
  }
}

function createSystemRuntime(executablePath: string, version: string): CodexRuntime {
  return {
    source: "system",
    command: executablePath,
    argsPrefix: [],
    displayPath: executablePath,
    version,
    electronRunAsNode: false,
  };
}

function isSameCodexRelease(runtimeVersion: string, cacheClientVersion: string | null): boolean {
  if (!cacheClientVersion) return false;
  return releaseTuple(runtimeVersion)?.join(".") === releaseTuple(cacheClientVersion)?.join(".");
}

function compareCodexRuntimeVersion(left: CodexRuntime, right: CodexRuntime): number {
  const leftVersion = releaseTuple(left.version) ?? [0, 0, 0];
  const rightVersion = releaseTuple(right.version) ?? [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    const difference = rightVersion[index] - leftVersion[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function releaseTuple(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function readCodexVersion(
  command: string,
  argsPrefix: string[],
  electronRunAsNode: boolean,
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const childEnvironment = { ...environment };
    if (electronRunAsNode) childEnvironment.ELECTRON_RUN_AS_NODE = "1";
    else delete childEnvironment.ELECTRON_RUN_AS_NODE;
    const child = spawn(command, [...argsPrefix, "--version"], {
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
    });
    let output = "";
    const timeout = setTimeout(() => child.kill(), 4_000);
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      const version = output.match(/codex-cli\s+([^\s]+)/i)?.[1];
      if (code === 0 && version) resolve(version);
      else reject(new Error(`Unable to read Codex version from ${command}.`));
    });
  });
}
