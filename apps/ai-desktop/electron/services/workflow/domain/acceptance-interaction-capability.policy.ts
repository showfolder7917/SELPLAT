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
  const hasWorkspaceExplorerScope = /左侧.*(?:Explorer|资源浏览)|工作区.*(?:添加|目录|文件)/u.test(approvedScope)
    && /添加工作区/u.test(approvedScope)
    && /目录/u.test(approvedScope)
    && /(?:只读.*(?:查看|预览)|文件.*(?:查看|预览))/u.test(approvedScope);
  const excludesAcceptanceTool = proposal.exclusions.some((item) => /(?:验收工具|原生目录|工作区).*(?:不扩展|禁止|排除)|(?:不扩展|禁止|排除).*(?:验收工具|原生目录|工作区)/u.test(item));
  return hasWorkspaceExplorerScope && !excludesAcceptanceTool ? ["workspace-explorer"] : [];
}
