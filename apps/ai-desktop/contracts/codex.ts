import type { ModelServiceTier, ReasoningEffort } from "./base.js";

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
