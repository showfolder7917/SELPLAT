import type {
  // LocaleValue 限制工作区显示语言为桌面端支持的中文或日文。
  LocaleValue,
  // WorkspaceStateOutDto 是人物会话允许读取的工作区快照。
  WorkspaceStateOutDto,
} from "../../../../contracts/system/desktop/index";
import type { useCollaborationWorkspace } from "../../../features/collaboration";
import type { useCodexWorkspace, usePersonaConversation } from "../../../features/conversation";
import type { useEvolutionRuntime } from "../../../features/evolution";
import type { useScreenshotCapture } from "../../../features/screenshot";

/** Developer 主窗口交给工作区路由的 Feature 边界。 */
export type DeveloperWorkspaceRouterProps = {
  /** 当前界面语言。 */
  locale: LocaleValue;
  /** 主 Codex 会话当前使用的文件权限模式。 */
  sandboxMode: "read-only" | "workspace-write";
  /** 当前登记的工作区，初始化完成前允许为空。 */
  workspaces: WorkspaceStateOutDto | null;
  /** 协作 Feature 的公开状态与操作。 */
  collaboration: ReturnType<typeof useCollaborationWorkspace>;
  /** 主 Codex 会话的公开状态与操作。 */
  codex: ReturnType<typeof useCodexWorkspace>;
  /** 韩立和南宫共同消费的演化状态。 */
  evolution: ReturnType<typeof useEvolutionRuntime>;
  /** 韩立人物会话状态。 */
  hanli: ReturnType<typeof usePersonaConversation>;
  /** 南宫婉人物会话状态。 */
  nangong: ReturnType<typeof usePersonaConversation>;
  /** 三个会话共用的截图能力。 */
  screenshot: ReturnType<typeof useScreenshotCapture>;
};

/** 工作区路由内部使用的协作 Feature 类型。 */
export type CollaborationWorkspace = DeveloperWorkspaceRouterProps["collaboration"];
