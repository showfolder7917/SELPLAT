/** Renderer 规则领域入口；从这里可依次追到同名 Contract、preload、IPC 和 Rule Facade。 */
import type { RulesDesktopApi } from "../../../../contracts/system/desktop/index";
import { getDesktopApi, getOptionalDesktopApi } from "../desktop-api";

/** 返回必需的规则桥接；正式规则页面缺少 preload 时立即给出稳定错误。 */
export function getRulesDesktopApi(): RulesDesktopApi {
  return getDesktopApi();
}

/** 返回可选规则桥接，只用于允许桌面能力暂时缺失的初始化边界。 */
export function getOptionalRulesDesktopApi(): RulesDesktopApi | undefined {
  return getOptionalDesktopApi();
}
