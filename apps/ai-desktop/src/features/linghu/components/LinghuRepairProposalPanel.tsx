// 令狐提案面板只消费跨进程公开状态和工作区协议。
import type { LocaleValue, EvolutionStateOutDto, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
// 多字段提案使用 SEL UI 的顺序输入窗口，保持与桌面其他审批交互一致。
import { useSelUi } from "../../../theme/SelUiProvider";

/**
 * 收集令狐调查后的修正方向，并提交到韩立审批链。
 *
 * 真实传参示例：传入当前演化状态、已登记工作区和 `zh-CN`。
 * 真实返回示例：返回待审批数量与“提交修正方案”入口。
 * 异常或副作用示例：字段不完整时不调用主进程；IPC 失败通过 `onError` 回显。
 */
export function LinghuRepairProposalPanel({ state, workspaces, locale, onState, onError }: {
  // 演化状态用于统计令狐仍在审批或等待返还的方案。
  state: EvolutionStateOutDto;
  // 工作区是后续修正执行的安全边界，缺失时禁止提交。
  workspaces: WorkspaceStateOutDto | null;
  // 当前语言随提案一起提交，供后端保持任务语言环境。
  locale: LocaleValue;
  // 主进程返回新状态后由上层替换旧快照。
  onState(state: EvolutionStateOutDto): void;
  // 业务校验和 IPC 错误统一交给人物页面显示。
  onError(message: string): void;
}) {
  // 获取正式输入窗口，避免在本组件复制弹窗实现。
  const selUi = useSelUi();
  // 提交动作按标题、方向、证据、范围、风险、回退和验收顺序收集完整事实。
  const submit = async () => {
    // 没有已登记工作区时，令狐不能构造可执行修正任务。
    if (!workspaces) return onError("令狐修正方案缺少已登记工作区。");
    // 标题用于审批列表快速识别问题。
    const title = (await selUi.prompt({ title: "令狐修正方案", label: "修正方案标题" }))?.trim();
    // 正文描述调查后的具体修正方向，不能只复制原专题方案。
    const content = (await selUi.prompt({ title: "令狐修正方案", label: "详细修正方向", multiline: true }))?.trim();
    // 证据、范围、风险和验收允许逗号或换行输入，并在提交前去重。
    const evidence = splitList((await selUi.prompt({ title: "令狐修正方案", label: "充分调查事实（可用逗号分隔）" })) || "");
    const impactScope = splitList((await selUi.prompt({ title: "令狐修正方案", label: "影响范围（可用逗号分隔）" })) || "");
    const risks = splitList((await selUi.prompt({ title: "令狐修正方案", label: "风险（可用逗号分隔）" })) || "");
    // 回退方案必须能够独立说明失败后如何恢复。
    const rollbackPlan = (await selUi.prompt({ title: "令狐修正方案", label: "回退方案", multiline: true }))?.trim();
    const acceptanceCriteria = splitList((await selUi.prompt({ title: "令狐修正方案", label: "验收条件（可用逗号分隔）" })) || "");
    // 任一治理字段缺失都阻止提交，避免不完整方案进入自动审批。
    if (!title || !content || !evidence.length || !impactScope.length || !risks.length || !rollbackPlan || !acceptanceCriteria.length) return onError("令狐修正方案的标题、内容、事实、范围、风险、回退和验收必须完整。");
    try {
      // 提案只进入既有韩立审批链；Renderer 不直接创建协同修复任务。
      onState(await window.desktop!.createLinghuRepairProposal({ title, content, evidence, impactScope, risks, rollbackPlan, acceptanceCriteria, workspaceState: workspaces, locale }));
    } catch (reason) {
      // 保留后端真实错误，方便用户理解是权限、工作区还是审批状态问题。
      onError(readableError(reason, "令狐修正方案提交失败。"));
    }
  };
  // 只统计仍需审批或返还执行的令狐来源方案，终态历史由专题档案展示。
  const pending = state.proposals.filter((proposal) => proposal.origin === "linghu" && ["pending-approval", "supplement-required", "approved"].includes(proposal.status));
  // 人物页仅提供提案入口与数量，审批详情继续由演化工作台负责。
  return <section className="linghu-repair-proposals"><header><div><strong>修正方案审批</strong><span>持续修正 Bug 前先提交韩立审批</span></div><button type="button" onClick={() => void submit()}>提交修正方案</button></header><p>{pending.length ? `${pending.length} 个方案正在审批或等待返还执行。` : "当前没有待处理修正方案。"}</p></section>;
}

/** 把用户输入的多项事实规范成去空、去重数组。 */
function splitList(value: string): string[] {
  // 同时接受中英文逗号和换行，保留第一次出现的稳定顺序。
  return [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

/** 去掉 Electron IPC 固定包装，只向人物页返回真实业务错误。 */
function readableError(reason: unknown, fallback: string): string {
  // 非 Error 异常不可信，使用调用方提供的安全说明。
  const message = reason instanceof Error ? reason.message : fallback;
  // 只裁掉 IPC 方法名包装，不隐藏服务端错误详情。
  return message.replace(/^Error invoking remote method '[^']+':\s*/, "");
}
