// 安全模块的唯一出口只提供审批范围门面与公开判断，不暴露 internal 路径。
export {
  CommandGovernanceFacade,
  isAlwaysReviewCommand,
  isAutomaticTestDocumentCommand,
  type TrustedCommandResult,
} from "./command-governance.facade.js";
