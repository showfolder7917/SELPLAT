/**
 * 补验恢复请求。
 *
 * 生产者：任务协作群专题卡。
 * 消费者：PersonaWorkflowFacade。
 * 数据流向：Renderer -> preload -> IPC -> Workflow。
 * 禁止职责：不携带新的专题内容，也不允许调用方猜测或创建关联目标。
 */
export interface RequestSupplementalAcceptanceInDto {
  /** 原专题标识，用于限定补验只能回到用户操作的专题卡。 */
  topicId: string;
  /** 修订链当前有效提案标识，Workflow 会重新核验其未被替代。 */
  proposalId: string;
  /** 原一次性运行标识，恢复动作只能继续这条持久运行。 */
  runId: string;
}
