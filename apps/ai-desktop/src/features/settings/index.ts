/** 设置功能公开入口：统一对外提供设置页、运行诊断和工作区配置状态。 */

/** Developer 设置页：组装账号、模型、工作区、规则与诊断区域。 */
export { DeveloperSettingsFeature } from "./components/DeveloperSettingsFeature";
/** 桌面诊断控制器：读取数据库、临时文件、审计和信任命令状态。 */
export { useDesktopDiagnostics } from "./model/useDesktopDiagnostics";
/** 桌面设置控制器：读取并更新语言、模型和运行配置。 */
export { useDesktopSettings } from "./model/useDesktopSettings";
/** 设置展示转换器：供协作资源树显示审计状态。 */
export { auditStatusText } from "./model/settings-formatters";
