import type { EvolutionProposalOutDto } from "../../../../contracts/services/evolution/index.js";
import type { HanliAcceptanceInteractionCapability } from "../../../../contracts/services/personas/hanli/index.js";

/**
 * 从已批准提案的固定范围签发最小验收交互能力，拒绝由场景计划或模型文本自行扩大权限。
 *
 * 真实传参示例：范围同时写明左侧 Explorer、添加工作区、目录浏览和只读文件查看的提案。
 * 真实返回示例：返回 workspace-explorer，使验收器只放行该面板内的安全浏览动作。
 * 异常或副作用示例：本策略不写入专题、提案或工作区；任何范围遗漏或排除项都只会返回空数组。
 */
export function resolveAcceptanceInteractionCapabilities(proposal: EvolutionProposalOutDto): HanliAcceptanceInteractionCapability[] {
  const approvedScope = [proposal.content, ...proposal.impactScope, ...proposal.acceptanceCriteria].join("\n");
  // 受控目录场景可能只验读取、重试或树滚动；以工作区表面和目录数据同时出现为准，不能强制要求无关的添加或文件预览文案。
  const hasWorkspaceExplorerSurface = /左侧.*(?:Explorer|资源浏览)|(?:受控)?工作区.*(?:目录|树|资源浏览)|工作区树/u.test(approvedScope);
  const hasWorkspaceExplorerDataScope = /(?:受控)?工作区.*(?:目录|树|读取|文件)|目录.*(?:读取|树|文件|滚动|溢出)|文件.*(?:查看|预览|读取)/u.test(approvedScope);
  const hasWorkspaceExplorerScope = hasWorkspaceExplorerSurface && hasWorkspaceExplorerDataScope;
  // 任何一项明确的受控场景都需要 scenarios 夹具；要求所有场景同时出现会让重复读取或长目录验收错误退回 basic。
  const hasWorkspaceExplorerScenarioScope = hasWorkspaceExplorerScope && (
    /(?:加载|并行|重复(?:点击|读取|请求))/u.test(approvedScope)
    || /失败.*重试|重试.*失败/u.test(approvedScope)
    || /(?:空(?:目录|状态)|目录.*为空|为空.*目录)/u.test(approvedScope)
    || /(?:超长.*目录|长目录|目录.*(?:滚动|溢出)|工作区树.*滚动)/u.test(approvedScope)
  );
  const hasWorkspaceStartupRecoveryScope = hasWorkspaceExplorerScope
    && /(?:重启|重新启动|再次启动).*(?:回收|清理|移除|临时工作区)|(?:回收|清理|移除|临时工作区).*(?:重启|重新启动|再次启动)/u.test(approvedScope);
  const hasWorkspaceCleanupRecoveryScope = hasWorkspaceExplorerScope
    && /(?:收尾|清理|移除).*(?:失败|异常).*(?:恢复|重试|继续处理)|(?:失败|异常).*(?:收尾|清理|移除).*(?:恢复|重试|继续处理)/u.test(approvedScope);
  const excludesAcceptanceTool = proposal.exclusions.some((item) => /(?:验收工具|原生目录|工作区).*(?:不扩展|禁止|排除)|(?:不扩展|禁止|排除).*(?:验收工具|原生目录|工作区)/u.test(item));
  const hasCrossTaskMemberOccupancyScope = /(?:令狐|令狐老祖).*(?:另一(?:项)?(?:在途)?任务|处理(?:中)?其他任务)|(?:另一(?:项)?(?:在途)?任务|跨任务).*(?:令狐|人物(?:栏|页|状态)|当前任务)/u.test(approvedScope);
  if (excludesAcceptanceTool) return [];
  if (!hasWorkspaceExplorerScope) return hasCrossTaskMemberOccupancyScope ? ["cross-task-member-occupancy"] : [];
  return [
    "workspace-explorer",
    ...(hasWorkspaceExplorerScenarioScope ? ["workspace-explorer-scenarios" as const] : []),
    ...(hasWorkspaceCleanupRecoveryScope ? ["workspace-cleanup-recovery" as const] : []),
    ...(hasWorkspaceStartupRecoveryScope ? ["workspace-startup-recovery" as const] : []),
    ...(hasCrossTaskMemberOccupancyScope ? ["cross-task-member-occupancy" as const] : []),
  ];
}
