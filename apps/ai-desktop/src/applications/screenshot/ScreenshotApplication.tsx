/** 独立截图窗口的总装配入口，只连接 Controller、ViewModel 和页面 Section。 */

import { createScreenshotApplicationViewModel } from "./model/createScreenshotApplicationViewModel";
import { useScreenshotApplicationController } from "./model/useScreenshotApplicationController";
import { ScreenshotApplicationSection } from "./sections/ScreenshotApplicationSection";

// 独立懒加载窗口必须自己加载所需样式，不能依赖 Developer 窗口先启动。
import "../styles/desktop-applications.css";

/** 按 Controller → ViewModel → Section 装配真实截图窗口。 */
export function ScreenshotApplication() {
  // Controller 接收主进程画面并负责保存或取消。
  const controller = useScreenshotApplicationController();
  // ViewModel 将运行状态转换为错误、加载或编辑三种互斥页面。
  const viewModel = createScreenshotApplicationViewModel(controller);
  // Section 只根据显示模型选择当前可见页面。
  return <ScreenshotApplicationSection viewModel={viewModel} />;
}
