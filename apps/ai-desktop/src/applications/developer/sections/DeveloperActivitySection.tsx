import { DeveloperSettingsFeature } from "../../../features/settings";
import { TestConsoleFeature } from "../../../features/test-console";
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
      testConsoleControl={(
        <TestConsoleFeature
          locale={viewModel.settings.locale}
          open={viewModel.testConsoleOpen}
          onOpenChange={viewModel.onTestConsoleOpenChange}
          runtime={viewModel.status.runtime}
          modelCatalog={viewModel.settings.modelCatalog}
          modelCatalogLoaded={viewModel.settings.modelCatalogLoaded}
          modelCatalogLoading={viewModel.settings.modelCatalogLoading}
          modelCatalogError={viewModel.settings.modelSettingsError}
          audit={viewModel.diagnostics.auditInfo}
          collaboration={viewModel.collaborationState}
          evolution={viewModel.evolutionState}
        />
      )}
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
