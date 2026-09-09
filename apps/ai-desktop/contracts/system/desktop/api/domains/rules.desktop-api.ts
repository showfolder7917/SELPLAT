/**
 * 规则管理跨进程 API 的唯一领域视图。
 *
 * 调用链：Renderer rules feature -> rules desktop adapter -> rules preload bridge
 * -> rules IPC -> ActiveUserRuleFacade。
 */
import type { DesktopApi } from "../desktop.api.js";

/** 规则领域允许跨进程调用的方法；新增规则能力时从本清单开始向两端接线。 */
export const RULES_DESKTOP_API_METHODS = [
  "getRuleBundleStatus",
  "listEffectiveRules",
  "resolveEffectiveRule",
] as const satisfies readonly (keyof DesktopApi)[];

/** Renderer 规则模块只能取得这些只读能力。 */
export type RulesDesktopApi = Pick<DesktopApi, (typeof RULES_DESKTOP_API_METHODS)[number]>;
