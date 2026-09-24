import type { DesktopSettingsOutDto } from "./settings.out.dto.js";

/** 设置读取结果把合法默认值和文件恢复失败分开，Renderer 据此决定是否应用语言。 */
export interface DesktopSettingsReadOutDto {
  settings: DesktopSettingsOutDto;
  source: "stored" | "default" | "recovered";
}
