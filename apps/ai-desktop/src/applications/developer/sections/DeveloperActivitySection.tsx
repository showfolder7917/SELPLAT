import { DeveloperSettingsFeature } from "../../../features/settings";
import { DeveloperActivityBar } from "../layout/DeveloperActivityBar";
import type { DeveloperActivityViewModel } from "../model/developerViewModelTypes";

type DeveloperActivitySectionProps = {
  /** 活动栏显示模型只包含设置入口需要的状态和动作。 */
  viewModel: DeveloperActivityViewModel;
};

/** 组合最左侧活动栏及其设置浮层入口。 */
export function DeveloperActivitySection({ viewModel }: DeveloperActivitySectionProps) {
  return (
    <DeveloperActivityBar
      settingsControl={(
        <DeveloperSettingsFeature
          open={viewModel.open}
          onOpenChange={viewModel.onOpenChange}
          status={viewModel.status}
          loginHint={viewModel.loginHint}
          text={viewModel.text}
          settings={viewModel.settings}
          diagnostics={viewModel.diagnostics}
          workspace={viewModel.workspace}
          onLogin={viewModel.onLogin}
          onLogout={viewModel.onLogout}
          onTempFilesCleared={viewModel.onTempFilesCleared}
        />
      )}
    />
  );
}
