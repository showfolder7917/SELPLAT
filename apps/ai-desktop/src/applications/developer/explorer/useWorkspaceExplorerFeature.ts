import { useEffect, useRef, useState } from "react";

import type { WorkspaceDirectoryOutDto, WorkspaceFileOpenOutDto, WorkspaceSystemFileOpenFailedOutDto } from "../../../../contracts/services/support/platform/workspace/index";
import { getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";
import type { WorkspaceExplorerFeatureProps } from "./WorkspaceExplorerFeature.types";

type DirectoryState = { loading: boolean; error: string; entries: WorkspaceDirectoryOutDto["entries"] };
type SelectedEntry = { workspaceId: string; relativePath: string } | null;

const FILE_OPERATION_TIMEOUT_MS = 12_000;

function key(workspaceId: string, relativePath: string): string {
  return `${workspaceId}:${relativePath}`;
}

/** 工作区浏览控制器只保存树、选择和预览状态；登记、权限与主目录不在这里复制。 */
export function useWorkspaceExplorerFeature(props: WorkspaceExplorerFeatureProps) {
  const [directories, setDirectories] = useState<Record<string, DirectoryState>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry>(null);
  const pendingDirectoryLoads = useRef(new Map<string, Promise<void>>());
  // 每次文件点击取得递增编号，迟到的异步结果不能覆盖用户已切换后的选择。
  const openRequestId = useRef(0);
  // 相同文件仍在请求时复用同一 Promise，避免 PPT/PPTX 重复交给系统默认应用。
  const pendingFileOpens = useRef(new Map<string, Promise<WorkspaceFileOpenOutDto | WorkspaceSystemFileOpenFailedOutDto>>());
  const workspaceIds = props.workspaces?.roots.map((root) => root.id) || [];
  const workspaceIdsKey = workspaceIds.join("\u0000");
  const registeredWorkspaceIds = useRef(new Set(workspaceIds));

  useEffect(() => {
    registeredWorkspaceIds.current = new Set(workspaceIds);
    const isRegisteredWorkspace = (workspaceId: string) => workspaceIds.includes(workspaceId);
    const belongsToRegisteredWorkspace = (entryKey: string) => workspaceIds.some((workspaceId) => entryKey.startsWith(`${workspaceId}:`));

    // 撤销登记后立即移除旧树和选择，避免 Renderer 继续暴露已失效根中的文件内容。
    setDirectories((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([entryKey]) => belongsToRegisteredWorkspace(entryKey)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
    setExpandedPaths((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([entryKey]) => belongsToRegisteredWorkspace(entryKey)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
    setSelectedEntry((current) => current && !isRegisteredWorkspace(current.workspaceId) ? null : current);
  }, [workspaceIdsKey]);

  function loadDirectory(workspaceId: string, relativePath: string): Promise<void> {
    const directoryKey = key(workspaceId, relativePath);
    const pendingLoad = pendingDirectoryLoads.current.get(directoryKey);
    if (pendingLoad) return pendingLoad;

    const request = (async () => {
      setDirectories((current) => ({ ...current, [directoryKey]: { loading: true, error: "", entries: current[directoryKey]?.entries || [] } }));
      try {
        const api = getOptionalSystemDesktopApi();
        if (!api) throw new Error("桌面接口不可用。");
        const directory = await api.listWorkspaceDirectory(workspaceId, relativePath);
        // 请求返回前工作区可能已被移除；此时不能把旧内容重新写回树状态。
        if (!registeredWorkspaceIds.current.has(workspaceId)) return;
        setDirectories((current) => ({ ...current, [directoryKey]: { loading: false, error: "", entries: directory.entries } }));
      } catch (error) {
        if (!registeredWorkspaceIds.current.has(workspaceId)) return;
        const message = error instanceof Error ? error.message : "目录读取失败。";
        setDirectories((current) => ({ ...current, [directoryKey]: { loading: false, error: message, entries: current[directoryKey]?.entries || [] } }));
      } finally {
        pendingDirectoryLoads.current.delete(directoryKey);
      }
    })();
    pendingDirectoryLoads.current.set(directoryKey, request);
    return request;
  }

  function selectEntry(workspaceId: string, relativePath: string) {
    setSelectedEntry({ workspaceId, relativePath });
  }

  function toggleDirectory(workspaceId: string, relativePath: string) {
    const directoryKey = key(workspaceId, relativePath);
    const nextExpanded = !expandedPaths[directoryKey];
    setExpandedPaths((current) => ({ ...current, [directoryKey]: nextExpanded }));
    if (nextExpanded && !directories[directoryKey]?.loading && !directories[directoryKey]?.entries && !directories[directoryKey]?.error) {
      void loadDirectory(workspaceId, relativePath);
    }
  }

  async function openFile(workspaceId: string, relativePath: string) {
    const requestId = ++openRequestId.current;
    const fileKey = key(workspaceId, relativePath);
    try {
      const api = getOptionalSystemDesktopApi();
      if (!api) throw new Error("桌面接口不可用。");
      const pendingOpen = pendingFileOpens.current.get(fileKey);
      const request = pendingOpen || api.openWorkspaceFile(workspaceId, relativePath);
      if (!pendingOpen) {
        pendingFileOpens.current.set(fileKey, request);
        void request.finally(() => pendingFileOpens.current.delete(fileKey));
      }
      const result = await request;
      if (requestId !== openRequestId.current || !registeredWorkspaceIds.current.has(workspaceId)) return;
      if (result.kind === "preview") {
        props.onFilePreviewChange({ preview: result, error: "", workspaceId });
        return;
      }
      if (result.kind === "system-open-failed") window.sel?.core?.toast?.(result.message, "error");
    } catch (error) {
      if (requestId !== openRequestId.current || !registeredWorkspaceIds.current.has(workspaceId)) return;
      props.onFilePreviewChange({ preview: null, error: error instanceof Error ? error.message : "文件预览失败。", workspaceId });
    }
  }

  return { directories, expandedPaths, selectedEntry, loadDirectory, selectEntry, toggleDirectory, openFile };
}
