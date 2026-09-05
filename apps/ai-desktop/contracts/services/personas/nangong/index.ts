/** 把南宫婉自由会话转换为专题的输入数据，供人物门面接收用户确认范围。 */
export type { ConvertNangongConversationToTopicInDto } from "./dto/convert-conversation-to-topic.in.dto.js";
/** 南宫婉创建实施提案的输入数据，供提案作者服务保存事实。 */
export type { CreateNangongProposalInDto } from "./dto/create-proposal.in.dto.js";
/** 南宫婉登记专题的输入数据，供 Evolution 保存冻结范围。 */
export type { CreateNangongTopicInDto } from "./dto/create-topic.in.dto.js";
/** 根据当前会话生成课题草稿的输入数据，供会话服务读取工作区和语言。 */
export type { GenerateNangongTopicDraftInDto } from "./dto/generate-topic-draft.in.dto.js";
/** 南宫婉修订提案的输入数据，供返修流程保留新版本。 */
export type { ReviseNangongProposalInDto } from "./dto/revise-proposal.in.dto.js";
/** 南宫婉生成的可编辑专题草稿，供 Renderer 在用户保存前继续修改。 */
export type { NangongTopicDraftOutDto } from "./dto/topic-draft.out.dto.js";
/** 南宫婉只读核实的结构化结果，供韩立会话引用事实和未知项。 */
export type { NangongInquiryResultOutDto } from "./dto/inquiry-result.out.dto.js";
/** 南宫婉更新既有专题的输入数据，供提案作者服务创建新状态版本。 */
export type { UpdateNangongTopicInDto } from "./dto/update-topic.in.dto.js";
/** 南宫婉会话聚合根允许返回的动作种类，供应用服务显式分支。 */
export type { NangongConversationActionKindValue } from "./value/nangong-conversation.value.js";
/** 南宫婉会话聚合根对当前输入形成的动作，供会话服务执行。 */
export type { NangongConversationActionValue } from "./value/nangong-conversation.value.js";
/** 南宫婉会话的持久属性快照，供领域聚合根恢复状态。 */
export type { NangongConversationSnapshotValue } from "./value/nangong-conversation.value.js";
