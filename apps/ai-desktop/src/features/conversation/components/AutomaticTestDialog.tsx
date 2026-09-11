import { SelUiDialog } from "../../../theme/SelUiProvider";
import type { AutomaticTestDialogViewModel } from "../model/createCodexConversationViewModel";

type AutomaticTestDialogProps = {
  /** 显示模型包含最终标题、检查结果和关闭动作。 */
  viewModel: AutomaticTestDialogViewModel;
};

/** 自动测试阻断信息的纯 UI 对话框，不读取会话 Controller。 */
export function AutomaticTestDialog({ viewModel }: AutomaticTestDialogProps) {
  return (
    <SelUiDialog
      id="ai-desktop-automatic-test"
      open={viewModel.open}
      title={viewModel.title}
      kicker="AUTOMATIC TEST"
      dismissible
      size="compact"
      onRequestClose={viewModel.onClose}
    >
      {viewModel.open && (
        <>
          {/* 每项检查结果由自动测试 Controller 生成，组件只负责显示。 */}
          <ul className="seldialog-checks">
            {viewModel.checks.map((check) => (
              <li className={check.status} key={check.id}>
                <i />
                <span>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </span>
              </li>
            ))}
          </ul>
          <div className="seldialog-actions">
            <button data-sel-action="primary" onClick={viewModel.onClose}>
              {viewModel.closeLabel}
            </button>
          </div>
        </>
      )}
    </SelUiDialog>
  );
}
