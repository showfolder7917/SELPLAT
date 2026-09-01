/**
 * DTO 方向：EventOut，表示令狐模块主动向页面输出状态事件。
 *
 * 数据生产方：LinghuAutomationStore。
 * 数据接收方：preload 事件桥和 Renderer 状态订阅者。
 * 数据流向：令狐 Store -> IPC 事件桥 -> 页面。
 * 作用：通知页面令狐状态已经完成一次原子提交。
 * 禁止职责：不得自行修改状态、重放事件或触发恢复动作。
 */
// 状态事件只组合状态输出 DTO，不重复声明完整状态字段。
import type { LinghuAutomationStateOutDto } from "./automation-state.out.dto.js";

/** 令狐每次状态提交后主动向外推送的事件 DTO。 */
export interface LinghuAutomationStateEventOutDto {
  // 状态是提交后的完整快照，页面无需拼接增量。
  state: LinghuAutomationStateOutDto;
  // reason 是稳定事件编码，用于审计和问题定位。
  reason: string;
}
