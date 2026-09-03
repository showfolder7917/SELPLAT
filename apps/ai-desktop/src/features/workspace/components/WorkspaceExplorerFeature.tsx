import { Add24Regular, ChevronDown16Regular, ChevronRight16Regular, Delete16Regular, Document24Regular, Folder24Regular, ShieldLock16Filled, ShieldLock16Regular, Star16Filled, Star16Regular } from "@fluentui/react-icons";

import type { useWorkspaceRegistry } from "../model/useWorkspaceRegistry";

type WorkspaceController = ReturnType<typeof useWorkspaceRegistry>;

type WorkspaceExplorerFeatureProps = {
  expanded: boolean;
  text: {
    workspaces: string;
    addWorkspace: string;
    expand: string;
    collapse: string;
    primary: string;
    makePrimary: string;
    minimumWorkspace: string;
    remove: string;
    readOnlyTip: string;
    writeTip: string;
  };
  workspace: WorkspaceController;
  onToggle: () => void;
};

/** 工作区 Explorer 拥有工作区列表展示与注册表动作，Application 只决定该布局分区是否可见。 */
export function WorkspaceExplorerFeature({ expanded, text, workspace, onToggle }: WorkspaceExplorerFeatureProps) {
  const {
    workspaces, expandedWorkspaces, workspaceEntries, workspaceError, addWorkspace, toggleWorkspace,
    updateWorkspacePermission, setPrimaryWorkspace, removeWorkspace,
  } = workspace;

  return <section className={`explorer-pane workspace-pane ${expanded ? "expanded" : "collapsed"}`}>
    <div className="dev-section-title workspace-title">
      <button className="section-toggle" aria-expanded={expanded} aria-controls="developer-workspace-list" aria-label={`${expanded ? text.collapse : text.expand}${text.workspaces}`} onClick={onToggle}>{expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{text.workspaces}</span></button>
      <button className="section-action" title={text.addWorkspace} aria-label={text.addWorkspace} onClick={() => void addWorkspace()}><Add24Regular /></button>
    </div>
    {expanded && <div id="developer-workspace-list" className="workspace-list">
      {workspaces?.roots.map((root) => {
        const rootExpanded = expandedWorkspaces.has(root.id);
        const primary = root.id === workspaces.primaryId;
        const readOnly = root.permission === "read-only";
        return <section className={`workspace-accordion ${rootExpanded ? "expanded" : ""}`} key={root.id}>
          <div className="workspace-header">
            <button className="workspace-toggle" onClick={() => void toggleWorkspace(root.id)} aria-expanded={rootExpanded} title={root.path}>{rootExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<Folder24Regular /><strong>{root.name}</strong></button>
            <div className="workspace-actions">
              <button className={`workspace-permission-action ${readOnly ? "read-only" : "workspace-write"}`} data-sel-tooltip={readOnly ? text.readOnlyTip : text.writeTip} data-sel-tooltip-mode="always" aria-label={readOnly ? text.readOnlyTip : text.writeTip} aria-pressed={readOnly} onClick={() => void updateWorkspacePermission(root.id, readOnly ? "workspace-write" : "read-only")}>{readOnly ? <ShieldLock16Filled /> : <ShieldLock16Regular />}</button>
              <button className={`workspace-primary-action ${primary ? "primary-root" : ""}`} data-sel-tooltip={primary ? text.primary : text.makePrimary} data-sel-tooltip-mode="always" aria-label={primary ? text.primary : text.makePrimary} disabled={primary} onClick={() => void setPrimaryWorkspace(root.id)}>{primary ? <Star16Filled /> : <Star16Regular />}</button>
              <button className="workspace-remove-action" data-sel-tooltip={workspaces.roots.length === 1 ? text.minimumWorkspace : text.remove} data-sel-tooltip-mode="always" aria-label={workspaces.roots.length === 1 ? text.minimumWorkspace : text.remove} disabled={workspaces.roots.length === 1} onClick={() => void removeWorkspace(root.id, root.name)}><Delete16Regular /></button>
            </div>
          </div>
          {rootExpanded && <div className="workspace-panel"><div className="workspace-meta" title={root.path}><span>{root.path}</span></div><div className="workspace-tree">{(workspaceEntries[root.id] || []).map((entry) => <div className="dev-file indent" key={`${entry.kind}:${entry.name}`}>{entry.kind === "directory" ? <Folder24Regular /> : <Document24Regular />}{entry.name}</div>)}</div></div>}
        </section>;
      })}
      {workspaceError && <div className="workspace-error">{workspaceError}</div>}
    </div>}
  </section>;
}
