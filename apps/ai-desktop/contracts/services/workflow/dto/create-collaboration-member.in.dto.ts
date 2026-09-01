/**
 * Workflow 创建协作成员输入协议。
 * 生产者：Renderer 成员管理页；消费者：Workflow 协作应用服务。
 * 数据方向：Renderer -> Workflow。
 * 本文件不允许页面提交成员运行状态或受保护身份。
 */
export interface CreateCollaborationMemberInDto {
  displayName: string;
}
