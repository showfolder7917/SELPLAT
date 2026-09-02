// 规则能力以 Facade 名称公开，规则工作区和归档文件布局继续留在模块内部。
export { ActiveUserRuleFacade } from "./active-user-rule.facade.js";
export type { AiDesktopRuleRole, TaskRuleSnapshot } from "./active-user-rule.facade.js";
export { RuleWorkspaceFacade } from "./rule-workspace.facade.js";
export type { RuleWorkspaceDescriptor } from "./rule-workspace.facade.js";
export { RulePackageArchiveFacade } from "./rule-package-archive.js";
export type { RuleRevisionDescriptor } from "./rule-package-archive.js";
export { DisabledRulePackageUploader, RulePackageUploadCoordinator } from "./rule-package-upload.js";
export type { RulePackageUploader, RulePackageUploadRequest, RulePackageUploadReceipt } from "./rule-package-upload.js";
