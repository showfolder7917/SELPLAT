/**
 * Codex 运行、认证、审批、用户输入和模型目录协议。
 *
 * 生产者：主进程 CodexService 与 CodexRuntime。
 * 消费者：preload 白名单和 Renderer 对话、审批及设置界面。
 * 数据方向：renderer <-> preload <-> main <-> Codex 子进程。
 * 本文件不包含访问令牌、子进程句柄或原始环境变量。
 */
import type { ModelServiceTierValue, ReasoningEffortValue } from "../../../../../foundation/index.js";

export interface CodexAccountOutDto {
  authenticated: boolean;
  /** 认证提供方返回的不可变账号主体；仅用于生成本地稳定用户 ID。 */
  accountSubject?: string | null;
  authMode: string | null;
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
}

export interface CodexRuntimeInfoOutDto {
  source: "bundled" | "downloaded";
  version: string;
}

export interface CodexHarnessStatusOutDto {
  connected: boolean;
  account: CodexAccountOutDto;
  error: string | null;
  runtime: CodexRuntimeInfoOutDto | null;
}

export interface CodexLoginResponseOutDto {
  loginId: string;
  authUrl: string;
}

export interface CodexApprovalOutDto {
  /** 主进程分配的全局请求标识；不同 Codex 连接之间不得重复。 */
  requestId: number;
  /** 授权针对命令执行还是文件修改。 */
  kind: "command" | "fileChange";
  /** 授权弹窗标题；人物连接会带上真实人物名称。 */
  title: string;
  /** Codex 提供的申请原因；没有原因时为 null。 */
  reason: string | null;
  /** 等待执行的命令；文件修改请求没有命令时为 null。 */
  command: string | null;
  /** 命令工作目录；无法确定或文件修改请求时允许为 null。 */
  cwd: string | null;
  /** 供用户核对的命令动作、文件变化或所属任务信息。 */
  details: string | null;
  /** 当前命令是否满足项目精确信任条件。 */
  trustEligible: boolean;
  /** 发起授权的人物或协作成员标识；主 Codex 会话没有人物时为 null。 */
  ownerMemberId?: string | null;
  /** 发起授权的人物显示名；主 Codex 会话没有人物时为 null。 */
  ownerMemberName?: string | null;
}

export interface ResolveCodexApprovalOutDto {
  status: "resolved" | "expired";
  trusted: boolean;
}

export interface CodexUserInputOptionOutDto {
  label: string;
  description: string;
}

export interface CodexUserInputQuestionOutDto {
  id: string;
  header: string;
  question: string;
  options: CodexUserInputOptionOutDto[];
}

export interface CodexUserInputRequestOutDto {
  requestId: number;
  questions: CodexUserInputQuestionOutDto[];
}

export interface CodexModelOptionOutDto {
  id: string;
  displayName: string;
  description: string;
  provider: string | null;
  supportedReasoningEfforts: ReasoningEffortValue[];
  supportedServiceTiers: ModelServiceTierValue[];
  defaultReasoningEffort: ReasoningEffortValue | null;
  isDefault: boolean;
}

export interface CodexModelCatalogOutDto {
  models: CodexModelOptionOutDto[];
}
