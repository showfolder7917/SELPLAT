/**
 * Workflow 更新协作成员输入协议。
 * 生产者：Renderer 成员管理页；消费者：Workflow 协作应用服务。
 * 数据方向：Renderer -> Workflow。
 * 本文件不允许页面修改任务所有权、代次或保护标记。
 */
export interface UpdateCollaborationMemberInDto {
  displayName?: string;
  enabled?: boolean;
}
