/**
 * 南宫婉依据当前会话生成的可编辑课题草稿输出协议。
 * 生产者：南宫婉课题整理服务；消费者：Renderer 南宫婉课题表单。
 * 数据方向：南宫婉 -> Renderer。
 * 本文件不保存课题，也不代表用户已经确认。
 */
export interface NangongTopicDraftOutDto {
  title: string;
  goal: string;
  scope: string[];
  evidence: string[];
  acceptanceCriteria: string[];
}
