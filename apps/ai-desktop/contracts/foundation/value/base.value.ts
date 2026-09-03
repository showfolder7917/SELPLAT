/**
 * AI Desktop 跨进程协议的基础值对象。
 *
 * 生产者：Electron 主进程配置、preload 白名单和 Renderer 设置界面。
 * 消费者：desktop、codex、collaboration 与 governance 各协议域。
 * 数据方向：main <-> preload <-> renderer。
 * 本文件只定义无运行时依赖的稳定枚举和值对象，禁止访问 Electron、React、文件系统或数据库。
 */
/** 应用可启动的产品形态；当前只允许进入开发者工作台。 */
export const APP_VARIANTS = ["developer"] as const;
/** 界面文案、日期格式和 AI 回复可使用的语言区域。 */
export const LOCALES = ["ja", "zh-CN"] as const;
/** Codex 执行命令时可采用的文件系统沙箱级别。 */
export const SANDBOX_MODES = ["read-only", "workspace-write"] as const;
/** 单个已注册工作区允许只读访问或写入的授权级别。 */
export const WORKSPACE_PERMISSIONS = ["read-only", "workspace-write"] as const;
/** 模型从不启用推理到最大推理深度的可选强度等级。 */
export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
/** 模型请求使用标准服务或快速服务的可选层级。 */
export const MODEL_SERVICE_TIERS = ["default", "fast"] as const;
/** 对话从普通交流依次进入需求、任务和测试托管阶段时使用的执行模式。 */
export const MANAGED_EXECUTION_MODES = ["conversation-managed", "requirement-managed", "task-managed", "test-managed"] as const;
/** Renderer 可经由桌面桥接请求主窗口执行的系统操作。 */
export const WINDOW_ACTIONS = ["minimize", "maximize", "close"] as const;

/** 应用变体值；类型和值域始终与 APP_VARIANTS 保持一致。 */
export type AppVariantValue = (typeof APP_VARIANTS)[number];
/** 语言区域值；用于约束跨进程传递的界面与回复语言。 */
export type LocaleValue = (typeof LOCALES)[number];
/** 沙箱模式值；用于约束一次 Codex 执行可触达的文件系统范围。 */
export type SandboxModeValue = (typeof SANDBOX_MODES)[number];
/** 工作区权限值；用于约束某个已注册目录是否允许写入。 */
export type WorkspacePermissionValue = (typeof WORKSPACE_PERMISSIONS)[number];
/** 推理强度值；用于设置或回显模型实际支持的推理等级。 */
export type ReasoningEffortValue = (typeof REASONING_EFFORTS)[number];
/** 模型服务层级值；用于在标准响应和快速响应之间选择。 */
export type ModelServiceTierValue = (typeof MODEL_SERVICE_TIERS)[number];
/** 托管执行模式值；用于记录当前对话处于交流、需求、任务或测试阶段。 */
export type ManagedExecutionModeValue = (typeof MANAGED_EXECUTION_MODES)[number];
/** 窗口操作值；用于限制跨进程窗口控制请求只能执行白名单动作。 */
export type WindowActionValue = (typeof WINDOW_ACTIONS)[number];
