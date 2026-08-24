import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { resolveApplicationDataPaths, resolveApplicationNameFromSourceRoot } from "@selplat/node-common-core/path";
import { resolveLockSpecificDependencyPaths } from "@selplat/node-common-core/lifecycle";

import type {
  AutomaticTestPreflightCheck,
  AutomaticTestPreflightResult,
  CodexHarnessStatus,
  Locale,
  WorkspaceState,
} from "../../contracts/desktop.js";
import type { TrustedCommandStore } from "./trusted-command-store.js";

const interactionPort = 4197;
const staleAfterMs = 10 * 60 * 1_000;

interface AutomaticTestPreflightRequest {
  appRoot: string;
  codexStatus: CodexHarnessStatus;
  locale: Locale;
  trustedCommands: TrustedCommandStore;
  workspaces: WorkspaceState;
}

/** 开启自动测试前集中检查已知阻断项，并只授权固定共享测试入口。 */
export async function prepareAutomaticTesting(request: AutomaticTestPreflightRequest): Promise<AutomaticTestPreflightResult> {
  const checks: AutomaticTestPreflightCheck[] = [];
  checks.push(checkHarness(request.codexStatus, request.locale));
  checks.push(checkWorkspace(request.appRoot, request.workspaces, request.locale));
  checks.push(checkRunner(request.appRoot, request.locale));
  checks.push(checkLock(request.appRoot, request.locale));
  checks.push(await checkPort(request.locale));

  const canAuthorize = checks.every((check) => check.status === "passed");
  const authorization = canAuthorize
    ? request.trustedCommands.trustAutomaticTestDocument(request.appRoot, request.workspaces)
    : { trusted: false };
  checks.push({
    id: "command",
    status: authorization.trusted ? "passed" : "failed",
    label: copy(request.locale, "固定测试命令", "固定テストコマンド"),
    detail: authorization.trusted
      ? copy(request.locale, "仅允许无附加参数的 npm run test:document；其他命令仍需人工审批。", "引数なしの npm run test:document のみを許可しました。その他のコマンドは引き続き手動承認が必要です。")
      : copy(request.locale, "固定测试入口未能建立窄范围授权。", "固定テスト入口に限定承認を設定できませんでした。"),
  });

  return {
    status: checks.every((check) => check.status === "passed") ? "ready" : "blocked",
    checkedAt: new Date().toISOString(),
    checks,
  };
}

function checkHarness(status: CodexHarnessStatus, locale: Locale): AutomaticTestPreflightCheck {
  const passed = status.connected && status.account.authenticated;
  return {
    id: "harness",
    status: passed ? "passed" : "failed",
    label: copy(locale, "Codex 连接", "Codex 接続"),
    detail: passed
      ? copy(locale, `已连接 Codex ${status.runtime?.version || "Harness"}。`, `Codex ${status.runtime?.version || "Harness"} に接続済みです。`)
      : copy(locale, "Codex 未连接或 ChatGPT 账号尚未登录。", "Codex が未接続、または ChatGPT アカウントにログインしていません。"),
  };
}

function checkWorkspace(appRoot: string, workspaces: WorkspaceState, locale: Locale): AutomaticTestPreflightCheck {
  const root = workspaces.roots.find((workspace) => isInside(appRoot, workspace.path));
  const passed = root?.permission === "workspace-write";
  return {
    id: "workspace",
    status: passed ? "passed" : "failed",
    label: copy(locale, "工作区写入", "ワークスペース書き込み"),
    detail: passed
      ? copy(locale, `已允许写入 ${root?.name || "当前工作区"}。`, `${root?.name || "現在のワークスペース"} への書き込みが許可されています。`)
      : copy(locale, "AI Desktop 所在工作区未登记为可写入。", "AI Desktop のワークスペースが書き込み可能として登録されていません。"),
  };
}

function checkRunner(appRoot: string, locale: Locale): AutomaticTestPreflightCheck {
  const runnerPath = path.join(appRoot, "scripts", "test-document-runner.mjs");
  const manifestPath = path.join(appRoot, "package.json");
  const projectRoot = path.resolve(appRoot, "../..");
  const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
  const dependencyRoot = resolveLockSpecificDependencyPaths(projectPaths.dependencyCacheRoot, readFileSync(path.join(appRoot, "package-lock.json"))).nodeModulesRoot;
  const requiredDependencies = [path.join(dependencyRoot, "electron"), path.join(dependencyRoot, "@openai", "codex"), path.join(dependencyRoot, "@playwright", "test")];
  let scriptReady = false;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { scripts?: Record<string, unknown> };
    scriptReady = manifest.scripts?.["test:document"] === "node scripts/run-with-dependencies.mjs node scripts/test-document-runner.mjs";
  } catch {
    scriptReady = false;
  }
  const passed = existsSync(runnerPath) && scriptReady && requiredDependencies.every(existsSync);
  return {
    id: "runner",
    status: passed ? "passed" : "failed",
    label: copy(locale, "测试执行器", "テストランナー"),
    detail: passed
      ? copy(locale, "共享测试执行器及 Electron、Codex、Playwright 依赖完整。", "共有テストランナーと Electron、Codex、Playwright の依存関係が揃っています。")
      : copy(locale, "测试执行器、脚本登记或必要依赖不完整。", "テストランナー、スクリプト登録、または必要な依存関係が不足しています。"),
  };
}

function checkLock(appRoot: string, locale: Locale): AutomaticTestPreflightCheck {
  const projectRoot = path.resolve(appRoot, "../..");
  const projectPaths = resolveApplicationDataPaths({ selplatRoot: projectRoot, applicationName: resolveApplicationNameFromSourceRoot(appRoot) });
  const lockPath = path.join(projectPaths.runningTestRoot, "执行锁.json");
  if (!existsSync(lockPath)) {
    return { id: "lock", status: "passed", label: copy(locale, "测试执行锁", "テスト実行ロック"), detail: copy(locale, "当前没有其他测试进程占用共享测试。", "共有テストを使用中の別プロセスはありません。") };
  }
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown>;
    const heartbeatAt = Date.parse(String(lock.heartbeatAt || lock.startedAt || ""));
    const fresh = Number.isFinite(heartbeatAt) && Date.now() - heartbeatAt <= staleAfterMs;
    const localProcessAlive = lock.host === os.hostname() && Number.isInteger(lock.pid) && isProcessAlive(Number(lock.pid));
    if (fresh && (lock.host !== os.hostname() || localProcessAlive)) {
      return {
        id: "lock",
        status: "failed",
        label: copy(locale, "测试执行锁", "テスト実行ロック"),
        detail: copy(locale, `共享测试正由 ${String(lock.executor || "未知执行者")} 执行；当前项：${String(lock.currentItem || "未知")}。`, `共有テストは ${String(lock.executor || "不明な実行者")} が実行中です。現在の項目：${String(lock.currentItem || "不明")}。`),
      };
    }
    return { id: "lock", status: "passed", label: copy(locale, "测试执行锁", "テスト実行ロック"), detail: copy(locale, "检测到过期测试锁，正式执行时将安全恢复。", "期限切れのテストロックを検出しました。実行時に安全に復旧します。") };
  } catch {
    return { id: "lock", status: "failed", label: copy(locale, "测试执行锁", "テスト実行ロック"), detail: copy(locale, "测试锁内容损坏，需人工确认后再执行。", "テストロックが破損しています。手動確認後に再実行してください。") };
  }
}

async function checkPort(locale: Locale): Promise<AutomaticTestPreflightCheck> {
  const available = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(interactionPort, "127.0.0.1", () => server.close(() => resolve(true)));
  });
  return {
    id: "port",
    status: available ? "passed" : "failed",
    label: copy(locale, "本地测试端口", "ローカルテストポート"),
    detail: available
      ? copy(locale, `127.0.0.1:${interactionPort} 可以用于隔离交互测试。`, `127.0.0.1:${interactionPort} は隔離インタラクションテストに使用できます。`)
      : copy(locale, `127.0.0.1:${interactionPort} 已被占用或禁止监听。`, `127.0.0.1:${interactionPort} は使用中、または待受が許可されていません。`),
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isInside(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function copy(locale: Locale, chinese: string, japanese: string): string {
  return locale === "ja" ? japanese : chinese;
}
