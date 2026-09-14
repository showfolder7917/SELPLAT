import type { CollaborationStateOutDto } from "./collaboration-state.out.dto.js";

/** 创建命令的回执；任务身份来自 Store 的创建结果，不能从状态列表猜选。 */
export interface SubmitCollaborationTaskOutDto {
  taskId: string;
  state: CollaborationStateOutDto;
}
