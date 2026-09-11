import {
  // ArrowClockwise24Regular 统一表示“重新建立当前页签会话”。
  ArrowClockwise24Regular,
} from "@fluentui/react-icons";

type DeveloperWorkspaceTabActionProps = {
  /** 无障碍名称同时作为 SELUI 工具提示显示。 */
  label: string;
  /** 请求执行期间禁用按钮，避免重复建立会话。 */
  disabled?: boolean;
  /** busy 为真时只改变图标动画，不改变按钮语义。 */
  busy?: boolean;
  /** 点击事件由对应人物或会话 Controller 提供。 */
  onClick(): void;
};

/** 页签右上角的纯 UI 新建会话按钮。 */
export function DeveloperWorkspaceTabAction({
  label,
  disabled = false,
  busy = false,
  onClick,
}: DeveloperWorkspaceTabActionProps) {
  return (
    <button
      type="button"
      className="tab-new-task"
      data-sel-tooltip={label}
      data-sel-tooltip-mode="always"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <ArrowClockwise24Regular className={busy ? "screenshot-spinner" : undefined} />
    </button>
  );
}
