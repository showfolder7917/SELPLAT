/**
 * 自动测试前置检查协议把环境问题转换为新手可读的检查项。
 * 生产者：测试能力；消费者：DesktopApi 与自动测试确认窗口。
 */
export interface AutomaticTestPreflightCheck {
  /** 稳定检查标识用于页面定位具体失败项。 */
  id: "harness" | "workspace" | "runner" | "lock" | "port" | "screen" | "command";
  /** passed 表示可继续，failed 表示必须先修复。 */
  status: "passed" | "failed";
  /** 面向用户的短名称。 */
  label: string;
  /** 包含真实原因和下一步建议，不暴露敏感令牌。 */
  detail: string;
}

export interface AutomaticTestPreflightResult {
  /** 全部检查通过才是 ready。 */
  status: "ready" | "blocked";
  /** 本轮检查完成的 ISO 时间。 */
  checkedAt: string;
  /** 按固定顺序返回的完整检查证据。 */
  checks: AutomaticTestPreflightCheck[];
}
