import type { WorkspaceFilePreviewOutDto } from "../../../../contracts/services/support/platform/workspace/index";
import type { WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";

/** 右侧阅读面板唯一持有的只读文件结果，Explorer 只负责发出打开结果。 */
export type WorkspaceFilePreviewState = {
  preview: WorkspaceFilePreviewOutDto | null;
  error: string;
  workspaceId: string | null;
};

/** 左侧工作区浏览区的最小输入；登记状态仍由 useWorkspaceRegistry 唯一持有。 */
export type WorkspaceExplorerFeatureProps = {
  expanded: boolean;
  locale: "zh-CN" | "ja";
  workspaces: WorkspaceStateOutDto | null;
  workspaceError: string;
  onToggle: () => void;
  onAdd: () => void;
  onTogglePermission: (id: string, permission: "read-only" | "workspace-write") => void;
  onMakePrimary: (id: string) => void;
  onRemove: (id: string, name: string) => void;
  onFilePreviewChange: (next: WorkspaceFilePreviewState) => void;
};
