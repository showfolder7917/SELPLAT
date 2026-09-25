import type { DesktopSettingsOutDto } from "./settings.out.dto.js";

/** 设置读取结果把合法默认值和文件恢复失败分开，Renderer 据此决定是否应用语言。 */
export interface DesktopSettingsReadOutDto {
  settings: DesktopSettingsOutDto;
  source: "stored" | "default" | "recovered";
  /** 恢复默认设置时保留的原始读取或解析错误；固定界面只在技术详情中展示。 */
  recoveryError: string | null;
}
