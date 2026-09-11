import { ScreenshotEditor } from "../../../features/screenshot";
import type { ScreenshotApplicationViewModel } from "../model/createScreenshotApplicationViewModel";

type ScreenshotApplicationSectionProps = {
  /** 显示模型保证错误、加载和编辑状态互斥。 */
  viewModel: ScreenshotApplicationViewModel;
};

/** 根据 ViewModel 显示截图窗口当前唯一有效的页面状态。 */
export function ScreenshotApplicationSection({ viewModel }: ScreenshotApplicationSectionProps) {
  if (viewModel.state === "error") {
    return (
      <main className="screenshot-window-error" role="alert">
        <p>{viewModel.message}</p>
        <button type="button" onClick={viewModel.onClose}>{viewModel.closeLabel}</button>
      </main>
    );
  }

  if (viewModel.state === "loading") {
    return <main className="screenshot-window-loading" aria-label={viewModel.loadingLabel} />;
  }

  return (
    <ScreenshotEditor
      key={viewModel.editorKey}
      capture={viewModel.capture}
      locale={viewModel.locale}
      onCancel={viewModel.onCancel}
      onComplete={viewModel.onComplete}
    />
  );
}
