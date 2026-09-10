/**
 * Workflow 在任务提交时冻结的输入快照协议。
 *
 * 生产者：Workflow 协作应用服务。
 * 消费者：执行人物、任务恢复流程和审计投影。
 * 数据方向：Workflow -> 任务执行与恢复调用方。
 * 本文件只描述任务开始时的原始事实，不保存任务运行状态。
 */

// LocaleValue 说明任务创建时使用的界面语言和区域设置。
import type { LocaleValue } from "../../../foundation/index.js";
// WorkspaceStateOutDto 保存任务被提交时已经确认的工作区范围。
import type { WorkspaceStateOutDto } from "../../support/platform/workspace/index.js";

/** 一次任务实际加载的规则及其版本，用于复现当时的执行环境。 */
export interface CollaborationTaskRuleContextOutDto {
  /** 提交任务时处于活动状态的稳定用户标识。 */
  activeUserId: string;
  /** 当前执行者在规则系统中的业务角色。 */
  role: "hanli" | "nangong" | "executor" | "linghu";
  /** 本次规则解析结果的修订号。 */
  ruleRevision: string;
  /** 当前角色无论任务内容如何都必须加载的规则 ID。 */
  mandatoryRoleRuleIds: string[];
  /** 根据当前任务内容匹配到的规则 ID。 */
  matchedTaskRuleIds: string[];
  /** 上述规则继续依赖的规则 ID。 */
  dependencyRuleIds: string[];
  /** 规则 ID 到内容哈希的映射，用于确认规则是否发生变化。 */
  loadedRuleHashes: Record<string, string>;
  /** 规则 ID 到当时实际加载正文的映射，用于恢复和审计。 */
  loadedRuleContents: Record<string, string>;
  /** 任务提交时生效的 AGENTS.md 内容。 */
  agentsContent: string;
  /** 任务提交时用于查找规则的索引目录。 */
  indexCatalog: string;
  /** 规则加载器返回的可读加载凭据。 */
  ruleReceipt: string[];
}

/** 任务提交成功后不可随运行过程改变的需求快照。 */
export interface CollaborationTaskSnapshotOutDto {
  /** 显示在任务卡和审计记录中的任务标题。 */
  title: string;
  /** 发起方描述的原始问题。 */
  problemStatement: string;
  /** 经过确认后允许执行的真实意图。 */
  confirmedIntent: string;
  /** 执行过程中必须遵守的限制条件。 */
  constraints: string[];
  /** 用来判断任务是否完成的验收条件。 */
  acceptanceCriteria: string[];
  /** 产生本任务的会话消息编号。 */
  sourceMessageIds: number[];
  /** 本任务引用的附件标识。 */
  attachmentIds: string[];
  /** 任务提交时已经确认的工作区。 */
  workspaceState: WorkspaceStateOutDto;
  /** 任务内容应使用的语言和区域设置。 */
  locale: LocaleValue;
  /** 冻结快照的内容哈希，用于识别后续篡改。 */
  contentHash: string;
  /** 当时实际加载的规则；旧任务无法恢复该信息时为 null。 */
  ruleContext: CollaborationTaskRuleContextOutDto | null;
}
