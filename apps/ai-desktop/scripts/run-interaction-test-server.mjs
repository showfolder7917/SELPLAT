import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const diagnosticsFile = process.env.AI_DESKTOP_INTERACTION_SERVER_DIAGNOSTICS;

if (!diagnosticsFile) {
  throw new Error("缺少 AI_DESKTOP_INTERACTION_SERVER_DIAGNOSTICS，无法保留交互测试服务诊断。");
}

const maxOutputLength = 16 * 1024;
const startedAt = new Date().toISOString();
let stdout = "";
let stderr = "";
let stoppingSignal = null;
let server;

function appendOutput(previousOutput, chunk) {
  return `${previousOutput}${chunk}`.slice(-maxOutputLength);
}

function writeDiagnostics(status, details = {}) {
  mkdirSync(path.dirname(diagnosticsFile), { recursive: true });
  writeFileSync(diagnosticsFile, `${JSON.stringify({
    status,
    pid: server?.pid ?? null,
    startedAt,
    updatedAt: new Date().toISOString(),
    stdout,
    stderr,
    ...details,
  }, null, 2)}\n`, "utf8");
}

let viteCliPath;
try {
  // Vite 只公开 package.json，不公开 bin/vite.js 子路径；从公开元数据定位其受包管理器控制的 CLI。
  viteCliPath = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
} catch (error) {
  writeDiagnostics("failed-to-resolve", { error: error instanceof Error ? error.message : String(error) });
  throw error;
}

// 由测试基础设施持久化 Vite 生命周期，避免服务退出后只留下浏览器的连接拒绝。
server = spawn(process.execPath, [viteCliPath, "--host", "127.0.0.1", "--port", "4197", "--strictPort"], {
  env: { ...process.env, VITE_APP_VARIANT: "developer" },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => {
  stdout = appendOutput(stdout, chunk);
  process.stdout.write(chunk);
  writeDiagnostics("running");
});
server.stderr.on("data", (chunk) => {
  stderr = appendOutput(stderr, chunk);
  process.stderr.write(chunk);
  writeDiagnostics("running");
});
server.once("spawn", () => writeDiagnostics("running"));
server.once("error", (error) => {
  writeDiagnostics("failed-to-start", { error: error.message });
  process.exitCode = 1;
});
server.once("exit", (exitCode, signal) => {
  const expectedStop = stoppingSignal !== null;
  writeDiagnostics(expectedStop ? "stopped" : "exited", {
    exitCode,
    signal,
    stoppingSignal,
  });
  process.exitCode = expectedStop ? 0 : 1;
});

function stopServer(signal) {
  stoppingSignal = signal;
  writeDiagnostics("stopping", { stoppingSignal });
  if (!server.killed) server.kill(signal);
}

process.once("SIGINT", () => stopServer("SIGINT"));
process.once("SIGTERM", () => stopServer("SIGTERM"));
