/** 受管执行形成的唯一失败分流事实；Workflow 和页面不得再从命令文本或任务状态自行判断。 */
export interface ExecutorFailureRoutingOutDto {
  /** 探索性诊断只保留原执行上下文；其余两类分别阻断或交由令狐处理。 */
  kind: "diagnostic-correction" | "gate-failure" | "technical-failure";
  /** 失败命令所属的已声明步骤用途。 */
  stepPurpose: "diagnostic" | "implementation" | "validation";
  /** 诊断对象及其用途；不以命令名称猜测。 */
  diagnosticContext: string;
  /** 已核对的工作区与正式规则入口事实。 */
  verifiedFacts: string[];
  /** 原始命令结果，供展开详情核验。 */
  rawCommandResults: string[];
  /** 结构核对后的任务关联结论。 */
  taskRelation: "diagnostic-only" | "gate" | "direct";
  /** 卡头可显示的下一次重试动作。 */
  nextRetryAction: string;
}

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
  /** 范围确认表示现有授权不足，恢复流程必须等待确认而不是继续自动重试。 */
  failureKind?: "scope-confirmation";
  /** 未通过时的唯一失败分流；不存在时 Workflow 必须按门禁失败处理，禁止自动派发令狐。 */
  failureRouting?: ExecutorFailureRoutingOutDto;
}
