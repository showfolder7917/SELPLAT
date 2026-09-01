/**
 * DTO 方向：In，表示数据从页面进入令狐模块。
 *
 * 数据生产方：Renderer 令狐面板。
 * 数据接收方：IPC Controller、LinghuAutomationFacade 和 LinghuAutomationStore。
 * 数据流向：页面 -> preload -> IPC -> 令狐 Service。
 * 作用：提交修改令狐启动文案所需的用户输入。
 * 禁止职责：不得查找文案、修改内存状态或写入持久化文件。
 */
/** 修改令狐启动文案的输入 DTO；只更新用户明确提供的字段。 */
export interface UpdateLinghuStartupPromptInDto {
  // `undefined` 表示保持原标题，不等同于清空标题。
  title?: string;
  // `undefined` 表示保持原正文，不等同于清空正文。
  content?: string;
  // `undefined` 表示保持启停状态，布尔值才表示用户明确切换。
  enabled?: boolean;
}
