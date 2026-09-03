import { useEffect, useState } from "react";

import type { WorkspaceEntryOutDto, WorkspacePermissionValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";

interface UseWorkspaceRegistryOptions {
  confirmRemove(name: string): Promise<boolean>;
}

/** 拥有 Developer 窗口的工作区注册表状态和全部工作区 DesktopApi 调用。 */
export function useWorkspaceRegistry({ confirmRemove }: UseWorkspaceRegistryOptions) {
  const [projectRoot, setProjectRoot] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceStateOutDto | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [workspaceEntries, setWorkspaceEntries] = useState<Record<string, WorkspaceEntryOutDto[]>>({});
  const [workspaceError, setWorkspaceError] = useState("");

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
    void desktop.getWorkspaces().then((state) => {
      applyWorkspaceState(state);
      setExpandedWorkspaces(new Set(state.roots.map((root) => root.id)));
      for (const root of state.roots) {
        void desktop.listWorkspaceEntries(root.id).then((entries) => {
          setWorkspaceEntries((current) => ({ ...current, [root.id]: entries }));
        });
      }
    });
  }, []);

  /** 同步唯一工作区快照，并让窗口标题跟随当前主工作区。 */
  const applyWorkspaceState = (state: WorkspaceStateOutDto) => {
    setWorkspaces(state);
    const primary = state.roots.find((root) => root.id === state.primaryId);
    if (primary) setProjectRoot(primary.path);
  };

  const addWorkspace = async () => {
    setWorkspaceError("");
    try {
      const state = await window.desktop?.addWorkspace();
      if (!state) return;
      applyWorkspaceState(state);
      const added = state.roots.find((root) => !workspaces?.roots.some((current) => current.id === root.id));
      if (!added) return;
      setExpandedWorkspaces((current) => new Set(current).add(added.id));
      const entries = await window.desktop?.listWorkspaceEntries(added.id);
      if (entries) setWorkspaceEntries((current) => ({ ...current, [added.id]: entries }));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to add workspace");
    }
  };

  const toggleWorkspace = async (id: string) => {
    const willOpen = !expandedWorkspaces.has(id);
    setExpandedWorkspaces((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    if (willOpen && !workspaceEntries[id]) {
      const entries = await window.desktop?.listWorkspaceEntries(id);
      if (entries) setWorkspaceEntries((current) => ({ ...current, [id]: entries }));
    }
  };

  const updateWorkspacePermission = async (id: string, permission: WorkspacePermissionValue) => {
    const state = await window.desktop?.updateWorkspacePermission(id, permission);
    if (state) applyWorkspaceState(state);
  };

  const setPrimaryWorkspace = async (id: string) => {
    const state = await window.desktop?.setPrimaryWorkspace(id);
    if (state) applyWorkspaceState(state);
  };

  const removeWorkspace = async (id: string, name: string) => {
    if (!await confirmRemove(name)) return;
    try {
      const state = await window.desktop?.removeWorkspace(id);
      if (state) applyWorkspaceState(state);
      setExpandedWorkspaces((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to remove workspace");
    }
  };

  return {
    projectRoot,
    workspaces,
    expandedWorkspaces,
    workspaceEntries,
    workspaceError,
    addWorkspace,
    toggleWorkspace,
    updateWorkspacePermission,
    setPrimaryWorkspace,
    removeWorkspace,
  };
}
