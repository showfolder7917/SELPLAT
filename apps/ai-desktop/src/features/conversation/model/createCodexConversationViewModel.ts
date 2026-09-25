import type { CodexConversationWorkspaceProps, CodexConversationWorkspaceText } from "../components/CodexConversationWorkspace.types";
import { fixedUiText } from "../../../../contracts/foundation";

/** 自动测试阻断对话框需要的单项检查结果。 */
type AutomaticTestCheck = NonNullable<
  CodexConversationWorkspaceProps["controller"]["automaticTesting"]["dialog"]
>["checks"][number];

/** 自动测试阻断对话框的纯显示模型。 */
export type AutomaticTestDialogViewModel = {
  /** 没有阻断信息时保持对话框关闭。 */
  open: boolean;
  /** 对话框标题使用当前语言。 */
  title: string;
  /** 环境检查结果已经由测试控制器生成。 */
  checks: AutomaticTestCheck[];
  /** 关闭按钮使用当前语言。 */
  closeLabel: string;
  /** 关闭只清除对话框，不改变自动测试开关。 */
  onClose: () => void;
};

/** Codex 会话 Section 使用的显示模型。 */
export type CodexConversationViewModel = {
  /** 时间线和编辑区共享同一套已选语言文案。 */
  text: CodexConversationWorkspaceText;
  /** 自动测试阻断提示交给纯对话框组件。 */
  automaticTestDialog: AutomaticTestDialogViewModel;
};

/** 根据当前语言返回会话页面完整文案。 */
function createConversationText(locale: CodexConversationWorkspaceProps["locale"]): CodexConversationWorkspaceText {
  return {
    ready: fixedUiText(locale, "conversationReady"), signedOut: fixedUiText(locale, "signedOut"), signIn: fixedUiText(locale, "signIn"),
    placeholder: fixedUiText(locale, "conversationPlaceholder"), attachment: fixedUiText(locale, "attachment"), remove: fixedUiText(locale, "workspaceRemove"),
    screenshot: fixedUiText(locale, "conversationScreenshot"), hiddenScreenshot: fixedUiText(locale, "conversationHiddenScreenshot"), openSettings: fixedUiText(locale, "conversationOpenSettings"),
    automaticTest: fixedUiText(locale, "conversationAutomaticTest"), checking: fixedUiText(locale, "conversationChecking"), readyTest: fixedUiText(locale, "conversationReadyTest"), blocked: fixedUiText(locale, "conversationBlocked"), close: fixedUiText(locale, "close"),
  };
}

/** 把会话 Controller 中的显示状态转换为页面 ViewModel。 */
export function createCodexConversationViewModel(
  props: CodexConversationWorkspaceProps,
): CodexConversationViewModel {
  const text = createConversationText(props.locale);
  const automaticTesting = props.controller.automaticTesting;
  const dialog = automaticTesting.dialog;

  return {
    text,
    automaticTestDialog: {
      open: Boolean(dialog),
      title: text.blocked,
      checks: dialog?.checks || [],
      closeLabel: text.close,
      onClose: () => automaticTesting.setDialog(null),
    },
  };
}
