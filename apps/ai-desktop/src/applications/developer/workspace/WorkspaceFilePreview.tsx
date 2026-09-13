import { Dismiss16Regular } from "@fluentui/react-icons";

import type { WorkspaceFilePreviewState } from "../explorer/WorkspaceExplorerFeature.types";

type WorkspaceFilePreviewProps = {
  locale: "zh-CN" | "ja";
  preview: WorkspaceFilePreviewState;
  onClose: () => void;
};

/** 右侧主内容中的只读文件阅读面板；它不参与会话路由，也不拥有磁盘读取权限。 */
export function WorkspaceFilePreview({ locale, preview, onClose }: WorkspaceFilePreviewProps) {
  if (!preview.preview && !preview.error) return null;
  const text = locale === "ja"
    ? { title: "ファイルプレビュー", close: "ファイルプレビューを閉じる" }
    : { title: "文件预览", close: "关闭文件预览" };

  return <section className="workspace-file-preview-panel" aria-label={text.title}>
    <header>
      <div><strong>{preview.preview?.relativePath || text.title}</strong></div>
      <button type="button" aria-label={text.close} title={text.close} onClick={onClose}><Dismiss16Regular /></button>
    </header>
    {preview.error ? <p role="alert">{preview.error}</p> : <pre>{preview.preview?.content}</pre>}
  </section>;
}
