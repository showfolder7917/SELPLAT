/** 韩立验收通过后可以沉淀的项目经验候选，供记忆层保存可复用的真实验收结论。 */
export type { HanliAcceptanceExperienceCandidateOutDto } from "./dto/acceptance-evidence.out.dto.js";

/** 韩立验收失败时形成的结构化证据，供修复流程定位实际结果、期望结果和截图。 */
export type { HanliAcceptanceFailureEvidenceOutDto } from "./dto/acceptance-evidence.out.dto.js";

/** 韩立窗口验收允许执行的单步操作类型，限制模型只能使用受控点击、滚动、按键等动作。 */
export type { HanliAcceptanceOperationValue } from "./value/acceptance.value.js";

/** 韩立会话聚合根可以返回的动作名称，用于应用服务选择唯一后续流程。 */
export type { HanliConversationActionKindValue } from "./value/hanli-conversation.value.js";

/** 韩立会话聚合根作出的完整业务决定，包含动作、观点和现有研讨状态。 */
export type { HanliConversationActionValue } from "./value/hanli-conversation.value.js";

/** 用户输入 1 时被冻结的韩立当前观点，供南宫婉研讨并追溯原会话消息。 */
export type { HanliConversationViewpointValue } from "./value/hanli-conversation.value.js";

/** 发起韩立真实窗口验收时传入的目标、提案和逐项验收条件。 */
export type { HanliComputerAcceptanceInDto } from "./dto/computer-acceptance.in.dto.js";

/** 一轮韩立真实窗口验收的完整结果，包含运行状态、步骤和截图证据。 */
export type { HanliAcceptanceRunOutDto } from "./dto/acceptance-run.out.dto.js";

/** 韩立真实窗口验收中的单步结果，用于关联操作、判断和对应截图。 */
export type { HanliAcceptanceStepResultOutDto } from "./dto/acceptance-run.out.dto.js";

/** 用户向韩立提交人工提案审批决定时使用的输入协议。 */
export type { DecideHanliProposalInDto } from "./dto/decide-proposal.in.dto.js";

/** 用户向韩立提交最终实施结果判断时使用的输入协议。 */
export type { DecideHanliResultInDto } from "./dto/decide-result.in.dto.js";

/** 韩立与南宫婉一次研讨问答的持久输出，记录问题、回答、判断和确认事实。 */
export type { HanliDeliberationRoundOutDto } from "./dto/deliberation.out.dto.js";

/** 一条韩立—南宫婉研讨的完整状态输出，供 Workflow 和界面读取当前进度。 */
export type { HanliEvolutionDeliberationOutDto } from "./dto/deliberation.out.dto.js";

/** 内部研讨成熟后形成的专题候选，包含建议范围、证据和验收条件。 */
export type { HanliTopicCandidateOutDto } from "./dto/deliberation.out.dto.js";

/** 韩立内部研讨的稳定状态枚举，用于区分提问中、待建立、已建立和阻塞。 */
export type { HanliDeliberationStatusValue } from "./value/deliberation.value.js";
