/** Developer 左侧栏的运行模式开关，只发出选择结果，不保存业务状态。 */

import type {
  // 界面语言决定两个模式按钮使用中文还是日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";

type OperatingMode = "single-conversation" | "collaboration";

type OperatingModeSwitchProps = {
  /** 当前是否处于多人协同模式。 */
  collaborationMode: boolean;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 用户选择模式后，由上层控制器写入主进程并回传真实状态。 */
  onModeChange: (mode: OperatingMode) => void;
};

/** 运行模式开关让用户在普通 Codex 会话和多人协同导航之间切换。 */
export function OperatingModeSwitch({
  collaborationMode,
  locale,
  onModeChange,
}: OperatingModeSwitchProps) {
  const selectSingleConversation = () => onModeChange("single-conversation");
  const selectCollaboration = () => onModeChange("collaboration");

  return (
    <div className="operating-mode-switch" role="group" aria-label={locale === "ja" ? "実行モード" : "运行模式"}>
      <button
        type="button"
        className={!collaborationMode ? "active" : ""}
        aria-pressed={!collaborationMode}
        onClick={selectSingleConversation}
      >
        {locale === "ja" ? "単一会話" : "单会话"}
      </button>
      <button
        type="button"
        className={collaborationMode ? "active" : ""}
        aria-pressed={collaborationMode}
        onClick={selectCollaboration}
      >
        {locale === "ja" ? "協同" : "协同模式"}
      </button>
    </div>
  );
}
