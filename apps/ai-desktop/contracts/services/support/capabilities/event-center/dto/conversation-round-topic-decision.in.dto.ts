/** 南宫会话轮次登记到事件中心时使用的主题判断。 */
export interface ConversationRoundTopicDecisionInDto {
  title: string;
  type: string;
  switchTopic: boolean;
  userIntent: string;
  tags: string[];
  summary: string;
}
