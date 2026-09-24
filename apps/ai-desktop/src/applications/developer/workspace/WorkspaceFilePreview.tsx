import { Copy16Regular, Dismiss16Regular } from "@fluentui/react-icons";
import { useState } from "react";

import { fixedUiText } from "../../../../contracts/foundation/index";
import type { WorkspaceFilePreviewState } from "../explorer/WorkspaceExplorerFeature.types";
import type { LocaleValue } from "../../../../contracts/system/desktop/index";

type WorkspaceFilePreviewProps = {
  locale: LocaleValue;
  preview: WorkspaceFilePreviewState;
  onClose: () => void;
};

/** 右侧主内容中的只读文件阅读面板；它不参与会话路由，也不拥有磁盘读取权限。 */
export function WorkspaceFilePreview({ locale, preview, onClose }: WorkspaceFilePreviewProps) {
  const [copying, setCopying] = useState(false);
  if (!preview.preview && !preview.error) return null;
  const text = (key: Parameters<typeof fixedUiText>[1]) => fixedUiText(locale, key);

  async function copyContent() {
    if (copying) return;
    setCopying(true);
    try {
      const copied = await window.sel?.core?.copyText?.(preview.preview?.content || "");
      window.sel?.core?.toast?.(copied ? text("workspaceContentCopied") : text("workspaceCopyFailed"), copied ? "success" : "error");
    } catch {
      window.sel?.core?.toast?.(text("workspaceCopyFailed"), "error");
    } finally {
      setCopying(false);
    }
  }

  return <section className="workspace-file-preview-panel" aria-label={text("workspaceFilePreview")}>
    <header>
      <div><strong>{preview.preview?.relativePath || text("workspaceFilePreview")}</strong></div>
      <div>
        {preview.preview && <button type="button" aria-label={text("workspaceCopyContent")} title={text("workspaceCopyContent")} disabled={copying} onClick={() => { void copyContent(); }}><Copy16Regular /></button>}
        <button type="button" aria-label={text("workspaceCloseFilePreview")} title={text("workspaceCloseFilePreview")} onClick={onClose}><Dismiss16Regular /></button>
      </div>
    </header>
    {preview.error ? <p role="alert">{preview.error}</p> : <pre>{preview.preview?.content}</pre>}
  </section>;
}
