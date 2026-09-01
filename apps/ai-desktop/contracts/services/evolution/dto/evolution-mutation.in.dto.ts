/**
 * Evolution 写入并发控制协议。
 * 生产者：Renderer 专题工作台；消费者：主进程 Evolution 应用服务。
 * 数据方向：Renderer -> preload -> IPC -> Evolution。
 * 本文件只描述幂等键与预期版本，不包含人物审批或流程编排。
 */
export interface EvolutionMutationInDto {
  /** 页面读取到的共享状态版本；版本落后时写入必须被拒绝。 */
  expectedStateVersion: string;
  /** 单次业务动作的稳定幂等键；重试不得生成重复事实。 */
  idempotencyKey: string;
}
