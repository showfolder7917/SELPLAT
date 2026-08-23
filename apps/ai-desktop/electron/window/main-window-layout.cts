/** 正式窗口和隔离桌面测试共用同一尺寸事实，禁止测试单独复制一套浏览器窗口大小。 */
export const MAIN_WINDOW_LAYOUT = {
  developer: { width: 1560, height: 980 },
  office: { width: 1440, height: 960 },
  minimum: { width: 1000, height: 700 },
} as const;

/** 根据真实应用变体返回正式初始尺寸，测试和生产窗口调用结果完全相同。 */
export function mainWindowInitialSize(variant: "developer" | "office"): { width: number; height: number } {
  return MAIN_WINDOW_LAYOUT[variant];
}
