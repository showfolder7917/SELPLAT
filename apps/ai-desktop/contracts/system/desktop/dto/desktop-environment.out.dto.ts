import type { AppVariantValue } from "../../../foundation/index.js";

/** 主进程暴露给桌面端的只读运行环境。 */
export interface DesktopEnvironmentOutDto {
  projectRoot: string;
  platform: string;
  variant: AppVariantValue;
}
