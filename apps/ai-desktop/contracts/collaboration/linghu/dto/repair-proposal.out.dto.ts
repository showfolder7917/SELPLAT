/**
 * DTO 方向：Out，表示修正材料从令狐模块输出到南宫审批模块。
 *
 * 数据生产方：LinghuAutomationFacade；Renderer 也可以通过正式 DesktopApi 提交同形数据。
 * 数据接收方：NangongEvolutionFacade 和提案 Store。
 * 数据流向：令狐 -> 南宫审批服务。
 * 作用：携带创建修正提案所需的完整事实、风险和验收材料。
 * 禁止职责：不得自动批准、分发、执行或修改提案状态。
 */
// 修正提案需要携带用户授权的完整工作区快照，主进程不能自行猜测工程范围。
import type { WorkspaceState } from "../../../desktop/workspace.js";
// locale 决定提案和后续审批使用的业务语言，但不改变提案事实。
import type { Locale } from "../../../foundation/base.js";

/** 令狐向南宫审批流程输出的修正提案 DTO。 */
export interface CreateLinghuRepairProposalOutDto {
  // 标题用一句话说明修正目标，供审批列表和专题时间线展示。
  title: string;
  // 正文说明具体修正内容，不能只保存笼统结论。
  content: string;
  // 证据数组保存触发修正的真实停点、测试或异常事实。
  evidence: string[];
  // 影响范围说明哪些模块、文件或流程可能被改变。
  impactScope: string[];
  // 风险数组要求提交者提前说明可能产生的副作用。
  risks: string[];
  // 回滚计划说明修正失败时怎样恢复原状态。
  rollbackPlan: string;
  // 验收条件由韩立和令狐后续流程共同核对。
  acceptanceCriteria: string[];
  // 工作区快照限定提案调查、审批和执行的工程边界。
  workspaceState: WorkspaceState;
  // 语言环境用于生成一致的用户可见提案文本。
  locale: Locale;
}
