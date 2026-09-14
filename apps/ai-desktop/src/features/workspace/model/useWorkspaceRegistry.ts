import { useEffect, useState } from "react";

import type { WorkspacePermissionValue, WorkspaceStateOutDto } from "../../../../contracts/system/desktop/index";
import { getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";

interface UseWorkspaceRegistryOptions {
  confirmRemove(name: string): Promise<boolean>;
}

/** 拥有 Developer 窗口的工作区注册表状态和全部工作区 DesktopApi 调用。 */
export function useWorkspaceRegistry({ confirmRemove }: UseWorkspaceRegistryOptions) {
  const [projectRoot, setProjectRoot] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceStateOutDto | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");

  useEffect(() => {
    const desktop = getOptionalSystemDesktopApi();
    if (!desktop) return;
    void desktop.getEnvironment().then((environment) => setProjectRoot(environment.projectRoot));
    let receivedAuthoritativeChange = false;
    const unsubscribe = desktop.onWorkspaceStateChanged((state) => {
      receivedAuthoritativeChange = true;
      applyWorkspaceState(state);
    });
    void desktop.getWorkspaces().then((state) => {
      // 订阅先于初次读取建立；若主进程期间已推送更新，不能再用较早的读取结果覆盖它。
      if (!receivedAuthoritativeChange) applyWorkspaceState(state);
    });
    return unsubscribe;
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
      const state = await getOptionalSystemDesktopApi()?.addWorkspace();
      if (!state) return;
      applyWorkspaceState(state);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to add workspace");
    }
  };

  const updateWorkspacePermission = async (id: string, permission: WorkspacePermissionValue) => {
    setWorkspaceError("");
    try {
      const state = await getOptionalSystemDesktopApi()?.updateWorkspacePermission(id, permission);
      if (state) applyWorkspaceState(state);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to update workspace permission");
    }
  };

  const setPrimaryWorkspace = async (id: string) => {
    setWorkspaceError("");
    try {
      const state = await getOptionalSystemDesktopApi()?.setPrimaryWorkspace(id);
      if (state) applyWorkspaceState(state);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Unable to set primary workspace");
    }
  };

  const removeWorkspace = async (id: string, name: string) => {
    if (!await confirmRemove(name)) return;
    try {
      const state = await getOptionalSystemDesktopApi()?.removeWorkspace(id);
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
