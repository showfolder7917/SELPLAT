/**
 * 南宫婉更新尚未提交首版提案的专题输入协议。
 * 生产者：Renderer 南宫婉页面；消费者：南宫婉专题应用服务。
 * 数据方向：Renderer -> 南宫婉 -> Evolution。
 * 本文件不允许覆盖过期修订，也不修改审批事实。
 */
export interface UpdateNangongTopicInDto {
  expectedTopicRevision: number;
  title: string;
  goal: string;
  scope: string[];
  exclusions?: string[];
  evidence: string[];
  acceptanceCriteria: string[];
}
