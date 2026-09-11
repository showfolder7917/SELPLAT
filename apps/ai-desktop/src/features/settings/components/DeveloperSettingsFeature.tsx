/**
 * Developer 设置区域的 Section。
 *
 * 协调 Controller 负责确认和桌面操作，ViewModel 负责显示转换，View 只渲染设置项。
 */

import { createDeveloperSettingsViewModel } from "../model/createDeveloperSettingsViewModel";
import { useDeveloperSettingsSectionController } from "../model/useDeveloperSettingsSectionController";
import type { DeveloperSettingsFeatureProps } from "./DeveloperSettingsFeature.types";
import { DeveloperSettingsView } from "./DeveloperSettingsView";

/** 连接设置输入、协调动作、显示模型和纯 View。 */
export function DeveloperSettingsFeature(props: DeveloperSettingsFeatureProps) {
  // Section Controller 只拥有确认窗口和桌面目录动作。
  const controller = useDeveloperSettingsSectionController(props);
  // ViewModel 将各业务 Controller 转换为按设置区块切分的简单输入。
  const viewModel = createDeveloperSettingsViewModel(props, controller);
  // 纯 View 不再读取 Controller 或 Desktop API。
  return <DeveloperSettingsView viewModel={viewModel} />;
}
