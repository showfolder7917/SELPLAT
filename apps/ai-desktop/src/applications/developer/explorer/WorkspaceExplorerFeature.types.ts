import type { WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";

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
};
