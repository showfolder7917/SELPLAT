/**
 * AI Desktop 跨进程协议的基础值对象。
 *
 * 生产者：Electron 主进程配置、preload 白名单和 Renderer 设置界面。
 * 消费者：desktop、codex、collaboration 与 governance 各协议域。
 * 数据方向：main <-> preload <-> renderer。
 * 本文件只定义无运行时依赖的稳定枚举和值对象，禁止访问 Electron、React、文件系统或数据库。
 */
export const APP_VARIANTS = ["developer"] as const;
export const LOCALES = ["ja", "zh-CN"] as const;
export const SANDBOX_MODES = ["read-only", "workspace-write"] as const;
export const WORKSPACE_PERMISSIONS = ["read-only", "workspace-write"] as const;
export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export const MODEL_SERVICE_TIERS = ["default", "fast"] as const;

export type AppVariant = (typeof APP_VARIANTS)[number];
export type Locale = (typeof LOCALES)[number];
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export type ModelServiceTier = (typeof MODEL_SERVICE_TIERS)[number];
export type ManagedExecutionMode = "conversation-managed" | "requirement-managed" | "task-managed" | "test-managed";
export type WindowAction = "minimize" | "maximize" | "close";

export interface DesktopEnvironment {
  projectRoot: string;
  platform: string;
  variant: AppVariant;
}
