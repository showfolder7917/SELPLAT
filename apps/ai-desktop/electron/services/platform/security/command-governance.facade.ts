// 命令治理门面保存用户明确授予的最小信任范围，业务层不接触底层持久化文件。
export {
  TrustedCommandStore as CommandGovernanceFacade,
  isAlwaysReviewCommand,
  isAutomaticTestDocumentCommand,
  type TrustedCommandResult,
} from "./internal/trusted-command.store.js";
