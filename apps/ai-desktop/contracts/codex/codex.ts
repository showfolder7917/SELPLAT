/**
 * Codex 运行、认证、审批、用户输入和模型目录协议。
 *
 * 生产者：主进程 CodexService 与 CodexRuntime。
 * 消费者：preload 白名单和 Renderer 对话、审批及设置界面。
 * 数据方向：renderer <-> preload <-> main <-> Codex 子进程。
 * 本文件不包含访问令牌、子进程句柄或原始环境变量。
 */
import type { ModelServiceTier, ReasoningEffort } from "../foundation/base.js";

export interface CodexAccount {
  authenticated: boolean;
  authMode: string | null;
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
}

export interface CodexRuntimeInfo {
  source: "bundled" | "downloaded";
  version: string;
}

export interface CodexHarnessStatus {
  connected: boolean;
  account: CodexAccount;
  error: string | null;
  runtime: CodexRuntimeInfo | null;
}

export interface CodexLoginResponse {
  loginId: string;
  authUrl: string;
}

export interface CodexApproval {
  requestId: number;
  kind: "command" | "fileChange";
  title: string;
  reason: string | null;
  command: string | null;
  cwd: string | null;
  details: string | null;
  trustEligible: boolean;
}

export interface ResolveCodexApprovalResult {
  status: "resolved" | "expired";
  trusted: boolean;
}

export interface TrustedCommandInfo {
  count: number;
}

export interface AutomaticTestPreflightCheck {
  id: "harness" | "workspace" | "runner" | "lock" | "port" | "screen" | "command";
  status: "passed" | "failed";
  label: string;
  detail: string;
}

export interface AutomaticTestPreflightResult {
  status: "ready" | "blocked";
  checkedAt: string;
  checks: AutomaticTestPreflightCheck[];
}

export interface CodexUserInputOption {
  label: string;
  description: string;
}

export interface CodexUserInputQuestion {
  id: string;
  header: string;
  question: string;
  options: CodexUserInputOption[];
}

export interface CodexUserInputRequest {
  requestId: number;
  questions: CodexUserInputQuestion[];
}

export interface ResolveCodexUserInputRequest {
  requestId: number;
  answers: Record<string, string[]>;
}

export interface CodexModelOption {
  id: string;
  displayName: string;
  provider: string | null;
  supportedReasoningEfforts: ReasoningEffort[];
  supportedServiceTiers: ModelServiceTier[];
  defaultReasoningEffort: ReasoningEffort | null;
  isDefault: boolean;
}

export interface CodexModelCatalog {
  models: CodexModelOption[];
}
