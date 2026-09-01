/** 自动测试前置检查结果；由 Testing 产生并返回页面。 */
export interface AutomaticTestPreflightCheckOutDto {
  id: "harness" | "workspace" | "runner" | "lock" | "port" | "screen" | "command";
  status: "passed" | "failed";
  label: string;
  detail: string;
}

export interface AutomaticTestPreflightResultOutDto {
  status: "ready" | "blocked";
  checkedAt: string;
  checks: AutomaticTestPreflightCheckOutDto[];
}
