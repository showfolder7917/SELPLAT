import { useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { LocaleValue } from "../../../../contracts/system/desktop/index";

/** 侧栏宽度边界：既保证导航文字可读，也避免挤占右侧工作区。 */
const MINIMUM_WIDTH = 220;
const MAXIMUM_WIDTH = 520;
const DEFAULT_WIDTH = 260;

/** 把拖动得到的宽度限制在允许范围内。 */
function clampWidth(width: number): number {
  return Math.max(MINIMUM_WIDTH, Math.min(MAXIMUM_WIDTH, width));
}

/** 根据语言和当前状态生成侧栏开关说明。 */
function getToggleLabel(locale: LocaleValue, collapsed: boolean): string {
  if (locale === "ja") return collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ";
  return collapsed ? "展开侧栏" : "折叠侧栏";
}

/** 集中管理左侧栏的显示、宽度、鼠标拖动和键盘操作。 */
export function useDeveloperSidebar(locale: LocaleValue) {
  // 收起侧栏时不卸载内部任务，避免正在执行的状态丢失。
  const [collapsed, setCollapsed] = useState(false);
  // 当前宽度同时提供给 CSS Grid 和拖动分隔线。
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  // CSS 自定义属性让外壳网格直接使用当前宽度。
  const shellStyle = { "--sidebar-width": `${width}px` } as CSSProperties;

  /** 在展开和收起状态之间切换。 */
  function toggle() {
    setCollapsed((current) => !current);
  }

  /** 指针拖动期间根据横向移动距离实时更新侧栏宽度。 */
  function resizeWithPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;
    // 捕获指针后，即使鼠标离开细分隔线也可以继续拖动。
    handle.setPointerCapture(event.pointerId);

    const move = (nextEvent: PointerEvent) => {
      const movedWidth = startWidth + nextEvent.clientX - startX;
      setWidth(clampWidth(movedWidth));
    };

    // 一次拖动结束后清理临时监听器，防止重复注册。
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  /** Home 恢复默认宽度，左右方向键按固定步长调整。 */
  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      setWidth(DEFAULT_WIDTH);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -16 : 16;
    setWidth((current) => clampWidth(current + direction));
  }

  // 调用方只接触页面真正需要的状态和事件。
  return {
    collapsed,
    width,
    shellStyle,
    toggleLabel: getToggleLabel(locale, collapsed),
    minimumWidth: MINIMUM_WIDTH,
    maximumWidth: MAXIMUM_WIDTH,
    toggle,
    resizeWithPointer,
    resizeWithKeyboard,
    resetWidth: () => setWidth(DEFAULT_WIDTH),
  };
}
