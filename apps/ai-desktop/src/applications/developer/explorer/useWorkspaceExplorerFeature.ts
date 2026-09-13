import { useRef, useState } from "react";

import type { WorkspaceDirectoryOutDto, WorkspaceFilePreviewOutDto } from "../../../../contracts/services/support/platform/workspace/index";
import { getOptionalSystemDesktopApi } from "../../../foundation/desktop-api";
import type { WorkspaceExplorerFeatureProps } from "./WorkspaceExplorerFeature.types";

type DirectoryState = { loading: boolean; error: string; entries: WorkspaceDirectoryOutDto["entries"] };
type SelectedEntry = { workspaceId: string; relativePath: string } | null;

function key(workspaceId: string, relativePath: string): string {
  return `${workspaceId}:${relativePath}`;
}

/** 工作区浏览控制器只保存树、选择和预览状态；登记、权限与主目录不在这里复制。 */
export function useWorkspaceExplorerFeature(props: WorkspaceExplorerFeatureProps) {
  const [directories, setDirectories] = useState<Record<string, DirectoryState>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry>(null);
  const [preview, setPreview] = useState<WorkspaceFilePreviewOutDto | null>(null);
  const [previewError, setPreviewError] = useState("");
  const pendingDirectoryLoads = useRef(new Map<string, Promise<void>>());

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
        setDirectories((current) => ({ ...current, [directoryKey]: { loading: false, error: "", entries: directory.entries } }));
      } catch (error) {
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
    setPreviewError("");
    try {
      const nextPreview = await getOptionalSystemDesktopApi()?.readWorkspaceFile(workspaceId, relativePath);
      if (nextPreview) setPreview(nextPreview);
    } catch (error) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : "文件预览失败。" );
    }
  }

  return { directories, expandedPaths, selectedEntry, preview, previewError, loadDirectory, selectEntry, toggleDirectory, openFile };
}
