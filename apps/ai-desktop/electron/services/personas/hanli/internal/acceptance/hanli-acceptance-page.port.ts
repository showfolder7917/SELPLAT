/** 由主进程登记的正式窗口动作；模型不能扩大权限。 */
export type AcceptancePrivateAction = "persona-navigation" | "task-collaboration-scenario";

/** 页面适配器只询问动作是否已授权，不依赖工作流或人物运行时。 */
export interface PageReviewInteractionPort {
  allows(action: AcceptancePrivateAction): boolean;
  /** 场景只由正式验收器建立和回收，不能由 Renderer 或普通 IPC 请求。 */
  beginTaskCollaborationScenario?(goal: import("../../../../../../contracts/services/personas/hanli/index.js").HanliComputerAcceptanceInDto, window: import("electron").BrowserWindow): void;
  advanceTaskCollaborationScenario?(): void;
  endTaskCollaborationScenario?(): void;
}
