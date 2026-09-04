import { useEffect, useState } from "react";

import type { WorkspacePermissionValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";

interface UseWorkspaceRegistryOptions {
  confirmRemove(name: string): Promise<boolean>;
}

/** 拥有 Developer 窗口的工作区注册表状态和全部工作区 DesktopApi 调用。 */
export function useWorkspaceRegistry({ confirmRemove }: UseWorkspaceRegistryOptions) {
  const [projectRoot, setProjectRoot] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceStateOutDto | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    void desktop.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
    void desktop.getWorkspaces().then((state) => {
      applyWorkspaceState(state);
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
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to add workspace");
    }
  };

  const updateWorkspacePermission = async (id: string, permission: WorkspacePermissionValue) => {
    setWorkspaceError("");
    try {
      const state = await window.desktop?.updateWorkspacePermission(id, permission);
      if (state) applyWorkspaceState(state);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to update workspace permission");
    }
  };

  const setPrimaryWorkspace = async (id: string) => {
    setWorkspaceError("");
    try {
      const state = await window.desktop?.setPrimaryWorkspace(id);
      if (state) applyWorkspaceState(state);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to set primary workspace");
    }
  };

  const removeWorkspace = async (id: string, name: string) => {
    if (!await confirmRemove(name)) return;
    try {
      const state = await window.desktop?.removeWorkspace(id);
      if (state) applyWorkspaceState(state);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to remove workspace");
    }
  };

  return {
    projectRoot,
    workspaces,
    workspaceError,
    addWorkspace,
    updateWorkspacePermission,
    setPrimaryWorkspace,
    removeWorkspace,
  };
}
