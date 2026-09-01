/**
 * 令狐跨进程协议的唯一公开出口。
 *
 * 生产者：contracts/services/personas/linghu 内的纯类型文件。
 * 消费者：Electron 主进程、preload 类型桥和 Renderer 页面。
 * 数据方向：仅重新导出纯数据协议，不创建运行对象。
 * 禁止职责：不得导入 Electron、React、文件系统或具体服务实现。
 */
// 所有状态输出 DTO 都带 OutDto 后缀，调用方可以直接判断数据离开令狐模块。
export type {
  LinghuAutomaticFlowSnapshotOutDto,
  LinghuAutomationFeedbackOutDto,
  LinghuAutomationStateOutDto,
  LinghuModuleCompletionReportOutDto,
} from "./dto/automation-state.out.dto.js";
export type { LinghuAutomationModuleValue, LinghuBlockingKindValue, LinghuFlowHealthValue } from "./value/automation.value.js";
// 创建输入单独导出；InDto 表示数据从页面进入令狐模块。
export type { CreateLinghuStartupPromptInDto } from "./dto/create-startup-prompt.in.dto.js";
// 更新输入单独导出，避免和已经保存的输出实体混在同一文件。
export type { UpdateLinghuStartupPromptInDto } from "./dto/update-startup-prompt.in.dto.js";
// 保存后的启动文案属于令狐对外状态的一部分，因此使用 OutDto。
export type { LinghuStartupPromptOutDto } from "./dto/startup-prompt.out.dto.js";
// EventOutDto 表示令狐主动向页面发布事件，而不是页面调用请求。
export type { LinghuAutomationStateEventOutDto } from "./dto/automation-state.event.out.dto.js";
// 修正提案从令狐输出给南宫审批，所以站在令狐边界使用 OutDto。
export type { CreateLinghuRepairProposalOutDto } from "./dto/repair-proposal.out.dto.js";
