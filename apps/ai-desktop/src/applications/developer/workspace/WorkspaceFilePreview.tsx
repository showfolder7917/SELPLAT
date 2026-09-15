import { Copy16Regular, Dismiss16Regular } from "@fluentui/react-icons";
import { useState } from "react";

import type { WorkspaceFilePreviewState } from "../explorer/WorkspaceExplorerFeature.types";

type WorkspaceFilePreviewProps = {
  locale: "zh-CN" | "ja";
  preview: WorkspaceFilePreviewState;
  onClose: () => void;
};

/** 右侧主内容中的只读文件阅读面板；它不参与会话路由，也不拥有磁盘读取权限。 */
export function WorkspaceFilePreview({ locale, preview, onClose }: WorkspaceFilePreviewProps) {
  const [copying, setCopying] = useState(false);
  if (!preview.preview && !preview.error) return null;
  const text = locale === "ja"
    ? { title: "ファイルプレビュー", close: "ファイルプレビューを閉じる", copy: "内容をコピー", copied: "ファイル内容をコピーしました。", copyFailed: "ファイル内容をコピーできませんでした。" }
    : { title: "文件预览", close: "关闭文件预览", copy: "复制完整内容", copied: "已复制文件内容。", copyFailed: "无法复制文件内容。" };

  async function copyContent() {
    if (copying) return;
    setCopying(true);
    try {
      const copied = await window.sel?.core?.copyText?.(preview.preview?.content || "");
      window.sel?.core?.toast?.(copied ? text.copied : text.copyFailed, copied ? "success" : "error");
    } catch {
      window.sel?.core?.toast?.(text.copyFailed, "error");
    } finally {
      setCopying(false);
    }
  }

  return <section className="workspace-file-preview-panel" aria-label={text.title}>
    <header>
      <div><strong>{preview.preview?.relativePath || text.title}</strong></div>
      <div>
        {preview.preview && <button type="button" aria-label={text.copy} title={text.copy} disabled={copying} onClick={() => { void copyContent(); }}><Copy16Regular /></button>}
        <button type="button" aria-label={text.close} title={text.close} onClick={onClose}><Dismiss16Regular /></button>
      </div>
    </header>
    {preview.error ? <p role="alert">{preview.error}</p> : <pre>{preview.preview?.content}</pre>}
  </section>;
}
