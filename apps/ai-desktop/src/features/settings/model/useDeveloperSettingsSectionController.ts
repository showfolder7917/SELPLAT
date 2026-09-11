import { getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";
import { useSelUi } from "../../../theme/SelUiProvider";
import type { DeveloperSettingsFeatureProps } from "../components/DeveloperSettingsFeature.types";

/** 设置 Section 的协调 Controller，只负责确认窗口和桌面操作。 */
export function useDeveloperSettingsSectionController(props: DeveloperSettingsFeatureProps) {
  // 危险清理操作统一使用 SELUI 确认窗口。
  const selUi = useSelUi();

  /** 确认后清理临时文件，并通知主会话移除已经失效的附件。 */
  async function clearTempFiles() {
    const confirmed = await selUi.confirm({
      title: props.text.clearTemp,
      message: props.text.clearConfirm,
      tone: "danger",
    });
    if (!confirmed) return;
    await props.diagnostics.clearTempFiles();
    props.onTempFilesCleared();
  }

  /** 确认后移除全部可信命令。 */
  async function clearTrustedCommands() {
    const confirmed = await selUi.confirm({
      title: props.text.clearTrustedCommands,
      message: props.text.clearTrustedConfirm,
      tone: "danger",
    });
    if (!confirmed) return;
    await props.diagnostics.clearTrustedCommands();
  }

  /** 确认后清空测试运行数据；人物会话、设置和源码继续保留。 */
  async function clearTestData(action: string, confirmMessage: string) {
    const confirmed = await selUi.confirm({
      title: action,
      message: confirmMessage,
      tone: "danger",
      confirmLabel: action,
    });
    if (!confirmed) return;
    await props.diagnostics.clearTestData();
  }

  /** 打开应用专属临时目录，不向页面暴露真实路径解析。 */
  function openTempDirectory() {
    void getOptionalSystemDesktopApi()?.openTempDirectory();
  }

  /** 打开业务日志目录，不向页面暴露真实路径解析。 */
  function openAuditLogDirectory() {
    void getOptionalSystemDesktopApi()?.openAuditLogDirectory();
  }

  return { clearTempFiles, clearTrustedCommands, clearTestData, openTempDirectory, openAuditLogDirectory };
}

/** 设置 ViewModel 只读取该协调 Controller 的具名动作。 */
export type DeveloperSettingsSectionController = ReturnType<typeof useDeveloperSettingsSectionController>;
