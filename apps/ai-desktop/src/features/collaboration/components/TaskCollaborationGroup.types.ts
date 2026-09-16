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
import type { CurrentTopicReadRecoveryOutDto, CurrentTopicStageOutDto } from "../../../../contracts/services/evolution/index";
import type { CollaborationStateReadStatus } from "../model/collaboration-formatters";

/** Developer 右侧“任务协作群”页面使用的完整模型。 */
export type TaskRecoveryResult = {
  kind: "confirmed" | "queued" | "unavailable";
  message: string;
};

export type TaskCollaborationGroupModel = {
  /** 任务群使用的权威时间线和实时正文。 */
  data: {
    /** 主进程从 SQLite 读取的权威任务时间线；首次加载前为 null。 */
    snapshot: CollaborationTimelineSnapshotOutDto | null;
    /** 当前交付结论的唯一投影；时间线不再参与当前状态推断。 */
    currentTopicStage: CurrentTopicStageOutDto | null;
    /** 按时间线节点保存的实时可见正文。 */
    liveTextByNodeId: Record<string, string>;
  };
  /** 只影响当前页面呈现的界面状态。 */
  presentation: {
    /** 当前界面语言。 */
    locale: LocaleValue;
    /** 状态尚未返回时，空专题不能被当作当前协作事实。 */
    stateReadStatus: CollaborationStateReadStatus;
    /** 交付投影首次读取状态。 */
    deliveryReadStatus: CollaborationStateReadStatus;
    /** 时间线首次读取状态；失败时不能继续使用旧历史作为当前结论。 */
    timelineReadStatus: CollaborationStateReadStatus;
    /** 主进程投影写入失败时的局部技术状态。 */
    timelineProjectionStatus: { status: "ready" | "unavailable"; message: string };
    /** 读取失败的可读原因。 */
    readError: string;
    /** 当前专题投影签发的读取恢复政策；页面不得以本地次数覆盖它。 */
    readRecovery: CurrentTopicReadRecoveryOutDto;
  };
  /** 用户可以从任务群页面触发的业务操作。 */
  actions: {
    /** 用户对待审批提案执行人工审批。 */
    onManualApproval: (proposalId: string, title: string, content: string) => void;
    /** 用户从最新等待节点继续原协作任务。 */
    onContinueTask: (taskId: string) => Promise<TaskRecoveryResult>;
    /** 用户从原专题卡恢复被阻塞的一次性验收运行。 */
    onResumeAcceptance: (request: { topicId: string; proposalId: string; runId: string }) => Promise<TaskRecoveryResult>;
    /** 打开韩立人物会话，让用户从需求讨论开始，不提交协作任务。 */
    onOpenHanliConversation: () => Promise<void>;
    /** 仅重新读取交付投影和时间线，不触发任务恢复。 */
    onRetryDeliveryRead: () => Promise<void>;
    /** 仅重新读取失败的专题时间线，保留已经显示的最后成功快照。 */
    onRetryTimelineRead: () => Promise<void>;
    /** 仅重试最近失败的时间线投影写入，不重启协作任务。 */
    onRetryTimelineProjection: () => Promise<void>;
  };
};

/** 任务协作群组件只接收一份具名页面模型。 */
export type TaskCollaborationGroupProps = {
  /** 页面展示、演化状态和业务操作已经归组后的完整模型。 */
  model: TaskCollaborationGroupModel;
};
