// 集成发布门面串行化跨进程候选构建，避免多个任务同时改写稳定版本。
export { IntegrationReleaseCoordinatorFacade } from "./integration-release.facade.js";
import {
  acquireManagedDependencyLease,
  cleanupIntegrationDependencyLinks,
  ensureIntegrationDependencies,
  releaseManagedDependencyLease,
  verifyCandidateDelta,
  verifyCollaborationIntegration,
} from "./internal/integration.verifier.js";
export type { ManagedDependencyLease } from "./internal/integration.verifier.js";
import { ReleaseBatchStore } from "./internal/release-batch.store.js";
import { resolveVerifiedDeveloperExecutable, stageVerifiedDeveloperExecutable } from "./internal/verified-package.release.js";
import { VersionIntegrationPipeline } from "./internal/version-integration.pipeline.js";
import { VersionWorkspaceManager } from "./internal/version-workspace.manager.js";

// 工作区管理端口只保留发布流水线需要的行为，具体 Git 命令仍封装在 internal。
export type VersionWorkspacePort = VersionWorkspaceManager;
// 版本流水线端口供 Workflow 通知等待、调度和关闭，不允许人物直接拼接发布命令。
export type VersionIntegrationPort = VersionIntegrationPipeline;
// 发布批次端口只管理运行中与归档事实，不向 Renderer 暴露文件路径。
export type ReleaseBatchPort = ReleaseBatchStore;

// 组合根创建唯一工作区管理器，并把仓库根与受控 worktree 根明确注入。
export function createVersionWorkspaceManager(...arguments_: ConstructorParameters<typeof VersionWorkspaceManager>): VersionWorkspacePort {
  return new VersionWorkspaceManager(...arguments_);
}

// 组合根创建唯一版本流水线，人物和 IPC 只通过 Workflow 间接触发。
export function createVersionIntegrationPipeline(...arguments_: ConstructorParameters<typeof VersionIntegrationPipeline>): VersionIntegrationPort {
  return new VersionIntegrationPipeline(...arguments_);
}

// 批次仓库由发布能力自己创建，调用方不直接选择文件名或归档结构。
export function createReleaseBatchStore(...arguments_: ConstructorParameters<typeof ReleaseBatchStore>): ReleaseBatchPort {
  return new ReleaseBatchStore(...arguments_);
}

// 以下函数是发布能力对组合根提供的受控操作，不公开内部类和异常实现。
export {
  acquireManagedDependencyLease,
  cleanupIntegrationDependencyLinks,
  ensureIntegrationDependencies,
  releaseManagedDependencyLease,
  resolveVerifiedDeveloperExecutable,
  stageVerifiedDeveloperExecutable,
  verifyCandidateDelta,
  verifyCollaborationIntegration,
};
