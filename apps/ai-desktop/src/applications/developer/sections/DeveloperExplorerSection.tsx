import { DeveloperExplorer } from "../explorer/DeveloperExplorer";
import { TaskExplorerFeature } from "../explorer/TaskExplorerFeature";
import type { DeveloperExplorerViewModel } from "../model/developerViewModelTypes";

type DeveloperExplorerSectionProps = {
  /** Explorer 显示模型只包含左侧任务导航需要的数据。 */
  viewModel: DeveloperExplorerViewModel;
};

/** 组合左侧导航外壳和跨模式任务入口。 */
export function DeveloperExplorerSection({ viewModel }: DeveloperExplorerSectionProps) {
  return (
    <DeveloperExplorer>
      <TaskExplorerFeature
        evolution={viewModel.evolution}
        expanded={viewModel.expanded}
        locale={viewModel.locale}
        auditTask={viewModel.auditTask}
        personaConversationActivities={viewModel.personaConversationActivities}
        controller={viewModel.collaboration}
        onToggle={viewModel.onToggle}
      />
    </DeveloperExplorer>
  );
}
