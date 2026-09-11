import type { AiMemoryRecoveryViewModel } from "../model/developerViewModelTypes";

type AiMemoryRecoveryBannerProps = {
  /** 恢复提示模型已经包含最终状态、标题和说明。 */
  viewModel: AiMemoryRecoveryViewModel;
};

/** 显示 AI Memory 数据库异常提示，不读取诊断控制器。 */
export function AiMemoryRecoveryBanner({ viewModel }: AiMemoryRecoveryBannerProps) {
  return (
    <div className={`ai-memory-recovery ${viewModel.state}`} role="alert">
      <strong>{viewModel.title}</strong>
      <span>{viewModel.message}</span>
    </div>
  );
}
