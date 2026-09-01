/**
 * Codex 运行、认证、审批、用户输入和模型目录协议。
 *
 * 生产者：主进程 CodexService 与 CodexRuntime。
 * 消费者：preload 白名单和 Renderer 对话、审批及设置界面。
 * 数据方向：renderer <-> preload <-> main <-> Codex 子进程。
 * 本文件不包含访问令牌、子进程句柄或原始环境变量。
 */
import type { ModelServiceTierValue, ReasoningEffortValue } from "../../../../../foundation/index.js";

export interface CodexAccountOutDto {
  authenticated: boolean;
  authMode: string | null;
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
}

export interface CodexRuntimeInfoOutDto {
  source: "bundled" | "downloaded";
  version: string;
}

export interface CodexHarnessStatusOutDto {
  connected: boolean;
  account: CodexAccountOutDto;
  error: string | null;
  runtime: CodexRuntimeInfoOutDto | null;
}

export interface CodexLoginResponseOutDto {
  loginId: string;
  authUrl: string;
}

export interface CodexApprovalOutDto {
  requestId: number;
  kind: "command" | "fileChange";
  title: string;
  reason: string | null;
  command: string | null;
  cwd: string | null;
  details: string | null;
  trustEligible: boolean;
}

export interface ResolveCodexApprovalOutDto {
  status: "resolved" | "expired";
  trusted: boolean;
}

export interface CodexUserInputOptionOutDto {
  label: string;
  description: string;
}

export interface CodexUserInputQuestionOutDto {
  id: string;
  header: string;
  question: string;
  options: CodexUserInputOptionOutDto[];
}

export interface CodexUserInputRequestOutDto {
  requestId: number;
  questions: CodexUserInputQuestionOutDto[];
}

export interface CodexModelOptionOutDto {
  id: string;
  displayName: string;
  provider: string | null;
  supportedReasoningEfforts: ReasoningEffortValue[];
  supportedServiceTiers: ModelServiceTierValue[];
  defaultReasoningEffort: ReasoningEffortValue | null;
  isDefault: boolean;
}

export interface CodexModelCatalogOutDto {
  models: CodexModelOptionOutDto[];
}
