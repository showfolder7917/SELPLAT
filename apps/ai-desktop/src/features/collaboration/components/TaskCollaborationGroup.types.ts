/**
 * 任务协作群页面的参数协议。
 * 主页面、页面状态 Hook 和专属任务卡组件通过这些类型保持一致。
 */

import type {
  // 时间线快照：页面按专题读取全部权威节点。
  CollaborationTimelineSnapshotOutDto,
  // 界面语言：页面状态和操作文案选择中文或日文。
  LocaleValue,
} from "../../../../contracts/system/desktop/index";
import type {
  // 演化控制器：专题级恢复入口需要读取原运行并继续卡点。
  useEvolutionRuntime,
} from "../../evolution";

/** Developer 右侧“任务协作群”页面接收的完整参数。 */
export type TaskCollaborationGroupProps = {
  /** 专题演化状态和原运行恢复操作。 */
  evolution: ReturnType<typeof useEvolutionRuntime>;
  /** 主进程从 SQLite 读取的权威任务时间线；首次加载前为 null。 */
  snapshot: CollaborationTimelineSnapshotOutDto | null;
  /** 按时间线节点保存的实时可见正文。 */
  liveTextByNodeId: Record<string, string>;
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 用户对待审批提案执行人工审批。 */
  onManualApproval: (proposalId: string, title: string, content: string) => void;
  /** 用户从最新等待节点继续原协作任务。 */
  onContinueTask: (taskId: string) => Promise<void>;
};
