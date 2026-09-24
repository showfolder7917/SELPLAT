import type { LocaleValue } from "../value/base.value.js";

/** 固定界面资源的稳定键；用户输入、历史正文与技术异常不得使用这些键。 */
export type FixedUiTextKey =
  | "language" | "languageSaving" | "languageSaveFailed" | "retry" | "dismiss"
  | "settingsReadRecovered" | "screenshotSettingsReadTitle" | "screenshotSettingsReadDetail"
  | "close" | "technicalDetails" | "loadingScreenshot" | "missingText";

const FIXED_UI_TEXT: Record<LocaleValue, Partial<Record<FixedUiTextKey, string>>> = {
  "zh-CN": {
    language: "语言", languageSaving: "正在保存语言设置…", languageSaveFailed: "无法保存语言设置，请重试。",
    retry: "重试", dismiss: "关闭", settingsReadRecovered: "无法读取已保存的设置，已暂时使用简体中文。",
    screenshotSettingsReadTitle: "无法读取语言设置", screenshotSettingsReadDetail: "截图窗口暂时使用简体中文。",
    close: "关闭", technicalDetails: "技术详情", loadingScreenshot: "正在加载截图", missingText: "缺少固定界面文案",
  },
  ja: {
    language: "言語", languageSaving: "言語設定を保存中…", languageSaveFailed: "言語設定を保存できません。再試行してください。",
    retry: "再試行", dismiss: "閉じる", settingsReadRecovered: "保存済み設定を読み取れないため、簡体字中国語を一時使用しています。",
    screenshotSettingsReadTitle: "言語設定を読み取れません", screenshotSettingsReadDetail: "スクリーンショット画面は簡体字中国語を一時使用しています。",
    close: "閉じる", technicalDetails: "技術詳細", loadingScreenshot: "スクリーンショットを読み込み中", missingText: "固定 UI 文言がありません",
  },
  en: {
    language: "Language", languageSaving: "Saving language setting…", languageSaveFailed: "Unable to save the language setting. Please retry.",
    retry: "Retry", dismiss: "Dismiss", settingsReadRecovered: "Saved settings could not be read. Simplified Chinese is being used temporarily.",
    screenshotSettingsReadTitle: "Unable to read language settings", screenshotSettingsReadDetail: "The screenshot window is using Simplified Chinese temporarily.",
    close: "Close", technicalDetails: "Technical details", loadingScreenshot: "Loading screenshot", missingText: "Fixed UI text is missing",
  },
};

/** 按当前语言、简体中文和受控诊断顺序解析固定界面文案。 */
export function fixedUiText(locale: LocaleValue, key: FixedUiTextKey): string {
  return FIXED_UI_TEXT[locale][key]
    || FIXED_UI_TEXT["zh-CN"][key]
    || `[${FIXED_UI_TEXT["zh-CN"].missingText || "missing fixed UI text"}: ${key}]`;
}
