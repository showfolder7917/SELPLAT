/** 通用执行人完成一次代码执行后返回给协作流程的结果。 */
export interface ExecutorExecutionResultOutDto {
  /** code-verified 才允许协作流程准备任务结果提交。 */
  status: "code-verified" | "incomplete";
  /** 执行人物返回的本轮可见结果说明。 */
  text: string;
  /** 未完成或被门禁阻断的后续动作。 */
  pendingActions: string[];
  /** 整个执行与自修期间观察到的全部变更文件。 */
  changedFiles: string[];
  /** 首次实施结束时冻结的文件范围，提交前必须再次核对。 */
  authorizedFiles: string[];
  /** 本轮已经成功完成的验证命令。 */
  successfulCommands: string[];
}
