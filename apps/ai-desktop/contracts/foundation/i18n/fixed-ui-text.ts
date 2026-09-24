import type { LocaleValue } from "../value/base.value.js";

/** 固定界面资源的稳定键；用户输入、历史正文与技术异常不得使用这些键。 */
export type FixedUiTextKey =
  | "language" | "languageSaving" | "languageSaveFailed" | "retry" | "dismiss"
  | "settingsReadRecovered" | "screenshotSettingsReadTitle" | "screenshotSettingsReadDetail"
  | "close" | "technicalDetails" | "loadingScreenshot" | "missingText"
  | "managedModeConversation" | "managedModeRequirement" | "managedModeTask" | "managedModeTest"
  | "managedStageConfirmIntent" | "managedStageExecutePlan" | "managedStageTest" | "managedStageRetest"
  | "managedStageReanalyze" | "managedStageRerun"
  | "streamProcess" | "streamActivityCount" | "streamChangedFiles"
  | "streamActivityReasoning" | "streamActivityCommandExecution" | "streamActivityCommandPolicy"
  | "streamActivityFileChange" | "streamActivityMcpToolCall" | "streamActivityDynamicToolCall"
  | "streamActivityCollabToolCall" | "streamActivityWebSearch" | "streamActivityImageView"
  | "streamActivityContextCompaction" | "streamActivityAgentMessage" | "streamUnknownActivity"
  | "streamStarting" | "streamInProgress" | "streamPlanning" | "streamReasoning"
  | "streamResponding" | "streamCommandExecution" | "streamFileChange"
  | "streamInterrupted" | "streamFailed" | "streamCompleted" | "streamConversationCompleted"
  | "streamRequirementCompleted" | "streamTaskCompleted" | "streamTestCompleted"
  | "screenshotSelect" | "screenshotSelectHint" | "screenshotAnnotate" | "screenshotDone"
  | "screenshotPen" | "screenshotRectangle" | "screenshotUndo" | "screenshotClear"
  | "screenshotClearConfirm" | "screenshotCancel" | "screenshotBack" | "screenshotSaving"
  | "screenshotLoadFailed" | "screenshotSaveFailed" | "screenshotWindowControl"
  | "screenshotCapturedScreen" | "screenshotResizeAnnotation"
  | "workspaceFilePreview" | "workspaceCloseFilePreview" | "workspaceCopyContent"
  | "workspaceContentCopied" | "workspaceCopyFailed";

const FIXED_UI_TEXT: Record<LocaleValue, Partial<Record<FixedUiTextKey, string>>> = {
  "zh-CN": {
    language: "语言", languageSaving: "正在保存语言设置…", languageSaveFailed: "无法保存语言设置，请重试。",
    retry: "重试", dismiss: "关闭", settingsReadRecovered: "无法读取已保存的设置，已暂时使用简体中文。",
    screenshotSettingsReadTitle: "无法读取语言设置", screenshotSettingsReadDetail: "截图窗口暂时使用简体中文。",
    close: "关闭", technicalDetails: "技术详情", loadingScreenshot: "正在载入截图…", missingText: "缺少固定界面文案",
    managedModeConversation: "理解意图", managedModeRequirement: "分析方案", managedModeTask: "执行修改", managedModeTest: "验证结果",
    managedStageConfirmIntent: "就是这意思", managedStageExecutePlan: "按这个方案执行", managedStageTest: "测试一下", managedStageRetest: "重新测试",
    managedStageReanalyze: "重新分析需求", managedStageRerun: "重新执行",
    streamProcess: "执行过程", streamActivityCount: "{count} 项", streamChangedFiles: "已涉及 {count} 个文件",
    streamActivityReasoning: "正在分析", streamActivityCommandExecution: "执行命令", streamActivityCommandPolicy: "执行策略",
    streamActivityFileChange: "修改文件", streamActivityMcpToolCall: "调用工具", streamActivityDynamicToolCall: "执行工具",
    streamActivityCollabToolCall: "协作处理", streamActivityWebSearch: "搜索网页", streamActivityImageView: "查看图片",
    streamActivityContextCompaction: "整理会话", streamActivityAgentMessage: "生成回答", streamUnknownActivity: "未知执行项",
    streamStarting: "正在启动 Codex…", streamInProgress: "Codex 正在处理…", streamPlanning: "正在更新计划…",
    streamReasoning: "正在分析…", streamResponding: "正在生成回答…", streamCommandExecution: "正在执行命令…", streamFileChange: "正在修改文件…",
    streamInterrupted: "已中断", streamFailed: "执行失败", streamCompleted: "已完成", streamConversationCompleted: "意图分析完成",
    streamRequirementCompleted: "需求分析完成", streamTaskCompleted: "执行与代码验证完成", streamTestCompleted: "测试完成",
    screenshotSelect: "选择截图区域", screenshotSelectHint: "拖动鼠标框选需要截取的区域", screenshotAnnotate: "红色标注", screenshotDone: "完成",
    screenshotPen: "画笔", screenshotRectangle: "方框", screenshotUndo: "撤销", screenshotClear: "清空绘画框",
    screenshotClearConfirm: "确定清空全部红色绘画标注吗？", screenshotCancel: "取消", screenshotBack: "返回", screenshotSaving: "正在保存…",
    screenshotLoadFailed: "无法载入截图。", screenshotSaveFailed: "无法保存截图。", screenshotWindowControl: "最大化或还原窗口",
    screenshotCapturedScreen: "已捕获的屏幕", screenshotResizeAnnotation: "调整红框-{handle}",
    workspaceFilePreview: "文件预览", workspaceCloseFilePreview: "关闭文件预览", workspaceCopyContent: "复制完整内容",
    workspaceContentCopied: "已复制文件内容。", workspaceCopyFailed: "无法复制文件内容。",
  },
  ja: {
    language: "言語", languageSaving: "言語設定を保存しています…", languageSaveFailed: "言語設定を保存できません。もう一度お試しください。",
    retry: "再試行", dismiss: "閉じる", settingsReadRecovered: "保存済みの設定を読み込めないため、一時的に簡体字中国語を使用しています。",
    screenshotSettingsReadTitle: "言語設定を読み込めません", screenshotSettingsReadDetail: "スクリーンショットウィンドウは一時的に簡体字中国語を使用しています。",
    close: "閉じる", technicalDetails: "技術詳細", loadingScreenshot: "スクリーンショットを読み込んでいます…", missingText: "固定画面文言がありません",
    managedModeConversation: "意図を確認", managedModeRequirement: "案を整理", managedModeTask: "変更を実行", managedModeTest: "結果を検証",
    managedStageConfirmIntent: "この意図で合っています", managedStageExecutePlan: "この案で実行", managedStageTest: "テストする", managedStageRetest: "再テスト",
    managedStageReanalyze: "要件を再分析", managedStageRerun: "再実行",
    streamProcess: "実行プロセス", streamActivityCount: "{count} 件", streamChangedFiles: "変更ファイル {count}",
    streamActivityReasoning: "分析中", streamActivityCommandExecution: "コマンド実行", streamActivityCommandPolicy: "実行ポリシー",
    streamActivityFileChange: "ファイル変更", streamActivityMcpToolCall: "ツール呼び出し", streamActivityDynamicToolCall: "ツール実行",
    streamActivityCollabToolCall: "エージェント連携", streamActivityWebSearch: "Web 検索", streamActivityImageView: "画像確認",
    streamActivityContextCompaction: "会話整理", streamActivityAgentMessage: "回答作成", streamUnknownActivity: "不明な実行項目",
    streamStarting: "Codex を開始しています…", streamInProgress: "Codex が処理中…", streamPlanning: "計画を更新しています…",
    streamReasoning: "分析中…", streamResponding: "回答を生成しています…", streamCommandExecution: "コマンドを実行しています…", streamFileChange: "ファイルを変更しています…",
    streamInterrupted: "中断しました", streamFailed: "失敗しました", streamCompleted: "完了しました", streamConversationCompleted: "意図の分析が完了しました",
    streamRequirementCompleted: "要件分析が完了しました", streamTaskCompleted: "実行とコード検証が完了しました", streamTestCompleted: "テストが完了しました",
    screenshotSelect: "範囲を選択", screenshotSelectHint: "ドラッグして切り取る範囲を選択してください", screenshotAnnotate: "赤で注釈", screenshotDone: "完了",
    screenshotPen: "ペン", screenshotRectangle: "四角", screenshotUndo: "元に戻す", screenshotClear: "描画をすべて消去",
    screenshotClearConfirm: "すべての赤い注釈を消去しますか？", screenshotCancel: "キャンセル", screenshotBack: "戻る", screenshotSaving: "保存中…",
    screenshotLoadFailed: "スクリーンショットを読み込めません。", screenshotSaveFailed: "スクリーンショットを保存できません。", screenshotWindowControl: "ウィンドウを最大化または復元",
    screenshotCapturedScreen: "取得した画面", screenshotResizeAnnotation: "注釈を調整 {handle}",
    workspaceFilePreview: "ファイルプレビュー", workspaceCloseFilePreview: "ファイルプレビューを閉じる", workspaceCopyContent: "内容をコピー",
    workspaceContentCopied: "ファイル内容をコピーしました。", workspaceCopyFailed: "ファイル内容をコピーできませんでした。",
  },
  en: {
    language: "Language", languageSaving: "Saving language settings…", languageSaveFailed: "Language settings could not be saved. Please try again.",
    retry: "Retry", dismiss: "Dismiss", settingsReadRecovered: "Saved settings could not be read. Simplified Chinese is in use temporarily.",
    screenshotSettingsReadTitle: "Language settings could not be read", screenshotSettingsReadDetail: "The screenshot window is using Simplified Chinese temporarily.",
    close: "Close", technicalDetails: "Technical details", loadingScreenshot: "Loading screenshot…", missingText: "Missing fixed UI text",
    managedModeConversation: "Understand intent", managedModeRequirement: "Analyze plan", managedModeTask: "Apply changes", managedModeTest: "Verify results",
    managedStageConfirmIntent: "This is what I mean", managedStageExecutePlan: "Apply this plan", managedStageTest: "Run tests", managedStageRetest: "Run tests again",
    managedStageReanalyze: "Analyze requirements again", managedStageRerun: "Run again",
    streamProcess: "Execution process", streamActivityCount: "{count} items", streamChangedFiles: "{count} changed files",
    streamActivityReasoning: "Analyzing", streamActivityCommandExecution: "Running command", streamActivityCommandPolicy: "Command policy",
    streamActivityFileChange: "Changing files", streamActivityMcpToolCall: "Calling tool", streamActivityDynamicToolCall: "Running tool",
    streamActivityCollabToolCall: "Collaborating", streamActivityWebSearch: "Searching the web", streamActivityImageView: "Viewing image",
    streamActivityContextCompaction: "Compacting conversation", streamActivityAgentMessage: "Writing response", streamUnknownActivity: "Unknown execution item",
    streamStarting: "Starting Codex…", streamInProgress: "Codex is working…", streamPlanning: "Updating plan…",
    streamReasoning: "Analyzing…", streamResponding: "Writing response…", streamCommandExecution: "Running command…", streamFileChange: "Changing files…",
    streamInterrupted: "Interrupted", streamFailed: "Execution failed", streamCompleted: "Completed", streamConversationCompleted: "Intent analysis completed",
    streamRequirementCompleted: "Requirements analysis completed", streamTaskCompleted: "Changes and code validation completed", streamTestCompleted: "Tests completed",
    screenshotSelect: "Select area", screenshotSelectHint: "Drag to select the area to capture", screenshotAnnotate: "Annotate in red", screenshotDone: "Done",
    screenshotPen: "Pen", screenshotRectangle: "Rectangle", screenshotUndo: "Undo", screenshotClear: "Clear annotations",
    screenshotClearConfirm: "Clear all red annotations?", screenshotCancel: "Cancel", screenshotBack: "Back", screenshotSaving: "Saving…",
    screenshotLoadFailed: "Screenshot image could not be loaded.", screenshotSaveFailed: "Screenshot could not be saved.", screenshotWindowControl: "Maximize or restore window",
    screenshotCapturedScreen: "Captured screen", screenshotResizeAnnotation: "Resize annotation {handle}",
    workspaceFilePreview: "File preview", workspaceCloseFilePreview: "Close file preview", workspaceCopyContent: "Copy full content",
    workspaceContentCopied: "File content copied.", workspaceCopyFailed: "File content could not be copied.",
  },
};

const CONTROLLED_MISSING_TEXT = "缺少固定界面文案";

/** 按当前语言、简体中文和受控诊断顺序解析固定界面文案。 */
export function fixedUiText(locale: LocaleValue, key: FixedUiTextKey): string {
  return FIXED_UI_TEXT[locale]?.[key]
    || FIXED_UI_TEXT["zh-CN"][key]
    || `[${FIXED_UI_TEXT["zh-CN"].missingText || CONTROLLED_MISSING_TEXT}: ${key}]`;
}
