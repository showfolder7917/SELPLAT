/** 由主进程登记的正式窗口动作；模型不能扩大权限。 */
export type AcceptancePrivateAction = "persona-navigation";

/** 页面适配器只询问动作是否已授权，不依赖工作流或人物运行时。 */
export interface PageReviewInteractionPort {
  allows(action: AcceptancePrivateAction): boolean;
}
