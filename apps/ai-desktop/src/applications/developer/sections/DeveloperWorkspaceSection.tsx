import { AiMemoryRecoveryBanner } from "../components/AiMemoryRecoveryBanner";
import type { DeveloperWorkspaceViewModel } from "../model/developerViewModelTypes";
import { DeveloperWorkspace } from "../workspace/DeveloperWorkspace";
import { DeveloperWorkspaceRouter } from "../workspace/DeveloperWorkspaceRouter";

type DeveloperWorkspaceSectionProps = {
  /** 工作区显示模型包含可选恢复提示和页面路由输入。 */
  viewModel: DeveloperWorkspaceViewModel;
};

/** 组合右侧内容舞台、数据库恢复提示和真实页面路由。 */
export function DeveloperWorkspaceSection({ viewModel }: DeveloperWorkspaceSectionProps) {
  return (
    <DeveloperWorkspace>
      {/* 数据库正常时 ViewModel 返回 null，因此页面不会创建空提示节点。 */}
      {viewModel.memoryRecovery && (
        <AiMemoryRecoveryBanner viewModel={viewModel.memoryRecovery} />
      )}

      {/* 路由仍然是右侧页面所有权的唯一入口。 */}
      <DeveloperWorkspaceRouter
        locale={viewModel.router.locale}
        sandboxMode={viewModel.router.sandboxMode}
        workspaces={viewModel.router.workspaces}
        collaboration={viewModel.router.collaboration}
        codex={viewModel.router.codex}
        evolution={viewModel.router.evolution}
        hanli={viewModel.router.hanli}
        nangong={viewModel.router.nangong}
        screenshot={viewModel.router.screenshot}
      />
    </DeveloperWorkspace>
  );
}
