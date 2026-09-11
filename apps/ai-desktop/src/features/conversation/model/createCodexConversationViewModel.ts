import type { CodexConversationWorkspaceProps, CodexConversationWorkspaceText } from "../components/CodexConversationWorkspace.types";

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
  if (locale === "ja") {
    return {
      ready: "Codex harness 接続済み",
      signedOut: "ChatGPT にログインしてください",
      signIn: "ChatGPT でログイン",
      placeholder: "コード、調査、変更内容を入力（画像を貼り付け可能）",
      attachment: "画像添付",
      remove: "削除",
      screenshot: "現在の画面をキャプチャ",
      hiddenScreenshot: "AI Desktop を隠してキャプチャ",
      openSettings: "システム設定を開く",
      automaticTest: "自動テスト",
      checking: "自動テスト環境を確認中…",
      readyTest: "自動テスト環境の準備ができました",
      blocked: "自動テストを開始できません",
      close: "閉じる",
    };
  }

  return {
    ready: "Codex harness 已连接",
    signedOut: "请先登录 ChatGPT",
    signIn: "使用 ChatGPT 登录",
    placeholder: "输入代码、调查或修改任务（可粘贴截图）",
    attachment: "图片附件",
    remove: "移除",
    screenshot: "截取当前屏幕",
    hiddenScreenshot: "隐藏 AI Desktop 后截图",
    openSettings: "打开系统设置",
    automaticTest: "自动测试",
    checking: "正在检查自动测试环境…",
    readyTest: "自动测试环境已就绪",
    blocked: "自动测试开启失败",
    close: "知道了",
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
