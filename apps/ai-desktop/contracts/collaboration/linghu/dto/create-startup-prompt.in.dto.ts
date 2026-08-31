/**
 * DTO 方向：In，表示数据从页面进入令狐模块。
 *
 * 数据生产方：Renderer 令狐面板。
 * 数据接收方：IPC Controller、LinghuAutomationFacade 和 LinghuAutomationStore。
 * 数据流向：页面 -> preload -> IPC -> 令狐 Service。
 * 作用：提交创建令狐启动文案所需的用户输入。
 * 禁止职责：不得生成 ID、写入状态文件或执行启动文案。
 */
/** 创建令狐启动文案的输入 DTO；ID 和时间由主进程 Store 生成。 */
export interface CreateLinghuStartupPromptInDto {
  // 标题必须是非空白文本，具体长度门禁由 Store 统一执行。
  title: string;
  // 正文必须是非空白文本，只作为令狐任务约束使用。
  content: string;
}
