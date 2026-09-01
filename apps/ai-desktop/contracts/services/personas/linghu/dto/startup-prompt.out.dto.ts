/**
 * DTO 方向：Out，表示数据从令狐模块输出到页面。
 *
 * 数据生产方：LinghuAutomationStore。
 * 数据接收方：Renderer 令狐面板和状态订阅者。
 * 数据流向：令狐 Service -> IPC -> preload -> 页面。
 * 作用：返回已经生成稳定 ID 并保存的启动文案。
 * 禁止职责：不得校验输入、生成 ID、写入文件或执行启动文案。
 */
/** 令狐向外返回的启动文案 DTO；Store 负责生成和维护其中的数据。 */
export interface LinghuStartupPromptOutDto {
  // 稳定 ID 用于选择、更新和删除，不能使用可变标题代替。
  promptId: string;
  // 标题供人物页面列表显示，最长限制由 Store 校验。
  title: string;
  // 正文作为令狐任务约束的一部分，不直接当作可执行命令。
  content: string;
  // 停用文案保留历史但不能成为当前入口。
  enabled: boolean;
  // 创建时间使用 ISO 字符串，便于跨进程和数据库记录。
  createdAt: string;
  // 更新时间记录最后一次内容或启停变化。
  updatedAt: string;
}
