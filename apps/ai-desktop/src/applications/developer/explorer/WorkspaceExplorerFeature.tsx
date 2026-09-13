import { Add16Regular, ChevronDown16Regular, ChevronRight16Regular, Delete16Regular, Document16Regular, Folder16Regular, ShieldLock16Filled, ShieldLock16Regular, Star16Filled, Star16Regular } from "@fluentui/react-icons";

import type { WorkspaceDirectoryEntryOutDto } from "../../../../contracts/services/support/platform/workspace/index";
import type { WorkspaceExplorerFeatureProps } from "./WorkspaceExplorerFeature.types";
import { useWorkspaceExplorerFeature } from "./useWorkspaceExplorerFeature";

/** Developer 左侧“工作区”区域：只浏览已登记目录，文件读取始终由主进程校验。 */
export function WorkspaceExplorerFeature(props: WorkspaceExplorerFeatureProps) {
  const controller = useWorkspaceExplorerFeature(props);
  const text = props.locale === "ja"
    ? { title: "ワークスペース", add: "追加", empty: "登録済みのワークスペースはありません。", retry: "再試行", loading: "読み込み中…", emptyDirectory: "空のフォルダー", preview: "ファイルプレビュー", primary: "メイン", makePrimary: "メインに設定", remove: "削除", minimum: "ワークスペースを1つ以上残してください", readOnly: "現在は読み取り専用", writable: "現在は書き込み可能" }
    : { title: "工作区", add: "添加", empty: "暂无已登记工作区。", retry: "重试", loading: "正在读取…", emptyDirectory: "空目录", preview: "文件预览", primary: "主目录", makePrimary: "设为主目录", remove: "移除", minimum: "至少保留一个工作区", readOnly: "当前只读", writable: "当前可写入" };

  function renderEntries(workspaceId: string, relativePath: string, depth: number) {
    const state = controller.directories[`${workspaceId}:${relativePath}`];
    if (!state) return null;
    if (state.loading) return <span className="workspace-tree-message">{text.loading}</span>;
    if (state.error) return <div className="workspace-tree-error"><span>{state.error}</span><button type="button" onClick={() => { void controller.loadDirectory(workspaceId, relativePath); }}>{text.retry}</button></div>;
    if (state.entries.length === 0) return <span className="workspace-tree-message">{text.emptyDirectory}</span>;
    return state.entries.map((entry) => renderEntry(workspaceId, entry, depth));
  }

  function renderEntry(workspaceId: string, entry: WorkspaceDirectoryEntryOutDto, depth: number) {
    const selected = controller.selectedEntry?.workspaceId === workspaceId && controller.selectedEntry.relativePath === entry.relativePath;
    if (entry.kind === "file") {
      return <button className={`workspace-tree-row file ${selected ? "selected" : ""}`} type="button" key={entry.relativePath} style={{ paddingInlineStart: `${12 + depth * 14}px` }} onClick={() => { controller.selectEntry(workspaceId, entry.relativePath); void controller.openFile(workspaceId, entry.relativePath); }}><Document16Regular /><span title={entry.relativePath}>{entry.name}</span></button>;
    }
    const directoryKey = `${workspaceId}:${entry.relativePath}`;
    const expanded = controller.expandedPaths[directoryKey] === true;
    return <div className="workspace-tree-directory" key={entry.relativePath}>
      <button className={`workspace-tree-row ${selected ? "selected" : ""}`} type="button" aria-expanded={expanded} style={{ paddingInlineStart: `${12 + depth * 14}px` }} onClick={() => { controller.selectEntry(workspaceId, entry.relativePath); controller.toggleDirectory(workspaceId, entry.relativePath); }}>
        {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<Folder16Regular /><span title={entry.relativePath}>{entry.name}</span>
      </button>
      {expanded && <div className="workspace-tree-children">{renderEntries(workspaceId, entry.relativePath, depth + 1)}</div>}
    </div>;
  }

  return <section className={`explorer-pane workspace-pane ${props.expanded ? "expanded" : "collapsed"}`}>
    <div className="dev-section-title">
      <button className="section-toggle" type="button" aria-expanded={props.expanded} aria-controls="developer-workspace-tree" onClick={props.onToggle}>
        {props.expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span>{text.title}</span>
      </button>
      <button className="section-action" type="button" aria-label={text.add} onClick={props.onAdd}><Add16Regular /></button>
    </div>
    <div id="developer-workspace-tree" className="workspace-tree">
      {props.workspaceError && <div className="workspace-tree-error"><span>{props.workspaceError}</span></div>}
      {!props.workspaces?.roots.length && <span className="workspace-tree-message">{text.empty}</span>}
      {props.workspaces?.roots.map((root) => {
        const rootKey = `${root.id}:`;
        const expanded = controller.expandedPaths[rootKey] === true;
        const selected = controller.selectedEntry?.workspaceId === root.id && controller.selectedEntry.relativePath === "";
        const primary = root.id === props.workspaces?.primaryId;
        const readOnly = root.permission === "read-only";
        const onlyWorkspace = props.workspaces?.roots.length === 1;
        return <div className="workspace-tree-root" key={root.id}>
          <div className="workspace-root-header"><button className={`workspace-tree-row root ${selected ? "selected" : ""}`} type="button" aria-expanded={expanded} onClick={() => { controller.selectEntry(root.id, ""); controller.toggleDirectory(root.id, ""); }}>
            {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<Folder16Regular /><span title={root.path}>{root.name}</span>
          </button><div className="workspace-root-actions">
            <button type="button" aria-label={readOnly ? text.readOnly : text.writable} title={readOnly ? text.readOnly : text.writable} onClick={() => props.onTogglePermission(root.id, readOnly ? "workspace-write" : "read-only")}>{readOnly ? <ShieldLock16Filled /> : <ShieldLock16Regular />}</button>
            <button type="button" aria-label={primary ? text.primary : text.makePrimary} title={primary ? text.primary : text.makePrimary} disabled={primary} onClick={() => props.onMakePrimary(root.id)}>{primary ? <Star16Filled /> : <Star16Regular />}</button>
            <button type="button" aria-label={onlyWorkspace ? text.minimum : text.remove} title={onlyWorkspace ? text.minimum : text.remove} disabled={onlyWorkspace} onClick={() => props.onRemove(root.id, root.name)}><Delete16Regular /></button>
          </div></div>
          {expanded && <div className="workspace-tree-children">{renderEntries(root.id, "", 1)}</div>}
        </div>;
      })}
      {(controller.preview || controller.previewError) && <section className="workspace-file-preview" aria-label={text.preview}>
        <strong>{controller.preview?.relativePath || text.preview}</strong>
        {controller.previewError ? <span role="alert">{controller.previewError}</span> : <pre>{controller.preview?.content}</pre>}
      </section>}
    </div>
  </section>;
}
