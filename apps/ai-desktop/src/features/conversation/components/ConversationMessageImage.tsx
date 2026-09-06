import "@selplat/sel-ui/core/kernel";
import "@selplat/sel-ui/components/dialog";
import "@selplat/sel-ui/components/dialog/styles";
import "@selplat/sel-ui/components/image-preview";
import "@selplat/sel-ui/components/image-preview/styles";

/** 图片预览公开能力：由 SELUI 管理弹层、缩放和拖动状态。 */
type ImagePreviewApi = {
  open(options: { src: string; alt: string; title: string }): boolean;
};

/**
 * 对话消息图片：把已发送附件显示为可打开大图的缩略图。
 * 发送前附件仍由各人物页面管理，避免改变附件的发送与移除链路。
 */
export function ConversationMessageImage({ src, alt }: { src: string; alt: string }) {
  /** 打开大图：只把现有附件地址与名称交给公共预览控件。 */
  function openImagePreview() {
    const api = (window as typeof window & { sel?: { components?: { imagePreview?: ImagePreviewApi } } }).sel?.components?.imagePreview;
    if (!api) throw new Error("SELUI image preview component is unavailable.");
    api.open({ src, alt, title: alt || "图片预览" });
  }

  return <button type="button" className="selconversation-message-image-trigger" aria-label={`打开大图：${alt || "图片"}`} onClick={openImagePreview}>
    <img src={src} alt={alt} />
  </button>;
}
