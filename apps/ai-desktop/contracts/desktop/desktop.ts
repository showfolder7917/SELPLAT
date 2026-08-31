/**
 * AI Desktop 应用私有协议兼容出口。
 * 新代码优先从所属领域文件导入，本文件只保持既有调用方的稳定迁移入口。
 */
export * from "../governance/audit.js";
export * from "../governance/approval-governance.js";
export * from "../foundation/base.js";
export * from "../platform/codex/index.js";
export * from "../platform/security/index.js";
export * from "../collaboration/workflow/index.js";
export * from "../capabilities/event-center/index.js";
export * from "../capabilities/release/index.js";
export * from "../capabilities/conversation/index.js";
export * from "../platform/persistence/index.js";
export * from "./desktop-api.js";
export * from "./capability-registry.js";
export * from "../collaboration/linghu/index.js";
export * from "../collaboration/evolution/index.js";
export type * from "../collaboration/nangong/index.js";
export type * from "../collaboration/hanli/index.js";
export * from "../capabilities/testing/index.js";
export * from "../platform/attachments/index.js";
export * from "../platform/settings/index.js";
export * from "../platform/workspace/index.js";
export * from "../governance/workflow.js";
export * from "../capabilities/rules/index.js";
