/**
 * Renderer 进入 Event Center 的受限异常报告。
 *
 * 生产者：Renderer 全局错误边界与 React Error Boundary。
 * 消费者：DesktopApi、IPC handler 和 EventCenterFacade。
 * 数据方向：Renderer -> preload -> main -> Event Center。
 * 本 DTO 禁止携带 Electron 对象、任意附件或未裁剪的运行时上下文。
 */
export interface RendererExceptionInDto {
  operation: "window.error" | "window.unhandledrejection" | "react.error-boundary";
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  url?: string | null;
}
