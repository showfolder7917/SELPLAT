import type { EvolutionStateOutDto } from "../../evolution/index.js";
import type { LinghuAutomationStateOutDto } from "../../personas/linghu/index.js";
import type { CollaborationStateOutDto } from "../dto/collaboration-state.out.dto.js";

/**
 * Workflow Supervisor 读取恢复判断所需状态的最小行为边界。
 *
 * 生产者：应用组合根提供的只读状态适配器。
 * 消费者：Workflow Supervisor。
 * 数据方向：Workflow -> 各状态所有者 -> Workflow。
 * 本 Port 禁止写入人物、Evolution 或 Workflow 状态，也不决定恢复动作。
 */
export interface WorkflowStateReaderPort {
  /** 读取当前协作状态；无传参，返回 Workflow 快照，读取失败由实现抛出且不修改状态。 */
  collaboration(): CollaborationStateOutDto;
  /** 读取当前演化状态；无传参，返回 Evolution 快照，读取失败由实现抛出且不推进流程。 */
  evolution(): EvolutionStateOutDto;
  /** 读取当前令狐自动保障状态；无传参，返回令狐快照，读取失败由实现抛出且不触发接手。 */
  linghu(): LinghuAutomationStateOutDto;
}
