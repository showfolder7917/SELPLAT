/** 通用执行人完成一次代码执行后返回给协作流程的结果。 */
export interface ExecutorExecutionResultOutDto {
  status: "code-verified" | "incomplete";
  text: string;
  pendingActions: string[];
  changedFiles: string[];
  successfulCommands: string[];
}
